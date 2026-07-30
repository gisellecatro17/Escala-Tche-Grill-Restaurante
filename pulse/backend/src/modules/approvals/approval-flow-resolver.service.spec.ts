import { ApprovalFlowResolverService } from './approval-flow-resolver.service';

function buildService(flows: unknown[]) {
  const prisma = {
    approvalFlow: { findMany: jest.fn().mockResolvedValue(flows) },
  };

  return new ApprovalFlowResolverService(prisma as never);
}

function flow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'flow-1',
    name: 'Padrão',
    priority: 100,
    categoryId: null,
    costCenterId: null,
    projectId: null,
    businessUnitId: null,
    financialNatureId: null,
    contractId: null,
    supplierId: null,
    paymentMethodId: null,
    documentType: null,
    direction: null,
    minimumAmount: null,
    maximumAmount: null,
    minimumPriority: null,
    steps: [{ id: 'step-1', stepOrder: 1 }],
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    companyId: 'company-1',
    netAmount: 5000,
    direction: 'PAYABLE',
    categoryId: 'cat-1',
    costCenterId: 'cc-1',
    projectId: null,
    businessUnitId: null,
    financialNatureId: null,
    supplierId: 'sup-1',
    paymentMethodId: null,
    ...overrides,
  } as never;
}

const CONTEXT = { documentType: null, contractIds: [] };

describe('Seleção do fluxo de aprovação', () => {
  it('devolve nulo quando nenhum fluxo está cadastrado', async () => {
    const service = buildService([]);

    await expect(
      service.resolve(entry(), 'NORMAL', CONTEXT),
    ).resolves.toBeNull();
  });

  it('ignora fluxo sem etapas — ele criaria uma solicitação que ninguém decide', async () => {
    const service = buildService([flow({ steps: [] })]);

    await expect(
      service.resolve(entry(), 'NORMAL', CONTEXT),
    ).resolves.toBeNull();
  });

  it('um fluxo sem critérios é o padrão da empresa', async () => {
    const service = buildService([flow()]);

    const result = await service.resolve(entry(), 'NORMAL', CONTEXT);

    expect(result?.id).toBe('flow-1');
  });

  it('recusa fluxo cujo critério de categoria não bate', async () => {
    const service = buildService([flow({ categoryId: 'outra-categoria' })]);

    await expect(
      service.resolve(entry(), 'NORMAL', CONTEXT),
    ).resolves.toBeNull();
  });

  it('respeita a faixa de valor do fluxo', async () => {
    const service = buildService([flow({ minimumAmount: 10_000 })]);

    await expect(
      service.resolve(entry({ netAmount: 5000 }), 'NORMAL', CONTEXT),
    ).resolves.toBeNull();

    await expect(
      service.resolve(entry({ netAmount: 20_000 }), 'NORMAL', CONTEXT),
    ).resolves.not.toBeNull();
  });

  it('a prioridade configurada decide entre dois fluxos que casam', async () => {
    const service = buildService([
      flow({ id: 'generico', priority: 100 }),
      flow({ id: 'preferido', priority: 10 }),
    ]);

    const result = await service.resolve(entry(), 'NORMAL', CONTEXT);

    expect(result?.id).toBe('preferido');
  });

  it('empatada a prioridade, vence o fluxo mais específico', async () => {
    const service = buildService([
      flow({ id: 'generico', priority: 50 }),
      flow({
        id: 'especifico',
        priority: 50,
        categoryId: 'cat-1',
        supplierId: 'sup-1',
      }),
    ]);

    const result = await service.resolve(entry(), 'NORMAL', CONTEXT);

    expect(result?.id).toBe('especifico');
  });

  it('casa pela direção do lançamento', async () => {
    const service = buildService([flow({ direction: 'RECEIVABLE' })]);

    await expect(
      service.resolve(entry(), 'NORMAL', CONTEXT),
    ).resolves.toBeNull();
  });

  it('casa pelo tipo do documento de origem', async () => {
    const service = buildService([flow({ documentType: 'NFE' })]);

    await expect(
      service.resolve(entry(), 'NORMAL', {
        documentType: 'BOLETO',
        contractIds: [],
      }),
    ).resolves.toBeNull();

    await expect(
      service.resolve(entry(), 'NORMAL', {
        documentType: 'NFE',
        contractIds: [],
      }),
    ).resolves.not.toBeNull();
  });

  it('casa pelo contrato ativo do vínculo do fornecedor', async () => {
    const service = buildService([flow({ contractId: 'contrato-1' })]);

    await expect(
      service.resolve(entry(), 'NORMAL', {
        documentType: null,
        contractIds: [],
      }),
    ).resolves.toBeNull();

    await expect(
      service.resolve(entry(), 'NORMAL', {
        documentType: null,
        contractIds: ['contrato-1'],
      }),
    ).resolves.not.toBeNull();
  });

  it('só aplica o fluxo de urgência a solicitações urgentes o bastante', async () => {
    const service = buildService([flow({ minimumPriority: 'HIGH' })]);

    await expect(
      service.resolve(entry(), 'NORMAL', CONTEXT),
    ).resolves.toBeNull();
    await expect(
      service.resolve(entry(), 'URGENT', CONTEXT),
    ).resolves.not.toBeNull();
  });
});

describe('Alçadas — etapas aplicáveis por faixa de valor', () => {
  const service = buildService([]);

  const steps = [
    { id: 'a', name: 'Supervisor', minimumAmount: null, maximumAmount: 1000 },
    { id: 'b', name: 'Gerente', minimumAmount: 1000.01, maximumAmount: 10_000 },
    { id: 'c', name: 'Diretor', minimumAmount: 10_000.01, maximumAmount: null },
    { id: 'd', name: 'Sócio', minimumAmount: 100_000.01, maximumAmount: null },
  ] as never[];

  it('R$ 500 aciona apenas o supervisor', () => {
    const applicable = service.applicableSteps(steps, 500);

    expect(
      applicable.filter((item) => item.applies).map((item) => item.step.name),
    ).toEqual(['Supervisor']);
  });

  it('R$ 5.000 aciona apenas o gerente', () => {
    const applicable = service.applicableSteps(steps, 5000);

    expect(
      applicable.filter((item) => item.applies).map((item) => item.step.name),
    ).toEqual(['Gerente']);
  });

  it('R$ 50.000 aciona o diretor', () => {
    const applicable = service.applicableSteps(steps, 50_000);

    expect(
      applicable.filter((item) => item.applies).map((item) => item.step.name),
    ).toEqual(['Diretor']);
  });

  it('R$ 150.000 aciona diretor e sócio — a dupla alçada do exemplo', () => {
    const applicable = service.applicableSteps(steps, 150_000);

    expect(
      applicable.filter((item) => item.applies).map((item) => item.step.name),
    ).toEqual(['Diretor', 'Sócio']);
  });

  it('etapas fora da faixa continuam listadas, para o histórico mostrar a alçada', () => {
    const applicable = service.applicableSteps(steps, 500);

    expect(applicable).toHaveLength(4);
    expect(applicable.filter((item) => !item.applies)).toHaveLength(3);
  });
});
