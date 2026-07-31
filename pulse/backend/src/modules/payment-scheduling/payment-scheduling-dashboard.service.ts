import { Injectable } from '@nestjs/common';
import {
  PaymentBatchStatus,
  PaymentSchedulePriority,
  PaymentScheduleStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AccountBalanceService } from './account-balance.service';
import { startOfDay } from './payment-schedules.service';

/** Programações que ainda vão consumir caixa. */
const LIVE_STATUSES: PaymentScheduleStatus[] = [
  PaymentScheduleStatus.SCHEDULED,
  PaymentScheduleStatus.IN_BATCH,
  PaymentScheduleStatus.READY_TO_SEND,
];

interface GroupRow {
  key: string | null;
  label: string;
  total: number;
  count: number;
}

/**
 * Os onze indicadores da seção 3.
 *
 * Bloqueados entram no painel mas **não** nos totais programados: dinheiro travado não vai
 * sair, e somá-lo faria o "valor programado para hoje" pedir um caixa que ninguém precisa
 * ter.
 */
@Injectable()
export class PaymentSchedulingDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: AccountBalanceService,
  ) {}

  async build(organizationId: string, companyId?: string) {
    const today = startOfDay(new Date());
    const endOfWeek = addDays(today, 7);
    const endOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );

    const scope: Prisma.PaymentScheduleWhereInput = {
      deletedAt: null,
      organizationId,
      ...(companyId ? { companyId } : {}),
    };

    const live: Prisma.PaymentScheduleWhereInput = {
      ...scope,
      status: { in: LIVE_STATUSES },
      blockedAt: null,
    };

    const [
      today_,
      week,
      month,
      pending,
      blocked,
      urgent,
      rescheduled,
      batchesAwaiting,
      batchesBlocked,
    ] = await Promise.all([
      this.sumOf({
        ...live,
        scheduledDate: { gte: today, lt: addDays(today, 1) },
      }),
      this.sumOf({ ...live, scheduledDate: { gte: today, lte: endOfWeek } }),
      this.sumOf({ ...live, scheduledDate: { gte: today, lte: endOfMonth } }),
      this.sumOf({
        ...scope,
        status: PaymentScheduleStatus.PENDING_SCHEDULING,
        blockedAt: null,
      }),
      this.sumOf({
        ...scope,
        status: { not: PaymentScheduleStatus.CANCELLED },
        NOT: { blockedAt: null },
      }),
      this.sumOf({
        ...live,
        priority: {
          in: [
            PaymentSchedulePriority.URGENT,
            PaymentSchedulePriority.CRITICAL,
          ],
        },
      }),
      this.sumOf({ ...live, rescheduleCount: { gt: 0 } }),
      this.batchTotals(organizationId, companyId, [
        PaymentBatchStatus.OPEN,
        PaymentBatchStatus.READY_TO_SEND,
      ]),
      this.blockedBatches(organizationId, companyId),
    ]);

    const [byCompany, byAccount, byPaymentType] = await Promise.all([
      this.groupBy(live, 'companyId'),
      this.groupBy(live, 'financialAccountId'),
      this.groupBy(live, 'bankPaymentType'),
    ]);

    // Saldo projetado por conta, na data de hoje — o indicador que fecha o painel.
    const accountPositions = companyId
      ? await this.balances.positionsOf(companyId, today)
      : [];

    return {
      generatedAt: new Date(),
      dueTodayTotal: today_.total,
      dueTodayCount: today_.count,
      dueThisWeekTotal: week.total,
      dueThisMonthTotal: month.total,
      pendingSchedulingTotal: pending.total,
      pendingSchedulingCount: pending.count,
      blockedTotal: blocked.total,
      blockedCount: blocked.count,
      urgentTotal: urgent.total,
      urgentCount: urgent.count,
      rescheduledTotal: rescheduled.total,
      rescheduledCount: rescheduled.count,
      batchesAwaitingCount: batchesAwaiting.count,
      batchesAwaitingTotal: batchesAwaiting.total,
      batchesBlockedCount: batchesBlocked,
      byCompany: await this.labelCompanies(byCompany),
      byFinancialAccount: await this.labelAccounts(byAccount),
      byPaymentType: byPaymentType.map((row) => ({
        ...row,
        label: row.key ?? 'Sem tipo definido',
      })),
      accountPositions,
    };
  }

  private async sumOf(where: Prisma.PaymentScheduleWhereInput) {
    const result = await this.prisma.paymentSchedule.aggregate({
      where,
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    return {
      total: Number(result._sum.totalAmount ?? 0),
      count: result._count._all,
    };
  }

  private async batchTotals(
    organizationId: string,
    companyId: string | undefined,
    statuses: PaymentBatchStatus[],
  ) {
    const result = await this.prisma.paymentBatch.aggregate({
      where: {
        deletedAt: null,
        organizationId,
        ...(companyId ? { companyId } : {}),
        status: { in: statuses },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    return {
      total: Number(result._sum.totalAmount ?? 0),
      count: result._count._all,
    };
  }

  /** Lotes com ao menos uma programação bloqueada — os que não podem ser fechados. */
  private async blockedBatches(
    organizationId: string,
    companyId: string | undefined,
  ) {
    return this.prisma.paymentBatch.count({
      where: {
        deletedAt: null,
        organizationId,
        ...(companyId ? { companyId } : {}),
        status: PaymentBatchStatus.OPEN,
        schedules: { some: { NOT: { blockedAt: null } } },
      },
    });
  }

  private async groupBy(
    where: Prisma.PaymentScheduleWhereInput,
    field: 'companyId' | 'financialAccountId' | 'bankPaymentType',
  ): Promise<GroupRow[]> {
    // Mesmo motivo do painel do Contas a Pagar: `by` e `orderBy` são literais casados
    // entre si, e um campo escolhido em tempo de execução não satisfaz o tipo.
    const groupBy = this.prisma.paymentSchedule.groupBy.bind(
      this.prisma.paymentSchedule,
    ) as unknown as (args: {
      by: string[];
      where: Prisma.PaymentScheduleWhereInput;
      _sum: { totalAmount: true };
      _count: { _all: true };
      orderBy: Record<string, 'asc'>;
    }) => Promise<
      ({
        _sum: { totalAmount: Prisma.Decimal | null };
        _count: { _all: number };
      } & Record<string, unknown>)[]
    >;

    const rows = await groupBy({
      by: [field],
      where,
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { [field]: 'asc' },
    });

    return rows
      .map((row) => ({
        key: row[field] as string | null,
        label: '',
        total: Number(row._sum.totalAmount ?? 0),
        count: row._count._all,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 20);
  }

  private async labelCompanies(rows: GroupRow[]) {
    const records = await this.prisma.company.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, legalName: true, tradeName: true },
    });

    return rows.map((row) => {
      const found = records.find((record) => record.id === row.key);
      return {
        ...row,
        label: found?.tradeName ?? found?.legalName ?? 'Sem empresa',
      };
    });
  }

  private async labelAccounts(rows: GroupRow[]) {
    const records = await this.prisma.financialAccount.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, name: true, displayName: true },
    });

    return rows.map((row) => {
      const found = records.find((record) => record.id === row.key);
      return {
        ...row,
        label: found?.displayName ?? found?.name ?? 'Sem conta definida',
      };
    });
  }
}

function ids(rows: GroupRow[]): string[] {
  return rows
    .map((row) => row.key)
    .filter((key): key is string => key !== null);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
