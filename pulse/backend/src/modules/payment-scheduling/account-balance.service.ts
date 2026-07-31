import { Injectable } from '@nestjs/common';
import {
  BankLimitType,
  FinancialAccountStatus,
  OpeningBalanceStatus,
  PaymentScheduleStatus,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { cents, fromCents } from '../accounts-payable/money.util';

/** Situações em que a programação ainda vai consumir dinheiro da conta. */
const COMMITTED_STATUSES: PaymentScheduleStatus[] = [
  PaymentScheduleStatus.SCHEDULED,
  PaymentScheduleStatus.IN_BATCH,
  PaymentScheduleStatus.READY_TO_SEND,
  PaymentScheduleStatus.SENT,
];

export interface AccountPosition {
  accountId: string;
  accountName: string;
  status: FinancialAccountStatus;
  /** Saldo de abertura mais recente aprovado até a data. */
  openingBalance: number;
  /** Parcela do saldo indisponível (bloqueio judicial, garantia, caução). */
  blockedBalance: number;
  /** Limites contratados ativos (cheque especial, capital de giro). */
  creditLimit: number;
  /** Abertura − bloqueado. O que existe hoje, sem contar limite. */
  availableBalance: number;
  /** Disponível + limite, quando a empresa manda considerar o limite. */
  spendingPower: number;
  /** Programado e ainda não pago até a data de referência. */
  committedAmount: number;
  /** Poder de gasto − comprometido. Negativo é déficit. */
  projectedBalance: number;
  /** Saldo mínimo recomendado, quando cadastrado. */
  minimumRecommendedBalance: number | null;
  /** `true` quando a conta não pode receber pagamento nenhum. */
  unavailable: boolean;
  unavailableReason: string | null;
}

/**
 * Posição financeira das contas para efeito de programação.
 *
 * **De onde vem o saldo.** O Pulse ainda não tem movimento bancário — nenhum módulo
 * registra entrada ou saída de dinheiro em conta. O saldo disponível é, portanto, o saldo
 * de abertura aprovado menos o que está bloqueado. Inventar um "saldo atual" a partir de
 * títulos pagos daria um número que ninguém consegue conferir com o extrato, e é
 * exatamente o tipo de número que alguém levaria para uma reunião.
 *
 * Quando a conciliação bancária existir, é este serviço que passa a ler o saldo real —
 * e nada mais no módulo muda.
 */
@Injectable()
export class AccountBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Posição de uma conta em uma data. */
  async positionOf(
    accountId: string,
    referenceDate: Date,
    options: { considerCreditLimits?: boolean; ignoreScheduleId?: string } = {},
  ): Promise<AccountPosition> {
    const account = await this.prisma.financialAccount.findFirstOrThrow({
      where: { id: accountId, deletedAt: null },
      select: {
        id: true,
        name: true,
        displayName: true,
        status: true,
        blockedBalance: true,
        minimumRecommendedBalance: true,
        allowsNegativeBalance: true,
      },
    });

    const [opening, limits, committed] = await Promise.all([
      this.prisma.financialAccountOpeningBalance.findFirst({
        where: {
          financialAccountId: accountId,
          status: OpeningBalanceStatus.APPROVED,
          balanceDate: { lte: referenceDate },
        },
        orderBy: { balanceDate: 'desc' },
        select: { balanceAmount: true },
      }),
      this.prisma.financialAccountLimit.findMany({
        where: {
          financialAccountId: accountId,
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          limitType: {
            in: [
              BankLimitType.OVERDRAFT,
              BankLimitType.GUARANTEED_ACCOUNT,
              BankLimitType.WORKING_CAPITAL,
              BankLimitType.REVOLVING,
            ],
          },
          OR: [{ endDate: null }, { endDate: { gte: referenceDate } }],
        },
        select: { contractedAmount: true },
      }),
      this.committedUpTo(accountId, referenceDate, options.ignoreScheduleId),
    ]);

    const openingBalance = cents(opening?.balanceAmount ?? 0);
    const blockedBalance = cents(account.blockedBalance ?? 0);
    const creditLimit = limits.reduce(
      (total, limit) => total + cents(limit.contractedAmount),
      0,
    );

    const availableBalance = openingBalance - blockedBalance;
    const spendingPower =
      availableBalance +
      (options.considerCreditLimits === false ? 0 : creditLimit);

    const unavailableReason = this.unavailableReasonOf(account.status);

    return {
      accountId: account.id,
      accountName: account.displayName ?? account.name,
      status: account.status,
      openingBalance: fromCents(openingBalance),
      blockedBalance: fromCents(blockedBalance),
      creditLimit: fromCents(creditLimit),
      availableBalance: fromCents(availableBalance),
      spendingPower: fromCents(spendingPower),
      committedAmount: fromCents(committed),
      projectedBalance: fromCents(spendingPower - committed),
      minimumRecommendedBalance:
        account.minimumRecommendedBalance === null
          ? null
          : Number(account.minimumRecommendedBalance),
      unavailable: unavailableReason !== null,
      unavailableReason,
    };
  }

  /**
   * Confere se a conta aguenta mais um desembolso na data.
   *
   * Devolve o diagnóstico em vez de lançar erro: quem decide se o déficit impede a
   * programação é o parâmetro da empresa, não este cálculo. Uma empresa que sabe que o
   * dinheiro entra na véspera não quer o sistema recusando a programação.
   */
  async check(input: {
    accountId: string;
    referenceDate: Date;
    amount: number;
    considerCreditLimits?: boolean;
    ignoreScheduleId?: string;
  }) {
    const position = await this.positionOf(
      input.accountId,
      input.referenceDate,
      {
        considerCreditLimits: input.considerCreditLimits,
        ignoreScheduleId: input.ignoreScheduleId,
      },
    );

    const after = cents(position.projectedBalance) - cents(input.amount);

    return {
      position,
      amount: input.amount,
      projectedAfter: fromCents(after),
      /** Falta dinheiro para este desembolso. */
      insufficient: after < 0,
      shortfall: after < 0 ? fromCents(Math.abs(after)) : 0,
      /** Passa do mínimo recomendado sem chegar a faltar dinheiro. */
      belowRecommended:
        position.minimumRecommendedBalance !== null &&
        after >= 0 &&
        after < cents(position.minimumRecommendedBalance),
      accountUnavailable: position.unavailable,
      accountUnavailableReason: position.unavailableReason,
    };
  }

  /** Posição de todas as contas ativas da empresa, para o painel e a simulação. */
  async positionsOf(
    companyId: string,
    referenceDate: Date,
    considerCreditLimits = true,
  ): Promise<AccountPosition[]> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: {
          in: [FinancialAccountStatus.ACTIVE, FinancialAccountStatus.BLOCKED],
        },
      },
      select: { id: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      accounts.map((account) =>
        this.positionOf(account.id, referenceDate, { considerCreditLimits }),
      ),
    );
  }

  /** Total já comprometido na conta até a data. */
  private async committedUpTo(
    accountId: string,
    referenceDate: Date,
    ignoreScheduleId?: string,
  ): Promise<number> {
    const where: Prisma.PaymentScheduleWhereInput = {
      financialAccountId: accountId,
      deletedAt: null,
      status: { in: COMMITTED_STATUSES },
      scheduledDate: { lte: referenceDate },
      // Bloqueado não sai — e portanto não compromete o caixa. Contá-lo faria o sistema
      // recusar programações por causa de dinheiro que ninguém vai gastar.
      blockedAt: null,
      ...(ignoreScheduleId ? { NOT: { id: ignoreScheduleId } } : {}),
    };

    const result = await this.prisma.paymentSchedule.aggregate({
      where,
      _sum: { totalAmount: true },
    });

    return cents(result._sum.totalAmount ?? 0);
  }

  private unavailableReasonOf(status: FinancialAccountStatus): string | null {
    switch (status) {
      case FinancialAccountStatus.ACTIVE:
        return null;
      case FinancialAccountStatus.BLOCKED:
        return 'A conta está bloqueada.';
      case FinancialAccountStatus.SUSPENDED:
        return 'A conta está suspensa.';
      case FinancialAccountStatus.INACTIVE:
        return 'A conta está inativa.';
      case FinancialAccountStatus.CLOSED:
        return 'A conta está encerrada.';
      case FinancialAccountStatus.DRAFT:
      case FinancialAccountStatus.PENDING_VALIDATION:
        return 'A conta ainda não foi ativada.';
      default:
        return 'A conta não está disponível para pagamento.';
    }
  }
}
