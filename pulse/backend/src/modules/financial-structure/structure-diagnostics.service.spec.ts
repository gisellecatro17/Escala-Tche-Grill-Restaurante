/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- mocks usam `any` propositalmente nos testes */
import { StructureDiagnosticsService } from './structure-diagnostics.service';

/**
 * Delegate vazio: cada verificação recebe `[]` por padrão, e o teste sobrescreve apenas
 * a consulta da inconsistência que quer provar. Assim nenhum teste depende de achados
 * acidentais de outra verificação.
 */
function emptyDelegate() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    financialCategory: emptyDelegate(),
    financialAccountPlan: emptyDelegate(),
    financialAccountPlanVersion: emptyDelegate(),
    costCenter: emptyDelegate(),
    resultCenter: emptyDelegate(),
    project: emptyDelegate(),
    classificationRule: emptyDelegate(),
    allocationRule: emptyDelegate(),
    ...overrides,
  } as any;

  return { service: new StructureDiagnosticsService(prisma), prisma };
}

describe('StructureDiagnosticsService', () => {
  it('não relata nada quando a estrutura está consistente', async () => {
    const { service } = buildService();

    const result = await service.run('org-1', 'company-1');

    expect(result.total).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('aponta conta analítica com filhas como crítica', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        ...emptyDelegate(),
        findMany: jest
          .fn()
          // 1ª consulta: analíticas com filhas. As demais recebem [].
          .mockResolvedValueOnce([
            { id: 'acc-1', code: '5.01', name: 'Pessoal' },
          ])
          .mockResolvedValue([]),
      },
    });

    const result = await service.run('org-1', 'company-1');

    const finding = result.findings.find(
      (f) => f.code === 'ANALYTIC_WITH_CHILDREN',
    );
    expect(finding?.severity).toBe('CRITICAL');
    expect(finding?.affected).toEqual([{ id: 'acc-1', label: '5.01 Pessoal' }]);
    expect(result.summary.critical).toBe(1);
  });

  it('aponta rateio percentual que não fecha 100%', async () => {
    const { service } = buildService({
      allocationRule: {
        ...emptyDelegate(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rule-1',
            name: 'Rateio administrativo',
            criterion: 'PERCENTAGE',
            items: [{ percentage: 40 }, { percentage: 40 }],
          },
        ]),
      },
    });

    const result = await service.run('org-1', 'company-1');

    const finding = result.findings.find(
      (f) => f.code === 'ALLOCATION_NOT_100',
    );
    expect(finding?.affected[0].label).toContain('80.00%');
  });

  it('aceita 33,33 + 33,33 + 33,34 como rateio fechado', async () => {
    const { service } = buildService({
      allocationRule: {
        ...emptyDelegate(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rule-1',
            name: 'Rateio em três',
            criterion: 'PERCENTAGE',
            items: [
              { percentage: 33.33 },
              { percentage: 33.33 },
              { percentage: 33.34 },
            ],
          },
        ]),
      },
    });

    const result = await service.run('org-1', 'company-1');

    expect(
      result.findings.find((f) => f.code === 'ALLOCATION_NOT_100'),
    ).toBeUndefined();
  });

  it('detecta códigos equivalentes que escapam da constraint de unicidade', async () => {
    const { service } = buildService({
      financialCategory: {
        ...emptyDelegate(),
        findMany: jest
          .fn()
          // 1ª consulta: categorias sem conta vinculada.
          .mockResolvedValueOnce([])
          // 2ª consulta: códigos para checagem de duplicidade.
          .mockResolvedValueOnce([
            {
              id: 'cat-1',
              name: 'Energia',
              code: '5.02',
              normalizedCode: '5.2',
            },
            { id: 'cat-2', name: 'Luz', code: '05.2', normalizedCode: '5.2' },
          ])
          .mockResolvedValue([]),
      },
    });

    const result = await service.run('org-1', 'company-1');

    const finding = result.findings.find((f) => f.code === 'DUPLICATE_CODE');
    expect(finding?.affected).toHaveLength(2);
  });

  it('avisa quando existem contas mas nenhuma versão ativa', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        ...emptyDelegate(),
        count: jest.fn().mockResolvedValue(42),
      },
      financialAccountPlanVersion: {
        ...emptyDelegate(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    const result = await service.run('org-1', 'company-1');

    expect(
      result.findings.find((f) => f.code === 'NO_ACTIVE_VERSION'),
    ).toBeDefined();
  });

  it('ordena os achados com os críticos primeiro', async () => {
    const { service } = buildService({
      // INFO: centro de custo sem responsável.
      costCenter: {
        ...emptyDelegate(),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'cc-1', name: 'Administrativo' }])
          .mockResolvedValue([]),
      },
      // CRITICAL: conta sintética aceitando lançamentos.
      financialAccountPlan: {
        ...emptyDelegate(),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'acc-9', code: '5', name: 'Despesas' }])
          .mockResolvedValue([]),
      },
    });

    const result = await service.run('org-1', 'company-1');

    expect(result.findings[0].severity).toBe('CRITICAL');
    expect(result.findings.at(-1)!.severity).toBe('INFO');
  });

  it('pula as verificações por empresa quando nenhuma empresa é informada', async () => {
    const { service, prisma } = buildService();

    await service.run('org-1');

    expect(prisma.costCenter.findMany).not.toHaveBeenCalled();
    expect(prisma.classificationRule.findMany).not.toHaveBeenCalled();
  });
});
