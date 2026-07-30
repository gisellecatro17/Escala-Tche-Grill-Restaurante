import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { ApprovalsController } from './approvals.controller';

const ALL = [
  'approvals.view',
  'approvals.approve',
  'approvals.reject',
  'approvals.delegate',
  'approvals.manage',
  'approvals.audit',
];

function buildUser(options: {
  organizationId?: string;
  companyId?: string;
  permissions?: string[];
  isPlatformAdmin?: boolean;
}): RequestUser {
  const permissions = options.permissions ?? [];

  return {
    id: 'user-1',
    isPlatformAdmin: options.isPlatformAdmin ?? false,
    organizationMemberships: options.organizationId
      ? [{ organizationId: options.organizationId, permissions }]
      : [],
    memberships: options.companyId
      ? [{ companyId: options.companyId, permissions }]
      : [],
  } as unknown as RequestUser;
}

function buildController(scope: { companyId?: string } = {}) {
  const companyId = scope.companyId ?? 'company-1';

  const requests = {
    scopeOf: jest.fn().mockResolvedValue({
      id: 'request-1',
      organizationId: 'org-1',
      companyId,
      status: 'IN_PROGRESS',
      entryId: 'entry-1',
    }),
    findAll: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    findSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn().mockResolvedValue({}),
    approve: jest.fn().mockResolvedValue({}),
    reject: jest.fn().mockResolvedValue({}),
    requestChanges: jest.fn().mockResolvedValue({}),
    resume: jest.fn().mockResolvedValue({}),
    comment: jest.fn().mockResolvedValue({}),
    findComments: jest.fn().mockResolvedValue([]),
    findHistory: jest.fn().mockResolvedValue([]),
    delegate: jest.fn().mockResolvedValue({}),
    forward: jest.fn().mockResolvedValue({}),
    changePriority: jest.fn().mockResolvedValue({}),
    cancel: jest.fn().mockResolvedValue({}),
    restart: jest.fn().mockResolvedValue({}),
    runBatch: jest
      .fn()
      .mockResolvedValue({ succeeded: 0, failed: [], total: 0 }),
    expireOverdue: jest.fn().mockResolvedValue({ expired: 0 }),
  };

  const flows = {
    scopeOf: jest.fn().mockResolvedValue({
      id: 'flow-1',
      organizationId: 'org-1',
      companyId,
    }),
    delegationScopeOf: jest.fn().mockResolvedValue({
      id: 'del-1',
      organizationId: 'org-1',
      companyId,
    }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
    findDelegations: jest.fn().mockResolvedValue([]),
    createDelegation: jest.fn().mockResolvedValue({}),
    revokeDelegation: jest.fn().mockResolvedValue({}),
  };

  const dashboard = { build: jest.fn().mockResolvedValue({}) };

  const controller = new ApprovalsController(
    requests as never,
    flows as never,
    dashboard as never,
  );

  return { controller, requests, flows, dashboard };
}

describe('Autorizações — isolamento entre empresas e organizações', () => {
  it('recusa consultar solicitação de empresa a que o usuário não tem acesso', async () => {
    const { controller } = buildController({ companyId: 'company-1' });
    const outsider = buildUser({ companyId: 'company-2', permissions: ALL });

    await expect(
      controller.findOne('request-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite consultar solicitação da própria empresa', async () => {
    const { controller, requests } = buildController();
    const insider = buildUser({ companyId: 'company-1', permissions: ALL });

    await controller.findOne('request-1', insider);

    expect(requests.findOne).toHaveBeenCalledWith('request-1');
  });

  it('valida a permissão contra a empresa lida do banco, não do corpo', async () => {
    const { controller, requests } = buildController();
    const user = buildUser({ companyId: 'company-1', permissions: ALL });

    await controller.approve('request-1', {}, user);

    expect(requests.scopeOf).toHaveBeenCalledWith('request-1');
  });

  it('recusa criar fluxo em empresa a que o usuário não tem acesso', async () => {
    const { controller } = buildController();
    const outsider = buildUser({ companyId: 'company-2', permissions: ALL });

    // `createFlow` é assíncrono: verificar com `toThrow` deixaria a promessa rejeitada
    // solta e derrubaria o processo de teste em vez de falhar a asserção.
    await expect(
      controller.createFlow(
        { companyId: 'company-1', organizationId: 'org-1' } as never,
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('o lote valida a permissão de cada solicitação, não só da primeira', async () => {
    const { controller, requests } = buildController();
    const user = buildUser({ companyId: 'company-1', permissions: ALL });

    await controller.batch(
      { requestIds: ['a', 'b', 'c'], action: 'APPROVE' } as never,
      user,
    );

    expect(requests.scopeOf).toHaveBeenCalledTimes(3);
  });

  it('platform admin atravessa o isolamento', async () => {
    const { controller, requests } = buildController();
    const admin = buildUser({ isPlatformAdmin: true });

    await controller.findOne('request-1', admin);

    expect(requests.findOne).toHaveBeenCalled();
  });

  it('painel sem empresa cai na permissão de organização', async () => {
    const { controller } = buildController();
    const user = buildUser({ organizationId: 'org-2', permissions: ALL });

    await expect(
      controller.dashboardData('org-1', undefined, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Autorizações — permissões por ação', () => {
  const cases: {
    permission: string;
    run: (
      controller: ApprovalsController,
      user: RequestUser,
    ) => Promise<unknown>;
  }[] = [
    {
      permission: 'approvals.view',
      run: (controller, user) => controller.findOne('request-1', user),
    },
    {
      permission: 'approvals.approve',
      run: (controller, user) => controller.approve('request-1', {}, user),
    },
    {
      permission: 'approvals.reject',
      run: (controller, user) =>
        controller.reject('request-1', { reason: 'Fora do orçamento.' }, user),
    },
    {
      permission: 'approvals.delegate',
      run: (controller, user) =>
        controller.delegate('request-1', { delegateId: 'user-2' }, user),
    },
    {
      permission: 'approvals.manage',
      run: (controller, user) =>
        controller.cancel('request-1', { reason: 'Desistência.' }, user),
    },
    {
      permission: 'approvals.audit',
      run: (controller, user) => controller.history('request-1', user),
    },
  ];

  it.each(cases)(
    'exige $permission para a ação',
    async ({ permission, run }) => {
      const { controller } = buildController();

      const semPermissao = buildUser({
        companyId: 'company-1',
        permissions: ALL.filter((slug) => slug !== permission),
      });
      await expect(run(controller, semPermissao)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const comPermissao = buildUser({
        companyId: 'company-1',
        permissions: [permission],
      });
      await expect(run(controller, comPermissao)).resolves.toBeDefined();
    },
  );

  it('aprovar e reprovar são permissões distintas', async () => {
    const { controller } = buildController();
    const soAprova = buildUser({
      companyId: 'company-1',
      permissions: ['approvals.approve'],
    });

    await expect(
      controller.approve('request-1', {}, soAprova),
    ).resolves.toBeDefined();

    await expect(
      controller.reject('request-1', { reason: 'Não.' }, soAprova),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ver a fila não dá acesso ao histórico de auditoria', async () => {
    const { controller } = buildController();
    const leitor = buildUser({
      companyId: 'company-1',
      permissions: ['approvals.view'],
    });

    await expect(
      controller.findOne('request-1', leitor),
    ).resolves.toBeDefined();

    await expect(
      controller.history('request-1', leitor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('quem só aprova não altera os parâmetros da empresa', async () => {
    const { controller } = buildController();
    const aprovador = buildUser({
      companyId: 'company-1',
      permissions: ['approvals.approve', 'approvals.view'],
    });

    await expect(
      controller.settings('org-1', 'company-1', aprovador),
    ).resolves.toBeDefined();

    await expect(
      controller.updateSettings('org-1', 'company-1', {}, aprovador),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revogar delegação valida a permissão contra a empresa da delegação', async () => {
    const { controller, flows } = buildController();
    const user = buildUser({
      companyId: 'company-1',
      permissions: ['approvals.delegate'],
    });

    await controller.revokeDelegation('del-1', user);

    expect(flows.delegationScopeOf).toHaveBeenCalledWith('del-1');
    expect(flows.revokeDelegation).toHaveBeenCalled();
  });

  it('o lote de reprovação exige a permissão de reprovar', async () => {
    const { controller } = buildController();
    const soAprova = buildUser({
      companyId: 'company-1',
      permissions: ['approvals.approve'],
    });

    await expect(
      controller.batch(
        { requestIds: ['a'], action: 'REJECT', reason: 'Não.' } as never,
        soAprova,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
