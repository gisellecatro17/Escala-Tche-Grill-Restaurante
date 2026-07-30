/* eslint-disable @typescript-eslint/no-unsafe-argument -- mocks usam `any` propositalmente nos testes */
import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { AccountDetailsController } from './account-details.controller';
import { CorporateCardsController } from './corporate-cards.controller';
import { FinancialAccountsController } from './financial-accounts.controller';
import { PaymentMethodsController } from './payment-methods.controller';
import { TreasuryController } from './treasury.controller';

/**
 * Cenários de isolamento e permissão da seção 77.
 *
 * Os testes atacam os **controllers**: é ali que a permissão é conferida, e é ali que
 * um erro deixaria dados de uma empresa acessíveis a quem só tem acesso a outra.
 */
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

describe('Tesouraria — isolamento entre empresas e organizações', () => {
  describe('contas financeiras', () => {
    function buildController(recordCompanyId = 'company-1') {
      const accounts = {
        scopeOf: jest.fn().mockResolvedValue({
          id: 'acc-1',
          organizationId: 'org-1',
          companyId: recordCompanyId,
          status: 'ACTIVE',
        }),
        findOne: jest.fn().mockResolvedValue({}),
        findAll: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        activate: jest.fn().mockResolvedValue({}),
        block: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue({}),
        usage: jest.fn().mockResolvedValue({}),
        findAudit: jest.fn().mockResolvedValue({}),
        findActivationPendencies: jest.fn().mockResolvedValue([]),
      };

      return {
        controller: new FinancialAccountsController(accounts as any),
        accounts,
      };
    }

    it('permite ver a conta da própria empresa', async () => {
      const { controller, accounts } = buildController('company-1');
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view'],
      });

      await controller.findOne('acc-1', actor);

      expect(accounts.findOne).toHaveBeenCalledWith('acc-1', actor);
    });

    it('recusa quando a conta pertence a outra empresa', async () => {
      // O usuário tem a permissão — mas em `company-1`, e a conta é de `company-2`.
      const { controller, accounts } = buildController('company-2');
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view'],
      });

      await expect(controller.findOne('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(accounts.findOne).not.toHaveBeenCalled();
    });

    it('recusa criar conta em empresa a que o usuário não tem acesso', () => {
      const { controller, accounts } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.create'],
      });

      expect(() =>
        controller.create(
          { organizationId: 'org-1', companyId: 'company-2', name: 'X' } as any,
          actor,
        ),
      ).toThrow(ForbiddenException);
      expect(accounts.create).not.toHaveBeenCalled();
    });

    it('resolve o escopo pelo registro, nunca pelo que o cliente enviou', async () => {
      const { controller, accounts } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view'],
      });

      await controller.findOne('acc-1', actor);

      expect(accounts.scopeOf).toHaveBeenCalledWith('acc-1');
    });

    it('exige permissões distintas para cada etapa do ciclo de vida', async () => {
      const { controller } = buildController();
      // Ativar não implica bloquear, encerrar ou excluir.
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.activate'],
      });

      await expect(
        controller.block('acc-1', { reason: 'x' }, actor),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.close(
          'acc-1',
          { reason: 'x', closingDate: '2026-01-01', closingBalance: 0 },
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(controller.remove('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('exige permissão própria para consultar a auditoria', async () => {
      const { controller, accounts } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view'],
      });

      await expect(controller.audit('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(accounts.findAudit).not.toHaveBeenCalled();
    });

    it('libera o administrador da plataforma', async () => {
      const { controller, accounts } = buildController('company-9');
      const actor = buildUser({ isPlatformAdmin: true });

      await controller.findOne('acc-1', actor);

      expect(accounts.findOne).toHaveBeenCalled();
    });
  });

  describe('saldos, limites e integrações', () => {
    function buildController() {
      const details = {
        findOpeningBalances: jest.fn().mockResolvedValue([]),
        createOpeningBalance: jest.fn().mockResolvedValue({}),
        findLimits: jest.fn().mockResolvedValue([]),
        createLimit: jest.fn().mockResolvedValue({}),
        findUsers: jest.fn().mockResolvedValue([]),
        upsertUser: jest.fn().mockResolvedValue({}),
        findIntegrations: jest.fn().mockResolvedValue([]),
        createIntegration: jest.fn().mockResolvedValue({}),
      };
      const accounts = {
        scopeOf: jest.fn().mockResolvedValue({
          id: 'acc-1',
          organizationId: 'org-1',
          companyId: 'company-1',
          status: 'ACTIVE',
        }),
      };

      return {
        controller: new AccountDetailsController(
          details as any,
          accounts as any,
        ),
        details,
      };
    }

    it('exige a permissão de ver saldo para consultar o saldo inicial', async () => {
      const { controller, details } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view'],
      });

      await expect(
        controller.findOpeningBalances('acc-1', actor),
      ).rejects.toThrow(ForbiddenException);
      expect(details.findOpeningBalances).not.toHaveBeenCalled();
    });

    it('exige permissão dedicada para alterar o saldo inicial', async () => {
      const { controller, details } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view_balance'],
      });

      await expect(
        controller.createOpeningBalance(
          'acc-1',
          { balanceDate: '2026-01-01', balanceAmount: 1 } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(details.createOpeningBalance).not.toHaveBeenCalled();
    });

    it('exige permissão dedicada para gerenciar limites', async () => {
      const { controller } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view_balance'],
      });

      await expect(
        controller.createLimit(
          'acc-1',
          { limitType: 'OVERDRAFT', contractedAmount: 1 } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('exige permissão dedicada para configurar integrações', async () => {
      const { controller, details } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.update'],
      });

      await expect(controller.findIntegrations('acc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(details.findIntegrations).not.toHaveBeenCalled();
    });

    it('exige permissão dedicada para gerenciar usuários da conta', async () => {
      const { controller } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['financial_account.view'],
      });

      await expect(
        controller.upsertUser('acc-1', { userId: 'user-9' } as any, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cartões', () => {
    function buildController(recordCompanyId = 'company-1') {
      const cards = {
        scopeOf: jest.fn().mockResolvedValue({
          id: 'card-1',
          organizationId: 'org-1',
          companyId: recordCompanyId,
          status: 'ACTIVE',
        }),
        findOne: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        setStatus: jest.fn().mockResolvedValue({}),
      };

      return { controller: new CorporateCardsController(cards as any), cards };
    }

    it('recusa acessar cartão de outra empresa', async () => {
      const { controller, cards } = buildController('company-2');
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['card.view'],
      });

      await expect(controller.findOne('card-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(cards.findOne).not.toHaveBeenCalled();
    });

    it('alterar limite exige permissão própria, separada de editar', async () => {
      const { controller, cards } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['card.update'],
      });

      await expect(
        controller.update('card-1', { totalLimit: 50000 } as any, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(cards.update).not.toHaveBeenCalled();
    });

    it('permite editar campos comuns com a permissão de edição', async () => {
      const { controller, cards } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['card.update'],
      });

      await controller.update('card-1', { name: 'Novo nome' }, actor);

      expect(cards.update).toHaveBeenCalled();
    });
  });

  describe('formas e parâmetros', () => {
    it('recusa listar formas de pagamento de outra organização', () => {
      const methods = { findPaymentMethods: jest.fn().mockResolvedValue([]) };
      const controller = new PaymentMethodsController(methods as any);
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['payment_method.view'],
      });

      expect(() => controller.findAll({} as any, 'org-2', actor)).toThrow(
        ForbiddenException,
      );
      expect(methods.findPaymentMethods).not.toHaveBeenCalled();
    });

    it('exige permissão dedicada para alterar os parâmetros de tesouraria', () => {
      const treasury = {
        findSettings: jest.fn().mockResolvedValue({}),
        updateSettings: jest.fn().mockResolvedValue({}),
      };
      const controller = new TreasuryController(treasury as any);
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['treasury.view'],
      });

      expect(() =>
        controller.updateSettings('org-1', 'company-1', {} as any, actor),
      ).toThrow(ForbiddenException);
      expect(treasury.updateSettings).not.toHaveBeenCalled();
    });

    it('recusa a visão geral de outra organização', () => {
      const treasury = { findOverview: jest.fn().mockResolvedValue({}) };
      const controller = new TreasuryController(treasury as any);
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['treasury.view_dashboard'],
      });

      expect(() => controller.overview('org-2', undefined, actor)).toThrow(
        ForbiddenException,
      );
      expect(treasury.findOverview).not.toHaveBeenCalled();
    });
  });
});
