import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  FinancialEntryDirection,
  FinancialEntryOrigin,
  FinancialEntryStatus,
  FinancialEntryWithholdingStatus,
  IntakeDocumentDirection,
  IntakeProcessingStatus,
  Prisma,
  type DocumentProcessingSettings,
  type IntakeDocument,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { AllocationApplicationService } from './allocation-application.service';
import { EntryClassificationService } from './entry-classification.service';
import { InstallmentGeneratorService } from './installment-generator.service';
import { WithholdingCalculatorService } from './withholding-calculator.service';
import type {
  ProcessDocumentDto,
  UpdateProcessingSettingsDto,
} from './dto/document-processing.dto';

/**
 * Motor do processamento.
 *
 * Pega um documento que a entrada marcou como `READY_FOR_PROCESSING` e o transforma em
 * lançamento financeiro: classificação, parcelas, rateio e retenções.
 *
 * **Um documento gera um lançamento.** `sourceIntakeDocumentId` é único no banco, então a
 * garantia não depende deste código estar correto — o banco recusa a segunda tentativa.
 *
 * O que este módulo continua não fazendo: autorizar, agendar, remeter ou executar
 * pagamento, e dar baixa. O lançamento para em `OPEN`.
 */
@Injectable()
export class DocumentProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly classification: EntryClassificationService,
    private readonly withholdings: WithholdingCalculatorService,
    private readonly installments: InstallmentGeneratorService,
    private readonly allocations: AllocationApplicationService,
  ) {}

  // ── Parâmetros ────────────────────────────────────────────────────────────

  async findSettings(
    organizationId: string,
    companyId: string,
  ): Promise<DocumentProcessingSettings> {
    const existing = await this.prisma.documentProcessingSettings.findUnique({
      where: { companyId },
    });

    if (existing) return existing;

    return this.prisma.documentProcessingSettings.create({
      data: { organizationId, companyId },
    });
  }

  async updateSettings(
    organizationId: string,
    companyId: string,
    dto: UpdateProcessingSettingsDto,
    actor: RequestUser,
  ) {
    const before = await this.findSettings(organizationId, companyId);

    const updated = await this.prisma.documentProcessingSettings.update({
      where: { companyId },
      data: { ...dto, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'UPDATE_DOCUMENT_PROCESSING_SETTINGS',
      entity: 'DocumentProcessingSettings',
      entityId: updated.id,
      oldValue: before,
      newValue: updated,
    });

    return updated;
  }

  // ── Fila do processamento ─────────────────────────────────────────────────

  /**
   * Documentos encaminhados que ainda não viraram lançamento.
   *
   * O filtro é `financialEntry: null`, não uma situação nova no documento: a existência do
   * lançamento **é** o estado. Uma flag paralela poderia divergir do fato.
   */
  async findQueue(
    organizationId: string,
    companyId: string | undefined,
    page: number,
    perPage: number,
  ) {
    const where: Prisma.IntakeDocumentWhereInput = {
      organizationId,
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      processingStatus: IntakeProcessingStatus.READY_FOR_PROCESSING,
      financialEntry: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.intakeDocument.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          company: { select: { id: true, legalName: true, tradeName: true } },
          supplier: { select: { id: true, legalName: true, tradeName: true } },
          customer: { select: { id: true, legalName: true, tradeName: true } },
        },
      }),
      this.prisma.intakeDocument.count({ where }),
    ]);

    return { items, total };
  }

  // ── Prévia e processamento ────────────────────────────────────────────────

  /**
   * Mostra o que o processamento faria, sem gravar nada.
   *
   * Existe porque a alternativa — processar e deixar o usuário corrigir depois — cria um
   * lançamento errado no meio do caminho, e lançamento errado já aparece em relatório.
   */
  async preview(documentId: string) {
    const document = await this.loadForProcessing(documentId);
    const plan = await this.buildPlan(document, {});

    return {
      document: {
        id: document.id,
        documentNumber: document.documentNumber,
        displayName: document.displayName,
        grossAmount: numberOf(document.grossAmount),
        dueDate: document.dueDate,
      },
      ...plan,
    };
  }

  async process(
    documentId: string,
    dto: ProcessDocumentDto,
    actor: RequestUser,
  ) {
    const document = await this.loadForProcessing(documentId);

    const existing = await this.prisma.financialEntry.findUnique({
      where: { sourceIntakeDocumentId: documentId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Este documento já gerou um lançamento financeiro. Cancele o lançamento existente antes de processar de novo.',
      );
    }

    const plan = await this.buildPlan(document, dto);
    const settings = await this.findSettings(
      document.organizationId,
      document.companyId as string,
    );

    this.assertRequirements(plan, settings);

    const status = this.initialStatusOf(plan, settings);

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.financialEntry.create({
        data: {
          organizationId: document.organizationId,
          companyId: document.companyId as string,
          sourceIntakeDocumentId: document.id,
          direction: plan.direction,
          origin: FinancialEntryOrigin.DOCUMENT_INTAKE,
          status,

          supplierId: document.supplierId,
          supplierCompanyLinkId: plan.supplierCompanyLinkId,
          customerId: document.customerId,
          customerCompanyLinkId: plan.customerCompanyLinkId,

          documentNumber: document.documentNumber,
          documentSeries: document.documentSeries,
          accessKey: document.accessKey,
          issueDate: document.issueDate,
          competenceDate: document.competenceDate ?? document.issueDate,

          description: plan.description,
          history: plan.history,
          notes: dto.notes ?? null,

          grossAmount: plan.amounts.gross,
          discountAmount: plan.amounts.discount,
          interestAmount: plan.amounts.interest,
          penaltyAmount: plan.amounts.penalty,
          withholdingAmount: plan.amounts.withholding,
          netAmount: plan.amounts.net,
          currencyCode: document.currencyCode,

          ...plan.classification.values,
          appliedClassificationRuleId:
            plan.classification.appliedClassificationRuleId,
          appliedAllocationRuleId: plan.classification.appliedAllocationRuleId,
          classificationSources: plan.classification.sources,

          financialAccountId:
            dto.financialAccountId ?? document.financialAccountId,
          paymentMethodId: dto.paymentMethodId ?? document.paymentMethodId,
          receiptMethodId: dto.receiptMethodId ?? document.receiptMethodId,

          barcode: document.barcode,
          digitableLine: document.digitableLine,
          pixKey: document.pixKey,

          requiresApproval: plan.requiresApproval,
          openedAt: status === FinancialEntryStatus.OPEN ? new Date() : null,
          createdBy: actor.id,

          installments: {
            create: plan.installments.map((installment) => ({
              installmentNumber: installment.installmentNumber,
              totalInstallments: installment.totalInstallments,
              dueDate: installment.dueDate,
              grossAmount: installment.grossAmount,
              netAmount: installment.netAmount,
              barcode: installment.barcode,
              digitableLine: installment.digitableLine,
            })),
          },

          allocations: {
            create: plan.allocations.map((allocation) => ({
              targetType: allocation.targetType,
              costCenterId: allocation.costCenterId,
              resultCenterId: allocation.resultCenterId,
              projectId: allocation.projectId,
              businessUnitId: allocation.businessUnitId,
              categoryId: allocation.categoryId,
              accountPlanId: allocation.accountPlanId,
              percentage: allocation.percentage,
              amount: allocation.amount,
              sortOrder: allocation.sortOrder,
            })),
          },

          withholdings: {
            create: plan.withholdings.map((withholding) => ({
              supplierTaxWithholdingId: withholding.supplierTaxWithholdingId,
              taxType: withholding.taxType,
              calculationBase: withholding.calculationBase,
              rate: withholding.rate,
              amount: withholding.amount,
              minimumAmount: withholding.minimumAmount,
              status: FinancialEntryWithholdingStatus.SUGGESTED,
            })),
          },

          statusHistory: {
            create: {
              newStatus: status,
              reason: 'Lançamento gerado a partir do documento encaminhado.',
              changedBy: actor.id,
            },
          },
        },
        include: {
          installments: { orderBy: { installmentNumber: 'asc' } },
          allocations: { orderBy: { sortOrder: 'asc' } },
          withholdings: true,
        },
      });

      await tx.intakeDocument.update({
        where: { id: document.id },
        data: {
          processingStatus: IntakeProcessingStatus.PROCESSED,
          processedAt: new Date(),
          updatedBy: actor.id,
        },
      });

      await tx.intakeDocumentStatusHistory.create({
        data: {
          documentId: document.id,
          previousProcessingStatus: document.processingStatus,
          newProcessingStatus: IntakeProcessingStatus.PROCESSED,
          reason: 'Documento processado: lançamento financeiro gerado.',
          changedBy: actor.id,
        },
      });

      return created;
    });

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'PROCESS_INTAKE_DOCUMENT',
      entity: 'FinancialEntry',
      entityId: entry.id,
      newValue: {
        sourceIntakeDocumentId: document.id,
        direction: entry.direction,
        status: entry.status,
        netAmount: numberOf(entry.netAmount),
        installments: entry.installments.length,
        // Explícito no log: o título nasce em aberto, nada foi pago.
        note: 'Título em aberto. Nenhum pagamento autorizado, agendado ou executado.',
      },
      reason: dto.notes ?? null,
    });

    return entry;
  }

  // ── Montagem do plano ─────────────────────────────────────────────────────

  private async loadForProcessing(documentId: string): Promise<IntakeDocument> {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    if (!document.companyId) {
      throw new BadRequestException(
        'O documento não tem empresa definida e não pode ser processado.',
      );
    }

    if (
      document.processingStatus !== IntakeProcessingStatus.READY_FOR_PROCESSING
    ) {
      throw new BadRequestException(
        'Só documentos encaminhados pela entrada podem ser processados.',
      );
    }

    if (document.grossAmount === null) {
      throw new BadRequestException('O documento não tem valor definido.');
    }

    return document;
  }

  private async buildPlan(document: IntakeDocument, dto: ProcessDocumentDto) {
    const companyId = document.companyId as string;
    const direction = this.directionOf(document);

    const supplierLink = document.supplierId
      ? await this.prisma.supplierCompanyLink.findFirst({
          where: {
            supplierId: document.supplierId,
            companyId,
            deletedAt: null,
          },
        })
      : null;

    const customerLink = document.customerId
      ? await this.prisma.customerCompanyLink.findFirst({
          where: {
            customerId: document.customerId,
            companyId,
            deletedAt: null,
          },
          select: { id: true },
        })
      : null;

    const settings = await this.findSettings(
      document.organizationId,
      companyId,
    );

    const classification = await this.classification.resolve(
      document,
      supplierLink,
      { autoClassificationEnabled: settings.autoClassificationEnabled },
    );

    if (dto.classification) {
      // O que a pessoa escolheu na tela vence tudo — inclusive a regra automática.
      for (const [dimension, value] of Object.entries(dto.classification)) {
        classification.values[dimension as never] = value as never;
        classification.sources[dimension as never] = 'MANUAL' as never;
      }
    }

    const allocationRuleId =
      dto.allocationRuleId ??
      (settings.autoAllocationEnabled
        ? classification.appliedAllocationRuleId
        : null);
    classification.appliedAllocationRuleId = allocationRuleId;

    const gross = numberOf(document.grossAmount) ?? 0;
    const discount = numberOf(document.discountAmount) ?? 0;
    const interest = numberOf(document.interestAmount) ?? 0;
    const penalty = numberOf(document.penaltyAmount) ?? 0;

    const calculated = settings.autoWithholdingEnabled
      ? await this.withholdings.calculate(supplierLink?.id ?? null, gross)
      : [];

    // A retenção nasce como sugestão e **não** desconta o líquido até ser confirmada.
    // Descontar antes seria decidir por quem tem de decidir.
    const net = round(gross - discount + interest + penalty);

    const count = dto.installmentCount ?? 1;
    const firstDueDate =
      dto.firstDueDate ??
      document.dueDate ??
      addDays(new Date(), settings.defaultPaymentTermDays);

    const planned = this.installments.plan({
      netAmount: net,
      firstDueDate: new Date(firstDueDate),
      count,
      fixedDueDay: supplierLink?.paymentTermFixedDueDay ?? null,
      intervalDays: supplierLink?.paymentTermDays ?? undefined,
      codes:
        count === 1
          ? [
              {
                barcode: document.barcode,
                digitableLine: document.digitableLine,
              },
            ]
          : undefined,
    });

    const applied = await this.allocations.materialize(allocationRuleId, net);

    const threshold =
      numberOf(settings.approvalThresholdAmount) ??
      numberOf(supplierLink?.maximumAmountWithoutApproval ?? null);

    return {
      direction,
      supplierCompanyLinkId: supplierLink?.id ?? null,
      customerCompanyLinkId: customerLink?.id ?? null,
      classification,
      description: classification.description,
      history: classification.history,
      amounts: {
        gross,
        discount,
        interest,
        penalty,
        // Sugerido, ainda não aplicado.
        withholding: 0,
        net,
      },
      suggestedWithholdingTotal: round(
        calculated.reduce((sum, item) => sum + item.amount, 0),
      ),
      withholdings: calculated,
      installments: planned,
      allocations: applied,
      requiresApproval: threshold !== null && net > threshold,
    };
  }

  /**
   * Direção do lançamento.
   *
   * `NEUTRAL` e `UNKNOWN` não viram título: um documento sem direção definida não é nem
   * obrigação nem direito, e escolher um dos dois por conta própria criaria uma dívida ou
   * um crédito que ninguém pediu.
   */
  private directionOf(document: IntakeDocument): FinancialEntryDirection {
    if (document.documentDirection === IntakeDocumentDirection.PAYABLE) {
      return FinancialEntryDirection.PAYABLE;
    }
    if (document.documentDirection === IntakeDocumentDirection.RECEIVABLE) {
      return FinancialEntryDirection.RECEIVABLE;
    }

    throw new BadRequestException(
      'Defina se o documento é a pagar ou a receber antes de processá-lo.',
    );
  }

  private assertRequirements(
    plan: Awaited<ReturnType<DocumentProcessingService['buildPlan']>>,
    settings: DocumentProcessingSettings,
  ) {
    const missing: string[] = [];

    if (settings.requireCategory && !plan.classification.values.categoryId) {
      missing.push('categoria');
    }
    if (
      settings.requireCostCenter &&
      !plan.classification.values.costCenterId
    ) {
      missing.push('centro de custo');
    }
    if (settings.requireProject && !plan.classification.values.projectId) {
      missing.push('projeto');
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Informe ${missing.join(', ')} antes de processar este documento.`,
      );
    }

    if (settings.blockInstallmentMismatch) {
      const sum = round(
        plan.installments.reduce(
          (total, installment) => total + installment.netAmount,
          0,
        ),
      );

      if (Math.abs(sum - plan.amounts.net) > 0.01) {
        throw new BadRequestException(
          `A soma das parcelas (${sum.toFixed(2)}) não fecha com o valor do lançamento (${plan.amounts.net.toFixed(2)}).`,
        );
      }
    }
  }

  /**
   * Situação inicial do lançamento.
   *
   * Abrir direto só acontece quando a empresa pediu isso **e** não há nada aguardando
   * decisão humana: acima do limite, ou com retenção sugerida esperando confirmação, o
   * título nasce como rascunho ou aguardando conferência.
   */
  private initialStatusOf(
    plan: Awaited<ReturnType<DocumentProcessingService['buildPlan']>>,
    settings: DocumentProcessingSettings,
  ): FinancialEntryStatus {
    if (plan.requiresApproval) return FinancialEntryStatus.PENDING_APPROVAL;

    if (settings.autoOpenWhenComplete && plan.withholdings.length === 0) {
      return FinancialEntryStatus.OPEN;
    }

    return FinancialEntryStatus.DRAFT;
  }
}

function numberOf(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
