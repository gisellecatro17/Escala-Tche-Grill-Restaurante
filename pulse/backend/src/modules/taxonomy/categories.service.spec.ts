/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CategoriesService } from './categories.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

const EXISTING_CATEGORY = {
  id: 'cat-1',
  companyId: 'company-1',
  parentCategoryId: null,
  name: 'Energia',
  code: 'CAT-ENERGIA',
  sortOrder: 0,
  isSystem: false,
  subcategories: [],
};

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    financialCategory: {
      findFirst: jest.fn().mockResolvedValue(EXISTING_CATEGORY),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'cat-new', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => ({
        ...EXISTING_CATEGORY,
        ...data,
      })),
      count: jest.fn().mockResolvedValue(0),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    },
    supplierCompanyLink: { count: jest.fn().mockResolvedValue(0) },
    customerCompanyLink: { count: jest.fn().mockResolvedValue(0) },
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
    service: new CategoriesService(prismaMock, audit, versions),
    prisma: prismaMock,
    versions,
  };
}

describe('CategoriesService', () => {
  it('mantém o cadastro rápido funcionando sem informar um ator', async () => {
    const { service, prisma } = buildService({
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'cat-new', ...data })),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    });

    await expect(
      service.create({ companyId: 'company-1', name: 'Telefone' } as any),
    ).resolves.toMatchObject({ name: 'Telefone' });
    expect(prisma.financialCategory.create).toHaveBeenCalled();
  });

  it('recusa uma categoria pai inexistente', async () => {
    const { service } = buildService({
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    });

    await expect(
      service.create({
        companyId: 'company-1',
        name: 'Coelba',
        parentCategoryId: 'inexistente',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('traduz código duplicado em mensagem de conflito', async () => {
    const { service } = buildService({
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['company_id', 'code'] },
          }),
        ),
        update: jest.fn(),
        count: jest.fn(),
      },
    });

    await expect(
      service.create({
        companyId: 'company-1',
        name: 'Energia',
        code: 'CAT-ENERGIA',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('impede mover uma categoria para dentro de uma subcategoria', async () => {
    const { service } = buildService({
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue(EXISTING_CATEGORY),
        findMany: jest.fn().mockResolvedValue([
          { id: 'cat-1', parentCategoryId: null },
          { id: 'cat-2', parentCategoryId: 'cat-1' },
        ]),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    });

    await expect(
      service.move('cat-1', { parentId: 'cat-2' }, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('versiona a árvore antes de mover uma categoria', async () => {
    const { service, versions } = buildService();

    await service.move('cat-1', { parentId: null }, actor);

    expect(versions.snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'CATEGORY' }),
    );
  });

  it('bloqueia a exclusão de uma categoria com subcategorias', async () => {
    const { service } = buildService({
      financialCategory: {
        findFirst: jest.fn().mockResolvedValue({
          ...EXISTING_CATEGORY,
          subcategories: [{ id: 'cat-2' }],
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    });

    await expect(service.remove('cat-1', actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('bloqueia a exclusão de uma categoria usada por um fornecedor', async () => {
    const { service } = buildService({
      supplierCompanyLink: { count: jest.fn().mockResolvedValue(1) },
    });

    await expect(service.remove('cat-1', actor)).rejects.toThrow(
      /Utilize a opção Inativar/i,
    );
  });

  it('bloqueia a exclusão de uma categoria usada como categoria de receita de um cliente', async () => {
    const { service } = buildService({
      customerCompanyLink: { count: jest.fn().mockResolvedValue(1) },
    });

    await expect(service.remove('cat-1', actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('exclui logicamente uma categoria sem uso (preserva o histórico)', async () => {
    const { service, prisma } = buildService();

    await expect(service.remove('cat-1', actor)).resolves.toEqual({
      id: 'cat-1',
    });
    expect(prisma.financialCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INACTIVE' }),
      }),
    );
  });
});
