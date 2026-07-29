/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks usam `any` propositalmente nos testes */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { StructureImportService } from './structure-import.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    financialStructureImport: {
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
      findUnique: jest.fn(),
      update: jest
        .fn()
        .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    financialAccountPlan: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => ({
        id: `acc-${data.code}`,
        ...data,
      })),
      update: jest.fn(),
    },
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;
  const audit = { log: jest.fn() } as any;
  const versions = { snapshot: jest.fn() } as any;

  return {
    service: new StructureImportService(prismaMock, audit, versions),
    prisma: prismaMock,
    versions,
  };
}

const baseDto = {
  organizationId: 'org-1',
  entity: 'ACCOUNT_PLAN' as any,
};

describe('StructureImportService.validate', () => {
  it('lê um CSV com ponto e vírgula e cabeçalhos em português', async () => {
    const { service } = buildService();

    const batch = await service.validate(
      {
        ...baseDto,
        content:
          'codigo;descricao;codigo_pai\n1;Ativo;\n1.1;Ativo Circulante;1',
      },
      undefined,
      actor,
    );

    expect(batch.validRows).toBe(2);
    expect(batch.invalidRows).toBe(0);
    expect(batch.status).toBe('VALIDATED');
  });

  it('aceita vírgula como separador e cabeçalhos em inglês', async () => {
    const { service } = buildService();

    const batch = await service.validate(
      { ...baseDto, content: 'code,name\n1,Ativo' },
      undefined,
      actor,
    );

    expect(batch.validRows).toBe(1);
  });

  it('reporta linhas sem código ou sem nome, sem descartar o lote', async () => {
    const { service } = buildService();

    const batch = await service.validate(
      {
        ...baseDto,
        content: 'codigo;descricao\n1;Ativo\n;Sem código\n2;',
      },
      undefined,
      actor,
    );

    expect(batch.validRows).toBe(1);
    expect(batch.invalidRows).toBe(2);
    expect(batch.status).toBe('PENDING');
  });

  it('reporta código repetido dentro do arquivo', async () => {
    const { service } = buildService();

    const batch = await service.validate(
      {
        ...baseDto,
        content: 'codigo;descricao\n1;Ativo\n1;Ativo de novo',
      },
      undefined,
      actor,
    );

    expect(batch.invalidRows).toBe(1);
    expect((batch.errors as any)[0].message).toMatch(/repetido/i);
  });

  it('exige cabeçalho e ao menos uma linha de dados', async () => {
    const { service } = buildService();

    await expect(
      service.validate(
        { ...baseDto, content: 'codigo;descricao' } as any,
        undefined,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('exige as colunas de código e nome', async () => {
    const { service } = buildService();

    await expect(
      service.validate(
        { ...baseDto, content: 'coluna_a;coluna_b\n1;2' } as any,
        undefined,
        actor,
      ),
    ).rejects.toThrow(/código e nome/i);
  });

  it('recusa importação para entidades não suportadas', async () => {
    const { service } = buildService();

    await expect(
      service.validate(
        {
          ...baseDto,
          entity: 'PROJECT' as any,
          content: 'codigo;nome\n1;X',
        } as any,
        undefined,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('prioriza o arquivo enviado sobre o conteúdo colado', async () => {
    const { service } = buildService();

    const batch = await service.validate(
      { ...baseDto, content: 'codigo;descricao\n9;Do content' },
      'codigo;descricao\n1;Do arquivo\n2;Segunda',
      actor,
    );

    expect(batch.validRows).toBe(2);
  });
});

describe('StructureImportService.apply', () => {
  const validatedBatch = {
    id: 'batch-1',
    organizationId: 'org-1',
    companyId: null,
    entity: 'ACCOUNT_PLAN',
    status: 'VALIDATED',
    fileName: 'plano.csv',
    preview: [
      { line: 2, code: '1', name: 'Ativo' },
      { line: 3, code: '1.1', name: 'Ativo Circulante', parentCode: '1' },
    ],
  };

  it('cria as contas respeitando a ordem pai → filho', async () => {
    const { service, prisma } = buildService({
      financialStructureImport: {
        findUnique: jest.fn().mockResolvedValue(validatedBatch),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });

    const result = await service.apply('batch-1', {}, actor);

    expect(result.createdRows).toBe(2);
    // A conta "1" precisa ser criada antes de "1.1", que a referencia como pai.
    const calls = prisma.financialAccountPlan.create.mock.calls;
    expect(calls[0][0].data.code).toBe('1');
    expect(calls[1][0].data.parentAccountId).toBe('acc-1');
  });

  it('versiona a árvore antes de aplicar', async () => {
    const { service, versions } = buildService({
      financialStructureImport: {
        findUnique: jest.fn().mockResolvedValue(validatedBatch),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await service.apply('batch-1', {}, actor);

    expect(versions.snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ACCOUNT_PLAN' }),
    );
  });

  it('impede aplicar o mesmo lote duas vezes', async () => {
    const { service } = buildService({
      financialStructureImport: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...validatedBatch, status: 'APPLIED' }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(service.apply('batch-1', {}, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('mantém registros existentes quando updateExisting é falso', async () => {
    const { service, prisma } = buildService({
      financialStructureImport: {
        findUnique: jest.fn().mockResolvedValue(validatedBatch),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existente' }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    const result = await service.apply(
      'batch-1',
      { updateExisting: false },
      actor,
    );

    expect(result.createdRows).toBe(0);
    expect(result.updatedRows).toBe(2);
    expect(prisma.financialAccountPlan.create).not.toHaveBeenCalled();
    expect(prisma.financialAccountPlan.update).not.toHaveBeenCalled();
  });
});

describe('StructureImportService.export', () => {
  it('gera CSV com cabeçalho e aspas escapadas', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: '1',
            name: 'Ativo "Total"',
            level: 0,
            path: 'Ativo',
            parentAccount: null,
          },
        ]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    const result = await service.export(
      { organizationId: 'org-1', entity: 'ACCOUNT_PLAN' },
      actor,
    );

    expect(result.format).toBe('csv');
    expect((result as any).content).toContain('"codigo";"nome"');
    expect((result as any).content).toContain('"Ativo ""Total"""');
  });

  it('devolve JSON quando solicitado', async () => {
    const { service } = buildService({
      financialAccountPlan: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    const result = await service.export(
      {
        organizationId: 'org-1',
        entity: 'ACCOUNT_PLAN' as any,
        format: 'json',
      } as any,
      actor,
    );

    expect(result.format).toBe('json');
    expect((result as any).rows).toEqual([]);
  });
});
