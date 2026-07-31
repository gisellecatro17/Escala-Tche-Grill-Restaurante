/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- mocks do jest sao `any` por natureza */
import { BadRequestException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { ApprovalFlowsService } from './approval-flows.service';

const ACTOR = { id: 'user-1' } as RequestUser;

function buildService(
  options: {
    flow?: Record<string, unknown>;
    liveRequests?: number;
    chainedDelegation?: unknown;
    delegation?: Record<string, unknown>;
  } = {},
) {
  const stored = {
    id: 'flow-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    name: 'Compra de alimentos',
    steps: [{ id: 'step-1', stepOrder: 1 }],
    ...options.flow,
  };

  const tx = {
    approvalFlowStep: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    approvalFlow: { update: jest.fn().mockResolvedValue(stored) },
  };

  const prisma = {
    approvalFlow: {
      findMany: jest.fn().mockResolvedValue([stored]),
      findFirstOrThrow: jest.fn().mockResolvedValue(stored),
      create: jest.fn().mockResolvedValue(stored),
      update: jest.fn().mockResolvedValue(stored),
    },
    approvalRequest: {
      count: jest.fn().mockResolvedValue(options.liveRequests ?? 0),
    },
    approvalDelegation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(options.chainedDelegation ?? null),
      findFirstOrThrow: jest.fn().mockResolvedValue({
        id: 'del-1',
        organizationId: 'org-1',
        companyId: 'company-1',
        status: 'ACTIVE',
        revokedAt: null,
        ...options.delegation,
      }),
      create: jest.fn().mockResolvedValue({ id: 'del-1' }),
      update: jest.fn().mockResolvedValue({ id: 'del-1' }),
    },
    $transaction: jest.fn((argument: unknown) =>
      typeof argument === 'function'
        ? (argument as (client: unknown) => unknown)(tx)
        : Promise.all(argument as Promise<unknown>[]),
    ),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new ApprovalFlowsService(prisma as never, audit as never),
    prisma,
    tx,
    audit,
  };
}

function step(overrides: Record<string, unknown> = {}) {
  return {
    stepOrder: 1,
    name: 'Gerente',
    approverType: 'ROLE',
    approverRoleId: 'role-1',
    ...overrides,
  } as never;
}

const BASE_FLOW = {
  organizationId: 'org-1',
  companyId: 'company-1',
  name: 'Compra de alimentos',
};

describe('Cadastro de fluxos', () => {
  it('cria o fluxo com as etapas', async () => {
    const { service, prisma } = buildService();

    await service.create(
      { ...BASE_FLOW, steps: [step(), step({ stepOrder: 2 })] },
      ACTOR,
    );

    expect(
      prisma.approvalFlow.create.mock.calls[0][0].data.steps.create,
    ).toHaveLength(2);
  });

  it('recusa duas etapas com a mesma ordem', async () => {
    const { service } = buildService();

    await expect(
      service.create({ ...BASE_FLOW, steps: [step(), step()] }, ACTOR),
    ).rejects.toThrow('duas etapas com a ordem 1');
  });

  it('recusa etapa por pessoa específica sem pessoa informada', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...BASE_FLOW,
          steps: [
            step({ approverType: 'SPECIFIC_USER', approverRoleId: null }),
          ],
        },
        ACTOR,
      ),
    ).rejects.toThrow('nenhuma foi informada');
  });

  it('recusa etapa por perfil sem perfil informado', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        { ...BASE_FLOW, steps: [step({ approverRoleId: null })] },
        ACTOR,
      ),
    ).rejects.toThrow('nenhum foi informado');
  });

  it('recusa dupla aprovação designada a uma única pessoa', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...BASE_FLOW,
          steps: [
            step({
              approverType: 'SPECIFIC_USER',
              approverUserId: 'user-2',
              approverRoleId: null,
              requiredApprovals: 2,
            }),
          ],
        },
        ACTOR,
      ),
    ).rejects.toThrow('uma única pessoa');
  });

  it('recusa faixa de valor invertida', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          ...BASE_FLOW,
          steps: [step({ minimumAmount: 10_000, maximumAmount: 1000 })],
        },
        ACTOR,
      ),
    ).rejects.toThrow('invertida');
  });

  it('editar as etapas substitui todas de uma vez', async () => {
    const { service, tx } = buildService();

    await service.update('flow-1', { steps: [step()] }, ACTOR);

    expect(tx.approvalFlowStep.deleteMany).toHaveBeenCalledWith({
      where: { flowId: 'flow-1' },
    });
    expect(tx.approvalFlowStep.createMany).toHaveBeenCalled();
  });

  it('registra na auditoria que as etapas mudaram', async () => {
    const { service, audit } = buildService();

    await service.update('flow-1', { steps: [step()] }, ACTOR);

    expect(audit.log.mock.calls[0][0].action).toBe(
      'CHANGE_APPROVAL_FLOW_STEPS',
    );
  });

  it('não exclui fluxo com solicitação em andamento', async () => {
    const { service } = buildService({ liveRequests: 3 });

    await expect(service.remove('flow-1', ACTOR)).rejects.toThrow(
      '3 solicitação(ões) em andamento',
    );
  });

  it('exclui logicamente quando não há solicitação viva', async () => {
    const { service, prisma } = buildService();

    await expect(service.remove('flow-1', ACTOR)).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.approvalFlow.update.mock.calls[0][0].data.status).toBe(
      'INACTIVE',
    );
  });
});

describe('Delegações por período', () => {
  const BASE_DELEGATION = {
    organizationId: 'org-1',
    companyId: 'company-1',
    delegatorId: 'gerente',
    delegateId: 'substituto',
    startsAt: '2026-08-01',
    endsAt: '2026-08-15',
  };

  it('cria a delegação', async () => {
    const { service, prisma } = buildService();

    await service.createDelegation(BASE_DELEGATION, ACTOR);

    expect(prisma.approvalDelegation.create).toHaveBeenCalled();
  });

  it('recusa período invertido', async () => {
    const { service } = buildService();

    await expect(
      service.createDelegation(
        { ...BASE_DELEGATION, endsAt: '2026-07-01' },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa delegar para si mesmo', async () => {
    const { service } = buildService();

    await expect(
      service.createDelegation(
        { ...BASE_DELEGATION, delegateId: 'gerente' },
        ACTOR,
      ),
    ).rejects.toThrow('própria pessoa');
  });

  it('recusa delegação em cadeia', async () => {
    const { service } = buildService({
      chainedDelegation: { id: 'del-existente' },
    });

    await expect(
      service.createDelegation(BASE_DELEGATION as never, ACTOR),
    ).rejects.toThrow('cadeia');
  });

  it('revoga a delegação antes do fim do período', async () => {
    const { service, prisma } = buildService();

    await service.revokeDelegation('del-1', ACTOR);

    expect(
      prisma.approvalDelegation.update.mock.calls[0][0].data,
    ).toMatchObject({
      status: 'INACTIVE',
      revokedBy: 'user-1',
    });
  });

  it('não revoga duas vezes', async () => {
    const { service } = buildService({
      delegation: { revokedAt: new Date() },
    });

    await expect(service.revokeDelegation('del-1', ACTOR)).rejects.toThrow(
      'já foi revogada',
    );
  });

  it('filtra apenas as vigentes quando pedido', async () => {
    const { service, prisma } = buildService();

    await service.findDelegations({
      companyId: 'company-1',
      activeOnly: true,
      page: 1,
      perPage: 20,
    });

    const where = prisma.approvalDelegation.findMany.mock.calls[0][0].where;

    expect(where).toMatchObject({ status: 'ACTIVE', revokedAt: null });
    expect(where.startsAt).toHaveProperty('lte');
  });
});
