import { Injectable } from '@nestjs/common';
import { BankTransactionDirection, BankTransactionType } from '@prisma/client';

import type { ParsedTransaction } from './parsers/parsed-statement';

export interface NormalizedTransaction {
  normalizedDescription: string;
  transactionType: BankTransactionType;
  pixEndToEndId: string | null;
  documentNumber: string | null;
  payerName: string | null;
  payeeName: string | null;
  /** Qual regra decidiu o tipo. Guardado para a revisão saber de onde veio. */
  appliedRule: string;
}

/**
 * Uma regra de classificação inicial: um padrão no histórico e o tipo que ele indica.
 *
 * Determinístico e legível de propósito. O Prompt 12B substitui este conjunto por regras
 * configuráveis sem tocar em nada que consome `transactionType` — é a razão de a
 * classificação viver num serviço próprio e não espalhada no importador.
 */
interface ClassificationRule {
  name: string;
  pattern: RegExp;
  /** Tipo quando a transação é entrada. */
  whenIn?: BankTransactionType;
  /** Tipo quando a transação é saída. */
  whenOut?: BankTransactionType;
}

/**
 * Regras na ordem em que são testadas — a primeira que casar vence.
 *
 * A ordem importa: "PIX DEVOLUCAO" precisa ser testada antes de "PIX", senão toda
 * devolução vira PIX comum e o estorno some do relatório.
 */
const RULES: ClassificationRule[] = [
  {
    name: 'estorno',
    pattern: /\b(ESTORNO|DEVOLUCAO|DEVOLVIDO|REVERSAO|CANCELAMENTO)\b/,
    whenIn: BankTransactionType.REVERSAL,
    whenOut: BankTransactionType.REVERSAL,
  },
  {
    name: 'chargeback',
    pattern: /\bCHARGEBACK\b/,
    whenIn: BankTransactionType.CHARGEBACK,
    whenOut: BankTransactionType.CHARGEBACK,
  },
  {
    name: 'tarifa',
    pattern:
      /\b(TARIFA|TAR\b|CESTA|MANUTENCAO DE CONTA|PACOTE DE SERVICOS|IOF|CUSTO)\b/,
    whenOut: BankTransactionType.BANK_FEE,
  },
  {
    name: 'tributo',
    pattern: /\b(DARF|GPS|GARE|FGTS|INSS|DAS|IPTU|IPVA|TRIBUTO|IMPOSTO|GNRE)\b/,
    whenOut: BankTransactionType.TAX_PAYMENT,
  },
  {
    name: 'folha',
    pattern:
      /\b(FOLHA|SALARIO|PAGAMENTO DE SALARIOS|PRO ?LABORE|RESCISAO|13 ?SALARIO)\b/,
    whenOut: BankTransactionType.PAYROLL,
  },
  {
    name: 'pix',
    pattern: /\bPIX\b/,
    whenIn: BankTransactionType.PIX_IN,
    whenOut: BankTransactionType.PIX_OUT,
  },
  {
    name: 'ted',
    pattern: /\bTED\b/,
    whenIn: BankTransactionType.TED_IN,
    whenOut: BankTransactionType.TED_OUT,
  },
  {
    name: 'doc',
    pattern: /\bDOC\b/,
    whenIn: BankTransactionType.DOC_IN,
    whenOut: BankTransactionType.DOC_OUT,
  },
  {
    name: 'boleto',
    pattern: /\b(BOLETO|TITULO|COBRANCA|LIQUIDACAO DE TITULO)\b/,
    whenIn: BankTransactionType.BOLETO_RECEIPT,
    whenOut: BankTransactionType.BOLETO_PAYMENT,
  },
  {
    name: 'transferência interna',
    pattern:
      /\b(TRANSF(ERENCIA)? ENTRE CONTAS|TRANSF PROPRIA|MESMA TITULARIDADE)\b/,
    whenIn: BankTransactionType.INTERNAL_TRANSFER,
    whenOut: BankTransactionType.INTERNAL_TRANSFER,
  },
  {
    name: 'transferência',
    pattern: /\b(TRANSF|TRANSFERENCIA)\b/,
    whenIn: BankTransactionType.TRANSFER_IN,
    whenOut: BankTransactionType.TRANSFER_OUT,
  },
  {
    name: 'aplicação',
    pattern: /\b(APLICACAO|APLIC|CDB|POUPANCA|INVESTIMENTO)\b/,
    whenOut: BankTransactionType.FINANCIAL_INVESTMENT,
    whenIn: BankTransactionType.FINANCIAL_REDEMPTION,
  },
  {
    name: 'resgate',
    pattern: /\b(RESGATE|RESG)\b/,
    whenIn: BankTransactionType.FINANCIAL_REDEMPTION,
    whenOut: BankTransactionType.FINANCIAL_INVESTMENT,
  },
  {
    name: 'cartão',
    pattern:
      /\b(CIELO|REDE|STONE|GETNET|PAGSEGURO|MAQUININHA|CARTAO|VENDAS CARTAO)\b/,
    whenIn: BankTransactionType.CARD_SETTLEMENT,
  },
  {
    name: 'empréstimo',
    pattern: /\b(EMPRESTIMO|FINANCIAMENTO|CAPITAL DE GIRO|PARCELA CONTRATO)\b/,
    whenIn: BankTransactionType.LOAN,
    whenOut: BankTransactionType.LOAN,
  },
  {
    name: 'juros',
    pattern: /\b(JUROS|RENDIMENTO|REMUNERACAO)\b/,
    whenIn: BankTransactionType.INTEREST,
    whenOut: BankTransactionType.INTEREST,
  },
  {
    name: 'multa',
    pattern: /\b(MULTA|MORA)\b/,
    whenOut: BankTransactionType.PENALTY,
  },
  {
    name: 'depósito',
    pattern: /\b(DEPOSITO|DEP DINHEIRO|DEP CHEQUE)\b/,
    whenIn: BankTransactionType.CASH_DEPOSIT,
  },
  {
    name: 'cheque',
    pattern: /\b(CHEQUE|CH COMPENSADO)\b/,
    whenIn: BankTransactionType.CHECK,
    whenOut: BankTransactionType.CHECK,
  },
];

/** PIX EndToEndId: `E` + ISPB(8) + AAAAMMDDHHMM + 11 alfanuméricos. */
const PIX_E2E = /\bE\d{8}\d{12}[A-Za-z0-9]{11}\b/;

/**
 * Normalização das transações (seção 19).
 *
 * **O dado original nunca é apagado.** Este serviço produz uma leitura ao lado do
 * original: `normalizedDescription` existe para o motor comparar, e `originalDescription`
 * continua sendo o que o banco escreveu. Quando a normalização melhorar, ela roda de novo
 * sobre o original — coisa impossível se o original tivesse sido sobrescrito.
 */
@Injectable()
export class BankTransactionNormalizationService {
  normalize(
    transaction: ParsedTransaction,
    direction: BankTransactionDirection,
  ): NormalizedTransaction {
    const normalizedDescription = normalizeText(
      transaction.originalDescription,
    );

    const classification = this.classify(normalizedDescription, direction);

    return {
      normalizedDescription,
      transactionType: classification.type,
      appliedRule: classification.rule,
      pixEndToEndId: PIX_E2E.exec(transaction.originalDescription)?.[0] ?? null,
      documentNumber:
        transaction.documentNumber ??
        extractDocumentNumber(normalizedDescription),
      payerName:
        transaction.payerName ??
        (direction === BankTransactionDirection.IN
          ? extractCounterparty(normalizedDescription)
          : null),
      payeeName:
        transaction.payeeName ??
        (direction === BankTransactionDirection.OUT
          ? extractCounterparty(normalizedDescription)
          : null),
    };
  }

  /**
   * Classificação inicial por regra simples (seção 20).
   *
   * Devolve o nome da regra junto com o tipo: sem isso, uma classificação errada seria
   * impossível de rastrear até a regra que a produziu.
   */
  classify(
    normalizedDescription: string,
    direction: BankTransactionDirection,
  ): { type: BankTransactionType; rule: string } {
    for (const rule of RULES) {
      if (!rule.pattern.test(normalizedDescription)) continue;

      const type =
        direction === BankTransactionDirection.IN ? rule.whenIn : rule.whenOut;

      if (type) return { type, rule: rule.name };
    }

    // Sem regra: o tipo é o próprio sentido. `UNKNOWN` ficaria mais honesto, mas crédito e
    // débito **são** informação — o que falta é o detalhe, não o sentido.
    return {
      type:
        direction === BankTransactionDirection.IN
          ? BankTransactionType.CREDIT
          : BankTransactionType.DEBIT,
      rule: 'sem regra correspondente',
    };
  }
}

/**
 * Maiúsculas, sem acento, sem pontuação e sem espaço duplicado.
 *
 * É sobre este texto que o motor compara nome de fornecedor. "Frigorífico São José" e
 * "FRIGORIFICO SAO JOSE" precisam ser a mesma coisa, senão nenhuma correspondência por
 * nome funciona com extrato brasileiro.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Números longos o suficiente para serem documento, e não valor nem data. */
function extractDocumentNumber(normalized: string): string | null {
  const match =
    /\b(?:NF|NFE|DOC|DOCUMENTO|TITULO|BOLETO)[\s/-]*(\d{3,})\b/.exec(
      normalized,
    );

  return match?.[1] ?? null;
}

/**
 * Tenta extrair o nome da outra parte do histórico.
 *
 * Heurística deliberadamente conservadora: devolve nulo quando não há um separador claro.
 * Um nome errado é pior que nenhum — ele produziria sugestões de conciliação com o
 * fornecedor errado, que é exatamente o engano que a revisão humana não pega.
 */
function extractCounterparty(normalized: string): string | null {
  const separators = [' DE ', ' PARA ', ' - ', ' — '];

  for (const separator of separators) {
    const index = normalized.indexOf(separator);
    if (index === -1) continue;

    const candidate = normalized.slice(index + separator.length).trim();

    if (candidate.length >= 4 && /[A-Z]{3,}/.test(candidate)) {
      return candidate.slice(0, 120);
    }
  }

  return null;
}
