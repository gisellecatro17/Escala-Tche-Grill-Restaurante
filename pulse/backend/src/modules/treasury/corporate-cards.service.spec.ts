/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { CorporateCardsService } from './corporate-cards.service';

const actor = { id: 'user-1', isPlatformAdmin: true } as any;

const CARD = {
  id: 'card-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  status: 'ACTIVE',
  lastFourDigits: '4587',
  name: 'Cartão Corporativo',
};

function buildService(overrides: Record<string, unknown> = {}) {
  const cardDelegate = {
    findFirst: jest.fn().mockResolvedValue(CARD),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest
      .fn()
      .mockImplementation(({ data }: any) => ({ id: 'card-new', ...data })),
    update: jest.fn().mockImplementation(({ where, data }: any) => ({
      id: where.id,
      ...data,
    })),
    ...(overrides.corporateCard as object),
  };

  const prisma = {
    company: {
      findFirst: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    },
    financialAccount: {
      findFirst: jest.fn().mockResolvedValue({ companyId: 'company-1' }),
    },
    corporateCardUser: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: any) => ({ id: 'link-1', ...create })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    treasurySettings: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops)
        ? Promise.all(ops)
        : (ops as (tx: unknown) => unknown)(prismaMock),
    ),
    ...overrides,
    corporateCard: cardDelegate,
  };

  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;

  return {
    service: new CorporateCardsService(prismaMock, audit),
    prisma: prismaMock,
    audit,
  };
}

const BASE_DTO = {
  organizationId: 'org-1',
  companyId: 'company-1',
  name: 'Cartão Corporativo',
  cardType: 'CREDIT' as any,
  lastFourDigits: '4587',
};

describe('CorporateCardsService', () => {
  it('monta o nome de exibição com o final do cartão', async () => {
    const { service, prisma } = buildService({
      corporateCard: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.create(BASE_DTO, actor);

    expect(prisma.corporateCard.create.mock.calls[0][0].data.displayName).toBe(
      'Cartão Corporativo — final 4587',
    );
  });

  it('recusa um cartão com o mesmo final, instituição e validade', async () => {
    const { service } = buildService({
      corporateCard: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'card-1', name: 'Cartão Corporativo' }),
      },
    });

    await expect(service.create(BASE_DTO as any, actor)).rejects.toThrow(
      /já está cadastrado/,
    );
  });

  it('recusa dia de fechamento ou vencimento fora de 1 a 31', async () => {
    const { service } = buildService({
      corporateCard: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create({ ...BASE_DTO, closingDay: 45 } as any, actor),
    ).rejects.toThrow(/fechamento deve estar entre 1 e 31/);
    await expect(
      service.create({ ...BASE_DTO, dueDay: 0 } as any, actor),
    ).rejects.toThrow(/vencimento deve estar entre 1 e 31/);
  });

  it('recusa vincular o cartão a uma conta de outra empresa', async () => {
    const { service } = buildService({
      corporateCard: { findFirst: jest.fn().mockResolvedValue(null) },
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({ companyId: 'outra-empresa' }),
      },
    });

    await expect(
      service.create(
        { ...BASE_DTO, financialAccountId: 'acc-1' } as any,
        actor,
      ),
    ).rejects.toThrow(/pertence a outra empresa/);
  });

  it('recusa vincular o cartão a empresa de outra organização', async () => {
    const { service } = buildService({
      corporateCard: { findFirst: jest.fn().mockResolvedValue(null) },
      company: {
        findFirst: jest.fn().mockResolvedValue({ organizationId: 'org-2' }),
      },
    });

    await expect(service.create(BASE_DTO as any, actor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('registra na auditoria apenas o final do cartão', async () => {
    const { service, audit } = buildService({
      corporateCard: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.create(BASE_DTO, actor);

    const logged = JSON.stringify(audit.log.mock.calls);
    expect(logged).toContain('4587');
    // Nenhum número completo poderia aparecer: o DTO nem tem esse campo.
    expect(logged).not.toMatch(/\d{16}/);
  });

  it('bloqueia registrando o motivo, sem excluir nada', async () => {
    const { service, prisma, audit } = buildService();

    await service.setStatus(
      'card-1',
      'BLOCKED',
      { reason: 'Extraviado' },
      actor,
    );

    expect(prisma.corporateCard.update.mock.calls[0][0].data.status).toBe(
      'BLOCKED',
    );
    expect(
      JSON.stringify(prisma.corporateCard.update.mock.calls),
    ).not.toContain('deletedAt');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CARD_BLOCKED', reason: 'Extraviado' }),
    );
  });

  it('recusa mudar para a situação em que o cartão já está', async () => {
    const { service } = buildService();

    await expect(
      service.setStatus('card-1', 'ACTIVE' as any, undefined, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('bloqueia a exclusão de cartão com portadores', async () => {
    const { service } = buildService({
      corporateCard: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...CARD, _count: { users: 2 } }),
      },
    });

    const usage = await service.usage('card-1');

    expect(usage.inUse).toBe(true);
    expect(usage.canDelete).toBe(false);
    await expect(service.remove('card-1', actor)).rejects.toThrow(
      /não pode ser excluído/,
    );
  });

  it('mantém um único portador principal', async () => {
    const { service, prisma } = buildService();

    await service.upsertUser(
      'card-1',
      { userId: 'user-9', isPrimary: true },
      actor,
    );

    expect(prisma.corporateCardUser.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPrimary: true }),
        data: { isPrimary: false },
      }),
    );
  });

  it('usa a janela de alerta configurada pela empresa', async () => {
    const { service } = buildService({
      treasurySettings: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ cardExpirationAlertDays: 60 }),
      },
    });

    const alerts = await service.findAlerts('org-1', 'company-1');

    expect(alerts.alertDays).toBe(60);
  });

  it('usa 30 dias quando a empresa não configurou a janela', async () => {
    const { service } = buildService();

    const alerts = await service.findAlerts('org-1', 'company-1');

    expect(alerts.alertDays).toBe(30);
  });

  it('separa os alertas por tipo', async () => {
    const { service } = buildService({
      corporateCard: {
        findFirst: jest.fn().mockResolvedValue(CARD),
        findMany: jest
          .fn()
          // vencendo, vencidos, sem responsável, conta inativa
          .mockResolvedValueOnce([
            { id: 'a', name: 'A', lastFourDigits: '1111' },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: 'b', name: 'B', lastFourDigits: '2222' },
          ])
          .mockResolvedValueOnce([]),
      },
    });

    const alerts = await service.findAlerts('org-1', 'company-1');

    expect(alerts.expiringSoon).toHaveLength(1);
    expect(alerts.withoutResponsible).toHaveLength(1);
    expect(alerts.total).toBe(2);
  });
});
