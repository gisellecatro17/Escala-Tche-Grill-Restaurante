import { Injectable } from '@nestjs/common';

export interface PlannedInstallment {
  installmentNumber: number;
  totalInstallments: number;
  dueDate: Date;
  grossAmount: number;
  netAmount: number;
  barcode: string | null;
  digitableLine: string | null;
}

export interface InstallmentPlanInput {
  /** Total a distribuir. */
  netAmount: number;
  /** Vencimento da primeira parcela. */
  firstDueDate: Date;
  count: number;
  /** Dias entre parcelas quando não há dia fixo. */
  intervalDays?: number;
  /** Dia fixo do mês (1-31). Quando informado, as parcelas caem mês a mês nesse dia. */
  fixedDueDay?: number | null;
  /** Códigos de cobrança por parcela, quando o documento traz um por parcela. */
  codes?: { barcode: string | null; digitableLine: string | null }[];
}

const DEFAULT_INTERVAL_DAYS = 30;

/**
 * Gera o plano de parcelas.
 *
 * Duas decisões que valem para todo o módulo:
 *
 * - **Um lançamento à vista também tem parcela.** Uma só, com o total. Assim relatórios,
 *   telas e o futuro módulo de pagamento leem sempre a mesma estrutura, sem caso especial
 *   para "à vista".
 * - **A diferença de arredondamento vai para a última parcela.** Dividir 100,00 em três
 *   dá 33,33 três vezes e perde um centavo; jogar a sobra na última é a convenção que o
 *   mercado usa e a única que faz a soma fechar exatamente com o valor do título.
 */
@Injectable()
export class InstallmentGeneratorService {
  plan(input: InstallmentPlanInput): PlannedInstallment[] {
    const count = Math.max(1, Math.trunc(input.count));
    const totalCents = Math.round(input.netAmount * 100);

    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - baseCents * count;

    return Array.from({ length: count }, (_, index) => {
      const isLast = index === count - 1;
      const cents = isLast ? baseCents + remainderCents : baseCents;
      const amount = cents / 100;
      const code = input.codes?.[index];

      return {
        installmentNumber: index + 1,
        totalInstallments: count,
        dueDate: this.dueDateOf(input, index),
        grossAmount: amount,
        netAmount: amount,
        barcode: code?.barcode ?? null,
        digitableLine: code?.digitableLine ?? null,
      };
    });
  }

  /**
   * Vencimento da parcela `index`.
   *
   * Com dia fixo, o mês avança e o dia é preservado — mas 31 não existe em todo mês, então
   * o dia é limitado ao último dia do mês de destino. Sem isso, `new Date(2026, 1, 31)`
   * viraria 3 de março em silêncio.
   */
  private dueDateOf(input: InstallmentPlanInput, index: number): Date {
    if (index === 0) return new Date(input.firstDueDate);

    if (input.fixedDueDay) {
      const first = input.firstDueDate;
      const targetMonth = first.getUTCMonth() + index;
      const year = first.getUTCFullYear() + Math.floor(targetMonth / 12);
      const month = ((targetMonth % 12) + 12) % 12;
      const lastDayOfMonth = new Date(
        Date.UTC(year, month + 1, 0),
      ).getUTCDate();
      const day = Math.min(input.fixedDueDay, lastDayOfMonth);

      return new Date(Date.UTC(year, month, day));
    }

    const interval = input.intervalDays ?? DEFAULT_INTERVAL_DAYS;
    const due = new Date(input.firstDueDate);
    due.setUTCDate(due.getUTCDate() + interval * index);
    return due;
  }
}
