import { Injectable } from '@nestjs/common';
import {
  AccountsPayableInstallmentStatus,
  BankStatementImportStatus,
  BankTransactionDirection,
  BankTransactionReconciliationStatus,
  MatchSuggestionStatus,
  PaymentScheduleStatus,
  Prisma,
  ReconciliationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { cents, fromCents, sum } from '../accounts-payable/money.util';
import type { DashboardQueryDto } from './dto/reconciliation.dto';

/** Situações que contam como conciliação concluída. */
const MATCHED_STATUSES: BankTransactionReconciliationStatus[] = [
  BankTransactionReconciliationStatus.MATCHED,
  BankTransactionReconciliationStatus.MANUALLY_MATCHED,
];

/** Situações que ainda ocupam a fila de trabalho. */
const PENDING_STATUSES: BankTransactionReconciliationStatus[] = [
  BankTransactionReconciliationStatus.IMPORTED,
  BankTransactionReconciliationStatus.AVAILABLE,
  BankTransactionReconciliationStatus.MATCH_SUGGESTED,
  BankTransactionReconciliationStatus.PARTIALLY_MATCHED,
  BankTransactionReconciliationStatus.UNIDENTIFIED,
];

/**
 * Painel da conciliação (seções 24 a 26 e 44).
 *
 * Todos os números saem das mesmas tabelas em que a conciliação acontece — nada é
 * pré-calculado nem guardado em coluna de resumo. Um contador materializado erra em
 * silêncio no dia em que alguém desconcilia por caminho não previsto, e o painel passa a
 * mentir sem que nada acuse.
 */
@Injectable()
export class ReconciliationDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: DashboardQueryDto) {
    const period = this.periodOf(query);

    const where: Prisma.BankTransactionWhereInput = {
      deletedAt: null,
      organizationId: query.organizationId,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      transactionDate: { gte: period.from, lte: period.to },
    };

    const [
      totals,
      byStatus,
      byType,
      byDirection,
      pendingSuggestions,
      reconciliations,
      imports,
      duplicates,
      manuals,
      assignments,
    ] = await Promise.all([
      this.prisma.bankTransaction.aggregate({
        where,
        _count: { _all: true },
        _sum: { amount: true, reconciledAmount: true },
      }),
      this.prisma.bankTransaction.groupBy({
        by: ['reconciliationStatus'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { reconciliationStatus: 'asc' },
      }),
      this.prisma.bankTransaction.groupBy({
        by: ['transactionType'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { transactionType: 'asc' },
      }),
      this.prisma.bankTransaction.groupBy({
        by: ['direction'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { direction: 'asc' },
      }),
      this.prisma.reconciliationMatchSuggestion.groupBy({
        by: ['status'],
        where: {
          organizationId: query.organizationId,
          ...(query.companyId ? { companyId: query.companyId } : {}),
          createdAt: { gte: period.from, lte: period.to },
        },
        _count: { _all: true },
        _avg: { score: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.reconciliation.groupBy({
        by: ['reconciliationType'],
        where: {
          deletedAt: null,
          organizationId: query.organizationId,
          ...(query.companyId ? { companyId: query.companyId } : {}),
          ...(query.financialAccountId
            ? { financialAccountId: query.financialAccountId }
            : {}),
          status: ReconciliationStatus.ACTIVE,
          reconciledAt: { gte: period.from, lte: period.to },
        },
        _count: { _all: true },
        _sum: { totalBankAmount: true, differenceAmount: true },
        orderBy: { reconciliationType: 'asc' },
      }),
      this.prisma.bankStatementImport.groupBy({
        by: ['status'],
        where: {
          deletedAt: null,
          organizationId: query.organizationId,
          ...(query.companyId ? { companyId: query.companyId } : {}),
          ...(query.financialAccountId
            ? { financialAccountId: query.financialAccountId }
            : {}),
          createdAt: { gte: period.from, lte: period.to },
        },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.bankTransaction.count({
        where: { ...where, isDuplicate: true },
      }),
      this.prisma.bankTransaction.count({
        where: { ...where, isManual: true },
      }),
      this.prisma.reconciliationAssignment.findMany({
        where: {
          organizationId: query.organizationId,
          ...(query.companyId ? { companyId: query.companyId } : {}),
          status: 'OPEN',
        },
        select: { id: true, dueAt: true, assignedUserId: true },
      }),
    ]);

    const countOf = (statuses: BankTransactionReconciliationStatus[]) =>
      byStatus
        .filter((row) => statuses.includes(row.reconciliationStatus))
        .reduce((total, row) => total + row._count._all, 0);

    const amountOf = (statuses: BankTransactionReconciliationStatus[]) =>
      sum(
        byStatus
          .filter((row) => statuses.includes(row.reconciliationStatus))
          .map((row) => row._sum.amount),
      );

    const totalCount = totals._count._all;
    const totalAmount = Number(totals._sum.amount ?? 0);
    const matchedCount = countOf(MATCHED_STATUSES);
    const reconciledAmount = Number(totals._sum.reconciledAmount ?? 0);

    const [balances, averageDays] = await Promise.all([
      this.balances(query, period),
      this.averageDaysToReconcile(query, period),
    ]);

    const now = new Date();

    return {
      period: { from: period.from, to: period.to },

      // ── Cartões ─────────────────────────────────────────────────────────
      cards: {
        totalTransactions: totalCount,
        totalAmount,
        reconciledTransactions: matchedCount,
        reconciledAmount,
        pendingTransactions: countOf(PENDING_STATUSES),
        pendingAmount: amountOf(PENDING_STATUSES),
        unidentifiedTransactions: countOf([
          BankTransactionReconciliationStatus.UNIDENTIFIED,
        ]),
        partiallyMatchedTransactions: countOf([
          BankTransactionReconciliationStatus.PARTIALLY_MATCHED,
        ]),
        pendingSuggestions:
          pendingSuggestions.find(
            (row) => row.status === MatchSuggestionStatus.PENDING,
          )?._count._all ?? 0,
        openDifferences: sum(
          reconciliations.map((row) => row._sum.differenceAmount),
        ),
      },

      // ── Indicadores ─────────────────────────────────────────────────────
      indicators: {
        /** Percentual conciliado por quantidade — quantas linhas foram fechadas. */
        reconciliationRateByCount:
          totalCount === 0
            ? 0
            : Number(((matchedCount / totalCount) * 100).toFixed(2)),
        /**
         * Percentual por valor. Anda diferente do de quantidade quando sobram muitas
         * transações pequenas, e é justamente essa diferença que diz onde está o risco.
         */
        reconciliationRateByAmount:
          cents(totalAmount) === 0
            ? 0
            : Number(
                ((cents(reconciledAmount) / cents(totalAmount)) * 100).toFixed(
                  2,
                ),
              ),
        averageDaysToReconcile: averageDays,
        duplicateTransactions: duplicates,
        manualTransactions: manuals,
        openAssignments: assignments.length,
        overdueAssignments: assignments.filter(
          (item) => item.dueAt !== null && item.dueAt < now,
        ).length,
        acceptedSuggestions:
          pendingSuggestions.find(
            (row) => row.status === MatchSuggestionStatus.ACCEPTED,
          )?._count._all ?? 0,
        dismissedSuggestions:
          pendingSuggestions.find(
            (row) => row.status === MatchSuggestionStatus.DISMISSED,
          )?._count._all ?? 0,
        averageSuggestionScore: Number(
          (
            pendingSuggestions.find(
              (row) => row.status === MatchSuggestionStatus.ACCEPTED,
            )?._avg.score ?? 0
          ).toString(),
        ),
        creditAmount: sum(
          byDirection
            .filter((row) => row.direction === BankTransactionDirection.IN)
            .map((row) => row._sum.amount),
        ),
        debitAmount: sum(
          byDirection
            .filter((row) => row.direction === BankTransactionDirection.OUT)
            .map((row) => row._sum.amount),
        ),
      },

      byStatus: byStatus.map((row) => ({
        status: row.reconciliationStatus,
        count: row._count._all,
        amount: Number(row._sum.amount ?? 0),
      })),
      byType: byType.map((row) => ({
        transactionType: row.transactionType,
        count: row._count._all,
        amount: Number(row._sum.amount ?? 0),
      })),
      byReconciliationType: reconciliations.map((row) => ({
        reconciliationType: row.reconciliationType,
        count: row._count._all,
        amount: Number(row._sum.totalBankAmount ?? 0),
        difference: Number(row._sum.differenceAmount ?? 0),
      })),
      imports: imports.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      balances,
    };
  }

  /**
   * Saldo de cada conta segundo o extrato e segundo o Pulse.
   *
   * A diferença entre os dois é o indicador mais direto de que algo escapou: se o extrato
   * fecha e o sistema não, existe movimento que ninguém lançou — ou lançamento que o banco
   * nunca viu.
   */
  async balances(query: DashboardQueryDto, period?: { from: Date; to: Date }) {
    const window = period ?? this.periodOf(query);

    const accounts = await this.prisma.financialAccount.findMany({
      where: {
        deletedAt: null,
        organizationId: query.organizationId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.financialAccountId ? { id: query.financialAccountId } : {}),
      },
      select: { id: true, name: true, displayName: true, accountType: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      accounts.map(async (account) => {
        const [lastImport, movement, pending] = await Promise.all([
          this.prisma.bankStatementImport.findFirst({
            where: {
              financialAccountId: account.id,
              deletedAt: null,
              status: BankStatementImportStatus.IMPORTED,
            },
            orderBy: { statementEndDate: 'desc' },
            select: {
              id: true,
              statementEndDate: true,
              closingBalance: true,
              calculatedClosingBalance: true,
              importedAt: true,
            },
          }),
          this.prisma.bankTransaction.groupBy({
            by: ['direction'],
            where: {
              financialAccountId: account.id,
              deletedAt: null,
              transactionDate: { gte: window.from, lte: window.to },
              reconciliationStatus: {
                notIn: [
                  BankTransactionReconciliationStatus.CANCELLED,
                  BankTransactionReconciliationStatus.REVERSED,
                  BankTransactionReconciliationStatus.DUPLICATE,
                ],
              },
            },
            _sum: { amount: true },
            _count: { _all: true },
            orderBy: { direction: 'asc' },
          }),
          this.prisma.bankTransaction.aggregate({
            where: {
              financialAccountId: account.id,
              deletedAt: null,
              reconciliationStatus: { in: PENDING_STATUSES },
            },
            _count: { _all: true },
            _sum: { amount: true },
          }),
        ]);

        const credits = sum(
          movement
            .filter((row) => row.direction === BankTransactionDirection.IN)
            .map((row) => row._sum.amount),
        );
        const debits = sum(
          movement
            .filter((row) => row.direction === BankTransactionDirection.OUT)
            .map((row) => row._sum.amount),
        );

        return {
          account,
          lastImport,
          statementClosingBalance: lastImport
            ? Number(
                lastImport.closingBalance ??
                  lastImport.calculatedClosingBalance ??
                  0,
              )
            : null,
          periodCredits: credits,
          periodDebits: debits,
          periodNet: fromCents(cents(credits) - cents(debits)),
          pendingTransactions: pending._count._all,
          pendingAmount: Number(pending._sum.amount ?? 0),
        };
      }),
    );
  }

  /**
   * Movimentações do extrato que ninguém identificou (seção 39).
   *
   * A fila de triagem: dinheiro que entrou ou saiu do banco sem lançamento correspondente
   * no Pulse. É a lista mais importante do módulo — cada linha aqui é um buraco no
   * fechamento.
   */
  async unidentified(query: DashboardQueryDto) {
    const period = this.periodOf(query);

    return this.prisma.bankTransaction.findMany({
      where: {
        deletedAt: null,
        organizationId: query.organizationId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.financialAccountId
          ? { financialAccountId: query.financialAccountId }
          : {}),
        transactionDate: { gte: period.from, lte: period.to },
        reconciliationStatus: {
          in: [
            BankTransactionReconciliationStatus.UNIDENTIFIED,
            BankTransactionReconciliationStatus.AVAILABLE,
            BankTransactionReconciliationStatus.IMPORTED,
          ],
        },
      },
      select: {
        id: true,
        transactionDate: true,
        amount: true,
        direction: true,
        transactionType: true,
        originalDescription: true,
        documentNumber: true,
        reconciliationStatus: true,
        unidentifiedReason: true,
        assignedUserId: true,
        financialAccount: {
          select: { id: true, name: true, displayName: true },
        },
        _count: { select: { suggestions: true } },
      },
      orderBy: [{ transactionDate: 'desc' }, { amount: 'desc' }],
      take: 200,
    });
  }

  /**
   * O espelho da lista anterior: lançamentos do Pulse sem correspondência no extrato
   * (seção 41).
   *
   * Um pagamento registrado como pago que o banco nunca mostrou é tão grave quanto uma
   * saída bancária sem lançamento — e as duas listas juntas fecham a pergunta "o que está
   * fora do lugar?" pelos dois lados.
   */
  async withoutStatement(query: DashboardQueryDto) {
    const period = this.periodOf(query);

    const [installments, schedules] = await Promise.all([
      this.prisma.accountsPayableInstallment.findMany({
        where: {
          payable: {
            organizationId: query.organizationId,
            ...(query.companyId ? { companyId: query.companyId } : {}),
            deletedAt: null,
          },
          status: AccountsPayableInstallmentStatus.PAID,
          paidAt: { gte: period.from, lte: period.to },
        },
        include: {
          payable: {
            select: {
              id: true,
              code: true,
              description: true,
              financialAccountId: true,
              supplier: { select: { legalName: true, tradeName: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 300,
      }),
      this.prisma.paymentSchedule.findMany({
        where: {
          organizationId: query.organizationId,
          ...(query.companyId ? { companyId: query.companyId } : {}),
          deletedAt: null,
          status: {
            in: [PaymentScheduleStatus.SENT, PaymentScheduleStatus.EXECUTED],
          },
          scheduledDate: { gte: period.from, lte: period.to },
        },
        include: {
          payable: { select: { id: true, code: true, description: true } },
        },
        orderBy: { scheduledDate: 'desc' },
        take: 300,
      }),
    ]);

    const linked = await this.prisma.reconciliationItem.findMany({
      where: {
        entityId: {
          in: [
            ...installments.map((item) => item.id),
            ...schedules.map((item) => item.id),
          ],
        },
        reconciliation: {
          status: ReconciliationStatus.ACTIVE,
          deletedAt: null,
        },
      },
      select: { entityId: true },
    });

    const reconciled = new Set(linked.map((item) => item.entityId));

    return {
      installments: installments
        .filter((item) => !reconciled.has(item.id))
        .filter(
          (item) =>
            !query.financialAccountId ||
            (item.financialAccountId ?? item.payable.financialAccountId) ===
              query.financialAccountId,
        )
        .map((item) => ({
          entityType: 'ACCOUNTS_PAYABLE_INSTALLMENT' as const,
          entityId: item.id,
          code: item.payable.code,
          installmentNumber: item.installmentNumber,
          description: item.payable.description,
          supplierName:
            item.payable.supplier?.tradeName ??
            item.payable.supplier?.legalName ??
            null,
          amount: Number(item.paidAmount),
          referenceDate: item.paidAt,
        })),
      schedules: schedules
        .filter((item) => !reconciled.has(item.id))
        .filter(
          (item) =>
            !query.financialAccountId ||
            item.financialAccountId === query.financialAccountId,
        )
        .map((item) => ({
          entityType: 'PAYMENT_SCHEDULE' as const,
          entityId: item.id,
          code: item.code,
          payableCode: item.payable.code,
          description: item.payable.description,
          amount: Number(item.totalAmount),
          referenceDate: item.scheduledDate,
        })),
    };
  }

  /**
   * Prováveis transferências entre contas da própria empresa (seção 40).
   *
   * Detecção, não conciliação: a lista aponta os pares e alguém confirma. Fechar sozinho
   * seria fundir duas movimentações reais com base em coincidência de valor e data — e uma
   * transferência inventada some do fluxo de caixa duas vezes.
   */
  async transferCandidates(query: DashboardQueryDto) {
    const period = this.periodOf(query);

    const outgoing = await this.prisma.bankTransaction.findMany({
      where: {
        deletedAt: null,
        organizationId: query.organizationId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        direction: BankTransactionDirection.OUT,
        transactionDate: { gte: period.from, lte: period.to },
        reconciliationStatus: { in: PENDING_STATUSES },
      },
      include: {
        financialAccount: {
          select: { id: true, name: true, displayName: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: 300,
    });

    const incoming = await this.prisma.bankTransaction.findMany({
      where: {
        deletedAt: null,
        organizationId: query.organizationId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        direction: BankTransactionDirection.IN,
        transactionDate: { gte: period.from, lte: period.to },
        reconciliationStatus: { in: PENDING_STATUSES },
      },
      include: {
        financialAccount: {
          select: { id: true, name: true, displayName: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: 300,
    });

    const pairs: {
      outgoing: (typeof outgoing)[number];
      incoming: (typeof incoming)[number];
      differenceDays: number;
      differenceAmount: number;
    }[] = [];

    const used = new Set<string>();

    for (const debit of outgoing) {
      const match = incoming.find((credit) => {
        if (used.has(credit.id)) return false;
        if (credit.companyId !== debit.companyId) return false;
        if (credit.financialAccountId === debit.financialAccountId)
          return false;

        const days = Math.abs(
          Math.round(
            (credit.transactionDate.getTime() -
              debit.transactionDate.getTime()) /
              86_400_000,
          ),
        );

        // Dois dias de folga: transferência entre bancos diferentes costuma creditar no
        // dia seguinte, e exigir a mesma data perderia a maior parte dos casos reais.
        return days <= 2 && cents(credit.amount) === cents(debit.amount);
      });

      if (!match) continue;

      used.add(match.id);

      pairs.push({
        outgoing: debit,
        incoming: match,
        differenceDays: Math.abs(
          Math.round(
            (match.transactionDate.getTime() -
              debit.transactionDate.getTime()) /
              86_400_000,
          ),
        ),
        differenceAmount: fromCents(cents(debit.amount) - cents(match.amount)),
      });
    }

    return pairs;
  }

  /** Evolução diária: quanto entrou, quanto saiu e quanto foi conciliado por dia. */
  async timeline(query: DashboardQueryDto) {
    const period = this.periodOf(query);

    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        deletedAt: null,
        organizationId: query.organizationId,
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.financialAccountId
          ? { financialAccountId: query.financialAccountId }
          : {}),
        transactionDate: { gte: period.from, lte: period.to },
      },
      select: {
        transactionDate: true,
        direction: true,
        amount: true,
        reconciliationStatus: true,
      },
    });

    const days = new Map<
      string,
      {
        date: string;
        credits: number;
        debits: number;
        reconciled: number;
        total: number;
      }
    >();

    for (const transaction of transactions) {
      const key = transaction.transactionDate.toISOString().slice(0, 10);
      const day = days.get(key) ?? {
        date: key,
        credits: 0,
        debits: 0,
        reconciled: 0,
        total: 0,
      };

      const value = cents(transaction.amount);

      if (transaction.direction === BankTransactionDirection.IN) {
        day.credits += value;
      } else {
        day.debits += value;
      }

      day.total += 1;

      if (MATCHED_STATUSES.includes(transaction.reconciliationStatus)) {
        day.reconciled += 1;
      }

      days.set(key, day);
    }

    return [...days.values()]
      .map((day) => ({
        ...day,
        credits: fromCents(day.credits),
        debits: fromCents(day.debits),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /**
   * Dias médios entre a data bancária e a conciliação.
   *
   * Mede o atraso do trabalho, não o do banco: é o tempo que a movimentação passou parada
   * esperando alguém olhar.
   */
  private async averageDaysToReconcile(
    query: DashboardQueryDto,
    period: { from: Date; to: Date },
  ): Promise<number> {
    const items = await this.prisma.reconciliationItem.findMany({
      where: {
        reconciliation: {
          deletedAt: null,
          organizationId: query.organizationId,
          ...(query.companyId ? { companyId: query.companyId } : {}),
          ...(query.financialAccountId
            ? { financialAccountId: query.financialAccountId }
            : {}),
          status: ReconciliationStatus.ACTIVE,
          reconciledAt: { gte: period.from, lte: period.to },
        },
      },
      select: {
        reconciliation: { select: { reconciledAt: true } },
        bankTransaction: { select: { transactionDate: true } },
      },
      take: 2000,
    });

    if (items.length === 0) return 0;

    const totalDays = items.reduce((total, item) => {
      const days =
        (item.reconciliation.reconciledAt.getTime() -
          item.bankTransaction.transactionDate.getTime()) /
        86_400_000;

      return total + Math.max(0, days);
    }, 0);

    return Number((totalDays / items.length).toFixed(1));
  }

  /** Período consultado. Sem datas, o mês corrente. */
  private periodOf(query: DashboardQueryDto): { from: Date; to: Date } {
    const now = new Date();

    const from = query.from
      ? new Date(query.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const to = query.to
      ? new Date(query.to)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { from, to };
  }
}
