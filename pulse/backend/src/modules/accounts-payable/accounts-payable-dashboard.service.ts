import { Injectable } from '@nestjs/common';
import {
  AccountsPayableAdjustmentType,
  AccountsPayableEntryStatus,
  AccountsPayablePriority,
  AccountsPayableStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** Situações que já saíram da conta do que a empresa deve. */
const SETTLED: AccountsPayableStatus[] = [
  AccountsPayableStatus.PAID,
  AccountsPayableStatus.CANCELLED,
  AccountsPayableStatus.RENEGOTIATED,
];

interface GroupRow {
  key: string | null;
  label: string;
  total: number;
  count: number;
}

/**
 * Os dezenove indicadores da seção 3.
 *
 * Todos leem o **saldo**, não o valor original: o painel responde "quanto a empresa ainda
 * deve", e um título de R$ 10.000 com R$ 7.000 pagos pesa R$ 3.000. Somar o valor original
 * daria um número maior e errado — e é o número que alguém levaria para a reunião.
 */
@Injectable()
export class AccountsPayableDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async build(organizationId: string, companyId?: string) {
    const today = startOfDay(new Date());
    const endOfWeek = addDays(today, 7);
    const endOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );

    const scope: Prisma.AccountsPayableWhereInput = {
      deletedAt: null,
      organizationId,
      ...(companyId ? { companyId } : {}),
    };

    /** Títulos que ainda devem alguma coisa. */
    const openScope: Prisma.AccountsPayableWhereInput = {
      ...scope,
      status: { notIn: SETTLED },
      balanceAmount: { gt: 0 },
    };

    const [
      openCount,
      openTotal,
      overdue,
      dueToday,
      dueThisWeek,
      dueThisMonth,
      scheduled,
      blocked,
      urgent,
      charges,
    ] = await Promise.all([
      this.prisma.accountsPayable.count({ where: openScope }),
      this.sumOf(openScope),
      this.sumOf({ ...openScope, dueDate: { lt: today } }),
      this.sumOf({
        ...openScope,
        dueDate: { gte: today, lt: addDays(today, 1) },
      }),
      this.sumOf({ ...openScope, dueDate: { gte: today, lte: endOfWeek } }),
      this.sumOf({ ...openScope, dueDate: { gte: today, lte: endOfMonth } }),
      this.sumOf({ ...openScope, NOT: { scheduledPaymentDate: null } }),
      this.sumOf({ ...openScope, NOT: { blockedAt: null } }),
      this.sumOf({ ...openScope, priority: AccountsPayablePriority.URGENT }),
      this.chargeForecast(scope),
    ]);

    const [
      byCompany,
      bySupplier,
      byCategory,
      byCostCenter,
      byProject,
      byMethod,
      byAccount,
    ] = await Promise.all([
      this.groupBy(openScope, 'companyId'),
      this.groupBy(openScope, 'supplierId'),
      this.groupBy(openScope, 'categoryId'),
      this.groupBy(openScope, 'costCenterId'),
      this.groupBy(openScope, 'projectId'),
      this.groupBy(openScope, 'paymentMethodId'),
      this.groupBy(openScope, 'financialAccountId'),
    ]);

    return {
      generatedAt: new Date(),
      openCount,
      openTotal,
      overdueTotal: overdue,
      dueTodayTotal: dueToday,
      dueThisWeekTotal: dueThisWeek,
      dueThisMonthTotal: dueThisMonth,
      scheduledTotal: scheduled,
      blockedTotal: blocked,
      urgentTotal: urgent,
      forecastInterest: charges.interest,
      forecastPenalty: charges.penalty,
      forecastDiscount: charges.discount,
      byCompany: await this.labelCompanies(byCompany),
      bySupplier: await this.labelSuppliers(bySupplier),
      byCategory: await this.labelCategories(byCategory),
      byCostCenter: await this.labelCostCenters(byCostCenter),
      byProject: await this.labelProjects(byProject),
      byPaymentMethod: await this.labelPaymentMethods(byMethod),
      byFinancialAccount: await this.labelAccounts(byAccount),
    };
  }

  private async sumOf(
    where: Prisma.AccountsPayableWhereInput,
  ): Promise<number> {
    const result = await this.prisma.accountsPayable.aggregate({
      where,
      _sum: { balanceAmount: true },
    });

    return Number(result._sum.balanceAmount ?? 0);
  }

  /**
   * Juros, multa e desconto **já lançados** nos títulos ainda em aberto.
   *
   * "Previstos" aqui é o que está registrado e ainda não foi pago — não uma projeção de
   * mora futura. Projetar mora que ninguém aplicou daria um número que muda sozinho todo
   * dia; a projeção existe, mas mora na prévia de encargos do título, onde alguém decide.
   */
  private async chargeForecast(scope: Prisma.AccountsPayableWhereInput) {
    const rows = await this.prisma.accountsPayableAdjustment.groupBy({
      by: ['type'],
      where: {
        status: AccountsPayableEntryStatus.ACTIVE,
        payable: { ...scope, status: { notIn: SETTLED } },
      },
      _sum: { amount: true },
      orderBy: { type: 'asc' },
    });

    const totalOf = (type: AccountsPayableAdjustmentType) =>
      Number(rows.find((row) => row.type === type)?._sum.amount ?? 0);

    return {
      interest: totalOf(AccountsPayableAdjustmentType.INTEREST),
      penalty: totalOf(AccountsPayableAdjustmentType.PENALTY),
      discount: totalOf(AccountsPayableAdjustmentType.DISCOUNT),
    };
  }

  private async groupBy(
    where: Prisma.AccountsPayableWhereInput,
    field:
      | 'companyId'
      | 'supplierId'
      | 'categoryId'
      | 'costCenterId'
      | 'projectId'
      | 'paymentMethodId'
      | 'financialAccountId',
  ): Promise<GroupRow[]> {
    // O `groupBy` do Prisma tipa `by` e `orderBy` como literais casados entre si, e um
    // campo escolhido em tempo de execução não satisfaz esse casamento. O argumento é
    // montado uma vez e convertido aqui, em vez de repetir sete consultas quase iguais.
    const groupBy = this.prisma.accountsPayable.groupBy.bind(
      this.prisma.accountsPayable,
    ) as unknown as (args: {
      by: string[];
      where: Prisma.AccountsPayableWhereInput;
      _sum: { balanceAmount: true };
      _count: { _all: true };
      orderBy: Record<string, 'asc'>;
    }) => Promise<
      ({
        _sum: { balanceAmount: Prisma.Decimal | null };
        _count: { _all: number };
      } & Record<string, unknown>)[]
    >;

    const rows = await groupBy({
      by: [field],
      where,
      _sum: { balanceAmount: true },
      _count: { _all: true },
      orderBy: { [field]: 'asc' },
    });

    return rows
      .map((row) => ({
        key: row[field] as string | null,
        label: '',
        total: Number(row._sum.balanceAmount ?? 0),
        count: countOf(row),
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 20);
  }

  // ── Rótulos. Uma consulta por dimensão, não uma por linha. ─────────────────

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

  private async labelSuppliers(rows: GroupRow[]) {
    const records = await this.prisma.supplier.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, legalName: true, tradeName: true },
    });

    return rows.map((row) => {
      const found = records.find((record) => record.id === row.key);
      return {
        ...row,
        label: found?.tradeName ?? found?.legalName ?? 'Sem fornecedor',
      };
    });
  }

  private async labelCategories(rows: GroupRow[]) {
    const records = await this.prisma.financialCategory.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, name: true },
    });

    return rows.map((row) => ({
      ...row,
      label:
        records.find((record) => record.id === row.key)?.name ??
        'Sem categoria',
    }));
  }

  private async labelCostCenters(rows: GroupRow[]) {
    const records = await this.prisma.costCenter.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, name: true },
    });

    return rows.map((row) => ({
      ...row,
      label:
        records.find((record) => record.id === row.key)?.name ??
        'Sem centro de custo',
    }));
  }

  private async labelProjects(rows: GroupRow[]) {
    const records = await this.prisma.project.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, name: true },
    });

    return rows.map((row) => ({
      ...row,
      label:
        records.find((record) => record.id === row.key)?.name ?? 'Sem projeto',
    }));
  }

  private async labelPaymentMethods(rows: GroupRow[]) {
    const records = await this.prisma.paymentMethodCatalog.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, name: true },
    });

    return rows.map((row) => ({
      ...row,
      label:
        records.find((record) => record.id === row.key)?.name ??
        'Sem forma definida',
    }));
  }

  private async labelAccounts(rows: GroupRow[]) {
    const records = await this.prisma.financialAccount.findMany({
      where: { id: { in: ids(rows) } },
      select: { id: true, name: true },
    });

    return rows.map((row) => ({
      ...row,
      label:
        records.find((record) => record.id === row.key)?.name ??
        'Sem conta definida',
    }));
  }
}

function ids(rows: GroupRow[]): string[] {
  return rows
    .map((row) => row.key)
    .filter((key): key is string => key !== null);
}

/** `_count` do Prisma 7 é opcional no tipo mesmo quando pedido. */
function countOf(
  row: { _count?: { _all?: number } | true } | undefined,
): number {
  if (!row || row._count === undefined || row._count === true) return 0;
  return row._count._all ?? 0;
}

function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
