/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- mocks do jest sao any por natureza */
import {
  FinancialAccountStatus,
  PaymentBatchStatus,
  PaymentScheduleHistoryAction,
  PaymentScheduleStatus,
} from '@prisma/client';

import { PaymentBatchesService } from './payment-batches.service';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';

const actor: RequestActor = {
  id: 'user-1',
  name: 'Tesouraria',
  email: 'tesouraria@pulse.test',
  avatarUrl: null,
  memberships: [],
  organizationMemberships: [],
  isPlatformAdmin: true,
  ipAddress: '10.0.0.7',
  userAgent: 'jest',
};

function buildService(
  options: {
    batch?: Record<string, unknown>;
    items?: Record<string, unknown>[];
    schedules?: Record<string, unknown>[];
    accountStatus?: FinancialAccountStatus;
  } = {},
) {
  const items = options.items ?? [];

  const batch = {
    id: 'batch-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    code: 'LOTE-2026-000001',
    financialAccountId: 'account-1',
    scheduledDate: new Date('2026-08-10'),
    status: PaymentBatchStatus.OPEN,
    totalAmount: 0,
    itemCount: 0,
    items,
    ...options.batch,
  };

  const created: Record<string, any[]> = { history: [], batchItems: [] };

  const tx = {
    paymentBatch: {
      update: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ ...batch, ...data }),
        ),
    },
    paymentBatchItem: {
      upsert: jest.fn().mockImplementation(({ create }: any) => {
        created.batchItems.push(create);
        return Promise.resolve(create);
      }),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    paymentSchedule: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    paymentScheduleHistory: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.history.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  const prisma = {
    paymentBatch: {
      findFirstOrThrow: jest.fn().mockResolvedValue(batch),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(batch),
      update: jest.fn().mockResolvedValue(batch),
    },
    paymentSchedule: {
      findMany: jest.fn().mockResolvedValue(options.schedules ?? []),
    },
    financialAccount: {
      findFirstOrThrow: jest.fn().mockResolvedValue({
        id: 'account-1',
        companyId: 'company-1',
        status: options.accountStatus ?? FinancialAccountStatus.ACTIVE,
        financialInstitutionId: 'bank-1',
      }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        status: options.accountStatus ?? FinancialAccountStatus.ACTIVE,
      }),
    },
    $transaction: jest.fn().mockImplementation(async (argument: any) => {
      if (Array.isArray(argument)) return Promise.all(argument);
      return argument(tx);
    }),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const schedules = {
    settingsFor: jest.fn().mockResolvedValue({ batchPrefix: 'LOTE' }),
    recomputeBatch: jest.fn().mockResolvedValue(undefined),
  };
  const balances = {
    check: jest.fn().mockResolvedValue({ insufficient: false }),
  };

  const service = new PaymentBatchesService(
    prisma as never,
    audit as never,
    schedules as never,
    balances as never,
  );

  jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'batch-1' } as never);

  return { service, prisma, tx, audit, schedules, balances, created, batch };
}

function scheduleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule-1',
    companyId: 'company-1',
    status: PaymentScheduleStatus.SCHEDULED,
    blockedAt: null,
    batchId: null,
    financialAccountId: 'account-1',
    totalAmount: 5000,
    ...overrides,
  };
}

describe('PaymentBatchesService', () => {
  describe('Criação', () => {
    it('recusa conta de outra empresa', async () => {
      const { service, prisma } = buildService();
      prisma.financialAccount.findFirstOrThrow.mockResolvedValue({
        id: 'account-9',
        companyId: 'company-2',
        status: FinancialAccountStatus.ACTIVE,
        financialInstitutionId: null,
      });

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            financialAccountId: 'account-9',
            scheduledDate: '2026-08-10',
          },
          actor,
        ),
      ).rejects.toThrow('outra empresa');
    });

    it('copia a instituição da conta para o lote', async () => {
      const { service, prisma } = buildService();

      await service.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          financialAccountId: 'account-1',
          scheduledDate: '2026-08-10',
        },
        actor,
      );

      expect(prisma.paymentBatch.create.mock.calls[0][0].data).toMatchObject({
        financialInstitutionId: 'bank-1',
      });
    });
  });

  describe('Composição', () => {
    it('inclui a programação, alinha conta e data e registra o histórico', async () => {
      const { service, tx, created } = buildService({
        schedules: [scheduleFixture()],
      });

      const result = await service.addSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        actor,
      );

      expect(result.added).toBe(1);
      expect(tx.paymentSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: 'batch-1',
            status: PaymentScheduleStatus.IN_BATCH,
            financialAccountId: 'account-1',
            scheduledDate: new Date('2026-08-10'),
          }),
        }),
      );
      expect(created.history[0].action).toBe(
        PaymentScheduleHistoryAction.ADDED_TO_BATCH,
      );
    });

    it('recusa programação de conta diferente da do lote', async () => {
      const { service } = buildService({
        schedules: [scheduleFixture({ financialAccountId: 'account-9' })],
      });

      const result = await service.addSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        actor,
      );

      expect(result.added).toBe(0);
      expect(result.rejected[0].reason).toContain(
        'conta de origem é diferente',
      );
    });

    it('recusa programação bloqueada', async () => {
      const { service } = buildService({
        schedules: [scheduleFixture({ blockedAt: new Date() })],
      });

      const result = await service.addSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        actor,
      );

      expect(result.rejected[0].reason).toBe('Programação bloqueada.');
    });

    it('recusa programação de outra empresa', async () => {
      const { service } = buildService({
        schedules: [scheduleFixture({ companyId: 'company-2' })],
      });

      const result = await service.addSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        actor,
      );

      expect(result.rejected[0].reason).toBe('Pertence a outra empresa.');
    });

    it('recusa programação já em outro lote', async () => {
      const { service } = buildService({
        schedules: [scheduleFixture({ batchId: 'batch-9' })],
      });

      const result = await service.addSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        actor,
      );

      expect(result.rejected[0].reason).toBe('Já está em outro lote.');
    });

    it('reporta programação inexistente sem derrubar as demais', async () => {
      const { service } = buildService({ schedules: [scheduleFixture()] });

      const result = await service.addSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1', 'sumiu'] },
        actor,
      );

      expect(result.added).toBe(1);
      expect(result.rejected).toEqual([
        { scheduleId: 'sumiu', reason: 'Programação não encontrada.' },
      ]);
    });

    it('recusa incluir em lote já fechado', async () => {
      const { service } = buildService({
        batch: { status: PaymentBatchStatus.READY_TO_SEND },
      });

      await expect(
        service.addSchedules('batch-1', { scheduleIds: ['schedule-1'] }, actor),
      ).rejects.toThrow('já foi fechado');
    });

    it('remover devolve a programação à fila sem cancelá-la', async () => {
      const { service, tx } = buildService();

      await service.removeSchedules(
        'batch-1',
        { scheduleIds: ['schedule-1'] },
        actor,
      );

      expect(tx.paymentSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: null,
            status: PaymentScheduleStatus.SCHEDULED,
          }),
        }),
      );
    });
  });

  describe('Fechamento', () => {
    it('recusa fechar lote vazio', async () => {
      const { service } = buildService({ items: [] });

      await expect(
        service.update(
          'batch-1',
          { status: PaymentBatchStatus.READY_TO_SEND },
          actor,
        ),
      ).rejects.toThrow('lote vazio');
    });

    it('recusa fechar com programação bloqueada dentro', async () => {
      const { service } = buildService({
        items: [{ schedule: { blockedAt: new Date() } }],
      });

      await expect(
        service.update(
          'batch-1',
          { status: PaymentBatchStatus.READY_TO_SEND },
          actor,
        ),
      ).rejects.toThrow('bloqueada(s) neste lote');
    });

    it('recusa fechar com a conta inativa', async () => {
      const { service } = buildService({
        items: [{ schedule: { blockedAt: null } }],
        accountStatus: FinancialAccountStatus.INACTIVE,
      });

      await expect(
        service.update(
          'batch-1',
          { status: PaymentBatchStatus.READY_TO_SEND },
          actor,
        ),
      ).rejects.toThrow('não está ativa');
    });

    it('leva as programações para "pronto para envio" ao fechar', async () => {
      const { service, tx } = buildService({
        items: [{ schedule: { blockedAt: null } }],
      });

      await service.update(
        'batch-1',
        { status: PaymentBatchStatus.READY_TO_SEND },
        actor,
      );

      expect(tx.paymentSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PaymentScheduleStatus.READY_TO_SEND },
        }),
      );
    });

    it('recusa marcar como enviado — isso é do módulo seguinte', async () => {
      const { service } = buildService({
        items: [{ schedule: { blockedAt: null } }],
      });

      await expect(
        service.update('batch-1', { status: PaymentBatchStatus.SENT }, actor),
      ).rejects.toThrow('Execução Bancária');
    });

    it('cancelar devolve as programações à fila', async () => {
      const { service, tx } = buildService({
        items: [{ schedule: { blockedAt: null } }],
      });

      await service.update(
        'batch-1',
        { status: PaymentBatchStatus.CANCELLED, reason: 'Caixa insuficiente' },
        actor,
      );

      expect(tx.paymentSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { batchId: null, status: PaymentScheduleStatus.SCHEDULED },
        }),
      );
      expect(tx.paymentBatchItem.deleteMany).toHaveBeenCalled();
    });

    it('mudar a data do lote muda a das programações', async () => {
      const { service, tx } = buildService();

      await service.update('batch-1', { scheduledDate: '2026-08-20' }, actor);

      expect(tx.paymentSchedule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { scheduledDate: new Date('2026-08-20') },
        }),
      );
    });

    it('recusa alterar lote já enviado', async () => {
      const { service } = buildService({
        batch: { status: PaymentBatchStatus.SENT },
      });

      await expect(
        service.update('batch-1', { name: 'Novo nome' }, actor),
      ).rejects.toThrow('já foi enviado ao banco');
    });
  });
});
