import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FinancialEntryInstallmentStatus,
  FinancialEntryStatus,
  FinancialEntryWithholdingStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import { maskPixKeyValue } from '../../common/utils/mask.util';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { ApprovalRequestsService } from '../approvals/approval-requests.service';
import type {
  FinancialEntryQueryDto,
  ManualWithholdingDto,
  ReasonDto,
  UpdateFinancialEntryDto,
  UpdateInstallmentDto,
  WithholdingDecisionDto,
} from './dto/document-processing.dto';

const ENTRY_INCLUDE = {
  company: { select: { id: true, legalName: true, tradeName: true } },
  supplier: { select: { id: true, legalName: true, tradeName: true } },
  customer: { select: { id: true, legalName: true, tradeName: true } },
  installments: { orderBy: { installmentNumber: 'asc' } },
  allocations: { orderBy: { sortOrder: 'asc' } },
  withholdings: { orderBy: { taxType: 'asc' } },
  sourceIntakeDocument: {
    select: { id: true, originalFileName: true, displayName: true },
  },
} satisfies Prisma.FinancialEntryInclude;

/**
 * Situações a partir das quais o lançamento ainda pode ser editado.
 *
 * Depois de `OPEN` o título já é uma obrigação que aparece em relatório e no fluxo de
 * caixa futuro; mudar valor ou classificação em silêncio faria o relatório de ontem
 * discordar do de hoje. A saída é cancelar e processar de novo — com motivo registrado.
 */
const EDITABLE_STATUSES: FinancialEntryStatus[] = [
  FinancialEntryStatus.DRAFT,
  FinancialEntryStatus.PENDING_APPROVAL,
];

/**
 * Contas a pagar e a receber **em aberto**.
 *
 * Este serviço cuida do título depois que ele existe: consultar, corrigir enquanto é
 * rascunho, conferir, abrir e cancelar. Ele não paga, não agenda, não autoriza no banco e
 * não dá baixa — nada aqui move dinheiro.
 */
@Injectable()
export class FinancialEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalRequestsService,
  ) {}

  /** Organização e empresa do lançamento, para o controlador validar a permissão. */
  async scopeOf(id: string) {
    return this.prisma.financialEntry.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true, status: true },
    });
  }

  async findAll(query: FinancialEntryQueryDto, actor: RequestUser) {
    const where: Prisma.FinancialEntryWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      ...(query.minimumAmount !== undefined
        ? { netAmount: { gte: query.minimumAmount } }
        : {}),
      ...(query.maximumAmount !== undefined
        ? { netAmount: { lte: query.maximumAmount } }
        : {}),
      ...(query.pendingWithholdings
        ? {
            withholdings: {
              some: { status: FinancialEntryWithholdingStatus.SUGGESTED },
            },
          }
        : {}),
      // Vencimento é da parcela, não do título: filtrar por período significa "tem alguma
      // parcela vencendo nesse período".
      ...(query.dueFrom || query.dueTo
        ? {
            installments: {
              some: {
                status: FinancialEntryInstallmentStatus.OPEN,
                dueDate: {
                  ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
                  ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
                },
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                documentNumber: { contains: query.search, mode: 'insensitive' },
              },
              { description: { contains: query.search, mode: 'insensitive' } },
              {
                supplier: {
                  legalName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  legalName: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financialEntry.findMany({
        where,
        include: ENTRY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    return paginate(
      items.map((entry) => this.applyMasking(entry, actor)),
      total,
      query.page,
      query.perPage,
    );
  }

  async findOne(id: string, actor: RequestUser) {
    const entry = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        ...ENTRY_INCLUDE,
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });

    return this.applyMasking(entry, actor);
  }

  /**
   * Totais das contas a pagar e a receber em aberto.
   *
   * Conta apenas o que está `OPEN`: rascunho não é obrigação, e somá-lo daria um número
   * maior que a dívida real.
   */
  async findSummary(organizationId: string, companyId: string | undefined) {
    const where: Prisma.FinancialEntryWhereInput = {
      organizationId,
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      status: FinancialEntryStatus.OPEN,
    };

    const grouped = await this.prisma.financialEntry.groupBy({
      by: ['direction'],
      where,
      _sum: { netAmount: true },
      _count: { _all: true },
    });

    const pending = await this.prisma.financialEntry.count({
      where: {
        organizationId,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
        status: {
          in: [
            FinancialEntryStatus.DRAFT,
            FinancialEntryStatus.PENDING_APPROVAL,
          ],
        },
      },
    });

    const withholdingsToConfirm =
      await this.prisma.financialEntryWithholding.count({
        where: {
          status: FinancialEntryWithholdingStatus.SUGGESTED,
          entry: {
            organizationId,
            ...(companyId ? { companyId } : {}),
            deletedAt: null,
          },
        },
      });

    const find = (direction: 'PAYABLE' | 'RECEIVABLE') =>
      grouped.find((row) => row.direction === direction);

    return {
      payable: {
        count: find('PAYABLE')?._count._all ?? 0,
        total: Number(find('PAYABLE')?._sum.netAmount ?? 0),
      },
      receivable: {
        count: find('RECEIVABLE')?._count._all ?? 0,
        total: Number(find('RECEIVABLE')?._sum.netAmount ?? 0),
      },
      pendingEntries: pending,
      withholdingsToConfirm,
      note: 'Valores em aberto. Nenhum pagamento foi autorizado, agendado ou executado — liquidação e conciliação são de módulos que ainda não existem.',
    };
  }

  // ── Edição e ciclo de vida ────────────────────────────────────────────────

  async update(id: string, dto: UpdateFinancialEntryDto, actor: RequestUser) {
    const current = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    this.assertEditable(current.status);

    const discount = dto.discountAmount ?? Number(current.discountAmount);
    const interest = dto.interestAmount ?? Number(current.interestAmount);
    const penalty = dto.penaltyAmount ?? Number(current.penaltyAmount);
    const withholding = Number(current.withholdingAmount);

    const net = round(
      Number(current.grossAmount) - discount + interest + penalty - withholding,
    );

    const updated = await this.prisma.financialEntry.update({
      where: { id },
      data: {
        ...dto,
        competenceDate: dto.competenceDate
          ? new Date(dto.competenceDate)
          : undefined,
        discountAmount: discount,
        interestAmount: interest,
        penaltyAmount: penalty,
        netAmount: net,
        updatedBy: actor.id,
      },
      include: ENTRY_INCLUDE,
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE_FINANCIAL_ENTRY',
      entity: 'FinancialEntry',
      entityId: id,
      oldValue: snapshot(current),
      newValue: snapshot(updated),
    });

    return this.applyMasking(updated, actor);
  }

  /**
   * Confere o lançamento que exigia aprovação.
   *
   * Isto aprova o **lançamento**, não o pagamento: significa "os dados estão certos, pode
   * virar obrigação". Autorizar a saída do dinheiro é outra coisa, em outro módulo.
   */
  async approve(id: string, actor: RequestUser) {
    const current = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (current.status !== FinancialEntryStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Só um lançamento aguardando conferência pode ser conferido.',
      );
    }

    return this.changeStatus(
      current.id,
      current.status,
      FinancialEntryStatus.DRAFT,
      'Lançamento conferido.',
      actor,
      { approvedBy: actor.id, approvedAt: new Date() },
    );
  }

  /**
   * Abre o título: daqui em diante ele é a obrigação.
   *
   * Recusa enquanto houver retenção sugerida sem decisão — abrir com um valor líquido que
   * ainda pode mudar publicaria um número que não é o final.
   */
  async open(id: string, actor: RequestUser) {
    const current = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { withholdings: true, installments: true },
    });

    if (current.status === FinancialEntryStatus.OPEN) {
      throw new BadRequestException('Este lançamento já está em aberto.');
    }

    if (current.status === FinancialEntryStatus.CANCELLED) {
      throw new BadRequestException(
        'Um lançamento cancelado não pode ser aberto. Processe o documento novamente.',
      );
    }

    if (current.status === FinancialEntryStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Este lançamento aguarda conferência antes de ser aberto.',
      );
    }

    const undecided = current.withholdings.filter(
      (withholding) =>
        withholding.status === FinancialEntryWithholdingStatus.SUGGESTED,
    );

    if (undecided.length > 0) {
      throw new BadRequestException(
        `Decida as retenções sugeridas (${undecided.map((item) => item.taxType).join(', ')}) antes de abrir o lançamento.`,
      );
    }

    // Critério de aceite 9 do módulo de Autorizações: nada chega a Contas a Pagar sem
    // concluir as etapas obrigatórias. O gate mora aqui porque abrir o título é o exato
    // momento em que ele vira obrigação.
    if (await this.approvals.hasPendingApproval(id)) {
      throw new BadRequestException(
        'Este lançamento está em autorização. Conclua o fluxo de aprovação antes de abrir o título.',
      );
    }

    const openInstallments = current.installments.filter(
      (installment) =>
        installment.status === FinancialEntryInstallmentStatus.OPEN,
    );

    if (openInstallments.length === 0) {
      throw new BadRequestException(
        'O lançamento não tem nenhuma parcela em aberto.',
      );
    }

    return this.changeStatus(
      current.id,
      current.status,
      FinancialEntryStatus.OPEN,
      'Lançamento aberto.',
      actor,
      { openedAt: new Date() },
    );
  }

  /**
   * Cancela o lançamento e devolve o documento à fila.
   *
   * O documento volta para `READY_FOR_PROCESSING` e o vínculo com o lançamento cancelado é
   * desfeito — sem isso a restrição de um-para-um impediria para sempre reprocessar um
   * documento que foi cancelado por engano.
   */
  async cancel(id: string, dto: ReasonDto, actor: RequestUser) {
    const current = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (current.status === FinancialEntryStatus.CANCELLED) {
      throw new BadRequestException('Este lançamento já está cancelado.');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.financialEntry.update({
        where: { id },
        data: {
          status: FinancialEntryStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledBy: actor.id,
          cancelledAt: new Date(),
          sourceIntakeDocumentId: null,
          updatedBy: actor.id,
        },
        include: ENTRY_INCLUDE,
      });

      await tx.financialEntryInstallment.updateMany({
        where: { entryId: id },
        data: { status: FinancialEntryInstallmentStatus.CANCELLED },
      });

      await tx.financialEntryStatusHistory.create({
        data: {
          entryId: id,
          previousStatus: current.status,
          newStatus: FinancialEntryStatus.CANCELLED,
          reason: dto.reason,
          changedBy: actor.id,
        },
      });

      if (current.sourceIntakeDocumentId) {
        await tx.intakeDocument.update({
          where: { id: current.sourceIntakeDocumentId },
          data: {
            processingStatus: 'READY_FOR_PROCESSING',
            processedAt: null,
            updatedBy: actor.id,
          },
        });

        await tx.intakeDocumentStatusHistory.create({
          data: {
            documentId: current.sourceIntakeDocumentId,
            previousProcessingStatus: 'PROCESSED',
            newProcessingStatus: 'READY_FOR_PROCESSING',
            reason: `Lançamento cancelado: ${dto.reason}`,
            changedBy: actor.id,
          },
        });
      }

      return entry;
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'CANCEL_FINANCIAL_ENTRY',
      entity: 'FinancialEntry',
      entityId: id,
      oldValue: snapshot(current),
      newValue: { status: FinancialEntryStatus.CANCELLED },
      reason: dto.reason,
    });

    return this.applyMasking(cancelled, actor);
  }

  // ── Parcelas ──────────────────────────────────────────────────────────────

  async updateInstallment(
    entryId: string,
    installmentId: string,
    dto: UpdateInstallmentDto,
    actor: RequestUser,
  ) {
    const entry = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id: entryId, deletedAt: null },
      include: { installments: true },
    });

    this.assertEditable(entry.status);

    const installment = entry.installments.find(
      (item) => item.id === installmentId,
    );

    if (!installment) {
      throw new BadRequestException('Parcela não encontrada neste lançamento.');
    }

    const updated = await this.prisma.financialEntryInstallment.update({
      where: { id: installmentId },
      data: {
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.netAmount !== undefined
          ? { netAmount: dto.netAmount, grossAmount: dto.netAmount }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor.id,
      action: 'UPDATE_FINANCIAL_ENTRY_INSTALLMENT',
      entity: 'FinancialEntryInstallment',
      entityId: installmentId,
      newValue: {
        dueDate: updated.dueDate.toISOString(),
        netAmount: Number(updated.netAmount),
      },
    });

    return updated;
  }

  // ── Retenções ─────────────────────────────────────────────────────────────

  /**
   * Confirma a retenção e **aí sim** desconta o valor líquido.
   *
   * Enquanto estava sugerida, a retenção era um cálculo aguardando decisão; o líquido
   * refletia o documento. Confirmar é o ato que muda o quanto será pago.
   */
  async confirmWithholding(
    entryId: string,
    withholdingId: string,
    dto: WithholdingDecisionDto,
    actor: RequestUser,
  ) {
    const { entry, withholding } = await this.loadWithholding(
      entryId,
      withholdingId,
    );

    if (withholding.status !== FinancialEntryWithholdingStatus.SUGGESTED) {
      throw new BadRequestException('Esta retenção já foi decidida.');
    }

    const amount = Number(withholding.amount);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.financialEntryWithholding.update({
        where: { id: withholdingId },
        data: {
          status: FinancialEntryWithholdingStatus.CONFIRMED,
          decisionReason: dto.reason ?? null,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      });

      return tx.financialEntry.update({
        where: { id: entryId },
        data: {
          withholdingAmount: { increment: amount },
          netAmount: { decrement: amount },
          updatedBy: actor.id,
        },
        include: ENTRY_INCLUDE,
      });
    });

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor.id,
      action: 'CONFIRM_FINANCIAL_ENTRY_WITHHOLDING',
      entity: 'FinancialEntryWithholding',
      entityId: withholdingId,
      newValue: { taxType: withholding.taxType, amount },
      reason: dto.reason ?? null,
    });

    return this.applyMasking(updated, actor);
  }

  async dismissWithholding(
    entryId: string,
    withholdingId: string,
    dto: ReasonDto,
    actor: RequestUser,
  ) {
    const { entry, withholding } = await this.loadWithholding(
      entryId,
      withholdingId,
    );

    if (withholding.status === FinancialEntryWithholdingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Uma retenção confirmada já alterou o valor líquido e não pode ser descartada. Cancele o lançamento e processe de novo.',
      );
    }

    await this.prisma.financialEntryWithholding.update({
      where: { id: withholdingId },
      data: {
        status: FinancialEntryWithholdingStatus.DISMISSED,
        decisionReason: dto.reason,
        decidedBy: actor.id,
        decidedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor.id,
      action: 'DISMISS_FINANCIAL_ENTRY_WITHHOLDING',
      entity: 'FinancialEntryWithholding',
      entityId: withholdingId,
      newValue: { taxType: withholding.taxType },
      reason: dto.reason,
    });

    return this.findOne(entryId, actor);
  }

  /** Retenção que o cadastro não previa, informada à mão. Nasce sugerida como as demais. */
  async addWithholding(
    entryId: string,
    dto: ManualWithholdingDto,
    actor: RequestUser,
  ) {
    const entry = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id: entryId, deletedAt: null },
    });

    this.assertEditable(entry.status);

    const amount = round(dto.calculationBase * (dto.rate / 100));

    if (amount <= 0) {
      throw new BadRequestException(
        'A retenção calculada ficou em zero. Confira a base e a alíquota.',
      );
    }

    const created = await this.prisma.financialEntryWithholding.create({
      data: {
        entryId,
        taxType: dto.taxType,
        calculationBase: dto.calculationBase,
        rate: dto.rate,
        amount,
        status: FinancialEntryWithholdingStatus.SUGGESTED,
      },
    });

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor.id,
      action: 'ADD_FINANCIAL_ENTRY_WITHHOLDING',
      entity: 'FinancialEntryWithholding',
      entityId: created.id,
      newValue: { taxType: dto.taxType, rate: dto.rate, amount },
    });

    return created;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private async loadWithholding(entryId: string, withholdingId: string) {
    const entry = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id: entryId, deletedAt: null },
      include: { withholdings: true },
    });

    const withholding = entry.withholdings.find(
      (item) => item.id === withholdingId,
    );

    if (!withholding) {
      throw new BadRequestException(
        'Retenção não encontrada neste lançamento.',
      );
    }

    return { entry, withholding };
  }

  private assertEditable(status: FinancialEntryStatus) {
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new BadRequestException(
        status === FinancialEntryStatus.OPEN
          ? 'Um lançamento em aberto não pode ser editado. Cancele-o e processe o documento novamente.'
          : 'Um lançamento cancelado não pode ser editado.',
      );
    }
  }

  private async changeStatus(
    id: string,
    previous: FinancialEntryStatus,
    next: FinancialEntryStatus,
    reason: string,
    actor: RequestUser,
    extra: Prisma.FinancialEntryUpdateInput = {},
  ) {
    const [entry] = await this.prisma.$transaction([
      this.prisma.financialEntry.update({
        where: { id },
        data: { status: next, updatedBy: actor.id, ...extra },
        include: ENTRY_INCLUDE,
      }),
      this.prisma.financialEntryStatusHistory.create({
        data: {
          entryId: id,
          previousStatus: previous,
          newStatus: next,
          reason,
          changedBy: actor.id,
        },
      }),
    ]);

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor.id,
      action: `FINANCIAL_ENTRY_${next}`,
      entity: 'FinancialEntry',
      entityId: id,
      oldValue: { status: previous },
      newValue: { status: next },
      reason,
    });

    return this.applyMasking(entry, actor);
  }

  /**
   * Mascara os dados de cobrança para quem não tem permissão de vê-los.
   *
   * Mesmo critério da entrada de documentos: o valor completo é substituído **antes** de
   * virar resposta, e a permissão reaproveitada é a mesma — quem podia ver a linha
   * digitável no documento continua podendo vê-la no lançamento gerado por ele.
   */
  private applyMasking<
    T extends {
      companyId: string;
      digitableLine?: string | null;
      barcode?: string | null;
      pixKey?: string | null;
    },
  >(entry: T, actor: RequestUser): T {
    if (this.canViewSensitiveData(entry.companyId, actor)) return entry;

    return {
      ...entry,
      barcode: maskCode(entry.barcode),
      digitableLine: maskCode(entry.digitableLine),
      pixKey: maskPixKeyValue(entry.pixKey),
    };
  }

  private canViewSensitiveData(companyId: string, actor: RequestUser): boolean {
    if (actor.isPlatformAdmin) return true;

    return (
      actor.memberships
        .find((membership) => membership.companyId === companyId)
        ?.permissions.includes('document_intake.view_sensitive_data') ?? false
    );
  }
}

/** Mantém os seis últimos dígitos: reconhecer o título sem expor o código que paga. */
function maskCode(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 6) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 6)}${digits.slice(-6)}`;
}

function snapshot(entry: {
  status: FinancialEntryStatus;
  netAmount: Prisma.Decimal;
  categoryId: string | null;
  costCenterId: string | null;
}) {
  return {
    status: entry.status,
    netAmount: Number(entry.netAmount),
    categoryId: entry.categoryId,
    costCenterId: entry.costCenterId,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
