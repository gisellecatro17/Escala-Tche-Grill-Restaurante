/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import { ConflictException } from '@nestjs/common';

import { AccountPlanVersionsService } from './account-plan-versions.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

const DRAFT_VERSION = {
  id: 'ver-2',
  organizationId: 'org-1',
  companyId: null,
  name: 'Plano 2027',
  planType: 'MANAGEMENT',
  versionNumber: 2,
  status: 'DRAFT',
  previousVersionId: null,
  description: null,
  _count: { accounts: 0 },
};

const ACTIVE_VERSION = {
  ...DRAFT_VERSION,
  id: 'ver-1',
  name: 'Plano 2026',
  versionNumber: 1,
  status: 'ACTIVE',
};

function buildService(overrides: Record<string, unknown> = {}) {
  const versionDelegate = {
    findFirst: jest.fn().mockResolvedValue(DRAFT_VERSION),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest
      .fn()
      .mockImplementation(({ data }: any) => ({ id: 'ver-new', ...data })),
    update: jest.fn().mockImplementation(({ where, data }: any) => ({
      id: where.id,
      ...data,
    })),
    ...(overrides.financialAccountPlanVersion as object),
  };

  const prisma = {
    financialAccountPlan: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => ({
        id: `acc-${data.code}`,
        ...data,
      })),
    },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prismaMock),
    ),
    ...overrides,
    // Sempre depois dos overrides: o delegate acima já os incorporou.
    financialAccountPlanVersion: versionDelegate,
  };
  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;

  return {
    service: new AccountPlanVersionsService(prismaMock, audit),
    prisma: prismaMock,
  };
}

describe('AccountPlanVersionsService', () => {
  it('numera a nova versão a partir da última do mesmo escopo', async () => {
    const { service, prisma } = buildService({
      financialAccountPlanVersion: {
        // A busca da última versão do escopo devolve a nº 4.
        findFirst: jest.fn().mockResolvedValue({ versionNumber: 4 }),
      },
    });

    const created = await service.create(
      { organizationId: 'org-1', name: 'Plano novo' },
      actor,
    );

    expect(created.versionNumber).toBe(5);
    expect(prisma.financialAccountPlanVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });

  it('mantém apenas uma versão ativa: a anterior passa a substituída', async () => {
    const findFirst = jest
      .fn()
      // 1ª chamada: findOne da versão que será ativada.
      .mockResolvedValueOnce(DRAFT_VERSION)
      // 2ª chamada: a versão ativa atual do mesmo escopo.
      .mockResolvedValueOnce(ACTIVE_VERSION);

    const { service, prisma } = buildService({
      financialAccountPlanVersion: { findFirst },
    });

    await service.activate('ver-2', { reason: 'virada de exercício' }, actor);

    expect(prisma.financialAccountPlanVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ver-1' },
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );
    expect(prisma.financialAccountPlanVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ver-2' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('recusa ativar uma versão que já está ativa', async () => {
    const { service } = buildService({
      financialAccountPlanVersion: {
        findFirst: jest.fn().mockResolvedValue(ACTIVE_VERSION),
      },
    });

    await expect(
      service.activate('ver-1', { reason: 'x' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa ativar uma versão arquivada', async () => {
    const { service } = buildService({
      financialAccountPlanVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...DRAFT_VERSION, status: 'ARCHIVED' }),
      },
    });

    await expect(
      service.activate('ver-2', { reason: 'x' }, actor),
    ).rejects.toThrow(/Duplique-a/i);
  });

  it('recusa editar uma versão ativa: ela é o registro histórico', async () => {
    const { service } = buildService({
      financialAccountPlanVersion: {
        findFirst: jest.fn().mockResolvedValue(ACTIVE_VERSION),
      },
    });

    await expect(
      service.update('ver-1', { name: 'tentativa' }, actor),
    ).rejects.toThrow(/rascunho ou em revisão/i);
  });

  it('recusa arquivar a versão ativa', async () => {
    const { service } = buildService({
      financialAccountPlanVersion: {
        findFirst: jest.fn().mockResolvedValue(ACTIVE_VERSION),
      },
    });

    await expect(service.archive('ver-1', actor)).rejects.toThrow(
      /Ative outra versão primeiro/i,
    );
  });

  it('remapeia os pais ao duplicar as contas de uma versão', async () => {
    const { service, prisma } = buildService({
      financialAccountPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'acc-pai',
            organizationId: 'org-1',
            companyId: null,
            parentAccountId: null,
            code: '5',
            name: 'Despesas',
            level: 0,
          },
          {
            id: 'acc-filho',
            organizationId: 'org-1',
            companyId: null,
            parentAccountId: 'acc-pai',
            code: '5.01',
            name: 'Pessoal',
            level: 1,
          },
        ]),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: `novo-${data.code}`,
          ...data,
        })),
      },
    });

    await service.duplicate('ver-1', actor);

    // O filho copiado deve apontar para a **cópia** do pai, não para o original.
    expect(prisma.financialAccountPlan.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: '5.01',
          parentAccountId: 'novo-5',
        }),
      }),
    );
  });

  it('recusa excluir uma versão que não é rascunho', async () => {
    const { service } = buildService({
      financialAccountPlanVersion: {
        findFirst: jest.fn().mockResolvedValue(ACTIVE_VERSION),
      },
    });

    await expect(service.remove('ver-1', actor)).rejects.toThrow(
      /Utilize a opção Arquivar/i,
    );
  });

  it('recusa excluir um rascunho com contas vinculadas', async () => {
    const { service } = buildService({
      financialAccountPlanVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...DRAFT_VERSION, _count: { accounts: 12 } }),
      },
    });

    await expect(service.remove('ver-2', actor)).rejects.toThrow(
      /contas vinculadas/i,
    );
  });
});
