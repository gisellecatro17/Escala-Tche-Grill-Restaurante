import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IntakeDocumentDirection,
  IntakeDocumentType,
  IntakeIssueType,
  IntakeProcessingStatus,
  IntakeRelationType,
  IntakeReviewStatus,
  IntakeSourceChannel,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
  hasPermissionAnywhere,
} from '../../common/utils/access-control.util';
import {
  maskAccountFragment,
  maskPixKeyValue,
} from '../../common/utils/mask.util';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../../storage/storage.service';
import { BoletoValidationService } from './boleto-validation.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { FileValidationService } from './file-validation.service';
import { IntakeIssuesService } from './intake-issues.service';
import { IntakePipelineService } from './intake-pipeline.service';
import { PartyIdentificationService } from './party-identification.service';
import {
  LocalDocumentExtractionProvider,
  type ExtractionResult,
} from './providers/document-extraction.provider';
import { classifyDocumentType } from './utils/document-classifier.util';
import { normalizeFileName } from './utils/file-signature.util';
import type {
  ForwardDocumentDto,
  IntakeDocumentQueryDto,
  ManualEntryDto,
  RejectDocumentDto,
  ReviewDocumentDto,
  SplitDocumentDto,
  UpdateIntakeDocumentDto,
} from './dto/document-intake.dto';

/**
 * Serviço central da entrada de documentos.
 *
 * Orquestra o fluxo da seção 2 — recebimento, armazenamento, validação, extração,
 * identificação, duplicidade, revisão e encaminhamento. A regra que atravessa tudo: nenhum
 * documento gera obrigação financeira aqui. `READY_FOR_PROCESSING` é o ponto de entrega
 * para o módulo financeiro, que ainda não existe.
 */

/** Campos protegidos por `document_intake.view_sensitive_data` (seção 81). */
const MASKED_PLACEHOLDER_DOCUMENT = '**.***.***/****-**';

const DOCUMENT_INCLUDE = {
  company: { select: { id: true, legalName: true, tradeName: true } },
  supplier: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      documentNumber: true,
    },
  },
  customer: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      documentNumber: true,
    },
  },
  _count: {
    select: {
      issues: true,
      duplicateMatches: true,
      files: true,
      extractedFields: true,
    },
  },
} satisfies Prisma.IntakeDocumentInclude;

@Injectable()
export class DocumentIntakeService {
  private readonly logger = new Logger(DocumentIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly extraction: LocalDocumentExtractionProvider,
    private readonly boleto: BoletoValidationService,
    private readonly identification: PartyIdentificationService,
    private readonly duplicates: DuplicateDetectionService,
    private readonly issues: IntakeIssuesService,
    private readonly pipeline: IntakePipelineService,
  ) {}

  // ── Parâmetros (seção 66) ─────────────────────────────────────────────────

  /** Parâmetros da empresa, criados com os padrões conservadores na primeira consulta. */
  async findSettings(organizationId: string, companyId: string) {
    const existing = await this.prisma.documentIntakeSettings.findUnique({
      where: { companyId },
    });
    if (existing) return existing;

    return this.prisma.documentIntakeSettings.create({
      data: { organizationId, companyId },
    });
  }

  async updateSettings(
    organizationId: string,
    companyId: string,
    dto: Prisma.DocumentIntakeSettingsUpdateInput,
    actor: RequestUser,
  ) {
    const current = await this.findSettings(organizationId, companyId);

    const settings = await this.prisma.documentIntakeSettings.update({
      where: { companyId },
      data: { ...dto, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'UPDATE_DOCUMENT_INTAKE_SETTINGS',
      entity: 'DocumentIntakeSettings',
      entityId: settings.id,
      oldValue: {
        mandatoryReview: current.mandatoryReview,
        autoForwardHighConfidence: current.autoForwardHighConfidence,
        blockDuplicates: current.blockDuplicates,
      },
      newValue: {
        mandatoryReview: settings.mandatoryReview,
        autoForwardHighConfidence: settings.autoForwardHighConfidence,
        blockDuplicates: settings.blockDuplicates,
      },
    });

    return settings;
  }

  // ── Recebimento (seções 8, 12, 13 e 67) ───────────────────────────────────

  /**
   * Recebe um arquivo: valida, armazena e enfileira o pipeline.
   *
   * A ordem é deliberada — validar **antes** de armazenar. Gravar primeiro e checar depois
   * deixaria executáveis no bucket até alguém limpar.
   */
  async receiveUpload(params: {
    organizationId: string;
    companyId: string;
    file: { originalname: string; mimetype?: string; buffer: Buffer };
    sourceChannel?: IntakeSourceChannel;
    documentType?: IntakeDocumentType;
    notes?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    batchImportId?: string;
    actor: RequestUser;
  }) {
    const settings = await this.findSettings(
      params.organizationId,
      params.companyId,
    );

    const validation = await this.fileValidation.validate(
      {
        fileName: params.file.originalname,
        declaredMimeType: params.file.mimetype,
        buffer: params.file.buffer,
      },
      {
        maximumFileSize: settings.maximumFileSize,
        allowedExtensions: settings.allowedExtensions,
      },
    );

    if (!validation.accepted) {
      // Arquivo recusado não cria documento: não há o que revisar em um executável.
      throw new BadRequestException(validation.errors.join(' '));
    }

    // Hash igual dentro da mesma organização é o sinal mais forte de reenvio. O documento é
    // criado de qualquer forma — quem decide é a revisão —, mas já nasce sinalizado.
    const existingByHash = await this.prisma.intakeDocument.findFirst({
      where: {
        organizationId: params.organizationId,
        fileHash: validation.fileHash,
        deletedAt: null,
      },
      select: { id: true, originalFileName: true },
    });

    const storagePath = this.buildStoragePath(
      params.organizationId,
      params.companyId,
      validation.normalizedFileName,
    );

    await this.storage.uploadPrivateDocument(
      storagePath,
      params.file.buffer,
      validation.effectiveMimeType ?? 'application/octet-stream',
    );

    const document = await this.prisma.intakeDocument.create({
      data: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        sourceChannel:
          params.sourceChannel ?? IntakeSourceChannel.MANUAL_UPLOAD,
        documentType: params.documentType ?? IntakeDocumentType.OTHER,
        originalFileName: params.file.originalname,
        displayName: validation.normalizedFileName,
        storagePath,
        mimeType: validation.effectiveMimeType,
        fileExtension: validation.extension,
        fileSize: validation.fileSize,
        fileHash: validation.fileHash,
        pageCount: validation.pageCount,
        notes: params.notes ?? null,
        priority: params.priority ?? 'NORMAL',
        batchImportId: params.batchImportId ?? null,
        processingStatus: IntakeProcessingStatus.STORED,
        reviewDueAt: new Date(
          Date.now() + settings.reviewDeadlineHours * 3_600_000,
        ),
        assignedUserId: settings.defaultAssignedUserId,
        createdBy: actorId(params.actor),
      },
    });

    await this.prisma.intakeDocumentFile.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        fileRole: 'ORIGINAL',
        isOriginal: true,
        isCurrent: true,
        fileName: validation.normalizedFileName,
        storagePath,
        mimeType: validation.effectiveMimeType,
        fileSize: validation.fileSize,
        fileHash: validation.fileHash,
        pageCount: validation.pageCount,
        createdBy: actorId(params.actor),
      },
    });

    // Observações da validação (antivírus ausente, imagem pequena) ficam registradas.
    for (const warning of validation.warnings) {
      await this.issues.raise({
        documentId: document.id,
        issueType: IntakeIssueType.OTHER,
        description: warning,
        severity: 'INFORMATIONAL',
      });
    }

    if (existingByHash) {
      await this.issues.raise({
        documentId: document.id,
        issueType: IntakeIssueType.DUPLICATE_DOCUMENT,
        description: `Arquivo idêntico a "${existingByHash.originalFileName ?? existingByHash.id}" já recebido.`,
      });
    }

    await this.audit.log({
      organizationId: params.organizationId,
      companyId: params.companyId,
      userId: actorId(params.actor),
      action: 'UPLOAD_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: document.id,
      newValue: {
        fileName: validation.normalizedFileName,
        fileHash: validation.fileHash,
        detectedKind: validation.detectedKind,
        antivirus: validation.antivirus.verdict,
      },
      origin: params.sourceChannel ?? IntakeSourceChannel.MANUAL_UPLOAD,
    });

    await this.pipeline.startPipeline(
      document.id,
      priorityWeight(document.priority),
    );

    return { document, validation };
  }

  /**
   * Digitação manual (seção 14). O documento passa pela **mesma** fila e auditoria: um
   * caminho paralelo sem validação seria a porta para pular todas as regras.
   */
  async createManualEntry(dto: ManualEntryDto, actor: RequestUser) {
    const settings = await this.findSettings(dto.organizationId, dto.companyId);

    const document = await this.prisma.intakeDocument.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        sourceChannel: IntakeSourceChannel.MANUAL_ENTRY,
        documentType: dto.documentType,
        documentDirection:
          dto.documentDirection ?? IntakeDocumentDirection.UNKNOWN,
        supplierId: dto.supplierId ?? null,
        customerId: dto.customerId ?? null,
        documentNumber: dto.documentNumber ?? null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        grossAmount: dto.grossAmount ?? null,
        netAmount: dto.netAmount ?? dto.grossAmount ?? null,
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        categoryId: dto.categoryId ?? null,
        costCenterId: dto.costCenterId ?? null,
        projectId: dto.projectId ?? null,
        paymentMethodId: dto.paymentMethodId ?? null,
        receiptMethodId: dto.receiptMethodId ?? null,
        barcode: dto.barcode ?? null,
        normalizedBarcode: dto.barcode
          ? this.boleto.normalize(dto.barcode)
          : null,
        digitableLine: dto.digitableLine ?? null,
        normalizedDigitableLine: dto.digitableLine
          ? this.boleto.normalize(dto.digitableLine)
          : null,
        // Digitado por uma pessoa: a confiança é a de quem digitou, não a de um extrator.
        confidence: 100,
        extractionMethod: 'MANUAL_ENTRY',
        processingStatus: IntakeProcessingStatus.PENDING_REVIEW,
        reviewStatus: IntakeReviewStatus.NOT_REVIEWED,
        reviewDueAt: new Date(
          Date.now() + settings.reviewDeadlineHours * 3_600_000,
        ),
        priority: dto.priority ?? 'NORMAL',
        assignedUserId: dto.assignedUserId ?? settings.defaultAssignedUserId,
        createdBy: actorId(actor),
      },
    });

    // O boleto informado é validado na hora: digitar errado é comum, e a hora de avisar é
    // agora, não no pagamento.
    if (dto.digitableLine || dto.barcode) {
      await this.validateBoletoFields(
        document.id,
        dto.digitableLine ?? dto.barcode!,
      );
    }

    if (settings.duplicateValidationEnabled) {
      await this.duplicates.check(document.id);
    }

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actorId(actor),
      action: 'CREATE_INTAKE_MANUAL_ENTRY',
      entity: 'IntakeDocument',
      entityId: document.id,
      newValue: {
        documentType: dto.documentType,
        grossAmount: dto.grossAmount,
      },
      origin: IntakeSourceChannel.MANUAL_ENTRY,
    });

    return document;
  }

  /**
   * Caminho do arquivo no bucket privado.
   *
   * Organização e empresa aparecem no caminho para que a separação física acompanhe a
   * lógica. O nome já vem normalizado; o carimbo de tempo evita colisão entre dois envios
   * do mesmo nome sem sobrescrever nada.
   */
  private buildStoragePath(
    organizationId: string,
    companyId: string,
    normalizedFileName: string,
  ): string {
    const safeName = normalizeFileName(normalizedFileName);
    return `intake/${organizationId}/${companyId}/${Date.now()}-${safeName}`;
  }

  /**
   * Recebe um lote de arquivos (seção 12).
   *
   * Um arquivo inválido **não** interrompe o lote: o resultado lista o que entrou e o que
   * foi recusado, com o motivo. Abortar tudo por causa de um arquivo obrigaria o usuário a
   * reenviar os outros dezenove.
   */
  async receiveBatch(params: {
    organizationId: string;
    companyId: string;
    files: { originalname: string; mimetype?: string; buffer: Buffer }[];
    documentType?: IntakeDocumentType;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    actor: RequestUser;
  }) {
    const settings = await this.findSettings(
      params.organizationId,
      params.companyId,
    );

    if (params.files.length === 0) {
      throw new BadRequestException('Nenhum arquivo foi enviado.');
    }

    if (params.files.length > settings.maximumFilesPerUpload) {
      throw new BadRequestException(
        `O limite é de ${settings.maximumFilesPerUpload} arquivos por envio; foram enviados ${params.files.length}.`,
      );
    }

    const batch = await this.prisma.intakeBatchImport.create({
      data: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        batchName: `Envio de ${params.files.length} arquivo(s)`,
        totalFiles: params.files.length,
        status: 'PROCESSING',
        startedBy: params.actor.id,
        startedAt: new Date(),
      },
    });

    const accepted: string[] = [];
    const rejected: { fileName: string; reason: string }[] = [];

    for (const file of params.files) {
      try {
        const result = await this.receiveUpload({
          organizationId: params.organizationId,
          companyId: params.companyId,
          file,
          sourceChannel: IntakeSourceChannel.BATCH_IMPORT,
          documentType: params.documentType,
          priority: params.priority,
          batchImportId: batch.id,
          actor: params.actor,
        });

        accepted.push(result.document.id);
        await this.prisma.intakeBatchImportItem.create({
          data: {
            batchImportId: batch.id,
            documentId: result.document.id,
            originalFileName: file.originalname,
            fileSize: file.buffer.length,
            status: 'PROCESSED',
          },
        });
      } catch (caught) {
        const reason =
          caught instanceof Error
            ? caught.message
            : 'Falha desconhecida no envio.';
        rejected.push({ fileName: file.originalname, reason });

        await this.prisma.intakeBatchImportItem.create({
          data: {
            batchImportId: batch.id,
            originalFileName: file.originalname,
            fileSize: file.buffer.length,
            status: 'INVALID',
            errorMessage: reason,
          },
        });
      }
    }

    const finished = await this.prisma.intakeBatchImport.update({
      where: { id: batch.id },
      data: {
        validFiles: accepted.length,
        invalidFiles: rejected.length,
        processedFiles: accepted.length,
        errorFiles: rejected.length,
        status: rejected.length === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS',
        completedAt: new Date(),
      },
    });

    return { batch: finished, accepted: accepted.length, rejected };
  }

  /** Campos extraídos, com o mascaramento aplicado nos que carregam dado sensível. */
  async findExtractedFields(documentId: string, actor: RequestUser) {
    const fields = await this.prisma.intakeDocumentExtractedField.findMany({
      where: { documentId },
      orderBy: { fieldName: 'asc' },
    });

    if (hasPermissionAnywhere(actor, 'document_intake.view_sensitive_data'))
      return fields;

    // Os campos sensíveis são mascarados pelo **nome**: a lista é aberta, então mascarar
    // por nome cobre também os campos que um provedor externo venha a acrescentar.
    const sensitive = [
      'issuerDocument',
      'recipientDocument',
      'digitableLine',
      'barcode',
      'pixKey',
    ];

    return fields.map((field) =>
      sensitive.includes(field.fieldName)
        ? {
            ...field,
            originalValue:
              field.fieldName === 'pixKey'
                ? maskPixKeyValue(field.originalValue)
                : maskCodeValue(field.originalValue),
            normalizedValue:
              field.fieldName === 'pixKey'
                ? maskPixKeyValue(field.normalizedValue)
                : maskCodeValue(field.normalizedValue),
          }
        : field,
    );
  }

  /**
   * Corrige um campo extraído.
   *
   * A correção humana passa a valer sobre o reprocessamento: `isManuallyChanged` impede que
   * a extração automática sobrescreva depois o que uma pessoa conferiu.
   */
  async updateExtractedField(
    documentId: string,
    fieldId: string,
    dto: { normalizedValue: string; originalValue?: string },
    actor: RequestUser,
  ) {
    const field = await this.prisma.intakeDocumentExtractedField.findFirst({
      where: { id: fieldId, documentId },
    });

    if (!field) throw new NotFoundException('Campo extraído não encontrado.');

    const updated = await this.prisma.intakeDocumentExtractedField.update({
      where: { id: fieldId },
      data: {
        normalizedValue: dto.normalizedValue,
        originalValue: dto.originalValue ?? field.originalValue,
        sourceMethod: 'MANUAL_CORRECTION',
        confidence: 100,
        validationStatus: 'MANUALLY_CONFIRMED',
        isManuallyChanged: true,
        changedBy: actor.id,
        changedAt: new Date(),
      },
    });

    const scope = await this.scopeOf(documentId);
    await this.audit.log({
      organizationId: scope.organizationId,
      companyId: scope.companyId,
      userId: actor.id,
      action: 'UPDATE_INTAKE_EXTRACTED_FIELD',
      entity: 'IntakeDocumentExtractedField',
      entityId: fieldId,
      field: field.fieldName,
      oldValue: {
        normalizedValue: field.normalizedValue,
        confidence: Number(field.confidence ?? 0),
      },
      newValue: { normalizedValue: dto.normalizedValue, confidence: 100 },
    });

    return updated;
  }

  /**
   * Executa uma ação em vários documentos (seção 48).
   *
   * Cada documento é validado e processado **individualmente**: a permissão é conferida
   * contra a empresa de cada um, e a falha de um não desfaz os outros. O resultado diz o
   * que passou e o que falhou, porque em lote o silêncio é pior que o erro.
   */
  async runBatch<T>(
    documentIds: string[],
    actor: RequestUser,
    permission: string,
    action: (documentId: string) => Promise<T>,
  ) {
    const succeeded: string[] = [];
    const failed: { documentId: string; reason: string }[] = [];

    for (const documentId of documentIds) {
      try {
        const scope = await this.scopeOf(documentId);

        // Permissão por documento: um lote não pode ser um atalho para mexer em documento
        // de empresa a que o usuário não tem acesso.
        if (scope.companyId) {
          assertCompanyPermission(actor, scope.companyId, permission);
        } else {
          assertOrganizationPermission(actor, scope.organizationId, permission);
        }

        await action(documentId);
        succeeded.push(documentId);
      } catch (caught) {
        failed.push({
          documentId,
          reason:
            caught instanceof Error ? caught.message : 'Falha desconhecida.',
        });
      }
    }

    return {
      total: documentIds.length,
      succeeded: succeeded.length,
      failed,
      note:
        failed.length > 0
          ? 'Os documentos que falharam não foram alterados; os demais foram processados.'
          : undefined,
    };
  }

  // ── Pipeline (seções 17 e 69) ─────────────────────────────────────────────

  /**
   * Executa uma etapa do pipeline. Chamado pelo worker e pelas rotas de reprocessamento.
   *
   * Cada etapa é idempotente: o retry pode repetir qualquer uma delas.
   */
  async runPipelineStep(job: {
    id: string;
    documentId: string;
    jobType: string;
    attemptNumber: number;
  }): Promise<void> {
    switch (job.jobType) {
      case 'VALIDATE_FILE':
        await this.pipeline.enqueueNext(job.documentId, 'VALIDATE_FILE');
        return;
      case 'EXTRACT_DATA':
        await this.extractDocument(job.documentId);
        await this.pipeline.enqueueNext(job.documentId, 'EXTRACT_DATA');
        return;
      case 'CLASSIFY_DOCUMENT':
        await this.classifyDocument(job.documentId);
        await this.pipeline.enqueueNext(job.documentId, 'CLASSIFY_DOCUMENT');
        return;
      case 'IDENTIFY_PARTIES':
        await this.identifyParties(job.documentId);
        await this.pipeline.enqueueNext(job.documentId, 'IDENTIFY_PARTIES');
        return;
      case 'VALIDATE_DATA':
        await this.validateExtractedData(job.documentId);
        await this.pipeline.enqueueNext(job.documentId, 'VALIDATE_DATA');
        return;
      case 'DETECT_DUPLICATES':
        await this.duplicates.check(job.documentId);
        await this.pipeline.enqueueNext(job.documentId, 'DETECT_DUPLICATES');
        return;
      case 'SUGGEST_CLASSIFICATION':
        await this.finishPipeline(job.documentId);
        return;
      default:
        throw new BadRequestException(`Etapa desconhecida: ${job.jobType}`);
    }
  }

  /** Etapa de extração: lê o arquivo do storage e grava os campos com procedência. */
  async extractDocument(documentId: string): Promise<ExtractionResult> {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    if (!document.storagePath) {
      // Documento digitado à mão não tem arquivo: não há o que extrair.
      return {
        text: '',
        method: 'MANUAL_ENTRY' as never,
        usedOcr: false,
        confidence: 100,
        fields: [],
        fiscalXml: null,
        barcodeCandidates: [],
        pageCount: null,
        warnings: [],
      };
    }

    const buffer = await this.storage.downloadPrivateDocument(
      document.storagePath,
    );
    const result = await this.extraction.extractFields({
      buffer,
      fileName: document.originalFileName ?? 'documento',
      mimeType: document.mimeType,
    });

    // Grava campo a campo, preservando correções manuais anteriores: o pipeline nunca
    // sobrescreve o que uma pessoa já corrigiu.
    for (const field of result.fields) {
      const existing =
        await this.prisma.intakeDocumentExtractedField.findUnique({
          where: {
            documentId_fieldName: { documentId, fieldName: field.fieldName },
          },
        });

      if (existing?.isManuallyChanged) continue;

      await this.prisma.intakeDocumentExtractedField.upsert({
        where: {
          documentId_fieldName: { documentId, fieldName: field.fieldName },
        },
        create: {
          documentId,
          fieldName: field.fieldName,
          originalValue: field.originalValue,
          normalizedValue: field.normalizedValue,
          dataType: field.dataType,
          sourceMethod: field.sourceMethod,
          confidence: field.confidence,
          pageNumber: field.pageNumber ?? null,
        },
        update: {
          originalValue: field.originalValue,
          normalizedValue: field.normalizedValue,
          dataType: field.dataType,
          sourceMethod: field.sourceMethod,
          confidence: field.confidence,
        },
      });
    }

    await this.prisma.intakeDocument.update({
      where: { id: documentId },
      data: {
        extractedText: result.text.slice(0, 100_000),
        extractionMethod: result.method ?? null,
        confidence: result.confidence,
        ...this.mapExtractedFieldsToDocument(result),
      },
    });

    if (result.text.length === 0) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.UNREADABLE_DOCUMENT,
      });
    } else {
      await this.issues.resolveAutomatically(
        documentId,
        [IntakeIssueType.UNREADABLE_DOCUMENT],
        'Texto extraído com sucesso.',
      );
    }

    // Boleto: valida o que foi lido e registra divergência como pendência.
    const candidate = result.barcodeCandidates[0];
    if (candidate) await this.validateBoletoFields(documentId, candidate);

    return result;
  }

  /** Traduz os campos extraídos para as colunas do documento. */
  private mapExtractedFieldsToDocument(
    result: ExtractionResult,
  ): Prisma.IntakeDocumentUpdateInput {
    const byName = new Map(
      result.fields.map((field) => [field.fieldName, field]),
    );
    const text = (name: string) =>
      byName.get(name)?.normalizedValue ?? undefined;
    const number = (name: string) => {
      const value = byName.get(name)?.normalizedValue;
      if (value === undefined || value === null) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const date = (name: string) => {
      const value = byName.get(name)?.normalizedValue;
      if (!value) return undefined;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const barcode = text('barcode');
    const digitableLine = text('digitableLine');

    return {
      documentNumber: text('documentNumber'),
      documentSeries: text('documentSeries'),
      accessKey: text('accessKey'),
      issuerDocument: text('issuerDocument'),
      issuerName: text('issuerName'),
      recipientDocument: text('recipientDocument'),
      recipientName: text('recipientName'),
      issueDate: date('issueDate'),
      competenceDate: date('competenceDate'),
      dueDate: date('dueDate'),
      grossAmount: number('grossAmount'),
      discountAmount: number('discountAmount'),
      withholdingAmount: number('withholdingAmount'),
      netAmount: number('netAmount') ?? number('grossAmount'),
      description: text('description'),
      pixKey: text('pixKey'),
      ...(barcode
        ? { barcode, normalizedBarcode: this.boleto.normalize(barcode) }
        : {}),
      ...(digitableLine
        ? {
            digitableLine,
            normalizedDigitableLine: this.boleto.normalize(digitableLine),
          }
        : {}),
    };
  }

  /**
   * Valida o boleto lido e grava vencimento e valor quando o código os traz.
   *
   * O código de barras é fonte mais confiável que o texto impresso: ele carrega valor e
   * fator de vencimento com dígito verificador. Quando o código é válido, o que ele diz
   * prevalece — e a divergência com o que estava escrito vira pendência.
   */
  private async validateBoletoFields(documentId: string, input: string) {
    const result = this.boleto.validate(input);

    if (!result.valid) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.INVALID_CODE,
        fieldName: 'digitableLine',
        description:
          result.errors.join(' ') || 'O código informado é inválido.',
      });
      return result;
    }

    await this.issues.resolveAutomatically(
      documentId,
      [IntakeIssueType.INVALID_CODE],
      'Código de barras validado com sucesso.',
    );

    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId },
      select: { grossAmount: true, dueDate: true },
    });

    // Divergência entre o que o código diz e o que já estava no documento.
    if (
      result.amount !== null &&
      document.grossAmount !== null &&
      Math.abs(Number(document.grossAmount) - result.amount) > 0.01
    ) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.AMOUNT_DIVERGENCE,
        fieldName: 'grossAmount',
        description: `O valor lido no código (R$ ${result.amount.toFixed(2)}) difere do valor do documento (R$ ${Number(document.grossAmount).toFixed(2)}).`,
      });
    }

    if (result.ambiguousDueDate) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.DUE_DATE_DIVERGENCE,
        fieldName: 'dueDate',
        description: `O fator de vencimento admite mais de uma data: ${result.ambiguousCandidates
          .map((candidate) => candidate.toISOString().slice(0, 10))
          .join(' ou ')}. Confira o vencimento impresso.`,
      });
    }

    await this.prisma.intakeDocument.update({
      where: { id: documentId },
      data: {
        barcode: result.barcode,
        normalizedBarcode: result.barcode,
        digitableLine: result.digitableLine,
        normalizedDigitableLine: result.digitableLine,
        ...(result.amount !== null && document.grossAmount === null
          ? { grossAmount: result.amount, netAmount: result.amount }
          : {}),
        ...(result.dueDate && !document.dueDate
          ? { dueDate: result.dueDate }
          : {}),
      },
    });

    return result;
  }

  /** Etapa de classificação do tipo do documento (seção 16). */
  async classifyDocument(documentId: string) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    const suggestion = classifyDocumentType({
      fileName: document.originalFileName,
      extension: document.fileExtension,
      mimeType: document.mimeType,
      text: document.extractedText,
      hasBarcode: Boolean(
        document.normalizedBarcode ?? document.normalizedDigitableLine,
      ),
      hasAccessKey: Boolean(document.accessKey),
    });

    // Não sobrescreve o tipo que o usuário escolheu no envio.
    const keepExisting =
      document.documentType !== IntakeDocumentType.OTHER &&
      document.sourceChannel === IntakeSourceChannel.MANUAL_ENTRY;

    if (!keepExisting) {
      await this.prisma.intakeDocument.update({
        where: { id: documentId },
        data: {
          documentType: suggestion.documentType,
          documentDirection: suggestion.direction,
          typeConfidence: suggestion.confidence,
        },
      });
    }

    return suggestion;
  }

  /** Etapa de identificação de empresa, fornecedor e cliente. */
  async identifyParties(documentId: string) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    const input = {
      issuerDocument: document.issuerDocument,
      issuerName: document.issuerName,
      recipientDocument: document.recipientDocument,
      recipientName: document.recipientName,
      pixKey: document.pixKey,
      text: document.extractedText,
    };

    const data: Prisma.IntakeDocumentUpdateInput = {};

    // Empresa: só procura se ainda não está definida.
    if (!document.companyId) {
      const company = await this.identification.identifyCompany(
        document.organizationId,
        input,
        null,
      );
      if (company.identified) {
        data.company = { connect: { id: company.identified.entity.id } };
        data.companyConfidence = company.identified.confidence;
        await this.issues.resolveAutomatically(
          documentId,
          [IntakeIssueType.COMPANY_NOT_IDENTIFIED],
          `Empresa identificada por ${company.identified.matchedBy}.`,
        );
      } else {
        await this.issues.raise({
          documentId,
          issueType: IntakeIssueType.COMPANY_NOT_IDENTIFIED,
          description: company.ambiguous
            ? 'Mais de uma empresa corresponde a este documento. Selecione a empresa correta.'
            : undefined,
        });
      }
    }

    if (document.documentDirection !== IntakeDocumentDirection.RECEIVABLE) {
      const supplier = await this.identification.identifySupplier(
        document.organizationId,
        document.companyId,
        input,
      );
      if (supplier.identified) {
        data.supplier = { connect: { id: supplier.identified.entity.id } };
        data.supplierConfidence = supplier.identified.confidence;
        await this.issues.resolveAutomatically(
          documentId,
          [IntakeIssueType.SUPPLIER_NOT_IDENTIFIED],
          `Fornecedor identificado por ${supplier.identified.matchedBy}.`,
        );
      } else if (!document.supplierId) {
        await this.issues.raise({
          documentId,
          issueType: IntakeIssueType.SUPPLIER_NOT_IDENTIFIED,
        });
      }
    }

    if (document.documentDirection === IntakeDocumentDirection.RECEIVABLE) {
      const customer = await this.identification.identifyCustomer(
        document.organizationId,
        input,
      );
      if (customer.identified) {
        data.customer = { connect: { id: customer.identified.entity.id } };
        data.customerConfidence = customer.identified.confidence;
      } else if (!document.customerId) {
        await this.issues.raise({
          documentId,
          issueType: IntakeIssueType.CUSTOMER_NOT_IDENTIFIED,
        });
      }
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.intakeDocument.update({
        where: { id: documentId },
        data,
      });
    }

    return this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId },
      include: DOCUMENT_INCLUDE,
    });
  }

  /**
   * Etapa de validação dos dados extraídos (seção 38).
   *
   * A conferência do valor líquido é aritmética simples, mas é a que pega nota digitada
   * errado antes de o pagamento sair: bruto − desconto − retenção + juros + multa.
   */
  async validateExtractedData(documentId: string) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    if (document.grossAmount === null) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.AMOUNT_NOT_IDENTIFIED,
        fieldName: 'grossAmount',
      });
    } else {
      await this.issues.resolveAutomatically(
        documentId,
        [IntakeIssueType.AMOUNT_NOT_IDENTIFIED],
        'Valor identificado.',
      );
    }

    if (
      document.dueDate === null &&
      document.documentType === IntakeDocumentType.BOLETO
    ) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.DUE_DATE_NOT_IDENTIFIED,
        fieldName: 'dueDate',
      });
    }

    const check = this.checkAmounts(document);
    if (!check.balanced) {
      await this.issues.raise({
        documentId,
        issueType: IntakeIssueType.AMOUNT_DIVERGENCE,
        fieldName: 'netAmount',
        description: `Os valores informados não fecham. Calculado: R$ ${check.calculated.toFixed(2)}; informado: R$ ${check.informed!.toFixed(2)}; diferença: R$ ${check.difference.toFixed(2)}.`,
      });
    } else {
      await this.issues.resolveAutomatically(
        documentId,
        [IntakeIssueType.AMOUNT_DIVERGENCE],
        'Valores conferidos.',
      );
    }

    // Exigências configuradas por empresa.
    if (document.companyId) {
      const settings = await this.findSettings(
        document.organizationId,
        document.companyId,
      );

      if (settings.requireCategory && !document.categoryId) {
        await this.issues.raise({
          documentId,
          issueType: IntakeIssueType.CATEGORY_MISSING,
        });
      }
      if (settings.requireCostCenter && !document.costCenterId) {
        await this.issues.raise({
          documentId,
          issueType: IntakeIssueType.COST_CENTER_REQUIRED,
        });
      }
      if (settings.requireProject && !document.projectId) {
        await this.issues.raise({
          documentId,
          issueType: IntakeIssueType.PROJECT_REQUIRED,
        });
      }
    }

    return check;
  }

  /** Conferência aritmética dos valores (seção 38). */
  checkAmounts(document: {
    grossAmount: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    withholdingAmount: Prisma.Decimal | null;
    interestAmount: Prisma.Decimal | null;
    penaltyAmount: Prisma.Decimal | null;
    netAmount: Prisma.Decimal | null;
  }) {
    const value = (amount: Prisma.Decimal | null) =>
      amount === null ? 0 : Number(amount);

    const calculated =
      value(document.grossAmount) -
      value(document.discountAmount) -
      value(document.withholdingAmount) +
      value(document.interestAmount) +
      value(document.penaltyAmount);

    const informed =
      document.netAmount === null ? null : Number(document.netAmount);
    const difference = informed === null ? 0 : informed - calculated;

    return {
      calculated: Math.round(calculated * 100) / 100,
      informed,
      difference: Math.round(difference * 100) / 100,
      // Sem valor líquido informado não há divergência a acusar: há campo em branco.
      balanced: informed === null || Math.abs(difference) < 0.01,
    };
  }

  /**
   * Fim do pipeline: decide entre aguardar revisão e estar pronto para processamento.
   *
   * O encaminhamento automático só acontece com alta confiança, sem pendência bloqueante,
   * sem duplicidade e **com o parâmetro ligado** — que vem desligado por padrão, porque a
   * recomendação do prompt é manter revisão humana obrigatória.
   */
  private async finishPipeline(documentId: string) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    const blocking = await this.issues.findBlocking(documentId);
    const settings = document.companyId
      ? await this.findSettings(document.organizationId, document.companyId)
      : null;

    const confidence =
      document.confidence === null ? 0 : Number(document.confidence);
    const highConfidence =
      settings !== null &&
      confidence >= Number(settings.highConfidenceThreshold);

    const canAutoForward =
      settings !== null &&
      settings.autoForwardHighConfidence &&
      !settings.mandatoryReview &&
      highConfidence &&
      blocking.length === 0 &&
      ![
        'POSSIBLE_DUPLICATE',
        'HIGH_PROBABILITY',
        'EXACT_DUPLICATE',
        'CONFIRMED_DUPLICATE',
      ].includes(document.duplicateStatus);

    const newStatus = canAutoForward
      ? IntakeProcessingStatus.READY_FOR_PROCESSING
      : IntakeProcessingStatus.PENDING_REVIEW;

    await this.prisma.$transaction([
      this.prisma.intakeDocument.update({
        where: { id: documentId },
        data: {
          processingStatus: newStatus,
          processedAt: new Date(),
          ...(canAutoForward ? { forwardedAt: new Date() } : {}),
        },
      }),
      this.prisma.intakeDocumentStatusHistory.create({
        data: {
          documentId,
          previousProcessingStatus: document.processingStatus,
          newProcessingStatus: newStatus,
          reason: canAutoForward
            ? `Encaminhado automaticamente (confiança ${confidence}%).`
            : 'Pipeline concluído; aguardando revisão.',
        },
      }),
    ]);

    this.logger.debug(
      `Documento ${documentId} finalizou o pipeline em ${newStatus} (confiança ${confidence}%).`,
    );
  }

  // ── Consulta (seção 68) ───────────────────────────────────────────────────

  /** Caixa de entrada, com os filtros da seção 33. */
  async findAll(
    organizationId: string,
    query: IntakeDocumentQueryDto,
    actor: RequestUser,
  ) {
    const where: Prisma.IntakeDocumentWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.unassignedCompany ? { companyId: null } : {}),
      ...(query.processingStatus
        ? { processingStatus: query.processingStatus }
        : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.documentDirection
        ? { documentDirection: query.documentDirection }
        : {}),
      ...(query.sourceChannel ? { sourceChannel: query.sourceChannel } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.duplicateStatus
        ? { duplicateStatus: query.duplicateStatus }
        : {}),
      ...(query.batchImportId ? { batchImportId: query.batchImportId } : {}),
      ...(query.hasIssues
        ? { issues: { some: { status: { in: ['OPEN', 'IN_PROGRESS'] } } } }
        : {}),
      ...(query.hasBlockingIssues
        ? {
            issues: {
              some: {
                severity: 'BLOCKING',
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          }
        : {}),
      ...(query.minimumConfidence !== undefined
        ? { confidence: { gte: query.minimumConfidence } }
        : {}),
      ...(query.maximumConfidence !== undefined
        ? { confidence: { lte: query.maximumConfidence } }
        : {}),
      ...(query.receivedFrom || query.receivedTo
        ? {
            receivedAt: {
              ...(query.receivedFrom
                ? { gte: new Date(query.receivedFrom) }
                : {}),
              ...(query.receivedTo ? { lte: new Date(query.receivedTo) } : {}),
            },
          }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.minimumAmount !== undefined || query.maximumAmount !== undefined
        ? {
            grossAmount: {
              ...(query.minimumAmount !== undefined
                ? { gte: query.minimumAmount }
                : {}),
              ...(query.maximumAmount !== undefined
                ? { lte: query.maximumAmount }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                originalFileName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                documentNumber: { contains: query.search, mode: 'insensitive' },
              },
              { issuerName: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { accessKey: { contains: query.search.replace(/\D/g, '') } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.intakeDocument.findMany({
        where,
        include: DOCUMENT_INCLUDE,
        orderBy: resolveOrder(query),
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.intakeDocument.count({ where }),
    ]);

    return paginate(
      items.map((item) => this.applyMasking(item, actor)),
      total,
      query.page,
      query.perPage,
    );
  }

  async findOne(id: string, actor: RequestUser) {
    const document = await this.prisma.intakeDocument.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...DOCUMENT_INCLUDE,
        files: { orderBy: { versionNumber: 'desc' } },
        extractedFields: { orderBy: { fieldName: 'asc' } },
        issues: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] },
        statusHistory: { orderBy: { changedAt: 'desc' }, take: 50 },
        assignments: { orderBy: { createdAt: 'desc' }, take: 10 },
        installments: {
          select: {
            id: true,
            documentNumber: true,
            dueDate: true,
            grossAmount: true,
          },
        },
        parentDocument: { select: { id: true, originalFileName: true } },
      },
    });

    if (!document) throw new NotFoundException('Documento não encontrado.');
    return this.applyMasking(document, actor);
  }

  /** Escopo do documento, para o controller validar permissão contra o registro. */
  async scopeOf(id: string) {
    const document = await this.prisma.intakeDocument.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        processingStatus: true,
        reviewStatus: true,
        storagePath: true,
      },
    });

    if (!document) throw new NotFoundException('Documento não encontrado.');
    return document;
  }

  /**
   * Mascara os dados sensíveis quando falta `document_intake.view_sensitive_data`
   * (seção 81). Feito no back-end: o valor protegido não entra na resposta.
   */
  private applyMasking<T extends MaskableDocument>(
    document: T,
    actor: RequestUser,
  ): T {
    if (hasPermissionAnywhere(actor, 'document_intake.view_sensitive_data'))
      return document;

    return {
      ...document,
      issuerDocument: document.issuerDocument
        ? MASKED_PLACEHOLDER_DOCUMENT
        : null,
      recipientDocument: document.recipientDocument
        ? MASKED_PLACEHOLDER_DOCUMENT
        : null,
      digitableLine: maskCodeValue(document.digitableLine),
      normalizedDigitableLine: maskCodeValue(document.normalizedDigitableLine),
      barcode: maskCodeValue(document.barcode),
      normalizedBarcode: maskCodeValue(document.normalizedBarcode),
      pixKey: maskPixKeyValue(document.pixKey),
      // O texto extraído inteiro pode conter tudo isso: sem permissão, não vai.
      ...('extractedText' in document ? { extractedText: null } : {}),
    };
  }

  /**
   * URL assinada para visualizar ou baixar o documento (seções 11 e 81).
   *
   * Cada acesso é registrado na auditoria: quem baixou qual documento e quando é
   * exatamente o tipo de rastro que um BPO precisa ter.
   */
  async createAccessUrl(
    id: string,
    actor: RequestUser,
    intent: 'VIEW' | 'DOWNLOAD',
  ) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        storagePath: true,
        originalFileName: true,
      },
    });

    if (!document.storagePath) {
      throw new BadRequestException(
        'Este documento não possui arquivo armazenado.',
      );
    }

    const signed = await this.storage.createSignedUrl(document.storagePath);

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action:
        intent === 'DOWNLOAD'
          ? 'DOWNLOAD_INTAKE_DOCUMENT'
          : 'VIEW_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: document.id,
      newValue: {
        fileName: document.originalFileName,
        expiresAt: signed.expiresAt,
      },
    });

    return {
      url: signed.url,
      expiresAt: signed.expiresAt,
      fileName: document.originalFileName,
    };
  }

  // ── Revisão e encaminhamento (seções 36, 37, 47 e 70) ─────────────────────

  async update(id: string, dto: UpdateIntakeDocumentDto, actor: RequestUser) {
    const current = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const data: Prisma.IntakeDocumentUpdateInput = {
      ...(dto.documentType !== undefined
        ? { documentType: dto.documentType }
        : {}),
      ...(dto.documentDirection !== undefined
        ? { documentDirection: dto.documentDirection }
        : {}),
      ...(dto.documentNumber !== undefined
        ? { documentNumber: dto.documentNumber }
        : {}),
      ...(dto.documentSeries !== undefined
        ? { documentSeries: dto.documentSeries }
        : {}),
      ...(dto.accessKey !== undefined ? { accessKey: dto.accessKey } : {}),
      ...(dto.issueDate !== undefined
        ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }
        : {}),
      ...(dto.competenceDate !== undefined
        ? {
            competenceDate: dto.competenceDate
              ? new Date(dto.competenceDate)
              : null,
          }
        : {}),
      ...(dto.dueDate !== undefined
        ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
        : {}),
      ...(dto.grossAmount !== undefined
        ? { grossAmount: dto.grossAmount }
        : {}),
      ...(dto.discountAmount !== undefined
        ? { discountAmount: dto.discountAmount }
        : {}),
      ...(dto.interestAmount !== undefined
        ? { interestAmount: dto.interestAmount }
        : {}),
      ...(dto.penaltyAmount !== undefined
        ? { penaltyAmount: dto.penaltyAmount }
        : {}),
      ...(dto.withholdingAmount !== undefined
        ? { withholdingAmount: dto.withholdingAmount }
        : {}),
      ...(dto.netAmount !== undefined ? { netAmount: dto.netAmount } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.supplierId !== undefined
        ? dto.supplierId
          ? { supplier: { connect: { id: dto.supplierId } } }
          : { supplier: { disconnect: true } }
        : {}),
      ...(dto.customerId !== undefined
        ? dto.customerId
          ? { customer: { connect: { id: dto.customerId } } }
          : { customer: { disconnect: true } }
        : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.subcategoryId !== undefined
        ? { subcategoryId: dto.subcategoryId }
        : {}),
      ...(dto.accountPlanId !== undefined
        ? { accountPlanId: dto.accountPlanId }
        : {}),
      ...(dto.costCenterId !== undefined
        ? { costCenterId: dto.costCenterId }
        : {}),
      ...(dto.resultCenterId !== undefined
        ? { resultCenterId: dto.resultCenterId }
        : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      ...(dto.businessUnitId !== undefined
        ? { businessUnitId: dto.businessUnitId }
        : {}),
      ...(dto.financialNatureId !== undefined
        ? { financialNatureId: dto.financialNatureId }
        : {}),
      ...(dto.financialAccountId !== undefined
        ? { financialAccountId: dto.financialAccountId }
        : {}),
      ...(dto.paymentMethodId !== undefined
        ? { paymentMethodId: dto.paymentMethodId }
        : {}),
      ...(dto.receiptMethodId !== undefined
        ? { receiptMethodId: dto.receiptMethodId }
        : {}),
      updatedBy: actor.id,
    };

    const document = await this.prisma.intakeDocument.update({
      where: { id },
      data,
    });

    // Editar um campo o marca como alterado manualmente, para que o reprocessamento não o
    // sobrescreva — a correção humana é a mais confiável de todas.
    await this.markManualChanges(id, dto, actor);

    // Revalida o que mudou: corrigir o valor precisa refletir na conferência.
    await this.validateExtractedData(id);

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      oldValue: auditSnapshot(current),
      newValue: auditSnapshot(document),
    });

    return document;
  }

  /** Registra a procedência das correções manuais campo a campo. */
  private async markManualChanges(
    documentId: string,
    dto: UpdateIntakeDocumentDto,
    actor: RequestUser,
  ) {
    const editable: [keyof UpdateIntakeDocumentDto, string][] = [
      ['documentNumber', 'documentNumber'],
      ['accessKey', 'accessKey'],
      ['issueDate', 'issueDate'],
      ['dueDate', 'dueDate'],
      ['grossAmount', 'grossAmount'],
      ['netAmount', 'netAmount'],
      ['description', 'description'],
    ];

    for (const [dtoKey, fieldName] of editable) {
      const value = dto[dtoKey];
      if (value === undefined) continue;

      await this.prisma.intakeDocumentExtractedField.upsert({
        where: { documentId_fieldName: { documentId, fieldName } },
        create: {
          documentId,
          fieldName,
          originalValue: value === null ? null : String(value),
          normalizedValue: value === null ? null : String(value),
          dataType: 'string',
          sourceMethod: 'MANUAL_CORRECTION',
          confidence: 100,
          isManuallyChanged: true,
          changedBy: actor.id,
          changedAt: new Date(),
        },
        update: {
          normalizedValue: value === null ? null : String(value),
          sourceMethod: 'MANUAL_CORRECTION',
          confidence: 100,
          validationStatus: 'MANUALLY_CONFIRMED',
          isManuallyChanged: true,
          changedBy: actor.id,
          changedAt: new Date(),
        },
      });
    }
  }

  /** Salva a revisão sem encaminhar (seção 36). */
  async review(id: string, dto: ReviewDocumentDto, actor: RequestUser) {
    const current = await this.scopeOf(id);

    const document = await this.prisma.intakeDocument.update({
      where: { id },
      data: {
        reviewStatus: dto.reviewStatus ?? IntakeReviewStatus.REVIEWED,
        notes: dto.notes ?? undefined,
        updatedBy: actor.id,
      },
    });

    await this.prisma.intakeDocumentStatusHistory.create({
      data: {
        documentId: id,
        previousReviewStatus: current.reviewStatus,
        newReviewStatus: document.reviewStatus,
        reason: dto.notes ?? 'Revisão salva.',
        changedBy: actor.id,
      },
    });

    // Confirmar o fornecedor ensina o reconhecimento para a próxima vez (seção 16).
    if (
      dto.confirmSupplierRecognition &&
      document.supplierId &&
      document.extractedText
    ) {
      const snippet =
        document.issuerName ?? document.extractedText.slice(0, 120);
      await this.identification.learnSupplierRecognition({
        organizationId: document.organizationId,
        companyId: document.companyId,
        supplierId: document.supplierId,
        text: snippet,
        userId: actor.id,
        confirmed: true,
      });
    }

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'REVIEW_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      newValue: { reviewStatus: document.reviewStatus },
      reason: dto.notes ?? null,
    });

    return document;
  }

  /**
   * Encaminha para processamento (seção 47).
   *
   * É o ponto de saída do módulo, e por isso a validação aqui é a mais rígida: empresa
   * definida, valor, duplicidade resolvida e **nenhuma pendência bloqueante**. Deixar um
   * documento passar com pendência bloqueante anularia todo o resto do módulo.
   */
  async forward(id: string, dto: ForwardDocumentDto, actor: RequestUser) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const problems: string[] = [];

    if (!document.companyId) problems.push('A empresa não foi identificada.');
    if (document.grossAmount === null)
      problems.push('O valor do documento não foi informado.');

    if (document.documentType === IntakeDocumentType.OTHER) {
      problems.push('Defina o tipo do documento.');
    }

    if (
      document.documentDirection === IntakeDocumentDirection.PAYABLE &&
      !document.supplierId
    ) {
      problems.push('Selecione o fornecedor.');
    }

    if (
      document.documentDirection === IntakeDocumentDirection.RECEIVABLE &&
      !document.customerId
    ) {
      problems.push('Selecione o cliente.');
    }

    const settings = document.companyId
      ? await this.findSettings(document.organizationId, document.companyId)
      : null;

    if (
      settings?.blockDuplicates &&
      ['EXACT_DUPLICATE', 'HIGH_PROBABILITY', 'CONFIRMED_DUPLICATE'].includes(
        document.duplicateStatus,
      )
    ) {
      problems.push('Resolva a duplicidade antes de encaminhar.');
    }

    const blocking = await this.issues.findBlocking(id);
    if (blocking.length > 0) {
      problems.push(
        `Existem pendências bloqueantes: ${blocking.map((issue) => issue.description).join(' ')}`,
      );
    }

    if (
      settings?.mandatoryReview &&
      document.reviewStatus !== IntakeReviewStatus.REVIEWED
    ) {
      problems.push(
        'A revisão é obrigatória nesta empresa. Salve a revisão antes de encaminhar.',
      );
    }

    if (problems.length > 0) {
      throw new BadRequestException(problems.join(' '));
    }

    const [forwarded] = await this.prisma.$transaction([
      this.prisma.intakeDocument.update({
        where: { id },
        data: {
          processingStatus: IntakeProcessingStatus.READY_FOR_PROCESSING,
          reviewStatus: IntakeReviewStatus.REVIEWED,
          forwardedAt: new Date(),
          updatedBy: actor.id,
        },
      }),
      this.prisma.intakeDocumentStatusHistory.create({
        data: {
          documentId: id,
          previousProcessingStatus: document.processingStatus,
          newProcessingStatus: IntakeProcessingStatus.READY_FOR_PROCESSING,
          reason: dto.notes ?? 'Encaminhado para processamento.',
          changedBy: actor.id,
        },
      }),
    ]);

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'FORWARD_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      newValue: {
        processingStatus: IntakeProcessingStatus.READY_FOR_PROCESSING,
        // Deixa explícito que nada financeiro foi criado nesta etapa.
        note: 'Nenhuma obrigação financeira criada: o módulo financeiro consumirá este documento.',
      },
      reason: dto.notes ?? null,
    });

    return forwarded;
  }

  /** Rejeita o documento (seção 46). Mantém histórico e pode ser reaberto. */
  async reject(id: string, dto: RejectDocumentDto, actor: RequestUser) {
    const document = await this.scopeOf(id);

    const rejected = await this.prisma.intakeDocument.update({
      where: { id },
      data: {
        processingStatus: IntakeProcessingStatus.REJECTED,
        reviewStatus: IntakeReviewStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
        rejectionNotes: dto.notes ?? null,
        rejectedAt: new Date(),
        updatedBy: actor.id,
      },
    });

    await this.prisma.intakeDocumentStatusHistory.create({
      data: {
        documentId: id,
        previousProcessingStatus: document.processingStatus,
        newProcessingStatus: IntakeProcessingStatus.REJECTED,
        reason: `${dto.rejectionReason}. ${dto.notes ?? ''}`.trim(),
        changedBy: actor.id,
      },
    });

    await this.pipeline.cancelPendingJobs(id, 'Documento rejeitado.');

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'REJECT_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      newValue: { rejectionReason: dto.rejectionReason },
      reason: dto.notes ?? null,
    });

    return rejected;
  }

  /** Reabre um documento rejeitado ou arquivado. */
  async reopen(id: string, reason: string, actor: RequestUser) {
    const document = await this.scopeOf(id);

    const reopenable: IntakeProcessingStatus[] = [
      IntakeProcessingStatus.REJECTED,
      IntakeProcessingStatus.ARCHIVED,
    ];

    if (!reopenable.includes(document.processingStatus)) {
      throw new BadRequestException(
        'Só é possível reabrir documentos rejeitados ou arquivados.',
      );
    }

    const reopened = await this.prisma.intakeDocument.update({
      where: { id },
      data: {
        processingStatus: IntakeProcessingStatus.PENDING_REVIEW,
        reviewStatus: IntakeReviewStatus.IN_REVIEW,
        rejectedAt: null,
        archivedAt: null,
        updatedBy: actor.id,
      },
    });

    await this.prisma.intakeDocumentStatusHistory.create({
      data: {
        documentId: id,
        previousProcessingStatus: document.processingStatus,
        newProcessingStatus: IntakeProcessingStatus.PENDING_REVIEW,
        reason,
        changedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'REOPEN_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      reason,
    });

    return reopened;
  }

  async archive(id: string, reason: string | undefined, actor: RequestUser) {
    const document = await this.scopeOf(id);

    const archived = await this.prisma.intakeDocument.update({
      where: { id },
      data: {
        processingStatus: IntakeProcessingStatus.ARCHIVED,
        archivedAt: new Date(),
        updatedBy: actor.id,
      },
    });

    await this.prisma.intakeDocumentStatusHistory.create({
      data: {
        documentId: id,
        previousProcessingStatus: document.processingStatus,
        newProcessingStatus: IntakeProcessingStatus.ARCHIVED,
        reason: reason ?? 'Documento arquivado.',
        changedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'ARCHIVE_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      reason: reason ?? null,
    });

    return archived;
  }

  /**
   * Troca a empresa do documento (seção 70).
   *
   * Exige permissão própria (`document_intake.change_company`) porque mover um documento
   * entre empresas move a despesa de um CNPJ para outro — e o controller valida a permissão
   * nas **duas** empresas, a de origem e a de destino.
   */
  async changeCompany(
    id: string,
    companyId: string,
    reason: string,
    actor: RequestUser,
  ) {
    const document = await this.scopeOf(id);

    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        organizationId: document.organizationId,
        deletedAt: null,
      },
      select: { id: true, legalName: true },
    });

    if (!company) {
      throw new BadRequestException(
        'A empresa informada não pertence a esta organização.',
      );
    }

    const updated = await this.prisma.intakeDocument.update({
      where: { id },
      data: { companyId, companyConfidence: 100, updatedBy: actor.id },
    });

    await this.issues.resolveAutomatically(
      id,
      [IntakeIssueType.COMPANY_NOT_IDENTIFIED],
      `Empresa definida manualmente: ${company.legalName ?? companyId}.`,
    );

    await this.audit.log({
      organizationId: document.organizationId,
      companyId,
      userId: actor.id,
      action: 'CHANGE_INTAKE_DOCUMENT_COMPANY',
      entity: 'IntakeDocument',
      entityId: id,
      field: 'companyId',
      oldValue: { companyId: document.companyId },
      newValue: { companyId },
      reason,
    });

    return updated;
  }

  async assign(
    id: string,
    params: {
      assignedUserId?: string;
      assignedTeamId?: string;
      dueAt?: string;
      reason?: string;
    },
    actor: RequestUser,
  ) {
    const document = await this.scopeOf(id);

    if (!params.assignedUserId && !params.assignedTeamId) {
      throw new BadRequestException(
        'Informe o usuário ou a equipe responsável.',
      );
    }

    // Fecha a atribuição anterior em vez de sobrescrever: o histórico de quem foi
    // responsável em cada momento é parte da auditoria.
    await this.prisma.intakeDocumentAssignment.updateMany({
      where: { documentId: id, status: 'ASSIGNED' },
      data: { status: 'REASSIGNED', completedAt: new Date() },
    });

    const [, assignment] = await this.prisma.$transaction([
      this.prisma.intakeDocument.update({
        where: { id },
        data: {
          assignedUserId: params.assignedUserId ?? null,
          assignedTeamId: params.assignedTeamId ?? null,
          updatedBy: actor.id,
        },
      }),
      this.prisma.intakeDocumentAssignment.create({
        data: {
          documentId: id,
          assignedUserId: params.assignedUserId ?? null,
          assignedTeamId: params.assignedTeamId ?? null,
          dueAt: params.dueAt ? new Date(params.dueAt) : null,
          reason: params.reason ?? null,
          assignedBy: actor.id,
        },
      }),
    ]);

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'ASSIGN_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      newValue: {
        assignedUserId: params.assignedUserId,
        assignedTeamId: params.assignedTeamId,
      },
      reason: params.reason ?? null,
    });

    return assignment;
  }

  /**
   * Exclusão **lógica**, e só de rascunho.
   *
   * Documento que já foi processado ou encaminhado não é excluído: existe registro
   * financeiro dependendo dele. Para tirá-lo da caixa de entrada usa-se arquivar.
   */
  async remove(id: string, actor: RequestUser) {
    const document = await this.scopeOf(id);

    const deletable: IntakeProcessingStatus[] = [
      IntakeProcessingStatus.UPLOADED,
      IntakeProcessingStatus.VALIDATING,
      IntakeProcessingStatus.STORED,
      IntakeProcessingStatus.ERROR,
    ];

    if (!deletable.includes(document.processingStatus)) {
      throw new BadRequestException(
        'Este documento já entrou no fluxo e não pode ser excluído. Use rejeitar ou arquivar.',
      );
    }

    if (document.companyId) {
      const settings = await this.findSettings(
        document.organizationId,
        document.companyId,
      );
      if (!settings.allowDraftDeletion) {
        throw new ForbiddenException(
          'A exclusão de rascunhos está desabilitada nos parâmetros desta empresa.',
        );
      }
    }

    const removed = await this.prisma.intakeDocument.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.pipeline.cancelPendingJobs(id, 'Documento excluído.');

    await this.audit.log({
      organizationId: document.organizationId,
      companyId: document.companyId,
      userId: actor.id,
      action: 'DELETE_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
    });

    return removed;
  }

  // ── Divisão e relações (seções 40, 41 e 75) ───────────────────────────────

  /**
   * Divide um documento em parcelas (seção 40).
   *
   * Cria registros **derivados** apontando para o pai; o arquivo original nunca é alterado
   * nem copiado. A soma das parcelas é conferida contra o valor do documento, porque
   * parcelas que não fecham o total é erro de digitação silencioso.
   */
  async split(id: string, dto: SplitDocumentDto, actor: RequestUser) {
    const parent = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (dto.installments.length < 2) {
      throw new BadRequestException('Informe pelo menos duas parcelas.');
    }

    const total = dto.installments.reduce(
      (sum, installment) => sum + installment.amount,
      0,
    );
    const parentAmount =
      parent.grossAmount === null ? null : Number(parent.grossAmount);

    if (parentAmount !== null && Math.abs(total - parentAmount) > 0.01) {
      throw new BadRequestException(
        `A soma das parcelas (R$ ${total.toFixed(2)}) não corresponde ao valor do documento (R$ ${parentAmount.toFixed(2)}).`,
      );
    }

    const created = await this.prisma.$transaction(
      dto.installments.map((installment, index) =>
        this.prisma.intakeDocument.create({
          data: {
            organizationId: parent.organizationId,
            companyId: parent.companyId,
            parentDocumentId: parent.id,
            supplierId: parent.supplierId,
            customerId: parent.customerId,
            documentType: parent.documentType,
            documentDirection: parent.documentDirection,
            sourceChannel: parent.sourceChannel,
            // As parcelas não têm arquivo próprio: o original é o do pai.
            documentNumber:
              installment.documentNumber ??
              `${parent.documentNumber ?? 'DOC'}-${index + 1}/${dto.installments.length}`,
            issueDate: parent.issueDate,
            dueDate: new Date(installment.dueDate),
            grossAmount: installment.amount,
            netAmount: installment.amount,
            description:
              installment.description ??
              `Parcela ${index + 1}/${dto.installments.length} de ${parent.description ?? parent.originalFileName ?? 'documento'}`,
            categoryId: parent.categoryId,
            costCenterId: parent.costCenterId,
            projectId: parent.projectId,
            accountPlanId: parent.accountPlanId,
            financialNatureId: parent.financialNatureId,
            paymentMethodId: parent.paymentMethodId,
            confidence: parent.confidence,
            processingStatus: IntakeProcessingStatus.PENDING_REVIEW,
            priority: parent.priority,
            assignedUserId: parent.assignedUserId,
            createdBy: actor.id,
          },
        }),
      ),
    );

    // O pai sai da fila de encaminhamento: quem segue são as parcelas.
    await this.prisma.intakeDocument.update({
      where: { id },
      data: {
        processingStatus: IntakeProcessingStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    for (const installment of created) {
      await this.prisma.intakeDocumentRelation.create({
        data: {
          sourceDocumentId: installment.id,
          targetDocumentId: parent.id,
          relationType: 'INSTALLMENT_OF',
          createdBy: actor.id,
        },
      });
    }

    await this.audit.log({
      organizationId: parent.organizationId,
      companyId: parent.companyId,
      userId: actor.id,
      action: 'SPLIT_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: id,
      newValue: { installments: created.length, total },
    });

    return created;
  }

  /** Relaciona dois documentos logicamente (seção 41). Os arquivos não são fundidos. */
  async relate(
    id: string,
    params: {
      targetDocumentId: string;
      relationType: IntakeRelationType;
      notes?: string;
    },
    actor: RequestUser,
  ) {
    const [source, target] = await Promise.all([
      this.scopeOf(id),
      this.scopeOf(params.targetDocumentId),
    ]);

    if (source.organizationId !== target.organizationId) {
      throw new BadRequestException(
        'Não é possível relacionar documentos de organizações diferentes.',
      );
    }

    if (id === params.targetDocumentId) {
      throw new BadRequestException(
        'Um documento não pode ser relacionado a si mesmo.',
      );
    }

    const relation = await this.prisma.intakeDocumentRelation.upsert({
      where: {
        sourceDocumentId_targetDocumentId_relationType: {
          sourceDocumentId: id,
          targetDocumentId: params.targetDocumentId,
          relationType: params.relationType,
        },
      },
      create: {
        sourceDocumentId: id,
        targetDocumentId: params.targetDocumentId,
        relationType: params.relationType,
        notes: params.notes ?? null,
        createdBy: actor.id,
      },
      update: { notes: params.notes ?? null },
    });

    await this.audit.log({
      organizationId: source.organizationId,
      companyId: source.companyId,
      userId: actor.id,
      action: 'RELATE_INTAKE_DOCUMENTS',
      entity: 'IntakeDocument',
      entityId: id,
      newValue: {
        targetDocumentId: params.targetDocumentId,
        relationType: params.relationType,
      },
    });

    return relation;
  }

  findRelations(documentId: string) {
    return this.prisma.intakeDocumentRelation.findMany({
      where: {
        OR: [
          { sourceDocumentId: documentId },
          { targetDocumentId: documentId },
        ],
      },
      include: {
        sourceDocument: {
          select: { id: true, originalFileName: true, documentType: true },
        },
        targetDocument: {
          select: { id: true, originalFileName: true, documentType: true },
        },
      },
    });
  }

  async removeRelation(
    documentId: string,
    relationId: string,
    actor: RequestUser,
  ) {
    const relation = await this.prisma.intakeDocumentRelation.findFirst({
      where: {
        id: relationId,
        OR: [
          { sourceDocumentId: documentId },
          { targetDocumentId: documentId },
        ],
      },
    });

    if (!relation)
      throw new NotFoundException('Relacionamento não encontrado.');

    await this.prisma.intakeDocumentRelation.delete({
      where: { id: relationId },
    });

    const scope = await this.scopeOf(documentId);
    await this.audit.log({
      organizationId: scope.organizationId,
      companyId: scope.companyId,
      userId: actor.id,
      action: 'UNRELATE_INTAKE_DOCUMENTS',
      entity: 'IntakeDocument',
      entityId: documentId,
      oldValue: { relationId, relationType: relation.relationType },
    });

    return { removed: true };
  }

  // ── Visão geral (seção 6) ─────────────────────────────────────────────────

  /** Consolidado da entrada de documentos. */
  async findOverview(organizationId: string, companyId?: string) {
    const scope: Prisma.IntakeDocumentWhereInput = {
      organizationId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      awaitingProcessing,
      processing,
      pendingReview,
      possibleDuplicates,
      processedToday,
      withError,
      unassignedCompany,
      byChannel,
      byStatus,
      recentErrors,
      lastBatches,
      identifiedSuppliers,
      totalPayable,
    ] = await Promise.all([
      this.prisma.intakeDocument.count({
        where: {
          ...scope,
          processingStatus: { in: ['UPLOADED', 'STORED', 'QUEUED'] },
        },
      }),
      this.prisma.intakeDocument.count({
        where: {
          ...scope,
          processingStatus: {
            in: [
              'VALIDATING',
              'EXTRACTING',
              'CLASSIFYING',
              'MATCHING',
              'VALIDATING_DATA',
            ],
          },
        },
      }),
      this.prisma.intakeDocument.count({
        where: { ...scope, processingStatus: 'PENDING_REVIEW' },
      }),
      this.prisma.intakeDocument.count({
        where: {
          ...scope,
          duplicateStatus: {
            in: ['POSSIBLE_DUPLICATE', 'HIGH_PROBABILITY', 'EXACT_DUPLICATE'],
          },
        },
      }),
      this.prisma.intakeDocument.count({
        where: { ...scope, processedAt: { gte: startOfToday } },
      }),
      this.prisma.intakeDocument.count({
        where: { ...scope, processingStatus: 'ERROR' },
      }),
      this.prisma.intakeDocument.count({
        where: { organizationId, deletedAt: null, companyId: null },
      }),
      this.prisma.intakeDocument.groupBy({
        by: ['sourceChannel'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.intakeDocument.groupBy({
        by: ['processingStatus'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.intakeDocument.findMany({
        where: { ...scope, processingStatus: 'ERROR' },
        select: { id: true, originalFileName: true, receivedAt: true },
        orderBy: { receivedAt: 'desc' },
        take: 5,
      }),
      this.prisma.intakeBatchImport.findMany({
        where: { organizationId, ...(companyId ? { companyId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.intakeDocument.count({
        where: { ...scope, supplierId: { not: null } },
      }),
      this.prisma.intakeDocument.count({
        where: { ...scope, documentDirection: 'PAYABLE' },
      }),
    ]);

    const issues = await this.issues.countBySeverity(organizationId, companyId);
    const queue = await this.pipeline.queueStatus(organizationId, companyId);
    const averageSeconds = await this.pipeline.averageProcessingSeconds(
      organizationId,
      companyId,
    );

    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    const recognized = await this.prisma.intakeDocument.count({
      where: { ...scope, confidence: { gte: 75 } },
    });

    return {
      cards: {
        awaitingProcessing,
        processing,
        pendingReview,
        possibleDuplicates,
        processedToday,
        withError,
        unassignedCompany,
      },
      issues,
      queue,
      indicators: {
        averageProcessingSeconds: averageSeconds,
        recognizedPercentage:
          total === 0 ? null : Math.round((recognized / total) * 1000) / 10,
        supplierIdentifiedPercentage:
          totalPayable === 0
            ? null
            : Math.round((identifiedSuppliers / totalPayable) * 1000) / 10,
        divergencePercentage:
          total === 0
            ? null
            : Math.round((issues.BLOCKING / total) * 1000) / 10,
      },
      byChannel: byChannel.map((row) => ({
        channel: row.sourceChannel,
        count: row._count._all,
      })),
      byStatus: byStatus.map((row) => ({
        status: row.processingStatus,
        count: row._count._all,
      })),
      recentErrors,
      lastBatches,
      note: 'Nenhum documento desta tela gera obrigação financeira: o encaminhamento entrega o documento ao módulo financeiro, que ainda será construído.',
    };
  }
}

// ── Auxiliares ──────────────────────────────────────────────────────────────

function actorId(actor: RequestUser): string {
  return actor.id;
}

/** Prioridade urgente vai para o começo da fila — sem pular nenhuma validação. */
function priorityWeight(priority: string): number {
  const weights: Record<string, number> = {
    URGENT: 10,
    HIGH: 50,
    NORMAL: 100,
    LOW: 200,
  };
  return weights[priority] ?? 100;
}

function resolveOrder(
  query: IntakeDocumentQueryDto,
): Prisma.IntakeDocumentOrderByWithRelationInput[] {
  const direction = query.order ?? 'desc';

  switch (query.orderBy) {
    case 'dueDate':
      return [{ dueDate: direction }, { receivedAt: 'desc' }];
    case 'grossAmount':
      return [{ grossAmount: direction }];
    case 'confidence':
      return [{ confidence: direction }];
    case 'priority':
      return [{ priority: direction }, { receivedAt: 'desc' }];
    default:
      // Urgente primeiro, depois o mais recente: é a ordem em que o operador trabalha.
      return [{ priority: 'asc' }, { receivedAt: 'desc' }];
  }
}

/**
 * Campos que o mascaramento toca. Tipar isso — em vez de um `Record<string, unknown>` —
 * faz o compilador garantir que nenhum campo sensível fique de fora por descuido.
 */
interface MaskableDocument {
  issuerDocument?: string | null;
  recipientDocument?: string | null;
  digitableLine?: string | null;
  normalizedDigitableLine?: string | null;
  barcode?: string | null;
  normalizedBarcode?: string | null;
  pixKey?: string | null;
  extractedText?: string | null;
}

/**
 * Código de barras ou linha digitável mascarado, mantendo apenas os seis últimos dígitos
 * (seção 81) — o suficiente para o operador reconhecer o documento sem expor o código
 * inteiro, que é o que permite efetuar o pagamento.
 */
function maskCodeValue(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 6) return maskAccountFragment(digits);
  return `${'*'.repeat(digits.length - 6)}${digits.slice(-6)}`;
}

function auditSnapshot(document: {
  documentType: IntakeDocumentType;
  grossAmount: Prisma.Decimal | null;
  netAmount: Prisma.Decimal | null;
  dueDate: Date | null;
  supplierId: string | null;
  customerId: string | null;
}) {
  return {
    documentType: document.documentType,
    grossAmount:
      document.grossAmount === null ? null : Number(document.grossAmount),
    netAmount: document.netAmount === null ? null : Number(document.netAmount),
    dueDate: document.dueDate?.toISOString() ?? null,
    supplierId: document.supplierId,
    customerId: document.customerId,
  };
}
