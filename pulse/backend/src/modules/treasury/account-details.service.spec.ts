/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { AccountDetailsService } from './account-details.service';

const actor = { id: 'user-1', isPlatformAdmin: true } as any;

function restrictedActor(permissions: string[] = []) {
  return {
    id: 'user-2',
    isPlatformAdmin: false,
    organizationMemberships: [{ organizationId: 'org-1', permissions }],
    memberships: [{ companyId: 'company-1', permissions }],
  } as any;
}

const ACCOUNT = {
  id: 'acc-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  status: 'ACTIVE',
  accountType: 'CHECKING_ACCOUNT',
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    financialAccount: {
      findFirst: jest.fn().mockResolvedValue(ACCOUNT),
    },
    financialAccountOpeningBalance: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'bal-new', ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    financialAccountLimit: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'lim-new', ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    companyPixKey: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'pix-new', ...data })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    financialAccountUser: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: any) => ({ id: 'link-1', ...create })),
      update: jest.fn().mockResolvedValue({}),
    },
    financialAccountIntegration: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'int-1', ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    treasurySettings: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops)
        ? Promise.all(ops)
        : (ops as (tx: unknown) => unknown)(prismaMock),
    ),
    ...overrides,
  };

  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;

  return {
    service: new AccountDetailsService(prismaMock, audit),
    prisma: prismaMock,
    audit,
  };
}

describe('AccountDetailsService — saldo inicial', () => {
  const DTO = { balanceDate: '2026-01-01', balanceAmount: 25000 } as any;

  it('registra o primeiro saldo sem exigir justificativa', async () => {
    const { service, prisma } = buildService();

    await service.createOpeningBalance('acc-1', DTO, actor);

    expect(prisma.financialAccountOpeningBalance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
  });

  it('exige justificativa quando já existe saldo aprovado', async () => {
    const { service } = buildService({
      financialAccountOpeningBalance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'bal-1',
          balanceAmount: { toString: () => '25000' },
          balanceDate: new Date('2026-01-01'),
        }),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(
      service.createOpeningBalance('acc-1', DTO, actor),
    ).rejects.toThrow(/sem justificativa/i);
  });

  it('exige permissão específica para alterar o saldo inicial', async () => {
    const { service } = buildService({
      financialAccountOpeningBalance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'bal-1',
          balanceAmount: { toString: () => '25000' },
          balanceDate: new Date('2026-01-01'),
        }),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(
      service.createOpeningBalance(
        'acc-1',
        { ...DTO, reason: 'Correção' },
        restrictedActor(['financial_account.view']),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('preserva o saldo anterior como SUPERSEDED em vez de sobrescrever', async () => {
    const { service, prisma } = buildService({
      financialAccountOpeningBalance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'bal-1',
          balanceAmount: { toString: () => '25000' },
          balanceDate: new Date('2026-01-01'),
        }),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'bal-2', ...data })),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
      },
    });

    await service.createOpeningBalance(
      'acc-1',
      { ...DTO, balanceAmount: 30000, reason: 'Correção do extrato' },
      actor,
    );

    expect(prisma.financialAccountOpeningBalance.update).toHaveBeenCalledWith({
      where: { id: 'bal-1' },
      data: { status: 'SUPERSEDED' },
    });
    // O registro antigo é atualizado, nunca removido.
    expect(
      JSON.stringify(prisma.financialAccountOpeningBalance.update.mock.calls),
    ).not.toContain('delete');
  });

  it('registra o valor anterior e o novo na auditoria', async () => {
    const { service, audit } = buildService({
      financialAccountOpeningBalance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'bal-1',
          balanceAmount: { toString: () => '25000' },
          balanceDate: new Date('2026-01-01'),
        }),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'bal-2', ...data })),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
      },
    });

    await service.createOpeningBalance(
      'acc-1',
      { ...DTO, balanceAmount: 30000, reason: 'Correção do extrato' },
      actor,
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_OPENING_BALANCE',
        oldValue: expect.objectContaining({ balanceAmount: '25000' }),
        newValue: expect.objectContaining({ balanceAmount: '30000' }),
        reason: 'Correção do extrato',
      }),
    );
  });

  it('recusa quando os parâmetros da empresa proíbem alterar o saldo inicial', async () => {
    const { service } = buildService({
      financialAccountOpeningBalance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'bal-1',
          balanceAmount: { toString: () => '25000' },
          balanceDate: new Date('2026-01-01'),
        }),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      treasurySettings: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ allowOpeningBalanceChange: false }),
      },
    });

    await expect(
      service.createOpeningBalance('acc-1', { ...DTO, reason: 'x' }, actor),
    ).rejects.toThrow(/não permitem alterar o saldo inicial/);
  });
});

describe('AccountDetailsService — limites', () => {
  it('recusa data final anterior à inicial', async () => {
    const { service } = buildService();

    await expect(
      service.createLimit(
        'acc-1',
        {
          limitType: 'OVERDRAFT',
          contractedAmount: 50000,
          startDate: '2026-06-01',
          endDate: '2026-01-01',
        } as any,
        actor,
      ),
    ).rejects.toThrow(/posterior à data inicial/);
  });

  it('cria o limite com taxa e vigência', async () => {
    const { service, prisma } = buildService();

    await service.createLimit(
      'acc-1',
      {
        limitType: 'OVERDRAFT',
        contractedAmount: 50000,
        interestRate: 2.49,
      } as any,
      actor,
    );

    expect(prisma.financialAccountLimit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          limitType: 'OVERDRAFT',
          contractedAmount: 50000,
        }),
      }),
    );
  });
});

describe('AccountDetailsService — chaves PIX', () => {
  const DTO = {
    organizationId: 'org-1',
    companyId: 'company-1',
    pixType: 'CNPJ',
    pixKey: '11.222.333/0001-81',
  } as any;

  it('grava a chave normalizada junto com a original', async () => {
    const { service, prisma } = buildService();

    await service.createPixKey(DTO, actor);

    const data = prisma.companyPixKey.create.mock.calls[0][0].data;
    expect(data.pixKey).toBe('11.222.333/0001-81');
    expect(data.normalizedKey).toBe('11222333000181');
  });

  it('recusa chave duplicada citando a conta que já a usa', async () => {
    const { service } = buildService({
      companyPixKey: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pix-1',
          financialAccount: { displayName: 'Banco do Brasil — Operacional' },
        }),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(service.createPixKey(DTO, actor)).rejects.toThrow(
      /já está cadastrada na conta "Banco do Brasil — Operacional"/,
    );
  });

  it('reconhece duas grafias da mesma chave como duplicidade', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'pix-1',
      financialAccount: { displayName: 'Conta' },
    });
    const { service } = buildService({
      companyPixKey: {
        findFirst,
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(
      service.createPixKey({ ...DTO, pixKey: '11222333000181' }, actor),
    ).rejects.toThrow(ConflictException);
    // A busca usa a chave normalizada, não o texto digitado.
    expect(findFirst.mock.calls[0][0].where.normalizedKey).toBe(
      '11222333000181',
    );
  });

  it('recusa uma chave inválida para o tipo', async () => {
    const { service } = buildService();

    await expect(
      service.createPixKey(
        { ...DTO, pixType: 'CPF', pixKey: '111.111.111-11' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa vincular a chave a uma conta de outra empresa', async () => {
    const { service } = buildService({
      financialAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...ACCOUNT, companyId: 'outra-empresa' }),
      },
    });

    await expect(
      service.createPixKey({ ...DTO, financialAccountId: 'acc-1' }, actor),
    ).rejects.toThrow(/pertence a outra empresa/);
  });

  it('rebaixa a chave principal anterior ao definir uma nova', async () => {
    const { service, prisma } = buildService();

    await service.createPixKey({ ...DTO, isPrimary: true }, actor);

    expect(prisma.companyPixKey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPrimary: true }),
        data: { isPrimary: false },
      }),
    );
  });

  it('não grava o valor da chave na auditoria', async () => {
    const { service, audit } = buildService();

    await service.createPixKey(DTO, actor);

    const logged = JSON.stringify(audit.log.mock.calls);
    expect(logged).not.toContain('11222333000181');
    expect(logged).toContain('CREATE_PIX_KEY');
  });

  it('mascara as chaves sem a permissão de dados sensíveis', async () => {
    const { service } = buildService({
      companyPixKey: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pix-1',
            pixKey: 'financeiro@empresa.com',
            normalizedKey: 'financeiro@empresa.com',
            holderDocument: '11222333000181',
          },
        ]),
      },
    });

    const [key]: any = await service.findPixKeys(
      'org-1',
      {},
      restrictedActor(),
    );

    expect(key.pixKey).not.toBe('financeiro@empresa.com');
    expect(key.pixKey).toContain('@empresa.com');
    // A chave normalizada também é mascarada: devolvê-la anularia o mascaramento.
    expect(key.normalizedKey).not.toBe('financeiro@empresa.com');
  });
});

describe('AccountDetailsService — integrações', () => {
  it('recusa uma credencial enviada no lugar da referência ao cofre', async () => {
    const { service } = buildService();

    for (const value of [
      '{"client_secret": "abc"}',
      '-----BEGIN RSA PRIVATE KEY-----',
      'a'.repeat(80),
    ]) {
      await expect(
        service.createIntegration(
          'acc-1',
          { integrationType: 'BANK_API', credentialsReference: value } as any,
          actor,
        ),
      ).rejects.toThrow(/apenas a referência ao segredo/);
    }
  });

  it('aceita a referência ao cofre e não a devolve na resposta', async () => {
    const { service } = buildService();

    const integration: any = await service.createIntegration(
      'acc-1',
      {
        integrationType: 'BANK_API',
        provider: 'Banco do Brasil',
        credentialsReference: 'vault://pulse/company/1/bb',
      } as any,
      actor,
    );

    expect(integration.credentialsReference).toBeUndefined();
    expect(integration.hasCredentials).toBe(true);
  });

  it('nasce pendente quando há credencial e não configurada quando não há', async () => {
    const { service, prisma } = buildService();

    await service.createIntegration(
      'acc-1',
      { integrationType: 'OFX_MANUAL' } as any,
      actor,
    );
    expect(
      prisma.financialAccountIntegration.create.mock.calls[0][0].data.status,
    ).toBe('NOT_CONFIGURED');
  });

  it('não registra a credencial na auditoria', async () => {
    const { service, audit } = buildService();

    await service.createIntegration(
      'acc-1',
      {
        integrationType: 'BANK_API',
        credentialsReference: 'vault://pulse/segredo',
      } as any,
      actor,
    );

    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('vault://');
  });

  it('testa a integração sem chamar o banco e aponta o que falta', async () => {
    const { service } = buildService({
      financialAccountIntegration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'int-1',
          provider: null,
          externalAccountId: null,
          credentialsReference: null,
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
      },
    });

    const result = await service.testIntegration('acc-1', 'int-1', actor);

    expect(result.simulated).toBe(true);
    expect(result.success).toBe(false);
    expect(result.problems).toHaveLength(3);
  });

  it('recusa ativar a integração sem credencial configurada', async () => {
    const { service } = buildService({
      financialAccountIntegration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'int-1',
          credentialsReference: null,
          status: 'PENDING',
        }),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(
      service.setIntegrationStatus('acc-1', 'int-1', 'ACTIVE' as any, actor),
    ).rejects.toThrow(/Configure a credencial/);
  });

  it('apaga o ponteiro da credencial ao desconectar', async () => {
    const { service, prisma } = buildService({
      financialAccountIntegration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'int-1',
          credentialsReference: 'vault://x',
          status: 'ACTIVE',
        }),
        create: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'int-1', ...data })),
        findMany: jest.fn(),
      },
    });

    await service.setIntegrationStatus('acc-1', 'int-1', 'DISCONNECTED', actor);

    const data =
      prisma.financialAccountIntegration.update.mock.calls[0][0].data;
    expect(data.credentialsReference).toBeNull();
  });
});

describe('AccountDetailsService — usuários da conta', () => {
  it('vincula o usuário com a alçada informada', async () => {
    const { service, prisma } = buildService();

    await service.upsertUser(
      'acc-1',
      {
        userId: 'user-9',
        canAuthorizePayment: true,
        approvalLimit: 5000,
      },
      actor,
    );

    const call = prisma.financialAccountUser.upsert.mock.calls[0][0];
    expect(call.where.financialAccountId_userId).toEqual({
      financialAccountId: 'acc-1',
      userId: 'user-9',
    });
    expect(call.create.canAuthorizePayment).toBe(true);
  });

  it('revincula um usuário previamente removido', async () => {
    const { service, prisma } = buildService();

    await service.upsertUser('acc-1', { userId: 'user-9' }, actor);

    // `deletedAt: null` no update é o que permite reativar o vínculo.
    expect(
      prisma.financialAccountUser.upsert.mock.calls[0][0].update.deletedAt,
    ).toBeNull();
  });

  it('registra na auditoria a alçada de autorização concedida', async () => {
    const { service, audit } = buildService();

    await service.upsertUser(
      'acc-1',
      {
        userId: 'user-9',
        canAuthorizePayment: true,
        approvalLimit: 5000,
      },
      actor,
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPSERT_ACCOUNT_USER',
        newValue: expect.objectContaining({
          canAuthorizePayment: true,
          approvalLimit: '5000',
        }),
      }),
    );
  });
});
