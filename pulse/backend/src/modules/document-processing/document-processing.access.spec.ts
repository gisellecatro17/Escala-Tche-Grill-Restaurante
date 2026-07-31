import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { DocumentProcessingController } from './document-processing.controller';

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

function buildController(
  scope: { organizationId?: string; companyId?: string } = {},
) {
  const processing = {
    findSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn().mockResolvedValue({}),
    findQueue: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    preview: jest.fn().mockResolvedValue({}),
    process: jest.fn().mockResolvedValue({}),
  };

  const entries = {
    scopeOf: jest.fn().mockResolvedValue({
      id: 'entry-1',
      organizationId: scope.organizationId ?? 'org-1',
      companyId: scope.companyId ?? 'company-1',
      status: 'DRAFT',
    }),
    findAll: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    findSummary: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    approve: jest.fn().mockResolvedValue({}),
    open: jest.fn().mockResolvedValue({}),
    cancel: jest.fn().mockResolvedValue({}),
    updateInstallment: jest.fn().mockResolvedValue({}),
    addWithholding: jest.fn().mockResolvedValue({}),
    confirmWithholding: jest.fn().mockResolvedValue({}),
    dismissWithholding: jest.fn().mockResolvedValue({}),
  };

  const intake = {
    scopeOf: jest.fn().mockResolvedValue({
      id: 'doc-1',
      organizationId: scope.organizationId ?? 'org-1',
      companyId: scope.companyId ?? 'company-1',
    }),
  };

  const controller = new DocumentProcessingController(
    processing as never,
    entries as never,
    intake as never,
  );

  return { controller, processing, entries, intake };
}

const ALL = [
  'document_processing.view',
  'document_processing.process',
  'document_processing.update',
  'document_processing.approve',
  'document_processing.open',
  'document_processing.cancel',
  'document_processing.manage_withholdings',
  'document_processing.manage_settings',
];

describe('Processamento — isolamento entre empresas e organizações', () => {
  it('recusa consultar lançamento de empresa a que o usuário não tem acesso', async () => {
    const { controller } = buildController({ companyId: 'company-1' });
    const outsider = buildUser({ companyId: 'company-2', permissions: ALL });

    await expect(
      controller.findOne('entry-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite consultar lançamento da própria empresa', async () => {
    const { controller, entries } = buildController({ companyId: 'company-1' });
    const insider = buildUser({ companyId: 'company-1', permissions: ALL });

    await controller.findOne('entry-1', insider);

    expect(entries.findOne).toHaveBeenCalledWith('entry-1', insider);
  });

  it('recusa processar documento de outra empresa', async () => {
    const { controller } = buildController({ companyId: 'company-1' });
    const outsider = buildUser({ companyId: 'company-2', permissions: ALL });

    await expect(
      controller.process('doc-1', {}, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida a permissão contra a empresa do documento lida do banco, não do corpo', async () => {
    const { controller, intake } = buildController({ companyId: 'company-1' });
    const user = buildUser({ companyId: 'company-1', permissions: ALL });

    await controller.process('doc-1', {}, user);

    expect(intake.scopeOf).toHaveBeenCalledWith('doc-1');
  });

  it('platform admin atravessa o isolamento', async () => {
    const { controller, entries } = buildController({ companyId: 'company-1' });
    const admin = buildUser({ isPlatformAdmin: true });

    await controller.findOne('entry-1', admin);

    expect(entries.findOne).toHaveBeenCalled();
  });

  it('fila sem empresa cai na permissão de organização', async () => {
    const { controller } = buildController();
    const user = buildUser({ organizationId: 'org-2', permissions: ALL });

    await expect(
      controller.queue({ organizationId: 'org-1', page: 1, perPage: 20 }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Processamento — permissões por ação', () => {
  const cases: {
    permission: string;
    run: (
      controller: DocumentProcessingController,
      user: RequestUser,
    ) => Promise<unknown>;
  }[] = [
    {
      permission: 'document_processing.view',
      run: (controller, user) => controller.findOne('entry-1', user),
    },
    {
      permission: 'document_processing.process',
      run: (controller, user) => controller.process('doc-1', {}, user),
    },
    {
      permission: 'document_processing.update',
      run: (controller, user) => controller.update('entry-1', {}, user),
    },
    {
      permission: 'document_processing.approve',
      run: (controller, user) => controller.approve('entry-1', user),
    },
    {
      permission: 'document_processing.open',
      run: (controller, user) => controller.open('entry-1', user),
    },
    {
      permission: 'document_processing.cancel',
      run: (controller, user) =>
        controller.cancel('entry-1', { reason: 'Nota cancelada.' }, user),
    },
    {
      permission: 'document_processing.manage_withholdings',
      run: (controller, user) =>
        controller.confirmWithholding('entry-1', 'wh-1', {}, user),
    },
  ];

  it.each(cases)(
    'exige $permission para a ação correspondente',
    async ({ permission, run }) => {
      const { controller } = buildController({ companyId: 'company-1' });

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

  it('conferir o lançamento e abrir o título são permissões distintas', async () => {
    const { controller } = buildController({ companyId: 'company-1' });

    const soConfere = buildUser({
      companyId: 'company-1',
      permissions: ['document_processing.approve'],
    });

    await expect(
      controller.approve('entry-1', soConfere),
    ).resolves.toBeDefined();
    await expect(controller.open('entry-1', soConfere)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('quem só enxerga o processamento não altera os parâmetros da empresa', async () => {
    const { controller } = buildController({ companyId: 'company-1' });
    const leitor = buildUser({
      companyId: 'company-1',
      permissions: ['document_processing.view'],
    });

    await expect(
      controller.settings('org-1', 'company-1', leitor),
    ).resolves.toBeDefined();

    // `updateSettings` é assíncrono: verificar com `toThrow` deixaria a promessa rejeitada
    // solta e derrubaria o processo de teste em vez de falhar a asserção.
    await expect(
      controller.updateSettings('org-1', 'company-1', {}, leitor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
