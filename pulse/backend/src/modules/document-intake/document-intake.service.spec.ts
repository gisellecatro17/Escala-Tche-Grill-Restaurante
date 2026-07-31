/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- mocks do jest sao `any` por natureza; os testes leem mock.calls propositalmente */
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { RequestUser } from '../../common/types/authenticated-request';
import { BoletoValidationService } from './boleto-validation.service';
import { DocumentIntakeService } from './document-intake.service';

function buildActor(permissions: string[] = []): RequestUser {
  return {
    id: 'user-1',
    isPlatformAdmin: false,
    organizationMemberships: [{ organizationId: 'org-1', permissions }],
    memberships: [{ companyId: 'company-1', permissions }],
  } as unknown as RequestUser;
}

const SETTINGS = {
  id: 'settings-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  maximumFileSize: 20 * 1024 * 1024,
  maximumFilesPerUpload: 20,
  allowedExtensions: ['pdf', 'xml'],
  duplicateValidationEnabled: true,
  minimumConfidence: new Prisma.Decimal(75),
  highConfidenceThreshold: new Prisma.Decimal(95),
  mandatoryReview: true,
  autoForwardHighConfidence: false,
  requireCategory: false,
  requireCostCenter: false,
  requireProject: false,
  blockDuplicates: true,
  blockInvalidBarcode: true,
  reviewDeadlineHours: 24,
  retentionDays: 1825,
  allowFileReplacement: true,
  allowDraftDeletion: true,
  defaultAssignedUserId: null,
};

const BASE_DOCUMENT = {
  id: 'doc-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  documentType: 'BOLETO',
  documentDirection: 'PAYABLE',
  processingStatus: 'PENDING_REVIEW',
  reviewStatus: 'REVIEWED',
  duplicateStatus: 'NO_DUPLICATE',
  supplierId: 'supplier-1',
  customerId: null,
  grossAmount: new Prisma.Decimal(2450),
  discountAmount: null,
  interestAmount: null,
  penaltyAmount: null,
  withholdingAmount: null,
  netAmount: new Prisma.Decimal(2450),
  dueDate: new Date('2026-08-10T00:00:00Z'),
  confidence: new Prisma.Decimal(98),
  categoryId: 'category-1',
  costCenterId: null,
  projectId: null,
};

describe('DocumentIntakeService', () => {
  function buildService(
    options: {
      document?: Record<string, unknown>;
      settings?: Record<string, unknown>;
      blockingIssues?: { id: string; description: string }[];
    } = {},
  ) {
    const document = { ...BASE_DOCUMENT, ...options.document };
    const settings = { ...SETTINGS, ...options.settings };

    const prisma = {
      intakeDocument: {
        findFirstOrThrow: jest.fn().mockResolvedValue(document),
        findFirst: jest.fn().mockResolvedValue(document),
        update: jest.fn().mockResolvedValue(document),
        create: jest.fn().mockResolvedValue(document),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      intakeDocumentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      intakeDocumentExtractedField: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      intakeDocumentRelation: { create: jest.fn().mockResolvedValue({}) },
      intakeDocumentAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      documentIntakeSettings: {
        findUnique: jest.fn().mockResolvedValue(settings),
        create: jest.fn().mockResolvedValue(settings),
        update: jest.fn().mockResolvedValue(settings),
      },
      company: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'company-2', legalName: 'Filial' }),
      },
      $transaction: jest.fn((operations: unknown[]) =>
        Promise.resolve(operations),
      ),
    };

    const issues = {
      raise: jest.fn().mockResolvedValue({}),
      resolveAutomatically: jest.fn().mockResolvedValue({ resolved: 0 }),
      findBlocking: jest.fn().mockResolvedValue(options.blockingIssues ?? []),
      countBySeverity: jest
        .fn()
        .mockResolvedValue({ BLOCKING: 0, WARNING: 0, INFORMATIONAL: 0 }),
    };

    const pipeline = {
      startPipeline: jest.fn().mockResolvedValue({}),
      cancelPendingJobs: jest.fn().mockResolvedValue({ cancelled: 0 }),
      enqueueNext: jest.fn().mockResolvedValue({}),
      queueStatus: jest.fn().mockResolvedValue({}),
      averageProcessingSeconds: jest.fn().mockResolvedValue(null),
    };

    const service = new DocumentIntakeService(
      prisma as any,
      { log: jest.fn() } as any,
      {
        uploadPrivateDocument: jest
          .fn()
          .mockResolvedValue({ storagePath: 'p', bucket: 'b' }),
        createSignedUrl: jest.fn().mockResolvedValue({
          url: 'https://signed',
          expiresAt: new Date(),
        }),
        downloadPrivateDocument: jest.fn().mockResolvedValue(Buffer.from('')),
      } as any,
      { validate: jest.fn() } as any,
      { extractFields: jest.fn() } as any,
      new BoletoValidationService(),
      {
        identifyCompany: jest.fn(),
        identifySupplier: jest.fn(),
        identifyCustomer: jest.fn(),
      } as any,
      { check: jest.fn().mockResolvedValue({}) } as any,
      issues as any,
      pipeline as any,
    );

    return { service, prisma, issues, pipeline };
  }

  describe('encaminhamento (seção 47)', () => {
    it('encaminha quando tudo está resolvido', async () => {
      const { service, prisma } = buildService();

      await service.forward('doc-1', {}, buildActor());

      const operations = prisma.$transaction.mock.calls[0]?.[0];
      expect(operations).toHaveLength(2);
    });

    it('recusa quando a empresa não foi identificada', async () => {
      const { service } = buildService({ document: { companyId: null } });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /empresa não foi identificada/i,
      );
    });

    it('recusa quando o valor não foi informado', async () => {
      const { service } = buildService({ document: { grossAmount: null } });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /valor do documento não foi informado/i,
      );
    });

    it('recusa quando o tipo do documento não foi definido', async () => {
      const { service } = buildService({ document: { documentType: 'OTHER' } });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /tipo do documento/i,
      );
    });

    it('exige fornecedor em documento de despesa', async () => {
      const { service } = buildService({
        document: { documentDirection: 'PAYABLE', supplierId: null },
      });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /Selecione o fornecedor/i,
      );
    });

    it('exige cliente em documento de receita, e não fornecedor', async () => {
      const { service } = buildService({
        document: {
          documentDirection: 'RECEIVABLE',
          supplierId: null,
          customerId: null,
        },
      });

      // A mensagem deve pedir cliente, não fornecedor.
      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /Selecione o cliente/i,
      );
    });

    it('bloqueia quando há pendência bloqueante aberta', async () => {
      const { service } = buildService({
        blockingIssues: [
          { id: 'issue-1', description: 'A empresa não foi identificada.' },
        ],
      });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /pendências bloqueantes/i,
      );
    });

    it('bloqueia duplicidade confirmada quando o parâmetro exige', async () => {
      const { service } = buildService({
        document: { duplicateStatus: 'CONFIRMED_DUPLICATE' },
      });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /Resolva a duplicidade/i,
      );
    });

    it('permite encaminhar com duplicidade quando o bloqueio está desligado', async () => {
      const { service, prisma } = buildService({
        document: { duplicateStatus: 'HIGH_PROBABILITY' },
        settings: { blockDuplicates: false },
      });

      await service.forward('doc-1', {}, buildActor());

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('exige revisão salva quando a empresa marca revisão obrigatória', async () => {
      const { service } = buildService({
        document: { reviewStatus: 'NOT_REVIEWED' },
        settings: { mandatoryReview: true },
      });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /revisão é obrigatória/i,
      );
    });

    it('acumula todos os problemas em uma mensagem, em vez de um por vez', async () => {
      const { service } = buildService({
        document: { companyId: null, grossAmount: null, documentType: 'OTHER' },
      });

      await expect(service.forward('doc-1', {}, buildActor())).rejects.toThrow(
        /empresa não foi identificada.*valor do documento/is,
      );
    });

    it('registra na auditoria que nenhuma obrigação financeira foi criada', async () => {
      const audit = { log: jest.fn() };
      const { service, prisma } = buildService();
      // Substitui o serviço de auditoria por um que possa ser inspecionado.
      (service as unknown as { audit: unknown }).audit = audit;

      await service.forward('doc-1', {}, buildActor());

      const entry = audit.log.mock.calls[0][0] as {
        newValue: { note: string };
      };
      expect(entry.newValue.note).toContain(
        'Nenhuma obrigação financeira criada',
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('conferência de valores (seção 38)', () => {
    const { service } = buildService();

    it('confere bruto − desconto − retenção + juros + multa', () => {
      const result = service.checkAmounts({
        grossAmount: new Prisma.Decimal(10_000),
        discountAmount: new Prisma.Decimal(500),
        withholdingAmount: new Prisma.Decimal(150),
        interestAmount: new Prisma.Decimal(80),
        penaltyAmount: new Prisma.Decimal(20),
        netAmount: new Prisma.Decimal(9450),
      });

      expect(result.calculated).toBe(9450);
      expect(result.balanced).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('aponta a diferença quando os valores não fecham', () => {
      const result = service.checkAmounts({
        grossAmount: new Prisma.Decimal(10_000),
        discountAmount: new Prisma.Decimal(400),
        withholdingAmount: new Prisma.Decimal(150),
        interestAmount: null,
        penaltyAmount: null,
        netAmount: new Prisma.Decimal(9500),
      });

      expect(result.calculated).toBe(9450);
      expect(result.informed).toBe(9500);
      expect(result.difference).toBe(50);
      expect(result.balanced).toBe(false);
    });

    it('não acusa divergência quando o líquido não foi informado', () => {
      // Campo em branco é campo em branco, não divergência.
      const result = service.checkAmounts({
        grossAmount: new Prisma.Decimal(2450),
        discountAmount: null,
        withholdingAmount: null,
        interestAmount: null,
        penaltyAmount: null,
        netAmount: null,
      });

      expect(result.balanced).toBe(true);
      expect(result.informed).toBeNull();
    });

    it('tolera diferença de centavos por arredondamento', () => {
      const result = service.checkAmounts({
        grossAmount: new Prisma.Decimal('100.005'),
        discountAmount: null,
        withholdingAmount: null,
        interestAmount: null,
        penaltyAmount: null,
        netAmount: new Prisma.Decimal('100.00'),
      });

      expect(result.balanced).toBe(true);
    });
  });

  describe('divisão em parcelas (seção 40)', () => {
    it('recusa menos de duas parcelas', async () => {
      const { service } = buildService();

      await expect(
        service.split(
          'doc-1',
          { installments: [{ amount: 2450, dueDate: '2026-08-10' }] },
          buildActor(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('recusa quando a soma das parcelas não fecha o total', async () => {
      const { service } = buildService();

      await expect(
        service.split(
          'doc-1',
          {
            installments: [
              { amount: 1000, dueDate: '2026-08-10' },
              { amount: 1000, dueDate: '2026-09-10' },
            ],
          },
          buildActor(),
        ),
      ).rejects.toThrow(/não corresponde ao valor do documento/i);
    });

    it('cria as parcelas e arquiva o pai, sem excluir nada', async () => {
      const { service, prisma } = buildService();

      await service.split(
        'doc-1',
        {
          installments: [
            { amount: 1225, dueDate: '2026-08-10' },
            { amount: 1225, dueDate: '2026-09-10' },
          ],
        },
        buildActor(),
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      // O pai é arquivado, não apagado: o arquivo original continua sendo o dele.
      const update = prisma.intakeDocument.update.mock.calls.at(-1)?.[0] as {
        data: { processingStatus: string };
      };
      expect(update.data.processingStatus).toBe('ARCHIVED');
      expect(prisma.intakeDocumentRelation.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('exclusão (seção 78)', () => {
    it('recusa excluir documento que já entrou no fluxo', async () => {
      const { service } = buildService({
        document: { processingStatus: 'READY_FOR_PROCESSING' },
      });

      await expect(service.remove('doc-1', buildActor())).rejects.toThrow(
        /já entrou no fluxo/i,
      );
    });

    it('permite excluir rascunho, de forma lógica', async () => {
      const { service, prisma } = buildService({
        document: { processingStatus: 'STORED' },
      });

      await service.remove('doc-1', buildActor());

      const update = prisma.intakeDocument.update.mock.calls[0]?.[0] as {
        data: { deletedAt: Date };
      };
      expect(update.data.deletedAt).toBeInstanceOf(Date);
    });

    it('respeita o parâmetro que desabilita exclusão de rascunho', async () => {
      const { service } = buildService({
        document: { processingStatus: 'STORED' },
        settings: { allowDraftDeletion: false },
      });

      await expect(service.remove('doc-1', buildActor())).rejects.toThrow(
        /desabilitada/i,
      );
    });
  });

  describe('reabertura', () => {
    it('só reabre documento rejeitado ou arquivado', async () => {
      const { service } = buildService({
        document: { processingStatus: 'PENDING_REVIEW' },
      });

      await expect(
        service.reopen('doc-1', 'Motivo', buildActor()),
      ).rejects.toThrow(/rejeitados ou arquivados/i);
    });

    it('reabre documento rejeitado', async () => {
      const { service, prisma } = buildService({
        document: { processingStatus: 'REJECTED' },
      });

      await service.reopen('doc-1', 'Documento era válido.', buildActor());

      const update = prisma.intakeDocument.update.mock.calls[0]?.[0] as {
        data: { processingStatus: string; rejectedAt: null };
      };
      expect(update.data.processingStatus).toBe('PENDING_REVIEW');
      expect(update.data.rejectedAt).toBeNull();
    });
  });

  describe('relacionamento entre documentos (seção 41)', () => {
    it('recusa relacionar um documento a si mesmo', async () => {
      const { service } = buildService();

      await expect(
        service.relate(
          'doc-1',
          { targetDocumentId: 'doc-1', relationType: 'RELATED' },
          buildActor(),
        ),
      ).rejects.toThrow(/a si mesmo/i);
    });
  });

  describe('mascaramento (seção 81)', () => {
    const sensitive = {
      id: 'doc-1',
      issuerDocument: '15139629000194',
      recipientDocument: '98765432000188',
      digitableLine: '00190500954014481606906809350314337370000000100',
      normalizedDigitableLine:
        '00190500954014481606906809350314337370000000100',
      barcode: '00191153400002450007777777777777777777777777',
      normalizedBarcode: '00191153400002450007777777777777777777777777',
      pixKey: 'financeiro@empresa.com.br',
      extractedText: 'CNPJ 15.139.629/0001-94 linha digitável completa aqui',
    };

    function applyMasking(actor: RequestUser) {
      const { service } = buildService();
      // O mascaramento é privado de propósito: exercitamos pelo caminho público.
      return (
        service as unknown as {
          applyMasking: (
            document: typeof sensitive,
            actor: RequestUser,
          ) => typeof sensitive;
        }
      ).applyMasking(sensitive, actor);
    }

    it('mascara CNPJ, código, linha digitável e chave PIX sem a permissão', () => {
      const masked = applyMasking(buildActor(['document_intake.view']));

      expect(masked.issuerDocument).toBe('**.***.***/****-**');
      expect(masked.recipientDocument).toBe('**.***.***/****-**');
      expect(masked.pixKey).toBe('fi********@empresa.com.br');
      expect(masked.digitableLine).toMatch(/^\*+\d{6}$/);
      expect(masked.barcode).toMatch(/^\*+\d{6}$/);
    });

    it('remove o texto extraído inteiro, que carrega tudo isso junto', () => {
      const masked = applyMasking(buildActor(['document_intake.view']));

      expect(masked.extractedText).toBeNull();
    });

    it('não deixa nenhum dígito do meio do código escapar', () => {
      const masked = applyMasking(buildActor(['document_intake.view']));
      const visible = masked.digitableLine.replace(/\*/g, '');

      // Só os seis últimos dígitos permanecem — o suficiente para reconhecer, não para pagar.
      expect(visible).toHaveLength(6);
      expect(sensitive.digitableLine.endsWith(visible)).toBe(true);
    });

    it('devolve os valores completos com a permissão de dados sensíveis', () => {
      const masked = applyMasking(
        buildActor([
          'document_intake.view',
          'document_intake.view_sensitive_data',
        ]),
      );

      expect(masked.issuerDocument).toBe('15139629000194');
      expect(masked.digitableLine).toBe(sensitive.digitableLine);
      expect(masked.extractedText).toBe(sensitive.extractedText);
    });

    it('não inventa valor quando o campo está vazio', () => {
      const { service } = buildService();
      const masked = (
        service as unknown as {
          applyMasking: (
            document: Record<string, unknown>,
            actor: RequestUser,
          ) => Record<string, unknown>;
        }
      ).applyMasking(
        { id: 'doc-1', issuerDocument: null, digitableLine: null },
        buildActor(['document_intake.view']),
      );

      expect(masked.issuerDocument).toBeNull();
      expect(masked.digitableLine).toBeNull();
    });
  });

  describe('ação em lote (seção 48)', () => {
    it('confere a permissão documento por documento', async () => {
      const { service } = buildService();
      const action = jest.fn().mockResolvedValue({});

      // O ator tem permissão em company-1, e todos os documentos são de company-1.
      const result = await service.runBatch(
        ['doc-1', 'doc-2'],
        buildActor(['document_intake.forward']),
        'document_intake.forward',
        action,
      );

      expect(result.succeeded).toBe(2);
      expect(action).toHaveBeenCalledTimes(2);
    });

    it('a falha de um documento não desfaz os outros', async () => {
      const { service } = buildService();
      const action = jest
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Pendência bloqueante.'));

      const result = await service.runBatch(
        ['doc-1', 'doc-2'],
        buildActor(['document_intake.forward']),
        'document_intake.forward',
        action,
      );

      expect(result.succeeded).toBe(1);
      expect(result.failed).toEqual([
        { documentId: 'doc-2', reason: 'Pendência bloqueante.' },
      ]);
      expect(result.note).toContain('não foram alterados');
    });

    it('recusa documento de empresa a que o usuário não tem acesso', async () => {
      const { service } = buildService();
      const action = jest.fn().mockResolvedValue({});

      // Permissão em outra empresa: o lote não pode ser atalho.
      const foreignActor = {
        id: 'user-2',
        isPlatformAdmin: false,
        organizationMemberships: [],
        memberships: [
          { companyId: 'company-9', permissions: ['document_intake.forward'] },
        ],
      } as unknown as RequestUser;

      const result = await service.runBatch(
        ['doc-1'],
        foreignActor,
        'document_intake.forward',
        action,
      );

      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(action).not.toHaveBeenCalled();
    });
  });
});
