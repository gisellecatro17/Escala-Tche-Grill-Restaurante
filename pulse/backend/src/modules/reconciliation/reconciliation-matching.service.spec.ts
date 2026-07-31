import {
  BankTransactionDirection,
  MatchConfidenceLevel,
  ReconcilableEntityType,
} from '@prisma/client';

import {
  MATCH_WEIGHTS,
  ReconciliationMatchingService,
  confidenceOf,
  daysBetween,
} from './reconciliation-matching.service';
import type { PrismaService } from '../../prisma/prisma.service';

const service = new ReconciliationMatchingService({} as PrismaService);

const context = {
  companyId: 'company-1',
  financialAccountId: 'account-1',
  direction: BankTransactionDirection.OUT,
  amount: 1250.75,
  transactionDate: new Date('2026-07-03'),
  normalizedDescription: 'PAGAMENTO FRIGORIFICO SAO JOSE NF 8842',
  documentNumber: '8842',
  pixEndToEndId: null,
  dateToleranceDays: 3,
  amountTolerance: 0,
  percentageTolerance: 0,
};

const candidate = {
  entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
  entityId: 'installment-1',
  label: 'CP-0001 — parcela 1',
  description: 'Compra de carnes',
  amount: 1250.75,
  referenceDate: new Date('2026-07-03'),
  supplierName: 'Frigorífico São José Ltda',
  documentNumber: '8842',
};

describe('confidenceOf', () => {
  it('separa as faixas de confiança pelo score', () => {
    expect(confidenceOf(100)).toBe(MatchConfidenceLevel.VERY_HIGH);
    expect(confidenceOf(85)).toBe(MatchConfidenceLevel.HIGH);
    expect(confidenceOf(65)).toBe(MatchConfidenceLevel.MEDIUM);
    expect(confidenceOf(40)).toBe(MatchConfidenceLevel.LOW);
  });
});

describe('daysBetween', () => {
  it('conta dias inteiros ignorando a hora', () => {
    expect(
      daysBetween(
        new Date('2026-07-03T23:50:00Z'),
        new Date('2026-07-05T00:10:00Z'),
      ),
    ).toBe(2);
  });
});

describe('ReconciliationMatchingService.score', () => {
  it('soma valor exato, data exata, documento e fornecedor', () => {
    const result = service.score(candidate, context);

    expect(result.score).toBe(
      MATCH_WEIGHTS.exactAmount +
        MATCH_WEIGHTS.exactDate +
        MATCH_WEIGHTS.documentNumber +
        MATCH_WEIGHTS.supplierName,
    );
    // 90 pontos: alta, não altíssima. `VERY_HIGH` fica reservado para o caso em que o
    // identificador de pagamento também bate — sem ele sempre resta alguma dúvida.
    expect(result.score).toBe(90);
    expect(result.confidenceLevel).toBe(MatchConfidenceLevel.HIGH);
  });

  /**
   * O score nunca é um número solto: cada ponto carrega o critério que o gerou. Quem revisa
   * precisa saber se a sugestão veio do valor exato ou de um nome parecido — a confiança
   * nas duas coisas é muito diferente.
   */
  it('registra a memória de cálculo de cada critério', () => {
    const result = service.score(candidate, context);

    const names = result.criteria.map((item) => item.criterion);

    expect(names).toContain('valor exato');
    expect(names).toContain('data exata');
    expect(names).toContain('documento igual');
    expect(names).toContain('fornecedor compatível');
    expect(result.criteria.every((item) => item.detail.length > 0)).toBe(true);
  });

  it('não pontua valor fora da tolerância', () => {
    const result = service.score({ ...candidate, amount: 1000 }, context);

    expect(result.criteria.map((item) => item.criterion)).not.toContain(
      'valor exato',
    );
    expect(result.differenceAmount).toBe(250.75);
  });

  it('pontua menos quando o valor só cabe na tolerância configurada', () => {
    const result = service.score(
      { ...candidate, amount: 1250 },
      { ...context, amountTolerance: 1 },
    );

    const amountCriterion = result.criteria.find((item) =>
      item.criterion.startsWith('valor'),
    );

    expect(amountCriterion?.points).toBe(MATCH_WEIGHTS.toleratedAmount);
    expect(amountCriterion?.points).toBeLessThan(MATCH_WEIGHTS.exactAmount);
  });

  it('pontua menos quando a data está próxima mas não é a mesma', () => {
    const result = service.score(
      { ...candidate, referenceDate: new Date('2026-07-05') },
      context,
    );

    const dateCriterion = result.criteria.find((item) =>
      item.criterion.startsWith('data'),
    );

    expect(dateCriterion?.criterion).toBe('data próxima');
    expect(dateCriterion?.points).toBe(MATCH_WEIGHTS.nearDate);
    expect(result.differenceDays).toBe(2);
  });

  it('não pontua data fora da tolerância', () => {
    const result = service.score(
      { ...candidate, referenceDate: new Date('2026-07-20') },
      context,
    );

    expect(result.criteria.map((item) => item.criterion)).not.toContain(
      'data próxima',
    );
  });

  /**
   * Palavra genérica não identifica ninguém: "COMERCIO LTDA" aparece em metade dos
   * fornecedores do país, e pontuar por ela sugeriria o fornecedor errado com confiança
   * alta.
   */
  it('ignora palavras genéricas do nome do fornecedor', () => {
    const result = service.score(
      {
        ...candidate,
        supplierName: 'Comercio Brasil Ltda',
        documentNumber: null,
      },
      { ...context, normalizedDescription: 'PAGAMENTO COMERCIO LTDA BRASIL' },
    );

    expect(result.criteria.map((item) => item.criterion)).not.toContain(
      'fornecedor compatível',
    );
  });

  it('reconhece o documento citado no histórico quando o campo não veio', () => {
    const result = service.score(candidate, {
      ...context,
      documentNumber: null,
    });

    expect(result.criteria.map((item) => item.criterion)).toContain(
      'documento no histórico',
    );
  });

  it('pontua o identificador PIX quando ele consta no lançamento', () => {
    const result = service.score(
      {
        ...candidate,
        description: 'Pagamento E1234567820260703120000000012345',
      },
      { ...context, pixEndToEndId: 'E1234567820260703120000000012345' },
    );

    const pix = result.criteria.find(
      (item) => item.criterion === 'identificador PIX',
    );

    expect(pix?.points).toBe(MATCH_WEIGHTS.paymentIdentifier);
  });

  it('nunca passa de cem', () => {
    const result = service.score(
      { ...candidate, description: 'E1234567820260703120000000012345' },
      { ...context, pixEndToEndId: 'E1234567820260703120000000012345' },
    );

    expect(result.score).toBeLessThanOrEqual(100);
  });

  /**
   * Nenhuma movimentação é conciliada só porque o valor é parecido: sem data, documento
   * nem fornecedor compatíveis, o valor exato sozinho fica abaixo do mínimo padrão (60) e
   * nem chega a virar sugestão.
   */
  it('valor igual sozinho não alcança o score mínimo padrão', () => {
    const result = service.score(
      {
        ...candidate,
        referenceDate: new Date('2026-05-01'),
        documentNumber: null,
        supplierName: null,
      },
      context,
    );

    expect(result.score).toBe(MATCH_WEIGHTS.exactAmount);
    expect(result.score).toBeLessThan(60);
  });
});
