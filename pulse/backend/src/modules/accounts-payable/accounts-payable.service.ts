import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountsPayableHistoryAction,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  FinancialEntryWithholdingStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import { maskPixKeyValue } from '../../common/utils/mask.util';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { PayableBalanceService } from './payable-balance.service';
import { PayableGenerationService } from './payable-generation.service';
import { cents, fromCents, sum } from './money.util';
import {
  type AccountsPayableQueryDto,
  type BlockDto,
  type CreateAccountsPayableDto,
  type PayableCommentDto,
  type PayableSituation,
  type PayableWithholdingDto,
  type ReasonDto,
  type ReinstallDto,
  type SchedulePaymentDto,
  type UnblockDto,
  type UpdateAccountsPayableDto,
  type UpdateAccountsPayableSettingsDto,
  type UpdatePayableInstallmentDto,
  type WithholdingDecisionDto,
} from './dto/accounts-payable.dto';

const PAYABLE_INCLUDE = {
  company: { select: { id: true, legalName: true, tradeName: true } },
  supplier: { select: { id: true, legalName: true, tradeName: true } },
  installments: { orderBy: { installmentNumber: 'asc' } },
  allocations: { orderBy: { sortOrder: 'asc' } },
  withholdings: { orderBy: { taxType: 'asc' } },
  tags: true,
  blocks: { orderBy: { blockedAt: 'desc' } },
  entry: { select: { id: true, status: true, sourceIntakeDocumentId: true } },
  sourceIntakeDocument: {
    select: { id: true, originalFileName: true, displayName: true },
  },
  supplierContract: { select: { id: true, contractNumber: true } },
} satisfies Prisma.AccountsPayableInclude;

/**
 * Situações a partir das quais o título ainda aceita edição de cadastro.
 *
 * Depois de pago, cancelado ou renegociado o título é história: mudar fornecedor ou centro
 * de custo faria o relatório de ontem discordar do de hoje sem que ninguém percebesse.
 */
const EDITABLE_STATUSES: AccountsPayableStatus[] = [
  AccountsPayableStatus.OPEN,
  AccountsPayableStatus.SCHEDULED,
  AccountsPayableStatus.PARTIALLY_PAID,
];

/** Campos cuja alteração a auditoria costuma questionar (seção 18). */
const TRACKED_FIELDS: Record<string, AccountsPayableHistoryAction> = {
  supplierId: AccountsPayableHistoryAction.SUPPLIER_CHANGED,
  costCenterId: AccountsPayableHistoryAction.COST_CENTER_CHANGED,
  projectId: AccountsPayableHistoryAction.PROJECT_CHANGED,
};

/**
 * Contas a Pagar: consulta, cadastro, ciclo de vida e bloqueio dos títulos.
 *
 * O que este serviço **não** faz: enviar remessa, agendar no banco, executar PIX ou
 * conciliar extrato. Registrar que um pagamento aconteceu é `PayableSettlementService`;
 * mandar o dinheiro sair é de módulos que ainda não existem.
 */
@Injectable()
export class AccountsPayableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly balance: PayableBalanceService,
    private readonly generation: PayableGenerationService,
  ) {}

  /** Organização e empresa do título, para o controlador validar a permissão. */
  async scopeOf(id: string) {
    return this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        status: true,
        blockedAt: true,
      },
    });
  }

  /** Escopo a partir de um filho (parcela, pagamento, ajuste, comentário). */
  async scopeOfInstallment(installmentId: string) {
    const installment =
      await this.prisma.accountsPayableInstallment.findFirstOrThrow({
        where: { id: installmentId },
        select: {
          payable: {
            select: { id: true, organizationId: true, companyId: true },
          },
        },
      });

    return installment.payable;
  }

  /**
   * Escopo a partir do lançamento de origem.
   *
   * Ler a empresa do lançamento, e não aceitar a que o cliente mandou, é o que impede
   * alguém de gerar em uma empresa o título de um lançamento de outra.
   */
  async scopeOfEntry(entryId: string) {
    return this.prisma.financialEntry.findFirstOrThrow({
      where: { id: entryId, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true, status: true },
    });
  }

  async scopeOfPayment(paymentId: string) {
    const payment =
      await this.prisma.accountsPayablePartialPayment.findFirstOrThrow({
        where: { id: paymentId },
        select: {
          payable: {
            select: { id: true, organizationId: true, companyId: true },
          },
        },
      });

    return payment.payable;
  }

  async scopeOfAdjustment(adjustmentId: string) {
    const adjustment =
      await this.prisma.accountsPayableAdjustment.findFirstOrThrow({
        where: { id: adjustmentId },
        select: {
          payable: {
            select: { id: true, organizationId: true, companyId: true },
          },
        },
      });

    return adjustment.payable;
  }

  async scopeOfWithholding(withholdingId: string) {
    const withholding =
      await this.prisma.accountsPayableWithholding.findFirstOrThrow({
        where: { id: withholdingId },
        select: {
          payable: {
            select: { id: true, organizationId: true, companyId: true },
          },
        },
      });

    return withholding.payable;
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  async findAll(query: AccountsPayableQueryDto, actor: RequestActor) {
    const today = startOfDay(new Date());

    const where: Prisma.AccountsPayableWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.contractId ? { supplierContractId: query.contractId } : {}),
      ...(query.responsibleUserId
        ? { responsibleUserId: query.responsibleUserId }
        : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.paymentMethodId
        ? { paymentMethodId: query.paymentMethodId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.documentNumber
        ? {
            documentNumber: {
              contains: query.documentNumber,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.tag ? { tags: { some: { label: query.tag } } } : {}),
      ...dateRange('competenceDate', query.competenceFrom, query.competenceTo),
      ...dateRange('issueDate', query.issueFrom, query.issueTo),
      ...dateRange('dueDate', query.dueFrom, query.dueTo),
      ...dateRange('paidAt', query.paidFrom, query.paidTo),
      ...(query.minAmount !== undefined || query.maxAmount !== undefined
        ? {
            netAmount: {
              ...(query.minAmount !== undefined
                ? { gte: query.minAmount }
                : {}),
              ...(query.maxAmount !== undefined
                ? { lte: query.maxAmount }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              {
                documentNumber: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    // `blocked` e `overdue` filtram pelos fatos, não por uma coluna de situação: bloqueio
    // ativo e data no passado. É o que mantém o filtro sempre correto sem um job.
    if (query.blocked !== undefined) {
      Object.assign(
        where,
        query.blocked ? { NOT: { blockedAt: null } } : { blockedAt: null },
      );
    }

    if (query.overdue || query.situation === 'OVERDUE') {
      Object.assign(where, {
        dueDate: { ...(where.dueDate as object), lt: today },
        balanceAmount: { gt: 0 },
        status: {
          notIn: [
            AccountsPayableStatus.PAID,
            AccountsPayableStatus.CANCELLED,
            AccountsPayableStatus.RENEGOTIATED,
          ],
        },
      });
    } else if (query.situation === 'BLOCKED') {
      Object.assign(where, { NOT: { blockedAt: null } });
    } else if (query.situation) {
      Object.assign(where, {
        status: query.situation,
      });
    }

    const orderBy: Prisma.AccountsPayableOrderByWithRelationInput =
      query.orderBy
        ? { [query.orderBy]: query.order ?? 'asc' }
        : { dueDate: 'asc' };

    const [items, total] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where,
        include: {
          company: { select: { id: true, legalName: true, tradeName: true } },
          supplier: { select: { id: true, legalName: true, tradeName: true } },
          tags: true,
        },
        orderBy,
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.accountsPayable.count({ where }),
    ]);

    const canSeeSensitive = this.canSeeSensitive(actor);

    return paginate(
      items.map((item) => ({
        ...this.mask(item, canSeeSensitive),
        situation: situationOf(item, today),
        isOverdue: isOverdue(item, today),
      })),
      total,
      query.page,
      query.perPage,
    );
  }

  async findOne(id: string, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: PAYABLE_INCLUDE,
    });

    const [payments, adjustments, advances, renegotiations] = await Promise.all(
      [
        this.prisma.accountsPayablePartialPayment.findMany({
          where: { payableId: id },
          orderBy: { paidAt: 'desc' },
        }),
        this.prisma.accountsPayableAdjustment.findMany({
          where: { payableId: id },
          orderBy: { appliedAt: 'desc' },
        }),
        this.prisma.accountsPayableAdvanceApplication.findMany({
          where: { payableId: id },
          include: {
            advance: {
              select: { id: true, reference: true, amount: true, type: true },
            },
          },
          orderBy: { appliedAt: 'desc' },
        }),
        this.prisma.accountsPayableRenegotiation.findMany({
          where: { payableId: id },
          orderBy: { createdAt: 'desc' },
        }),
      ],
    );

    const today = startOfDay(new Date());
    const canSeeSensitive = this.canSeeSensitive(actor);

    return {
      ...this.mask(payable, canSeeSensitive),
      situation: situationOf(payable, today),
      isOverdue: isOverdue(payable, today),
      overdueDays: isOverdue(payable, today)
        ? daysBetween(payable.dueDate, today)
        : 0,
      activeBlock:
        payable.blocks.find((block) => block.releasedAt === null) ?? null,
      payments,
      adjustments,
      advances,
      renegotiations,
    };
  }

  async history(id: string) {
    return this.prisma.accountsPayableHistory.findMany({
      where: { payableId: id },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  // ── Cadastro manual ───────────────────────────────────────────────────────

  /**
   * Cria um título direto, sem passar pelo documento.
   *
   * Existe porque nem toda obrigação chega como documento — aluguel, taxa, acordo. O
   * caminho normal continua sendo documento → lançamento → autorização → título, e este
   * atalho exige a permissão própria de criação.
   */
  async create(dto: CreateAccountsPayableDto, actor: RequestActor) {
    const settings = await this.generation.settingsFor(
      dto.organizationId,
      dto.companyId,
    );

    const total = sum(
      dto.installments.map((installment) => installment.amount),
    );

    if (cents(total) <= 0) {
      throw new BadRequestException(
        'O total das parcelas precisa ser maior que zero.',
      );
    }

    const numbers = new Set(
      dto.installments.map((item) => item.installmentNumber),
    );
    if (numbers.size !== dto.installments.length) {
      throw new BadRequestException('Há parcelas com o mesmo número.');
    }

    const ordered = [...dto.installments].sort(
      (left, right) => left.installmentNumber - right.installmentNumber,
    );

    const code = await this.nextCode(dto.companyId, settings.codePrefix);

    const created = await this.prisma.$transaction(async (tx) => {
      const payable = await tx.accountsPayable.create({
        data: {
          organizationId: dto.organizationId,
          companyId: dto.companyId,
          code,
          // Título manual não nasce de lançamento: `entryId` fica nulo. Fabricar um
          // pré-lançamento só para preencher a coluna colocaria na fila "A Processar" um
          // lançamento que ninguém processou nem aprovou.
          supplierId: dto.supplierId,
          supplierContractId: dto.supplierContractId,
          purchaseOrderNumber: dto.purchaseOrderNumber,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          documentSeries: dto.documentSeries,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
          competenceDate: dto.competenceDate
            ? new Date(dto.competenceDate)
            : null,
          dueDate: new Date(ordered[0].dueDate),
          description: dto.description,
          notes: dto.notes,
          status: AccountsPayableStatus.OPEN,
          priority: dto.priority ?? settings.defaultPriority,
          originalAmount: total,
          netAmount: total,
          balanceAmount: total,
          categoryId: dto.categoryId,
          subcategoryId: dto.subcategoryId,
          accountPlanId: dto.accountPlanId,
          financialNatureId: dto.financialNatureId,
          costCenterId: dto.costCenterId,
          resultCenterId: dto.resultCenterId,
          projectId: dto.projectId,
          businessUnitId: dto.businessUnitId,
          financialAccountId: dto.financialAccountId,
          paymentMethodId: dto.paymentMethodId,
          responsibleUserId: dto.responsibleUserId ?? actor.id,
          createdBy: actor.id,
          installments: {
            create: ordered.map((installment) => ({
              installmentNumber: installment.installmentNumber,
              totalInstallments: ordered.length,
              dueDate: new Date(installment.dueDate),
              originalDueDate: new Date(installment.dueDate),
              originalAmount: installment.amount,
              netAmount: installment.amount,
              balanceAmount: installment.amount,
              status: AccountsPayableInstallmentStatus.OPEN,
              barcode: installment.barcode,
              digitableLine: installment.digitableLine,
              notes: installment.notes,
              financialAccountId: dto.financialAccountId,
              paymentMethodId: dto.paymentMethodId,
            })),
          },
          ...(dto.tags?.length
            ? {
                tags: {
                  create: dto.tags.map((label) => ({
                    label,
                    createdBy: actor.id,
                  })),
                },
              }
            : {}),
        },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payable.id,
          action: AccountsPayableHistoryAction.CREATED,
          newStatus: AccountsPayableStatus.OPEN,
          justification: 'Título criado manualmente.',
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return this.balance.recompute(tx, payable.id);
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'accounts_payable.created',
      entity: 'AccountsPayable',
      entityId: created.id,
      newValue: { code: created.code, netAmount: total, manual: true },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return created;
  }

  async update(id: string, dto: UpdateAccountsPayableDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { tags: true },
    });

    if (!EDITABLE_STATUSES.includes(payable.status)) {
      throw new BadRequestException(
        'Este título não aceita mais edição. Cancele e crie outro, ou renegocie o cronograma.',
      );
    }

    const settings = await this.generation.settingsFor(
      payable.organizationId,
      payable.companyId,
    );

    const { tags, justification, ...fields } = dto;

    const changes = Object.entries(fields).filter(([key, value]) => {
      const current = (payable as unknown as Record<string, unknown>)[key];
      const next = key.endsWith('Date') && value ? new Date(value) : value;
      if (next instanceof Date && current instanceof Date) {
        return next.getTime() !== current.getTime();
      }
      return value !== undefined && value !== current;
    });

    if (
      settings.requireJustificationOnAmountChange &&
      changes.some(([key]) => key in TRACKED_FIELDS) &&
      !justification
    ) {
      throw new BadRequestException(
        'A empresa exige justificativa para alterar fornecedor, centro de custo ou projeto.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.accountsPayable.update({
        where: { id },
        data: {
          ...fields,
          ...(dto.competenceDate
            ? { competenceDate: new Date(dto.competenceDate) }
            : {}),
          updatedBy: actor.id,
        },
      });

      for (const [field, value] of changes) {
        await tx.accountsPayableHistory.create({
          data: {
            payableId: id,
            action:
              TRACKED_FIELDS[field] ?? AccountsPayableHistoryAction.UPDATED,
            field,
            previousValue: stringify(
              (payable as unknown as Record<string, unknown>)[field],
            ),
            newValue: stringify(value),
            justification,
            actorId: actor.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
      }

      if (tags) {
        await tx.accountsPayableTag.deleteMany({ where: { payableId: id } });
        for (const label of new Set(tags)) {
          await tx.accountsPayableTag.create({
            data: { payableId: id, label, createdBy: actor.id },
          });
        }
      }

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.updated',
      entity: 'AccountsPayable',
      entityId: id,
      oldValue: Object.fromEntries(
        changes.map(([key]) => [
          key,
          stringify((payable as unknown as Record<string, unknown>)[key]),
        ]),
      ),
      newValue: Object.fromEntries(
        changes.map(([key, value]) => [key, stringify(value)]),
      ),
      reason: justification,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Parcelas (seção 7) ────────────────────────────────────────────────────

  async updateInstallment(
    installmentId: string,
    dto: UpdatePayableInstallmentDto,
    actor: RequestActor,
  ) {
    const installment =
      await this.prisma.accountsPayableInstallment.findFirstOrThrow({
        where: { id: installmentId },
        include: { payable: true },
      });

    if (installment.status === AccountsPayableInstallmentStatus.PAID) {
      throw new BadRequestException(
        'Esta parcela já foi paga. Estorne o pagamento antes de alterá-la.',
      );
    }

    if (installment.payable.blockedAt) {
      throw new BadRequestException(
        'Título bloqueado. Libere o bloqueio antes de alterar.',
      );
    }

    const settings = await this.generation.settingsFor(
      installment.payable.organizationId,
      installment.payable.companyId,
    );

    const changingDueDate =
      dto.dueDate !== undefined &&
      new Date(dto.dueDate).getTime() !== installment.dueDate.getTime();
    const changingAmount =
      dto.amount !== undefined &&
      cents(dto.amount) !== cents(installment.originalAmount);

    if (
      changingDueDate &&
      settings.requireJustificationOnDueDateChange &&
      !dto.justification
    ) {
      throw new BadRequestException(
        'A empresa exige justificativa para alterar o vencimento.',
      );
    }

    if (
      changingAmount &&
      settings.requireJustificationOnAmountChange &&
      !dto.justification
    ) {
      throw new BadRequestException(
        'A empresa exige justificativa para alterar o valor.',
      );
    }

    if (
      changingAmount &&
      cents(dto.amount ?? 0) < cents(installment.paidAmount)
    ) {
      throw new BadRequestException(
        'O novo valor é menor do que o já pago nesta parcela. Estorne o pagamento antes.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableInstallment.update({
        where: { id: installmentId },
        data: {
          ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
          ...(dto.amount !== undefined ? { originalAmount: dto.amount } : {}),
          ...(dto.financialAccountId
            ? { financialAccountId: dto.financialAccountId }
            : {}),
          ...(dto.paymentMethodId
            ? { paymentMethodId: dto.paymentMethodId }
            : {}),
          ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
          ...(dto.digitableLine !== undefined
            ? { digitableLine: dto.digitableLine }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      if (changingDueDate) {
        await tx.accountsPayableHistory.create({
          data: {
            payableId: installment.payableId,
            installmentId,
            action: AccountsPayableHistoryAction.DUE_DATE_CHANGED,
            field: 'dueDate',
            previousValue: installment.dueDate.toISOString().slice(0, 10),
            newValue: String(dto.dueDate),
            justification: dto.justification,
            actorId: actor.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
      }

      if (changingAmount) {
        await tx.accountsPayableHistory.create({
          data: {
            payableId: installment.payableId,
            installmentId,
            action: AccountsPayableHistoryAction.AMOUNT_CHANGED,
            field: 'originalAmount',
            previousValue: String(installment.originalAmount),
            newValue: String(dto.amount),
            justification: dto.justification,
            actorId: actor.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
      }

      return this.balance.recompute(tx, installment.payableId);
    });

    await this.audit.log({
      organizationId: installment.payable.organizationId,
      companyId: installment.payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.installment_updated',
      entity: 'AccountsPayableInstallment',
      entityId: installmentId,
      oldValue: {
        dueDate: installment.dueDate,
        amount: Number(installment.originalAmount),
      },
      newValue: { dueDate: dto.dueDate, amount: dto.amount },
      reason: dto.justification,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /** Cancela uma parcela futura ainda sem pagamento. */
  async cancelInstallment(
    installmentId: string,
    dto: ReasonDto,
    actor: RequestActor,
  ) {
    const installment =
      await this.prisma.accountsPayableInstallment.findFirstOrThrow({
        where: { id: installmentId },
        include: { payable: { include: { installments: true } } },
      });

    if (cents(installment.paidAmount) > 0) {
      throw new BadRequestException(
        'Esta parcela tem pagamento registrado. Estorne o pagamento antes de excluí-la.',
      );
    }

    const live = installment.payable.installments.filter(
      (item) =>
        item.id !== installmentId &&
        item.status !== AccountsPayableInstallmentStatus.CANCELLED,
    );

    if (live.length === 0) {
      throw new BadRequestException(
        'Um título precisa de ao menos uma parcela. Cancele o título inteiro.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableInstallment.update({
        where: { id: installmentId },
        data: {
          status: AccountsPayableInstallmentStatus.CANCELLED,
          notes: dto.reason,
        },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: installment.payableId,
          installmentId,
          action: AccountsPayableHistoryAction.INSTALLMENT_CHANGED,
          field: 'status',
          previousValue: installment.status,
          newValue: AccountsPayableInstallmentStatus.CANCELLED,
          justification: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return this.balance.recompute(tx, installment.payableId);
    });

    await this.audit.log({
      organizationId: installment.payable.organizationId,
      companyId: installment.payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.installment_cancelled',
      entity: 'AccountsPayableInstallment',
      entityId: installmentId,
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /** Reparcela o que ainda está em aberto, mantendo o que já foi pago. */
  async reinstall(id: string, dto: ReinstallDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    if (payable.blockedAt) {
      throw new BadRequestException(
        'Título bloqueado. Libere o bloqueio antes de reparcelar.',
      );
    }

    const open = payable.installments.filter(
      (installment) =>
        cents(installment.balanceAmount) > 0 &&
        installment.status !== AccountsPayableInstallmentStatus.CANCELLED &&
        installment.status !== AccountsPayableInstallmentStatus.RENEGOTIATED,
    );

    if (open.length === 0) {
      throw new BadRequestException(
        'Não há parcela em aberto para reparcelar.',
      );
    }

    const openBalance = open.reduce(
      (total, installment) => total + cents(installment.balanceAmount),
      0,
    );
    const newTotal = cents(sum(dto.installments.map((line) => line.amount)));

    if (newTotal !== openBalance) {
      throw new BadRequestException(
        `As novas parcelas somam ${brl(fromCents(newTotal))} e o saldo em aberto é ${brl(fromCents(openBalance))}. ` +
          'Para mudar o valor total, use a renegociação.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableInstallment.updateMany({
        where: { id: { in: open.map((installment) => installment.id) } },
        data: { status: AccountsPayableInstallmentStatus.CANCELLED },
      });

      const base = payable.installments.length;

      for (const [index, line] of dto.installments.entries()) {
        await tx.accountsPayableInstallment.create({
          data: {
            payableId: id,
            installmentNumber: base + index + 1,
            totalInstallments: base + dto.installments.length,
            dueDate: new Date(line.dueDate),
            originalDueDate: new Date(line.dueDate),
            originalAmount: line.amount,
            netAmount: line.amount,
            balanceAmount: line.amount,
            status: AccountsPayableInstallmentStatus.OPEN,
            barcode: line.barcode,
            digitableLine: line.digitableLine,
            notes: line.notes,
            financialAccountId: payable.financialAccountId,
            paymentMethodId: payable.paymentMethodId,
          },
        });
      }

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.INSTALLMENT_CHANGED,
          field: 'schedule',
          previousValue: `${open.length} parcela(s)`,
          newValue: `${dto.installments.length} parcela(s)`,
          justification: dto.justification,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return this.balance.recompute(tx, id);
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.reinstalled',
      entity: 'AccountsPayable',
      entityId: id,
      reason: dto.justification,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Programação de pagamento ──────────────────────────────────────────────

  /**
   * Programa o pagamento dentro do Pulse — data, conta e forma.
   *
   * Programar não agenda no banco: nenhuma remessa sai daqui. É a "programação de
   * pagamentos" da seção 1, e é justamente o estado que o Agendamento Bancário vai
   * consumir quando existir.
   */
  async schedule(id: string, dto: SchedulePaymentDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { installments: true },
    });

    this.assertNotBlocked(payable);

    if (cents(payable.balanceAmount) === 0) {
      throw new BadRequestException('Este título não tem saldo a programar.');
    }

    const targets = dto.installmentIds?.length
      ? payable.installments.filter((installment) =>
          dto.installmentIds?.includes(installment.id),
        )
      : payable.installments.filter(
          (installment) => cents(installment.balanceAmount) > 0,
        );

    if (targets.length === 0) {
      throw new BadRequestException('Não há parcela em aberto para programar.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableInstallment.updateMany({
        where: { id: { in: targets.map((installment) => installment.id) } },
        data: {
          scheduledPaymentDate: new Date(dto.scheduledPaymentDate),
          ...(dto.financialAccountId
            ? { financialAccountId: dto.financialAccountId }
            : {}),
          ...(dto.paymentMethodId
            ? { paymentMethodId: dto.paymentMethodId }
            : {}),
        },
      });

      await tx.accountsPayable.update({
        where: { id },
        data: {
          scheduledPaymentDate: new Date(dto.scheduledPaymentDate),
          scheduledBy: actor.id,
          scheduledAt: new Date(),
          ...(dto.financialAccountId
            ? { financialAccountId: dto.financialAccountId }
            : {}),
          ...(dto.paymentMethodId
            ? { paymentMethodId: dto.paymentMethodId }
            : {}),
        },
      });

      const result = await this.balance.recompute(tx, id);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.SCHEDULED,
          previousStatus: payable.status,
          newStatus: result.status,
          field: 'scheduledPaymentDate',
          previousValue:
            payable.scheduledPaymentDate?.toISOString().slice(0, 10) ?? null,
          newValue: dto.scheduledPaymentDate,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.scheduled',
      entity: 'AccountsPayable',
      entityId: id,
      newValue: {
        scheduledPaymentDate: dto.scheduledPaymentDate,
        installments: targets.length,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Bloqueios (seção 12) ──────────────────────────────────────────────────

  async block(id: string, dto: BlockDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (payable.blockedAt) {
      throw new BadRequestException('Este título já está bloqueado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableBlock.create({
        data: {
          payableId: id,
          reason: dto.reason,
          description: dto.description,
          blockedBy: actor.id,
        },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.BLOCKED,
          field: 'blockedAt',
          newValue: dto.reason,
          justification: dto.description,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return tx.accountsPayable.update({
        where: { id },
        data: { blockedAt: new Date(), updatedBy: actor.id },
      });
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.blocked',
      entity: 'AccountsPayable',
      entityId: id,
      newValue: { reason: dto.reason },
      reason: dto.description,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async unblock(id: string, dto: UnblockDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (!payable.blockedAt) {
      throw new BadRequestException('Este título não está bloqueado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableBlock.updateMany({
        where: { payableId: id, releasedAt: null },
        data: {
          releasedAt: new Date(),
          releasedBy: actor.id,
          releaseReason: dto.releaseReason,
        },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.UNBLOCKED,
          field: 'blockedAt',
          previousValue: payable.blockedAt?.toISOString() ?? null,
          justification: dto.releaseReason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return tx.accountsPayable.update({
        where: { id },
        data: { blockedAt: null, updatedBy: actor.id },
      });
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.unblocked',
      entity: 'AccountsPayable',
      entityId: id,
      reason: dto.releaseReason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  async cancel(id: string, dto: ReasonDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (payable.status === AccountsPayableStatus.CANCELLED) {
      throw new BadRequestException('Este título já está cancelado.');
    }

    if (cents(payable.paidAmount) > 0) {
      throw new BadRequestException(
        'Este título tem pagamento registrado. Estorne os pagamentos antes de cancelar.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.accountsPayable.update({
        where: { id },
        data: {
          status: AccountsPayableStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledBy: actor.id,
          cancelledAt: new Date(),
        },
      });

      await tx.accountsPayableInstallment.updateMany({
        where: {
          payableId: id,
          status: { not: AccountsPayableInstallmentStatus.PAID },
        },
        data: { status: AccountsPayableInstallmentStatus.CANCELLED },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.CANCELLED,
          previousStatus: payable.status,
          newStatus: AccountsPayableStatus.CANCELLED,
          justification: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.cancelled',
      entity: 'AccountsPayable',
      entityId: id,
      oldValue: { status: payable.status },
      newValue: { status: AccountsPayableStatus.CANCELLED },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /**
   * Reabre um título cancelado.
   *
   * A janela de reabertura é um parâmetro da empresa: reabrir um cancelamento de dois anos
   * atrás quase sempre é engano, e o que se quer nesse caso é um título novo com data
   * própria — não ressuscitar um que já saiu de todos os relatórios.
   */
  async reopen(id: string, dto: ReasonDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (payable.status !== AccountsPayableStatus.CANCELLED) {
      throw new BadRequestException(
        'Só um título cancelado pode ser reaberto.',
      );
    }

    const settings = await this.generation.settingsFor(
      payable.organizationId,
      payable.companyId,
    );

    if (settings.reopenWindowDays !== null && payable.cancelledAt) {
      const elapsed = daysBetween(payable.cancelledAt, new Date());
      if (elapsed > settings.reopenWindowDays) {
        throw new BadRequestException(
          `O prazo de reabertura da empresa é de ${settings.reopenWindowDays} dia(s) e já se passaram ${elapsed}.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableInstallment.updateMany({
        where: {
          payableId: id,
          status: AccountsPayableInstallmentStatus.CANCELLED,
        },
        data: { status: AccountsPayableInstallmentStatus.OPEN },
      });

      await tx.accountsPayable.update({
        where: { id },
        data: {
          status: AccountsPayableStatus.OPEN,
          cancellationReason: null,
          cancelledBy: null,
          cancelledAt: null,
          reopenedBy: actor.id,
          reopenedAt: new Date(),
        },
      });

      const result = await this.balance.recompute(tx, id);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.REOPENED,
          previousStatus: AccountsPayableStatus.CANCELLED,
          newStatus: result.status,
          justification: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.reopened',
      entity: 'AccountsPayable',
      entityId: id,
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Retenções (seção 11) ──────────────────────────────────────────────────

  async reviseWithholding(
    id: string,
    dto: PayableWithholdingDto,
    actor: RequestActor,
  ) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (cents(payable.paidAmount) > 0) {
      throw new BadRequestException(
        'Este título já tem pagamento registrado. Alterar a retenção mudaria um valor já liquidado.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableWithholding.upsert({
        where: { payableId_taxType: { payableId: id, taxType: dto.taxType } },
        create: {
          payableId: id,
          taxType: dto.taxType,
          calculationBase: dto.calculationBase,
          rate: dto.rate,
          amount: dto.amount,
          status: FinancialEntryWithholdingStatus.CONFIRMED,
          decisionReason: dto.reason,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
        update: {
          calculationBase: dto.calculationBase,
          rate: dto.rate,
          amount: dto.amount,
          status: FinancialEntryWithholdingStatus.CONFIRMED,
          decisionReason: dto.reason,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: id,
          action: AccountsPayableHistoryAction.WITHHOLDING_CHANGED,
          field: dto.taxType,
          newValue: String(dto.amount),
          justification: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return this.balance.recompute(tx, id);
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.withholding_revised',
      entity: 'AccountsPayable',
      entityId: id,
      newValue: { taxType: dto.taxType, amount: dto.amount },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async decideWithholding(
    withholdingId: string,
    dto: WithholdingDecisionDto,
    actor: RequestActor,
  ) {
    const withholding =
      await this.prisma.accountsPayableWithholding.findFirstOrThrow({
        where: { id: withholdingId },
        include: { payable: true },
      });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableWithholding.update({
        where: { id: withholdingId },
        data: {
          status: dto.status,
          decisionReason: dto.reason,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      });

      await tx.accountsPayableHistory.create({
        data: {
          payableId: withholding.payableId,
          action: AccountsPayableHistoryAction.WITHHOLDING_CHANGED,
          field: withholding.taxType,
          previousValue: withholding.status,
          newValue: dto.status,
          justification: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return this.balance.recompute(tx, withholding.payableId);
    });

    await this.audit.log({
      organizationId: withholding.payable.organizationId,
      companyId: withholding.payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.withholding_decided',
      entity: 'AccountsPayableWithholding',
      entityId: withholdingId,
      oldValue: { status: withholding.status },
      newValue: { status: dto.status },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Comentários ───────────────────────────────────────────────────────────

  async comment(id: string, dto: PayableCommentDto, actor: RequestActor) {
    return this.prisma.accountsPayableComment.create({
      data: {
        payableId: id,
        authorId: actor.id,
        body: dto.body,
        attachments: dto.attachments as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async comments(id: string) {
    return this.prisma.accountsPayableComment.findMany({
      where: { payableId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Parâmetros ────────────────────────────────────────────────────────────

  async findSettings(organizationId: string, companyId: string) {
    return this.generation.settingsFor(organizationId, companyId);
  }

  async updateSettings(
    organizationId: string,
    companyId: string,
    dto: UpdateAccountsPayableSettingsDto,
    actor: RequestActor,
  ) {
    const current = await this.generation.settingsFor(
      organizationId,
      companyId,
    );

    const updated = await this.prisma.accountsPayableSettings.update({
      where: { companyId },
      data: { ...dto, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'accounts_payable.settings_updated',
      entity: 'AccountsPayableSettings',
      entityId: updated.id,
      oldValue: current,
      newValue: dto as unknown as Prisma.InputJsonValue,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private assertNotBlocked(payable: { blockedAt: Date | null }) {
    if (payable.blockedAt) {
      throw new BadRequestException(
        'Este título está bloqueado e não pode seguir para pagamento. Libere o bloqueio primeiro.',
      );
    }
  }

  private canSeeSensitive(actor: RequestActor): boolean {
    if (actor.isPlatformAdmin) return true;
    return actor.memberships.some((membership) =>
      membership.permissions.includes('document_intake.view_sensitive'),
    );
  }

  /**
   * Mascara linha digitável, código de barras e chave PIX no back-end.
   *
   * No back-end e não na tela: o valor cru sairia na resposta, no log do proxy e no cache
   * do navegador, e esconder no front seria esconder só de quem olha.
   */
  private mask<
    T extends {
      barcode: string | null;
      digitableLine: string | null;
      pixKey: string | null;
    },
  >(payable: T, allowed: boolean): T {
    if (allowed) return payable;

    return {
      ...payable,
      barcode: payable.barcode ? maskAccountLike(payable.barcode) : null,
      digitableLine: payable.digitableLine
        ? maskAccountLike(payable.digitableLine)
        : null,
      pixKey: payable.pixKey ? maskPixKeyValue(payable.pixKey) : null,
    };
  }

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
}

/** Situação exibida — as onze da seção 4, com vencido e bloqueado calculados. */
export function situationOf(
  payable: {
    status: AccountsPayableStatus;
    blockedAt: Date | null;
    dueDate: Date;
    balanceAmount: Prisma.Decimal | number;
  },
  today: Date,
): PayableSituation {
  if (payable.blockedAt) return 'BLOCKED';
  if (isOverdue(payable, today)) return 'OVERDUE';
  return payable.status;
}

export function isOverdue(
  payable: {
    status: AccountsPayableStatus;
    dueDate: Date;
    balanceAmount: Prisma.Decimal | number;
  },
  today: Date,
): boolean {
  if (
    payable.status === AccountsPayableStatus.PAID ||
    payable.status === AccountsPayableStatus.CANCELLED ||
    payable.status === AccountsPayableStatus.RENEGOTIATED
  ) {
    return false;
  }

  return (
    cents(payable.balanceAmount) > 0 && startOfDay(payable.dueDate) < today
  );
}

function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

function dateRange(field: string, from?: string, to?: string) {
  if (!from && !to) return {};

  return {
    [field]: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  };
}

/**
 * Valor de um campo do título como texto, para o histórico.
 *
 * Só aceita o que de fato aparece nas colunas rastreadas — id, texto, número, booleano ou
 * data. Um objeto viraria "[object Object]" no histórico, que é pior do que não registrar.
 */
function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return null;
}

/** Deixa visíveis apenas os últimos quatro dígitos de um código de cobrança. */
function maskAccountLike(value: string): string {
  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${visible}`;
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
