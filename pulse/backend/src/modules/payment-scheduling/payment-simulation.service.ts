import { Injectable } from '@nestjs/common';
import {
  PaymentBatchStatus,
  PaymentScheduleStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AccountBalanceService } from './account-balance.service';
import { cents, fromCents } from '../accounts-payable/money.util';
import { isoDate, startOfDay } from './payment-schedules.service';
import type { SimulationDto } from './dto/payment-scheduling.dto';

/** Programações que consomem caixa. */
const LIVE_STATUSES: PaymentScheduleStatus[] = [
  PaymentScheduleStatus.SCHEDULED,
  PaymentScheduleStatus.IN_BATCH,
  PaymentScheduleStatus.READY_TO_SEND,
  PaymentScheduleStatus.SENT,
];

export interface SimulationDay {
  date: string;
  outflow: number;
  scheduleCount: number;
  /** Saldo projetado ao fim do dia. */
  projectedBalance: number;
  deficit: number;
}

export interface SimulationAccount {
  accountId: string;
  accountName: string;
  openingBalance: number;
  creditLimit: number;
  spendingPower: number;
  totalOutflow: number;
  /** Menor saldo projetado do período — o dia mais apertado. */
  lowestBalance: number;
  lowestBalanceDate: string | null;
  deficit: number;
  surplus: number;
  days: SimulationDay[];
}

/**
 * Simulação financeira (seção 10).
 *
 * **Não grava nada.** Recebe as alterações hipotéticas, monta a projeção em memória e
 * devolve o resultado. É o que permite responder "e se eu empurrar estes três pagamentos
 * para o dia 20?" sem que ninguém precise alterar dados de verdade e desfazer depois — que
 * é como uma simulação vira uma alteração acidental.
 *
 * A projeção não tem entradas porque o Pulse ainda não tem Contas a Receber nem fluxo de
 * caixa. Ela responde "o que já existe em conta cobre o que está programado?" — e é essa a
 * pergunta que o agendamento precisa responder.
 */
@Injectable()
export class PaymentSimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: AccountBalanceService,
  ) {}

  async run(dto: SimulationDto) {
    const from = startOfDay(new Date(dto.from));
    const to = startOfDay(new Date(dto.to));
    const considerCreditLimits = dto.considerCreditLimits ?? true;

    const schedules = await this.prisma.paymentSchedule.findMany({
      where: {
        companyId: dto.companyId,
        deletedAt: null,
        status: { in: LIVE_STATUSES },
        blockedAt: null,
        scheduledDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        financialAccountId: true,
        scheduledDate: true,
        totalAmount: true,
      },
    });

    // As alterações hipotéticas são aplicadas sobre uma cópia. O banco nunca é tocado.
    const changes = new Map(
      (dto.changes ?? []).map((change) => [change.scheduleId, change]),
    );

    const projected = schedules
      .map((schedule) => {
        const change = changes.get(schedule.id);
        if (change?.excluded) return null;

        return {
          accountId: change?.financialAccountId ?? schedule.financialAccountId,
          date: change?.scheduledDate
            ? startOfDay(new Date(change.scheduledDate))
            : schedule.scheduledDate,
          amount: cents(schedule.totalAmount),
        };
      })
      .filter(
        (item): item is { accountId: string; date: Date; amount: number } =>
          item !== null && item.accountId !== null && item.date !== null,
      )
      .filter((item) => item.date >= from && item.date <= to);

    const accountIds = [...new Set(projected.map((item) => item.accountId))];

    const positions = await Promise.all(
      accountIds.map((accountId) =>
        this.balances.positionOf(accountId, from, {
          considerCreditLimits,
          // O comprometido do período é justamente o que a simulação está recalculando;
          // contá-lo de novo somaria duas vezes o mesmo pagamento.
        }),
      ),
    );

    const accounts: SimulationAccount[] = positions.map((position) => {
      const own = projected.filter(
        (item) => item.accountId === position.accountId,
      );

      const byDay = new Map<string, { outflow: number; count: number }>();
      for (const item of own) {
        const key = isoDate(item.date);
        const current = byDay.get(key) ?? { outflow: 0, count: 0 };
        byDay.set(key, {
          outflow: current.outflow + item.amount,
          count: current.count + 1,
        });
      }

      let running = cents(position.spendingPower);
      let lowest = running;
      let lowestDate: string | null = null;

      const days: SimulationDay[] = [...byDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, value]) => {
          running -= value.outflow;

          if (running < lowest) {
            lowest = running;
            lowestDate = date;
          }

          return {
            date,
            outflow: fromCents(value.outflow),
            scheduleCount: value.count,
            projectedBalance: fromCents(running),
            deficit: running < 0 ? fromCents(Math.abs(running)) : 0,
          };
        });

      const totalOutflow = own.reduce((total, item) => total + item.amount, 0);

      return {
        accountId: position.accountId,
        accountName: position.accountName,
        openingBalance: position.openingBalance,
        creditLimit: position.creditLimit,
        spendingPower: position.spendingPower,
        totalOutflow: fromCents(totalOutflow),
        lowestBalance: fromCents(lowest),
        lowestBalanceDate: lowestDate,
        deficit: lowest < 0 ? fromCents(Math.abs(lowest)) : 0,
        surplus: lowest > 0 ? fromCents(lowest) : 0,
        days,
      };
    });

    const totalOutflow = accounts.reduce(
      (total, account) => total + cents(account.totalOutflow),
      0,
    );
    const totalDeficit = accounts.reduce(
      (total, account) => total + cents(account.deficit),
      0,
    );

    return {
      from: isoDate(from),
      to: isoDate(to),
      considerCreditLimits,
      simulated: (dto.changes ?? []).length,
      scheduleCount: projected.length,
      totalOutflow: fromCents(totalOutflow),
      totalSpendingPower: fromCents(
        accounts.reduce(
          (total, account) => total + cents(account.spendingPower),
          0,
        ),
      ),
      totalDeficit: fromCents(totalDeficit),
      totalSurplus: fromCents(
        accounts.reduce((total, account) => total + cents(account.surplus), 0),
      ),
      hasDeficit: totalDeficit > 0,
      accounts,
      /** Programações sem conta ou sem data ficam de fora e são contadas aqui. */
      unassigned:
        schedules.length -
        projected.length -
        (dto.changes ?? []).filter((c) => c.excluded).length,
    };
  }
}

/** Situações de lote consideradas "aguardando envio" no painel. */
export const AWAITING_BATCH_STATUSES: PaymentBatchStatus[] = [
  PaymentBatchStatus.OPEN,
  PaymentBatchStatus.READY_TO_SEND,
];

export type SimulationWhere = Prisma.PaymentScheduleWhereInput;
