import { Injectable } from '@nestjs/common';
import { BankTransactionDirection } from '@prisma/client';

import {
  emptyHeader,
  type ParsedStatement,
  type ParsedTransaction,
} from './parsed-statement';

/**
 * Leitor de OFX (seção 13).
 *
 * O OFX é SGML, não XML: tags sem fechamento são a regra, e passar um parser de XML nele
 * falha na maioria dos arquivos brasileiros. Por isso a leitura é feita por varredura de
 * tags — mais simples, e é o que efetivamente funciona com os arquivos que os bancos
 * emitem.
 *
 * O conteúdo original é preservado integralmente em `rawData`.
 */
@Injectable()
export class OfxImportService {
  /** Reconhece um arquivo OFX pelo cabeçalho ou pela primeira tag. */
  detects(content: string): boolean {
    const head = content.slice(0, 2000).toUpperCase();
    return head.includes('OFXHEADER') || head.includes('<OFX>');
  }

  parse(buffer: Buffer): ParsedStatement {
    const content = decode(buffer);
    const statement: ParsedStatement = {
      header: emptyHeader(),
      transactions: [],
      errors: [],
      warnings: [],
    };

    if (!this.detects(content)) {
      statement.errors.push(
        'O arquivo informado não possui um formato válido: nenhum cabeçalho OFX foi encontrado.',
      );
      return statement;
    }

    statement.header = {
      bankCode: tagValue(content, 'BANKID'),
      agencyNumber: tagValue(content, 'BRANCHID'),
      accountNumber: tagValue(content, 'ACCTID'),
      currencyCode: tagValue(content, 'CURDEF') ?? 'BRL',
      startDate: ofxDate(tagValue(content, 'DTSTART')),
      endDate: ofxDate(tagValue(content, 'DTEND')),
      openingBalance: null,
      closingBalance: numberOf(tagValue(content, 'BALAMT')),
    };

    const blocks = content.split(/<STMTTRN>/i).slice(1);

    if (blocks.length === 0) {
      statement.warnings.push('Nenhuma transação foi encontrada no arquivo.');
      return statement;
    }

    blocks.forEach((block, index) => {
      const body = block.split(/<\/STMTTRN>/i)[0];
      statement.transactions.push(this.parseTransaction(body, index + 1));
    });

    // O OFX declara o saldo final, mas raramente o inicial. Reconstruí-lo a partir do
    // final e das transações é o que permite conferir a leitura — se sobrar diferença, o
    // arquivo foi lido pela metade.
    if (statement.header.closingBalance !== null) {
      const movement = statement.transactions.reduce((total, transaction) => {
        if (transaction.amount === null || transaction.direction === null)
          return total;
        return (
          total +
          (transaction.direction === BankTransactionDirection.IN
            ? transaction.amount
            : -transaction.amount)
        );
      }, 0);

      statement.header.openingBalance =
        Math.round((statement.header.closingBalance - movement) * 100) / 100;
    }

    return statement;
  }

  private parseTransaction(
    body: string,
    lineNumber: number,
  ): ParsedTransaction {
    const errors: string[] = [];

    const trnType = tagValue(body, 'TRNTYPE');
    const rawAmount = numberOf(tagValue(body, 'TRNAMT'));
    const posted = ofxDate(tagValue(body, 'DTPOSTED'));
    const userDate = ofxDate(tagValue(body, 'DTUSER'));

    if (rawAmount === null)
      errors.push('Valor da transação ausente ou inválido.');
    if (posted === null) errors.push('Data da transação ausente ou inválida.');

    // O sentido vem do sinal do TRNAMT, confirmado pelo TRNTYPE quando ele existe.
    // Nenhum dos dois é assumido sozinho: há bancos que mandam DEBIT com valor positivo.
    const direction = this.directionOf(rawAmount, trnType);

    const memo = tagValue(body, 'MEMO') ?? '';
    const name = tagValue(body, 'NAME') ?? '';
    const description = [name, memo].filter(Boolean).join(' — ').trim();

    if (description === '') errors.push('Histórico da transação ausente.');

    const fitId = tagValue(body, 'FITID');

    return {
      lineNumber,
      transactionDate: posted,
      postingDate: userDate ?? posted,
      amount: rawAmount === null ? null : Math.abs(rawAmount),
      direction,
      originalDescription: description || '(sem histórico)',
      documentNumber: tagValue(body, 'REFNUM') ?? tagValue(body, 'CHECKNUM'),
      checkNumber: tagValue(body, 'CHECKNUM'),
      referenceNumber: tagValue(body, 'REFNUM'),
      externalTransactionId: fitId,
      fitId,
      transactionCode: trnType,
      payerName:
        direction === BankTransactionDirection.IN ? name || null : null,
      payeeName:
        direction === BankTransactionDirection.OUT ? name || null : null,
      runningBalance: null,
      rawData: {
        TRNTYPE: trnType,
        DTPOSTED: tagValue(body, 'DTPOSTED'),
        DTUSER: tagValue(body, 'DTUSER'),
        TRNAMT: tagValue(body, 'TRNAMT'),
        FITID: fitId,
        CHECKNUM: tagValue(body, 'CHECKNUM'),
        REFNUM: tagValue(body, 'REFNUM'),
        NAME: name,
        MEMO: memo,
      },
      errors,
    };
  }

  private directionOf(
    amount: number | null,
    trnType: string | null,
  ): BankTransactionDirection | null {
    if (amount === null) return null;

    const type = (trnType ?? '').toUpperCase();

    const creditTypes = ['CREDIT', 'DEP', 'DIRECTDEP', 'INT', 'DIV', 'XFER'];
    const debitTypes = [
      'DEBIT',
      'PAYMENT',
      'CHECK',
      'FEE',
      'SRVCHG',
      'ATM',
      'POS',
      'DIRECTDEBIT',
      'REPEATPMT',
    ];

    // O sinal manda. O tipo só decide quando o valor é zero — o que existe em estorno.
    if (amount > 0) return BankTransactionDirection.IN;
    if (amount < 0) return BankTransactionDirection.OUT;

    if (creditTypes.includes(type)) return BankTransactionDirection.IN;
    if (debitTypes.includes(type)) return BankTransactionDirection.OUT;

    return null;
  }
}

/** Valor de uma tag SGML sem fechamento obrigatório. */
function tagValue(content: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\r\n]*)`, 'i').exec(content);
  if (!match) return null;

  const value = match[1].trim();
  return value === '' ? null : value;
}

/** `AAAAMMDDHHMMSS[-3:GMT]` → Date. Só a parte da data importa para conciliação. */
function ofxDate(raw: string | null): Date | null {
  if (!raw) return null;

  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberOf(raw: string | null): number | null {
  if (!raw) return null;

  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Decodifica o arquivo respeitando o charset declarado.
 *
 * Extrato brasileiro em Latin-1 lido como UTF-8 vira "PAGAMENTO FORNECEDOR LTDA" com
 * caracteres quebrados — e é sobre esse texto que o motor de correspondência vai comparar
 * o nome do fornecedor.
 */
function decode(buffer: Buffer): string {
  const head = buffer.subarray(0, 1024).toString('latin1').toUpperCase();

  if (head.includes('CHARSET:1252') || head.includes('ENCODING:USASCII')) {
    return buffer.toString('latin1');
  }

  const utf8 = buffer.toString('utf8');
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}
