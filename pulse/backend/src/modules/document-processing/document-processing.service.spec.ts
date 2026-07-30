/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method -- mocks do jest sao `any` por natureza */
import { BadRequestException, ConflictException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { AllocationApplicationService } from './allocation-application.service';
import { DocumentProcessingService } from './document-processing.service';
import { EntryClassificationService } from './entry-classification.service';
import { InstallmentGeneratorService } from './installment-generator.service';
import { WithholdingCalculatorService } from './withholding-calculator.service';

const ACTOR = { id: 'user-1' } as RequestUser;

function buildDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    processingStatus: 'READY_FOR_PROCESSING',
    documentDirection: 'PAYABLE',
    supplierId: 'supplier-1',
    customerId: null,
    documentNumber: '4471',
    documentSeries: '1',
    accessKey: null,
    issueDate: new Date(Date.UTC(2026, 6, 24)),
    competenceDate: null,
    dueDate: new Date(Date.UTC(2026, 7, 23)),
    grossAmount: 8900,
    discountAmount: null,
    interestAmount: null,
    penaltyAmount: null,
    currencyCode: 'BRL',
    description: 'Compra de carnes',
    displayName: null,
    barcode: null,
    digitableLine: null,
    pixKey: null,
    financialAccountId: null,
    paymentMethodId: null,
    receiptMethodId: null,
    categoryId: 'cat-1',
    subcategoryId: null,
    accountPlanId: null,
    costCenterId: 'cc-1',
    resultCenterId: null,
    projectId: null,
    businessUnitId: null,
    financialNatureId: null,
    ...overrides,
  };
}

function buildSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'settings-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    autoClassificationEnabled: true,
    autoAllocationEnabled: true,
    autoWithholdingEnabled: true,
    autoOpenWhenComplete: false,
    approvalThresholdAmount: null,
    requireCategory: false,
    requireCostCenter: false,
    requireProject: false,
    blockInstallmentMismatch: true,
    defaultPaymentTermDays: 30,
    ...overrides,
  };
}

function buildService(
  options: {
    document?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    existingEntry?: unknown;
    supplierLink?: unknown;
    withholdings?: unknown[];
    allocations?: unknown[];
  } = {},
) {
  const document = buildDocument(options.document);
  const settings = buildSettings(options.settings);

  const created = {
    id: 'entry-1',
    direction: 'PAYABLE',
    status: 'DRAFT',
    netAmount: 8900,
    installments: [{ id: 'inst-1' }],
  };

  const tx = {
    financialEntry: { create: jest.fn().mockResolvedValue(created) },
    intakeDocument: { update: jest.fn().mockResolvedValue({}) },
    intakeDocumentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    intakeDocument: {
      findFirstOrThrow: jest.fn().mockResolvedValue(document),
    },
    financialEntry: {
      findUnique: jest.fn().mockResolvedValue(options.existingEntry ?? null),
    },
    documentProcessingSettings: {
      findUnique: jest.fn().mockResolvedValue(settings),
      create: jest.fn().mockResolvedValue(settings),
      update: jest.fn().mockResolvedValue(settings),
    },
    supplierCompanyLink: {
      findFirst: jest.fn().mockResolvedValue(options.supplierLink ?? null),
    },
    customerCompanyLink: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((callback: (client: unknown) => unknown) =>
      typeof callback === 'function' ? callback(tx) : Promise.resolve([]),
    ),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const classification = {
    resolve: jest.fn().mockResolvedValue({
      values: { categoryId: 'cat-1', costCenterId: 'cc-1' },
      sources: { categoryId: 'DOCUMENT', costCenterId: 'DOCUMENT' },
      appliedClassificationRuleId: null,
      appliedAllocationRuleId: null,
      description: 'Compra de carnes',
      history: null,
    }),
  } as unknown as EntryClassificationService;

  const withholdings = {
    calculate: jest.fn().mockResolvedValue(options.withholdings ?? []),
  } as unknown as WithholdingCalculatorService;

  const allocations = {
    materialize: jest.fn().mockResolvedValue(options.allocations ?? []),
  } as unknown as AllocationApplicationService;

  const service = new DocumentProcessingService(
    prisma as never,
    audit as never,
    classification,
    withholdings,
    new InstallmentGeneratorService(),
    allocations,
  );

  return { service, prisma, tx, audit, classification, withholdings };
}

describe('Motor do processamento', () => {
  it('recusa documento que a entrada não encaminhou', async () => {
    const { service } = buildService({
      document: { processingStatus: 'PENDING_REVIEW' },
    });

    await expect(service.process('doc-1', {}, ACTOR)).rejects.toThrow(
      'Só documentos encaminhados',
    );
  });

  it('recusa documento sem empresa', async () => {
    const { service } = buildService({ document: { companyId: null } });

    await expect(service.process('doc-1', {}, ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recusa documento sem valor', async () => {
    const { service } = buildService({ document: { grossAmount: null } });

    await expect(service.process('doc-1', {}, ACTOR)).rejects.toThrow(
      'não tem valor definido',
    );
  });

  it('recusa documento sem direção definida em vez de escolher uma', async () => {
    const { service } = buildService({
      document: { documentDirection: 'UNKNOWN' },
    });

    await expect(service.process('doc-1', {}, ACTOR)).rejects.toThrow(
      'a pagar ou a receber',
    );
  });

  it('recusa processar duas vezes o mesmo documento', async () => {
    const { service } = buildService({
      existingEntry: { id: 'entry-ja-existe' },
    });

    await expect(service.process('doc-1', {}, ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('gera o lançamento com uma parcela no vencimento do documento', async () => {
    const { service, tx } = buildService();

    await service.process('doc-1', {}, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;
    const parcelas = data.installments.create as {
      netAmount: number;
      dueDate: Date;
    }[];

    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].netAmount).toBe(8900);
    expect(parcelas[0].dueDate.toISOString().slice(0, 10)).toBe('2026-08-23');
  });

  it('divide em parcelas quando a tela pede', async () => {
    const { service, tx } = buildService();

    await service.process('doc-1', { installmentCount: 3 }, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;
    const parcelas = data.installments.create as { netAmount: number }[];

    expect(parcelas).toHaveLength(3);
    expect(parcelas.reduce((sum, item) => sum + item.netAmount, 0)).toBe(8900);
  });

  it('a retenção sugerida não desconta o valor líquido', async () => {
    const { service, tx } = buildService({
      withholdings: [
        {
          supplierTaxWithholdingId: 'wh-origem',
          taxType: 'IRRF',
          calculationBase: 8900,
          rate: 1.5,
          amount: 133.5,
          minimumAmount: null,
        },
      ],
    });

    await service.process('doc-1', {}, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;

    expect(data.netAmount).toBe(8900);
    expect(data.withholdingAmount).toBe(0);
    expect(data.withholdings.create[0].status).toBe('SUGGESTED');
  });

  it('marca conferência quando o valor supera o limite dos parâmetros', async () => {
    const { service, tx } = buildService({
      settings: { approvalThresholdAmount: 5000 },
    });

    await service.process('doc-1', {}, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;

    expect(data.requiresApproval).toBe(true);
    expect(data.status).toBe('PENDING_APPROVAL');
  });

  it('usa o limite do vínculo do fornecedor quando a empresa não tem limite próprio', async () => {
    const { service, tx } = buildService({
      supplierLink: {
        id: 'link-1',
        maximumAmountWithoutApproval: 1000,
        paymentTermDays: null,
        paymentTermFixedDueDay: null,
      },
    });

    await service.process('doc-1', {}, ACTOR);

    expect(
      tx.financialEntry.create.mock.calls[0][0].data.requiresApproval,
    ).toBe(true);
  });

  it('não abre sozinho quando há retenção aguardando decisão, mesmo com abertura automática', async () => {
    const { service, tx } = buildService({
      settings: { autoOpenWhenComplete: true },
      withholdings: [
        {
          supplierTaxWithholdingId: 'wh-1',
          taxType: 'ISS',
          calculationBase: 8900,
          rate: 5,
          amount: 445,
          minimumAmount: null,
        },
      ],
    });

    await service.process('doc-1', {}, ACTOR);

    expect(tx.financialEntry.create.mock.calls[0][0].data.status).toBe('DRAFT');
  });

  it('abre sozinho quando a empresa pediu e não há nada pendente', async () => {
    const { service, tx } = buildService({
      settings: { autoOpenWhenComplete: true },
    });

    await service.process('doc-1', {}, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;
    expect(data.status).toBe('OPEN');
    expect(data.openedAt).toBeInstanceOf(Date);
  });

  it('exige categoria quando os parâmetros da empresa exigem', async () => {
    const { service, classification } = buildService({
      settings: { requireCategory: true },
    });

    (classification.resolve as jest.Mock).mockResolvedValue({
      values: {},
      sources: {},
      appliedClassificationRuleId: null,
      appliedAllocationRuleId: null,
      description: null,
      history: null,
    });

    await expect(service.process('doc-1', {}, ACTOR)).rejects.toThrow(
      'categoria',
    );
  });

  it('a classificação escolhida na tela vence a automática', async () => {
    const { service, tx } = buildService();

    await service.process(
      'doc-1',
      { classification: { categoryId: 'escolhida-na-tela' } },
      ACTOR,
    );

    const data = tx.financialEntry.create.mock.calls[0][0].data;

    expect(data.categoryId).toBe('escolhida-na-tela');
    expect(data.classificationSources.categoryId).toBe('MANUAL');
  });

  it('marca o documento como processado e registra o histórico', async () => {
    const { service, tx } = buildService();

    await service.process('doc-1', {}, ACTOR);

    expect(tx.intakeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processingStatus: 'PROCESSED' }),
      }),
    );
    expect(tx.intakeDocumentStatusHistory.create).toHaveBeenCalled();
  });

  it('registra na auditoria que nenhum pagamento foi autorizado', async () => {
    const { service, audit } = buildService();

    await service.process('doc-1', {}, ACTOR);

    const logged = audit.log.mock.calls[0][0];

    expect(logged.action).toBe('PROCESS_INTAKE_DOCUMENT');
    expect(logged.newValue.note).toContain('Nenhum pagamento');
  });

  it('a prévia não grava nada', async () => {
    const { service, tx, prisma } = buildService();

    const preview = await service.preview('doc-1');

    expect(preview.installments).toHaveLength(1);
    expect(tx.financialEntry.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a prévia mostra a retenção sugerida e o total separadamente', async () => {
    const { service } = buildService({
      withholdings: [
        {
          supplierTaxWithholdingId: 'wh-1',
          taxType: 'IRRF',
          calculationBase: 8900,
          rate: 1.5,
          amount: 133.5,
          minimumAmount: null,
        },
      ],
    });

    const preview = await service.preview('doc-1');

    expect(preview.suggestedWithholdingTotal).toBe(133.5);
    expect(preview.amounts.net).toBe(8900);
  });

  it('não calcula retenção quando a empresa desligou o cálculo', async () => {
    const { service, withholdings } = buildService({
      settings: { autoWithholdingEnabled: false },
    });

    await service.process('doc-1', {}, ACTOR);

    expect(withholdings.calculate).not.toHaveBeenCalled();
  });

  it('usa o prazo padrão da empresa quando o documento não tem vencimento', async () => {
    const { service, tx } = buildService({
      document: { dueDate: null },
      settings: { defaultPaymentTermDays: 15 },
    });

    await service.process('doc-1', {}, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;
    const due = data.installments.create[0].dueDate as Date;
    const days = Math.round((due.getTime() - Date.now()) / 86_400_000);

    expect(days).toBeGreaterThanOrEqual(14);
    expect(days).toBeLessThanOrEqual(15);
  });

  it('copia o código de cobrança do documento para a parcela única', async () => {
    const { service, tx } = buildService({
      document: { digitableLine: '00190000090123456789' },
    });

    await service.process('doc-1', {}, ACTOR);

    const data = tx.financialEntry.create.mock.calls[0][0].data;
    expect(data.installments.create[0].digitableLine).toBe(
      '00190000090123456789',
    );
  });
});
