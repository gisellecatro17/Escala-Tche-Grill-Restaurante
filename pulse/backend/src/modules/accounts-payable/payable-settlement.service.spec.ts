/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- mocks do jest sao any por natureza */
import { BadRequestException } from '@nestjs/common';
import {
  AccountsPayableAdjustmentType,
  AccountsPayableEntryStatus,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  SupplierAdvanceStatus,
} from '@prisma/client';

import { PayableSettlementService } from './payable-settlement.service';
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
  userAgent: 'jest',
};

function buildService(
  options: {
    payable?: Record<string, unknown>;
    installments?: Record<string, unknown>[];
    settings?: Record<string, unknown> | null;
    advance?: Record<string, unknown> | null;
    payment?: Record<string, unknown> | null;
    adjustment?: Record<string, unknown> | null;
  } = {},
) {
  const installments = options.installments ?? [
    {
      id: 'i1',
      installmentNumber: 1,
      dueDate: new Date('2026-08-10'),
      originalAmount: 10000,
      netAmount: 10000,
      paidAmount: 0,
      balanceAmount: 10000,
      status: AccountsPayableInstallmentStatus.OPEN,
      financialAccountId: null,
      paymentMethodId: null,
    },
  ];

  const payable = {
    id: 'payable-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    supplierId: 'supplier-1',
    status: AccountsPayableStatus.OPEN,
    blockedAt: null,
    netAmount: 10000,
    paidAmount: 0,
    advanceAmount: 0,
    balanceAmount: 10000,
    financialAccountId: null,
    paymentMethodId: null,
    installments,
    ...options.payable,
  };

  const created: Record<string, any[]> = {
    partialPayment: [],
    adjustment: [],
    history: [],
    renegotiation: [],
    advanceApplication: [],
  };

  const tx = {
    accountsPayablePartialPayment: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.partialPayment.push(data);
        return Promise.resolve(data);
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    accountsPayableAdjustment: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.adjustment.push(data);
        return Promise.resolve(data);
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    accountsPayableHistory: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.history.push(data);
        return Promise.resolve(data);
      }),
    },
    accountsPayableRenegotiation: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.renegotiation.push(data);
        return Promise.resolve(data);
      }),
    },
    accountsPayableInstallment: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    accountsPayableAdvanceApplication: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        created.advanceApplication.push(data);
        return Promise.resolve(data);
      }),
    },
    supplierAdvance: { update: jest.fn().mockResolvedValue({}) },
    accountsPayable: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    accountsPayable: { findFirstOrThrow: jest.fn().mockResolvedValue(payable) },
    accountsPayableSettings: {
      findUnique: jest.fn().mockResolvedValue(
        options.settings === undefined
          ? {
              allowPartialPayment: true,
              defaultMonthlyInterestRate: 1,
              defaultPenaltyRate: 2,
              gracePeriodDays: 0,
            }
          : options.settings,
      ),
    },
    supplierAdvance: {
      findFirstOrThrow: jest.fn().mockResolvedValue(
        options.advance ?? {
          id: 'advance-1',
          companyId: 'company-1',
          supplierId: 'supplier-1',
          status: SupplierAdvanceStatus.OPEN,
          amount: 5000,
          appliedAmount: 0,
          remainingAmount: 5000,
          reference: 'ADT-1',
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    accountsPayablePartialPayment: {
      findFirstOrThrow: jest.fn().mockResolvedValue(
        options.payment ?? {
          id: 'payment-1',
          payableId: 'payable-1',
          installmentId: 'i1',
          amount: 3000,
          status: AccountsPayableEntryStatus.ACTIVE,
          payable,
        },
      ),
    },
    accountsPayableAdjustment: {
      findFirstOrThrow: jest.fn().mockResolvedValue(
        options.adjustment ?? {
          id: 'adjustment-1',
          payableId: 'payable-1',
          installmentId: 'i1',
          type: AccountsPayableAdjustmentType.INTEREST,
          amount: 50,
          status: AccountsPayableEntryStatus.ACTIVE,
          payable,
        },
      ),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (callback: any) => callback(tx)),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const balance = {
    recompute: jest.fn().mockResolvedValue({
      ...payable,
      status: AccountsPayableStatus.PARTIALLY_PAID,
      balanceAmount: 7000,
      paidAmount: 3000,
      advanceAmount: 0,
      netAmount: 10000,
    }),
  };

  const service = new PayableSettlementService(
    prisma as never,
    audit as never,
    balance as never,
  );

  return { service, prisma, tx, audit, balance, created, payable };
}

describe('PayableSettlementService', () => {
  describe('Pagamentos parciais', () => {
    it('registra a baixa e devolve o saldo recalculado', async () => {
      const { service, created, balance } = buildService();

      const result = await service.registerPayment(
        'payable-1',
        { amount: 3000, paidAt: '2026-08-05' },
        actor,
      );

      expect(created.partialPayment).toHaveLength(1);
      expect(created.partialPayment[0]).toMatchObject({
        amount: 3000,
        installmentId: 'i1',
      });
      expect(balance.recompute).toHaveBeenCalledWith(
        expect.anything(),
        'payable-1',
      );
      expect(result.balanceAmount).toBe(7000);
    });

    it('recusa pagamento maior que o saldo', async () => {
      const { service } = buildService();

      await expect(
        service.registerPayment(
          'payable-1',
          { amount: 15000, paidAt: '2026-08-05' },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa pagamento em título sem saldo', async () => {
      const { service } = buildService({ payable: { balanceAmount: 0 } });

      await expect(
        service.registerPayment(
          'payable-1',
          { amount: 10, paidAt: '2026-08-05' },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa baixa parcial quando a empresa não permite', async () => {
      const { service } = buildService({
        settings: { allowPartialPayment: false, gracePeriodDays: 0 },
      });

      await expect(
        service.registerPayment(
          'payable-1',
          { amount: 3000, paidAt: '2026-08-05' },
          actor,
        ),
      ).rejects.toThrow('não permite baixa parcial');
    });

    it('recusa movimento em título bloqueado (critério de aceite 5)', async () => {
      const { service } = buildService({ payable: { blockedAt: new Date() } });

      await expect(
        service.registerPayment(
          'payable-1',
          { amount: 100, paidAt: '2026-08-05' },
          actor,
        ),
      ).rejects.toThrow('bloqueado');
    });

    it('recusa movimento em título cancelado', async () => {
      const { service } = buildService({
        payable: { status: AccountsPayableStatus.CANCELLED },
      });

      await expect(
        service.registerPayment(
          'payable-1',
          { amount: 100, paidAt: '2026-08-05' },
          actor,
        ),
      ).rejects.toThrow('cancelado');
    });

    it('distribui o valor entre as parcelas da mais antiga para a mais nova', async () => {
      const { service, created } = buildService({
        payable: { balanceAmount: 1000 },
        installments: [
          {
            id: 'i2',
            installmentNumber: 2,
            dueDate: new Date('2026-09-10'),
            originalAmount: 500,
            netAmount: 500,
            paidAmount: 0,
            balanceAmount: 500,
            status: AccountsPayableInstallmentStatus.OPEN,
            financialAccountId: null,
            paymentMethodId: null,
          },
          {
            id: 'i1',
            installmentNumber: 1,
            dueDate: new Date('2026-08-10'),
            originalAmount: 500,
            netAmount: 500,
            paidAmount: 0,
            balanceAmount: 500,
            status: AccountsPayableInstallmentStatus.OPEN,
            financialAccountId: null,
            paymentMethodId: null,
          },
        ],
      });

      await service.registerPayment(
        'payable-1',
        { amount: 700, paidAt: '2026-08-05' },
        actor,
      );

      expect(created.partialPayment.map((item) => item.installmentId)).toEqual([
        'i1',
        'i2',
      ]);
      expect(created.partialPayment.map((item) => item.amount)).toEqual([
        500, 200,
      ]);
    });

    it('transforma juros e multa informados na baixa em ajustes rastreáveis', async () => {
      const { service, created } = buildService();

      await service.registerPayment(
        'payable-1',
        {
          amount: 3000,
          paidAt: '2026-08-05',
          interestAmount: 30,
          penaltyAmount: 20,
        },
        actor,
      );

      expect(created.adjustment.map((item) => item.type)).toEqual([
        AccountsPayableAdjustmentType.INTEREST,
        AccountsPayableAdjustmentType.PENALTY,
      ]);
    });

    it('estorna a baixa sem apagá-la', async () => {
      const { service, tx } = buildService();

      await service.reversePayment(
        'payment-1',
        { reason: 'Comprovante errado' },
        actor,
      );

      expect(tx.accountsPayablePartialPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AccountsPayableEntryStatus.REVERSED,
            reversalReason: 'Comprovante errado',
          }),
        }),
      );
    });

    it('recusa estornar duas vezes', async () => {
      const { service } = buildService({
        payment: {
          id: 'payment-1',
          payableId: 'payable-1',
          installmentId: 'i1',
          amount: 3000,
          status: AccountsPayableEntryStatus.REVERSED,
          payable: { organizationId: 'org-1', companyId: 'company-1' },
        },
      });

      await expect(
        service.reversePayment('payment-1', { reason: 'De novo' }, actor),
      ).rejects.toThrow('já foi estornado');
    });
  });

  describe('Ajustes', () => {
    it('lança juros com a memória de cálculo', async () => {
      const { service, created } = buildService();

      await service.addAdjustment(
        'payable-1',
        {
          type: AccountsPayableAdjustmentType.INTEREST,
          amount: 83.2,
          calculationBase: 10000,
          rate: 1,
          overdueDays: 25,
          reason: 'Atraso de 25 dias',
        },
        actor,
      );

      expect(created.adjustment[0]).toMatchObject({
        amount: 83.2,
        calculationBase: 10000,
        rate: 1,
        overdueDays: 25,
      });
    });

    it('recusa desconto maior que o saldo', async () => {
      const { service } = buildService();

      await expect(
        service.addAdjustment(
          'payable-1',
          {
            type: AccountsPayableAdjustmentType.DISCOUNT,
            amount: 20000,
            reason: 'Acordo',
          },
          actor,
        ),
      ).rejects.toThrow('maior que o saldo');
    });

    it('calcula a prévia de juros e multa sem gravar nada', async () => {
      const { service, prisma, tx } = buildService({
        payable: {
          installments: [
            {
              id: 'i1',
              installmentNumber: 1,
              dueDate: new Date('2026-07-01'),
              balanceAmount: 1000,
              status: AccountsPayableInstallmentStatus.OPEN,
            },
          ],
        },
      });

      const preview = await service.previewLateCharges(
        'payable-1',
        new Date('2026-07-31'),
      );

      // 1% ao mês por 30 dias = R$ 10,00; multa de 2% = R$ 20,00.
      expect(preview.lines[0]).toMatchObject({
        overdueDays: 30,
        interest: 10,
        penalty: 20,
      });
      expect(preview.totalInterest).toBe(10);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.accountsPayableAdjustment.create).not.toHaveBeenCalled();
    });
  });

  describe('Renegociação', () => {
    it('guarda o cronograma anterior antes de reescrever as parcelas', async () => {
      const { service, created } = buildService();

      await service.renegotiate(
        'payable-1',
        {
          installments: [
            { installmentNumber: 1, dueDate: '2026-10-10', amount: 5000 },
            { installmentNumber: 2, dueDate: '2026-11-10', amount: 5000 },
          ],
          reason: 'Acordo com o fornecedor',
        },
        actor,
      );

      expect(created.renegotiation).toHaveLength(1);
      expect(created.renegotiation[0].previousSchedule).toEqual([
        expect.objectContaining({ installmentNumber: 1, balanceAmount: 10000 }),
      ]);
      expect(created.renegotiation[0].reason).toBe('Acordo com o fornecedor');
    });

    it('aceita o novo cronograma com juros incluídos no acordo', async () => {
      const { service, created } = buildService();

      await service.renegotiate(
        'payable-1',
        {
          installments: [
            { installmentNumber: 1, dueDate: '2026-10-10', amount: 10500 },
          ],
          reason: 'Parcelamento com juros',
          interestAdded: 500,
        },
        actor,
      );

      expect(created.renegotiation[0].interestAdded).toBe(500);
    });

    it('recusa cronograma que não fecha com o saldo e os encargos', async () => {
      const { service } = buildService();

      await expect(
        service.renegotiate(
          'payable-1',
          {
            installments: [
              { installmentNumber: 1, dueDate: '2026-10-10', amount: 9000 },
            ],
            reason: 'Errado de propósito',
          },
          actor,
        ),
      ).rejects.toThrow('o acordo resulta em');
    });

    it('marca as parcelas antigas como renegociadas em vez de apagá-las', async () => {
      const { service, tx } = buildService();

      await service.renegotiate(
        'payable-1',
        {
          installments: [
            { installmentNumber: 1, dueDate: '2026-10-10', amount: 10000 },
          ],
          reason: 'Novo prazo',
        },
        actor,
      );

      expect(tx.accountsPayableInstallment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AccountsPayableInstallmentStatus.RENEGOTIATED },
        }),
      );
    });

    it('recusa renegociar título já quitado', async () => {
      const { service } = buildService({
        payable: {
          balanceAmount: 0,
          installments: [
            {
              id: 'i1',
              installmentNumber: 1,
              dueDate: new Date('2026-08-10'),
              originalAmount: 1000,
              netAmount: 1000,
              paidAmount: 1000,
              balanceAmount: 0,
              status: AccountsPayableInstallmentStatus.PAID,
            },
          ],
        },
      });

      await expect(
        service.renegotiate(
          'payable-1',
          {
            installments: [
              { installmentNumber: 1, dueDate: '2026-10-10', amount: 100 },
            ],
            reason: 'Tarde demais',
          },
          actor,
        ),
      ).rejects.toThrow('já está quitado');
    });
  });

  describe('Adiantamentos', () => {
    it('abate o adiantamento e atualiza o saldo do adiantamento', async () => {
      const { service, tx, created } = buildService();

      await service.applyAdvance(
        'payable-1',
        { advanceId: 'advance-1', amount: 2000 },
        actor,
      );

      expect(created.advanceApplication[0]).toMatchObject({ amount: 2000 });
      expect(tx.supplierAdvance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appliedAmount: 2000,
            remainingAmount: 3000,
            status: SupplierAdvanceStatus.PARTIALLY_APPLIED,
          }),
        }),
      );
    });

    it('marca o adiantamento como totalmente aplicado quando o saldo zera', async () => {
      const { service, tx } = buildService();

      await service.applyAdvance(
        'payable-1',
        { advanceId: 'advance-1', amount: 5000 },
        actor,
      );

      expect(tx.supplierAdvance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SupplierAdvanceStatus.APPLIED,
          }),
        }),
      );
    });

    it('recusa adiantamento de outra empresa', async () => {
      const { service } = buildService({
        advance: {
          id: 'advance-1',
          companyId: 'company-2',
          supplierId: 'supplier-1',
          status: SupplierAdvanceStatus.OPEN,
          amount: 5000,
          appliedAmount: 0,
          remainingAmount: 5000,
        },
      });

      await expect(
        service.applyAdvance(
          'payable-1',
          { advanceId: 'advance-1', amount: 100 },
          actor,
        ),
      ).rejects.toThrow('outra empresa');
    });

    it('recusa adiantamento de outro fornecedor', async () => {
      const { service } = buildService({
        advance: {
          id: 'advance-1',
          companyId: 'company-1',
          supplierId: 'supplier-9',
          status: SupplierAdvanceStatus.OPEN,
          amount: 5000,
          appliedAmount: 0,
          remainingAmount: 5000,
        },
      });

      await expect(
        service.applyAdvance(
          'payable-1',
          { advanceId: 'advance-1', amount: 100 },
          actor,
        ),
      ).rejects.toThrow('outro fornecedor');
    });

    it('recusa abater mais do que o adiantamento tem', async () => {
      const { service } = buildService();

      await expect(
        service.applyAdvance(
          'payable-1',
          { advanceId: 'advance-1', amount: 6000 },
          actor,
        ),
      ).rejects.toThrow('disponíveis');
    });

    it('recusa abater mais do que o saldo do título', async () => {
      const { service } = buildService({
        payable: { balanceAmount: 1000 },
        advance: {
          id: 'advance-1',
          companyId: 'company-1',
          supplierId: 'supplier-1',
          status: SupplierAdvanceStatus.OPEN,
          amount: 5000,
          appliedAmount: 0,
          remainingAmount: 5000,
        },
      });

      await expect(
        service.applyAdvance(
          'payable-1',
          { advanceId: 'advance-1', amount: 2000 },
          actor,
        ),
      ).rejects.toThrow('maior que o saldo');
    });
  });
});
