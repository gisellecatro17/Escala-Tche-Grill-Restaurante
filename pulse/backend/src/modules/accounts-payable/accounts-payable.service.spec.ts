/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- mocks do jest sao any por natureza */
import { BadRequestException } from '@nestjs/common';
import {
  AccountsPayableHistoryAction,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
} from '@prisma/client';

import {
  AccountsPayableService,
  isOverdue,
  situationOf,
} from './accounts-payable.service';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';

const actor: RequestActor = {
  id: 'user-1',
  name: 'Financeiro',
  email: 'financeiro@pulse.test',
  avatarUrl: null,
  memberships: [],
  organizationMemberships: [],
  isPlatformAdmin: true,
  ipAddress: '10.0.0.9',
  userAgent: 'jest/1.0',
};

function buildService(
  options: {
    payable?: Record<string, unknown>;
    installment?: Record<string, unknown> | null;
    settings?: Record<string, unknown>;
  } = {},
) {
  const payable = {
    id: 'payable-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    code: 'CP-2026-000001',
    status: AccountsPayableStatus.OPEN,
    blockedAt: null,
    supplierId: 'supplier-1',
    costCenterId: 'cc-1',
    projectId: null,
    netAmount: 10000,
    paidAmount: 0,
    balanceAmount: 10000,
    financialAccountId: null,
    paymentMethodId: null,
    scheduledPaymentDate: null,
    cancelledAt: null,
    dueDate: new Date('2026-08-10'),
    tags: [],
    blocks: [],
    installments: [
      {
        id: 'i1',
        installmentNumber: 1,
        dueDate: new Date('2026-08-10'),
        originalAmount: 10000,
        netAmount: 10000,
        paidAmount: 0,
        balanceAmount: 10000,
        status: AccountsPayableInstallmentStatus.OPEN,
      },
    ],
    ...options.payable,
  };

  const installment =
    options.installment === null
      ? null
      : {
          id: 'i1',
          payableId: 'payable-1',
          installmentNumber: 1,
          dueDate: new Date('2026-08-10'),
          originalAmount: 10000,
          paidAmount: 0,
          balanceAmount: 10000,
          status: AccountsPayableInstallmentStatus.OPEN,
          payable,
          ...options.installment,
        };

  const history: any[] = [];
  const blocks: any[] = [];

  const tx = {
    accountsPayable: {
      create: jest.fn().mockResolvedValue({ id: 'payable-1' }),
      update: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ ...payable, ...data }),
        ),
    },
    accountsPayableInstallment: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    accountsPayableHistory: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        history.push(data);
        return Promise.resolve(data);
      }),
    },
    accountsPayableBlock: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        blocks.push(data);
        return Promise.resolve(data);
      }),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    accountsPayableTag: {
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    accountsPayableWithholding: { upsert: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    accountsPayable: {
      findFirstOrThrow: jest.fn().mockResolvedValue(payable),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([payable]),
      count: jest.fn().mockResolvedValue(1),
    },
    accountsPayableInstallment: {
      findFirstOrThrow: jest.fn().mockResolvedValue(installment),
    },
    accountsPayableComment: {
      create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    accountsPayableHistory: { findMany: jest.fn().mockResolvedValue([]) },
    accountsPayablePartialPayment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    accountsPayableAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
    accountsPayableAdvanceApplication: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    accountsPayableRenegotiation: { findMany: jest.fn().mockResolvedValue([]) },
    accountsPayableSettings: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest
      .fn()
      .mockImplementation(async (callback: any) => callback(tx)),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const balance = {
    recompute: jest
      .fn()
      .mockResolvedValue({ ...payable, status: payable.status }),
  };
  const generation = {
    settingsFor: jest.fn().mockResolvedValue({
      codePrefix: 'CP',
      defaultPriority: 'NORMAL',
      requireJustificationOnDueDateChange: true,
      requireJustificationOnAmountChange: true,
      reopenWindowDays: null,
      ...options.settings,
    }),
  };

  const service = new AccountsPayableService(
    prisma as never,
    audit as never,
    balance as never,
    generation as never,
  );

  return {
    service,
    prisma,
    tx,
    audit,
    balance,
    generation,
    history,
    blocks,
    payable,
  };
}

describe('Situação exibida do título', () => {
  const today = new Date(Date.UTC(2026, 7, 15));

  it('mostra "vencido" quando a data passou e ainda há saldo', () => {
    const payable = {
      status: AccountsPayableStatus.OPEN,
      blockedAt: null,
      dueDate: new Date(Date.UTC(2026, 7, 10)),
      balanceAmount: 500,
    };

    expect(isOverdue(payable, today)).toBe(true);
    expect(situationOf(payable, today)).toBe('OVERDUE');
  });

  it('não considera vencido o que já foi pago', () => {
    expect(
      isOverdue(
        {
          status: AccountsPayableStatus.PAID,
          dueDate: new Date(Date.UTC(2026, 7, 10)),
          balanceAmount: 0,
        },
        today,
      ),
    ).toBe(false);
  });

  it('bloqueado vence vencido na exibição, sem apagar a situação de pagamento', () => {
    expect(
      situationOf(
        {
          status: AccountsPayableStatus.PARTIALLY_PAID,
          blockedAt: new Date(),
          dueDate: new Date(Date.UTC(2026, 7, 10)),
          balanceAmount: 500,
        },
        today,
      ),
    ).toBe('BLOCKED');
  });

  it('devolve a própria situação quando não está vencido nem bloqueado', () => {
    expect(
      situationOf(
        {
          status: AccountsPayableStatus.SCHEDULED,
          blockedAt: null,
          dueDate: new Date(Date.UTC(2026, 7, 20)),
          balanceAmount: 500,
        },
        today,
      ),
    ).toBe('SCHEDULED');
  });
});

describe('AccountsPayableService', () => {
  describe('Bloqueios (seção 12)', () => {
    it('bloqueia registrando motivo e espelhando no título', async () => {
      const { service, blocks, tx } = buildService();

      await service.block(
        'payable-1',
        { reason: 'DOCUMENT_PENDING', description: 'Falta a nota' },
        actor,
      );

      expect(blocks[0]).toMatchObject({ reason: 'DOCUMENT_PENDING' });
      expect(tx.accountsPayable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blockedAt: expect.any(Date) }),
        }),
      );
    });

    it('recusa bloquear duas vezes', async () => {
      const { service } = buildService({ payable: { blockedAt: new Date() } });

      await expect(
        service.block('payable-1', { reason: 'AUDIT' }, actor),
      ).rejects.toThrow('já está bloqueado');
    });

    it('libera o bloqueio mantendo o registro do que aconteceu', async () => {
      const { service, tx, history } = buildService({
        payable: { blockedAt: new Date('2026-07-20') },
      });

      await service.unblock(
        'payable-1',
        { releaseReason: 'Nota recebida' },
        actor,
      );

      expect(tx.accountsPayableBlock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payableId: 'payable-1', releasedAt: null },
        }),
      );
      expect(history[0]).toMatchObject({
        action: AccountsPayableHistoryAction.UNBLOCKED,
        justification: 'Nota recebida',
      });
    });

    it('recusa liberar o que não está bloqueado', async () => {
      const { service } = buildService();

      await expect(
        service.unblock(
          'payable-1',
          { releaseReason: 'Nada a liberar' },
          actor,
        ),
      ).rejects.toThrow('não está bloqueado');
    });

    it('impede programar pagamento de título bloqueado (critério de aceite 5)', async () => {
      const { service } = buildService({ payable: { blockedAt: new Date() } });

      await expect(
        service.schedule(
          'payable-1',
          { scheduledPaymentDate: '2026-08-05' },
          actor,
        ),
      ).rejects.toThrow('bloqueado');
    });
  });

  describe('Programação de pagamento', () => {
    it('programa as parcelas em aberto e registra no histórico', async () => {
      const { service, tx, history } = buildService();

      await service.schedule(
        'payable-1',
        { scheduledPaymentDate: '2026-08-05', financialAccountId: 'acc-9' },
        actor,
      );

      expect(tx.accountsPayableInstallment.updateMany).toHaveBeenCalled();
      expect(history[0]).toMatchObject({
        action: AccountsPayableHistoryAction.SCHEDULED,
        newValue: '2026-08-05',
      });
    });

    it('recusa programar título sem saldo', async () => {
      const { service } = buildService({ payable: { balanceAmount: 0 } });

      await expect(
        service.schedule(
          'payable-1',
          { scheduledPaymentDate: '2026-08-05' },
          actor,
        ),
      ).rejects.toThrow('não tem saldo a programar');
    });
  });

  describe('Ciclo de vida', () => {
    it('cancela com motivo e cancela as parcelas ainda não pagas', async () => {
      const { service, tx, history } = buildService();

      await service.cancel(
        'payable-1',
        { reason: 'Nota cancelada pelo fornecedor' },
        actor,
      );

      expect(tx.accountsPayableInstallment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AccountsPayableInstallmentStatus.CANCELLED },
        }),
      );
      expect(history[0]).toMatchObject({
        action: AccountsPayableHistoryAction.CANCELLED,
        justification: 'Nota cancelada pelo fornecedor',
      });
    });

    it('recusa cancelar título com pagamento registrado', async () => {
      const { service } = buildService({ payable: { paidAmount: 3000 } });

      await expect(
        service.cancel('payable-1', { reason: 'Tarde demais' }, actor),
      ).rejects.toThrow('Estorne os pagamentos');
    });

    it('reabre um título cancelado', async () => {
      const { service, tx } = buildService({
        payable: {
          status: AccountsPayableStatus.CANCELLED,
          cancelledAt: new Date('2026-07-25'),
        },
      });

      await service.reopen(
        'payable-1',
        { reason: 'Cancelamento por engano' },
        actor,
      );

      expect(tx.accountsPayable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AccountsPayableStatus.OPEN }),
        }),
      );
    });

    it('recusa reabrir o que não está cancelado', async () => {
      const { service } = buildService();

      await expect(
        service.reopen('payable-1', { reason: 'Não faz sentido' }, actor),
      ).rejects.toThrow('Só um título cancelado');
    });

    it('respeita a janela de reabertura da empresa', async () => {
      const { service } = buildService({
        payable: {
          status: AccountsPayableStatus.CANCELLED,
          cancelledAt: new Date(Date.now() - 40 * 86_400_000),
        },
        settings: { reopenWindowDays: 30 },
      });

      await expect(
        service.reopen('payable-1', { reason: 'Muito tarde' }, actor),
      ).rejects.toThrow('prazo de reabertura');
    });
  });

  describe('Edição e histórico (seção 18)', () => {
    it('registra a troca de fornecedor como ação própria, com IP e dispositivo', async () => {
      const { service, history } = buildService();

      await service.update(
        'payable-1',
        { supplierId: 'supplier-2', justification: 'Nota emitida pela filial' },
        actor,
      );

      expect(history[0]).toMatchObject({
        action: AccountsPayableHistoryAction.SUPPLIER_CHANGED,
        field: 'supplierId',
        previousValue: 'supplier-1',
        newValue: 'supplier-2',
        ipAddress: '10.0.0.9',
        userAgent: 'jest/1.0',
      });
    });

    it('exige justificativa quando a empresa pede', async () => {
      const { service } = buildService();

      await expect(
        service.update('payable-1', { costCenterId: 'cc-2' }, actor),
      ).rejects.toThrow('exige justificativa');
    });

    it('recusa editar título que já saiu de cena', async () => {
      const { service } = buildService({
        payable: { status: AccountsPayableStatus.PAID },
      });

      await expect(
        service.update('payable-1', { notes: 'tarde' }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('exige justificativa para mudar o vencimento da parcela', async () => {
      const { service } = buildService();

      await expect(
        service.updateInstallment('i1', { dueDate: '2026-09-30' }, actor),
      ).rejects.toThrow('justificativa para alterar o vencimento');
    });

    it('registra a mudança de vencimento com a data anterior', async () => {
      const { service, history } = buildService();

      await service.updateInstallment(
        'i1',
        { dueDate: '2026-09-30', justification: 'Prorrogado com o fornecedor' },
        actor,
      );

      expect(history[0]).toMatchObject({
        action: AccountsPayableHistoryAction.DUE_DATE_CHANGED,
        previousValue: '2026-08-10',
        newValue: '2026-09-30',
      });
    });

    it('recusa reduzir a parcela abaixo do que já foi pago', async () => {
      const { service } = buildService({
        installment: { paidAmount: 6000, balanceAmount: 4000 },
      });

      await expect(
        service.updateInstallment(
          'i1',
          { amount: 5000, justification: 'Correção' },
          actor,
        ),
      ).rejects.toThrow('menor do que o já pago');
    });

    it('recusa alterar parcela já paga', async () => {
      const { service } = buildService({
        installment: { status: AccountsPayableInstallmentStatus.PAID },
      });

      await expect(
        service.updateInstallment('i1', { dueDate: '2026-09-30' }, actor),
      ).rejects.toThrow('já foi paga');
    });
  });

  describe('Reparcelamento (seção 7)', () => {
    it('recusa reparcelamento que muda o valor total', async () => {
      const { service } = buildService();

      await expect(
        service.reinstall(
          'payable-1',
          {
            installments: [
              { installmentNumber: 1, dueDate: '2026-09-10', amount: 8000 },
            ],
            justification: 'Errado',
          },
          actor,
        ),
      ).rejects.toThrow('use a renegociação');
    });

    it('substitui as parcelas quando o total bate', async () => {
      const { service, tx } = buildService();

      await service.reinstall(
        'payable-1',
        {
          installments: [
            { installmentNumber: 1, dueDate: '2026-09-10', amount: 5000 },
            { installmentNumber: 2, dueDate: '2026-10-10', amount: 5000 },
          ],
          justification: 'Dividido em duas',
        },
        actor,
      );

      expect(tx.accountsPayableInstallment.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retenções (seção 11)', () => {
    it('recusa revisar retenção de título já pago em parte', async () => {
      const { service } = buildService({ payable: { paidAmount: 1000 } });

      await expect(
        service.reviseWithholding(
          'payable-1',
          {
            taxType: 'ISS',
            calculationBase: 10000,
            rate: 5,
            amount: 500,
            reason: 'Alíquota errada',
          },
          actor,
        ),
      ).rejects.toThrow('valor já liquidado');
    });

    it('grava a revisão com a memória de cálculo', async () => {
      const { service, tx } = buildService();

      await service.reviseWithholding(
        'payable-1',
        {
          taxType: 'ISS',
          calculationBase: 10000,
          rate: 3,
          amount: 300,
          reason: 'Município com alíquota de 3%',
        },
        actor,
      );

      expect(tx.accountsPayableWithholding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ rate: 3, amount: 300 }),
        }),
      );
    });
  });

  describe('Mascaramento', () => {
    it('mascara linha digitável e código de barras para quem não tem a permissão', async () => {
      const { service } = buildService({
        payable: {
          barcode: '12345678901234567890',
          digitableLine: '00190500954014481606906809350314337370000000100',
          pixKey: 'financeiro@fornecedor.com.br',
        },
      });

      const restricted: RequestActor = {
        ...actor,
        isPlatformAdmin: false,
        memberships: [
          {
            companyId: 'company-1',
            companyName: 'Empresa',
            organizationId: 'org-1',
            organizationName: 'Org',
            role: { id: 'r', name: 'Financeiro', slug: 'financeiro' as never },
            permissions: ['accounts_payable.view'],
          },
        ],
      };

      const result = await service.findOne('payable-1', restricted);

      expect(result.barcode).toBe('****************7890');
      expect(result.pixKey).toContain('*');
      expect(result.pixKey).not.toBe('financeiro@fornecedor.com.br');
    });

    it('mostra os valores inteiros para quem tem a permissão de dados sensíveis', async () => {
      const { service } = buildService({
        payable: { barcode: '12345678901234567890' },
      });

      const result = await service.findOne('payable-1', actor);

      expect(result.barcode).toBe('12345678901234567890');
    });
  });
});
