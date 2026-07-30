/**
 * Gerador de boletos **válidos** para testes e para o seed de demonstração.
 *
 * Existe porque as linhas digitáveis que circulam em documentação bancária costumam ser
 * ilustrativas e não passam no dígito verificador geral — usá-las nos testes daria a
 * impressão de que o validador está errado. Aqui os dígitos são calculados, então o
 * fixture é correto por construção.
 *
 * Não é código de produção de boletos: o Pulse **lê** boletos, não os emite.
 */

function modulo11(digits: string): number {
  let weight = 2;
  let sum = 0;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += Number(digits[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const digit = 11 - (sum % 11);
  return digit === 0 || digit > 9 ? 1 : digit;
}

function modulo10(digits: string): number {
  let sum = 0;
  let multiplier = 2;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const product = Number(digits[index]) * multiplier;
    sum += product > 9 ? product - 9 : product;
    multiplier = multiplier === 2 ? 1 : 2;
  }

  return (10 - (sum % 10)) % 10;
}

const BASE_DATE = Date.UTC(1997, 9, 7);
const MILLISECONDS_PER_DAY = 86_400_000;

const FACTOR_MAXIMUM = 9999;
const FACTOR_CYCLE_DAYS = 9000;

/**
 * Fator de vencimento de uma data.
 *
 * O fator tem **quatro** dígitos, então a contagem corrida desde 07/10/1997 estourou em
 * 21/02/2025 e reiniciou em 1000. Um vencimento de 2026 tem 10.534 dias corridos, que não
 * cabem em quatro dígitos — é preciso descontar o ciclo, exatamente como o
 * `BoletoValidationService` faz na leitura.
 */
export function dueDateToFactor(dueDate: Date): number {
  const days = Math.round(
    (Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate(),
    ) -
      BASE_DATE) /
      MILLISECONDS_PER_DAY,
  );

  let factor = days;
  while (factor > FACTOR_MAXIMUM) factor -= FACTOR_CYCLE_DAYS;
  return factor;
}

export interface BoletoFixture {
  barcode: string;
  digitableLine: string;
  amount: number;
  dueDate: Date;
  bankCode: string;
}

/**
 * Monta um boleto bancário válido para o banco, valor e vencimento informados.
 * O campo livre é preenchido de forma determinística a partir do `seed`, para que o
 * mesmo seed produza sempre o mesmo boleto.
 */
export function buildValidBoleto(options: {
  bankCode?: string;
  amount: number;
  dueDate: Date;
  seed?: string;
}): BoletoFixture {
  const bankCode = (options.bankCode ?? '001').padStart(3, '0');
  const currency = '9';
  const factor = String(dueDateToFactor(options.dueDate)).padStart(4, '0');
  const amount = String(Math.round(options.amount * 100)).padStart(10, '0');

  const seed = (options.seed ?? '1').replace(/\D/g, '') || '1';
  const freeField = seed.repeat(25).slice(0, 25);

  const withoutCheckDigit = `${bankCode}${currency}${factor}${amount}${freeField}`;
  const generalCheckDigit = String(modulo11(withoutCheckDigit));
  const barcode = `${bankCode}${currency}${generalCheckDigit}${factor}${amount}${freeField}`;

  const field1 = `${bankCode}${currency}${freeField.slice(0, 5)}`;
  const field2 = freeField.slice(5, 15);
  const field3 = freeField.slice(15, 25);

  const digitableLine =
    `${field1}${modulo10(field1)}` +
    `${field2}${modulo10(field2)}` +
    `${field3}${modulo10(field3)}` +
    `${generalCheckDigit}${factor}${amount}`;

  return {
    barcode,
    digitableLine,
    amount: options.amount,
    dueDate: options.dueDate,
    bankCode,
  };
}

/** Versão formatada da linha digitável, como aparece impressa no boleto. */
export function formatDigitableLine(digitableLine: string): string {
  const digits = digitableLine.replace(/\D/g, '');
  if (digits.length !== 47) return digitableLine;

  return [
    `${digits.slice(0, 5)}.${digits.slice(5, 10)}`,
    `${digits.slice(10, 15)}.${digits.slice(15, 21)}`,
    `${digits.slice(21, 26)}.${digits.slice(26, 32)}`,
    digits.slice(32, 33),
    digits.slice(33, 47),
  ].join(' ');
}
