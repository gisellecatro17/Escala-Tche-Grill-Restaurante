/* eslint-disable @typescript-eslint/no-unsafe-assignment -- mocks do jest sao any por natureza */
import { FinancialAccountStatus } from '@prisma/client';

import { AccountBalanceService } from './account-balance.service';

function buildService(
  options: {
    account?: Record<string, unknown>;
    openingBalance?: number | null;
    limits?: number[];
    committed?: number;
  } = {},
) {
  const account = {
    id: 'account-1',
    name: 'Banco do Brasil — Operacional',
    displayName: null,
    status: FinancialAccountStatus.ACTIVE,
    blockedBalance: 0,
    minimumRecommendedBalance: null,
    allowsNegativeBalance: false,
    ...options.account,
  };

  const prisma = {
    financialAccount: {
      findFirstOrThrow: jest.fn().mockResolvedValue(account),
      findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]),
    },
    financialAccountOpeningBalance: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.openingBalance === null
            ? null
            : { balanceAmount: options.openingBalance ?? 50000 },
        ),
    },
    financialAccountLimit: {
      findMany: jest.fn().mockResolvedValue(
        (options.limits ?? []).map((contractedAmount) => ({
          contractedAmount,
        })),
      ),
    },
    paymentSchedule: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { totalAmount: options.committed ?? 0 } }),
    },
  };

  return {
    service: new AccountBalanceService(prisma as never),
    prisma,
    account,
  };
}

describe('AccountBalanceService', () => {
  const date = new Date('2026-08-10');

  it('calcula o disponível a partir do saldo de abertura menos o bloqueado', async () => {
    const { service } = buildService({
      openingBalance: 50000,
      account: { blockedBalance: 5000 },
    });

    const position = await service.positionOf('account-1', date);

    expect(position.openingBalance).toBe(50000);
    expect(position.blockedBalance).toBe(5000);
    expect(position.availableBalance).toBe(45000);
  });

  it('soma os limites contratados ao poder de gasto', async () => {
    const { service } = buildService({
      openingBalance: 10000,
      limits: [20000, 5000],
    });

    const position = await service.positionOf('account-1', date);

    expect(position.creditLimit).toBe(25000);
    expect(position.spendingPower).toBe(35000);
  });

  it('ignora os limites quando a empresa manda desconsiderá-los', async () => {
    const { service } = buildService({
      openingBalance: 10000,
      limits: [20000],
    });

    const position = await service.positionOf('account-1', date, {
      considerCreditLimits: false,
    });

    expect(position.spendingPower).toBe(10000);
  });

  it('desconta o que já está programado', async () => {
    const { service } = buildService({
      openingBalance: 10000,
      committed: 4000,
    });

    const position = await service.positionOf('account-1', date);

    expect(position.committedAmount).toBe(4000);
    expect(position.projectedBalance).toBe(6000);
  });

  it('não conta programação bloqueada como comprometida', async () => {
    // O filtro está na consulta: dinheiro travado não vai sair, e contá-lo faria o sistema
    // recusar programações por causa de um gasto que não vai acontecer.
    const { service, prisma } = buildService();

    await service.positionOf('account-1', date);

    expect(prisma.paymentSchedule.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ blockedAt: null }),
      }),
    );
  });

  it('trata conta sem saldo de abertura como zero', async () => {
    const { service } = buildService({ openingBalance: null });

    const position = await service.positionOf('account-1', date);

    expect(position.openingBalance).toBe(0);
    expect(position.availableBalance).toBe(0);
  });

  describe('check', () => {
    it('aponta insuficiência com o valor exato que falta', async () => {
      const { service } = buildService({ openingBalance: 1000 });

      const result = await service.check({
        accountId: 'account-1',
        referenceDate: date,
        amount: 1500,
      });

      expect(result.insufficient).toBe(true);
      expect(result.shortfall).toBe(500);
      expect(result.projectedAfter).toBe(-500);
    });

    it('aprova quando o dinheiro cobre', async () => {
      const { service } = buildService({ openingBalance: 5000 });

      const result = await service.check({
        accountId: 'account-1',
        referenceDate: date,
        amount: 1500,
      });

      expect(result.insufficient).toBe(false);
      expect(result.shortfall).toBe(0);
      expect(result.projectedAfter).toBe(3500);
    });

    it('avisa quando o saldo fica abaixo do mínimo recomendado sem faltar dinheiro', async () => {
      const { service } = buildService({
        openingBalance: 5000,
        account: { minimumRecommendedBalance: 2000 },
      });

      const result = await service.check({
        accountId: 'account-1',
        referenceDate: date,
        amount: 4000,
      });

      expect(result.insufficient).toBe(false);
      expect(result.belowRecommended).toBe(true);
    });

    it('ignora a própria programação ao recalcular a posição dela', async () => {
      // Sem isso, editar uma programação já contada faria o sistema somar o mesmo valor
      // duas vezes e acusar déficit inexistente.
      const { service, prisma } = buildService();

      await service.check({
        accountId: 'account-1',
        referenceDate: date,
        amount: 100,
        ignoreScheduleId: 'schedule-1',
      });

      expect(prisma.paymentSchedule.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ NOT: { id: 'schedule-1' } }),
        }),
      );
    });
  });

  describe('disponibilidade da conta', () => {
    it.each([
      [FinancialAccountStatus.BLOCKED, 'bloqueada'],
      [FinancialAccountStatus.SUSPENDED, 'suspensa'],
      [FinancialAccountStatus.INACTIVE, 'inativa'],
      [FinancialAccountStatus.CLOSED, 'encerrada'],
      [FinancialAccountStatus.DRAFT, 'ativada'],
    ])('marca a conta %s como indisponível', async (status, fragment) => {
      const { service } = buildService({ account: { status } });

      const position = await service.positionOf('account-1', date);

      expect(position.unavailable).toBe(true);
      expect(position.unavailableReason).toContain(fragment);
    });

    it('conta ativa fica disponível', async () => {
      const { service } = buildService();

      const position = await service.positionOf('account-1', date);

      expect(position.unavailable).toBe(false);
      expect(position.unavailableReason).toBeNull();
    });
  });
});
