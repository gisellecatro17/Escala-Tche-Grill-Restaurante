/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment -- mocks do jest sao `any` por natureza */
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { BoletoValidationService } from './boleto-validation.service';
import { DocumentIntakeController } from './document-intake.controller';
import { IntakeIssuesService } from './intake-issues.service';

/**
 * Isolamento e permissão da seção 78, atacando o **controller**: é ali que a permissão é
 * conferida, e é ali que um erro deixaria documento de uma empresa acessível a quem só tem
 * acesso a outra.
 */
function buildUser(options: {
  organizationId?: string;
  companyId?: string;
  companyIds?: string[];
  permissions?: string[];
  isPlatformAdmin?: boolean;
}): RequestUser {
  const permissions = options.permissions ?? [];
  const companyIds =
    options.companyIds ?? (options.companyId ? [options.companyId] : []);

  return {
    id: 'user-1',
    isPlatformAdmin: options.isPlatformAdmin ?? false,
    organizationMemberships: options.organizationId
      ? [{ organizationId: options.organizationId, permissions }]
      : [],
    memberships: companyIds.map((companyId) => ({ companyId, permissions })),
  } as unknown as RequestUser;
}

describe('Entrada de documentos — isolamento entre empresas e organizações', () => {
  function buildController(
    scope: {
      organizationId?: string;
      companyId?: string | null;
      processingStatus?: string;
    } = {},
  ) {
    const intake = {
      scopeOf: jest.fn().mockResolvedValue({
        id: 'doc-1',
        organizationId: scope.organizationId ?? 'org-1',
        companyId:
          scope.companyId === undefined ? 'company-1' : scope.companyId,
        processingStatus: scope.processingStatus ?? 'PENDING_REVIEW',
        reviewStatus: 'NOT_REVIEWED',
        storagePath: 'intake/org-1/company-1/doc.pdf',
      }),
      findOne: jest.fn().mockResolvedValue({}),
      findAll: jest.fn().mockResolvedValue({}),
      findOverview: jest.fn().mockResolvedValue({}),
      findSettings: jest.fn().mockResolvedValue({}),
      updateSettings: jest.fn().mockResolvedValue({}),
      receiveUpload: jest
        .fn()
        .mockResolvedValue({ document: {}, validation: { warnings: [] } }),
      receiveBatch: jest.fn().mockResolvedValue({}),
      createManualEntry: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      review: jest.fn().mockResolvedValue({}),
      forward: jest.fn().mockResolvedValue({}),
      reject: jest.fn().mockResolvedValue({}),
      reopen: jest.fn().mockResolvedValue({}),
      archive: jest.fn().mockResolvedValue({}),
      assign: jest.fn().mockResolvedValue({}),
      changeCompany: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({}),
      split: jest.fn().mockResolvedValue({}),
      relate: jest.fn().mockResolvedValue({}),
      findRelations: jest.fn().mockResolvedValue([]),
      removeRelation: jest.fn().mockResolvedValue({}),
      createAccessUrl: jest.fn().mockResolvedValue({ url: 'https://signed' }),
      findExtractedFields: jest.fn().mockResolvedValue([]),
      updateExtractedField: jest.fn().mockResolvedValue({}),
      extractDocument: jest.fn().mockResolvedValue({}),
      classifyDocument: jest.fn().mockResolvedValue({}),
      identifyParties: jest.fn().mockResolvedValue({}),
      runBatch: jest.fn().mockResolvedValue({}),
    };

    const duplicates = {
      findMatches: jest.fn().mockResolvedValue([]),
      check: jest.fn().mockResolvedValue({}),
      compare: jest.fn().mockResolvedValue({}),
      confirm: jest.fn().mockResolvedValue({}),
      dismiss: jest.fn().mockResolvedValue({}),
      replace: jest.fn().mockResolvedValue({}),
    };

    const issues = {
      findAll: jest.fn().mockResolvedValue([]),
      raise: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      resolve: jest.fn().mockResolvedValue({}),
    };

    const pipeline = {
      startPipeline: jest.fn().mockResolvedValue({}),
      reprocess: jest.fn().mockResolvedValue({}),
      cancelPendingJobs: jest.fn().mockResolvedValue({}),
      findJobs: jest.fn().mockResolvedValue([]),
      queueStatus: jest.fn().mockResolvedValue({}),
    };

    return {
      controller: new DocumentIntakeController(
        intake as any,
        duplicates as any,
        issues as any,
        pipeline as any,
        new BoletoValidationService(),
      ),
      intake,
      duplicates,
      issues,
      pipeline,
    };
  }

  describe('leitura', () => {
    it('permite ver o documento da própria empresa', async () => {
      const { controller, intake } = buildController({
        companyId: 'company-1',
      });
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.view'],
      });

      await controller.findOne('doc-1', actor);

      expect(intake.findOne).toHaveBeenCalledWith('doc-1', actor);
    });

    it('recusa quando o documento pertence a outra empresa', async () => {
      // O usuário tem a permissão — mas em company-1, e o documento é de company-2.
      const { controller, intake } = buildController({
        companyId: 'company-2',
      });
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.view'],
      });

      await expect(controller.findOne('doc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(intake.findOne).not.toHaveBeenCalled();
    });

    it('recusa a listagem de outra organização', () => {
      const { controller, intake } = buildController();
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['document_intake.view'],
      });

      expect(() => controller.findAll('org-2', {} as any, actor)).toThrow(
        ForbiddenException,
      );
      expect(intake.findAll).not.toHaveBeenCalled();
    });

    it('resolve o escopo pelo registro, nunca pelo que o cliente enviou', async () => {
      const { controller, intake } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.view'],
      });

      await controller.findOne('doc-1', actor);

      expect(intake.scopeOf).toHaveBeenCalledWith('doc-1');
    });

    it('libera o administrador da plataforma', async () => {
      const { controller, intake } = buildController({
        companyId: 'company-9',
      });

      await controller.findOne('doc-1', buildUser({ isPlatformAdmin: true }));

      expect(intake.findOne).toHaveBeenCalled();
    });
  });

  describe('documento sem empresa identificada', () => {
    it('valida pela organização, para que a fila não fique inacessível', async () => {
      // Sem empresa não há empresa contra a qual validar; exigi-la travaria a fila
      // "Empresa não identificada" para todos.
      const { controller, intake } = buildController({ companyId: null });
      const actor = buildUser({
        organizationId: 'org-1',
        permissions: ['document_intake.view'],
      });

      await controller.findOne('doc-1', actor);

      expect(intake.findOne).toHaveBeenCalled();
    });

    it('recusa quem não tem a permissão na organização', async () => {
      const { controller, intake } = buildController({ companyId: null });
      const actor = buildUser({ organizationId: 'org-1', permissions: [] });

      await expect(controller.findOne('doc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(intake.findOne).not.toHaveBeenCalled();
    });
  });

  describe('envio', () => {
    it('recusa enviar para empresa a que o usuário não tem acesso', async () => {
      const { controller, intake } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.upload'],
      });

      await expect(
        controller.upload(
          {} as any,
          { organizationId: 'org-1', companyId: 'company-2' } as any,
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(intake.receiveUpload).not.toHaveBeenCalled();
    });

    it('exige permissão própria para lote, captura e digitação', async () => {
      const { controller } = buildController();
      // Quem só pode fazer upload unitário não pode enviar lote nem digitar.
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.upload'],
      });
      const dto = { organizationId: 'org-1', companyId: 'company-1' } as any;

      await expect(controller.uploadBatch([], dto, actor)).rejects.toThrow(
        ForbiddenException,
      );
      // `capture` e `manualEntry` validam antes de retornar a promessa, então lançam já na
      // chamada — daí a diferença de forma entre as asserções.
      expect(() => controller.capture({} as any, dto, actor)).toThrow(
        ForbiddenException,
      );
      expect(() => controller.manualEntry(dto, actor)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('permissões distintas por ação', () => {
    it('quem revisa não necessariamente encaminha, rejeita ou exclui', async () => {
      const { controller } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.review'],
      });

      await expect(controller.forward('doc-1', {}, actor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        controller.reject('doc-1', { rejectionReason: 'OTHER' } as any, actor),
      ).rejects.toThrow(ForbiddenException);
      await expect(controller.remove('doc-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('exige permissão dedicada para baixar o arquivo', async () => {
      const { controller, intake } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.view'],
      });

      await expect(
        controller.accessUrl('doc-1', 'DOWNLOAD', actor),
      ).rejects.toThrow(ForbiddenException);
      expect(intake.createAccessUrl).not.toHaveBeenCalled();
    });

    it('permite visualizar com a permissão de leitura', async () => {
      const { controller, intake } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.view'],
      });

      await controller.accessUrl('doc-1', 'VIEW', actor);

      expect(intake.createAccessUrl).toHaveBeenCalledWith(
        'doc-1',
        actor,
        'VIEW',
      );
    });

    it('liberar duplicidade exige a permissão de exceção, não a de gestão', async () => {
      const { controller, duplicates } = buildController();
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.manage_duplicates'],
      });

      await expect(
        controller.dismissDuplicate('doc-1', 'match-1', {}, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(duplicates.dismiss).not.toHaveBeenCalled();
    });
  });

  describe('troca de empresa', () => {
    it('exige permissão nas duas empresas: origem e destino', async () => {
      // Mover o documento move a despesa de um CNPJ para outro.
      const { controller, intake } = buildController({
        companyId: 'company-1',
      });
      const actor = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.change_company'],
      });

      await expect(
        controller.changeCompany(
          'doc-1',
          { companyId: 'company-2', reason: 'Documento é da filial.' },
          actor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(intake.changeCompany).not.toHaveBeenCalled();
    });

    it('permite quando o usuário tem acesso às duas', async () => {
      const { controller, intake } = buildController({
        companyId: 'company-1',
      });
      const actor = buildUser({
        companyIds: ['company-1', 'company-2'],
        permissions: ['document_intake.change_company'],
      });

      await controller.changeCompany(
        'doc-1',
        { companyId: 'company-2', reason: 'Documento é da filial.' },
        actor,
      );

      expect(intake.changeCompany).toHaveBeenCalled();
    });
  });

  describe('parâmetros', () => {
    it('consultar exige leitura; alterar exige permissão de gestão', () => {
      const { controller, intake } = buildController();
      const reader = buildUser({
        companyId: 'company-1',
        permissions: ['document_intake.view'],
      });

      void controller.findSettings('org-1', 'company-1', reader);
      expect(intake.findSettings).toHaveBeenCalled();

      expect(() =>
        controller.updateSettings('org-1', 'company-1', {}, reader),
      ).toThrow(ForbiddenException);
      expect(intake.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('rotas de boleto', () => {
    it('validam e interpretam sem efetuar pagamento', () => {
      const { controller } = buildController();
      const result = controller.validateBoleto({ code: '1234' });

      // Só interpreta: o resultado é uma análise, não uma transação.
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('rulesApplied');
      expect(result).not.toHaveProperty('paid');
    });

    it('convertem nos dois sentidos', () => {
      const { controller } = buildController();
      const result = controller.convertDigitableLine({
        code: '00190500954014481606906809350314337370000000100',
      });

      expect(result.barcode).toHaveLength(44);
    });
  });
});

describe('Severidade das pendências (seção 45)', () => {
  const service = new IntakeIssuesService({} as any, {} as any);

  it('empresa não identificada sempre bloqueia', () => {
    expect(service.severityFor('COMPANY_NOT_IDENTIFIED')).toBe('BLOCKING');
  });

  it('fornecedor faltando bloqueia despesa, mas apenas avisa em receita', () => {
    // Cobrar fornecedor em nota de venda travaria documentos legítimos.
    expect(
      service.severityFor('SUPPLIER_NOT_IDENTIFIED', {
        documentDirection: 'PAYABLE',
      }),
    ).toBe('BLOCKING');
    expect(
      service.severityFor('SUPPLIER_NOT_IDENTIFIED', {
        documentDirection: 'RECEIVABLE',
      }),
    ).toBe('WARNING');
  });

  it('cliente faltando bloqueia receita, mas apenas avisa em despesa', () => {
    expect(
      service.severityFor('CUSTOMER_NOT_IDENTIFIED', {
        documentDirection: 'RECEIVABLE',
      }),
    ).toBe('BLOCKING');
    expect(
      service.severityFor('CUSTOMER_NOT_IDENTIFIED', {
        documentDirection: 'PAYABLE',
      }),
    ).toBe('WARNING');
  });

  it('código inválido, duplicidade e divergência de valor bloqueiam', () => {
    expect(service.severityFor('INVALID_CODE')).toBe('BLOCKING');
    expect(service.severityFor('DUPLICATE_DOCUMENT')).toBe('BLOCKING');
    expect(service.severityFor('AMOUNT_DIVERGENCE')).toBe('BLOCKING');
  });

  it('arquivo protegido e corrompido bloqueiam', () => {
    expect(service.severityFor('PROTECTED_DOCUMENT')).toBe('BLOCKING');
    expect(service.severityFor('CORRUPTED_FILE')).toBe('BLOCKING');
  });

  it('vencimento não identificado e categoria ausente apenas avisam', () => {
    expect(service.severityFor('DUE_DATE_NOT_IDENTIFIED')).toBe('WARNING');
    expect(service.severityFor('CATEGORY_MISSING')).toBe('WARNING');
  });

  it('pendência manual genérica é informativa', () => {
    expect(service.severityFor('OTHER')).toBe('INFORMATIONAL');
  });

  it('resolver sem descrever a solução é recusado', async () => {
    const prisma = {
      intakeDocumentIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'issue-1',
          status: 'OPEN',
          severity: 'BLOCKING',
          document: { organizationId: 'org-1', companyId: 'company-1' },
        }),
        update: jest.fn(),
      },
    };
    const issues = new IntakeIssuesService(
      prisma as any,
      { log: jest.fn() } as any,
    );

    await expect(
      issues.resolve(
        'doc-1',
        'issue-1',
        '   ',
        buildUser({ companyId: 'company-1' }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.intakeDocumentIssue.update).not.toHaveBeenCalled();
  });
});
