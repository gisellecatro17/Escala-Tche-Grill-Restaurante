/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks usam `any` propositalmente nos testes */
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { StructureDuplicationService } from './structure-duplication.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

const BASE_DTO = {
  sourceCompanyId: 'company-a',
  targetCompanyId: 'company-b',
  reason: 'Abertura da nova filial',
};

function emptyDelegate() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }: any) => ({
      id: `novo-${data.name}`,
      ...data,
    })),
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    company: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => ({
        id: where.id,
        organizationId: 'org-1',
        tradeName: where.id,
      })),
    },
    financialAccountPlan: emptyDelegate(),
    financialCategory: emptyDelegate(),
    costCenter: emptyDelegate(),
    resultCenter: emptyDelegate(),
    businessUnit: emptyDelegate(),
    financialTag: emptyDelegate(),
    ...overrides,
  } as any;

  const audit = { log: jest.fn() } as any;

  return {
    service: new StructureDuplicationService(prisma, audit),
    prisma,
    audit,
  };
}

describe('StructureDuplicationService', () => {
  it('recusa duplicar uma empresa para ela mesma', async () => {
    const { service } = buildService();

    await expect(
      service.duplicate({ ...BASE_DTO, targetCompanyId: 'company-a' }, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa duplicar entre organizações diferentes', async () => {
    const { service } = buildService({
      company: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => ({
          id: where.id,
          // A empresa de destino pertence a outra organização.
          organizationId: where.id === 'company-a' ? 'org-1' : 'org-2',
          tradeName: where.id,
        })),
      },
    });

    await expect(service.duplicate(BASE_DTO, actor)).rejects.toThrow(
      /mesma organização/i,
    );
  });

  it('devolve 404 quando a empresa de origem não existe', async () => {
    const { service } = buildService({
      company: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: any) =>
            where.id === 'company-a'
              ? null
              : { id: where.id, organizationId: 'org-1', tradeName: 'B' },
          ),
      },
    });

    await expect(service.duplicate(BASE_DTO, actor)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('copia as contas remapeando os pais para as cópias', async () => {
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findMany: jest
          .fn()
          // 1ª chamada: contas da origem. 2ª: as já existentes no destino.
          .mockResolvedValueOnce([
            {
              id: 'src-pai',
              code: '5',
              name: 'Despesas',
              parentAccountId: null,
              level: 0,
            },
            {
              id: 'src-filho',
              code: '5.01',
              name: 'Pessoal',
              parentAccountId: 'src-pai',
              level: 1,
            },
          ])
          .mockResolvedValueOnce([]),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: `novo-${data.code}`,
          ...data,
        })),
      },
    });

    const result = await service.duplicate(BASE_DTO, actor);

    const calls = prisma.financialAccountPlan.create.mock.calls;
    expect(calls[0][0].data.companyId).toBe('company-b');
    expect(calls[1][0].data.parentAccountId).toBe('novo-5');
    expect(
      result.reports.find((r) => r.registry === 'Plano de contas')?.copied,
    ).toBe(2);
  });

  it('nunca copia o histórico de uso das contas', async () => {
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'src-1',
              code: '5',
              name: 'Despesas',
              parentAccountId: null,
              level: 0,
              lastUsedAt: new Date('2026-01-01'),
            },
          ])
          .mockResolvedValueOnce([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'novo', ...data })),
      },
    });

    await service.duplicate(BASE_DTO, actor);

    expect(
      prisma.financialAccountPlan.create.mock.calls[0][0].data.lastUsedAt,
    ).toBeUndefined();
  });

  it('preserva o que já existe no destino em vez de sobrescrever', async () => {
    const { service, prisma, audit } = buildService({
      financialAccountPlan: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'src-1',
              code: '5',
              name: 'Despesas',
              parentAccountId: null,
              level: 0,
            },
          ])
          // Já existe uma conta "5" no destino.
          .mockResolvedValueOnce([{ id: 'destino-5', code: '5' }]),
        create: jest.fn(),
      },
    });

    const result = await service.duplicate(BASE_DTO, actor);

    expect(prisma.financialAccountPlan.create).not.toHaveBeenCalled();
    expect(
      result.reports.find((r) => r.registry === 'Plano de contas')?.skipped,
    ).toBe(1);
    // Nenhuma exclusão foi registrada na auditoria.
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('DELETE');
  });

  it('aponta os padrões da categoria para os registros copiados, não para os da origem', async () => {
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'src-acc',
              code: '5',
              name: 'Despesas',
              parentAccountId: null,
              level: 0,
            },
          ])
          .mockResolvedValueOnce([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'novo-acc', ...data })),
      },
      financialCategory: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'src-cat',
              name: 'Energia',
              code: '5.01',
              parentCategoryId: null,
              level: 0,
              accountPlanId: 'src-acc',
              defaultCostCenterId: 'cc-nao-copiado',
            },
          ])
          .mockResolvedValueOnce([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'nova-cat', ...data })),
      },
    });

    await service.duplicate(BASE_DTO, actor);

    const data = prisma.financialCategory.create.mock.calls[0][0].data;
    expect(data.accountPlanId).toBe('novo-acc');
    // O centro de custo não foi copiado: o campo fica nulo em vez de apontar para a origem.
    expect(data.defaultCostCenterId).toBeNull();
  });

  it('filtra apenas os ativos por padrão', async () => {
    const { service, prisma } = buildService();

    await service.duplicate(BASE_DTO, actor);

    expect(prisma.financialAccountPlan.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ structureStatus: 'ACTIVE', status: 'ACTIVE' }),
    );
  });

  it('inclui inativos quando pedido explicitamente', async () => {
    const { service, prisma } = buildService();

    await service.duplicate({ ...BASE_DTO, includeInactive: true }, actor);

    const where = prisma.financialAccountPlan.findMany.mock.calls[0][0].where;
    expect(where.structureStatus).toBeUndefined();
  });

  it('não copia cadastros opcionais que não foram marcados', async () => {
    const { service, prisma } = buildService();

    const result = await service.duplicate(BASE_DTO, actor);

    // Unidades, tags, rateios e regras só entram quando marcados.
    expect(prisma.businessUnit.findMany).not.toHaveBeenCalled();
    expect(prisma.financialTag.findMany).not.toHaveBeenCalled();
    expect(result.reports.map((report) => report.registry)).not.toContain(
      'Tags',
    );
  });

  it('copia as tags sem os vínculos da empresa de origem', async () => {
    const { service, prisma } = buildService({
      financialTag: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'src-tag', name: 'Sazonal', slug: 'sazonal', color: '#fff' },
          ])
          .mockResolvedValueOnce([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'nova-tag', ...data })),
      },
    });

    await service.duplicate({ ...BASE_DTO, financialTags: true }, actor);

    const data = prisma.financialTag.create.mock.calls[0][0].data;
    expect(data.name).toBe('Sazonal');
    expect(data.links).toBeUndefined();
  });

  it('registra na auditoria o motivo e a empresa de origem', async () => {
    const { service, audit } = buildService();

    await service.duplicate(BASE_DTO, actor);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DUPLICATE_STRUCTURE',
        companyId: 'company-b',
        oldValue: { sourceCompanyId: 'company-a' },
        reason: 'Abertura da nova filial',
      }),
    );
  });

  it('deixa explícito na resposta o que nunca é copiado', async () => {
    const { service } = buildService();

    const result = await service.duplicate(BASE_DTO, actor);

    expect(result.notCopied).toEqual(
      expect.arrayContaining([
        'lançamentos',
        'saldos',
        'conciliações',
        'histórico de uso',
        'auditoria da empresa de origem',
      ]),
    );
  });
});
