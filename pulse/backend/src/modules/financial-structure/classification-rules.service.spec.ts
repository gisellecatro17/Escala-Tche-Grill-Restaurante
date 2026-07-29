/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks usam `any` propositalmente nos testes */
import { BadRequestException } from '@nestjs/common';

import { ClassificationRulesService } from './classification-rules.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    companyId: 'company-1',
    name: 'Fatura COELBA',
    matchField: 'DESCRIPTION',
    matchType: 'CONTAINS',
    matchValue: 'COELBA',
    caseSensitive: false,
    minAmount: null,
    maxAmount: null,
    origin: 'ANY',
    priority: 100,
    autoApply: false,
    confidenceThreshold: 95,
    category: { id: 'cat-1', name: 'Energia' },
    costCenter: { id: 'cc-1', name: 'Administrativo' },
    accountPlan: null,
    resultCenter: null,
    project: null,
    businessUnit: null,
    financialNature: { id: 'nat-1', name: 'Despesa', kind: 'EXPENSE' },
    allocationRule: null,
    appliedDescription: null,
    appliedHistory: null,
    ...overrides,
  };
}

function buildService(rules: Record<string, unknown>[] = [rule()]) {
  const prisma = {
    classificationRule: {
      findMany: jest.fn().mockResolvedValue(rules),
      findFirst: jest.fn().mockResolvedValue(rules[0] ?? null),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'new', ...data })),
      update: jest.fn(),
    },
  } as any;
  const audit = { log: jest.fn() } as any;

  return { service: new ClassificationRulesService(prisma, audit), prisma };
}

const baseInput = {
  companyId: 'company-1',
  description: 'COELBA FATURA 09/2026',
};

describe('ClassificationRulesService.simulate', () => {
  it('aplica a regra que casa e devolve a classificação sugerida', async () => {
    const { service } = buildService();

    const result = await service.simulate(baseInput);

    expect(result.matchedCount).toBe(1);
    expect(result.appliedRule?.name).toBe('Fatura COELBA');
    expect(result.classification?.category).toEqual({
      id: 'cat-1',
      name: 'Energia',
    });
  });

  it('nunca persiste nada — apenas simula', async () => {
    const { service, prisma } = buildService();

    const result = await service.simulate(baseInput);

    expect(result.persisted).toBe(false);
    expect(prisma.classificationRule.create).not.toHaveBeenCalled();
    expect(prisma.classificationRule.update).not.toHaveBeenCalled();
  });

  it('não casa quando a descrição não contém o padrão', async () => {
    const { service } = buildService();

    const result = await service.simulate({
      companyId: 'company-1',
      description: 'EMBASA FATURA',
    });

    expect(result.matchedCount).toBe(0);
    expect(result.appliedRule).toBeNull();
  });

  it('ignora maiúsculas/minúsculas quando caseSensitive é falso', async () => {
    const { service } = buildService();

    const result = await service.simulate({
      companyId: 'company-1',
      description: 'coelba fatura',
    });

    expect(result.matchedCount).toBe(1);
  });

  it('respeita caseSensitive quando ativado', async () => {
    const { service } = buildService([rule({ caseSensitive: true })]);

    const result = await service.simulate({
      companyId: 'company-1',
      description: 'coelba fatura',
    });

    expect(result.matchedCount).toBe(0);
  });

  it('a regra de menor prioridade numérica vence e as demais ficam listadas', async () => {
    const { service } = buildService([
      rule({ id: 'a', name: 'Genérica', priority: 10 }),
      rule({ id: 'b', name: 'Específica', priority: 50 }),
    ]);

    const result = await service.simulate(baseInput);

    expect(result.appliedRule?.name).toBe('Genérica');
    expect(result.otherMatches).toHaveLength(1);
    expect(result.otherMatches[0].name).toBe('Específica');
  });

  it('filtra pela faixa de valor da regra', async () => {
    const { service } = buildService([
      rule({ minAmount: 100, maxAmount: 500 }),
    ]);

    const dentro = await service.simulate({ ...baseInput, amount: 250 });
    const fora = await service.simulate({ ...baseInput, amount: 900 });

    expect(dentro.matchedCount).toBe(1);
    expect(fora.matchedCount).toBe(0);
  });

  it('filtra pela origem do lançamento', async () => {
    const { service } = buildService([rule({ origin: 'PIX' })]);

    const pix = await service.simulate({ ...baseInput, origin: 'PIX' } as any);
    const boleto = await service.simulate({
      ...baseInput,
      origin: 'BOLETO',
    } as any);

    expect(pix.matchedCount).toBe(1);
    expect(boleto.matchedCount).toBe(0);
  });

  it('compara documentos ignorando pontuação', async () => {
    const { service } = buildService([
      rule({
        matchField: 'COUNTERPARTY_DOCUMENT',
        matchType: 'DOCUMENT_NUMBER',
        matchValue: '11.222.333/0001-81',
      }),
    ]);

    const result = await service.simulate({
      companyId: 'company-1',
      description: 'x',
      counterpartyDocument: '11222333000181',
    });

    expect(result.matchedCount).toBe(1);
  });

  it('uma expressão regular inválida gravada no passado não derruba a simulação', async () => {
    const { service } = buildService([
      rule({ matchType: 'REGEX', matchValue: '([a-z' }),
    ]);

    await expect(service.simulate(baseInput as any)).resolves.toMatchObject({
      matchedCount: 0,
    });
  });
});

describe('ClassificationRulesService.create', () => {
  it('recusa uma expressão regular inválida', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          companyId: 'company-1',
          name: 'Regex quebrada',
          matchType: 'REGEX' as any,
          matchValue: '([a-z',
        } as any,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa uma faixa de valores invertida', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          companyId: 'company-1',
          name: 'Faixa invertida',
          matchValue: 'X',
          minAmount: 500,
          maxAmount: 100,
        } as any,
        actor,
      ),
    ).rejects.toThrow(/maior ou igual/i);
  });
});
