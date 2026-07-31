import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  BankPaymentType,
  PaymentScheduleHistoryAction,
  PaymentSchedulePriority,
  PaymentScheduleStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { AccountBalanceService } from './account-balance.service';
import { cents, fromCents, sum } from '../accounts-payable/money.util';
import {
  type BlockScheduleDto,
  type BulkCancelDto,
  type BulkScheduleDto,
  type CreatePaymentScheduleDto,
  type PaymentScheduleQueryDto,
  type ReasonDto,
  type ReorderQueueDto,
  type RescheduleDto,
  type ScheduleCommentDto,
  type ScheduleSituation,
  type SchedulableQueryDto,
  type UnblockScheduleDto,
  type UpdatePaymentScheduleDto,
  type UpdatePaymentScheduleSettingsDto,
} from './dto/payment-scheduling.dto';

const SCHEDULE_INCLUDE = {
  payable: {
    select: {
      id: true,
      code: true,
      documentNumber: true,
      description: true,
      dueDate: true,
      categoryId: true,
      costCenterId: true,
      projectId: true,
      supplier: { select: { id: true, legalName: true, tradeName: true } },
    },
  },
  company: { select: { id: true, legalName: true, tradeName: true } },
  batch: { select: { id: true, code: true, name: true, status: true } },
  items: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.PaymentScheduleInclude;

/**
 * Situações a partir das quais a programação ainda pode ser alterada.
 *
 * `SENT` e `EXECUTED` ficam de fora: quando existirem, terão sido escritas pelo banco, e
 * alterar o que já foi enviado seria mudar o passado — o arquivo já saiu.
 */
const EDITABLE_STATUSES: PaymentScheduleStatus[] = [
  PaymentScheduleStatus.PENDING_SCHEDULING,
  PaymentScheduleStatus.SCHEDULED,
  PaymentScheduleStatus.IN_BATCH,
  PaymentScheduleStatus.READY_TO_SEND,
];

/** Situações de parcela que ainda podem ser pagas. */
const PAYABLE_INSTALLMENTS: AccountsPayableInstallmentStatus[] = [
  AccountsPayableInstallmentStatus.OPEN,
  AccountsPayableInstallmentStatus.SCHEDULED,
  AccountsPayableInstallmentStatus.PARTIALLY_PAID,
];

/**
 * Programação de pagamentos.
 *
 * Este serviço decide **quando, de que conta e em que ordem** cada obrigação sai. Ele não
 * paga: não gera remessa, não chama API de banco, não muda o saldo do título. A execução é
 * do módulo seguinte, e a única coisa que este módulo faz por ele é deixar tudo pronto.
 */
@Injectable()
export class PaymentSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly balances: AccountBalanceService,
  ) {}

  /** Organização e empresa da programação, para o controlador validar a permissão. */
  async scopeOf(id: string) {
    return this.prisma.paymentSchedule.findFirstOrThrow({
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

  async scopeOfPayable(payableId: string) {
    return this.prisma.accountsPayable.findFirstOrThrow({
      where: { id: payableId, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true },
    });
  }

  // ── Parâmetros ────────────────────────────────────────────────────────────

  async settingsFor(organizationId: string, companyId: string) {
    const existing = await this.prisma.paymentScheduleSettings.findUnique({
      where: { companyId },
    });

    if (existing) return existing;

    return this.prisma.paymentScheduleSettings.create({
      data: { organizationId, companyId },
    });
  }

  async updateSettings(
    organizationId: string,
    companyId: string,
    dto: UpdatePaymentScheduleSettingsDto,
    actor: RequestActor,
  ) {
    const before = await this.settingsFor(organizationId, companyId);

    const updated = await this.prisma.paymentScheduleSettings.update({
      where: { companyId },
      data: { ...dto, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'payment_schedule.settings_updated',
      entity: 'PaymentScheduleSettings',
      entityId: updated.id,
      oldValue: before,
      newValue: dto as unknown as Prisma.InputJsonValue,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  async findAll(query: PaymentScheduleQueryDto) {
    const where: Prisma.PaymentScheduleWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.responsibleUserId
        ? { responsibleUserId: query.responsibleUserId }
        : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.bankPaymentType
        ? { bankPaymentType: query.bankPaymentType }
        : {}),
      ...(query.scheduledFrom || query.scheduledTo
        ? {
            scheduledDate: {
              ...(query.scheduledFrom
                ? { gte: new Date(query.scheduledFrom) }
                : {}),
              ...(query.scheduledTo
                ? { lte: new Date(query.scheduledTo) }
                : {}),
            },
          }
        : {}),
      ...(query.minAmount !== undefined || query.maxAmount !== undefined
        ? {
            totalAmount: {
              ...(query.minAmount !== undefined
                ? { gte: query.minAmount }
                : {}),
              ...(query.maxAmount !== undefined
                ? { lte: query.maxAmount }
                : {}),
            },
          }
        : {}),
      ...(query.blocked !== undefined
        ? query.blocked
          ? { NOT: { blockedAt: null } }
          : { blockedAt: null }
        : {}),
      ...(query.rescheduled ? { rescheduleCount: { gt: 0 } } : {}),
      // Fornecedor, categoria, centro de custo e projeto vivem no título. Filtrar pela
      // relação evita duplicar essas colunas aqui — e evita que elas discordem quando o
      // título for corrigido.
      ...(query.supplierId ||
      query.categoryId ||
      query.costCenterId ||
      query.projectId
        ? {
            payable: {
              ...(query.supplierId ? { supplierId: query.supplierId } : {}),
              ...(query.categoryId ? { categoryId: query.categoryId } : {}),
              ...(query.costCenterId
                ? { costCenterId: query.costCenterId }
                : {}),
              ...(query.projectId ? { projectId: query.projectId } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              {
                payable: {
                  code: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                payable: {
                  documentNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    if (query.situation === 'BLOCKED') {
      Object.assign(where, { NOT: { blockedAt: null } });
    } else if (query.situation === 'RESCHEDULED') {
      Object.assign(where, {
        rescheduleCount: { gt: 0 },
        status: PaymentScheduleStatus.SCHEDULED,
      });
    } else if (query.situation) {
      Object.assign(where, {
        status: query.situation,
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.paymentSchedule.findMany({
        where,
        include: SCHEDULE_INCLUDE,
        // A fila é ordenada pela posição manual primeiro — é ela que a seção 9 pede — e a
        // prioridade só desempata quem nunca foi reordenado.
        orderBy: [
          { queuePosition: 'asc' },
          { scheduledDate: 'asc' },
          { createdAt: 'asc' },
        ],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.paymentSchedule.count({ where }),
    ]);

    return paginate(
      items.map((item) => ({ ...item, situation: situationOf(item) })),
      total,
      query.page,
      query.perPage,
    );
  }

  async findOne(id: string) {
    const schedule = await this.prisma.paymentSchedule.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        ...SCHEDULE_INCLUDE,
        history: { orderBy: { createdAt: 'desc' }, take: 200 },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const balance =
      schedule.financialAccountId && schedule.scheduledDate
        ? await this.balances.check({
            accountId: schedule.financialAccountId,
            referenceDate: schedule.scheduledDate,
            amount: Number(schedule.totalAmount),
            ignoreScheduleId: schedule.id,
          })
        : null;

    return { ...schedule, situation: situationOf(schedule), balance };
  }

  /**
   * Títulos que ainda podem ser programados.
   *
   * O que entra: título com saldo, não bloqueado, não cancelado, e com ao menos uma parcela
   * livre. Um título bloqueado no Contas a Pagar não aparece aqui — o bloqueio de lá existe
   * justamente para impedir que ele chegue ao banco.
   */
  async findSchedulable(query: SchedulableQueryDto) {
    const where: Prisma.AccountsPayableWhereInput = {
      deletedAt: null,
      companyId: query.companyId,
      blockedAt: null,
      balanceAmount: { gt: 0 },
      status: {
        notIn: [
          AccountsPayableStatus.PAID,
          AccountsPayableStatus.CANCELLED,
          AccountsPayableStatus.RENEGOTIATED,
        ],
      },
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.dueTo ? { dueDate: { lte: new Date(query.dueTo) } } : {}),
      installments: {
        some: {
          status: { in: PAYABLE_INSTALLMENTS },
          balanceAmount: { gt: 0 },
          scheduleItem: null,
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where,
        include: {
          supplier: { select: { id: true, legalName: true, tradeName: true } },
          installments: {
            where: {
              status: { in: PAYABLE_INSTALLMENTS },
              balanceAmount: { gt: 0 },
              scheduleItem: null,
            },
            orderBy: { installmentNumber: 'asc' },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.accountsPayable.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async history(id: string) {
    return this.prisma.paymentScheduleHistory.findMany({
      where: { scheduleId: id },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  // ── Criação ───────────────────────────────────────────────────────────────

  async create(dto: CreatePaymentScheduleDto, actor: RequestActor) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id: dto.payableId, deletedAt: null },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    if (payable.companyId !== dto.companyId) {
      throw new BadRequestException('O título pertence a outra empresa.');
    }

    if (payable.blockedAt) {
      throw new BadRequestException(
        'Este título está bloqueado no Contas a Pagar e não pode ser programado.',
      );
    }

    if (
      payable.status === AccountsPayableStatus.CANCELLED ||
      payable.status === AccountsPayableStatus.RENEGOTIATED
    ) {
      throw new BadRequestException('Este título não está mais em aberto.');
    }

    const settings = await this.settingsFor(dto.organizationId, dto.companyId);

    // Já programadas: uma parcela não pode entrar em duas programações vivas. A checagem
    // aqui dá a mensagem decente; a garantia é o `UNIQUE` do banco.
    const taken = await this.prisma.paymentScheduleItem.findMany({
      where: {
        installmentId: { in: payable.installments.map((item) => item.id) },
      },
      select: { installmentId: true },
    });
    const takenIds = new Set(taken.map((item) => item.installmentId));

    const candidates = payable.installments.filter(
      (installment) =>
        PAYABLE_INSTALLMENTS.includes(installment.status) &&
        cents(installment.balanceAmount) > 0 &&
        !takenIds.has(installment.id),
    );

    const chosen = dto.installmentIds?.length
      ? candidates.filter((installment) =>
          dto.installmentIds?.includes(installment.id),
        )
      : candidates;

    if (chosen.length === 0) {
      throw new BadRequestException(
        candidates.length === 0
          ? 'Todas as parcelas deste título já estão programadas ou não têm saldo.'
          : 'As parcelas informadas não estão disponíveis para programação.',
      );
    }

    const total = sum(
      chosen.map((installment) => Number(installment.balanceAmount)),
    );

    const accountId =
      dto.financialAccountId ??
      payable.financialAccountId ??
      settings.defaultFinancialAccountId ??
      null;

    const scheduledDate = dto.scheduledDate
      ? new Date(dto.scheduledDate)
      : (payable.scheduledPaymentDate ?? null);

    if (scheduledDate) {
      this.assertDateIsAllowed(scheduledDate, settings);
    }

    const code = await this.nextScheduleCode(
      dto.companyId,
      settings.schedulePrefix,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.paymentSchedule.create({
        data: {
          organizationId: dto.organizationId,
          companyId: dto.companyId,
          code,
          payableId: payable.id,
          status: scheduledDate
            ? PaymentScheduleStatus.SCHEDULED
            : PaymentScheduleStatus.PENDING_SCHEDULING,
          priority: dto.priority ?? settings.defaultPriority,
          financialAccountId: accountId,
          paymentMethodId: dto.paymentMethodId ?? payable.paymentMethodId,
          bankPaymentType:
            dto.bankPaymentType ?? settings.defaultBankPaymentType,
          scheduledDate,
          originalDate: scheduledDate,
          totalAmount: total,
          responsibleUserId:
            dto.responsibleUserId ?? payable.responsibleUserId ?? actor.id,
          notes: dto.notes,
          createdBy: actor.id,
          items: {
            create: chosen.map((installment, index) => ({
              installmentId: installment.id,
              amount: Number(installment.balanceAmount),
              sortOrder: index,
            })),
          },
        },
      });

      await tx.paymentScheduleHistory.create({
        data: {
          scheduleId: schedule.id,
          action: scheduledDate
            ? PaymentScheduleHistoryAction.SCHEDULED
            : PaymentScheduleHistoryAction.CREATED,
          newStatus: schedule.status,
          field: scheduledDate ? 'scheduledDate' : null,
          newValue: scheduledDate ? isoDate(scheduledDate) : null,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return schedule;
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'payment_schedule.created',
      entity: 'PaymentSchedule',
      entityId: created.id,
      newValue: {
        code: created.code,
        payableId: payable.id,
        installments: chosen.length,
        totalAmount: total,
        scheduledDate: scheduledDate ? isoDate(scheduledDate) : null,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(created.id);
  }

  // ── Programação individual (seção 6) ──────────────────────────────────────

  async update(id: string, dto: UpdatePaymentScheduleDto, actor: RequestActor) {
    const schedule = await this.loadEditable(id);
    const settings = await this.settingsFor(
      schedule.organizationId,
      schedule.companyId,
    );

    if (dto.scheduledDate) {
      const next = new Date(dto.scheduledDate);
      this.assertDateIsAllowed(next, settings);

      // Mudar a data de uma programação que já tinha data é reprogramar, e reprogramar
      // exige motivo. Deixar passar por aqui seria uma porta dos fundos para o registro
      // que a seção 13 pede.
      if (
        schedule.scheduledDate &&
        next.getTime() !== schedule.scheduledDate.getTime() &&
        settings.requireReasonOnReschedule
      ) {
        throw new BadRequestException(
          'Alterar a data de uma programação existente é uma reprogramação. Use a ação de reprogramar e informe o motivo.',
        );
      }
    }

    const changes = this.diff(schedule, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentSchedule.update({
        where: { id },
        data: {
          ...(dto.scheduledDate
            ? { scheduledDate: new Date(dto.scheduledDate) }
            : {}),
          ...(dto.financialAccountId
            ? { financialAccountId: dto.financialAccountId }
            : {}),
          ...(dto.paymentMethodId
            ? { paymentMethodId: dto.paymentMethodId }
            : {}),
          ...(dto.bankPaymentType
            ? { bankPaymentType: dto.bankPaymentType }
            : {}),
          ...(dto.priority ? { priority: dto.priority } : {}),
          ...(dto.responsibleUserId
            ? { responsibleUserId: dto.responsibleUserId }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.queuePosition !== undefined
            ? { queuePosition: dto.queuePosition }
            : {}),
          ...(dto.scheduledDate && !schedule.scheduledDate
            ? {
                status: PaymentScheduleStatus.SCHEDULED,
                originalDate: new Date(dto.scheduledDate),
              }
            : {}),
          updatedBy: actor.id,
        },
      });

      for (const change of changes) {
        await tx.paymentScheduleHistory.create({
          data: {
            scheduleId: id,
            action: change.action,
            field: change.field,
            previousValue: change.previousValue,
            newValue: change.newValue,
            actorId: actor.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
      }

      return result;
    });

    await this.audit.log({
      organizationId: schedule.organizationId,
      companyId: schedule.companyId,
      userId: actor.id,
      action: 'payment_schedule.updated',
      entity: 'PaymentSchedule',
      entityId: id,
      oldValue: Object.fromEntries(
        changes.map((change) => [change.field, change.previousValue]),
      ),
      newValue: Object.fromEntries(
        changes.map((change) => [change.field, change.newValue]),
      ),
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    void updated;
    return this.findOne(id);
  }

  /** Reprogramação com motivo (seção 13). */
  async reschedule(id: string, dto: RescheduleDto, actor: RequestActor) {
    const schedule = await this.loadEditable(id);
    const settings = await this.settingsFor(
      schedule.organizationId,
      schedule.companyId,
    );

    const next = new Date(dto.scheduledDate);
    this.assertDateIsAllowed(next, settings);

    if (dto.batchId) {
      const batch = await this.prisma.paymentBatch.findFirstOrThrow({
        where: { id: dto.batchId, deletedAt: null },
        select: { companyId: true, status: true },
      });

      if (batch.companyId !== schedule.companyId) {
        throw new BadRequestException(
          'O lote informado pertence a outra empresa.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentSchedule.update({
        where: { id },
        data: {
          scheduledDate: next,
          rescheduleCount: schedule.rescheduleCount + 1,
          ...(dto.financialAccountId
            ? { financialAccountId: dto.financialAccountId }
            : {}),
          ...(dto.bankPaymentType
            ? { bankPaymentType: dto.bankPaymentType }
            : {}),
          ...(dto.priority ? { priority: dto.priority } : {}),
          ...(dto.batchId !== undefined
            ? {
                batchId: dto.batchId ?? null,
                status: dto.batchId
                  ? PaymentScheduleStatus.IN_BATCH
                  : PaymentScheduleStatus.SCHEDULED,
              }
            : {
                status:
                  schedule.status === PaymentScheduleStatus.PENDING_SCHEDULING
                    ? PaymentScheduleStatus.SCHEDULED
                    : schedule.status,
              }),
          originalDate: schedule.originalDate ?? schedule.scheduledDate ?? next,
          updatedBy: actor.id,
        },
      });

      await tx.paymentScheduleHistory.create({
        data: {
          scheduleId: id,
          action: PaymentScheduleHistoryAction.RESCHEDULED,
          previousStatus: schedule.status,
          newStatus: result.status,
          field: 'scheduledDate',
          previousValue: schedule.scheduledDate
            ? isoDate(schedule.scheduledDate)
            : null,
          newValue: isoDate(next),
          reason: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.recomputeBatch(schedule.batchId);
    if (dto.batchId && dto.batchId !== schedule.batchId) {
      await this.recomputeBatch(dto.batchId);
    }

    await this.audit.log({
      organizationId: schedule.organizationId,
      companyId: schedule.companyId,
      userId: actor.id,
      action: 'payment_schedule.rescheduled',
      entity: 'PaymentSchedule',
      entityId: id,
      oldValue: {
        scheduledDate: schedule.scheduledDate
          ? isoDate(schedule.scheduledDate)
          : null,
      },
      newValue: { scheduledDate: dto.scheduledDate },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    void updated;
    return this.findOne(id);
  }

  // ── Bloqueios ─────────────────────────────────────────────────────────────

  async block(id: string, dto: BlockScheduleDto, actor: RequestActor) {
    const schedule = await this.scopeOf(id);

    if (schedule.blockedAt) {
      throw new BadRequestException('Esta programação já está bloqueada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentSchedule.update({
        where: { id },
        data: {
          blockedAt: new Date(),
          blockReason: dto.reason,
          blockNotes: dto.notes,
          blockedBy: actor.id,
          releasedAt: null,
          releasedBy: null,
          releaseReason: null,
          updatedBy: actor.id,
        },
      });

      await tx.paymentScheduleHistory.create({
        data: {
          scheduleId: id,
          action: PaymentScheduleHistoryAction.BLOCKED,
          field: 'blockedAt',
          newValue: dto.reason,
          reason: dto.notes,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });
    });

    await this.audit.log({
      organizationId: schedule.organizationId,
      companyId: schedule.companyId,
      userId: actor.id,
      action: 'payment_schedule.blocked',
      entity: 'PaymentSchedule',
      entityId: id,
      newValue: { reason: dto.reason },
      reason: dto.notes,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(id);
  }

  async unblock(id: string, dto: UnblockScheduleDto, actor: RequestActor) {
    const schedule = await this.scopeOf(id);

    if (!schedule.blockedAt) {
      throw new BadRequestException('Esta programação não está bloqueada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentSchedule.update({
        where: { id },
        data: {
          blockedAt: null,
          blockReason: null,
          blockNotes: null,
          releasedAt: new Date(),
          releasedBy: actor.id,
          releaseReason: dto.releaseReason,
          updatedBy: actor.id,
        },
      });

      await tx.paymentScheduleHistory.create({
        data: {
          scheduleId: id,
          action: PaymentScheduleHistoryAction.UNBLOCKED,
          field: 'blockedAt',
          reason: dto.releaseReason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });
    });

    await this.audit.log({
      organizationId: schedule.organizationId,
      companyId: schedule.companyId,
      userId: actor.id,
      action: 'payment_schedule.unblocked',
      entity: 'PaymentSchedule',
      entityId: id,
      reason: dto.releaseReason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(id);
  }

  // ── Cancelamento ──────────────────────────────────────────────────────────

  /**
   * Cancela a programação e devolve as parcelas à fila.
   *
   * Os itens são apagados de propósito: o `UNIQUE` em `installment_id` impede que a mesma
   * parcela entre em outra programação enquanto eles existirem. Manter os itens "para
   * histórico" travaria a parcela para sempre — e o histórico do cancelamento fica em
   * `payment_schedule_history`, que é onde ele deve estar.
   */
  async cancel(id: string, dto: ReasonDto, actor: RequestActor) {
    const schedule = await this.prisma.paymentSchedule.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (schedule.status === PaymentScheduleStatus.CANCELLED) {
      throw new BadRequestException('Esta programação já está cancelada.');
    }

    if (!EDITABLE_STATUSES.includes(schedule.status)) {
      throw new BadRequestException(
        'Esta programação já foi enviada ao banco e não pode ser cancelada aqui.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentScheduleItem.deleteMany({ where: { scheduleId: id } });
      await tx.paymentBatchItem.deleteMany({ where: { scheduleId: id } });

      await tx.paymentSchedule.update({
        where: { id },
        data: {
          status: PaymentScheduleStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledBy: actor.id,
          cancelledAt: new Date(),
          batchId: null,
          totalAmount: 0,
          updatedBy: actor.id,
        },
      });

      await tx.paymentScheduleHistory.create({
        data: {
          scheduleId: id,
          action: PaymentScheduleHistoryAction.CANCELLED,
          previousStatus: schedule.status,
          newStatus: PaymentScheduleStatus.CANCELLED,
          reason: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });
    });

    await this.recomputeBatch(schedule.batchId);

    await this.audit.log({
      organizationId: schedule.organizationId,
      companyId: schedule.companyId,
      userId: actor.id,
      action: 'payment_schedule.cancelled',
      entity: 'PaymentSchedule',
      entityId: id,
      oldValue: { totalAmount: Number(schedule.totalAmount) },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(id);
  }

  // ── Ações em lote (seção 7) ───────────────────────────────────────────────

  /**
   * Aplica a mesma alteração a várias programações.
   *
   * Cada uma é processada isoladamente e o resultado diz exatamente quais falharam e por
   * quê. Abortar tudo por causa de uma programação bloqueada faria quem selecionou trinta
   * títulos ter de descobrir sozinho qual era o problema.
   */
  async bulkUpdate(dto: BulkScheduleDto, actor: RequestActor) {
    const results: {
      scheduleId: string;
      ok: boolean;
      code?: string;
      error?: string;
    }[] = [];

    for (const scheduleId of dto.scheduleIds) {
      try {
        const current = await this.prisma.paymentSchedule.findFirstOrThrow({
          where: { id: scheduleId, deletedAt: null },
          select: { code: true, scheduledDate: true },
        });

        const changingDate =
          dto.scheduledDate !== undefined &&
          current.scheduledDate !== null &&
          new Date(dto.scheduledDate).getTime() !==
            current.scheduledDate.getTime();

        if (changingDate) {
          if (!dto.reason) {
            throw new BadRequestException(
              'Alterar a data de programações já agendadas exige motivo.',
            );
          }

          await this.reschedule(
            scheduleId,
            {
              scheduledDate: dto.scheduledDate as string,
              reason: dto.reason,
              financialAccountId: dto.financialAccountId,
              bankPaymentType: dto.bankPaymentType,
              priority: dto.priority,
            },
            actor,
          );
        } else {
          await this.update(
            scheduleId,
            {
              scheduledDate: dto.scheduledDate,
              financialAccountId: dto.financialAccountId,
              bankPaymentType: dto.bankPaymentType,
              priority: dto.priority,
            },
            actor,
          );
        }

        results.push({ scheduleId, ok: true, code: current.code });
      } catch (error) {
        results.push({
          scheduleId,
          ok: false,
          error: error instanceof Error ? error.message : 'Falha ao alterar.',
        });
      }
    }

    return {
      total: results.length,
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    };
  }

  async bulkCancel(dto: BulkCancelDto, actor: RequestActor) {
    const results: { scheduleId: string; ok: boolean; error?: string }[] = [];

    for (const scheduleId of dto.scheduleIds) {
      try {
        await this.cancel(scheduleId, { reason: dto.reason }, actor);
        results.push({ scheduleId, ok: true });
      } catch (error) {
        results.push({
          scheduleId,
          ok: false,
          error: error instanceof Error ? error.message : 'Falha ao cancelar.',
        });
      }
    }

    return {
      total: results.length,
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    };
  }

  /** Reordena a fila manualmente (seção 9). */
  async reorderQueue(dto: ReorderQueueDto, actor: RequestActor) {
    await this.prisma.$transaction(
      dto.scheduleIds.map((scheduleId, index) =>
        this.prisma.paymentSchedule.update({
          where: { id: scheduleId },
          data: { queuePosition: index + 1, updatedBy: actor.id },
        }),
      ),
    );

    return { reordered: dto.scheduleIds.length };
  }

  // ── Comentários ───────────────────────────────────────────────────────────

  async comment(id: string, dto: ScheduleCommentDto, actor: RequestActor) {
    return this.prisma.paymentScheduleComment.create({
      data: { scheduleId: id, authorId: actor.id, body: dto.body },
    });
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /** Recalcula quantidade e valor do lote a partir dos seus itens. */
  async recomputeBatch(batchId: string | null | undefined) {
    if (!batchId) return;

    const schedules = await this.prisma.paymentSchedule.findMany({
      where: {
        batchId,
        deletedAt: null,
        status: { not: PaymentScheduleStatus.CANCELLED },
      },
      select: { totalAmount: true },
    });

    await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: {
        itemCount: schedules.length,
        totalAmount: fromCents(
          schedules.reduce((total, item) => total + cents(item.totalAmount), 0),
        ),
      },
    });
  }

  private async loadEditable(id: string) {
    const schedule = await this.prisma.paymentSchedule.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (schedule.blockedAt) {
      throw new BadRequestException(
        'Esta programação está bloqueada. Libere o bloqueio antes de alterá-la.',
      );
    }

    if (schedule.status === PaymentScheduleStatus.CANCELLED) {
      throw new BadRequestException('Esta programação está cancelada.');
    }

    if (!EDITABLE_STATUSES.includes(schedule.status)) {
      throw new BadRequestException(
        'Esta programação já foi enviada ao banco e não pode mais ser alterada.',
      );
    }

    return schedule;
  }

  private assertDateIsAllowed(
    date: Date,
    settings: { blockRetroactiveDates: boolean; minimumLeadTimeDays: number },
  ) {
    const today = startOfDay(new Date());
    const target = startOfDay(date);

    if (settings.blockRetroactiveDates && target < today) {
      throw new BadRequestException(
        'A data de pagamento não pode ser anterior a hoje.',
      );
    }

    if (settings.minimumLeadTimeDays > 0) {
      const earliest = new Date(today);
      earliest.setUTCDate(earliest.getUTCDate() + settings.minimumLeadTimeDays);

      if (target < earliest) {
        throw new BadRequestException(
          `A empresa exige ao menos ${settings.minimumLeadTimeDays} dia(s) entre a programação e o pagamento.`,
        );
      }
    }
  }

  /** Alterações que a auditoria trata como ação própria (seção 17). */
  private diff(
    current: {
      financialAccountId: string | null;
      priority: PaymentSchedulePriority;
      bankPaymentType: BankPaymentType | null;
      responsibleUserId: string | null;
    },
    dto: UpdatePaymentScheduleDto,
  ) {
    const changes: {
      action: PaymentScheduleHistoryAction;
      field: string;
      previousValue: string | null;
      newValue: string | null;
    }[] = [];

    if (
      dto.financialAccountId &&
      dto.financialAccountId !== current.financialAccountId
    ) {
      changes.push({
        action: PaymentScheduleHistoryAction.ACCOUNT_CHANGED,
        field: 'financialAccountId',
        previousValue: current.financialAccountId,
        newValue: dto.financialAccountId,
      });
    }

    if (dto.priority && dto.priority !== current.priority) {
      changes.push({
        action: PaymentScheduleHistoryAction.PRIORITY_CHANGED,
        field: 'priority',
        previousValue: current.priority,
        newValue: dto.priority,
      });
    }

    if (
      dto.bankPaymentType &&
      dto.bankPaymentType !== current.bankPaymentType
    ) {
      changes.push({
        action: PaymentScheduleHistoryAction.PAYMENT_TYPE_CHANGED,
        field: 'bankPaymentType',
        previousValue: current.bankPaymentType,
        newValue: dto.bankPaymentType,
      });
    }

    if (
      dto.responsibleUserId &&
      dto.responsibleUserId !== current.responsibleUserId
    ) {
      changes.push({
        action: PaymentScheduleHistoryAction.RESPONSIBLE_CHANGED,
        field: 'responsibleUserId',
        previousValue: current.responsibleUserId,
        newValue: dto.responsibleUserId,
      });
    }

    return changes;
  }

  private async nextScheduleCode(
    companyId: string,
    prefix: string,
  ): Promise<string> {
    const year = new Date().getUTCFullYear();
    const start = `${prefix}-${year}-`;

    const last = await this.prisma.paymentSchedule.findFirst({
      where: { companyId, code: { startsWith: start } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const sequence = last ? Number(last.code.slice(start.length)) + 1 : 1;
    return `${start}${String(sequence).padStart(6, '0')}`;
  }
}

/** Situação exibida — as nove da seção 4, com bloqueado e reprogramado calculados. */
export function situationOf(schedule: {
  status: PaymentScheduleStatus;
  blockedAt: Date | null;
  rescheduleCount: number;
}): ScheduleSituation {
  if (schedule.blockedAt) return 'BLOCKED';

  if (
    schedule.rescheduleCount > 0 &&
    schedule.status === PaymentScheduleStatus.SCHEDULED
  ) {
    return 'RESCHEDULED';
  }

  return schedule.status;
}

export function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
