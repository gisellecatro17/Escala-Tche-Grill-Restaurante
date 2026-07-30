/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks usam `any` propositalmente nos testes */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { StructureImportService } from './structure-import.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

/** Linhas gravadas pelo `analyze`, como o `validateBatch` as encontraria. */
function importRow(rowNumber: number, original: Record<string, string>) {
  return {
    id: `row-${rowNumber}`,
    rowNumber,
    originalData: original,
    normalizedData: null,
    validationStatus: 'WARNING',
  };
}

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
    financialStructureImportRow: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
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

const baseDto = { organizationId: 'org-1', entity: 'ACCOUNT_PLAN' as any };

const MAPPING = {
  headers: ['codigo', 'descricao', 'codigo_pai'],
  mapping: { code: 'codigo', name: 'descricao', parentCode: 'codigo_pai' },
  confirmed: true,
};

const VALIDATED_BATCH = {
  id: 'batch-1',
  organizationId: 'org-1',
  companyId: null,
  entity: 'ACCOUNT_PLAN',
  status: 'VALIDATED',
  fileName: 'plano.csv',
  mappingConfiguration: MAPPING,
};

describe('StructureImportService.analyze', () => {
  it('lê um CSV com ponto e vírgula e sugere o mapeamento pelos cabeçalhos', async () => {
    const { service } = buildService();

    const batch = await service.analyze(
      {
        ...baseDto,
        content:
          'codigo;descricao;codigo_pai\n1;Ativo;\n1.1;Ativo Circulante;1',
      },
      undefined,
      actor,
    );

    expect(batch.totalRows).toBe(2);
    expect(batch.status).toBe('PENDING');
    expect(batch.suggestedMapping).toEqual({
      code: 'codigo',
      name: 'descricao',
      parentCode: 'codigo_pai',
    });
  });

  it('aceita vírgula como separador e cabeçalhos em inglês', async () => {
    const { service } = buildService();

    const batch = await service.analyze(
      { ...baseDto, content: 'code,name\n1,Ativo' },
      undefined,
      actor,
    );

    expect(batch.totalRows).toBe(1);
    expect(batch.suggestedMapping.name).toBe('name');
  });

  it('não confunde vírgula dentro de aspas com separador', async () => {
    const { service } = buildService();

    const batch = await service.analyze(
      {
        ...baseDto,
        content: 'codigo;descricao\n5.01;"Aluguel, água e energia"',
      },
      undefined,
      actor,
    );

    const rows = (batch as any).sampleRows;
    expect(rows[0].descricao).toBe('Aluguel, água e energia');
  });

  it('lê JSON como lista de objetos', async () => {
    const { service } = buildService();

    const batch = await service.analyze(
      {
        ...baseDto,
        format: 'JSON',
        content: JSON.stringify([
          { codigo: '1', descricao: 'Ativo' },
          { codigo: '2', descricao: 'Passivo' },
        ]),
      },
      undefined,
      actor,
    );

    expect(batch.totalRows).toBe(2);
    expect(batch.headers).toEqual(['codigo', 'descricao']);
  });

  it('grava cada linha do arquivo para rastreio individual', async () => {
    const { service, prisma } = buildService();

    await service.analyze(
      { ...baseDto, content: 'codigo;descricao\n1;Ativo\n2;Passivo' },
      undefined,
      actor,
    );

    const created =
      prisma.financialStructureImport.create.mock.calls[0][0].data;
    expect(created.rows.create).toHaveLength(2);
    // A linha 1 é o cabeçalho: os dados começam na 2.
    expect(created.rows.create[0].rowNumber).toBe(2);
  });

  it('exige cabeçalho e ao menos uma linha de dados', async () => {
    const { service } = buildService();

    await expect(
      service.analyze(
        { ...baseDto, content: 'codigo;descricao' },
        undefined,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa importação para entidades não suportadas', async () => {
    const { service } = buildService();

    await expect(
      service.analyze(
        { ...baseDto, entity: 'PROJECT' as any, content: 'codigo;nome\n1;X' },
        undefined,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('exige a empresa para cadastros que só existem dentro dela', async () => {
    const { service } = buildService();

    await expect(
      service.analyze(
        { ...baseDto, entity: 'CATEGORY' as any, content: 'codigo;nome\n1;X' },
        undefined,
        actor,
      ),
    ).rejects.toThrow(/Selecione a empresa/i);
  });

  it('prioriza o arquivo enviado sobre o conteúdo colado', async () => {
    const { service } = buildService();

    const batch = await service.analyze(
      { ...baseDto, content: 'codigo;descricao\n9;Do content' },
      Buffer.from('codigo;descricao\n1;Do arquivo\n2;Segunda', 'utf-8'),
      actor,
    );

    expect(batch.totalRows).toBe(2);
  });
});

describe('StructureImportService.setMapping', () => {
  function batchFor(headers: string[]) {
    return {
      financialStructureImport: {
        findUnique: jest.fn().mockResolvedValue({
          ...VALIDATED_BATCH,
          status: 'PENDING',
          mappingConfiguration: { headers, mapping: {}, confirmed: false },
        }),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
  }

  it('confirma o mapeamento informado pelo usuário', async () => {
    const { service } = buildService(batchFor(['A', 'B']));

    const updated = await service.setMapping(
      'batch-1',
      { mapping: { code: 'A', name: 'B' } },
      actor,
    );

    expect((updated.mappingConfiguration as any).mapping).toEqual({
      code: 'A',
      name: 'B',
    });
    expect((updated.mappingConfiguration as any).confirmed).toBe(true);
  });

  it('recusa uma coluna que não existe no arquivo', async () => {
    const { service } = buildService(batchFor(['A', 'B']));

    await expect(
      service.setMapping(
        'batch-1',
        { mapping: { code: 'A', name: 'Inexistente' } },
        actor,
      ),
    ).rejects.toThrow(/não existe no arquivo/i);
  });

  it('exige as colunas obrigatórias', async () => {
    const { service } = buildService(batchFor(['A', 'B']));

    await expect(
      service.setMapping('batch-1', { mapping: { code: 'A' } }, actor),
    ).rejects.toThrow(/Nome \/ descrição/);
  });

  it('recusa um campo interno desconhecido', async () => {
    const { service } = buildService(batchFor(['A', 'B']));

    await expect(
      service.setMapping(
        'batch-1',
        { mapping: { code: 'A', name: 'B', inventado: 'A' } },
        actor,
      ),
    ).rejects.toThrow(/não é reconhecido/i);
  });
});

describe('StructureImportService.validateBatch', () => {
  function setup(
    rows: ReturnType<typeof importRow>[],
    existing: { code: string }[] = [],
  ) {
    const rowDelegate = {
      findMany: jest.fn().mockResolvedValue(rows),
      update: jest.fn().mockResolvedValue({}),
    };

    const built = buildService({
      financialStructureImport: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...VALIDATED_BATCH, status: 'PENDING' }),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      financialStructureImportRow: rowDelegate,
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        update: jest.fn(),
      },
    });

    return { ...built, rowDelegate };
  }

  it('marca como válidas as linhas completas', async () => {
    const { service } = setup([
      importRow(2, { codigo: '1', descricao: 'Ativo', codigo_pai: '' }),
      importRow(3, {
        codigo: '1.1',
        descricao: 'Ativo Circulante',
        codigo_pai: '1',
      }),
    ]);

    const batch = await service.validateBatch('batch-1', actor);

    expect(batch.validRows).toBe(2);
    expect(batch.invalidRows).toBe(0);
    expect(batch.status).toBe('VALIDATED');
  });

  it('reporta linhas sem código ou sem nome, sem descartar o lote', async () => {
    const { service } = setup([
      importRow(2, { codigo: '1', descricao: 'Ativo' }),
      importRow(3, { codigo: '', descricao: 'Sem código' }),
      importRow(4, { codigo: '2', descricao: '' }),
    ]);

    const batch = await service.validateBatch('batch-1', actor);

    expect(batch.validRows).toBe(1);
    expect(batch.invalidRows).toBe(2);
    expect(batch.status).toBe('PENDING');
  });

  it('reporta código repetido dentro do arquivo', async () => {
    const { service, rowDelegate } = setup([
      importRow(2, { codigo: '1', descricao: 'Ativo' }),
      importRow(3, { codigo: '01', descricao: 'Ativo de novo' }),
    ]);

    const batch = await service.validateBatch('batch-1', actor);

    // "1" e "01" normalizam para o mesmo código.
    expect(batch.invalidRows).toBe(1);
    const second = rowDelegate.update.mock.calls[1][0].data;
    expect(second.validationErrors[0].message).toMatch(/repetido/i);
  });

  it('acusa erro quando o registro superior não existe em lugar nenhum', async () => {
    const { service, rowDelegate } = setup([
      importRow(2, { codigo: '2.1', descricao: 'Órfã', codigo_pai: '9' }),
    ]);

    const batch = await service.validateBatch('batch-1', actor);

    expect(batch.invalidRows).toBe(1);
    expect(
      rowDelegate.update.mock.calls[0][0].data.validationErrors[0].message,
    ).toMatch(/não existe no arquivo nem no cadastro/i);
  });

  it('aceita um pai que já existe no cadastro', async () => {
    const { service } = setup(
      [importRow(2, { codigo: '1.1', descricao: 'Filha', codigo_pai: '1' })],
      [{ code: '1' }],
    );

    const batch = await service.validateBatch('batch-1', actor);

    expect(batch.invalidRows).toBe(0);
  });

  it('marca como aviso — não erro — o código que já existe no cadastro', async () => {
    const { service, rowDelegate } = setup(
      [importRow(2, { codigo: '1', descricao: 'Ativo' })],
      [{ code: '1' }],
    );

    const batch = await service.validateBatch('batch-1', actor);

    expect(batch.warningRows).toBe(1);
    expect(batch.invalidRows).toBe(0);
    expect(rowDelegate.update.mock.calls[0][0].data.validationStatus).toBe(
      'WARNING',
    );
  });

  it('exige o mapeamento confirmado antes de validar', async () => {
    const { service } = buildService({
      financialStructureImport: {
        findUnique: jest.fn().mockResolvedValue({
          ...VALIDATED_BATCH,
          status: 'PENDING',
          mappingConfiguration: { headers: ['A'], mapping: {} },
        }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(service.validateBatch('batch-1', actor)).rejects.toThrow(
      /Confirme o mapeamento/i,
    );
  });
});

describe('StructureImportService.applyBatch', () => {
  function setup(
    rows: { id: string; rowNumber: number; normalizedData: unknown }[],
    accountOverrides: Record<string, unknown> = {},
  ) {
    return buildService({
      financialStructureImport: {
        findUnique: jest.fn().mockResolvedValue(VALIDATED_BATCH),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 'batch-1', ...data })),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      financialStructureImportRow: {
        findMany: jest.fn().mockResolvedValue(rows),
        update: jest.fn().mockResolvedValue({}),
      },
      financialAccountPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => ({
          id: `acc-${data.code}`,
          ...data,
        })),
        update: jest.fn(),
        ...accountOverrides,
      },
    });
  }

  const ROWS = [
    { id: 'row-2', rowNumber: 2, normalizedData: { code: '1', name: 'Ativo' } },
    {
      id: 'row-3',
      rowNumber: 3,
      normalizedData: {
        code: '1.1',
        name: 'Ativo Circulante',
        parentCode: '1',
      },
    },
  ];

  it('cria as contas respeitando a ordem pai → filho', async () => {
    const { service, prisma } = setup(ROWS);

    const result = await service.applyBatch('batch-1', {}, actor);

    expect(result.createdRows).toBe(2);
    const calls = prisma.financialAccountPlan.create.mock.calls;
    expect(calls[0][0].data.code).toBe('1');
    expect(calls[1][0].data.parentAccountId).toBe('acc-1');
  });

  it('versiona a árvore antes de aplicar', async () => {
    const { service, versions } = setup(ROWS);

    await service.applyBatch('batch-1', {}, actor);

    expect(versions.snapshot).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ACCOUNT_PLAN' }),
    );
  });

  it('liga cada linha ao registro que ela criou', async () => {
    const { service, prisma } = setup(ROWS);

    await service.applyBatch('batch-1', {}, actor);

    expect(prisma.financialStructureImportRow.update).toHaveBeenCalledWith({
      where: { id: 'row-2' },
      data: { createdEntityType: 'ACCOUNT_PLAN', createdEntityId: 'acc-1' },
    });
  });

  it('impede aplicar o mesmo lote duas vezes', async () => {
    const { service } = buildService({
      financialStructureImport: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...VALIDATED_BATCH, status: 'APPLIED' }),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    });

    await expect(service.applyBatch('batch-1', {}, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('INSERT_ONLY mantém intocado o registro que já existe', async () => {
    const { service, prisma } = setup(ROWS, {
      findFirst: jest.fn().mockResolvedValue({ id: 'existente' }),
    });

    const result = await service.applyBatch(
      'batch-1',
      { mode: 'INSERT_ONLY' },
      actor,
    );

    expect(result.createdRows).toBe(0);
    expect(result.updatedRows).toBe(0);
    expect(result.skippedRows).toBe(2);
    expect(prisma.financialAccountPlan.create).not.toHaveBeenCalled();
    expect(prisma.financialAccountPlan.update).not.toHaveBeenCalled();
  });

  it('INSERT_AND_UPDATE atualiza o que já existe sem excluir nada', async () => {
    const { service, prisma } = setup(ROWS, {
      findFirst: jest.fn().mockResolvedValue({ id: 'existente' }),
    });

    const result = await service.applyBatch(
      'batch-1',
      { mode: 'INSERT_AND_UPDATE' },
      actor,
    );

    expect(result.updatedRows).toBe(2);
    expect(prisma.financialAccountPlan.update).toHaveBeenCalledTimes(2);
    // A atualização não mexe em código nem em posição na árvore.
    const patch = prisma.financialAccountPlan.update.mock.calls[0][0].data;
    expect(patch.code).toBeUndefined();
    expect(patch.parentAccountId).toBeUndefined();
    expect(
      JSON.stringify(prisma.financialAccountPlan.update.mock.calls),
    ).not.toContain('deletedAt');
  });

  it('UPDATE_ONLY ignora códigos que ainda não existem', async () => {
    const { service, prisma } = setup(ROWS);

    const result = await service.applyBatch(
      'batch-1',
      { mode: 'UPDATE_ONLY' },
      actor,
    );

    expect(result.createdRows).toBe(0);
    expect(result.skippedRows).toBe(2);
    expect(prisma.financialAccountPlan.create).not.toHaveBeenCalled();
  });

  it('SIMULATE informa o que aconteceria sem gravar nem versionar', async () => {
    const { service, prisma, versions } = setup(ROWS);

    const result = await service.applyBatch(
      'batch-1',
      { mode: 'SIMULATE' },
      actor,
    );

    expect(result.simulated).toBe(true);
    expect(result.createdRows).toBe(2);
    expect(result.status).toBe('VALIDATED');
    expect(prisma.financialAccountPlan.create).not.toHaveBeenCalled();
    expect(versions.snapshot).not.toHaveBeenCalled();
  });

  it('recusa aplicar um lote sem nenhuma linha aprovada', async () => {
    const { service } = setup([]);

    await expect(service.applyBatch('batch-1', {}, actor)).rejects.toThrow(
      /Não há linhas aprovadas/i,
    );
  });
});

describe('StructureImportService.export', () => {
  function exportService(rows: unknown[]) {
    return buildService({
      financialAccountPlan: {
        findMany: jest.fn().mockResolvedValue(rows),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
  }

  const ONE_ROW = [
    {
      code: '1',
      name: 'Ativo "Total"',
      level: 0,
      path: 'Ativo',
      structureStatus: 'ACTIVE',
      parentAccount: null,
    },
  ];

  it('gera CSV com cabeçalho e aspas escapadas', async () => {
    const { service } = exportService(ONE_ROW);

    const result = await service.export(
      { organizationId: 'org-1', entity: 'ACCOUNT_PLAN' },
      actor,
    );

    expect(result.format).toBe('csv');
    expect((result as any).content).toContain('"codigo";"nome"');
    expect((result as any).content).toContain('"Ativo ""Total"""');
  });

  it('devolve JSON quando solicitado', async () => {
    const { service } = exportService([]);

    const result = await service.export(
      {
        organizationId: 'org-1',
        entity: 'ACCOUNT_PLAN',
        format: 'json',
      },
      actor,
    );

    expect(result.format).toBe('json');
    expect((result as any).rows).toEqual([]);
  });

  it('gera um XLSX real, com assinatura de arquivo zip', async () => {
    const { service } = exportService(ONE_ROW);

    const result = await service.export(
      {
        organizationId: 'org-1',
        entity: 'ACCOUNT_PLAN',
        format: 'xlsx',
      },
      actor,
    );

    expect(result.format).toBe('xlsx');
    const buffer = Buffer.from((result as any).base64, 'base64');
    // Um .xlsx é um zip: começa com "PK".
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect((result as any).fileName).toMatch(/\.xlsx$/);
  });

  it('gera um PDF com cabeçalho válido', async () => {
    const { service } = exportService(ONE_ROW);

    const result = await service.export(
      { organizationId: 'org-1', entity: 'ACCOUNT_PLAN', format: 'pdf' },
      actor,
    );

    expect(result.format).toBe('pdf');
    const buffer = Buffer.from((result as any).base64, 'base64');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.toString('latin1')).toContain('%%EOF');
  });

  it('exporta somente os ativos por padrão', async () => {
    const { service, prisma } = exportService([]);

    await service.export(
      { organizationId: 'org-1', entity: 'ACCOUNT_PLAN' },
      actor,
    );

    expect(prisma.financialAccountPlan.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ structureStatus: 'ACTIVE' }),
    );
  });

  it('inclui inativos quando pedido explicitamente', async () => {
    const { service, prisma } = exportService([]);

    await service.export(
      {
        organizationId: 'org-1',
        entity: 'ACCOUNT_PLAN',
        includeInactive: true,
      },
      actor,
    );

    expect(
      prisma.financialAccountPlan.findMany.mock.calls[0][0].where
        .structureStatus,
    ).toBeUndefined();
  });
});
