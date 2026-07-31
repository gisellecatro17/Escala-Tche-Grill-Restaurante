import { PaymentSimulationService } from './payment-simulation.service';

function buildService(
  options: {
    schedules?: {
      id: string;
      financialAccountId: string | null;
      scheduledDate: Date | null;
      totalAmount: number;
    }[];
    spendingPower?: number;
    openingBalance?: number;
    creditLimit?: number;
  } = {},
) {
  const prisma = {
    paymentSchedule: {
      findMany: jest.fn().mockResolvedValue(options.schedules ?? []),
    },
  };

  const balances = {
    positionOf: jest.fn().mockImplementation((accountId: string) =>
      Promise.resolve({
        accountId,
        accountName: `Conta ${accountId}`,
        openingBalance: options.openingBalance ?? 10000,
        creditLimit: options.creditLimit ?? 0,
        spendingPower: options.spendingPower ?? 10000,
      }),
    ),
  };

  return {
    service: new PaymentSimulationService(prisma as never, balances as never),
    prisma,
    balances,
  };
}

describe('PaymentSimulationService', () => {
  const base = { companyId: 'company-1', from: '2026-08-01', to: '2026-08-31' };

  it('projeta o saldo dia a dia descontando os desembolsos', async () => {
    const { service } = buildService({
      spendingPower: 10000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 4000,
        },
        {
          id: 's2',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-10'),
          totalAmount: 3000,
        },
      ],
    });

    const result = await service.run(base);

    expect(result.accounts[0].days).toEqual([
      expect.objectContaining({ date: '2026-08-05', projectedBalance: 6000 }),
      expect.objectContaining({ date: '2026-08-10', projectedBalance: 3000 }),
    ]);
    expect(result.totalOutflow).toBe(7000);
  });

  it('aponta déficit e o dia em que o caixa fica no vermelho', async () => {
    const { service } = buildService({
      spendingPower: 5000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 4000,
        },
        {
          id: 's2',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-12'),
          totalAmount: 3000,
        },
      ],
    });

    const result = await service.run(base);

    expect(result.hasDeficit).toBe(true);
    expect(result.totalDeficit).toBe(2000);
    expect(result.accounts[0].lowestBalanceDate).toBe('2026-08-12');
  });

  it('mostra sobra de caixa quando o dinheiro cobre tudo', async () => {
    const { service } = buildService({
      spendingPower: 20000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 4000,
        },
      ],
    });

    const result = await service.run(base);

    expect(result.hasDeficit).toBe(false);
    expect(result.totalSurplus).toBe(16000);
  });

  it('aplica a data hipotética sem gravar nada', async () => {
    const { service, prisma } = buildService({
      spendingPower: 5000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 4000,
        },
      ],
    });

    const result = await service.run({
      ...base,
      changes: [{ scheduleId: 's1', scheduledDate: '2026-08-20' }],
    });

    expect(result.accounts[0].days[0].date).toBe('2026-08-20');
    expect(result.simulated).toBe(1);
    // O serviço só tem `findMany` disponível: qualquer escrita quebraria o teste.
    expect(Object.keys(prisma.paymentSchedule)).toEqual(['findMany']);
  });

  it('tira da conta a programação marcada como excluída', async () => {
    const { service } = buildService({
      spendingPower: 5000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 4000,
        },
        {
          id: 's2',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-06'),
          totalAmount: 3000,
        },
      ],
    });

    const result = await service.run({
      ...base,
      changes: [{ scheduleId: 's2', excluded: true }],
    });

    expect(result.totalOutflow).toBe(4000);
    expect(result.hasDeficit).toBe(false);
  });

  it('move o desembolso para a conta hipotética', async () => {
    const { service } = buildService({
      spendingPower: 10000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 4000,
        },
      ],
    });

    const result = await service.run({
      ...base,
      changes: [{ scheduleId: 's1', financialAccountId: 'account-2' }],
    });

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].accountId).toBe('account-2');
  });

  it('separa as contas e soma o poder de gasto de todas', async () => {
    const { service } = buildService({
      spendingPower: 6000,
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 1000,
        },
        {
          id: 's2',
          financialAccountId: 'account-2',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 2000,
        },
      ],
    });

    const result = await service.run(base);

    expect(result.accounts).toHaveLength(2);
    expect(result.totalSpendingPower).toBe(12000);
  });

  it('conta as programações sem conta ou sem data como não projetáveis', async () => {
    const { service } = buildService({
      schedules: [
        {
          id: 's1',
          financialAccountId: null,
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 1000,
        },
        {
          id: 's2',
          financialAccountId: 'account-1',
          scheduledDate: null,
          totalAmount: 2000,
        },
      ],
    });

    const result = await service.run(base);

    expect(result.scheduleCount).toBe(0);
    expect(result.unassigned).toBe(2);
  });

  it('repassa a opção de desconsiderar limites', async () => {
    const { service, balances } = buildService({
      schedules: [
        {
          id: 's1',
          financialAccountId: 'account-1',
          scheduledDate: new Date('2026-08-05'),
          totalAmount: 1000,
        },
      ],
    });

    await service.run({ ...base, considerCreditLimits: false });

    expect(balances.positionOf).toHaveBeenCalledWith(
      'account-1',
      expect.any(Date),
      expect.objectContaining({ considerCreditLimits: false }),
    );
  });
});
