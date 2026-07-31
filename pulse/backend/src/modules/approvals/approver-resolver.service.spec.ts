/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- mocks do jest sao `any` por natureza */
import type { RequestUser } from '../../common/types/authenticated-request';
import { ApproverResolverService } from './approver-resolver.service';

function buildUser(options: {
  id?: string;
  permissions?: string[];
  isPlatformAdmin?: boolean;
}): RequestUser {
  return {
    id: options.id ?? 'user-1',
    isPlatformAdmin: options.isPlatformAdmin ?? false,
    organizationMemberships: [],
    memberships: [
      { companyId: 'company-1', permissions: options.permissions ?? [] },
    ],
  } as unknown as RequestUser;
}

function buildService(
  options: {
    delegations?: unknown[];
    delegation?: unknown;
    memberships?: Record<string, unknown>;
  } = {},
) {
  const prisma = {
    approvalDelegation: {
      findMany: jest.fn().mockResolvedValue(options.delegations ?? []),
      findFirst: jest.fn().mockResolvedValue(options.delegation ?? null),
    },
    userCompanyRole: {
      findFirst: jest.fn(
        (args: { where: { userId: string; roleId?: string } }) => {
          const record = options.memberships?.[args.where.userId];
          if (!record) return Promise.resolve(null);
          // Consulta por perfil: só devolve quando o perfil bate.
          if (
            args.where.roleId !== undefined &&
            (record as { roleId?: string }).roleId !== args.where.roleId
          ) {
            return Promise.resolve(null);
          }
          return Promise.resolve(record);
        },
      ),
    },
  };

  return { service: new ApproverResolverService(prisma as never), prisma };
}

function step(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    approverType: 'ROLE',
    approverUserId: null,
    approverRoleId: 'role-gerente',
    requiredApprovals: 1,
    blockSelfApproval: true,
    ...overrides,
  } as never;
}

const BASE = {
  companyId: 'company-1',
  amount: 5000,
  requestedBy: 'quem-criou',
  blockSelfApprovalGlobally: true,
  enforceIndividualLimit: true,
};

describe('Elegibilidade do aprovador', () => {
  it('recusa quem não tem a permissão de aprovar na empresa', async () => {
    const { service } = buildService();

    const result = await service.check({
      ...BASE,
      actor: buildUser({ permissions: ['approvals.view'] }),
      step: step(),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('não tem permissão');
  });

  it('delegação não substitui a permissão', async () => {
    const { service } = buildService({
      delegations: [{ id: 'del-1', delegatorId: 'gerente' }],
    });

    const result = await service.check({
      ...BASE,
      actor: buildUser({ permissions: [] }),
      step: step(),
    });

    expect(result.allowed).toBe(false);
  });

  it('ANY_WITH_PERMISSION basta ter a permissão', async () => {
    const { service } = buildService();

    const result = await service.check({
      ...BASE,
      actor: buildUser({ permissions: ['approvals.approve'] }),
      step: step({ approverType: 'ANY_WITH_PERMISSION', approverRoleId: null }),
    });

    expect(result.allowed).toBe(true);
  });

  it('SPECIFIC_USER só permite a pessoa designada', async () => {
    const { service } = buildService();

    const outro = await service.check({
      ...BASE,
      actor: buildUser({ id: 'outro', permissions: ['approvals.approve'] }),
      step: step({
        approverType: 'SPECIFIC_USER',
        approverUserId: 'designado',
      }),
    });

    expect(outro.allowed).toBe(false);
    expect(outro.reason).toContain('designada a outra pessoa');

    const designado = await service.check({
      ...BASE,
      actor: buildUser({ id: 'designado', permissions: ['approvals.approve'] }),
      step: step({
        approverType: 'SPECIFIC_USER',
        approverUserId: 'designado',
      }),
    });

    expect(designado.allowed).toBe(true);
  });

  it('delegação vigente permite decidir no lugar da pessoa designada', async () => {
    const { service } = buildService({
      delegation: {
        id: 'del-1',
        delegatorId: 'designado',
        maximumAmount: null,
      },
      memberships: {
        substituto: { approvalLimit: null },
        designado: { approvalLimit: null },
      },
    });

    const result = await service.check({
      ...BASE,
      actor: buildUser({
        id: 'substituto',
        permissions: ['approvals.approve'],
      }),
      step: step({
        approverType: 'SPECIFIC_USER',
        approverUserId: 'designado',
      }),
    });

    expect(result.allowed).toBe(true);
    expect(result.onBehalfOf).toBe('designado');
    expect(result.delegation?.id).toBe('del-1');
  });

  it('ROLE exige o perfil da etapa', async () => {
    const { service } = buildService({
      memberships: { 'user-1': { roleId: 'role-outro', approvalLimit: null } },
    });

    const result = await service.check({
      ...BASE,
      actor: buildUser({ permissions: ['approvals.approve'] }),
      step: step(),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('perfil');
  });

  it('quem tem o perfil da etapa pode decidir', async () => {
    const { service } = buildService({
      memberships: {
        'user-1': { roleId: 'role-gerente', approvalLimit: null },
      },
    });

    const result = await service.check({
      ...BASE,
      actor: buildUser({ permissions: ['approvals.approve'] }),
      step: step(),
    });

    expect(result.allowed).toBe(true);
    expect(result.onBehalfOf).toBeNull();
  });

  it('bloqueia aprovar o que a própria pessoa criou', async () => {
    const { service } = buildService({
      memberships: { criador: { roleId: 'role-gerente', approvalLimit: null } },
    });

    const result = await service.check({
      ...BASE,
      requestedBy: 'criador',
      actor: buildUser({ id: 'criador', permissions: ['approvals.approve'] }),
      step: step(),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('criou este lançamento');
  });

  it('respeita o limite individual do vínculo com a empresa', async () => {
    const { service } = buildService({
      memberships: {
        'user-1': { roleId: 'role-gerente', approvalLimit: 1000 },
      },
    });

    const result = await service.check({
      ...BASE,
      amount: 5000,
      actor: buildUser({ permissions: ['approvals.approve'] }),
      step: step(),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('excede o seu limite');
  });

  it('não aplica o limite individual quando a empresa desligou a exigência', async () => {
    const { service } = buildService({
      memberships: {
        'user-1': { roleId: 'role-gerente', approvalLimit: 1000 },
      },
    });

    const result = await service.check({
      ...BASE,
      amount: 5000,
      enforceIndividualLimit: false,
      actor: buildUser({ permissions: ['approvals.approve'] }),
      step: step(),
    });

    expect(result.allowed).toBe(true);
  });

  it('por delegação, ninguém aprova mais do que quem delegou poderia', async () => {
    const { service } = buildService({
      delegation: {
        id: 'del-1',
        delegatorId: 'designado',
        maximumAmount: null,
      },
      memberships: {
        substituto: { approvalLimit: 999_999 },
        designado: { approvalLimit: 2000 },
      },
    });

    const result = await service.check({
      ...BASE,
      amount: 5000,
      actor: buildUser({
        id: 'substituto',
        permissions: ['approvals.approve'],
      }),
      step: step({
        approverType: 'SPECIFIC_USER',
        approverUserId: 'designado',
      }),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('2000.00');
  });

  it('o teto da própria delegação também vale', async () => {
    const { service } = buildService({
      delegation: { id: 'del-1', delegatorId: 'designado', maximumAmount: 500 },
      memberships: {
        substituto: { approvalLimit: null },
        designado: { approvalLimit: 50_000 },
      },
    });

    const result = await service.check({
      ...BASE,
      amount: 5000,
      actor: buildUser({
        id: 'substituto',
        permissions: ['approvals.approve'],
      }),
      step: step({
        approverType: 'SPECIFIC_USER',
        approverUserId: 'designado',
      }),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('500.00');
  });

  it('platform admin atravessa a designação, mas não a permissão da empresa', async () => {
    const { service } = buildService();

    const result = await service.check({
      ...BASE,
      actor: buildUser({ isPlatformAdmin: true }),
      step: step({
        approverType: 'SPECIFIC_USER',
        approverUserId: 'outra-pessoa',
      }),
    });

    expect(result.allowed).toBe(true);
  });

  it('só considera delegações vigentes na data de hoje', async () => {
    const { service, prisma } = buildService();

    await service.activeDelegationsFor('user-1', 'company-1');

    const where = prisma.approvalDelegation.findMany.mock.calls[0][0].where;

    expect(where).toMatchObject({
      companyId: 'company-1',
      delegateId: 'user-1',
      status: 'ACTIVE',
      revokedAt: null,
    });
    expect(where.startsAt).toHaveProperty('lte');
    expect(where.endsAt).toHaveProperty('gte');
  });
});
