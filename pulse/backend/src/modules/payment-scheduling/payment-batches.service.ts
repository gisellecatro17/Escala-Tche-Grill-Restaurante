import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentBatchStatus,
  PaymentScheduleHistoryAction,
  PaymentScheduleStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { AccountBalanceService } from './account-balance.service';
import { PaymentSchedulesService, isoDate } from './payment-schedules.service';
import { cents, fromCents } from '../accounts-payable/money.util';
import type {
  BatchMembershipDto,
  CreatePaymentBatchDto,
  PaymentBatchQueryDto,
  UpdatePaymentBatchDto,
} from './dto/payment-scheduling.dto';

const BATCH_INCLUDE = {
  company: { select: { id: true, legalName: true, tradeName: true } },
  financialAccount: {
    select: {
      id: true,
      name: true,
      displayName: true,
      status: true,
      financialInstitution: {
        select: { id: true, shortName: true, legalName: true },
      },
    },
  },
  financialInstitution: {
    select: { id: true, shortName: true, legalName: true },
  },
} satisfies Prisma.PaymentBatchInclude;

/** Situações em que o conteúdo do lote ainda pode mudar. */
const MUTABLE_BATCH_STATUSES: PaymentBatchStatus[] = [PaymentBatchStatus.OPEN];

/**
 * Lotes de pagamento.
 *
 * Um lote agrupa programações de **uma empresa, uma conta e uma data**. A restrição não é
 * burocracia: o arquivo de remessa é por convênio bancário, que é por conta. Um lote misto
 * só descobriria o problema na hora de gerar o arquivo, depois de tudo conferido e
 * aprovado.
 *
 * Este módulo **não gera remessa**. As colunas do arquivo existem na tabela para que a
 * execução bancária, quando existir, só preencha — sem migração nem refatoração.
 */
@Injectable()
export class PaymentBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly schedules: PaymentSchedulesService,
    private readonly balances: AccountBalanceService,
  ) {}

  async scopeOf(id: string) {
    return this.prisma.paymentBatch.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true, status: true },
    });
  }

  async findAll(query: PaymentBatchQueryDto) {
    const where: Prisma.PaymentBatchWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
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
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.paymentBatch.findMany({
        where,
        include: BATCH_INCLUDE,
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.paymentBatch.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const batch = await this.prisma.paymentBatch.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        ...BATCH_INCLUDE,
        items: {
          orderBy: { sequence: 'asc' },
          include: {
            schedule: {
              include: {
                payable: {
                  select: {
                    id: true,
                    code: true,
                    documentNumber: true,
                    description: true,
                    supplier: {
                      select: { id: true, legalName: true, tradeName: true },
                    },
                  },
                },
              },
            },
          },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    // A posição da conta na data do lote responde a pergunta que quem confere faz: "o
    // dinheiro está lá?".
    const balance = await this.balances.check({
      accountId: batch.financialAccountId,
      referenceDate: batch.scheduledDate,
      amount: 0,
    });

    const blocked = batch.items.filter(
      (item) => item.schedule.blockedAt !== null,
    ).length;

    return {
      ...batch,
      balance,
      blockedCount: blocked,
      /** Um lote com programação bloqueada não pode ser fechado. */
      readyToClose: blocked === 0 && batch.items.length > 0,
    };
  }

  // ── Criação e alteração ───────────────────────────────────────────────────

  async create(dto: CreatePaymentBatchDto, actor: RequestActor) {
    const account = await this.prisma.financialAccount.findFirstOrThrow({
      where: { id: dto.financialAccountId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        status: true,
        financialInstitutionId: true,
      },
    });

    if (account.companyId !== dto.companyId) {
      throw new BadRequestException(
        'A conta informada pertence a outra empresa.',
      );
    }

    const settings = await this.schedules.settingsFor(
      dto.organizationId,
      dto.companyId,
    );

    const code = await this.nextBatchCode(dto.companyId, settings.batchPrefix);

    const batch = await this.prisma.paymentBatch.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        code,
        name: dto.name,
        financialAccountId: dto.financialAccountId,
        financialInstitutionId: account.financialInstitutionId,
        bankPaymentType: dto.bankPaymentType,
        scheduledDate: new Date(dto.scheduledDate),
        responsibleUserId: dto.responsibleUserId ?? actor.id,
        notes: dto.notes,
        createdBy: actor.id,
        history: {
          create: {
            action: PaymentScheduleHistoryAction.BATCH_CREATED,
            newValue: code,
            actorId: actor.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        },
      },
    });

    if (dto.scheduleIds?.length) {
      await this.addSchedules(
        batch.id,
        { scheduleIds: dto.scheduleIds },
        actor,
      );
    }

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'payment_schedule.batch_created',
      entity: 'PaymentBatch',
      entityId: batch.id,
      newValue: {
        code,
        financialAccountId: dto.financialAccountId,
        scheduledDate: dto.scheduledDate,
        schedules: dto.scheduleIds?.length ?? 0,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(batch.id);
  }

  async update(id: string, dto: UpdatePaymentBatchDto, actor: RequestActor) {
    const batch = await this.prisma.paymentBatch.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { items: { include: { schedule: true } } },
    });

    if (
      batch.status === PaymentBatchStatus.SENT ||
      batch.status === PaymentBatchStatus.EXECUTED
    ) {
      throw new BadRequestException(
        'Este lote já foi enviado ao banco e não pode mais ser alterado.',
      );
    }

    if (dto.status) {
      await this.assertTransition(batch, dto.status);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentBatch.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.scheduledDate
            ? { scheduledDate: new Date(dto.scheduledDate) }
            : {}),
          ...(dto.responsibleUserId
            ? { responsibleUserId: dto.responsibleUserId }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.status === PaymentBatchStatus.READY_TO_SEND
            ? { closedBy: actor.id, closedAt: new Date() }
            : {}),
          ...(dto.status === PaymentBatchStatus.CANCELLED
            ? {
                cancellationReason: dto.reason,
                cancelledBy: actor.id,
                cancelledAt: new Date(),
              }
            : {}),
          updatedBy: actor.id,
        },
      });

      // Fechar o lote leva as programações junto: é isso que a execução bancária vai ler.
      if (dto.status === PaymentBatchStatus.READY_TO_SEND) {
        await tx.paymentSchedule.updateMany({
          where: { batchId: id, status: PaymentScheduleStatus.IN_BATCH },
          data: { status: PaymentScheduleStatus.READY_TO_SEND },
        });
      }

      // Cancelar o lote devolve as programações à fila, sem cancelá-las: o pagamento
      // continua devido, só não sai neste lote.
      if (dto.status === PaymentBatchStatus.CANCELLED) {
        await tx.paymentSchedule.updateMany({
          where: {
            batchId: id,
            status: {
              in: [
                PaymentScheduleStatus.IN_BATCH,
                PaymentScheduleStatus.READY_TO_SEND,
              ],
            },
          },
          data: { batchId: null, status: PaymentScheduleStatus.SCHEDULED },
        });

        await tx.paymentBatchItem.deleteMany({ where: { batchId: id } });
      }

      // Mudar a data do lote muda a data das programações — senão o lote diria uma coisa
      // e a remessa outra.
      if (dto.scheduledDate) {
        await tx.paymentSchedule.updateMany({
          where: {
            batchId: id,
            status: { not: PaymentScheduleStatus.CANCELLED },
          },
          data: { scheduledDate: new Date(dto.scheduledDate) },
        });
      }

      await tx.paymentScheduleHistory.create({
        data: {
          batchId: id,
          action:
            dto.status === PaymentBatchStatus.CANCELLED
              ? PaymentScheduleHistoryAction.BATCH_CANCELLED
              : dto.status === PaymentBatchStatus.READY_TO_SEND
                ? PaymentScheduleHistoryAction.READY_TO_SEND
                : PaymentScheduleHistoryAction.BATCH_UPDATED,
          field: dto.status
            ? 'status'
            : dto.scheduledDate
              ? 'scheduledDate'
              : null,
          previousValue: dto.status
            ? batch.status
            : batch.scheduledDate
              ? isoDate(batch.scheduledDate)
              : null,
          newValue: dto.status ?? dto.scheduledDate ?? null,
          reason: dto.reason,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.schedules.recomputeBatch(id);

    await this.audit.log({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      userId: actor.id,
      action: 'payment_schedule.batch_updated',
      entity: 'PaymentBatch',
      entityId: id,
      oldValue: {
        status: batch.status,
        scheduledDate: isoDate(batch.scheduledDate),
      },
      newValue: { status: dto.status, scheduledDate: dto.scheduledDate },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    void updated;
    return this.findOne(id);
  }

  // ── Composição do lote ────────────────────────────────────────────────────

  /**
   * Inclui programações no lote.
   *
   * Cada uma é conferida contra a empresa e a conta do lote. Uma programação de outra conta
   * entrando no lote produziria um arquivo que o banco recusa — e a recusa chegaria depois
   * de o lote ter sido aprovado por alguém.
   */
  async addSchedules(id: string, dto: BatchMembershipDto, actor: RequestActor) {
    const batch = await this.prisma.paymentBatch.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!MUTABLE_BATCH_STATUSES.includes(batch.status)) {
      throw new BadRequestException(
        'Este lote já foi fechado. Reabra-o ou crie outro para incluir programações.',
      );
    }

    const schedules = await this.prisma.paymentSchedule.findMany({
      where: { id: { in: dto.scheduleIds }, deletedAt: null },
    });

    const rejected: { scheduleId: string; reason: string }[] = [];
    const accepted = schedules.filter((schedule) => {
      if (schedule.companyId !== batch.companyId) {
        rejected.push({
          scheduleId: schedule.id,
          reason: 'Pertence a outra empresa.',
        });
        return false;
      }
      if (schedule.blockedAt) {
        rejected.push({
          scheduleId: schedule.id,
          reason: 'Programação bloqueada.',
        });
        return false;
      }
      if (schedule.status === PaymentScheduleStatus.CANCELLED) {
        rejected.push({
          scheduleId: schedule.id,
          reason: 'Programação cancelada.',
        });
        return false;
      }
      if (schedule.batchId && schedule.batchId !== batch.id) {
        rejected.push({
          scheduleId: schedule.id,
          reason: 'Já está em outro lote.',
        });
        return false;
      }
      if (
        schedule.financialAccountId &&
        schedule.financialAccountId !== batch.financialAccountId
      ) {
        rejected.push({
          scheduleId: schedule.id,
          reason: 'A conta de origem é diferente da conta do lote.',
        });
        return false;
      }
      return true;
    });

    const missing = dto.scheduleIds.filter(
      (scheduleId) => !schedules.some((schedule) => schedule.id === scheduleId),
    );
    for (const scheduleId of missing) {
      rejected.push({ scheduleId, reason: 'Programação não encontrada.' });
    }

    if (accepted.length > 0) {
      let sequence = batch.items.length;

      await this.prisma.$transaction(async (tx) => {
        for (const schedule of accepted) {
          sequence += 1;

          await tx.paymentBatchItem.upsert({
            where: {
              batchId_scheduleId: { batchId: id, scheduleId: schedule.id },
            },
            create: {
              batchId: id,
              scheduleId: schedule.id,
              sequence,
              amount: schedule.totalAmount,
            },
            update: { amount: schedule.totalAmount },
          });

          await tx.paymentSchedule.update({
            where: { id: schedule.id },
            data: {
              batchId: id,
              status: PaymentScheduleStatus.IN_BATCH,
              financialAccountId: batch.financialAccountId,
              scheduledDate: batch.scheduledDate,
              updatedBy: actor.id,
            },
          });

          await tx.paymentScheduleHistory.create({
            data: {
              scheduleId: schedule.id,
              batchId: id,
              action: PaymentScheduleHistoryAction.ADDED_TO_BATCH,
              previousStatus: schedule.status,
              newStatus: PaymentScheduleStatus.IN_BATCH,
              newValue: batch.code,
              actorId: actor.id,
              ipAddress: actor.ipAddress,
              userAgent: actor.userAgent,
            },
          });
        }
      });

      await this.schedules.recomputeBatch(id);
    }

    await this.audit.log({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      userId: actor.id,
      action: 'payment_schedule.batch_updated',
      entity: 'PaymentBatch',
      entityId: id,
      newValue: { added: accepted.length, rejected: rejected.length },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return {
      added: accepted.length,
      rejected,
      batch: await this.findOne(id),
    };
  }

  async removeSchedules(
    id: string,
    dto: BatchMembershipDto,
    actor: RequestActor,
  ) {
    const batch = await this.prisma.paymentBatch.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (!MUTABLE_BATCH_STATUSES.includes(batch.status)) {
      throw new BadRequestException(
        'Este lote já foi fechado. Reabra-o para alterar o conteúdo.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentBatchItem.deleteMany({
        where: { batchId: id, scheduleId: { in: dto.scheduleIds } },
      });

      await tx.paymentSchedule.updateMany({
        where: { id: { in: dto.scheduleIds }, batchId: id },
        data: {
          batchId: null,
          status: PaymentScheduleStatus.SCHEDULED,
          updatedBy: actor.id,
        },
      });

      for (const scheduleId of dto.scheduleIds) {
        await tx.paymentScheduleHistory.create({
          data: {
            scheduleId,
            batchId: id,
            action: PaymentScheduleHistoryAction.REMOVED_FROM_BATCH,
            previousStatus: PaymentScheduleStatus.IN_BATCH,
            newStatus: PaymentScheduleStatus.SCHEDULED,
            previousValue: batch.code,
            actorId: actor.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
      }
    });

    await this.schedules.recomputeBatch(id);

    return this.findOne(id);
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /**
   * Recusa transições que produziriam um lote inconsistente.
   *
   * Fechar um lote vazio ou com programação bloqueada é o erro que só aparece na remessa,
   * quando já é tarde.
   */
  private async assertTransition(
    batch: {
      id: string;
      status: PaymentBatchStatus;
      items: { schedule: { blockedAt: Date | null } }[];
      financialAccountId: string;
      scheduledDate: Date;
      totalAmount: Prisma.Decimal;
    },
    next: PaymentBatchStatus,
  ) {
    if (next === PaymentBatchStatus.READY_TO_SEND) {
      if (batch.items.length === 0) {
        throw new BadRequestException('Um lote vazio não pode ser fechado.');
      }

      const blocked = batch.items.filter(
        (item) => item.schedule.blockedAt !== null,
      ).length;

      if (blocked > 0) {
        throw new BadRequestException(
          `Há ${blocked} programação(ões) bloqueada(s) neste lote. Libere ou remova antes de fechar.`,
        );
      }

      const account = await this.prisma.financialAccount.findUniqueOrThrow({
        where: { id: batch.financialAccountId },
        select: { status: true },
      });

      if (account.status !== 'ACTIVE') {
        throw new BadRequestException(
          'A conta de origem não está ativa. Fechar o lote agora produziria uma remessa inválida.',
        );
      }
    }

    if (
      next === PaymentBatchStatus.SENT ||
      next === PaymentBatchStatus.EXECUTED
    ) {
      throw new BadRequestException(
        'Enviar e executar são do módulo de Execução Bancária, que ainda não existe.',
      );
    }
  }

  private async nextBatchCode(
    companyId: string,
    prefix: string,
  ): Promise<string> {
    const year = new Date().getUTCFullYear();
    const start = `${prefix}-${year}-`;

    const last = await this.prisma.paymentBatch.findFirst({
      where: { companyId, code: { startsWith: start } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const sequence = last ? Number(last.code.slice(start.length)) + 1 : 1;
    return `${start}${String(sequence).padStart(6, '0')}`;
  }
}

export { cents, fromCents };
