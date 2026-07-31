/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { FinancialAccountsService } from './financial-accounts.service';

/** Ator com todas as permissões. */
const actor = { id: 'user-1', isPlatformAdmin: true } as any;

/** Ator sem nenhuma permissão especial, para provar o mascaramento. */
function restrictedActor(permissions: string[] = []) {
  return {
    id: 'user-2',
    isPlatformAdmin: false,
    organizationMemberships: [{ organizationId: 'org-1', permissions }],
    memberships: [{ companyId: 'company-1', permissions }],
  } as any;
}

const COMPANY = {
  id: 'company-1',
  organizationId: 'org-1',
  normalizedDocumentNumber: '11222333000181',
};

const ACCOUNT = {
  id: 'acc-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  name: 'Conta Operacional',
  displayName: 'Banco do Brasil — Conta Operacional',
  accountType: 'CHECKING_ACCOUNT',
  status: 'ACTIVE',
  branchNumber: '1234',
  accountNumber: '12345',
  holderDocument: '11222333000181',
  currencyCode: 'BRL',
  financialInstitutionId: 'inst-1',
  accountPlanId: 'plan-1',
  responsibleUserId: 'user-9',
  company: { normalizedDocumentNumber: '11222333000181' },
  _count: { users: 1 },
};

function buildService(overrides: Record<string, unknown> = {}) {
  const accountDelegate = {
    findFirst: jest.fn().mockResolvedValue(ACCOUNT),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest
      .fn()
      .mockImplementation(({ data }: any) => ({ id: 'acc-new', ...data })),
    update: jest.fn().mockImplementation(({ where, data }: any) => ({
      id: where.id,
      ...data,
    })),
    ...(overrides.financialAccount as object),
  };

  const prisma = {
    company: {
      findFirst: jest.fn().mockResolvedValue(COMPANY),
    },
    financialInstitution: {
      findUnique: jest.fn().mockResolvedValue({ shortName: 'Banco do Brasil' }),
    },
    treasurySettings: { findUnique: jest.fn().mockResolvedValue(null) },
    financialAccountStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops)
        ? Promise.all(ops)
        : (ops as (tx: unknown) => unknown)(prismaMock),
    ),
    ...overrides,
    financialAccount: accountDelegate,
  };

  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;

  return {
    service: new FinancialAccountsService(prismaMock, audit),
    prisma: prismaMock,
    audit,
  };
}

const BASE_DTO = {
  organizationId: 'org-1',
  companyId: 'company-1',
  name: 'Conta Operacional',
  accountType: 'CHECKING_ACCOUNT' as any,
  financialInstitutionId: 'inst-1',
  branchNumber: '1234',
  accountNumber: '12345',
  holderDocument: '11.222.333/0001-81',
};

describe('FinancialAccountsService — criação', () => {
  it('monta o nome de exibição a partir da instituição quando não informado', async () => {
    const { service, prisma } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.create(BASE_DTO, actor);

    expect(prisma.financialAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayName: 'Banco do Brasil — Conta Operacional',
        }),
      }),
    );
  });

  it('grava o identificador normalizado da conta para detectar duplicidade', async () => {
    const { service, prisma } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.create(
      { ...BASE_DTO, branchDigit: '5', accountDigit: '6' },
      actor,
    );

    expect(
      prisma.financialAccount.create.mock.calls[0][0].data
        .normalizedAccountIdentifier,
    ).toBe('inst-1:12345:123456');
  });

  it('recusa uma conta com os mesmos dados bancários na mesma empresa', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'existente', displayName: 'Conta antiga' }),
      },
    });

    await expect(service.create(BASE_DTO as any, actor)).rejects.toThrow(
      /Já existe uma conta com estes dados bancários/,
    );
  });

  it('recusa vincular a conta a uma empresa de outra organização', async () => {
    const { service } = buildService({
      company: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...COMPANY, organizationId: 'org-2' }),
      },
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.create(BASE_DTO as any, actor)).rejects.toThrow(
      /não pertence a esta organização/,
    );
  });

  it('exige instituição, agência e conta para contas bancárias', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          companyId: 'company-1',
          name: 'Sem dados',
          accountType: 'CHECKING_ACCOUNT',
        } as any,
        actor,
      ),
    ).rejects.toThrow(/instituição financeira/);
  });

  it('aceita caixa sem instituição, agência ou conta', async () => {
    const { service, prisma } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.create(
      {
        organizationId: 'org-1',
        companyId: 'company-1',
        name: 'Caixa do Restaurante',
        accountType: 'CASH',
        physicalLocation: 'Salão',
      } as any,
      actor,
    );

    expect(prisma.financialAccount.create).toHaveBeenCalled();
  });

  it('salva rascunho sem exigir os dados bancários completos', async () => {
    const { service, prisma } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.createDraft(
      {
        organizationId: 'org-1',
        companyId: 'company-1',
        name: 'Rascunho',
        accountType: 'CHECKING_ACCOUNT',
      } as any,
      actor,
    );

    expect(prisma.financialAccount.create.mock.calls[0][0].data.status).toBe(
      'DRAFT',
    );
  });
});

describe('FinancialAccountsService — conta de terceiro', () => {
  const THIRD_PARTY = {
    ...BASE_DTO,
    holderDocument: '99.888.777/0001-66',
  };

  it('recusa titular divergente sem confirmação explícita', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.create(THIRD_PARTY as any, actor)).rejects.toThrow(
      /diferente da empresa selecionada/,
    );
  });

  it('exige justificativa ao confirmar conta de terceiro', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create({ ...THIRD_PARTY, isThirdParty: true } as any, actor),
    ).rejects.toThrow(/motivo/i);
  });

  it('exige permissão específica para conta de terceiro', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create(
        {
          ...THIRD_PARTY,
          isThirdParty: true,
          thirdPartyReason: 'Conta do sócio',
        } as any,
        restrictedActor(['financial_account.create']),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('impede que conta de terceiro seja a conta principal', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create(
        {
          ...THIRD_PARTY,
          isThirdParty: true,
          thirdPartyReason: 'Conta do sócio',
          isPrimary: true,
        } as any,
        actor,
      ),
    ).rejects.toThrow(/conta principal/);
  });

  it('recusa quando os parâmetros da empresa proíbem contas de terceiro', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      treasurySettings: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ allowThirdPartyAccounts: false }),
      },
    });

    await expect(
      service.create(
        {
          ...THIRD_PARTY,
          isThirdParty: true,
          thirdPartyReason: 'Conta do sócio',
        } as any,
        actor,
      ),
    ).rejects.toThrow(/não permitem contas de terceiro/);
  });

  it('registra quem aprovou a conta de terceiro e quando', async () => {
    const { service, prisma } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await service.create(
      {
        ...THIRD_PARTY,
        isThirdParty: true,
        thirdPartyReason: 'Conta do sócio',
      },
      actor,
    );

    const data = prisma.financialAccount.create.mock.calls[0][0].data;
    expect(data.thirdPartyApprovedBy).toBe('user-1');
    expect(data.thirdPartyApprovedAt).toBeInstanceOf(Date);
  });
});

describe('FinancialAccountsService — mascaramento', () => {
  it('mascara agência, conta e documento sem a permissão de dados bancários', async () => {
    const { service } = buildService();

    const account: any = await service.findOne('acc-1', restrictedActor());

    expect(account.branchNumber).not.toBe('1234');
    expect(account.accountNumber).not.toBe('12345');
    expect(account.holderDocument).not.toBe('11222333000181');
    // O último dígito permanece visível, para conferência.
    expect(String(account.accountNumber).endsWith('5')).toBe(true);
  });

  it('devolve os dados completos com a permissão', async () => {
    const { service } = buildService();

    const account: any = await service.findOne(
      'acc-1',
      restrictedActor(['financial_account.view_bank_data']),
    );

    expect(account.branchNumber).toBe('1234');
    expect(account.accountNumber).toBe('12345');
  });

  it('oculta os saldos sem a permissão de visualizar saldo', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...ACCOUNT, minimumRecommendedBalance: 5000 }),
      },
    });

    const account: any = await service.findOne('acc-1', restrictedActor());

    expect(account.minimumRecommendedBalance).not.toBe(5000);
    expect(String(account.minimumRecommendedBalance)).toContain('•');
  });
});

describe('FinancialAccountsService — ciclo de vida', () => {
  it('lista as pendências que impedem a ativação', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({
          ...ACCOUNT,
          accountPlanId: null,
          responsibleUserId: null,
          holderDocument: null,
          _count: { users: 0 },
        }),
      },
    });

    const pendencies = await service.findActivationPendencies('acc-1');

    expect(pendencies).toEqual(
      expect.arrayContaining([
        'Confirme a titularidade da conta.',
        'Informe o responsável pela conta.',
        'Defina a conta do plano de contas.',
      ]),
    );
  });

  it('recusa ativar enquanto houver pendências', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({
          ...ACCOUNT,
          status: 'DRAFT',
          accountPlanId: null,
          responsibleUserId: null,
          _count: { users: 0 },
        }),
      },
    });

    await expect(service.activate('acc-1', actor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('bloqueia registrando o motivo e mantendo o histórico', async () => {
    const { service, prisma, audit } = buildService();

    await service.block('acc-1', { reason: 'Suspeita de fraude' }, actor);

    expect(prisma.financialAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'BLOCKED' }),
      }),
    );
    expect(prisma.financialAccountStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousStatus: 'ACTIVE',
          newStatus: 'BLOCKED',
          reason: 'Suspeita de fraude',
        }),
      }),
    );
    // Nada é apagado ao bloquear.
    expect(
      JSON.stringify(prisma.financialAccount.update.mock.calls),
    ).not.toContain('deletedAt');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'STATUS_BLOCKED' }),
    );
  });

  it('recusa desbloquear uma conta que não está bloqueada', async () => {
    const { service } = buildService();

    await expect(
      service.unblock('acc-1', { reason: 'x' }, actor),
    ).rejects.toThrow(/não está bloqueada/);
  });

  it('encerra exigindo data, saldo final e motivo', async () => {
    const { service, prisma } = buildService();

    await service.close(
      'acc-1',
      {
        reason: 'Conta encerrada no banco',
        closingDate: '2026-12-31',
        closingBalance: 0,
      },
      actor,
    );

    const data = prisma.financialAccount.update.mock.calls[0][0].data;
    expect(data.status).toBe('CLOSED');
    expect(data.closingDate).toBeInstanceOf(Date);
    expect(data.closingReason).toBe('Conta encerrada no banco');
  });

  it('não reativa uma conta encerrada', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...ACCOUNT, status: 'CLOSED' }),
      },
    });

    await expect(service.activate('acc-1', actor)).rejects.toThrow(
      /encerrada não pode passar/,
    );
  });

  it('não edita uma conta encerrada', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...ACCOUNT, status: 'CLOSED' }),
      },
    });

    await expect(
      service.update('acc-1', { name: 'Nova' } as any, actor),
    ).rejects.toThrow(/encerrada não pode ser editada/);
  });

  it('exige permissão de dados bancários para alterar agência ou conta', async () => {
    const { service } = buildService();

    await expect(
      service.update(
        'acc-1',
        { accountNumber: '99999' } as any,
        restrictedActor(['financial_account.update']),
      ),
    ).rejects.toThrow(/alterar dados bancários/);
  });
});

describe('FinancialAccountsService — uso e exclusão', () => {
  const withCounts = (counts: Record<string, number>) => ({
    financialAccount: {
      findFirst: jest.fn().mockResolvedValue({
        ...ACCOUNT,
        _count: {
          openingBalances: 0,
          limits: 0,
          pixKeys: 0,
          users: 0,
          integrations: 0,
          cards: 0,
          receiptMethods: 0,
          ...counts,
        },
      }),
    },
  });

  it('bloqueia a exclusão de conta com vínculos', async () => {
    const { service } = buildService(withCounts({ pixKeys: 2 }));

    const usage = await service.usage('acc-1');

    expect(usage.inUse).toBe(true);
    expect(usage.canDelete).toBe(false);
  });

  it('só permite excluir rascunho sem nenhum vínculo', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest.fn().mockResolvedValue({
          ...ACCOUNT,
          status: 'DRAFT',
          _count: {
            openingBalances: 0,
            limits: 0,
            pixKeys: 0,
            users: 0,
            integrations: 0,
            cards: 0,
            receiptMethods: 0,
          },
        }),
      },
    });

    const usage = await service.usage('acc-1');
    expect(usage.canDelete).toBe(true);
  });

  it('recusa excluir uma conta ativa', async () => {
    const { service } = buildService(withCounts({}));

    await expect(service.remove('acc-1', actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('devolve 404 para uma conta inexistente', async () => {
    const { service } = buildService({
      financialAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.scopeOf('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});
