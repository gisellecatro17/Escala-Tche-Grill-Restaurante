import { EntryClassificationService } from './entry-classification.service';

function buildService(
  options: {
    simulation?: unknown;
    category?: unknown;
  } = {},
) {
  const prisma = {
    financialCategory: {
      findUnique: jest.fn().mockResolvedValue(options.category ?? null),
    },
  };

  const rules = {
    simulate: jest
      .fn()
      .mockResolvedValue(
        options.simulation ?? { appliedRule: null, classification: null },
      ),
  };

  return {
    service: new EntryClassificationService(prisma as never, rules as never),
    rules,
    prisma,
  };
}

function buildDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    companyId: 'company-1',
    description: 'ENERGIA ELETRICA JULHO',
    displayName: null,
    issuerName: 'Coelba',
    issuerDocument: '31500900000106',
    documentNumber: '2026080001',
    grossAmount: 2450,
    categoryId: null,
    subcategoryId: null,
    accountPlanId: null,
    costCenterId: null,
    resultCenterId: null,
    projectId: null,
    businessUnitId: null,
    financialNatureId: null,
    ...overrides,
  } as never;
}

function buildLink(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    defaultCategoryId: null,
    defaultSubcategoryId: null,
    defaultCostCenterId: null,
    defaultDescription: null,
    defaultHistory: null,
    ...overrides,
  } as never;
}

const AUTO_ON = { autoClassificationEnabled: true };
const AUTO_OFF = { autoClassificationEnabled: false };

describe('Classificação do lançamento', () => {
  it('preserva o que a pessoa já escolheu na revisão do documento', async () => {
    const { service, rules } = buildService({
      simulation: {
        appliedRule: { id: 'rule-1' },
        classification: { category: { id: 'categoria-da-regra' } },
      },
    });

    const result = await service.resolve(
      buildDocument({ categoryId: 'categoria-escolhida' }),
      null,
      AUTO_ON,
    );

    expect(rules.simulate).toHaveBeenCalled();
    expect(result.values.categoryId).toBe('categoria-escolhida');
    expect(result.sources.categoryId).toBe('DOCUMENT');
  });

  it('aplica a regra automática nas dimensões que o documento deixou vazias', async () => {
    const { service } = buildService({
      simulation: {
        appliedRule: { id: 'rule-1' },
        classification: {
          category: { id: 'cat-regra' },
          costCenter: { id: 'cc-regra' },
        },
      },
    });

    const result = await service.resolve(buildDocument(), null, AUTO_ON);

    expect(result.values.categoryId).toBe('cat-regra');
    expect(result.values.costCenterId).toBe('cc-regra');
    expect(result.sources.categoryId).toBe('CLASSIFICATION_RULE');
    expect(result.appliedClassificationRuleId).toBe('rule-1');
  });

  it('não consulta a regra automática quando a empresa desligou o recurso', async () => {
    const { service, rules } = buildService({
      simulation: {
        appliedRule: { id: 'rule-1' },
        classification: { category: { id: 'cat-regra' } },
      },
    });

    const result = await service.resolve(buildDocument(), null, AUTO_OFF);

    expect(rules.simulate).not.toHaveBeenCalled();
    expect(result.values.categoryId).toBeUndefined();
  });

  it('mistura origens: regra decide o centro de custo, documento decide a categoria', async () => {
    const { service } = buildService({
      simulation: {
        appliedRule: { id: 'rule-1' },
        classification: {
          category: { id: 'cat-regra' },
          costCenter: { id: 'cc-regra' },
        },
      },
    });

    const result = await service.resolve(
      buildDocument({ categoryId: 'cat-documento' }),
      null,
      AUTO_ON,
    );

    expect(result.sources).toMatchObject({
      categoryId: 'DOCUMENT',
      costCenterId: 'CLASSIFICATION_RULE',
    });
  });

  it('cai para os padrões do vínculo do fornecedor quando nenhuma regra casa', async () => {
    const { service } = buildService();

    const result = await service.resolve(
      buildDocument(),
      buildLink({
        defaultCategoryId: 'cat-vinculo',
        defaultCostCenterId: 'cc-vinculo',
        defaultDescription: 'Energia elétrica',
      }),
      AUTO_ON,
    );

    expect(result.values.categoryId).toBe('cat-vinculo');
    expect(result.sources.costCenterId).toBe('SUPPLIER_DEFAULT');
    expect(result.description).toBe('Energia elétrica');
  });

  it('a regra vence o padrão do vínculo', async () => {
    const { service } = buildService({
      simulation: {
        appliedRule: { id: 'rule-1' },
        classification: { category: { id: 'cat-regra' } },
      },
    });

    const result = await service.resolve(
      buildDocument(),
      buildLink({ defaultCategoryId: 'cat-vinculo' }),
      AUTO_ON,
    );

    expect(result.values.categoryId).toBe('cat-regra');
    expect(result.sources.categoryId).toBe('CLASSIFICATION_RULE');
  });

  it('completa plano de contas e natureza a partir da categoria escolhida', async () => {
    const { service } = buildService({
      category: {
        accountPlanId: 'plano-da-categoria',
        financialNatureId: 'natureza-da-categoria',
        defaultCostCenterId: null,
        defaultAllocationRuleId: 'rateio-da-categoria',
      },
    });

    const result = await service.resolve(
      buildDocument({ categoryId: 'cat-1' }),
      null,
      AUTO_ON,
    );

    expect(result.values.accountPlanId).toBe('plano-da-categoria');
    expect(result.sources.financialNatureId).toBe('CATEGORY_DEFAULT');
    expect(result.appliedAllocationRuleId).toBe('rateio-da-categoria');
  });

  it('não busca padrões de categoria quando nenhuma categoria foi resolvida', async () => {
    const { service, prisma } = buildService();

    await service.resolve(buildDocument(), null, AUTO_ON);

    expect(prisma.financialCategory.findUnique).not.toHaveBeenCalled();
  });

  it('registra a origem de toda dimensão preenchida', async () => {
    const { service } = buildService({
      simulation: {
        appliedRule: { id: 'rule-1' },
        classification: { project: { id: 'proj-1' } },
      },
    });

    const result = await service.resolve(
      buildDocument({ businessUnitId: 'un-1' }),
      buildLink({ defaultCostCenterId: 'cc-1' }),
      AUTO_ON,
    );

    for (const dimension of Object.keys(result.values)) {
      expect(result.sources[dimension as never]).toBeDefined();
    }
  });

  it('usa a descrição do documento quando nem regra nem vínculo trazem uma', async () => {
    const { service } = buildService();

    const result = await service.resolve(buildDocument(), null, AUTO_ON);

    expect(result.description).toBe('ENERGIA ELETRICA JULHO');
  });
});
