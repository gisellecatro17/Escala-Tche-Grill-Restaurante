import { Injectable } from '@nestjs/common';
import { BankTransactionDirection } from '@prisma/client';
import * as ExcelJS from 'exceljs';

import {
  emptyHeader,
  parseAmount,
  parseDate,
  type ParsedStatement,
  type ParsedTransaction,
} from './parsed-statement';

/** Campos do Pulse que uma coluna do arquivo pode alimentar (seção 14). */
export type MappableField =
  | 'transactionDate'
  | 'postingDate'
  | 'description'
  | 'documentNumber'
  | 'externalId'
  | 'credit'
  | 'debit'
  | 'amount'
  | 'type'
  | 'balance'
  | 'payerName'
  | 'payeeName';

/**
 * Como o sentido da transação é determinado (seção 21).
 *
 * Nunca é assumido. Se o modelo não disser, a linha é recusada — importar um débito como
 * crédito inverte o caixa inteiro, e o erro só aparece na conciliação do mês seguinte.
 */
export type SignRule =
  /** Duas colunas separadas: uma de crédito, outra de débito. */
  | { kind: 'CREDIT_DEBIT_COLUMNS' }
  /** Coluna única, com o sinal no próprio número. */
  | { kind: 'SIGNED_AMOUNT' }
  /** Coluna única de valor mais uma coluna que diz o tipo. */
  | {
      kind: 'TYPE_COLUMN';
      creditValues: string[];
      debitValues: string[];
    };

export interface ColumnMapping {
  /** `campo -> nome do cabeçalho ou índice (base 0) da coluna`. */
  [field: string]: string | number;
}

export interface TabularOptions {
  columnMapping: ColumnMapping;
  signRule: SignRule;
  delimiter?: string;
  encoding?: string;
  dateFormat?: string;
  decimalSeparator?: string;
  thousandSeparator?: string;
  /** Linha do cabeçalho, base 1. Nulo = sem cabeçalho. */
  headerRow?: number | null;
  /** Primeira linha de dados, base 1. */
  dataStartRow?: number;
  footerRowsToIgnore?: number;
}

/**
 * Leitor de CSV e planilha (seção 14).
 *
 * Os dois formatos compartilham tudo depois da leitura da grade: o que muda é apenas como
 * as células são obtidas. Separar em dois serviços duplicaria o mapeamento de colunas, que
 * é justamente a parte onde o erro caro acontece.
 */
@Injectable()
export class TabularImportService {
  /** Lê o CSV como grade de células. */
  parseCsvGrid(buffer: Buffer, delimiter = ';', encoding = 'utf8'): string[][] {
    const content = decodeText(buffer, encoding);

    return content
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .map((line) => splitCsvLine(line, delimiter));
  }

  /** Lê a primeira planilha do arquivo como grade de células. */
  async parseSpreadsheetGrid(buffer: Buffer): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const grid: string[][] = [];

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];

      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cellText(cell));
      });

      grid.push(cells);
    });

    return grid;
  }

  /**
   * Descobre o separador mais provável de um CSV.
   *
   * Usado só na sugestão inicial do assistente. O separador que vale é o que a pessoa
   * confirma — adivinhar e importar sem confirmar é como uma coluna de valor com ponto e
   * vírgula vira uma coluna só.
   */
  detectDelimiter(buffer: Buffer): string {
    const sample =
      buffer.subarray(0, 4096).toString('utf8').split(/\r?\n/)[0] ?? '';
    const candidates = [';', ',', '\t', '|'];

    let best = ';';
    let bestCount = 0;

    for (const candidate of candidates) {
      const count = sample.split(candidate).length - 1;
      if (count > bestCount) {
        best = candidate;
        bestCount = count;
      }
    }

    return best;
  }

  /** Converte a grade em transações, aplicando o mapeamento e a regra de sinal. */
  toStatement(grid: string[][], options: TabularOptions): ParsedStatement {
    const statement: ParsedStatement = {
      header: emptyHeader(),
      transactions: [],
      errors: [],
      warnings: [],
    };

    if (grid.length === 0) {
      statement.errors.push('O arquivo informado está vazio.');
      return statement;
    }

    const headerRow = options.headerRow ?? 1;
    const headers =
      options.headerRow === null
        ? []
        : (grid[headerRow - 1] ?? []).map(normalizeHeader);

    const start = (options.dataStartRow ?? headerRow + 1) - 1;
    const end = grid.length - (options.footerRowsToIgnore ?? 0);

    const resolve = (field: MappableField): number | null =>
      resolveColumn(options.columnMapping[field], headers);

    const columns = {
      transactionDate: resolve('transactionDate'),
      postingDate: resolve('postingDate'),
      description: resolve('description'),
      documentNumber: resolve('documentNumber'),
      externalId: resolve('externalId'),
      credit: resolve('credit'),
      debit: resolve('debit'),
      amount: resolve('amount'),
      type: resolve('type'),
      balance: resolve('balance'),
      payerName: resolve('payerName'),
      payeeName: resolve('payeeName'),
    };

    if (columns.transactionDate === null) {
      statement.errors.push(
        'O mapeamento não indica qual coluna contém a data da transação.',
      );
    }

    if (columns.description === null) {
      statement.warnings.push(
        'Nenhuma coluna de histórico foi mapeada. As transações ficarão sem descrição.',
      );
    }

    this.assertSignRuleIsUsable(options.signRule, columns, statement);

    if (statement.errors.length > 0) return statement;

    for (let index = start; index < end; index += 1) {
      const cells = grid[index];
      if (!cells || cells.every((cell) => cell.trim() === '')) continue;

      statement.transactions.push(
        this.toTransaction(cells, index + 1, columns, options),
      );
    }

    const credits = statement.transactions
      .filter((item) => item.direction === BankTransactionDirection.IN)
      .reduce((total, item) => total + (item.amount ?? 0), 0);
    const debits = statement.transactions
      .filter((item) => item.direction === BankTransactionDirection.OUT)
      .reduce((total, item) => total + (item.amount ?? 0), 0);

    const dates = statement.transactions
      .map((item) => item.transactionDate)
      .filter((date): date is Date => date !== null)
      .sort((left, right) => left.getTime() - right.getTime());

    statement.header.startDate = dates[0] ?? null;
    statement.header.endDate = dates[dates.length - 1] ?? null;
    statement.header.closingBalance =
      statement.transactions.at(-1)?.runningBalance ?? null;

    if (statement.header.closingBalance !== null) {
      statement.header.openingBalance =
        Math.round((statement.header.closingBalance - credits + debits) * 100) /
        100;
    }

    return statement;
  }

  private assertSignRuleIsUsable(
    rule: SignRule,
    columns: Record<string, number | null>,
    statement: ParsedStatement,
  ) {
    if (rule.kind === 'CREDIT_DEBIT_COLUMNS') {
      if (columns.credit === null && columns.debit === null) {
        statement.errors.push(
          'A regra de sinal exige colunas de crédito e débito, mas nenhuma delas foi mapeada.',
        );
      }
      return;
    }

    if (columns.amount === null) {
      statement.errors.push(
        'A regra de sinal exige uma coluna única de valor, que não foi mapeada.',
      );
      return;
    }

    if (rule.kind === 'TYPE_COLUMN' && columns.type === null) {
      statement.errors.push(
        'A regra de sinal usa uma coluna de tipo, que não foi mapeada.',
      );
    }
  }

  private toTransaction(
    cells: string[],
    lineNumber: number,
    columns: Record<string, number | null>,
    options: TabularOptions,
  ): ParsedTransaction {
    const errors: string[] = [];
    const cell = (index: number | null): string =>
      index === null ? '' : (cells[index] ?? '').trim();

    const decimal = options.decimalSeparator ?? ',';
    const thousand = options.thousandSeparator ?? '.';
    const dateFormat = options.dateFormat ?? 'DD/MM/YYYY';

    const transactionDate = parseDate(
      cell(columns.transactionDate),
      dateFormat,
    );
    if (transactionDate === null) {
      errors.push('Data da transação ausente ou inválida.');
    }

    const postingDate =
      columns.postingDate === null
        ? transactionDate
        : (parseDate(cell(columns.postingDate), dateFormat) ?? transactionDate);

    const { amount, direction, signError } = this.resolveAmount(
      cells,
      columns,
      options.signRule,
      decimal,
      thousand,
    );

    if (signError) errors.push(signError);

    const description = cell(columns.description);
    if (description === '') {
      errors.push('Histórico da transação ausente.');
    }

    const rawData: Record<string, unknown> = {};
    cells.forEach((value, index) => {
      rawData[`col_${index}`] = value;
    });

    return {
      lineNumber,
      transactionDate,
      postingDate,
      amount,
      direction,
      originalDescription: description || '(sem histórico)',
      documentNumber: cell(columns.documentNumber) || null,
      checkNumber: null,
      referenceNumber: cell(columns.documentNumber) || null,
      externalTransactionId: cell(columns.externalId) || null,
      fitId: cell(columns.externalId) || null,
      transactionCode: cell(columns.type) || null,
      payerName: cell(columns.payerName) || null,
      payeeName: cell(columns.payeeName) || null,
      runningBalance:
        columns.balance === null
          ? null
          : parseAmount(cell(columns.balance), decimal, thousand),
      rawData,
      errors,
    };
  }

  private resolveAmount(
    cells: string[],
    columns: Record<string, number | null>,
    rule: SignRule,
    decimal: string,
    thousand: string,
  ): {
    amount: number | null;
    direction: BankTransactionDirection | null;
    signError: string | null;
  } {
    const cell = (index: number | null): string =>
      index === null ? '' : (cells[index] ?? '').trim();

    if (rule.kind === 'CREDIT_DEBIT_COLUMNS') {
      const credit = parseAmount(cell(columns.credit), decimal, thousand);
      const debit = parseAmount(cell(columns.debit), decimal, thousand);

      const hasCredit = credit !== null && Math.abs(credit) > 0;
      const hasDebit = debit !== null && Math.abs(debit) > 0;

      if (hasCredit && hasDebit) {
        return {
          amount: null,
          direction: null,
          signError:
            'A linha tem valor em crédito e em débito ao mesmo tempo. Confira o mapeamento das colunas.',
        };
      }

      if (hasCredit) {
        return {
          amount: Math.abs(credit),
          direction: BankTransactionDirection.IN,
          signError: null,
        };
      }

      if (hasDebit) {
        return {
          amount: Math.abs(debit),
          direction: BankTransactionDirection.OUT,
          signError: null,
        };
      }

      return {
        amount: null,
        direction: null,
        signError:
          'Valor da transação ausente nas colunas de crédito e débito.',
      };
    }

    const value = parseAmount(cell(columns.amount), decimal, thousand);

    if (value === null) {
      return {
        amount: null,
        direction: null,
        signError: 'Valor da transação ausente ou inválido.',
      };
    }

    if (rule.kind === 'SIGNED_AMOUNT') {
      if (value === 0) {
        return {
          amount: 0,
          direction: null,
          signError:
            'Não foi possível determinar o sentido: o valor é zero e não há coluna de tipo.',
        };
      }

      return {
        amount: Math.abs(value),
        direction:
          value > 0
            ? BankTransactionDirection.IN
            : BankTransactionDirection.OUT,
        signError: null,
      };
    }

    const type = cell(columns.type).toUpperCase();
    const isCredit = rule.creditValues.some(
      (candidate) => candidate.toUpperCase() === type,
    );
    const isDebit = rule.debitValues.some(
      (candidate) => candidate.toUpperCase() === type,
    );

    if (!isCredit && !isDebit) {
      return {
        amount: Math.abs(value),
        direction: null,
        signError: `Não foi possível determinar o sentido: o tipo "${type || '(vazio)'}" não está previsto no modelo.`,
      };
    }

    return {
      amount: Math.abs(value),
      direction: isCredit
        ? BankTransactionDirection.IN
        : BankTransactionDirection.OUT,
      signError: null,
    };
  }
}

/** Aceita nome do cabeçalho ou índice numérico. */
function resolveColumn(
  reference: string | number | undefined,
  headers: string[],
): number | null {
  if (reference === undefined || reference === null || reference === '')
    return null;

  if (typeof reference === 'number') {
    return reference >= 0 ? reference : null;
  }

  const numeric = Number(reference);
  if (Number.isInteger(numeric) && String(numeric) === reference.trim()) {
    return numeric;
  }

  const index = headers.indexOf(normalizeHeader(reference));
  return index >= 0 ? index : null;
}

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

/**
 * Divide uma linha de CSV respeitando aspas.
 *
 * Um histórico bancário com ponto e vírgula dentro — "PAGTO FORNECEDOR; NF 123" — quebra
 * qualquer `split` ingênuo e desloca todas as colunas seguintes.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function decodeText(buffer: Buffer, encoding: string): string {
  const normalized = encoding.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (
    normalized.includes('latin') ||
    normalized.includes('8859') ||
    normalized === '1252'
  ) {
    return buffer.toString('latin1');
  }

  const utf8 = buffer.toString('utf8');
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;

  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return `${String(value.getUTCDate()).padStart(2, '0')}/${String(
      value.getUTCMonth() + 1,
    ).padStart(2, '0')}/${value.getUTCFullYear()}`;
  }
  // Célula de fórmula guarda o resultado; hyperlink e rich text guardam o texto. As duas
  // formas chegam como objeto, e sem desembrulhar viraria "[object Object]" na planilha
  // inteira — um extrato ilegível que só apareceria na hora de conciliar.
  if (typeof value === 'object' && 'result' in value) {
    return scalarText((value as { result: unknown }).result);
  }
  if (typeof value === 'object' && 'text' in value) {
    return scalarText((value as { text: unknown }).text);
  }

  return scalarText(value);
}

/** Converte só o que tem representação textual honesta; o resto vira string vazia. */
function scalarText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();

  return '';
}
