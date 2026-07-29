/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { AllocationRulesService } from './allocation-rules.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    allocationRule: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'rule-1',
        companyId: 'company-1',
        criterion: 'PERCENTAGE',
        name: 'Rateio de energia',
        lines: [],
      }),
      create: jest.fn().mockImplementation(({ data }: any) => ({
        id: 'rule-1',
        ...data,
        lines: [],
      })),
      update: jest.fn(),
    },
    allocationRuleLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    category: { count: jest.fn().mockResolvedValue(0) },
    classificationRule: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;

  return {
    service: new AllocationRulesService(prismaMock, audit),
    prisma: prismaMock,
  };
}

const baseDto = {
  companyId: 'company-1',
  name: 'Rateio de energia',
  criterion: 'PERCENTAGE' as const,
};

describe('AllocationRulesService', () => {
  it('aceita um rateio percentual que fecha exatamente 100%', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          lines: [
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-1',
              percentage: 60,
            },
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-2',
              percentage: 40,
            },
          ],
        } as any,
        actor,
      ),
    ).resolves.toBeDefined();
  });

  it('recusa um rateio percentual cuja soma não fecha 100%', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          lines: [
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-1',
              percentage: 60,
            },
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-2',
              percentage: 30,
            },
          ],
        } as any,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('tolera arredondamento de centésimos (33,33 + 33,33 + 33,34)', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          lines: [
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-1',
              percentage: 33.33,
            },
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-2',
              percentage: 33.33,
            },
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-3',
              percentage: 33.34,
            },
          ],
        } as any,
        actor,
      ),
    ).resolves.toBeDefined();
  });

  it('exige o destino correspondente ao tipo da linha', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          // targetType PROJECT, mas informou costCenterId — o projeto está faltando.
          lines: [
            {
              targetType: 'PROJECT' as any,
              costCenterId: 'cc-1',
              percentage: 100,
            },
          ],
        } as any,
        actor,
      ),
    ).rejects.toThrow(/projeto/i);
  });

  it('recusa o mesmo destino repetido no rateio', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          lines: [
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-1',
              percentage: 50,
            },
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-1',
              percentage: 50,
            },
          ],
        } as any,
        actor,
      ),
    ).rejects.toThrow(/mais de uma vez/i);
  });

  it('exige o peso quando o critério é por horas', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          criterion: 'HOURS' as any,
          lines: [{ targetType: 'COST_CENTER' as any, costCenterId: 'cc-1' }],
        } as any,
        actor,
      ),
    ).rejects.toThrow(/quantidade\/peso/i);
  });

  it('não valida 100% quando o critério é por valor fixo', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...baseDto,
          criterion: 'FIXED_AMOUNT' as any,
          lines: [
            {
              targetType: 'COST_CENTER' as any,
              costCenterId: 'cc-1',
              fixedAmount: 300,
            },
          ],
        } as any,
        actor,
      ),
    ).resolves.toBeDefined();
  });

  it('bloqueia a exclusão de um rateio em uso por uma categoria', async () => {
    const { service } = buildService({
      category: { count: jest.fn().mockResolvedValue(1) },
    });

    await expect(service.remove('rule-1', actor)).rejects.toThrow(
      ConflictException,
    );
  });
});
