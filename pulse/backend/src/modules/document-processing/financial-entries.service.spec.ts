/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- mocks do jest sao `any` por natureza */
import { BadRequestException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { FinancialEntriesService } from './financial-entries.service';

function buildActor(permissions: string[] = []): RequestUser {
  return {
    id: 'user-1',
    isPlatformAdmin: false,
    organizationMemberships: [],
    memberships: [{ companyId: 'company-1', permissions }],
  } as unknown as RequestUser;
}

function buildEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    sourceIntakeDocumentId: 'doc-1',
    status: 'DRAFT',
    grossAmount: 1000,
    discountAmount: 0,
    interestAmount: 0,
    penaltyAmount: 0,
    withholdingAmount: 0,
    netAmount: 1000,
    categoryId: 'cat-1',
    costCenterId: 'cc-1',
    digitableLine: '00190500954014481606906809350314337370000000100',
    barcode: '00195373700000001001',
    pixKey: 'financeiro@tchegrill.example.com',
    withholdings: [],
    installments: [{ id: 'inst-1', status: 'OPEN' }],
    ...overrides,
  };
}

function buildService(entry: Record<string, unknown> = {}) {
  const stored = buildEntry(entry);

  const tx = {
    financialEntry: { update: jest.fn().mockResolvedValue(stored) },
    financialEntryInstallment: { updateMany: jest.fn().mockResolvedValue({}) },
    financialEntryStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    financialEntryWithholding: { update: jest.fn().mockResolvedValue({}) },
    intakeDocument: { update: jest.fn().mockResolvedValue({}) },
    intakeDocumentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    financialEntry: {
      findFirstOrThrow: jest.fn().mockResolvedValue(stored),
      update: jest.fn().mockResolvedValue(stored),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([stored]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    financialEntryInstallment: { update: jest.fn().mockResolvedValue({}) },
    financialEntryWithholding: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'wh-novo' }),
      update: jest.fn().mockResolvedValue({}),
    },
    financialEntryStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    // Reproduz as duas formas do `$transaction` do Prisma: com callback (transação
    // interativa) e com array de promessas (transação em lote).
    $transaction: jest.fn((argument: unknown) =>
      typeof argument === 'function'
        ? (argument as (client: unknown) => unknown)(tx)
        : Promise.all(argument as Promise<unknown>[]),
    ),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  // Sem aprovação pendente por padrão: cada teste que precisa do gate sobrescreve.
  const approvals = {
    hasPendingApproval: jest.fn().mockResolvedValue(false),
  };

  const payables = { generateFromEntry: jest.fn().mockResolvedValue(null) };

  return {
    approvals,
    payables,
    service: new FinancialEntriesService(
      prisma as never,
      audit as never,
      approvals as never,
      payables as never,
    ),
    prisma,
    tx,
    audit,
    stored,
  };
}

describe('Lançamento financeiro — ciclo de vida', () => {
  it('não abre lançamento que já está em aberto', async () => {
    const { service } = buildService({ status: 'OPEN' });

    await expect(service.open('entry-1', buildActor())).rejects.toThrow(
      'já está em aberto',
    );
  });

  it('não abre lançamento cancelado', async () => {
    const { service } = buildService({ status: 'CANCELLED' });

    await expect(service.open('entry-1', buildActor())).rejects.toThrow(
      'cancelado',
    );
  });

  it('não abre lançamento que aguarda conferência', async () => {
    const { service } = buildService({ status: 'PENDING_APPROVAL' });

    await expect(service.open('entry-1', buildActor())).rejects.toThrow(
      'aguarda conferência',
    );
  });

  it('não abre com retenção sugerida sem decisão', async () => {
    const { service } = buildService({
      withholdings: [{ id: 'wh-1', taxType: 'IRRF', status: 'SUGGESTED' }],
    });

    await expect(service.open('entry-1', buildActor())).rejects.toThrow('IRRF');
  });

  it('não abre enquanto houver autorização pendente', async () => {
    const { service, approvals } = buildService({
      withholdings: [{ id: 'wh-1', taxType: 'IRRF', status: 'CONFIRMED' }],
    });
    approvals.hasPendingApproval.mockResolvedValue(true);

    await expect(service.open('entry-1', buildActor())).rejects.toThrow(
      'está em autorização',
    );
  });

  it('abre quando todas as retenções foram decididas', async () => {
    const { service, prisma } = buildService({
      withholdings: [{ id: 'wh-1', taxType: 'IRRF', status: 'CONFIRMED' }],
    });

    await service.open('entry-1', buildActor());

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('não abre sem nenhuma parcela em aberto', async () => {
    const { service } = buildService({
      installments: [{ id: 'inst-1', status: 'CANCELLED' }],
    });

    await expect(service.open('entry-1', buildActor())).rejects.toThrow(
      'nenhuma parcela em aberto',
    );
  });

  it('só confere lançamento que está aguardando conferência', async () => {
    const { service } = buildService({ status: 'DRAFT' });

    await expect(
      service.approve('entry-1', buildActor()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancelar devolve o documento para a fila do processamento', async () => {
    const { service, tx } = buildService({ status: 'OPEN' });

    await service.cancel(
      'entry-1',
      { reason: 'Nota cancelada.' },
      buildActor(),
    );

    expect(tx.intakeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          processingStatus: 'READY_FOR_PROCESSING',
        }),
      }),
    );
  });

  it('cancelar desfaz o vínculo com o documento para permitir reprocessar', async () => {
    const { service, tx } = buildService({ status: 'OPEN' });

    await service.cancel(
      'entry-1',
      { reason: 'Erro de digitação.' },
      buildActor(),
    );

    expect(tx.financialEntry.update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      sourceIntakeDocumentId: null,
    });
  });

  it('cancelar também cancela as parcelas', async () => {
    const { service, tx } = buildService({ status: 'OPEN' });

    await service.cancel('entry-1', { reason: 'Duplicado.' }, buildActor());

    expect(tx.financialEntryInstallment.updateMany).toHaveBeenCalledWith({
      where: { entryId: 'entry-1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('não cancela duas vezes', async () => {
    const { service } = buildService({ status: 'CANCELLED' });

    await expect(
      service.cancel('entry-1', { reason: 'De novo.' }, buildActor()),
    ).rejects.toThrow('já está cancelado');
  });
});

describe('Lançamento financeiro — edição', () => {
  it('não edita lançamento em aberto', async () => {
    const { service } = buildService({ status: 'OPEN' });

    await expect(
      service.update('entry-1', { description: 'x' }, buildActor()),
    ).rejects.toThrow('não pode ser editado');
  });

  it('não edita lançamento cancelado', async () => {
    const { service } = buildService({ status: 'CANCELLED' });

    await expect(
      service.update('entry-1', { description: 'x' }, buildActor()),
    ).rejects.toThrow('cancelado');
  });

  it('recalcula o valor líquido ao mudar desconto e juros', async () => {
    const { service, prisma } = buildService();

    await service.update(
      'entry-1',
      { discountAmount: 100, interestAmount: 25 },
      buildActor(),
    );

    expect(prisma.financialEntry.update.mock.calls[0][0].data.netAmount).toBe(
      925,
    );
  });

  it('não edita parcela de lançamento em aberto', async () => {
    const { service } = buildService({ status: 'OPEN' });

    await expect(
      service.updateInstallment('entry-1', 'inst-1', {}, buildActor()),
    ).rejects.toThrow('não pode ser editado');
  });

  it('recusa parcela que não pertence ao lançamento', async () => {
    const { service } = buildService();

    await expect(
      service.updateInstallment('entry-1', 'outra-parcela', {}, buildActor()),
    ).rejects.toThrow('Parcela não encontrada');
  });
});

describe('Lançamento financeiro — retenções', () => {
  it('confirmar a retenção desconta o valor líquido', async () => {
    const { service, tx } = buildService({
      withholdings: [
        { id: 'wh-1', taxType: 'IRRF', status: 'SUGGESTED', amount: 133.5 },
      ],
    });

    await service.confirmWithholding('entry-1', 'wh-1', {}, buildActor());

    expect(tx.financialEntry.update.mock.calls[0][0].data).toMatchObject({
      withholdingAmount: { increment: 133.5 },
      netAmount: { decrement: 133.5 },
    });
  });

  it('não confirma retenção já decidida', async () => {
    const { service } = buildService({
      withholdings: [
        { id: 'wh-1', taxType: 'IRRF', status: 'CONFIRMED', amount: 100 },
      ],
    });

    await expect(
      service.confirmWithholding('entry-1', 'wh-1', {}, buildActor()),
    ).rejects.toThrow('já foi decidida');
  });

  it('não descarta retenção que já alterou o valor líquido', async () => {
    const { service } = buildService({
      withholdings: [
        { id: 'wh-1', taxType: 'ISS', status: 'CONFIRMED', amount: 100 },
      ],
    });

    await expect(
      service.dismissWithholding(
        'entry-1',
        'wh-1',
        { reason: 'Mudei de ideia.' },
        buildActor(),
      ),
    ).rejects.toThrow('não pode ser descartada');
  });

  it('retenção informada à mão nasce como sugestão', async () => {
    const { service, prisma } = buildService();

    await service.addWithholding(
      'entry-1',
      { taxType: 'ISS', calculationBase: 1000, rate: 5 },
      buildActor(),
    );

    expect(
      prisma.financialEntryWithholding.create.mock.calls[0][0].data,
    ).toMatchObject({ amount: 50, status: 'SUGGESTED' });
  });

  it('recusa retenção manual que resultaria em zero', async () => {
    const { service } = buildService();

    await expect(
      service.addWithholding(
        'entry-1',
        { taxType: 'ISS', calculationBase: 1000, rate: 0 },
        buildActor(),
      ),
    ).rejects.toThrow('ficou em zero');
  });
});

describe('Lançamento financeiro — mascaramento', () => {
  it('mascara linha digitável, código de barras e chave PIX sem permissão', async () => {
    const { service } = buildService();

    const entry = await service.findOne('entry-1', buildActor());

    expect(entry.digitableLine).toMatch(/^\*+\d{6}$/);
    expect(entry.barcode).toMatch(/^\*+\d{6}$/);
    expect(entry.pixKey).toBe('fi********@tchegrill.example.com');
  });

  it('entrega os valores completos a quem tem a permissão', async () => {
    const { service, stored } = buildService();

    const entry = await service.findOne(
      'entry-1',
      buildActor(['document_intake.view_sensitive_data']),
    );

    expect(entry.digitableLine).toBe(stored.digitableLine);
    expect(entry.pixKey).toBe(stored.pixKey);
  });

  it('mascara também na listagem, não só no detalhe', async () => {
    const { service } = buildService();

    const result = await service.findAll(
      { page: 1, perPage: 20 },
      buildActor(),
    );

    expect(result.items[0].digitableLine).toMatch(/^\*+\d{6}$/);
  });
});

describe('Lançamento financeiro — totais', () => {
  it('conta apenas o que está em aberto', async () => {
    const { service, prisma } = buildService();

    await service.findSummary('org-1', 'company-1');

    expect(prisma.financialEntry.groupBy.mock.calls[0][0].where.status).toBe(
      'OPEN',
    );
  });

  it('declara no resumo que nada foi pago', async () => {
    const { service } = buildService();

    const summary = await service.findSummary('org-1', 'company-1');

    expect(summary.note).toContain('Nenhum pagamento');
  });
});
