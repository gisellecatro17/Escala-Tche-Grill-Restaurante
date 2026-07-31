import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AccountsPayableBlockReason,
  AccountsPayableHistoryAction,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  FinancialEntryDirection,
  FinancialEntryWithholdingStatus,
  IntakeIssueStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { PayableBalanceService } from './payable-balance.service';
import { cents, fromCents } from './money.util';

/**
 * Converte o lançamento aprovado em título a pagar (critério de aceite 1).
 *
 * O lançamento e o título são coisas diferentes de propósito. O lançamento é o
 * pré-lançamento: editável, cancelável, ainda uma proposta do que a empresa deve. O título
 * é a obrigação — a partir dele o dinheiro sai. Por isso valores, classificação, rateio e
 * retenções são **copiados** e não referenciados: um título é um fato histórico, e corrigir
 * um cadastro hoje não pode reescrever o que a empresa devia ontem.
 *
 * A conversão é idempotente. `entryId` é único no banco, então duas chamadas simultâneas
 * não geram dois títulos — a segunda encontra o primeiro e o devolve.
 */
@Injectable()
export class PayableGenerationService {
  private readonly logger = new Logger(PayableGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly balance: PayableBalanceService,
  ) {}

  /** Título já gerado para este lançamento, se houver. */
  async findByEntry(entryId: string) {
    return this.prisma.accountsPayable.findFirst({
      where: { entryId, deletedAt: null },
      select: { id: true, code: true, status: true },
    });
  }

  /**
   * Gera o título do lançamento.
   *
   * Silencioso por escolha quando não há o que fazer: chamada a partir da aprovação, ela
   * não pode derrubar a aprovação porque o lançamento é a receber ou já virou título.
   */
  async generateFromEntry(
    entryId: string,
    actor: RequestUser | null,
    options: { force?: boolean } = {},
  ) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id: entryId, deletedAt: null },
      include: {
        installments: { orderBy: { installmentNumber: 'asc' } },
        allocations: { orderBy: { sortOrder: 'asc' } },
        withholdings: { orderBy: { taxType: 'asc' } },
      },
    });

    if (!entry) return null;

    if (entry.direction !== FinancialEntryDirection.PAYABLE) return null;

    const existing = await this.findByEntry(entryId);
    if (existing) return existing;

    const settings = await this.settingsFor(
      entry.organizationId,
      entry.companyId,
    );

    if (!settings.autoGenerateOnApproval && !options.force) {
      this.logger.debug(
        `Geração automática desligada para a empresa ${entry.companyId}; lançamento ${entryId} não virou título.`,
      );
      return null;
    }

    if (entry.installments.length === 0) {
      throw new BadRequestException(
        'O lançamento não tem parcelas. Processe o documento antes de gerar o título.',
      );
    }

    const approval = await this.prisma.approvalRequest.findFirst({
      where: { entryId, status: 'APPROVED' },
      orderBy: { attempt: 'desc' },
      select: { id: true, priority: true },
    });

    const documentType = entry.sourceIntakeDocumentId
      ? await this.prisma.intakeDocument.findUnique({
          where: { id: entry.sourceIntakeDocumentId },
          select: { documentType: true },
        })
      : null;

    const contract = entry.supplierCompanyLinkId
      ? await this.prisma.supplierContract.findFirst({
          where: {
            supplierCompanyLinkId: entry.supplierCompanyLinkId,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      : null;

    // Pendência documental aberta bloqueia o título assim que ele nasce. Deixar entrar
    // desbloqueado e "avisar depois" é como um título com nota faltando chega ao banco.
    const openIssues = entry.sourceIntakeDocumentId
      ? await this.prisma.intakeDocumentIssue.count({
          where: {
            documentId: entry.sourceIntakeDocumentId,
            status: IntakeIssueStatus.OPEN,
          },
        })
      : 0;

    const shouldBlock = settings.autoBlockWhenDocumentPending && openIssues > 0;

    const code = await this.nextCode(entry.companyId, settings.codePrefix);

    const created = await this.prisma.$transaction(async (tx) => {
      const payable = await tx.accountsPayable.create({
        data: {
          organizationId: entry.organizationId,
          companyId: entry.companyId,
          code,
          entryId: entry.id,
          sourceIntakeDocumentId: entry.sourceIntakeDocumentId,
          approvalRequestId: approval?.id ?? null,
          supplierContractId: contract?.id ?? null,
          supplierId: entry.supplierId,
          supplierCompanyLinkId: entry.supplierCompanyLinkId,
          documentType: documentType?.documentType ?? null,
          documentNumber: entry.documentNumber,
          documentSeries: entry.documentSeries,
          accessKey: entry.accessKey,
          issueDate: entry.issueDate,
          competenceDate: entry.competenceDate,
          dueDate: entry.installments[0].dueDate,
          description: entry.description,
          notes: entry.notes,
          status: AccountsPayableStatus.OPEN,
          priority: settings.defaultPriority,
          originalAmount: entry.grossAmount,
          netAmount: entry.netAmount,
          balanceAmount: entry.netAmount,
          currencyCode: entry.currencyCode,
          categoryId: entry.categoryId,
          subcategoryId: entry.subcategoryId,
          accountPlanId: entry.accountPlanId,
          financialNatureId: entry.financialNatureId,
          costCenterId: entry.costCenterId,
          resultCenterId: entry.resultCenterId,
          projectId: entry.projectId,
          businessUnitId: entry.businessUnitId,
          financialAccountId: entry.financialAccountId,
          paymentMethodId: entry.paymentMethodId,
          barcode: entry.barcode,
          digitableLine: entry.digitableLine,
          pixKey: entry.pixKey,
          responsibleUserId: entry.createdBy,
          blockedAt: shouldBlock ? new Date() : null,
          createdBy: actor?.id ?? entry.createdBy,
          installments: {
            create: entry.installments.map((installment) => ({
              installmentNumber: installment.installmentNumber,
              totalInstallments: installment.totalInstallments,
              dueDate: installment.dueDate,
              originalDueDate: installment.dueDate,
              originalAmount: installment.grossAmount,
              discountAmount: installment.discountAmount,
              netAmount: installment.netAmount,
              balanceAmount: installment.netAmount,
              status: AccountsPayableInstallmentStatus.OPEN,
              barcode: installment.barcode,
              digitableLine: installment.digitableLine,
              financialAccountId: entry.financialAccountId,
              paymentMethodId: entry.paymentMethodId,
            })),
          },
          allocations: {
            create: entry.allocations.map((allocation) => ({
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
              notes: allocation.notes,
            })),
          },
          // Só as retenções confirmadas viajam. Uma retenção sugerida não desconta valor
          // nenhum no lançamento; deixá-la mudar o líquido do título seria descontar um
          // imposto que ninguém confirmou.
          withholdings: {
            create: entry.withholdings
              .filter(
                (withholding) =>
                  withholding.status ===
                  FinancialEntryWithholdingStatus.CONFIRMED,
              )
              .map((withholding) => ({
                entryWithholdingId: withholding.id,
                taxType: withholding.taxType,
                calculationBase: withholding.calculationBase,
                rate: withholding.rate,
                amount: withholding.amount,
                minimumAmount: withholding.minimumAmount,
                status: FinancialEntryWithholdingStatus.CONFIRMED,
                decisionReason: withholding.decisionReason,
                decidedBy: withholding.decidedBy,
                decidedAt: withholding.decidedAt,
              })),
          },
        },
      });

      if (shouldBlock) {
        await tx.accountsPayableBlock.create({
          data: {
            payableId: payable.id,
            reason: AccountsPayableBlockReason.DOCUMENT_PENDING,
            description: `Documento de origem com ${openIssues} pendência(s) em aberto.`,
            blockedBy: actor?.id ?? null,
          },
        });
      }

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payable.id,
          action: AccountsPayableHistoryAction.CREATED,
          newStatus: AccountsPayableStatus.OPEN,
          justification: approval
            ? 'Título gerado automaticamente após a aprovação do lançamento.'
            : 'Título gerado a partir do lançamento.',
          actorId: actor?.id ?? null,
        },
      });

      return this.balance.recompute(tx, payable.id);
    });

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor?.id ?? null,
      action: 'accounts_payable.created',
      entity: 'AccountsPayable',
      entityId: created.id,
      newValue: {
        code: created.code,
        entryId: entry.id,
        netAmount: Number(created.netAmount),
        installments: entry.installments.length,
        blocked: shouldBlock,
      },
      reason: approval ? 'Aprovação concluída.' : 'Abertura do lançamento.',
    });

    return created;
  }

  /**
   * Próximo código do título, sequencial por empresa e por ano.
   *
   * Lê o maior código já usado em vez de contar registros: contar quebraria assim que um
   * título fosse excluído logicamente, e dois títulos com o mesmo código é exatamente o
   * tipo de colisão que só aparece meses depois, num relatório.
   */
  private async nextCode(companyId: string, prefix: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const start = `${prefix}-${year}-`;

    const last = await this.prisma.accountsPayable.findFirst({
      where: { companyId, code: { startsWith: start } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const sequence = last ? Number(last.code.slice(start.length)) + 1 : 1;

    return `${start}${String(sequence).padStart(6, '0')}`;
  }

  /** Parâmetros da empresa, criados com os padrões na primeira leitura. */
  async settingsFor(organizationId: string, companyId: string) {
    const existing = await this.prisma.accountsPayableSettings.findUnique({
      where: { companyId },
    });

    if (existing) return existing;

    return this.prisma.accountsPayableSettings.create({
      data: { organizationId, companyId },
    });
  }

  /**
   * Confere se o título espelha o lançamento que o gerou.
   *
   * Usado nos testes e no diagnóstico: se a soma das parcelas do título não bate com o
   * líquido do lançamento, alguma cópia falhou e é melhor saber disso agora.
   */
  async reconcileWithEntry(payableId: string) {
    const payable = await this.prisma.accountsPayable.findUniqueOrThrow({
      where: { id: payableId },
      include: { installments: true, entry: true },
    });

    const installmentTotal = payable.installments.reduce(
      (total, installment) => total + cents(installment.netAmount),
      0,
    );

    return {
      payableNet: Number(payable.netAmount),
      installmentTotal: fromCents(installmentTotal),
      entryNet: payable.entry ? Number(payable.entry.netAmount) : null,
      matches: installmentTotal === cents(payable.netAmount),
    };
  }
}

export type PayableGenerationResult =
  Prisma.AccountsPayableGetPayload<object> | null;
