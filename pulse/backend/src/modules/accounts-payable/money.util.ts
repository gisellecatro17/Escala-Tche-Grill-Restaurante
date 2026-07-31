import { Prisma } from '@prisma/client';

/**
 * Aritmética de dinheiro em centavos inteiros.
 *
 * Somar `0.1 + 0.2` em ponto flutuante dá `0.30000000000000004`, e um saldo que erra na
 * décima quinta casa é um saldo que nunca zera. Todo cálculo do módulo passa por aqui: as
 * contas acontecem em centavos, e só o resultado volta a ser um número com duas casas.
 */
export type MoneyLike = Prisma.Decimal | number | string | null | undefined;

/** Converte qualquer representação de dinheiro para centavos inteiros. */
export function cents(value: MoneyLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value * 100);
  return Math.round(Number(value.toString()) * 100);
}

/** Converte centavos inteiros de volta para um valor com duas casas. */
export function fromCents(value: number): number {
  return Math.round(value) / 100;
}

/** Soma valores monetários sem passar por ponto flutuante. */
export function sum(values: MoneyLike[]): number {
  return fromCents(
    values.reduce<number>((total, item) => total + cents(item), 0),
  );
}

/** Nunca deixa um saldo ficar negativo — pagar a mais não vira crédito automático. */
export function clampToZero(value: number): number {
  return value < 0 ? 0 : value;
}

/**
 * Distribui um total entre `count` partes, jogando a sobra do arredondamento na última.
 *
 * Mesma convenção já usada nas parcelas do processamento: 100,00 em três partes dá 33,33 +
 * 33,33 + 33,34. Sem isso a soma das partes não fecha com o total e a divergência aparece
 * meses depois, na conciliação.
 */
export function split(total: number, count: number): number[] {
  const parts = Math.max(1, Math.trunc(count));
  const totalCents = cents(total);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;

  return Array.from({ length: parts }, (_, index) =>
    fromCents(index === parts - 1 ? base + remainder : base),
  );
}
