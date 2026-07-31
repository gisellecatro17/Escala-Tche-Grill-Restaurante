/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- mocks do jest sao any por natureza */
import { BadRequestException } from '@nestjs/common';
import {
  AccountsPayableBlockReason,
  AccountsPayablePriority,
  FinancialEntryDirection,
  FinancialEntryWithholdingStatus,
} from '@prisma/client';

import { PayableGenerationService } from './payable-generation.service';
import type { RequestUser } from '../../common/types/authenticated-request';

const actor = {
  id: 'user-1',
  name: 'Financeiro',
  email: 'financeiro@pulse.test',
  avatarUrl: null,
  memberships: [],
  organizationMemberships: [],
  isPlatformAdmin: true,
} satisfies RequestUser;

function buildService(
  options: {
    entry?: Record<string, unknown> | null;
    existing?: Record<string, unknown> | null;
    settings?: Record<string, unknown>;
    openIssues?: number;
    approval?: Record<string, unknown> | null;
    lastCode?: string | null;
  } = {},
) {
  const entry =
    options.entry === null
      ? null
      : {
          id: 'entry-1',
          organizationId: 'org-1',
          companyId: 'company-1',
          direction: FinancialEntryDirection.PAYABLE,
          sourceIntakeDocumentId: 'doc-1',
          supplierId: 'supplier-1',
          supplierCompanyLinkId: 'link-1',
          documentNumber: 'NF-100',
          documentSeries: '1',
          accessKey: null,
          issueDate: new Date('2026-07-01'),
          competenceDate: new Date('2026-07-01'),
          description: 'Compra de insumos',
          notes: null,
          grossAmount: 10000,
          netAmount: 9500,
          currencyCode: 'BRL',
          categoryId: 'cat-1',
          subcategoryId: null,
          accountPlanId: null,
          financialNatureId: null,
          costCenterId: 'cc-1',
          resultCenterId: null,
          projectId: null,
          businessUnitId: null,
          financialAccountId: 'acc-1',
          paymentMethodId: 'pm-1',
          barcode: '12345678901234567890',
          digitableLine: null,
          pixKey: null,
          createdBy: 'user-9',
          installments: [
            {
              installmentNumber: 1,
              totalInstallments: 2,
              dueDate: new Date('2026-08-10'),
              grossAmount: 5000,
              discountAmount: 0,
              netAmount: 4750,
              barcode: null,
              digitableLine: null,
            },
            {
              installmentNumber: 2,
              totalInstallments: 2,
              dueDate: new Date('2026-09-10'),
              grossAmount: 5000,
              discountAmount: 0,
              netAmount: 4750,
              barcode: null,
              digitableLine: null,
            },
          ],
          allocations: [
            {
              targetType: 'COST_CENTER',
              costCenterId: 'cc-1',
              resultCenterId: null,
              projectId: null,
              businessUnitId: null,
              categoryId: null,
              accountPlanId: null,
              percentage: 100,
              amount: 9500,
              sortOrder: 0,
              notes: null,
            },
          ],
          withholdings: [
            {
              id: 'w-confirmed',
              taxType: 'ISS',
              calculationBase: 10000,
              rate: 5,
              amount: 500,
              minimumAmount: null,
              status: FinancialEntryWithholdingStatus.CONFIRMED,
              decisionReason: 'Conferido',
              decidedBy: 'user-2',
              decidedAt: new Date('2026-07-02'),
            },
            {
              id: 'w-suggested',
              taxType: 'INSS',
              calculationBase: 10000,
              rate: 11,
              amount: 1100,
              minimumAmount: null,
              status: FinancialEntryWithholdingStatus.SUGGESTED,
              decisionReason: null,
              decidedBy: null,
              decidedAt: null,
            },
          ],
          ...options.entry,
        };

  const createdPayable = { id: 'payable-1', code: 'CP-2026-000001' };
  let createArgs: any = null;
  const blocks: any[] = [];
  const history: any[] = [];

  const tx = {
    accountsPayable: {
      create: jest.fn().mockImplementation((args: any) => {
        createArgs = args.data;
        return Promise.resolve(createdPayable);
      }),
    },
    accountsPayableBlock: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        blocks.push(data);
        return Promise.resolve(data);
      }),
    },
    accountsPayableHistory: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        history.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  const prisma = {
    financialEntry: { findFirst: jest.fn().mockResolvedValue(entry) },
    accountsPayable: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.code
              ? options.lastCode
                ? { code: options.lastCode }
                : null
              : (options.existing ?? null),
          ),
        ),
    },
    accountsPayableSettings: {
      findUnique: jest.fn().mockResolvedValue({
        autoGenerateOnApproval: true,
        codePrefix: 'CP',
        defaultPriority: AccountsPayablePriority.NORMAL,
        autoBlockWhenDocumentPending: true,
        ...options.settings,
      }),
      create: jest.fn(),
    },
    approvalRequest: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.approval === undefined
            ? { id: 'request-1' }
            : options.approval,
        ),
    },
    intakeDocument: {
      findUnique: jest.fn().mockResolvedValue({ documentType: 'INVOICE' }),
    },
    supplierContract: {
      findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }),
    },
    intakeDocumentIssue: {
      count: jest.fn().mockResolvedValue(options.openIssues ?? 0),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (callback: any) => callback(tx)),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const balance = {
    recompute: jest.fn().mockResolvedValue({
      ...createdPayable,
      netAmount: 9500,
      status: 'OPEN',
    }),
  };

  const service = new PayableGenerationService(
    prisma as never,
    audit as never,
    balance as never,
  );

  return {
    service,
    prisma,
    tx,
    audit,
    balance,
    blocks,
    history,
    createArgs: () => createArgs,
  };
}

describe('PayableGenerationService', () => {
  it('gera o título com as parcelas do lançamento (critério de aceite 1)', async () => {
    const { service, createArgs, audit } = buildService();

    const result = await service.generateFromEntry('entry-1', actor);

    expect(result).toMatchObject({ id: 'payable-1' });
    expect(createArgs().installments.create).toHaveLength(2);
    expect(createArgs().installments.create[0]).toMatchObject({
      installmentNumber: 1,
      originalAmount: 5000,
      originalDueDate: new Date('2026-08-10'),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'accounts_payable.created' }),
    );
  });

  it('preserva o vínculo com o documento original e com a aprovação', async () => {
    const { service, createArgs } = buildService();

    await service.generateFromEntry('entry-1', actor);

    expect(createArgs()).toMatchObject({
      entryId: 'entry-1',
      sourceIntakeDocumentId: 'doc-1',
      approvalRequestId: 'request-1',
      supplierContractId: 'contract-1',
    });
  });

  it('copia o rateio para o título', async () => {
    const { service, createArgs } = buildService();

    await service.generateFromEntry('entry-1', actor);

    expect(createArgs().allocations.create).toHaveLength(1);
    expect(createArgs().allocations.create[0]).toMatchObject({
      costCenterId: 'cc-1',
      percentage: 100,
    });
  });

  it('leva só as retenções confirmadas (critério de aceite 6)', async () => {
    const { service, createArgs } = buildService();

    await service.generateFromEntry('entry-1', actor);

    const taxes = createArgs().withholdings.create.map(
      (item: any) => item.taxType,
    );
    expect(taxes).toEqual(['ISS']);
  });

  it('é idempotente: um lançamento gera um único título', async () => {
    const { service, prisma } = buildService({
      existing: {
        id: 'payable-existente',
        code: 'CP-2026-000007',
        status: 'OPEN',
      },
    });

    const result = await service.generateFromEntry('entry-1', actor);

    expect(result).toMatchObject({ id: 'payable-existente' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignora lançamento a receber', async () => {
    const { service, prisma } = buildService({
      entry: { direction: FinancialEntryDirection.RECEIVABLE },
    });

    await expect(
      service.generateFromEntry('entry-1', actor),
    ).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('não gera nada quando a empresa desligou a geração automática', async () => {
    const { service, prisma } = buildService({
      settings: { autoGenerateOnApproval: false },
    });

    await expect(
      service.generateFromEntry('entry-1', actor),
    ).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('gera mesmo com a geração automática desligada quando alguém pede na mão', async () => {
    const { service, prisma } = buildService({
      settings: { autoGenerateOnApproval: false },
    });

    await service.generateFromEntry('entry-1', actor, { force: true });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('bloqueia o título quando o documento de origem tem pendência aberta', async () => {
    const { service, blocks, createArgs } = buildService({ openIssues: 2 });

    await service.generateFromEntry('entry-1', actor);

    expect(createArgs().blockedAt).toBeInstanceOf(Date);
    expect(blocks[0]).toMatchObject({
      reason: AccountsPayableBlockReason.DOCUMENT_PENDING,
    });
  });

  it('não bloqueia quando a empresa desligou o bloqueio automático', async () => {
    const { service, blocks, createArgs } = buildService({
      openIssues: 2,
      settings: { autoBlockWhenDocumentPending: false },
    });

    await service.generateFromEntry('entry-1', actor);

    expect(createArgs().blockedAt).toBeNull();
    expect(blocks).toHaveLength(0);
  });

  it('recusa gerar título de lançamento sem parcelas', async () => {
    const { service } = buildService({ entry: { installments: [] } });

    await expect(
      service.generateFromEntry('entry-1', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devolve nulo quando o lançamento não existe', async () => {
    const { service } = buildService({ entry: null });

    await expect(service.generateFromEntry('sumiu', actor)).resolves.toBeNull();
  });

  it('numera o código a partir do último usado na empresa', async () => {
    const { service, createArgs } = buildService({
      lastCode: 'CP-2026-000041',
    });

    await service.generateFromEntry('entry-1', actor);

    expect(createArgs().code).toBe(`CP-${new Date().getUTCFullYear()}-000042`);
  });

  it('começa em 1 quando a empresa ainda não tem título no ano', async () => {
    const { service, createArgs } = buildService({ lastCode: null });

    await service.generateFromEntry('entry-1', actor);

    expect(createArgs().code).toBe(`CP-${new Date().getUTCFullYear()}-000001`);
  });

  it('registra a criação no histórico do título', async () => {
    const { service, history } = buildService();

    await service.generateFromEntry('entry-1', actor);

    expect(history[0]).toMatchObject({
      action: 'CREATED',
      justification:
        'Título gerado automaticamente após a aprovação do lançamento.',
    });
  });
});
