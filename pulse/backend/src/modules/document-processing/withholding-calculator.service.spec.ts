/* eslint-disable @typescript-eslint/no-unsafe-assignment -- mocks do jest sao `any` por natureza */
import { WithholdingCalculatorService } from './withholding-calculator.service';

function buildService(registered: unknown[]) {
  const prisma = {
    supplierTaxWithholding: {
      findMany: jest.fn().mockResolvedValue(registered),
    },
  };

  return new WithholdingCalculatorService(prisma as never);
}

function withholding(overrides: Record<string, unknown>) {
  return {
    id: 'wh-1',
    taxType: 'IRRF',
    rate: null,
    minimumAmount: null,
    ...overrides,
  };
}

describe('Cálculo de retenções', () => {
  it('não calcula nada sem vínculo de fornecedor', async () => {
    const service = buildService([]);

    await expect(service.calculate(null, 10_000)).resolves.toEqual([]);
  });

  it('aplica a alíquota do cadastro sobre o valor bruto', async () => {
    const service = buildService([withholding({ taxType: 'IRRF', rate: 1.5 })]);

    const result = await service.calculate('link-1', 8900);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      taxType: 'IRRF',
      calculationBase: 8900,
      rate: 1.5,
      amount: 133.5,
    });
  });

  it('calcula várias retenções do mesmo vínculo', async () => {
    const service = buildService([
      withholding({ id: 'a', taxType: 'IRRF', rate: 1.5 }),
      withholding({ id: 'b', taxType: 'ISS', rate: 5 }),
      withholding({ id: 'c', taxType: 'INSS', rate: 11 }),
    ]);

    const result = await service.calculate('link-1', 1000);

    expect(result.map((item) => item.amount)).toEqual([15, 50, 110]);
  });

  it('ignora retenção sem alíquota cadastrada em vez de arbitrar uma', async () => {
    const service = buildService([withholding({ rate: null })]);

    await expect(service.calculate('link-1', 1000)).resolves.toEqual([]);
  });

  it('não retém abaixo do valor mínimo do cadastro', async () => {
    const service = buildService([
      withholding({ taxType: 'IRRF', rate: 1.5, minimumAmount: 10 }),
    ]);

    // 1,5% de 500 = 7,50, abaixo do mínimo de 10.
    await expect(service.calculate('link-1', 500)).resolves.toEqual([]);
  });

  it('retém quando o valor calculado alcança o mínimo', async () => {
    const service = buildService([
      withholding({ taxType: 'IRRF', rate: 1.5, minimumAmount: 10 }),
    ]);

    const result = await service.calculate('link-1', 1000);

    expect(result[0].amount).toBe(15);
    expect(result[0].minimumAmount).toBe(10);
  });

  it('arredonda o valor retido para centavos', async () => {
    const service = buildService([withholding({ taxType: 'PIS', rate: 0.65 })]);

    const result = await service.calculate('link-1', 1234.56);

    expect(result[0].amount).toBe(8.02);
  });

  it('descarta retenção que resultaria em zero', async () => {
    const service = buildService([withholding({ taxType: 'ISS', rate: 0 })]);

    await expect(service.calculate('link-1', 1000)).resolves.toEqual([]);
  });

  it('guarda a retenção de origem para o lançamento poder apontar de onde veio', async () => {
    const service = buildService([
      withholding({ id: 'origem-1', taxType: 'CSLL', rate: 1 }),
    ]);

    const result = await service.calculate('link-1', 2000);

    expect(result[0].supplierTaxWithholdingId).toBe('origem-1');
  });

  it('só considera retenções ativas e não excluídas', async () => {
    const service = buildService([]);
    await service.calculate('link-1', 1000);

    const prisma = (
      service as unknown as {
        prisma: { supplierTaxWithholding: { findMany: jest.Mock } };
      }
    ).prisma;

    expect(prisma.supplierTaxWithholding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierCompanyLinkId: 'link-1',
          deletedAt: null,
          status: 'ACTIVE',
        }),
      }),
    );
  });
});
