/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- mocks usam `any` propositalmente nos testes */
import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { AccountPlansController } from './account-plans.controller';
import { FinancialStructureController } from './financial-structure.controller';

/**
 * Cenários de isolamento e permissão da seção 76.
 *
 * Os testes atacam os **controllers**, e não os serviços: é ali que a permissão é
 * verificada. Um serviço correto atrás de um controller que checa a organização errada
 * ainda vazaria dados entre clientes do BPO.
 */

/** Usuário com uma permissão em uma organização e uma empresa. */
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

describe('Isolamento entre organizações e empresas', () => {
  describe('ciclo de vida (mixin herdado por todos os cadastros)', () => {
    function buildController(recordOrganizationId = 'org-1') {
      const lifecycle = {
        scopeOf: jest.fn().mockResolvedValue({
          organizationId: recordOrganizationId,
          companyId: 'company-1',
        }),
        usage: jest.fn().mockResolvedValue({ total: 0 }),
        activate: jest.fn().mockResolvedValue({}),
        deactivate: jest.fn().mockResolvedValue({}),
        archive: jest.fn().mockResolvedValue({}),
      };

      return {
        controller: new AccountPlansController({} as any, lifecycle as any),
        lifecycle,
      };
    }

    it('permite ativar quando o usuário tem a permissão na organização do registro', async () => {
      const { controller, lifecycle } = buildController('org-1');
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.activate'],
      });

      await controller.activateRecord('acc-1', actor);

      expect(lifecycle.activate).toHaveBeenCalledWith(
        'financialAccountPlan',
        'acc-1',
        actor,
      );
    });

    it('recusa quando o registro pertence a outra organização', async () => {
      // O usuário tem a permissão — mas em `org-1`, e o registro é de `org-2`.
      const { controller, lifecycle } = buildController('org-2');
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.activate'],
      });

      await expect(controller.activateRecord('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(lifecycle.activate).not.toHaveBeenCalled();
    });

    it('recusa quando o usuário não tem a permissão, mesmo na organização certa', async () => {
      const { controller, lifecycle } = buildController('org-1');
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.view'],
      });

      await expect(controller.activateRecord('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(lifecycle.activate).not.toHaveBeenCalled();
    });

    it('exige a permissão de inativar para inativar e para arquivar', async () => {
      const { controller } = buildController('org-1');
      // Ativar não implica inativar: são permissões distintas.
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.activate'],
      });

      await expect(
        controller.deactivateRecord('acc-1', {}, actor),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.archiveRecord('acc-1', {}, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('resolve o escopo pelo registro, nunca pelo que o cliente enviou', async () => {
      const { controller, lifecycle } = buildController('org-1');
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.view'],
      });

      await controller.recordUsage('acc-1', actor);

      // A consulta de escopo acontece antes de qualquer leitura de dados.
      expect(lifecycle.scopeOf).toHaveBeenCalledWith(
        'financialAccountPlan',
        'acc-1',
      );
    });

    it('libera o administrador da plataforma', async () => {
      const { controller, lifecycle } = buildController('org-9');
      const actor = buildUser({ isPlatformAdmin: true });

      await controller.activateRecord('acc-1', actor);

      expect(lifecycle.activate).toHaveBeenCalled();
    });
  });

  describe('duplicação entre empresas', () => {
    function buildController() {
      const duplication = { duplicate: jest.fn().mockResolvedValue({}) };
      return {
        controller: new FinancialStructureController(
          {} as any,
          {} as any,
          {} as any,
          duplication as any,
        ),
        duplication,
      };
    }

    const dto = {
      sourceCompanyId: 'company-a',
      targetCompanyId: 'company-b',
      reason: 'Nova filial',
    } as any;

    it('exige permissão nas duas empresas', () => {
      const { controller, duplication } = buildController();
      // Permissão apenas no destino: sem a checagem na origem, o usuário copiaria a
      // estrutura de uma empresa que não pode enxergar.
      const actor = {
        id: 'user-1',
        isPlatformAdmin: false,
        organizationMemberships: [],
        memberships: [
          {
            companyId: 'company-b',
            permissions: [
              'financial_structure.duplicate',
              'financial_structure.view',
            ],
          },
        ],
      } as unknown as RequestUser;

      expect(() => controller.duplicateStructure(dto, actor)).toThrow(
        ForbiddenException,
      );
      expect(duplication.duplicate).not.toHaveBeenCalled();
    });

    it('recusa quem só pode ver a origem, sem poder duplicar no destino', () => {
      const { controller, duplication } = buildController();
      const actor = {
        id: 'user-1',
        isPlatformAdmin: false,
        organizationMemberships: [],
        memberships: [
          { companyId: 'company-a', permissions: ['financial_structure.view'] },
          { companyId: 'company-b', permissions: ['financial_structure.view'] },
        ],
      } as unknown as RequestUser;

      expect(() => controller.duplicateStructure(dto, actor)).toThrow(
        ForbiddenException,
      );
      expect(duplication.duplicate).not.toHaveBeenCalled();
    });

    it('permite quando as duas permissões existem', () => {
      const { controller, duplication } = buildController();
      const actor = {
        id: 'user-1',
        isPlatformAdmin: false,
        organizationMemberships: [],
        memberships: [
          { companyId: 'company-a', permissions: ['financial_structure.view'] },
          {
            companyId: 'company-b',
            permissions: ['financial_structure.duplicate'],
          },
        ],
      } as unknown as RequestUser;

      void controller.duplicateStructure(dto, actor);

      expect(duplication.duplicate).toHaveBeenCalledWith(dto, actor);
    });
  });

  describe('importação e exportação', () => {
    function buildController(batchOrganizationId = 'org-1') {
      const imports = {
        analyze: jest.fn().mockResolvedValue({}),
        findBatch: jest.fn().mockResolvedValue({
          id: 'batch-1',
          organizationId: batchOrganizationId,
        }),
        setMapping: jest.fn().mockResolvedValue({}),
        validateBatch: jest.fn().mockResolvedValue({}),
        applyBatch: jest.fn().mockResolvedValue({}),
        findRows: jest.fn().mockResolvedValue([]),
        export: jest.fn().mockResolvedValue({}),
      };
      const diagnostics = { run: jest.fn().mockResolvedValue({}) };

      return {
        controller: new FinancialStructureController(
          imports as any,
          {} as any,
          diagnostics as any,
          {} as any,
        ),
        imports,
        diagnostics,
      };
    }

    it('recusa importar em uma organização a que o usuário não pertence', () => {
      const { controller, imports } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['financial_structure.import'],
      });

      expect(() =>
        controller.analyzeImport(
          { organizationId: 'org-2', entity: 'ACCOUNT_PLAN' } as any,
          undefined,
          actor,
        ),
      ).toThrow(ForbiddenException);
      expect(imports.analyze).not.toHaveBeenCalled();
    });

    it('valida a permissão contra a organização do lote, não contra a requisição', async () => {
      // O lote pertence a `org-2`; o usuário só tem acesso a `org-1`.
      const { controller, imports } = buildController('org-2');
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['financial_structure.import'],
      });

      await expect(
        controller.applyImport('batch-1', {}, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(imports.applyBatch).not.toHaveBeenCalled();
    });

    it('recusa aplicar o lote sem a permissão de importação', async () => {
      const { controller, imports } = buildController('org-1');
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['financial_structure.view'],
      });

      await expect(
        controller.applyImport('batch-1', {}, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(imports.applyBatch).not.toHaveBeenCalled();
    });

    it('exige a permissão de exportação, distinta da de visualização', () => {
      const { controller, imports } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['financial_structure.view'],
      });

      expect(() =>
        controller.export(
          { organizationId: 'org-1', entity: 'ACCOUNT_PLAN' } as any,
          actor,
        ),
      ).toThrow(ForbiddenException);
      expect(imports.export).not.toHaveBeenCalled();
    });

    it('recusa o diagnóstico de outra organização', () => {
      const { controller, diagnostics } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['financial_structure.view'],
      });

      expect(() =>
        controller.runDiagnostics('org-2', undefined, actor),
      ).toThrow(ForbiddenException);
      expect(diagnostics.run).not.toHaveBeenCalled();
    });

    it('permite o diagnóstico da própria organização', () => {
      const { controller, diagnostics } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['financial_structure.view'],
      });

      void controller.runDiagnostics('org-1', 'company-1', actor);

      expect(diagnostics.run).toHaveBeenCalledWith('org-1', 'company-1');
    });
  });

  describe('permissões granulares do plano de contas', () => {
    function buildController() {
      const accountPlans = {
        findOne: jest.fn().mockResolvedValue({
          id: 'acc-1',
          organizationId: 'org-1',
          companyId: null,
        }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        move: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue({}),
        previewNextCode: jest.fn().mockResolvedValue({}),
      };

      return {
        controller: new AccountPlansController(accountPlans as any, {} as any),
        accountPlans,
      };
    }

    it('mover a árvore exige permissão própria, separada de editar', async () => {
      const { controller, accountPlans } = buildController();
      // Mover contas altera relatórios históricos, por isso a permissão é separada.
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.manage'],
      });

      await expect(
        controller.move('acc-1', { parentId: null }, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(accountPlans.move).not.toHaveBeenCalled();
    });

    it('permite mover com a permissão específica', async () => {
      const { controller, accountPlans } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.move'],
      });

      await controller.move('acc-1', { parentId: null }, actor);

      expect(accountPlans.move).toHaveBeenCalled();
    });

    it('excluir exige permissão própria, separada de editar', async () => {
      const { controller, accountPlans } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.manage'],
      });

      await expect(controller.remove('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(accountPlans.remove).not.toHaveBeenCalled();
    });

    it('recusa criar conta em organização alheia mesmo com a permissão em outra', () => {
      const { controller, accountPlans } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['account_plan.manage'],
      });

      expect(() =>
        controller.create(
          { organizationId: 'org-2', name: 'Conta', code: '9' } as any,
          actor,
        ),
      ).toThrow(ForbiddenException);
      expect(accountPlans.create).not.toHaveBeenCalled();
    });
  });
});
