import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BankStatementImportStatus,
  BankStatementSourceType,
  BankTransactionDirection,
  BankTransactionReconciliationStatus,
  DuplicateStatus,
  Prisma,
  ReconciliationHistoryAction,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../../storage/storage.service';
import { FileValidationService } from '../document-intake/file-validation.service';
import { cents, fromCents } from '../accounts-payable/money.util';
import { BankTransactionNormalizationService } from './bank-transaction-normalization.service';
import { ReconciliationDuplicateService } from './duplicate-detection.service';
import { ReconciliationSettingsService } from './reconciliation-settings.service';
import { OfxImportService } from './parsers/ofx-import.service';
import {
  TabularImportService,
  type ColumnMapping,
  type SignRule,
  type TabularOptions,
} from './parsers/tabular-import.service';
import type {
  ParsedStatement,
  ParsedTransaction,
} from './parsers/parsed-statement';
import type {
  ConfirmImportDto,
  CreateImportDto,
  ImportQueryDto,
  ReasonDto,
} from './dto/reconciliation.dto';

/** Extensões aceitas por formato. */
const EXTENSIONS: Record<string, BankStatementSourceType> = {
  ofx: BankStatementSourceType.OFX,
  qfx: BankStatementSourceType.OFX,
  csv: BankStatementSourceType.CSV,
  txt: BankStatementSourceType.CSV,
  xlsx: BankStatementSourceType.XLSX,
  xls: BankStatementSourceType.XLSX,
};

/** Canais que existem no enum mas ainda não têm leitor (seção 9). */
const NOT_IMPLEMENTED_SOURCES: BankStatementSourceType[] = [
  BankStatementSourceType.CNAB_RETURN,
  BankStatementSourceType.OPEN_FINANCE,
  BankStatementSourceType.BANK_API,
  BankStatementSourceType.EXTERNAL_INTEGRATION,
];

export interface ImportPreview {
  importId: string;
  status: BankStatementImportStatus;
  account: { id: string; name: string };
  period: { start: Date | null; end: Date | null };
  transactionCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  totalCredits: number;
  totalDebits: number;
  openingBalance: number | null;
  closingBalance: number | null;
  calculatedClosingBalance: number | null;
  balanceMatches: boolean | null;
  fileDuplicate: {
    status: DuplicateStatus;
    previousImportId: string | null;
    previousFileName: string | null;
    previousImportedAt: Date | null;
    reasons: string[];
  };
  errors: string[];
  warnings: string[];
  /** Primeiras linhas, para a tabela de prévia da seção 12. */
  rows: {
    lineNumber: number;
    date: Date | null;
    description: string;
    documentNumber: string | null;
    credit: number | null;
    debit: number | null;
    status: 'VALID' | 'INVALID' | 'DUPLICATE';
    duplicateStatus: DuplicateStatus;
    messages: string[];
  }[];
}

/**
 * Importação de extratos (seções 10 a 24).
 *
 * O fluxo é **validar → prever → confirmar**, sempre. Importar direto seria uma chamada a
 * menos e tiraria de quem importa a única chance de ver o que vai entrar antes de entrar —
 * que é exatamente onde o mapeamento errado de colunas é pego.
 *
 * O arquivo original vai para o storage privado antes de qualquer leitura e nunca é
 * reescrito: reprocessar lê de novo o mesmo arquivo.
 */
@Injectable()
export class StatementImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly ofx: OfxImportService,
    private readonly tabular: TabularImportService,
    private readonly normalization: BankTransactionNormalizationService,
    private readonly duplicates: ReconciliationDuplicateService,
    private readonly settings: ReconciliationSettingsService,
  ) {}

  async scopeOf(id: string) {
    return this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        financialAccountId: true,
        status: true,
        storagePath: true,
      },
    });
  }

  // ── Upload e prévia ───────────────────────────────────────────────────────

  /**
   * Recebe o arquivo, armazena, lê e devolve a prévia — **sem** criar transação alguma.
   *
   * A importação nasce em `READY_TO_IMPORT` (ou `FAILED`): as transações só existem depois
   * de alguém confirmar.
   */
  async upload(
    dto: CreateImportDto,
    file: Express.Multer.File,
    actor: RequestActor,
  ): Promise<ImportPreview> {
    const account = await this.prisma.financialAccount.findFirstOrThrow({
      where: { id: dto.financialAccountId, deletedAt: null },
      select: { id: true, companyId: true, name: true, displayName: true },
    });

    if (account.companyId !== dto.companyId) {
      throw new BadRequestException(
        'A conta informada pertence a outra empresa.',
      );
    }

    const config = await this.settings.resolve(
      dto.organizationId,
      dto.companyId,
      dto.financialAccountId,
    );

    if (!config.isEnabled) {
      throw new BadRequestException(
        'Esta conta não participa da conciliação. Habilite-a nas configurações.',
      );
    }

    const validation = await this.fileValidation.validate(
      {
        fileName: file.originalname,
        declaredMimeType: file.mimetype,
        buffer: file.buffer,
      },
      {
        maximumFileSize: config.maximumFileSize,
        allowedExtensions: ['ofx', 'qfx', 'csv', 'txt', 'xlsx', 'xls'],
      },
    );

    if (!validation.accepted) {
      throw new BadRequestException(validation.errors.join(' '));
    }

    const sourceType =
      dto.sourceType ??
      EXTENSIONS[validation.extension] ??
      BankStatementSourceType.CSV;

    if (NOT_IMPLEMENTED_SOURCES.includes(sourceType)) {
      throw new BadRequestException(
        'Este canal de importação está disponível apenas em integração futura.',
      );
    }

    if (!config.allowedImportTypes.includes(sourceType)) {
      throw new BadRequestException(
        'Este formato de arquivo não está habilitado para esta conta.',
      );
    }

    const storagePath = this.buildStoragePath(
      dto,
      validation.normalizedFileName,
    );

    await this.storage.uploadPrivateDocument(
      storagePath,
      file.buffer,
      validation.effectiveMimeType ?? 'application/octet-stream',
    );

    const parsed = await this.read(sourceType, file.buffer, dto);

    const fileDuplicate = config.duplicateCheckEnabled
      ? await this.duplicates.checkFile({
          companyId: dto.companyId,
          financialAccountId: dto.financialAccountId,
          fileHash: validation.fileHash,
          fileName: file.originalname,
          startDate: parsed.header.startDate,
          endDate: parsed.header.endDate,
          transactionCount: parsed.transactions.length,
        })
      : {
          status: DuplicateStatus.NOT_DUPLICATE,
          previousImportId: null,
          previousFileName: null,
          previousImportedAt: null,
          previousImportedBy: null,
          reasons: [],
        };

    const totals = this.totalsOf(parsed.transactions);
    const declaredOpening = dto.openingBalance ?? parsed.header.openingBalance;
    const declaredClosing = dto.closingBalance ?? parsed.header.closingBalance;

    const calculatedClosing =
      declaredOpening === null || declaredOpening === undefined
        ? null
        : fromCents(
            cents(declaredOpening) +
              cents(totals.credits) -
              cents(totals.debits),
          );

    const balanceMatches =
      declaredClosing === null ||
      declaredClosing === undefined ||
      calculatedClosing === null
        ? null
        : cents(declaredClosing) === cents(calculatedClosing);

    if (balanceMatches === false) {
      parsed.warnings.push(
        'O saldo final do extrato não corresponde ao saldo calculado a partir das movimentações.',
      );
    }

    const record = await this.prisma.bankStatementImport.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        financialAccountId: dto.financialAccountId,
        importTemplateId: dto.importTemplateId,
        sourceType,
        originalFileName: file.originalname,
        storagePath,
        mimeType: validation.effectiveMimeType,
        fileExtension: validation.extension,
        fileSize: validation.fileSize,
        fileHash: validation.fileHash,
        bankCode: parsed.header.bankCode,
        agencyNumber: parsed.header.agencyNumber,
        accountNumber: parsed.header.accountNumber,
        currencyCode: parsed.header.currencyCode ?? 'BRL',
        statementStartDate:
          parsed.header.startDate ??
          (dto.statementStartDate ? new Date(dto.statementStartDate) : null),
        statementEndDate:
          parsed.header.endDate ??
          (dto.statementEndDate ? new Date(dto.statementEndDate) : null),
        openingBalance: declaredOpening ?? null,
        closingBalance: declaredClosing ?? null,
        calculatedClosingBalance: calculatedClosing,
        totalCredits: totals.credits,
        totalDebits: totals.debits,
        transactionCount: parsed.transactions.length,
        validTransactionCount: totals.valid,
        invalidTransactionCount: totals.invalid,
        status:
          parsed.errors.length > 0
            ? BankStatementImportStatus.FAILED
            : BankStatementImportStatus.READY_TO_IMPORT,
        errorMessage: parsed.errors[0] ?? null,
        duplicateOfImportId: fileDuplicate.previousImportId,
        importMetadata: {
          errors: parsed.errors,
          warnings: parsed.warnings,
          fileDuplicate: {
            status: fileDuplicate.status,
            reasons: fileDuplicate.reasons,
          },
          options: (dto.options ?? {}) as Prisma.InputJsonValue,
          notes: dto.notes ?? null,
        },
        importedBy: actor.id,
        validatedAt: new Date(),
        history: {
          create: {
            organizationId: dto.organizationId,
            companyId: dto.companyId,
            financialAccountId: dto.financialAccountId,
            actionType: ReconciliationHistoryAction.FILE_UPLOADED,
            newStatus:
              parsed.errors.length > 0
                ? BankStatementImportStatus.FAILED
                : BankStatementImportStatus.READY_TO_IMPORT,
            details: {
              fileName: file.originalname,
              transactions: parsed.transactions.length,
            },
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    // A duplicidade por transação depende do que já existe no banco, então é conferida
    // aqui e guardada na prévia — recalculá-la na confirmação daria um número diferente
    // do que a pessoa viu ao decidir.
    const duplicateFlags = config.duplicateCheckEnabled
      ? await this.flagDuplicates(dto, parsed.transactions)
      : new Map<number, DuplicateStatus>();

    await this.prisma.bankStatementImport.update({
      where: { id: record.id },
      data: {
        duplicateTransactionCount: [...duplicateFlags.values()].filter(
          (status) => status !== DuplicateStatus.NOT_DUPLICATE,
        ).length,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'reconciliation.file_uploaded',
      entity: 'BankStatementImport',
      entityId: record.id,
      newValue: {
        fileName: file.originalname,
        // O hash entra no log; o conteúdo do extrato, nunca.
        fileHash: validation.fileHash,
        transactions: parsed.transactions.length,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.buildPreview(
      record.id,
      account,
      parsed,
      totals,
      fileDuplicate,
      duplicateFlags,
      {
        opening: declaredOpening ?? null,
        closing: declaredClosing ?? null,
        calculated: calculatedClosing,
        matches: balanceMatches,
      },
    );
  }

  /** Confirma a importação: é aqui que as transações passam a existir. */
  async confirm(id: string, dto: ConfirmImportDto, actor: RequestActor) {
    const record = await this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (record.status === BankStatementImportStatus.IMPORTED) {
      throw new BadRequestException('Este arquivo já foi importado.');
    }

    if (record.status !== BankStatementImportStatus.READY_TO_IMPORT) {
      throw new BadRequestException(
        'Este arquivo não está pronto para importação. Valide-o novamente.',
      );
    }

    const config = await this.settings.resolve(
      record.organizationId,
      record.companyId,
      record.financialAccountId,
    );

    const metadata = (record.importMetadata ?? {}) as {
      fileDuplicate?: { status?: DuplicateStatus };
      options?: Record<string, unknown>;
    };

    const fileDuplicateStatus =
      metadata.fileDuplicate?.status ?? DuplicateStatus.NOT_DUPLICATE;

    if (
      fileDuplicateStatus !== DuplicateStatus.NOT_DUPLICATE &&
      config.blockDuplicates &&
      !dto.duplicateOverrideReason
    ) {
      throw new BadRequestException(
        'Este arquivo pode já ter sido importado. Informe a justificativa para continuar.',
      );
    }

    if (!record.storagePath) {
      throw new BadRequestException(
        'O arquivo de origem não está mais disponível para leitura.',
      );
    }

    const buffer = await this.storage.downloadPrivateDocument(
      record.storagePath,
    );
    const parsed = await this.read(record.sourceType, buffer, {
      importTemplateId: record.importTemplateId ?? undefined,
      options: metadata.options,
    });

    const skip = new Set(dto.skipLines ?? []);

    const duplicateFlags = config.duplicateCheckEnabled
      ? await this.flagDuplicates(
          {
            companyId: record.companyId,
            financialAccountId: record.financialAccountId,
          },
          parsed.transactions,
        )
      : new Map<number, DuplicateStatus>();

    let imported = 0;
    let skipped = 0;

    for (const transaction of parsed.transactions) {
      if (skip.has(transaction.lineNumber)) {
        skipped += 1;
        continue;
      }

      if (transaction.errors.length > 0 || transaction.direction === null) {
        skipped += 1;
        continue;
      }

      const duplicateStatus =
        duplicateFlags.get(transaction.lineNumber) ??
        DuplicateStatus.NOT_DUPLICATE;

      if (
        duplicateStatus !== DuplicateStatus.NOT_DUPLICATE &&
        config.blockDuplicates &&
        !dto.importDuplicates
      ) {
        skipped += 1;
        continue;
      }

      const normalized = this.normalization.normalize(
        transaction,
        transaction.direction,
      );

      await this.prisma.bankTransaction.create({
        data: {
          organizationId: record.organizationId,
          companyId: record.companyId,
          financialAccountId: record.financialAccountId,
          statementImportId: record.id,
          sourceType: record.sourceType,
          externalTransactionId: transaction.externalTransactionId,
          fitId: transaction.fitId,
          transactionCode: transaction.transactionCode,
          transactionType: normalized.transactionType,
          direction: transaction.direction,
          transactionDate: transaction.transactionDate as Date,
          postingDate: transaction.postingDate,
          amount: transaction.amount as number,
          currencyCode: record.currencyCode,
          runningBalance: transaction.runningBalance,
          documentNumber: normalized.documentNumber,
          checkNumber: transaction.checkNumber,
          referenceNumber: transaction.referenceNumber,
          originalDescription: transaction.originalDescription,
          normalizedDescription: normalized.normalizedDescription,
          payerName: normalized.payerName,
          payeeName: normalized.payeeName,
          bankCode: record.bankCode,
          agencyNumber: record.agencyNumber,
          accountNumber: record.accountNumber,
          pixEndToEndId: normalized.pixEndToEndId,
          isDuplicate: duplicateStatus !== DuplicateStatus.NOT_DUPLICATE,
          duplicateStatus,
          reconciliationStatus:
            duplicateStatus === DuplicateStatus.EXACT
              ? BankTransactionReconciliationStatus.DUPLICATE
              : BankTransactionReconciliationStatus.AVAILABLE,
          rawData: {
            ...transaction.rawData,
            appliedRule: normalized.appliedRule,
          },
          createdBy: actor.id,
        },
      });

      imported += 1;
    }

    const totals = this.totalsOf(parsed.transactions);

    const updated = await this.prisma.bankStatementImport.update({
      where: { id },
      data: {
        status:
          skipped === 0
            ? BankStatementImportStatus.IMPORTED
            : BankStatementImportStatus.PARTIALLY_IMPORTED,
        validTransactionCount: imported,
        invalidTransactionCount: skipped,
        totalCredits: totals.credits,
        totalDebits: totals.debits,
        duplicateOverrideReason: dto.duplicateOverrideReason,
        importedAt: new Date(),
        history: {
          create: {
            organizationId: record.organizationId,
            companyId: record.companyId,
            financialAccountId: record.financialAccountId,
            actionType: ReconciliationHistoryAction.FILE_IMPORTED,
            previousStatus: record.status,
            newStatus:
              skipped === 0
                ? BankStatementImportStatus.IMPORTED
                : BankStatementImportStatus.PARTIALLY_IMPORTED,
            details: { imported, skipped },
            reason: dto.duplicateOverrideReason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: record.organizationId,
      companyId: record.companyId,
      userId: actor.id,
      action: 'reconciliation.file_imported',
      entity: 'BankStatementImport',
      entityId: id,
      newValue: { imported, skipped },
      reason: dto.duplicateOverrideReason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { ...updated, imported, skipped };
  }

  // ── Consulta e ciclo de vida ──────────────────────────────────────────────

  async findAll(query: ImportQueryDto) {
    const where: Prisma.BankStatementImportWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.importedBy ? { importedBy: query.importedBy } : {}),
      ...(query.hasError ? { NOT: { errorMessage: null } } : {}),
      ...(query.hasDuplicate ? { duplicateTransactionCount: { gt: 0 } } : {}),
      ...(query.periodFrom || query.periodTo
        ? {
            statementStartDate: {
              ...(query.periodFrom ? { gte: new Date(query.periodFrom) } : {}),
            },
            statementEndDate: {
              ...(query.periodTo ? { lte: new Date(query.periodTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? { originalFileName: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.bankStatementImport.findMany({
        where,
        include: {
          company: { select: { id: true, legalName: true, tradeName: true } },
          financialAccount: {
            select: { id: true, name: true, displayName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.bankStatementImport.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    return this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, legalName: true, tradeName: true } },
        financialAccount: {
          select: { id: true, name: true, displayName: true },
        },
        importTemplate: { select: { id: true, name: true } },
        duplicateOf: {
          select: { id: true, originalFileName: true, importedAt: true },
        },
        history: { orderBy: { performedAt: 'desc' }, take: 100 },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /** URL assinada de curta duração. A permissão é conferida no controlador. */
  async downloadUrl(id: string, actor: RequestActor) {
    const record = await this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: {
        organizationId: true,
        companyId: true,
        financialAccountId: true,
        storagePath: true,
        originalFileName: true,
      },
    });

    if (!record.storagePath) {
      throw new BadRequestException('Este arquivo não está mais disponível.');
    }

    const signed = await this.storage.createSignedUrl(record.storagePath);

    await this.prisma.reconciliationHistory.create({
      data: {
        organizationId: record.organizationId,
        companyId: record.companyId,
        financialAccountId: record.financialAccountId,
        statementImportId: id,
        actionType: ReconciliationHistoryAction.FILE_DOWNLOADED,
        performedBy: actor.id,
        ipAddress: actor.ipAddress,
        deviceInfo: actor.userAgent,
      },
    });

    await this.audit.log({
      organizationId: record.organizationId,
      companyId: record.companyId,
      userId: actor.id,
      action: 'reconciliation.file_downloaded',
      entity: 'BankStatementImport',
      entityId: id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { ...signed, fileName: record.originalFileName };
  }

  /**
   * Reprocessa o arquivo já armazenado.
   *
   * Apaga as transações que **esta** importação criou e lê o arquivo de novo. Só é
   * permitido enquanto nenhuma delas estiver conciliada: reprocessar por cima de uma
   * conciliação apagaria o vínculo sem que ninguém tivesse decidido desfazê-lo.
   */
  async reprocess(id: string, actor: RequestActor) {
    const record = await this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const reconciled = await this.prisma.bankTransaction.count({
      where: {
        statementImportId: id,
        deletedAt: null,
        reconciliationStatus: {
          in: [
            BankTransactionReconciliationStatus.MATCHED,
            BankTransactionReconciliationStatus.MANUALLY_MATCHED,
            BankTransactionReconciliationStatus.PARTIALLY_MATCHED,
          ],
        },
      },
    });

    if (reconciled > 0) {
      throw new BadRequestException(
        `Há ${reconciled} transação(ões) já conciliada(s) neste arquivo. Desfaça a conciliação antes de reprocessar.`,
      );
    }

    await this.prisma.bankTransaction.deleteMany({
      where: { statementImportId: id },
    });

    await this.prisma.bankStatementImport.update({
      where: { id },
      data: {
        status: BankStatementImportStatus.READY_TO_IMPORT,
        reprocessedAt: new Date(),
        validTransactionCount: 0,
        invalidTransactionCount: 0,
        history: {
          create: {
            organizationId: record.organizationId,
            companyId: record.companyId,
            financialAccountId: record.financialAccountId,
            actionType: ReconciliationHistoryAction.FILE_REPROCESSED,
            previousStatus: record.status,
            newStatus: BankStatementImportStatus.READY_TO_IMPORT,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: record.organizationId,
      companyId: record.companyId,
      userId: actor.id,
      action: 'reconciliation.file_reprocessed',
      entity: 'BankStatementImport',
      entityId: id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(id);
  }

  async cancel(id: string, dto: ReasonDto, actor: RequestActor) {
    const record = await this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (record.status === BankStatementImportStatus.IMPORTED) {
      throw new BadRequestException(
        'Este arquivo já foi importado. Reprocesse-o em vez de cancelar.',
      );
    }

    await this.prisma.bankStatementImport.update({
      where: { id },
      data: {
        status: BankStatementImportStatus.CANCELLED,
        cancelledAt: new Date(),
        history: {
          create: {
            organizationId: record.organizationId,
            companyId: record.companyId,
            financialAccountId: record.financialAccountId,
            actionType: ReconciliationHistoryAction.FILE_CANCELLED,
            previousStatus: record.status,
            newStatus: BankStatementImportStatus.CANCELLED,
            reason: dto.reason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: record.organizationId,
      companyId: record.companyId,
      userId: actor.id,
      action: 'reconciliation.file_cancelled',
      entity: 'BankStatementImport',
      entityId: id,
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(id);
  }

  async archive(id: string, actor: RequestActor) {
    const record = await this.prisma.bankStatementImport.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    await this.prisma.bankStatementImport.update({
      where: { id },
      data: {
        status: BankStatementImportStatus.ARCHIVED,
        archivedAt: new Date(),
        history: {
          create: {
            organizationId: record.organizationId,
            companyId: record.companyId,
            financialAccountId: record.financialAccountId,
            actionType: ReconciliationHistoryAction.FILE_ARCHIVED,
            previousStatus: record.status,
            newStatus: BankStatementImportStatus.ARCHIVED,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    return this.findOne(id);
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /** Escolhe o parser e devolve o extrato lido. */
  private async read(
    sourceType: BankStatementSourceType,
    buffer: Buffer,
    dto: Pick<CreateImportDto, 'importTemplateId' | 'options'>,
  ): Promise<ParsedStatement> {
    if (sourceType === BankStatementSourceType.OFX) {
      return this.ofx.parse(buffer);
    }

    const options = await this.tabularOptions(dto);

    const grid =
      sourceType === BankStatementSourceType.XLSX
        ? await this.tabular.parseSpreadsheetGrid(buffer)
        : this.tabular.parseCsvGrid(
            buffer,
            options.delimiter ?? this.tabular.detectDelimiter(buffer),
            options.encoding ?? 'utf8',
          );

    return this.tabular.toStatement(grid, options);
  }

  /** Junta o modelo salvo com o que veio na requisição. O informado vence. */
  private async tabularOptions(
    dto: Pick<CreateImportDto, 'importTemplateId' | 'options'>,
  ): Promise<TabularOptions> {
    const template = dto.importTemplateId
      ? await this.prisma.bankStatementImportTemplate.findFirst({
          where: { id: dto.importTemplateId, deletedAt: null },
        })
      : null;

    const columnMapping =
      dto.options?.columnMapping ??
      (template?.columnMapping as unknown as ColumnMapping | undefined);

    const signRule =
      (dto.options?.signRule as unknown as SignRule | undefined) ??
      (template?.signRule as unknown as SignRule | undefined);

    if (!columnMapping || !signRule) {
      throw new BadRequestException(
        'Informe o mapeamento de colunas e a regra de sinal, ou escolha um modelo de importação.',
      );
    }

    if (template) {
      await this.prisma.bankStatementImportTemplate.update({
        where: { id: template.id },
        data: { lastUsedAt: new Date() },
      });
    }

    return {
      columnMapping,
      signRule,
      delimiter: dto.options?.delimiter ?? template?.delimiter ?? undefined,
      encoding: dto.options?.encoding ?? template?.encoding ?? undefined,
      dateFormat: dto.options?.dateFormat ?? template?.dateFormat ?? undefined,
      decimalSeparator:
        dto.options?.decimalSeparator ??
        template?.decimalSeparator ??
        undefined,
      thousandSeparator:
        dto.options?.thousandSeparator ??
        template?.thousandSeparator ??
        undefined,
      headerRow: dto.options?.headerRow ?? template?.headerRow ?? undefined,
      dataStartRow:
        dto.options?.dataStartRow ?? template?.dataStartRow ?? undefined,
      footerRowsToIgnore:
        dto.options?.footerRowsToIgnore ??
        template?.footerRowsToIgnore ??
        undefined,
    };
  }

  private async flagDuplicates(
    scope: { companyId: string; financialAccountId: string },
    transactions: ParsedTransaction[],
  ): Promise<Map<number, DuplicateStatus>> {
    const flags = new Map<number, DuplicateStatus>();

    for (const transaction of transactions) {
      if (transaction.direction === null || transaction.amount === null)
        continue;

      const diagnosis = await this.duplicates.checkTransaction({
        companyId: scope.companyId,
        financialAccountId: scope.financialAccountId,
        transaction,
        direction: transaction.direction,
        amount: transaction.amount,
        normalizedDescription: transaction.originalDescription
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toUpperCase()
          .replace(/[^A-Z0-9\s/-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      });

      flags.set(transaction.lineNumber, diagnosis.status);
    }

    return flags;
  }

  private totalsOf(transactions: ParsedTransaction[]) {
    let credits = 0;
    let debits = 0;
    let valid = 0;
    let invalid = 0;

    for (const transaction of transactions) {
      if (transaction.errors.length > 0 || transaction.direction === null) {
        invalid += 1;
        continue;
      }

      valid += 1;

      if (transaction.direction === BankTransactionDirection.IN) {
        credits += cents(transaction.amount ?? 0);
      } else {
        debits += cents(transaction.amount ?? 0);
      }
    }

    return {
      credits: fromCents(credits),
      debits: fromCents(debits),
      valid,
      invalid,
    };
  }

  /** `organizations/{org}/companies/{empresa}/reconciliation/{conta}/{ano}/{mês}` (seção 17). */
  private buildStoragePath(dto: CreateImportDto, fileName: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    return [
      'organizations',
      dto.organizationId,
      'companies',
      dto.companyId,
      'reconciliation',
      dto.financialAccountId,
      String(year),
      month,
      `${Date.now()}-${fileName}`,
    ].join('/');
  }

  private buildPreview(
    importId: string,
    account: { id: string; name: string; displayName: string | null },
    parsed: ParsedStatement,
    totals: { credits: number; debits: number; valid: number; invalid: number },
    fileDuplicate: {
      status: DuplicateStatus;
      previousImportId: string | null;
      previousFileName: string | null;
      previousImportedAt: Date | null;
      reasons: string[];
    },
    duplicateFlags: Map<number, DuplicateStatus>,
    balances: {
      opening: number | null;
      closing: number | null;
      calculated: number | null;
      matches: boolean | null;
    },
  ): ImportPreview {
    const duplicateCount = [...duplicateFlags.values()].filter(
      (status) => status !== DuplicateStatus.NOT_DUPLICATE,
    ).length;

    return {
      importId,
      status:
        parsed.errors.length > 0
          ? BankStatementImportStatus.FAILED
          : BankStatementImportStatus.READY_TO_IMPORT,
      account: { id: account.id, name: account.displayName ?? account.name },
      period: { start: parsed.header.startDate, end: parsed.header.endDate },
      transactionCount: parsed.transactions.length,
      validCount: totals.valid,
      invalidCount: totals.invalid,
      duplicateCount,
      totalCredits: totals.credits,
      totalDebits: totals.debits,
      openingBalance: balances.opening,
      closingBalance: balances.closing,
      calculatedClosingBalance: balances.calculated,
      balanceMatches: balances.matches,
      fileDuplicate,
      errors: parsed.errors,
      warnings: parsed.warnings,
      rows: parsed.transactions.slice(0, 200).map((transaction) => {
        const duplicateStatus =
          duplicateFlags.get(transaction.lineNumber) ??
          DuplicateStatus.NOT_DUPLICATE;

        return {
          lineNumber: transaction.lineNumber,
          date: transaction.transactionDate,
          description: transaction.originalDescription,
          documentNumber: transaction.documentNumber,
          credit:
            transaction.direction === BankTransactionDirection.IN
              ? transaction.amount
              : null,
          debit:
            transaction.direction === BankTransactionDirection.OUT
              ? transaction.amount
              : null,
          status:
            transaction.errors.length > 0
              ? ('INVALID' as const)
              : duplicateStatus !== DuplicateStatus.NOT_DUPLICATE
                ? ('DUPLICATE' as const)
                : ('VALID' as const),
          duplicateStatus,
          messages: transaction.errors,
        };
      }),
    };
  }
}
