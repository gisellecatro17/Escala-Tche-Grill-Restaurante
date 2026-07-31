import { ForbiddenException } from '@nestjs/common';

import { PaymentSchedulingController } from './payment-scheduling.controller';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import type { RoleSlug } from '../roles/role-slug.enum';

/**
 * Isolamento multiempresa (critério de aceite 8).
 *
 * A permissão é sempre conferida contra a empresa **lida do banco**. Ter acesso à empresa A
 * não pode programar, bloquear ou lotear um pagamento da empresa B.
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
    id: 'schedule-1',
    organizationId: 'org-1',
    companyId: scopeCompanyId,
    status: 'SCHEDULED',
    blockedAt: null,
  };

  const schedules = {
    scopeOf: jest.fn().mockResolvedValue(scope),
    scopeOfPayable: jest.fn().mockResolvedValue(scope),
    settingsFor: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn().mockResolvedValue({}),
    findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    findOne: jest.fn().mockResolvedValue({ id: 'schedule-1' }),
    findSchedulable: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    create: jest.fn().mockResolvedValue({ id: 'schedule-1' }),
    update: jest.fn().mockResolvedValue({}),
    reschedule: jest.fn().mockResolvedValue({}),
    block: jest.fn().mockResolvedValue({}),
    unblock: jest.fn().mockResolvedValue({}),
    cancel: jest.fn().mockResolvedValue({}),
    history: jest.fn().mockResolvedValue([]),
    comment: jest.fn().mockResolvedValue({}),
    bulkUpdate: jest.fn().mockResolvedValue({ total: 0 }),
    bulkCancel: jest.fn().mockResolvedValue({ total: 0 }),
    reorderQueue: jest.fn().mockResolvedValue({ reordered: 0 }),
  };

  const batches = {
    scopeOf: jest.fn().mockResolvedValue({ ...scope, id: 'batch-1' }),
    findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    findOne: jest.fn().mockResolvedValue({ id: 'batch-1' }),
    create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
    update: jest.fn().mockResolvedValue({}),
    addSchedules: jest.fn().mockResolvedValue({ added: 0, rejected: [] }),
    removeSchedules: jest.fn().mockResolvedValue({}),
  };

  const dashboard = { build: jest.fn().mockResolvedValue({}) };
  const simulation = { run: jest.fn().mockResolvedValue({}) };
  const balances = { positionsOf: jest.fn().mockResolvedValue([]) };

  const controller = new PaymentSchedulingController(
    schedules as never,
    batches as never,
    dashboard as never,
    simulation as never,
    balances as never,
  );

  return { controller, schedules, batches, dashboard, simulation, balances };
}

describe('Isolamento multiempresa do Agendamento Bancário', () => {
  it('recusa abrir a programação de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['payment_schedule.view']);

    await expect(
      controller.findOne('schedule-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida a permissão contra a empresa lida do banco', async () => {
    const { controller, schedules } = buildController('company-1');
    const insider = actorWith('company-1', ['payment_schedule.view']);

    await controller.findOne('schedule-1', insider);

    expect(schedules.scopeOf).toHaveBeenCalledWith('schedule-1');
  });

  it('exige a permissão de criação para programar', async () => {
    const { controller } = buildController();
    const viewer = actorWith('company-1', ['payment_schedule.view']);

    await expect(
      controller.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          payableId: 'payable-1',
        },
        viewer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão própria para reprogramar', async () => {
    const { controller } = buildController();
    // Editar e reprogramar são permissões separadas: reprogramar muda a data acordada.
    const editor = actorWith('company-1', ['payment_schedule.edit']);

    await expect(
      controller.reschedule(
        'schedule-1',
        { scheduledDate: '2026-08-20', reason: 'Ajuste' },
        editor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão de bloqueio para bloquear', async () => {
    const { controller } = buildController();
    const editor = actorWith('company-1', ['payment_schedule.edit']);

    await expect(
      controller.block('schedule-1', { reason: 'AUDIT' }, editor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão própria para liberar o bloqueio', async () => {
    const { controller } = buildController();
    const blocker = actorWith('company-1', ['payment_schedule.block']);

    await expect(
      controller.unblock('schedule-1', { releaseReason: 'Liberado' }, blocker),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige a permissão de lote para criar lote', async () => {
    const { controller } = buildController();
    const editor = actorWith('company-1', ['payment_schedule.edit']);

    await expect(
      controller.createBatch(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          financialAccountId: 'account-1',
          scheduledDate: '2026-08-10',
        },
        editor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa lote de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['payment_schedule.batch']);

    await expect(
      controller.updateBatch('batch-1', { name: 'Novo' }, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa incluir programações em lote de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['payment_schedule.batch']);

    await expect(
      controller.addToBatch(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa a simulação de quem não enxerga a empresa', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['payment_schedule.view']);

    await expect(
      controller.simulate(
        { companyId: 'company-1', from: '2026-08-01', to: '2026-08-31' },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa a posição das contas de outra empresa', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['payment_schedule.view']);

    await expect(
      controller.accountPositions('company-1', undefined, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa a lista de títulos programáveis de outra empresa', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['payment_schedule.view']);

    await expect(
      controller.schedulable(
        { companyId: 'company-1', page: 1, perPage: 20, order: 'asc' },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa alterar parâmetros sem permissão de edição', async () => {
    const { controller } = buildController();
    const viewer = actorWith('company-1', ['payment_schedule.view']);

    await expect(
      controller.updateSettings(
        'org-1',
        'company-1',
        { blockRetroactiveDates: false },
        viewer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa ação em massa sobre programação de outra empresa', async () => {
    const { controller } = buildController('company-1');
    const outsider = actorWith('company-2', ['payment_schedule.edit']);

    await expect(
      controller.bulkUpdate(
        { scheduleIds: ['schedule-1'], priority: 'HIGH' },
        outsider,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa o painel de quem não enxerga a empresa', async () => {
    const { controller } = buildController();
    const outsider = actorWith('company-2', ['payment_schedule.view']);

    await expect(
      controller.dashboardData('org-1', 'company-1', outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deixa passar quem tem a permissão certa na empresa certa', async () => {
    const { controller, schedules } = buildController('company-1');
    const scheduler = actorWith('company-1', ['payment_schedule.reschedule']);

    await controller.reschedule(
      'schedule-1',
      { scheduledDate: '2026-08-20', reason: 'Ajuste de caixa' },
      scheduler,
    );

    expect(schedules.reschedule).toHaveBeenCalled();
  });
});
