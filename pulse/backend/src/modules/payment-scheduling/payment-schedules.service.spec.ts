/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- mocks do jest sao any por natureza */
import { BadRequestException } from '@nestjs/common';
import {
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  PaymentScheduleHistoryAction,
  PaymentScheduleStatus,
} from '@prisma/client';

import {
  PaymentSchedulesService,
  situationOf,
} from './payment-schedules.service';
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
  userAgent: 'jest/1.0',
};

/** Amanhã, para não esbarrar na regra de data retroativa. */
function tomorrow(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function buildService(
  options: {
    schedule?: Record<string, unknown>;
    payable?: Record<string, unknown>;
    installments?: Record<string, unknown>[];
    takenInstallmentIds?: string[];
    settings?: Record<string, unknown>;
  } = {},
) {
  const installments = options.installments ?? [
    {
      id: 'i1',
      installmentNumber: 1,
      status: AccountsPayableInstallmentStatus.OPEN,
      balanceAmount: 5000,
      dueDate: new Date('2026-08-10'),
    },
    {
      id: 'i2',
      installmentNumber: 2,
      status: AccountsPayableInstallmentStatus.OPEN,
      balanceAmount: 5000,
      dueDate: new Date('2026-09-10'),
    },
  ];

  const payable = {
    id: 'payable-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    status: AccountsPayableStatus.OPEN,
    blockedAt: null,
    financialAccountId: 'account-1',
    paymentMethodId: null,
    scheduledPaymentDate: null,
    responsibleUserId: null,
    installments,
    ...options.payable,
  };

  const schedule = {
    id: 'schedule-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    code: 'AG-2026-000001',
    payableId: 'payable-1',
    status: PaymentScheduleStatus.SCHEDULED,
    priority: 'NORMAL',
    financialAccountId: 'account-1',
    paymentMethodId: null,
    bankPaymentType: 'PIX',
    scheduledDate: new Date('2026-08-10'),
    originalDate: new Date('2026-08-10'),
    rescheduleCount: 0,
    totalAmount: 10000,
    responsibleUserId: 'user-1',
    queuePosition: 0,
    batchId: null,
    blockedAt: null,
    items: [],
    ...options.schedule,
  };

  const created: Record<string, any[]> = { history: [], comments: [] };
  let scheduleUpdate: any = null;

  const tx = {
    paymentSchedule: {
      create: jest.fn().mockResolvedValue(schedule),
      update: jest.fn().mockImplementation(({ data }: any) => {
        scheduleUpdate = data;
        return Promise.resolve({ ...schedule, ...data });
      }),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    paymentScheduleItem: { deleteMany: jest.fn().mockResolvedValue({}) },
    paymentBatchItem: { deleteMany: jest.fn().mockResolvedValue({}) },
    paymentScheduleHistory: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.history.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  const prisma = {
    accountsPayable: {
      findFirstOrThrow: jest.fn().mockResolvedValue(payable),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    paymentSchedule: {
      findFirstOrThrow: jest.fn().mockResolvedValue(schedule),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(schedule),
    },
    paymentScheduleItem: {
      findMany: jest.fn().mockResolvedValue(
        (options.takenInstallmentIds ?? []).map((installmentId) => ({
          installmentId,
        })),
      ),
    },
    paymentScheduleSettings: {
      findUnique: jest.fn().mockResolvedValue({
        schedulePrefix: 'AG',
        batchPrefix: 'LOTE',
        blockRetroactiveDates: true,
        minimumLeadTimeDays: 0,
        requireReasonOnReschedule: true,
        considerCreditLimits: true,
        blockOnInsufficientBalance: false,
        defaultPriority: 'NORMAL',
        defaultFinancialAccountId: null,
        defaultBankPaymentType: null,
        ...options.settings,
      }),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    paymentBatch: {
      findFirstOrThrow: jest
        .fn()
        .mockResolvedValue({ companyId: 'company-1', status: 'OPEN' }),
      update: jest.fn().mockResolvedValue({}),
    },
    paymentScheduleHistory: { findMany: jest.fn().mockResolvedValue([]) },
    paymentScheduleComment: {
      create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    },
    $transaction: jest.fn().mockImplementation(async (argument: any) => {
      if (Array.isArray(argument)) return Promise.all(argument);
      return argument(tx);
    }),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const balances = {
    check: jest.fn().mockResolvedValue({ insufficient: false, shortfall: 0 }),
  };

  const service = new PaymentSchedulesService(
    prisma as never,
    audit as never,
    balances as never,
  );

  // `findOne` recarrega ao fim de cada ação; para o teste importa a escrita, não a leitura.
  jest
    .spyOn(service, 'findOne')
    .mockResolvedValue({ id: 'schedule-1' } as never);

  return {
    service,
    prisma,
    tx,
    audit,
    balances,
    created,
    schedule,
    payable,
    scheduleUpdate: () => scheduleUpdate,
  };
}

describe('Situação exibida da programação', () => {
  it('mostra bloqueado acima de tudo', () => {
    expect(
      situationOf({
        status: PaymentScheduleStatus.IN_BATCH,
        blockedAt: new Date(),
        rescheduleCount: 2,
      }),
    ).toBe('BLOCKED');
  });

  it('mostra reprogramado quando a data já mudou e ela segue apenas programada', () => {
    expect(
      situationOf({
        status: PaymentScheduleStatus.SCHEDULED,
        blockedAt: null,
        rescheduleCount: 1,
      }),
    ).toBe('RESCHEDULED');
  });

  it('não sobrepõe a etapa do lote com "reprogramado"', () => {
    expect(
      situationOf({
        status: PaymentScheduleStatus.IN_BATCH,
        blockedAt: null,
        rescheduleCount: 3,
      }),
    ).toBe('IN_BATCH');
  });

  it('devolve a própria situação quando nada se sobrepõe', () => {
    expect(
      situationOf({
        status: PaymentScheduleStatus.PENDING_SCHEDULING,
        blockedAt: null,
        rescheduleCount: 0,
      }),
    ).toBe('PENDING_SCHEDULING');
  });
});

describe('PaymentSchedulesService', () => {
  describe('Criação', () => {
    it('programa todas as parcelas livres e soma o total', async () => {
      const { service, tx } = buildService();

      await service.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          payableId: 'payable-1',
          scheduledDate: tomorrow(),
        },
        actor,
      );

      const data = tx.paymentSchedule.create.mock.calls[0][0].data;
      expect(data.items.create).toHaveLength(2);
      expect(data.totalAmount).toBe(10000);
      expect(data.status).toBe(PaymentScheduleStatus.SCHEDULED);
    });

    it('nasce aguardando programação quando não há data', async () => {
      const { service, tx } = buildService();

      await service.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          payableId: 'payable-1',
        },
        actor,
      );

      expect(tx.paymentSchedule.create.mock.calls[0][0].data.status).toBe(
        PaymentScheduleStatus.PENDING_SCHEDULING,
      );
    });

    it('programa apenas as parcelas escolhidas', async () => {
      const { service, tx } = buildService();

      await service.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          payableId: 'payable-1',
          installmentIds: ['i2'],
          scheduledDate: tomorrow(),
        },
        actor,
      );

      const data = tx.paymentSchedule.create.mock.calls[0][0].data;
      expect(data.items.create).toEqual([
        expect.objectContaining({ installmentId: 'i2', amount: 5000 }),
      ]);
      expect(data.totalAmount).toBe(5000);
    });

    it('ignora parcela já programada em outra programação', async () => {
      const { service, tx } = buildService({ takenInstallmentIds: ['i1'] });

      await service.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          payableId: 'payable-1',
          scheduledDate: tomorrow(),
        },
        actor,
      );

      const data = tx.paymentSchedule.create.mock.calls[0][0].data;
      expect(data.items.create).toEqual([
        expect.objectContaining({ installmentId: 'i2' }),
      ]);
    });

    it('recusa quando todas as parcelas já estão programadas', async () => {
      const { service } = buildService({ takenInstallmentIds: ['i1', 'i2'] });

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            payableId: 'payable-1',
          },
          actor,
        ),
      ).rejects.toThrow('já estão programadas');
    });

    it('recusa título bloqueado no Contas a Pagar', async () => {
      const { service } = buildService({ payable: { blockedAt: new Date() } });

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            payableId: 'payable-1',
          },
          actor,
        ),
      ).rejects.toThrow('bloqueado no Contas a Pagar');
    });

    it('recusa título de outra empresa', async () => {
      const { service } = buildService({ payable: { companyId: 'company-2' } });

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            payableId: 'payable-1',
          },
          actor,
        ),
      ).rejects.toThrow('outra empresa');
    });

    it('recusa título cancelado', async () => {
      const { service } = buildService({
        payable: { status: AccountsPayableStatus.CANCELLED },
      });

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            payableId: 'payable-1',
          },
          actor,
        ),
      ).rejects.toThrow('não está mais em aberto');
    });

    it('recusa data retroativa quando a empresa proíbe', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            payableId: 'payable-1',
            scheduledDate: '2020-01-01',
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('respeita o prazo mínimo entre programar e pagar', async () => {
      const { service } = buildService({
        settings: { minimumLeadTimeDays: 5 },
      });

      await expect(
        service.create(
          {
            organizationId: 'org-1',
            companyId: 'company-1',
            payableId: 'payable-1',
            scheduledDate: tomorrow(),
          },
          actor,
        ),
      ).rejects.toThrow('ao menos 5 dia(s)');
    });
  });

  describe('Alteração e reprogramação', () => {
    it('recusa mudar a data pela edição comum quando a empresa exige motivo', async () => {
      const { service } = buildService();

      await expect(
        service.update('schedule-1', { scheduledDate: tomorrow() }, actor),
      ).rejects.toThrow('Use a ação de reprogramar');
    });

    it('registra a troca de conta como ação própria', async () => {
      const { service, created } = buildService();

      await service.update(
        'schedule-1',
        { financialAccountId: 'account-9' },
        actor,
      );

      expect(created.history[0]).toMatchObject({
        action: PaymentScheduleHistoryAction.ACCOUNT_CHANGED,
        previousValue: 'account-1',
        newValue: 'account-9',
        ipAddress: '10.0.0.7',
        userAgent: 'jest/1.0',
      });
    });

    it('registra a troca de prioridade', async () => {
      const { service, created } = buildService();

      await service.update('schedule-1', { priority: 'URGENT' }, actor);

      expect(created.history[0]).toMatchObject({
        action: PaymentScheduleHistoryAction.PRIORITY_CHANGED,
        newValue: 'URGENT',
      });
    });

    it('reprograma incrementando o contador e guardando o motivo', async () => {
      const { service, created, scheduleUpdate } = buildService();

      await service.reschedule(
        'schedule-1',
        { scheduledDate: tomorrow(), reason: 'Fornecedor pediu prazo' },
        actor,
      );

      expect(scheduleUpdate().rescheduleCount).toBe(1);
      expect(created.history[0]).toMatchObject({
        action: PaymentScheduleHistoryAction.RESCHEDULED,
        reason: 'Fornecedor pediu prazo',
        previousValue: '2026-08-10',
      });
    });

    it('preserva a data original ao reprogramar', async () => {
      const { service, scheduleUpdate } = buildService();

      await service.reschedule(
        'schedule-1',
        { scheduledDate: tomorrow(), reason: 'Ajuste de caixa' },
        actor,
      );

      expect(scheduleUpdate().originalDate).toEqual(new Date('2026-08-10'));
    });

    it('recusa alterar programação bloqueada', async () => {
      const { service } = buildService({ schedule: { blockedAt: new Date() } });

      await expect(
        service.update('schedule-1', { priority: 'HIGH' }, actor),
      ).rejects.toThrow('bloqueada');
    });

    it('recusa alterar programação já enviada ao banco', async () => {
      const { service } = buildService({
        schedule: { status: PaymentScheduleStatus.SENT },
      });

      await expect(
        service.update('schedule-1', { priority: 'HIGH' }, actor),
      ).rejects.toThrow('enviada ao banco');
    });

    it('recusa reprogramar para lote de outra empresa', async () => {
      const { service, prisma } = buildService();
      prisma.paymentBatch.findFirstOrThrow.mockResolvedValue({
        companyId: 'company-2',
        status: 'OPEN',
      });

      await expect(
        service.reschedule(
          'schedule-1',
          {
            scheduledDate: tomorrow(),
            reason: 'Trocar de lote',
            batchId: 'batch-9',
          },
          actor,
        ),
      ).rejects.toThrow('outra empresa');
    });
  });

  describe('Bloqueios', () => {
    it('bloqueia registrando motivo e autor', async () => {
      const { service, tx, created } = buildService();

      await service.block(
        'schedule-1',
        { reason: 'INSUFFICIENT_BALANCE', notes: 'Caixa curto na semana' },
        actor,
      );

      expect(tx.paymentSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blockReason: 'INSUFFICIENT_BALANCE',
            blockedBy: 'user-1',
          }),
        }),
      );
      expect(created.history[0].action).toBe(
        PaymentScheduleHistoryAction.BLOCKED,
      );
    });

    it('recusa bloquear duas vezes', async () => {
      const { service } = buildService({ schedule: { blockedAt: new Date() } });

      await expect(
        service.block('schedule-1', { reason: 'AUDIT' }, actor),
      ).rejects.toThrow('já está bloqueada');
    });

    it('libera limpando o bloqueio e guardando o motivo', async () => {
      const { service, tx } = buildService({
        schedule: { blockedAt: new Date() },
      });

      await service.unblock(
        'schedule-1',
        { releaseReason: 'Caixa reforçado' },
        actor,
      );

      expect(tx.paymentSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blockedAt: null,
            releaseReason: 'Caixa reforçado',
          }),
        }),
      );
    });

    it('recusa liberar o que não está bloqueado', async () => {
      const { service } = buildService();

      await expect(
        service.unblock(
          'schedule-1',
          { releaseReason: 'Nada a liberar' },
          actor,
        ),
      ).rejects.toThrow('não está bloqueada');
    });
  });

  describe('Cancelamento', () => {
    it('apaga os itens para devolver as parcelas à fila', async () => {
      const { service, tx } = buildService();

      await service.cancel(
        'schedule-1',
        { reason: 'Pagamento suspenso' },
        actor,
      );

      expect(tx.paymentScheduleItem.deleteMany).toHaveBeenCalledWith({
        where: { scheduleId: 'schedule-1' },
      });
      expect(tx.paymentSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentScheduleStatus.CANCELLED,
            batchId: null,
            totalAmount: 0,
          }),
        }),
      );
    });

    it('recusa cancelar o que já foi enviado', async () => {
      const { service } = buildService({
        schedule: { status: PaymentScheduleStatus.SENT },
      });

      await expect(
        service.cancel('schedule-1', { reason: 'Tarde demais' }, actor),
      ).rejects.toThrow('já foi enviada ao banco');
    });

    it('recusa cancelar duas vezes', async () => {
      const { service } = buildService({
        schedule: { status: PaymentScheduleStatus.CANCELLED },
      });

      await expect(
        service.cancel('schedule-1', { reason: 'De novo' }, actor),
      ).rejects.toThrow('já está cancelada');
    });
  });

  describe('Ações em lote', () => {
    it('processa cada programação isoladamente e diz quais falharam', async () => {
      const { service } = buildService();

      jest
        .spyOn(service, 'update')
        .mockResolvedValueOnce({ id: 'a' } as never)
        .mockRejectedValueOnce(
          new BadRequestException('Programação bloqueada.'),
        );

      const result = await service.bulkUpdate(
        { scheduleIds: ['a', 'b'], priority: 'HIGH' },
        actor,
      );

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].error).toContain('bloqueada');
    });

    it('exige motivo para alterar em massa a data de quem já tem data', async () => {
      const { service } = buildService();

      const result = await service.bulkUpdate(
        { scheduleIds: ['schedule-1'], scheduledDate: tomorrow() },
        actor,
      );

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('exige motivo');
    });

    it('reordena a fila pela ordem informada', async () => {
      const { service, prisma } = buildService();

      const result = await service.reorderQueue(
        { scheduleIds: ['c', 'a', 'b'] },
        actor,
      );

      expect(result.reordered).toBe(3);
      expect(prisma.paymentSchedule.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'c' },
          data: expect.objectContaining({ queuePosition: 1 }),
        }),
      );
    });
  });
});
