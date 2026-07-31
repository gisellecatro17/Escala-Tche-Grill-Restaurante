/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return -- mocks do jest sao any por natureza */
import {
  AccountsPayableAdjustmentType,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
} from '@prisma/client';

import { PayableBalanceService } from './payable-balance.service';

interface InstallmentSeed {
  id: string;
  installmentNumber: number;
  originalAmount: number;
  dueDate: Date;
  status?: AccountsPayableInstallmentStatus;
  scheduledPaymentDate?: Date | null;
  balanceAmount?: number;
  paidAt?: Date | null;
}

function buildContext(options: {
  installments: InstallmentSeed[];
  adjustments?: {
    installmentId: string | null;
    type: AccountsPayableAdjustmentType;
    amount: number;
  }[];
  payments?: { installmentId: string | null; amount: number; paidAt?: Date }[];
  advances?: { installmentId: string | null; amount: number }[];
  withholdings?: { amount: number }[];
  status?: AccountsPayableStatus;
  scheduledPaymentDate?: Date | null;
  paidAt?: Date | null;
}) {
  const payable = {
    id: 'payable-1',
    status: options.status ?? AccountsPayableStatus.OPEN,
    scheduledPaymentDate: options.scheduledPaymentDate ?? null,
    paidAt: options.paidAt ?? null,
    dueDate: options.installments[0]?.dueDate ?? new Date('2026-08-10'),
    installments: options.installments.map((installment) => ({
      ...installment,
      status: installment.status ?? AccountsPayableInstallmentStatus.OPEN,
      scheduledPaymentDate: installment.scheduledPaymentDate ?? null,
      balanceAmount: installment.balanceAmount ?? installment.originalAmount,
      paidAt: installment.paidAt ?? null,
    })),
    adjustments: options.adjustments ?? [],
    partialPayments: (options.payments ?? []).map((payment) => ({
      ...payment,
      paidAt: payment.paidAt ?? new Date('2026-08-05'),
    })),
    advanceUses: options.advances ?? [],
    withholdings: options.withholdings ?? [],
  };

  const installmentUpdates: Record<string, any> = {};
  let payableUpdate: any = null;

  const tx = {
    accountsPayable: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(payable),
      update: jest.fn().mockImplementation(({ data }: any) => {
        payableUpdate = data;
        return Promise.resolve({ ...payable, ...data });
      }),
    },
    accountsPayableInstallment: {
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        installmentUpdates[where.id] = data;
        return Promise.resolve(data);
      }),
    },
  };

  return {
    tx,
    installmentUpdates,
    payableUpdate: () => payableUpdate,
  };
}

describe('PayableBalanceService', () => {
  const service = new PayableBalanceService();

  it('calcula o saldo do título somando as parcelas', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 5000,
          dueDate: new Date('2026-08-10'),
        },
        {
          id: 'i2',
          installmentNumber: 2,
          originalAmount: 5000,
          dueDate: new Date('2026-09-10'),
        },
      ],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate()).toMatchObject({
      originalAmount: 10000,
      netAmount: 10000,
      paidAmount: 0,
      balanceAmount: 10000,
      status: AccountsPayableStatus.OPEN,
    });
  });

  it('mantém o saldo correto após um pagamento parcial (seção 8)', async () => {
    // Título de R$ 10.000, pagamento de R$ 3.000, saldo esperado de R$ 7.000.
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 10000,
          dueDate: new Date('2026-08-10'),
        },
      ],
      payments: [{ installmentId: 'i1', amount: 3000 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate()).toMatchObject({
      paidAmount: 3000,
      balanceAmount: 7000,
      status: AccountsPayableStatus.PARTIALLY_PAID,
    });
    expect(context.installmentUpdates.i1).toMatchObject({
      paidAmount: 3000,
      balanceAmount: 7000,
      status: AccountsPayableInstallmentStatus.PARTIALLY_PAID,
    });
  });

  it('marca como pago quando o saldo zera', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-08-10'),
        },
      ],
      payments: [{ installmentId: 'i1', amount: 1000 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate()).toMatchObject({
      balanceAmount: 0,
      status: AccountsPayableStatus.PAID,
    });
    expect(context.installmentUpdates.i1.status).toBe(
      AccountsPayableInstallmentStatus.PAID,
    );
  });

  it('soma juros e multa e desconta o desconto', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-07-10'),
        },
      ],
      adjustments: [
        {
          installmentId: 'i1',
          type: AccountsPayableAdjustmentType.INTEREST,
          amount: 33.2,
        },
        {
          installmentId: 'i1',
          type: AccountsPayableAdjustmentType.PENALTY,
          amount: 20,
        },
        {
          installmentId: 'i1',
          type: AccountsPayableAdjustmentType.DISCOUNT,
          amount: 3.2,
        },
      ],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate()).toMatchObject({
      interestAmount: 33.2,
      penaltyAmount: 20,
      discountAmount: 3.2,
      netAmount: 1050,
      balanceAmount: 1050,
    });
  });

  it('rateia a retenção entre as parcelas e a soma fecha com o líquido', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-08-10'),
        },
        {
          id: 'i2',
          installmentNumber: 2,
          originalAmount: 1000,
          dueDate: new Date('2026-09-10'),
        },
        {
          id: 'i3',
          installmentNumber: 3,
          originalAmount: 1000,
          dueDate: new Date('2026-10-10'),
        },
      ],
      withholdings: [{ amount: 100 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    const parcelTotal =
      context.installmentUpdates.i1.netAmount +
      context.installmentUpdates.i2.netAmount +
      context.installmentUpdates.i3.netAmount;

    expect(context.payableUpdate().netAmount).toBe(2900);
    expect(parcelTotal).toBe(2900);
  });

  it('rateia o pagamento lançado no título entre as parcelas em aberto', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 500,
          dueDate: new Date('2026-08-10'),
        },
        {
          id: 'i2',
          installmentNumber: 2,
          originalAmount: 500,
          dueDate: new Date('2026-09-10'),
        },
      ],
      payments: [{ installmentId: null, amount: 400 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().paidAmount).toBe(400);
    expect(
      context.installmentUpdates.i1.paidAmount +
        context.installmentUpdates.i2.paidAmount,
    ).toBe(400);
  });

  it('abate adiantamento como pagamento para efeito de saldo', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 2000,
          dueDate: new Date('2026-08-10'),
        },
      ],
      advances: [{ installmentId: 'i1', amount: 500 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate()).toMatchObject({
      advanceAmount: 500,
      balanceAmount: 1500,
      status: AccountsPayableStatus.PARTIALLY_PAID,
    });
  });

  it('ignora parcelas canceladas e renegociadas no total', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-08-10'),
        },
        {
          id: 'i2',
          installmentNumber: 2,
          originalAmount: 1000,
          dueDate: new Date('2026-09-10'),
          status: AccountsPayableInstallmentStatus.CANCELLED,
        },
        {
          id: 'i3',
          installmentNumber: 3,
          originalAmount: 1000,
          dueDate: new Date('2026-10-10'),
          status: AccountsPayableInstallmentStatus.RENEGOTIATED,
        },
      ],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().netAmount).toBe(1000);
    expect(context.installmentUpdates.i2).toBeUndefined();
    expect(context.installmentUpdates.i3).toBeUndefined();
  });

  it('não devolve um título cancelado para "em aberto"', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-08-10'),
        },
      ],
      status: AccountsPayableStatus.CANCELLED,
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().status).toBe(
      AccountsPayableStatus.CANCELLED,
    );
  });

  it('preserva a situação escrita pelo agendamento bancário enquanto não há pagamento', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-08-10'),
        },
      ],
      status: AccountsPayableStatus.BANK_SCHEDULED,
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().status).toBe(
      AccountsPayableStatus.BANK_SCHEDULED,
    );
  });

  it('vira "programado" quando existe data de pagamento programada', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 1000,
          dueDate: new Date('2026-08-10'),
          scheduledPaymentDate: new Date('2026-08-05'),
        },
      ],
      scheduledPaymentDate: new Date('2026-08-05'),
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().status).toBe(
      AccountsPayableStatus.SCHEDULED,
    );
    expect(context.installmentUpdates.i1.status).toBe(
      AccountsPayableInstallmentStatus.SCHEDULED,
    );
  });

  it('usa o próximo vencimento em aberto como vencimento do título', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 500,
          dueDate: new Date('2026-08-10'),
        },
        {
          id: 'i2',
          installmentNumber: 2,
          originalAmount: 500,
          dueDate: new Date('2026-09-10'),
        },
      ],
      payments: [{ installmentId: 'i1', amount: 500 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().dueDate).toEqual(new Date('2026-09-10'));
  });

  it('nunca deixa o saldo negativo', async () => {
    const context = buildContext({
      installments: [
        {
          id: 'i1',
          installmentNumber: 1,
          originalAmount: 100,
          dueDate: new Date('2026-08-10'),
        },
      ],
      adjustments: [
        {
          installmentId: 'i1',
          type: AccountsPayableAdjustmentType.DISCOUNT,
          amount: 100,
        },
      ],
      payments: [{ installmentId: 'i1', amount: 50 }],
    });

    await service.recompute(context.tx as never, 'payable-1');

    expect(context.payableUpdate().balanceAmount).toBe(0);
  });
});
