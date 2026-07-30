import {
  detectConflicts,
  evaluateCondition,
  evaluateRule,
  normalizeForMatching,
  type EvaluableCondition,
} from './rule-matching.util';

function cond(
  field: string,
  operator: string,
  value: string,
  secondaryValue?: string,
): EvaluableCondition {
  return {
    field: field as EvaluableCondition['field'],
    operator: operator as EvaluableCondition['operator'],
    value,
    secondaryValue,
  };
}

describe('normalizeForMatching', () => {
  it('remove acentos, coloca em maiúsculas e colapsa espaços', () => {
    expect(normalizeForMatching('  Coélba   Fatura ')).toBe('COELBA FATURA');
  });
});

describe('evaluateCondition — texto', () => {
  const input = { description: 'COELBA FATURA 09/2026' };

  it('CONTAINS casa ignorando acentuação e caixa', () => {
    expect(
      evaluateCondition(cond('DESCRIPTION', 'CONTAINS', 'coélba'), input),
    ).toBe(true);
  });

  it('NOT_CONTAINS inverte o resultado', () => {
    expect(
      evaluateCondition(cond('DESCRIPTION', 'NOT_CONTAINS', 'EMBASA'), input),
    ).toBe(true);
  });

  it('STARTS_WITH e ENDS_WITH', () => {
    expect(
      evaluateCondition(cond('DESCRIPTION', 'STARTS_WITH', 'COELBA'), input),
    ).toBe(true);
    expect(
      evaluateCondition(cond('DESCRIPTION', 'ENDS_WITH', '09/2026'), input),
    ).toBe(true);
    expect(
      evaluateCondition(cond('DESCRIPTION', 'STARTS_WITH', 'FATURA'), input),
    ).toBe(false);
  });

  it('EQUALS exige igualdade completa', () => {
    expect(
      evaluateCondition(cond('DESCRIPTION', 'EQUALS', 'COELBA'), input),
    ).toBe(false);
    expect(
      evaluateCondition(
        cond('DESCRIPTION', 'EQUALS', 'coelba fatura 09/2026'),
        input,
      ),
    ).toBe(true);
  });

  it('IN e NOT_IN aceitam lista separada por ponto e vírgula', () => {
    expect(
      evaluateCondition(cond('TRANSACTION_TYPE', 'IN', 'PIX;TED;DOC'), {
        transactionType: 'ted',
      }),
    ).toBe(true);
    expect(
      evaluateCondition(cond('TRANSACTION_TYPE', 'NOT_IN', 'PIX;TED'), {
        transactionType: 'BOLETO',
      }),
    ).toBe(true);
  });

  it('REGEX inválida devolve falso em vez de lançar', () => {
    expect(
      evaluateCondition(cond('DESCRIPTION', 'REGEX', '([a-z'), input),
    ).toBe(false);
  });

  it('REGEX válida funciona sem diferenciar caixa', () => {
    expect(
      evaluateCondition(
        cond('DESCRIPTION', 'REGEX', '^coelba\\s+fatura'),
        input,
      ),
    ).toBe(true);
  });
});

describe('evaluateCondition — documentos', () => {
  it('compara CNPJ ignorando pontuação', () => {
    expect(
      evaluateCondition(cond('CNPJ', 'EQUALS', '11.222.333/0001-81'), {
        counterpartyDocument: '11222333000181',
      }),
    ).toBe(true);
  });
});

describe('evaluateCondition — numéricos', () => {
  it('GREATER_THAN e LESS_THAN', () => {
    expect(
      evaluateCondition(cond('AMOUNT', 'GREATER_THAN', '100'), { amount: 250 }),
    ).toBe(true);
    expect(
      evaluateCondition(cond('AMOUNT', 'LESS_THAN', '100'), { amount: 250 }),
    ).toBe(false);
  });

  it('BETWEEN é inclusivo e aceita limites invertidos', () => {
    expect(
      evaluateCondition(cond('AMOUNT', 'BETWEEN', '100', '500'), {
        amount: 500,
      }),
    ).toBe(true);
    expect(
      evaluateCondition(cond('AMOUNT', 'BETWEEN', '500', '100'), {
        amount: 250,
      }),
    ).toBe(true);
    expect(
      evaluateCondition(cond('AMOUNT', 'BETWEEN', '100', '500'), {
        amount: 900,
      }),
    ).toBe(false);
  });

  it('deriva dia da semana e dia do mês da data', () => {
    // 2026-07-30 é uma quinta-feira (getUTCDay() === 4).
    expect(
      evaluateCondition(cond('WEEKDAY', 'EQUALS', '4'), { date: '2026-07-30' }),
    ).toBe(true);
    expect(
      evaluateCondition(cond('DAY_OF_MONTH', 'EQUALS', '30'), {
        date: '2026-07-30',
      }),
    ).toBe(true);
  });

  it('operador de texto não se aplica a campo numérico', () => {
    expect(
      evaluateCondition(cond('AMOUNT', 'CONTAINS', '25'), { amount: 250 }),
    ).toBe(false);
  });
});

describe('evaluateCondition — EXISTS', () => {
  it('EXISTS distingue ausente de preenchido', () => {
    expect(
      evaluateCondition(cond('DOCUMENT_NUMBER', 'EXISTS', ''), {
        documentNumber: 'NF-1',
      }),
    ).toBe(true);
    expect(evaluateCondition(cond('DOCUMENT_NUMBER', 'EXISTS', ''), {})).toBe(
      false,
    );
  });

  it('NOT_EXISTS é o inverso', () => {
    expect(
      evaluateCondition(cond('DOCUMENT_NUMBER', 'NOT_EXISTS', ''), {}),
    ).toBe(true);
  });

  it('valor ausente reprova qualquer outro operador', () => {
    expect(evaluateCondition(cond('DESCRIPTION', 'CONTAINS', 'X'), {})).toBe(
      false,
    );
  });
});

describe('evaluateRule', () => {
  const input = { description: 'POSTO SHELL', amount: 250 };

  it('exige que todas as condições casem (E lógico)', () => {
    expect(
      evaluateRule(
        [
          cond('DESCRIPTION', 'CONTAINS', 'POSTO'),
          cond('AMOUNT', 'LESS_THAN', '1000'),
        ],
        input,
      ),
    ).toBe(true);
  });

  it('uma condição que falha reprova a regra inteira', () => {
    expect(
      evaluateRule(
        [
          cond('DESCRIPTION', 'CONTAINS', 'POSTO'),
          cond('AMOUNT', 'GREATER_THAN', '1000'),
        ],
        input,
      ),
    ).toBe(false);
  });

  it('regra sem condições nunca casa — evitaria aplicar-se a tudo', () => {
    expect(evaluateRule([], input)).toBe(false);
  });
});

describe('detectConflicts', () => {
  it('acusa conflito entre regras de mesma prioridade com categorias diferentes', () => {
    const conflicts = detectConflicts([
      {
        id: 'a',
        name: 'Combustível',
        priority: 10,
        actions: [{ categoryId: 'cat-1' }],
      },
      {
        id: 'b',
        name: 'Viagens',
        priority: 10,
        actions: [{ categoryId: 'cat-2' }],
      },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe('categoria');
    expect(conflicts[0].rules.map((r) => r.name).sort()).toEqual([
      'Combustível',
      'Viagens',
    ]);
  });

  it('não acusa conflito quando as prioridades diferem (há desempate)', () => {
    expect(
      detectConflicts([
        {
          id: 'a',
          name: 'A',
          priority: 10,
          actions: [{ categoryId: 'cat-1' }],
        },
        {
          id: 'b',
          name: 'B',
          priority: 20,
          actions: [{ categoryId: 'cat-2' }],
        },
      ]),
    ).toHaveLength(0);
  });

  it('não acusa conflito quando as regras concordam no mesmo valor', () => {
    expect(
      detectConflicts([
        {
          id: 'a',
          name: 'A',
          priority: 10,
          actions: [{ categoryId: 'cat-1' }],
        },
        {
          id: 'b',
          name: 'B',
          priority: 10,
          actions: [{ categoryId: 'cat-1' }],
        },
      ]),
    ).toHaveLength(0);
  });

  it('detecta conflito em dimensões diferentes de forma independente', () => {
    const conflicts = detectConflicts([
      {
        id: 'a',
        name: 'A',
        priority: 5,
        actions: [{ categoryId: 'cat-1', costCenterId: 'cc-1' }],
      },
      {
        id: 'b',
        name: 'B',
        priority: 5,
        actions: [{ categoryId: 'cat-2', costCenterId: 'cc-2' }],
      },
    ]);

    expect(conflicts.map((c) => c.field).sort()).toEqual([
      'categoria',
      'centro de custo',
    ]);
  });
});
