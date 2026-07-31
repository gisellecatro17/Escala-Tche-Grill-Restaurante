import { BadRequestException } from '@nestjs/common';

import { AllocationApplicationService } from './allocation-application.service';

function buildService(rule: unknown) {
  const prisma = {
    allocationRule: { findFirst: jest.fn().mockResolvedValue(rule) },
  };

  return new AllocationApplicationService(prisma as never);
}

function item(overrides: Record<string, unknown>) {
  return {
    targetType: 'COST_CENTER',
    costCenterId: null,
    resultCenterId: null,
    projectId: null,
    businessUnitId: null,
    categoryId: null,
    accountPlanId: null,
    percentage: null,
    fixedAmount: null,
    weight: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe('Aplicação do rateio no lançamento', () => {
  it('não rateia quando não há regra', async () => {
    const service = buildService(null);

    await expect(service.materialize(null, 1000)).resolves.toEqual([]);
  });

  it('distribui por percentual e fecha exatamente com o valor do título', async () => {
    const service = buildService({
      name: 'Energia',
      criterion: 'PERCENTAGE',
      items: [
        item({ percentage: 60, costCenterId: 'cc-1', sortOrder: 0 }),
        item({ percentage: 40, costCenterId: 'cc-2', sortOrder: 1 }),
      ],
    });

    const result = await service.materialize('rule-1', 1000);

    expect(result.map((line) => line.amount)).toEqual([600, 400]);
    expect(result.reduce((sum, line) => sum + line.amount, 0)).toBe(1000);
  });

  it('joga a sobra de arredondamento na última linha', async () => {
    const service = buildService({
      name: 'Três centros',
      criterion: 'PERCENTAGE',
      items: [
        item({ percentage: 33.3333, sortOrder: 0 }),
        item({ percentage: 33.3333, sortOrder: 1 }),
        item({ percentage: 33.3334, sortOrder: 2 }),
      ],
    });

    const result = await service.materialize('rule-1', 100);

    expect(result.reduce((sum, line) => sum + line.amount, 0)).toBe(100);
  });

  it('recusa regra que não soma 100%', async () => {
    const service = buildService({
      name: 'Incompleta',
      criterion: 'PERCENTAGE',
      items: [item({ percentage: 60 }), item({ percentage: 30 })],
    });

    await expect(service.materialize('rule-1', 1000)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.materialize('rule-1', 1000)).rejects.toThrow('90.00%');
  });

  it('converte valor fixo em percentual do título', async () => {
    const service = buildService({
      name: 'Fixo',
      criterion: 'FIXED_AMOUNT',
      items: [item({ fixedAmount: 250 }), item({ fixedAmount: 750 })],
    });

    const result = await service.materialize('rule-1', 1000);

    expect(result.map((line) => line.percentage)).toEqual([25, 75]);
    expect(result.map((line) => line.amount)).toEqual([250, 750]);
  });

  it('deriva o percentual dos pesos em critérios não percentuais', async () => {
    const service = buildService({
      name: 'Por metragem',
      criterion: 'AREA',
      items: [item({ weight: 30 }), item({ weight: 70 })],
    });

    const result = await service.materialize('rule-1', 500);

    expect(result.map((line) => line.percentage)).toEqual([30, 70]);
    expect(result.map((line) => line.amount)).toEqual([150, 350]);
  });

  it('recusa rateio por peso quando não há peso informado', async () => {
    const service = buildService({
      name: 'Sem pesos',
      criterion: 'HOURS',
      items: [item({ weight: 0 }), item({ weight: 0 })],
    });

    await expect(service.materialize('rule-1', 500)).rejects.toThrow(
      'não tem pesos informados',
    );
  });

  it('recusa rateio por valor fixo em lançamento sem valor', async () => {
    const service = buildService({
      name: 'Fixo',
      criterion: 'FIXED_AMOUNT',
      items: [item({ fixedAmount: 100 })],
    });

    await expect(service.materialize('rule-1', 0)).rejects.toThrow(
      'valor maior que zero',
    );
  });

  it('preserva a dimensão de destino de cada linha', async () => {
    const service = buildService({
      name: 'Misto',
      criterion: 'PERCENTAGE',
      items: [
        item({
          targetType: 'PROJECT',
          projectId: 'proj-1',
          percentage: 50,
          sortOrder: 0,
        }),
        item({
          targetType: 'RESULT_CENTER',
          resultCenterId: 'rc-1',
          percentage: 50,
          sortOrder: 1,
        }),
      ],
    });

    const result = await service.materialize('rule-1', 200);

    expect(result[0]).toMatchObject({
      targetType: 'PROJECT',
      projectId: 'proj-1',
      amount: 100,
    });
    expect(result[1]).toMatchObject({
      targetType: 'RESULT_CENTER',
      resultCenterId: 'rc-1',
      amount: 100,
    });
  });

  it('ignora regra sem linhas em vez de gerar rateio vazio no lançamento', async () => {
    const service = buildService({
      name: 'Vazia',
      criterion: 'PERCENTAGE',
      items: [],
    });

    await expect(service.materialize('rule-1', 100)).resolves.toEqual([]);
  });
});
