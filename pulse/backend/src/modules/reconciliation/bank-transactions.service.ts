import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BankStatementSourceType,
  BankTransactionDirection,
  BankTransactionReconciliationStatus,
  MatchSuggestionStatus,
  Prisma,
  ReconciliationHistoryAction,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import { maskAccountFragment } from '../../common/utils/mask.util';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { cents } from '../accounts-payable/money.util';
import { BankTransactionNormalizationService } from './bank-transaction-normalization.service';
import { ReconciliationDuplicateService } from './duplicate-detection.service';
import { ReconciliationSettingsService } from './reconciliation-settings.service';
import {
  ReconciliationMatchingService,
  confidenceOf,
} from './reconciliation-matching.service';
import type {
  AssignTransactionDto,
  DismissSuggestionDto,
  GenerateSuggestionsDto,
  ManualTransactionDto,
  ReasonDto,
  TransactionQueryDto,
  UpdateTransactionDto,
} from './dto/reconciliation.dto';

const TRANSACTION_INCLUDE = {
  financialAccount: {
    select: {
      id: true,
      name: true,
      displayName: true,
      accountNumber: true,
      branchNumber: true,
    },
  },
  company: { select: { id: true, legalName: true, tradeName: true } },
  statementImport: {
    select: { id: true, originalFileName: true, sourceType: true },
  },
} satisfies Prisma.BankTransactionInclude;

/** Situações em que a transação ainda espera conciliação. */
const PENDING_STATUSES: BankTransactionReconciliationStatus[] = [
  BankTransactionReconciliationStatus.IMPORTED,
  BankTransactionReconciliationStatus.AVAILABLE,
  BankTransactionReconciliationStatus.MATCH_SUGGESTED,
  BankTransactionReconciliationStatus.PARTIALLY_MATCHED,
  BankTransactionReconciliationStatus.UNIDENTIFIED,
];

/**
 * Movimentações bancárias: consulta, digitação manual, sugestões e triagem.
 *
 * O dado importado é imutável aqui: o que se pode alterar é a **leitura** (tipo, documento,
 * nome da contraparte), nunca o valor, a data ou o histórico original. Corrigir o que o
 * banco mandou seria reescrever o extrato.
 */
@Injectable()
export class BankTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly normalization: BankTransactionNormalizationService,
    private readonly duplicates: ReconciliationDuplicateService,
    private readonly matching: ReconciliationMatchingService,
    private readonly settings: ReconciliationSettingsService,
  ) {}

  async scopeOf(id: string) {
    return this.prisma.bankTransaction.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        financialAccountId: true,
        reconciliationStatus: true,
      },
    });
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  async findAll(query: TransactionQueryDto, actor: RequestActor) {
    const where: Prisma.BankTransactionWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.statementImportId
        ? { statementImportId: query.statementImportId }
        : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.transactionType
        ? { transactionType: query.transactionType }
        : {}),
      ...(query.reconciliationStatus
        ? { reconciliationStatus: query.reconciliationStatus }
        : {}),
      ...(query.duplicateStatus
        ? { duplicateStatus: query.duplicateStatus }
        : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
      ...(query.isManual !== undefined ? { isManual: query.isManual } : {}),
      ...(query.pendingOnly
        ? { reconciliationStatus: { in: PENDING_STATUSES } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            transactionDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.minAmount !== undefined || query.maxAmount !== undefined
        ? {
            amount: {
              ...(query.minAmount !== undefined
                ? { gte: query.minAmount }
                : {}),
              ...(query.maxAmount !== undefined
                ? { lte: query.maxAmount }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                originalDescription: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                documentNumber: { contains: query.search, mode: 'insensitive' },
              },
              { payerName: { contains: query.search, mode: 'insensitive' } },
              { payeeName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        include: {
          ...TRANSACTION_INCLUDE,
          suggestions: {
            where: { status: MatchSuggestionStatus.PENDING },
            orderBy: { score: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);

    const canSeeSensitive = this.canSeeSensitive(actor);

    return paginate(
      items.map((item) => this.mask(item, canSeeSensitive)),
      total,
      query.page,
      query.perPage,
    );
  }

  async findOne(id: string, actor: RequestActor) {
    const transaction = await this.prisma.bankTransaction.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        ...TRANSACTION_INCLUDE,
        suggestions: { orderBy: { score: 'desc' } },
        reconciliationItems: {
          include: {
            reconciliation: {
              select: {
                id: true,
                status: true,
                reconciliationType: true,
                reconciledAt: true,
                differenceAmount: true,
              },
            },
          },
        },
        assignments: { orderBy: { assignedAt: 'desc' }, take: 5 },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        history: { orderBy: { performedAt: 'desc' }, take: 100 },
      },
    });

    return this.mask(transaction, this.canSeeSensitive(actor));
  }

  async history(id: string) {
    return this.prisma.reconciliationHistory.findMany({
      where: { bankTransactionId: id },
      orderBy: { performedAt: 'desc' },
      take: 200,
    });
  }

  // ── Digitação manual (seção 16) ───────────────────────────────────────────

  /**
   * Cria uma movimentação digitada.
   *
   * Marcada como manual, com motivo obrigatório e `sourceType: MANUAL`. Ela **não pode**
   * simular origem bancária: sem essa distinção, uma conciliação fechada com dados
   * inventados seria indistinguível de uma fechada contra o extrato de verdade.
   */
  async createManual(dto: ManualTransactionDto, actor: RequestActor) {
    const account = await this.prisma.financialAccount.findFirstOrThrow({
      where: { id: dto.financialAccountId, deletedAt: null },
      select: { id: true, companyId: true },
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

    if (!config.manualTransactionEnabled) {
      throw new BadRequestException(
        'A digitação manual de movimentações está desabilitada para esta conta.',
      );
    }

    const normalized = this.normalization.normalize(
      {
        lineNumber: 0,
        transactionDate: new Date(dto.transactionDate),
        postingDate: dto.postingDate ? new Date(dto.postingDate) : null,
        amount: dto.amount,
        direction: dto.direction,
        originalDescription: dto.description,
        documentNumber: dto.documentNumber ?? null,
        checkNumber: null,
        referenceNumber: null,
        externalTransactionId: dto.externalTransactionId ?? null,
        fitId: null,
        transactionCode: null,
        payerName: dto.payerName ?? null,
        payeeName: dto.payeeName ?? null,
        runningBalance: null,
        rawData: {},
        errors: [],
      },
      dto.direction,
    );

    const duplicate = config.duplicateCheckEnabled
      ? await this.duplicates.checkTransaction({
          companyId: dto.companyId,
          financialAccountId: dto.financialAccountId,
          transaction: {
            lineNumber: 0,
            transactionDate: new Date(dto.transactionDate),
            postingDate: null,
            amount: dto.amount,
            direction: dto.direction,
            originalDescription: dto.description,
            documentNumber: dto.documentNumber ?? null,
            checkNumber: null,
            referenceNumber: null,
            externalTransactionId: dto.externalTransactionId ?? null,
            fitId: null,
            transactionCode: null,
            payerName: null,
            payeeName: null,
            runningBalance: null,
            rawData: {},
            errors: [],
          },
          direction: dto.direction,
          amount: dto.amount,
          normalizedDescription: normalized.normalizedDescription,
        })
      : null;

    const created = await this.prisma.bankTransaction.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        financialAccountId: dto.financialAccountId,
        sourceType: BankStatementSourceType.MANUAL,
        transactionType: dto.transactionType ?? normalized.transactionType,
        direction: dto.direction,
        transactionDate: new Date(dto.transactionDate),
        postingDate: dto.postingDate ? new Date(dto.postingDate) : null,
        amount: dto.amount,
        originalDescription: dto.description,
        normalizedDescription: normalized.normalizedDescription,
        documentNumber: dto.documentNumber,
        externalTransactionId: dto.externalTransactionId,
        payerName: dto.payerName,
        payeeName: dto.payeeName,
        pixEndToEndId: normalized.pixEndToEndId,
        isManual: true,
        manualReason: dto.manualReason,
        isDuplicate: duplicate ? duplicate.status !== 'NOT_DUPLICATE' : false,
        duplicateStatus: duplicate?.status ?? 'NOT_DUPLICATE',
        duplicateOfTransactionId: duplicate?.duplicateOfTransactionId ?? null,
        reconciliationStatus: BankTransactionReconciliationStatus.AVAILABLE,
        rawData: { notes: dto.notes ?? null },
        createdBy: actor.id,
        history: {
          create: {
            organizationId: dto.organizationId,
            companyId: dto.companyId,
            financialAccountId: dto.financialAccountId,
            actionType: ReconciliationHistoryAction.TRANSACTION_MANUAL_CREATED,
            newStatus: BankTransactionReconciliationStatus.AVAILABLE,
            reason: dto.manualReason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'reconciliation.manual_transaction_created',
      entity: 'BankTransaction',
      entityId: created.id,
      newValue: {
        amount: dto.amount,
        direction: dto.direction,
        transactionDate: dto.transactionDate,
      },
      reason: dto.manualReason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return created;
  }

  /** Corrige a **leitura** da transação. Valor, data e histórico original não mudam. */
  async update(id: string, dto: UpdateTransactionDto, actor: RequestActor) {
    const transaction = await this.prisma.bankTransaction.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const updated = await this.prisma.bankTransaction.update({
      where: { id },
      data: {
        ...(dto.transactionType
          ? { transactionType: dto.transactionType }
          : {}),
        ...(dto.documentNumber !== undefined
          ? { documentNumber: dto.documentNumber }
          : {}),
        ...(dto.payerName !== undefined ? { payerName: dto.payerName } : {}),
        ...(dto.payeeName !== undefined ? { payeeName: dto.payeeName } : {}),
        updatedBy: actor.id,
        history: {
          create: {
            organizationId: transaction.organizationId,
            companyId: transaction.companyId,
            financialAccountId: transaction.financialAccountId,
            actionType: ReconciliationHistoryAction.TRANSACTION_UPDATED,
            details: dto as unknown as Prisma.InputJsonValue,
            reason: dto.reason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: transaction.organizationId,
      companyId: transaction.companyId,
      userId: actor.id,
      action: 'reconciliation.transaction_updated',
      entity: 'BankTransaction',
      entityId: id,
      oldValue: {
        transactionType: transaction.transactionType,
        documentNumber: transaction.documentNumber,
      },
      newValue: dto as unknown as Prisma.InputJsonValue,
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /** Tira a transação da fila sem conciliá-la — tarifa conhecida, movimento de terceiro. */
  async ignore(id: string, dto: ReasonDto, actor: RequestActor) {
    const transaction = await this.prisma.bankTransaction.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (
      transaction.reconciliationStatus ===
        BankTransactionReconciliationStatus.MATCHED ||
      transaction.reconciliationStatus ===
        BankTransactionReconciliationStatus.MANUALLY_MATCHED
    ) {
      throw new BadRequestException(
        'Esta transação já está conciliada. Desfaça a conciliação antes de ignorá-la.',
      );
    }

    const updated = await this.prisma.bankTransaction.update({
      where: { id },
      data: {
        reconciliationStatus: BankTransactionReconciliationStatus.IGNORED,
        ignoredReason: dto.reason,
        updatedBy: actor.id,
        history: {
          create: {
            organizationId: transaction.organizationId,
            companyId: transaction.companyId,
            financialAccountId: transaction.financialAccountId,
            actionType: ReconciliationHistoryAction.TRANSACTION_IGNORED,
            previousStatus: transaction.reconciliationStatus,
            newStatus: BankTransactionReconciliationStatus.IGNORED,
            reason: dto.reason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: transaction.organizationId,
      companyId: transaction.companyId,
      userId: actor.id,
      action: 'reconciliation.transaction_ignored',
      entity: 'BankTransaction',
      entityId: id,
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async assign(id: string, dto: AssignTransactionDto, actor: RequestActor) {
    const transaction = await this.prisma.bankTransaction.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    await this.prisma.reconciliationAssignment.create({
      data: {
        organizationId: transaction.organizationId,
        companyId: transaction.companyId,
        bankTransactionId: id,
        assignedUserId: dto.assignedUserId,
        assignedTeam: dto.assignedTeam,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        reason: dto.reason,
        assignedBy: actor.id,
      },
    });

    const updated = await this.prisma.bankTransaction.update({
      where: { id },
      data: {
        assignedUserId: dto.assignedUserId ?? null,
        history: {
          create: {
            organizationId: transaction.organizationId,
            companyId: transaction.companyId,
            financialAccountId: transaction.financialAccountId,
            actionType: ReconciliationHistoryAction.ASSIGNED,
            details: {
              assignedUserId: dto.assignedUserId,
              assignedTeam: dto.assignedTeam,
            },
            reason: dto.reason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: transaction.organizationId,
      companyId: transaction.companyId,
      userId: actor.id,
      action: 'reconciliation.transaction_assigned',
      entity: 'BankTransaction',
      entityId: id,
      newValue: {
        assignedUserId: dto.assignedUserId,
        assignedTeam: dto.assignedTeam,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  // ── Sugestões (seções 28 a 31) ────────────────────────────────────────────

  /**
   * Gera sugestões para uma transação.
   *
   * As pendentes anteriores são apagadas: manter sugestões de uma rodada antiga faria a
   * tela mostrar candidatos que o motor já não recomendaria — e alguém aceitaria um deles.
   */
  async generateSuggestions(transactionId: string, actor: RequestActor) {
    const transaction = await this.prisma.bankTransaction.findFirstOrThrow({
      where: { id: transactionId, deletedAt: null },
    });

    if (
      transaction.reconciliationStatus ===
        BankTransactionReconciliationStatus.MATCHED ||
      transaction.reconciliationStatus ===
        BankTransactionReconciliationStatus.MANUALLY_MATCHED
    ) {
      throw new BadRequestException('Esta transação já está conciliada.');
    }

    const config = await this.settings.resolve(
      transaction.organizationId,
      transaction.companyId,
      transaction.financialAccountId,
    );

    const matches = await this.matching.findCandidates({
      companyId: transaction.companyId,
      financialAccountId: transaction.financialAccountId,
      direction: transaction.direction,
      amount: Number(transaction.amount),
      transactionDate: transaction.transactionDate,
      normalizedDescription: transaction.normalizedDescription ?? '',
      documentNumber: transaction.documentNumber,
      pixEndToEndId: transaction.pixEndToEndId,
      dateToleranceDays: config.dateToleranceDays,
      amountTolerance: Number(config.amountTolerance),
      percentageTolerance: Number(config.percentageTolerance),
    });

    const minimum = Number(config.minimumSuggestionScore);
    const relevant = matches.filter((match) => match.score >= minimum);

    await this.prisma.reconciliationMatchSuggestion.deleteMany({
      where: {
        bankTransactionId: transactionId,
        status: MatchSuggestionStatus.PENDING,
      },
    });

    for (const match of relevant) {
      await this.prisma.reconciliationMatchSuggestion.create({
        data: {
          organizationId: transaction.organizationId,
          companyId: transaction.companyId,
          bankTransactionId: transactionId,
          candidateEntityType: match.entityType,
          candidateEntityId: match.entityId,
          score: match.score,
          confidenceLevel: confidenceOf(match.score),
          matchingCriteria: {
            label: match.label,
            description: match.description,
            candidateAmount: match.amount,
            referenceDate: match.referenceDate,
            supplierName: match.supplierName,
            criteria: match.criteria,
          } as unknown as Prisma.InputJsonValue,
          differenceAmount: match.differenceAmount,
          differenceDays: match.differenceDays,
          generatedBy: actor.id,
        },
      });
    }

    // Nenhuma conciliação automática nesta etapa: o status vira "sugestão encontrada",
    // nunca "conciliada", por mais alto que o score seja.
    await this.prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        reconciliationStatus:
          relevant.length > 0
            ? BankTransactionReconciliationStatus.MATCH_SUGGESTED
            : BankTransactionReconciliationStatus.UNIDENTIFIED,
        unidentifiedReason:
          relevant.length === 0
            ? 'Nenhum lançamento correspondente foi encontrado dentro dos critérios configurados.'
            : null,
        history: {
          create: {
            organizationId: transaction.organizationId,
            companyId: transaction.companyId,
            financialAccountId: transaction.financialAccountId,
            actionType: ReconciliationHistoryAction.SUGGESTIONS_GENERATED,
            details: {
              generated: relevant.length,
              evaluated: matches.length,
              minimumScore: minimum,
            },
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        },
      },
    });

    return {
      transactionId,
      evaluated: matches.length,
      generated: relevant.length,
      minimumScore: minimum,
      suggestions: relevant,
    };
  }

  /** Gera sugestões para um conjunto de transações, uma a uma. */
  async generateSuggestionsBatch(
    dto: GenerateSuggestionsDto,
    actor: RequestActor,
  ) {
    const transactions = dto.transactionIds?.length
      ? await this.prisma.bankTransaction.findMany({
          where: { id: { in: dto.transactionIds }, deletedAt: null },
          select: { id: true },
        })
      : await this.prisma.bankTransaction.findMany({
          where: {
            deletedAt: null,
            ...(dto.companyId ? { companyId: dto.companyId } : {}),
            ...(dto.financialAccountId
              ? { financialAccountId: dto.financialAccountId }
              : {}),
            reconciliationStatus: {
              in: [
                BankTransactionReconciliationStatus.IMPORTED,
                BankTransactionReconciliationStatus.AVAILABLE,
              ],
            },
          },
          select: { id: true },
          take: dto.limit ?? 100,
        });

    const results: {
      transactionId: string;
      generated: number;
      error?: string;
    }[] = [];

    for (const transaction of transactions) {
      try {
        const result = await this.generateSuggestions(transaction.id, actor);
        results.push({
          transactionId: transaction.id,
          generated: result.generated,
        });
      } catch (error) {
        results.push({
          transactionId: transaction.id,
          generated: 0,
          error:
            error instanceof Error
              ? error.message
              : 'Falha ao gerar sugestões.',
        });
      }
    }

    return {
      processed: results.length,
      withSuggestions: results.filter((item) => item.generated > 0).length,
      failed: results.filter((item) => item.error).length,
      results,
    };
  }

  /** Empresa dona da sugestão — o controlador valida a permissão contra ela. */
  async suggestionScopeOf(suggestionId: string) {
    return this.prisma.reconciliationMatchSuggestion.findFirstOrThrow({
      where: { id: suggestionId },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        bankTransactionId: true,
        status: true,
      },
    });
  }

  async suggestionsOf(transactionId: string) {
    return this.prisma.reconciliationMatchSuggestion.findMany({
      where: { bankTransactionId: transactionId },
      orderBy: [{ status: 'asc' }, { score: 'desc' }],
    });
  }

  async dismissSuggestion(
    suggestionId: string,
    dto: DismissSuggestionDto,
    actor: RequestActor,
  ) {
    const suggestion =
      await this.prisma.reconciliationMatchSuggestion.findFirstOrThrow({
        where: { id: suggestionId },
        include: { bankTransaction: { select: { financialAccountId: true } } },
      });

    const updated = await this.prisma.reconciliationMatchSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: MatchSuggestionStatus.DISMISSED,
        dismissalReason: dto.reason,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      },
    });

    // Sem sugestão pendente restante, a transação volta a ser "não identificada": deixá-la
    // em "sugestão encontrada" faria a fila mostrar um trabalho que já foi feito.
    const remaining = await this.prisma.reconciliationMatchSuggestion.count({
      where: {
        bankTransactionId: suggestion.bankTransactionId,
        status: MatchSuggestionStatus.PENDING,
      },
    });

    if (remaining === 0) {
      await this.prisma.bankTransaction.update({
        where: { id: suggestion.bankTransactionId },
        data: {
          reconciliationStatus:
            BankTransactionReconciliationStatus.UNIDENTIFIED,
          unidentifiedReason: 'Todas as sugestões foram descartadas.',
        },
      });
    }

    await this.prisma.reconciliationHistory.create({
      data: {
        organizationId: suggestion.organizationId,
        companyId: suggestion.companyId,
        financialAccountId: suggestion.bankTransaction.financialAccountId,
        bankTransactionId: suggestion.bankTransactionId,
        actionType: ReconciliationHistoryAction.SUGGESTION_DISMISSED,
        reason: dto.reason,
        performedBy: actor.id,
        ipAddress: actor.ipAddress,
        deviceInfo: actor.userAgent,
      },
    });

    return updated;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private canSeeSensitive(actor: RequestActor): boolean {
    if (actor.isPlatformAdmin) return true;

    return actor.memberships.some((membership) =>
      membership.permissions.includes('reconciliation.view_sensitive_data'),
    );
  }

  /**
   * Mascara número de conta e documento da contraparte no back-end.
   *
   * No back-end e não na tela: o valor cru sairia na resposta, no log do proxy e no cache
   * do navegador — esconder no front seria esconder só de quem olha.
   */
  private mask<
    T extends {
      accountNumber?: string | null;
      payerDocument?: string | null;
      payeeDocument?: string | null;
      financialAccount?: { accountNumber?: string | null } | null;
    },
  >(transaction: T, allowed: boolean): T {
    if (allowed) return transaction;

    return {
      ...transaction,
      accountNumber: transaction.accountNumber
        ? maskAccountFragment(transaction.accountNumber)
        : null,
      payerDocument: transaction.payerDocument
        ? maskAccountFragment(transaction.payerDocument)
        : null,
      payeeDocument: transaction.payeeDocument
        ? maskAccountFragment(transaction.payeeDocument)
        : null,
      ...(transaction.financialAccount
        ? {
            financialAccount: {
              ...transaction.financialAccount,
              accountNumber: transaction.financialAccount.accountNumber
                ? maskAccountFragment(
                    transaction.financialAccount.accountNumber,
                  )
                : null,
            },
          }
        : {}),
    };
  }
}

export { PENDING_STATUSES, cents, BankTransactionDirection };
