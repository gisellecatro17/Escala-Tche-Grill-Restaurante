import { Injectable } from '@nestjs/common';
import {
  AccountsPayableAdjustmentType,
  AccountsPayableEntryStatus,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  FinancialEntryWithholdingStatus,
  Prisma,
} from '@prisma/client';

import { cents, clampToZero, fromCents } from './money.util';

/**
 * Situações que descrevem uma decisão sobre o título e não o andamento do pagamento.
 * O recálculo não as sobrescreve: um título cancelado não volta a ficar "em aberto"
 * porque alguém estornou um pagamento antigo.
 */
const FROZEN_STATUSES: AccountsPayableStatus[] = [
  AccountsPayableStatus.CANCELLED,
  AccountsPayableStatus.RENEGOTIATED,
];

const FROZEN_INSTALLMENT_STATUSES: AccountsPayableInstallmentStatus[] = [
  AccountsPayableInstallmentStatus.CANCELLED,
  AccountsPayableInstallmentStatus.RENEGOTIATED,
];

/**
 * Situações escritas pelo módulo de Agendamento Bancário, que ainda não existe.
 *
 * O recálculo as preserva enquanto não houver pagamento: quando aquele módulo chegar, ele
 * escreve `BANK_SCHEDULED` e este serviço não precisa mudar uma linha para respeitá-lo.
 */
const BANK_STAGE_STATUSES: AccountsPayableStatus[] = [
  AccountsPayableStatus.BANK_SCHEDULED,
  AccountsPayableStatus.AWAITING_PAYMENT,
];

/**
 * O motor de saldo do módulo (critério de aceite 7).
 *
 * **Nenhum valor derivado é escrito por quem chama.** Pagamentos, ajustes, retenções e
 * adiantamentos criam suas próprias linhas; o saldo do título e das parcelas é sempre o
 * resultado de reler essas linhas e somá-las. É o que impede a classe de defeito mais cara
 * de contas a pagar: dois caminhos de código atualizando o mesmo saldo com regras
 * ligeiramente diferentes.
 */
@Injectable()
export class PayableBalanceService {
  /**
   * Recalcula parcelas e título a partir das linhas gravadas e devolve o título atualizado.
   *
   * Recebe a transação porque nunca deve rodar fora de uma: entre gravar o pagamento e
   * recalcular o saldo não pode existir um instante em que alguém leia o título com um
   * pagamento a mais e o saldo antigo.
   */
  async recompute(tx: Prisma.TransactionClient, payableId: string) {
    const payable = await tx.accountsPayable.findUniqueOrThrow({
      where: { id: payableId },
      include: {
        installments: { orderBy: { installmentNumber: 'asc' } },
        adjustments: { where: { status: AccountsPayableEntryStatus.ACTIVE } },
        partialPayments: {
          where: { status: AccountsPayableEntryStatus.ACTIVE },
        },
        advanceUses: { where: { status: AccountsPayableEntryStatus.ACTIVE } },
        withholdings: {
          where: { status: FinancialEntryWithholdingStatus.CONFIRMED },
        },
      },
    });

    const live = payable.installments.filter(
      (installment) =>
        !FROZEN_INSTALLMENT_STATUSES.includes(installment.status) &&
        installment.status !== AccountsPayableInstallmentStatus.REVERSED,
    );

    // Ajustes, pagamentos e adiantamentos sem parcela valem para o título inteiro e são
    // rateados entre as parcelas vivas — senão um desconto no título não apareceria em
    // parcela nenhuma e o saldo do título discordaria da soma das suas parcelas.
    const headerBuckets = this.headerBuckets(payable, live);

    let totals = {
      original: 0,
      interest: 0,
      penalty: 0,
      discount: 0,
      withholding: 0,
      net: 0,
      paid: 0,
      advance: 0,
      balance: 0,
    };

    /** Vencimentos ainda devendo, na ordem — o primeiro vira o vencimento do título. */
    const openDueDates: Date[] = [];

    for (const installment of live) {
      const bucket = headerBuckets.get(installment.id) ?? {
        interest: 0,
        penalty: 0,
        discount: 0,
        withholding: 0,
        paid: 0,
        advance: 0,
      };

      const interest =
        bucket.interest +
        this.adjustmentCents(
          payable.adjustments,
          installment.id,
          AccountsPayableAdjustmentType.INTEREST,
        );
      const penalty =
        bucket.penalty +
        this.adjustmentCents(
          payable.adjustments,
          installment.id,
          AccountsPayableAdjustmentType.PENALTY,
        );
      const discount =
        bucket.discount +
        this.adjustmentCents(
          payable.adjustments,
          installment.id,
          AccountsPayableAdjustmentType.DISCOUNT,
        );
      const correction = this.adjustmentCents(
        payable.adjustments,
        installment.id,
        AccountsPayableAdjustmentType.CORRECTION,
      );

      const paid =
        bucket.paid +
        payable.partialPayments
          .filter((payment) => payment.installmentId === installment.id)
          .reduce((total, payment) => total + cents(payment.amount), 0);

      const advance =
        bucket.advance +
        payable.advanceUses
          .filter((use) => use.installmentId === installment.id)
          .reduce((total, use) => total + cents(use.amount), 0);

      const original = cents(installment.originalAmount) + correction;
      const withholding = bucket.withholding;
      const net = original + interest + penalty - discount - withholding;
      const balance = clampToZero(net - paid - advance);

      totals = {
        original: totals.original + original,
        interest: totals.interest + interest,
        penalty: totals.penalty + penalty,
        discount: totals.discount + discount,
        withholding: totals.withholding + withholding,
        net: totals.net + net,
        paid: totals.paid + paid,
        advance: totals.advance + advance,
        balance: totals.balance + balance,
      };

      if (balance > 0) openDueDates.push(installment.dueDate);

      await tx.accountsPayableInstallment.update({
        where: { id: installment.id },
        data: {
          interestAmount: fromCents(interest),
          penaltyAmount: fromCents(penalty),
          discountAmount: fromCents(discount),
          withholdingAmount: fromCents(withholding),
          netAmount: fromCents(net),
          paidAmount: fromCents(paid),
          advanceAmount: fromCents(advance),
          balanceAmount: fromCents(balance),
          status: this.installmentStatusOf(
            installment,
            balance,
            paid + advance,
          ),
          paidAt:
            balance === 0 && paid + advance > 0
              ? (installment.paidAt ??
                this.lastPaymentDate(payable, installment.id))
              : null,
        },
      });
    }

    openDueDates.sort((left, right) => left.getTime() - right.getTime());

    // Título quitado mantém o último vencimento: zerar a data faria o histórico perder
    // quando aquela obrigação venceu.
    const lastDueDate = live
      .map((installment) => installment.dueDate)
      .sort((left, right) => right.getTime() - left.getTime())[0];

    const status = this.payableStatusOf(
      payable,
      totals.balance,
      totals.paid + totals.advance,
    );

    return tx.accountsPayable.update({
      where: { id: payableId },
      data: {
        originalAmount: fromCents(totals.original),
        interestAmount: fromCents(totals.interest),
        penaltyAmount: fromCents(totals.penalty),
        discountAmount: fromCents(totals.discount),
        withholdingAmount: fromCents(totals.withholding),
        netAmount: fromCents(totals.net),
        paidAmount: fromCents(totals.paid),
        advanceAmount: fromCents(totals.advance),
        balanceAmount: fromCents(totals.balance),
        status,
        dueDate: openDueDates[0] ?? lastDueDate ?? payable.dueDate,
        paidAt:
          status === AccountsPayableStatus.PAID
            ? (payable.paidAt ?? new Date())
            : null,
      },
    });
  }

  /**
   * Rateia entre as parcelas vivas o que foi lançado no título sem apontar parcela.
   *
   * Retenções são o caso normal: elas incidem sobre o título e precisam reduzir o saldo de
   * cada parcela proporcionalmente, senão a soma das parcelas não bate com o líquido.
   */
  private headerBuckets(
    payable: {
      adjustments: {
        installmentId: string | null;
        type: AccountsPayableAdjustmentType;
        amount: Prisma.Decimal;
      }[];
      partialPayments: {
        installmentId: string | null;
        amount: Prisma.Decimal;
      }[];
      advanceUses: { installmentId: string | null; amount: Prisma.Decimal }[];
      withholdings: { amount: Prisma.Decimal }[];
    },
    live: { id: string; originalAmount: Prisma.Decimal }[],
  ) {
    const buckets = new Map<
      string,
      {
        interest: number;
        penalty: number;
        discount: number;
        withholding: number;
        paid: number;
        advance: number;
      }
    >();

    for (const installment of live) {
      buckets.set(installment.id, {
        interest: 0,
        penalty: 0,
        discount: 0,
        withholding: 0,
        paid: 0,
        advance: 0,
      });
    }

    if (live.length === 0) return buckets;

    const weights = live.map((installment) =>
      cents(installment.originalAmount),
    );
    const weightTotal = weights.reduce((total, weight) => total + weight, 0);

    const spread = (
      total: number,
      apply: (id: string, part: number) => void,
    ) => {
      if (total === 0) return;

      let distributed = 0;

      live.forEach((installment, index) => {
        const isLast = index === live.length - 1;
        const part = isLast
          ? total - distributed
          : weightTotal === 0
            ? Math.floor(total / live.length)
            : Math.floor((total * weights[index]) / weightTotal);

        distributed += part;
        apply(installment.id, part);
      });
    };

    const headerAdjustments = (type: AccountsPayableAdjustmentType) =>
      payable.adjustments
        .filter((item) => item.installmentId === null && item.type === type)
        .reduce((total, item) => total + cents(item.amount), 0);

    spread(
      headerAdjustments(AccountsPayableAdjustmentType.INTEREST),
      (id, part) => {
        const bucket = buckets.get(id);
        if (bucket) bucket.interest += part;
      },
    );
    spread(
      headerAdjustments(AccountsPayableAdjustmentType.PENALTY),
      (id, part) => {
        const bucket = buckets.get(id);
        if (bucket) bucket.penalty += part;
      },
    );
    spread(
      headerAdjustments(AccountsPayableAdjustmentType.DISCOUNT),
      (id, part) => {
        const bucket = buckets.get(id);
        if (bucket) bucket.discount += part;
      },
    );

    spread(
      payable.withholdings.reduce(
        (total, item) => total + cents(item.amount),
        0,
      ),
      (id, part) => {
        const bucket = buckets.get(id);
        if (bucket) bucket.withholding += part;
      },
    );

    spread(
      payable.partialPayments
        .filter((payment) => payment.installmentId === null)
        .reduce((total, payment) => total + cents(payment.amount), 0),
      (id, part) => {
        const bucket = buckets.get(id);
        if (bucket) bucket.paid += part;
      },
    );

    spread(
      payable.advanceUses
        .filter((use) => use.installmentId === null)
        .reduce((total, use) => total + cents(use.amount), 0),
      (id, part) => {
        const bucket = buckets.get(id);
        if (bucket) bucket.advance += part;
      },
    );

    return buckets;
  }

  private adjustmentCents(
    adjustments: {
      installmentId: string | null;
      type: AccountsPayableAdjustmentType;
      amount: Prisma.Decimal;
    }[],
    installmentId: string,
    type: AccountsPayableAdjustmentType,
  ): number {
    return adjustments
      .filter(
        (item) => item.installmentId === installmentId && item.type === type,
      )
      .reduce((total, item) => total + cents(item.amount), 0);
  }

  private lastPaymentDate(
    payable: {
      partialPayments: { installmentId: string | null; paidAt: Date }[];
    },
    installmentId: string,
  ): Date | null {
    const dates = payable.partialPayments
      .filter((payment) => payment.installmentId === installmentId)
      .map((payment) => payment.paidAt)
      .sort((left, right) => right.getTime() - left.getTime());

    return dates[0] ?? null;
  }

  private installmentStatusOf(
    installment: {
      status: AccountsPayableInstallmentStatus;
      scheduledPaymentDate: Date | null;
    },
    balance: number,
    settled: number,
  ): AccountsPayableInstallmentStatus {
    if (FROZEN_INSTALLMENT_STATUSES.includes(installment.status)) {
      return installment.status;
    }

    if (balance === 0 && settled > 0)
      return AccountsPayableInstallmentStatus.PAID;
    if (settled > 0) return AccountsPayableInstallmentStatus.PARTIALLY_PAID;

    if (
      installment.status === AccountsPayableInstallmentStatus.BANK_SCHEDULED ||
      installment.status === AccountsPayableInstallmentStatus.AWAITING_PAYMENT
    ) {
      return installment.status;
    }

    return installment.scheduledPaymentDate
      ? AccountsPayableInstallmentStatus.SCHEDULED
      : AccountsPayableInstallmentStatus.OPEN;
  }

  private payableStatusOf(
    payable: {
      status: AccountsPayableStatus;
      scheduledPaymentDate: Date | null;
    },
    balance: number,
    settled: number,
  ): AccountsPayableStatus {
    if (FROZEN_STATUSES.includes(payable.status)) return payable.status;

    if (balance === 0 && settled > 0) return AccountsPayableStatus.PAID;
    if (settled > 0) return AccountsPayableStatus.PARTIALLY_PAID;

    // Sem pagamento nenhum: um título estornado volta a dever e reaparece em aberto.
    if (payable.status === AccountsPayableStatus.REVERSED) {
      return AccountsPayableStatus.REVERSED;
    }

    if (BANK_STAGE_STATUSES.includes(payable.status)) return payable.status;

    return payable.scheduledPaymentDate
      ? AccountsPayableStatus.SCHEDULED
      : AccountsPayableStatus.OPEN;
  }
}
