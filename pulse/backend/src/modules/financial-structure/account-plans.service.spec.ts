/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AccountPlansService } from './account-plans.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

function duplicateCodeError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['organization_id', 'company_id', 'code'] },
  });
}

const EXISTING_ACCOUNT = {
  id: 'acc-1',
  organizationId: 'org-1',
  companyId: null,
  parentAccountId: null,
  code: '1',
  name: 'Ativo',
  accountKind: 'SYNTHETIC',
  acceptsEntries: false,
  sortOrder: 0,
  isSystem: false,
  children: [],
};

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    financialAccountPlan: {
      findFirst: jest.fn().mockResolvedValue(EXISTING_ACCOUNT),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => ({
        id: 'acc-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(({ data }: any) => ({
        ...EXISTING_ACCOUNT,
        ...data,
      })),
    },
    financialCategory: { count: jest.fn().mockResolvedValue(0) },
    classificationRule: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prismaMock),
    ),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;
  const versions = { snapshot: jest.fn() } as any;

  return {
    service: new AccountPlansService(prismaMock, audit, versions),
    prisma: prismaMock,
    versions,
  };
}

describe('AccountPlansService', () => {
  it('força contas sintéticas a não aceitarem lançamentos', async () => {
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'acc-new', ...data })),
        update: jest.fn(),
      },
    });

    await service.create(
      {
        organizationId: 'org-1',
        code: '3',
        name: 'Receitas',
        accountKind: 'SYNTHETIC',
        // Mesmo pedindo `true`, uma conta sintética nunca aceita lançamentos.
        acceptsEntries: true,
      },
      actor,
    );

    expect(prisma.financialAccountPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acceptsEntries: false }),
      }),
    );
  });

  it('converte o pai em sintético ao ganhar uma conta filha', async () => {
    const parent = {
      ...EXISTING_ACCOUNT,
      accountKind: 'ANALYTICAL',
      acceptsEntries: true,
    };
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(parent),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'acc-new', ...data })),
        update: jest.fn(),
      },
    });

    await service.create(
      {
        organizationId: 'org-1',
        parentAccountId: 'acc-1',
        code: '1.1',
        name: 'Ativo Circulante',
      },
      actor,
    );

    expect(prisma.financialAccountPlan.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { accountKind: 'SYNTHETIC', acceptsEntries: false },
    });
  });

  it('traduz código duplicado em mensagem de conflito', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockRejectedValue(duplicateCodeError()),
        update: jest.fn(),
      },
    });

    await expect(
      service.create(
        { organizationId: 'org-1', code: '1', name: 'Ativo' } as any,
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa uma conta pai inexistente', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          parentAccountId: 'inexistente',
          code: '9',
          name: 'X',
        } as any,
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('versiona a árvore antes de mover uma conta', async () => {
    const { service, versions } = buildService();

    await service.move('acc-1', { parentId: null }, actor);

    expect(versions.snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ACCOUNT_PLAN' }),
    );
  });

  it('impede mover uma conta para dentro de uma conta filha', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(EXISTING_ACCOUNT),
        findMany: jest.fn().mockResolvedValue([
          { id: 'acc-1', parentAccountId: null },
          { id: 'acc-2', parentAccountId: 'acc-1' },
        ]),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.move('acc-1', { parentId: 'acc-2' }, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('bloqueia a exclusão de uma conta com contas filhas', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue({
          ...EXISTING_ACCOUNT,
          children: [{ id: 'acc-2' }],
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(service.remove('acc-1', actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('bloqueia a exclusão de uma conta usada por categorias', async () => {
    const { service } = buildService({
      financialCategory: { count: jest.fn().mockResolvedValue(2) },
    });

    await expect(service.remove('acc-1', actor)).rejects.toThrow(
      /Utilize a opção Inativar/i,
    );
  });

  it('bloqueia a exclusão de uma conta padrão do sistema', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...EXISTING_ACCOUNT, isSystem: true }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(service.remove('acc-1', actor)).rejects.toThrow(
      /padrão do sistema/i,
    );
  });

  it('gera automaticamente o próximo código a partir da conta superior', async () => {
    const parent = { ...EXISTING_ACCOUNT, code: '5.02', level: 1 };
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(parent),
        // Irmãos já existentes sob 5.02.
        findMany: jest
          .fn()
          .mockResolvedValue([{ code: '5.02.001' }, { code: '5.02.002' }]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'acc-new', ...data })),
        update: jest.fn(),
      },
    });

    await service.create(
      {
        organizationId: 'org-1',
        parentAccountId: 'acc-1',
        name: 'Energia elétrica',
        autoGenerateCode: true,
      },
      actor,
    );

    expect(prisma.financialAccountPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: '5.02.003' }),
      }),
    );
  });

  it('recusa um código incoerente com a conta superior', async () => {
    const parent = { ...EXISTING_ACCOUNT, code: '5.02' };
    const { service } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(parent),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          parentAccountId: 'acc-1',
          code: '9.99.001',
          name: 'Fora da árvore',
        },
        actor,
      ),
    ).rejects.toThrow(/não é coerente com a conta superior/i);
  });

  it('grava o código normalizado para garantir unicidade real', async () => {
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'acc-new', ...data })),
        update: jest.fn(),
      },
    });

    await service.create(
      { organizationId: 'org-1', code: '05.02.001', name: 'Conta' },
      actor,
    );

    expect(prisma.financialAccountPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: '05.02.001',
          normalizedCode: '5.2.1',
        }),
      }),
    );
  });

  it('recusa lançamento em conta sintética', () => {
    const { service } = buildService();

    expect(() =>
      service.assertAcceptsEntries({ acceptsEntries: false } as any),
    ).toThrow(BadRequestException);
  });
});
