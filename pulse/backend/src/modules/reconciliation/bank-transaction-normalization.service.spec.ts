import { BankTransactionDirection, BankTransactionType } from '@prisma/client';

import {
  BankTransactionNormalizationService,
  normalizeText,
} from './bank-transaction-normalization.service';
import type { ParsedTransaction } from './parsers/parsed-statement';

function parsed(description: string, extra: Partial<ParsedTransaction> = {}) {
  return {
    lineNumber: 1,
    transactionDate: new Date('2026-07-03'),
    postingDate: null,
    amount: 100,
    direction: null,
    originalDescription: description,
    documentNumber: null,
    checkNumber: null,
    referenceNumber: null,
    externalTransactionId: null,
    fitId: null,
    transactionCode: null,
    payerName: null,
    payeeName: null,
    runningBalance: null,
    rawData: {},
    errors: [],
    ...extra,
  } satisfies ParsedTransaction;
}

describe('normalizeText', () => {
  it('tira acento, pontuação e espaço duplicado', () => {
    expect(normalizeText('Frigorífico  São José Ltda.')).toBe(
      'FRIGORIFICO SAO JOSE LTDA',
    );
  });
});

describe('BankTransactionNormalizationService', () => {
  const service = new BankTransactionNormalizationService();

  it('classifica tarifa como despesa bancária apenas na saída', () => {
    expect(
      service.classify(
        'TARIFA MANUTENCAO DE CONTA',
        BankTransactionDirection.OUT,
      ).type,
    ).toBe(BankTransactionType.BANK_FEE);

    // O mesmo texto entrando é o estorno da tarifa, não uma tarifa. Sem separar por
    // sentido, a devolução apareceria no relatório como mais uma cobrança.
    expect(
      service.classify(
        'TARIFA MANUTENCAO DE CONTA',
        BankTransactionDirection.IN,
      ).type,
    ).toBe(BankTransactionType.CREDIT);
  });

  /**
   * A ordem das regras importa: "PIX DEVOLUCAO" precisa cair em estorno antes de cair em
   * PIX, senão toda devolução vira PIX comum e some do relatório de estornos.
   */
  it('classifica devolução de PIX como estorno, não como PIX', () => {
    const result = service.classify(
      'PIX DEVOLUCAO ENVIADA',
      BankTransactionDirection.OUT,
    );

    expect(result.type).toBe(BankTransactionType.REVERSAL);
    expect(result.rule).toBe('estorno');
  });

  it('devolve o nome da regra aplicada para a revisão rastrear a classificação', () => {
    expect(
      service.classify(
        'PAGAMENTO DARF CODIGO 0561',
        BankTransactionDirection.OUT,
      ).rule,
    ).toBe('tributo');
  });

  it('cai em crédito ou débito quando nenhuma regra casa', () => {
    const result = service.classify(
      'LANCAMENTO XPTO',
      BankTransactionDirection.IN,
    );

    expect(result.type).toBe(BankTransactionType.CREDIT);
    expect(result.rule).toBe('sem regra correspondente');
  });

  /** `E` + ISPB(8) + AAAAMMDDHHMM + 11 alfanuméricos — o EndToEndId do arranjo PIX. */
  it('extrai o identificador ponta a ponta do PIX', () => {
    const result = service.normalize(
      parsed('PIX ENVIADO E1234567820260703120000000012345 FORNECEDOR'),
      BankTransactionDirection.OUT,
    );

    expect(result.pixEndToEndId).toBe('E1234567820260703120000000012345');
  });

  it('não inventa identificador PIX a partir de um número qualquer', () => {
    const result = service.normalize(
      parsed('PIX ENVIADO REF 12345 FORNECEDOR'),
      BankTransactionDirection.OUT,
    );

    expect(result.pixEndToEndId).toBeNull();
  });

  /** O original nunca é sobrescrito: a normalização vive ao lado dele. */
  it('produz a descrição normalizada sem tocar na original', () => {
    const transaction = parsed('Pagamento Fornecedor — NF 8842');
    const result = service.normalize(transaction, BankTransactionDirection.OUT);

    expect(transaction.originalDescription).toBe(
      'Pagamento Fornecedor — NF 8842',
    );
    expect(result.normalizedDescription).toBe('PAGAMENTO FORNECEDOR NF 8842');
  });

  it('respeita o documento que veio do arquivo em vez de tentar extrair outro', () => {
    const result = service.normalize(
      parsed('PAGAMENTO NF 9999', { documentNumber: '8842' }),
      BankTransactionDirection.OUT,
    );

    expect(result.documentNumber).toBe('8842');
  });
});
