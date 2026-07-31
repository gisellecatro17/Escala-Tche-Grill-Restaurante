import { BankTransactionDirection } from '@prisma/client';

/**
 * Uma linha de extrato já lida, antes de qualquer normalização.
 *
 * É o contrato entre os parsers e o resto do módulo: OFX, CSV e planilha entregam isto, e
 * nada além disto. Um parser novo (CNAB, Open Finance) entra sem tocar em importação,
 * duplicidade ou conciliação.
 */
export interface ParsedTransaction {
  /** Índice da linha no arquivo, para apontar o erro exatamente onde ele está. */
  lineNumber: number;

  transactionDate: Date | null;
  postingDate: Date | null;

  /** Sempre positivo. O sinal mora em `direction`. */
  amount: number | null;
  direction: BankTransactionDirection | null;

  originalDescription: string;
  documentNumber: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;

  externalTransactionId: string | null;
  fitId: string | null;
  transactionCode: string | null;

  payerName: string | null;
  payeeName: string | null;

  runningBalance: number | null;

  /** A linha crua, como veio. É o que permite reprocessar sem reimportar o arquivo. */
  rawData: Record<string, unknown>;

  /** Motivos pelos quais esta linha não pode ser importada. Vazio = válida. */
  errors: string[];
}

/** Cabeçalho do extrato, quando o formato traz. */
export interface ParsedStatementHeader {
  bankCode: string | null;
  agencyNumber: string | null;
  accountNumber: string | null;
  currencyCode: string | null;
  startDate: Date | null;
  endDate: Date | null;
  openingBalance: number | null;
  closingBalance: number | null;
}

export interface ParsedStatement {
  header: ParsedStatementHeader;
  transactions: ParsedTransaction[];
  /** Problemas do arquivo inteiro — layout, codificação, estrutura. */
  errors: string[];
  warnings: string[];
}

export function emptyHeader(): ParsedStatementHeader {
  return {
    bankCode: null,
    agencyNumber: null,
    accountNumber: null,
    currencyCode: null,
    startDate: null,
    endDate: null,
    openingBalance: null,
    closingBalance: null,
  };
}

/**
 * Converte um texto de valor monetário em número, respeitando o separador informado.
 *
 * Não adivinha o formato: `1.234,56` e `1,234.56` são o mesmo número em convenções
 * diferentes, e adivinhar erra em exatamente um dos dois casos — sempre em silêncio.
 */
export function parseAmount(
  raw: string,
  decimalSeparator = ',',
  thousandSeparator = '.',
): number | null {
  const text = raw.trim();
  if (text === '') return null;

  const negative = /^\(.*\)$/.test(text) || text.includes('-');

  let digits = text.replace(/[()\s]/g, '');
  digits = digits.replace(/[A-Za-z$R]/g, '');

  if (thousandSeparator) {
    digits = digits.split(thousandSeparator).join('');
  }
  if (decimalSeparator && decimalSeparator !== '.') {
    digits = digits.replace(decimalSeparator, '.');
  }

  digits = digits.replace(/-/g, '');

  // Sem nenhum dígito não há valor. `Number('')` devolve zero, e sem esta guarda uma linha
  // de rodapé ("SALDO ANTERIOR", "TOTAL") entraria como movimentação de R$ 0,00 — ruído
  // que ninguém identifica depois e que ainda por cima soma na contagem do extrato.
  if (!/[0-9]/.test(digits)) return null;

  const value = Number(digits);
  if (!Number.isFinite(value)) return null;

  return negative ? -value : value;
}

/**
 * Converte texto em data conforme o formato declarado.
 *
 * Aceita `DD/MM/AAAA`, `AAAA-MM-DD`, `DD-MM-AAAA` e `AAAAMMDD`. O formato vem do modelo de
 * importação — sem ele, `03/04/2026` é 3 de abril para um banco e 4 de março para outro.
 */
export function parseDate(raw: string, format = 'DD/MM/YYYY'): Date | null {
  const text = raw.trim();
  if (text === '') return null;

  const digits = text.replace(/[^0-9]/g, '');

  if (digits.length === 8) {
    const upper = format.toUpperCase();

    if (upper.startsWith('Y')) {
      const year = Number(digits.slice(0, 4));
      const month = Number(digits.slice(4, 6));
      const day = Number(digits.slice(6, 8));
      return buildDate(year, month, day);
    }

    const first = Number(digits.slice(0, 2));
    const second = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));

    return upper.startsWith('M')
      ? buildDate(year, first, second)
      : buildDate(year, second, first);
  }

  if (digits.length === 6) {
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = 2000 + Number(digits.slice(4, 6));
    return buildDate(year, month, day);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));

  // `Date.UTC(2026, 1, 31)` vira 3 de março em silêncio. Conferir de volta é o que separa
  // uma data inválida recusada de uma data errada importada.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
