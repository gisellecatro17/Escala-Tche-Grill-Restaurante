import { ForbiddenException } from '@nestjs/common';

import { AccountsPayableController } from './accounts-payable.controller';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import type { RoleSlug } from '../roles/role-slug.enum';

/**
 * Isolamento multiempresa (critério de aceite 8).
 *
 * O ponto de cada teste é o mesmo: a permissão é conferida contra a empresa **lida do
 * banco**, nunca contra a que o cliente mandou. Ter acesso à empresa A não pode abrir o
 * título da empresa B, mesmo chamando a API na mão com o id certo.
 */
function actorWith(companyId: string, permissions: string[]): RequestActor {
  return {
    id: 'user-1',
    name: 'Operador',
    email: 'operador@pulse.test',
    avatarUrl: null,
    isPlatformAdmin: false,
    organizationMemberships: [],
    memberships: [
      {
        companyId,
        companyName: 'Empresa',
        organizationId: 'org-1',
        organizationName: 'Org',
        role: {
          id: 'role-1',
          name: 'Financeiro',
          slug: 'financeiro' as RoleSlug,
        },
        permissions,
      },
    ],
    ipAddress: '10.0.0.1',
    userAgent: 'jest',
  };
}

function buildController(scopeCompanyId = 'company-1') {
  const scope = {
    id: 'payable-1',
    organizationId: 'org-1',
    companyId: scopeCompanyId,
    status: 'OPEN',
    blockedAt: null,
  };

  const payables = {
    scopeOf: jest.fn().mockResolvedValue(scope),
    scopeOfInstallment: jest.fn().mockResolvedValue(scope),
    scopeOfEntry: jest.fn().mockResolvedValue(scope),
    scopeOfPayment: jest.fn().mockResolvedValue(scope),
    scopeOfAdjustment: jest.fn().mockResolvedValue(scope),
    scopeOfWithholding: jest.fn().mockResolvedValue(scope),
    findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    findOne: jest.fn().mockResolvedValue({ id: 'payable-1' }),
    create: jest.fn().mockResolvedValue({ id: 'payable-1' }),
    update: jest.fn().mockResolvedValue({ id: 'payable-1' }),
    history: jest.fn().mockResolvedValue([]),
    block: jest.fn().mockResolvedValue({}),
    unblock: jest.fn().mockResolvedValue({}),
    cancel: jest.fn().mockResolvedValue({}),
    reopen: jest.fn().mockResolvedValue({}),
    schedule: jest.fn().mockResolvedValue({}),
    reinstall: jest.fn().mockResolvedValue({}),
    updateInstallment: jest.fn().mockResolvedValue({}),
    cancelInstallment: jest.fn().mockResolvedValue({}),
    reviseWithholding: jest.fn().mockResolvedValue({}),
    decideWithholding: jest.fn().mockResolvedValue({}),
    comment: jest.fn().mockResolvedValue({}),
    comments: jest.fn().mockResolvedValue([]),
    findSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn().mockResolvedValue({}),
  };

  const settlement = {
    registerPayment: jest.fn().mockResolvedValue({}),
    reversePayment: jest.fn().mockResolvedValue({}),
    addAdjustment: jest.fn().mockResolvedValue({}),
    reverseAdjustment: jest.fn().mockResolvedValue({}),
    previewLateCharges: jest.fn().mockResolvedValue({}),
    renegotiate: jest.fn().mockResolvedValue({}),
    applyAdvance: jest.fn().mockResolvedValue({}),
    createAdvance: jest.fn().mockResolvedValue({}),
    findAdvances: jest.fn().mockResolvedValue({ items: [], meta: {} }),
  };

  const dashboard = { build: jest.fn().mockResolvedValue({}) };
  const generation = { generateFromEntry: jest.fn().mockResolvedValue({}) };

  const controller = new AccountsPayableController(
    payables as never,
    settlement as never,
    dashboard as never,
    generation as never,
  );

  return { controller, payables, settlement, dashboard, generation };
}

describe('Isolamento multiempresa do Contas a Pagar', () => {
  it('recusa abrir o título de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['accounts_payable.view']);

    await expect(
      controller.findOne('payable-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida a permissão contra a empresa lida do banco, não contra a informada', async () => {
    const { controller, payables } = buildController('company-1');
    const insider = actorWith('company-1', ['accounts_payable.view']);

    await controller.findOne('payable-1', insider);

    expect(payables.scopeOf).toHaveBeenCalledWith('payable-1');
    expect(payables.findOne).toHaveBeenCalledWith('payable-1', insider);
  });

  it('exige a permissão de bloqueio para bloquear', async () => {
    const { controller } = buildController();
    const viewer = actorWith('company-1', ['accounts_payable.view']);

    await expect(
      controller.block('payable-1', { reason: 'AUDIT' }, viewer),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão própria para liberar o bloqueio', async () => {
    const { controller } = buildController();
    // Quem bloqueia não necessariamente libera: são permissões separadas de propósito.
    const blocker = actorWith('company-1', ['accounts_payable.block']);

    await expect(
      controller.unblock('payable-1', { releaseReason: 'Liberado' }, blocker),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão de baixa para registrar pagamento', async () => {
    const { controller } = buildController();
    const editor = actorWith('company-1', ['accounts_payable.edit']);

    await expect(
      controller.partialPayment(
        'payable-1',
        { amount: 100, paidAt: '2026-08-05' },
        editor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão de renegociação para renegociar', async () => {
    const { controller } = buildController();
    const editor = actorWith('company-1', ['accounts_payable.edit']);

    await expect(
      controller.renegotiate(
        'payable-1',
        { installments: [], reason: 'Acordo' },
        editor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão de cancelamento para cancelar', async () => {
    const { controller } = buildController();
    const editor = actorWith('company-1', ['accounts_payable.edit']);

    await expect(
      controller.cancel('payable-1', { reason: 'Engano' }, editor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão de reabertura para reabrir', async () => {
    const { controller } = buildController();
    const canceller = actorWith('company-1', ['accounts_payable.cancel']);

    await expect(
      controller.reopen('payable-1', { reason: 'Voltar atrás' }, canceller),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa gerar título de lançamento de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['accounts_payable.create']);

    await expect(
      controller.generate('entry-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa estornar pagamento de título de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', [
      'accounts_payable.partial_payment',
    ]);

    await expect(
      controller.reversePayment('payment-1', { reason: 'Errado' }, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa alterar parcela de título de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['accounts_payable.edit']);

    await expect(
      controller.updateInstallment('i1', { dueDate: '2026-09-10' }, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa decidir retenção de título de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['accounts_payable.edit']);

    await expect(
      controller.decideWithholding(
        'w-1',
        { status: 'CONFIRMED', reason: 'Confere' },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa criar adiantamento em empresa sem vínculo', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['accounts_payable.create']);

    await expect(
      controller.createAdvance(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          supplierId: 'supplier-1',
          amount: 1000,
          grantedAt: '2026-07-20',
        },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa criar título em empresa sem vínculo', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['accounts_payable.create']);

    await expect(
      controller.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          description: 'Aluguel',
          installments: [
            { installmentNumber: 1, dueDate: '2026-08-10', amount: 1000 },
          ],
        },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa alterar os parâmetros sem a permissão de edição', async () => {
    const { controller } = buildController();
    const viewer = actorWith('company-1', ['accounts_payable.view']);

    await expect(
      controller.updateSettings(
        'org-1',
        'company-1',
        { allowPartialPayment: false },
        viewer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa o painel de quem não enxerga a empresa', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['accounts_payable.view']);

    await expect(
      controller.dashboardData('org-1', 'company-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deixa passar quem tem a permissão certa na empresa certa', async () => {
    const { controller, settlement } = buildController('company-1');
    const payer = actorWith('company-1', ['accounts_payable.partial_payment']);

    await controller.partialPayment(
      'payable-1',
      { amount: 100, paidAt: '2026-08-05' },
      payer,
    );

    expect(settlement.registerPayment).toHaveBeenCalled();
  });
});
