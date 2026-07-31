import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BankTransactionDirection,
  BankTransactionReconciliationStatus,
  MatchSuggestionStatus,
  Prisma,
  ReconcilableEntityType,
  ReconciliationCommentVisibility,
  ReconciliationHistoryAction,
  ReconciliationStatus,
  ReconciliationType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { cents, fromCents } from '../accounts-payable/money.util';
import { ReconciliationSettingsService } from './reconciliation-settings.service';
import type {
  CreateReconciliationDto,
  LinkTransferDto,
  ReconciliationCommentDto,
  ReconciliationEntryDto,
  ReconciliationQueryDto,
  UnmatchDto,
} from './dto/reconciliation.dto';

/** Situações em que a transação não pode entrar em uma conciliação nova. */
const CLOSED_STATUSES: BankTransactionReconciliationStatus[] = [
  BankTransactionReconciliationStatus.MATCHED,
  BankTransactionReconciliationStatus.MANUALLY_MATCHED,
  BankTransactionReconciliationStatus.IGNORED,
  BankTransactionReconciliationStatus.CANCELLED,
  BankTransactionReconciliationStatus.REVERSED,
];

/**
 * Tipos de lançamento que este módulo sabe resolver hoje.
 *
 * Os demais estão no enum porque o desenho já os prevê, mas conciliar contra um tipo sem
 * resolvedor criaria um vínculo apontando para lugar nenhum — e ninguém descobriria antes
 * de o módulo correspondente existir.
 */
const RESOLVABLE_TYPES: ReconcilableEntityType[] = [
  ReconcilableEntityType.ACCOUNTS_PAYABLE,
  ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
  ReconcilableEntityType.PAYMENT_SCHEDULE,
  ReconcilableEntityType.PAYMENT_BATCH,
  ReconcilableEntityType.INTERNAL_TRANSFER,
];

export interface ResolvedEntity {
  entityType: ReconcilableEntityType;
  entityId: string;
  label: string;
  description: string;
  amount: number;
  referenceDate: Date | null;
}

/** Uma alocação concreta: quanto desta transação foi para este lançamento. */
interface Allocation {
  bankTransactionId: string;
  entityType: ReconcilableEntityType;
  entityId: string;
  bankAmountCents: number;
  allocatedAmountCents: number;
  relationType: string | null;
}

/**
 * Conciliação: o ato de afirmar que uma movimentação bancária corresponde a um lançamento
 * do sistema (seções 32 a 37, 40 e 43).
 *
 * **A confirmação é sempre humana nesta etapa.** O motor de correspondência sugere; nada
 * aqui é disparado por score. Aceitar uma sugestão é uma ação de alguém, registrada com
 * usuário, data, IP e dispositivo, exatamente como uma conciliação digitada à mão.
 *
 * Um-para-um, um-para-muitos e muitos-para-um não são três fluxos: são a mesma conciliação
 * com um número diferente de itens. O que muda é só o rótulo em `reconciliationType`, que
 * existe para a tela e para os relatórios — não para a lógica.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: ReconciliationSettingsService,
  ) {}

  // ── Consulta ──────────────────────────────────────────────────────────────

  async findAll(query: ReconciliationQueryDto) {
    const where: Prisma.ReconciliationWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.from || query.to
        ? {
            reconciledAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.reconciliation.findMany({
        where,
        include: {
          financialAccount: {
            select: { id: true, name: true, displayName: true },
          },
          items: {
            include: {
              bankTransaction: {
                select: {
                  id: true,
                  transactionDate: true,
                  amount: true,
                  direction: true,
                  originalDescription: true,
                },
              },
            },
          },
        },
        orderBy: { reconciledAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.reconciliation.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const reconciliation = await this.prisma.reconciliation.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        financialAccount: {
          select: { id: true, name: true, displayName: true },
        },
        company: { select: { id: true, legalName: true, tradeName: true } },
        items: {
          include: {
            bankTransaction: {
              select: {
                id: true,
                transactionDate: true,
                amount: true,
                direction: true,
                originalDescription: true,
                documentNumber: true,
                reconciliationStatus: true,
                reconciledAmount: true,
              },
            },
          },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        history: { orderBy: { performedAt: 'desc' } },
      },
    });

    // Os itens guardam tipo e id, não o lançamento em si — resolver na leitura evita uma
    // cópia que envelheceria em silêncio quando o título mudasse de valor ou de situação.
    const entries = await Promise.all(
      reconciliation.items.map((item) =>
        this.describeEntity(item.entityType, item.entityId),
      ),
    );

    return {
      ...reconciliation,
      items: reconciliation.items.map((item, index) => ({
        ...item,
        entity: entries[index],
      })),
    };
  }

  // ── Conciliação (seções 32 a 37) ──────────────────────────────────────────

  /**
   * Cria a conciliação a partir das transações e dos lançamentos escolhidos.
   *
   * A validação inteira mora aqui, no back-end: a tela ajuda a escolher, mas quem decide se
   * o vínculo é válido é este método. Uma checagem só no front seria contornada por
   * qualquer chamada direta à API — e a conciliação errada ficaria gravada como verdadeira.
   */
  async create(dto: CreateReconciliationDto, actor: RequestActor) {
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { id: { in: dto.bankTransactionIds }, deletedAt: null },
      orderBy: { transactionDate: 'asc' },
    });

    if (transactions.length !== dto.bankTransactionIds.length) {
      throw new BadRequestException(
        'Uma ou mais movimentações bancárias informadas não foram encontradas.',
      );
    }

    const [first] = transactions;

    for (const transaction of transactions) {
      if (transaction.companyId !== first.companyId) {
        throw new BadRequestException(
          'As movimentações selecionadas pertencem a empresas diferentes.',
        );
      }

      // Conta diferente é transferência interna, e transferência tem caminho próprio.
      // Tratar aqui produziria uma conciliação com duas contas e saldo de nenhuma.
      if (transaction.financialAccountId !== first.financialAccountId) {
        throw new BadRequestException(
          'As movimentações selecionadas são de contas diferentes. Use o vínculo de transferência interna.',
        );
      }

      if (transaction.direction !== first.direction) {
        throw new BadRequestException(
          'Não é possível conciliar entradas e saídas na mesma conciliação.',
        );
      }

      if (CLOSED_STATUSES.includes(transaction.reconciliationStatus)) {
        throw new BadRequestException(
          `A movimentação de ${transaction.transactionDate.toISOString().slice(0, 10)} já está conciliada, ignorada ou cancelada.`,
        );
      }

      if (transaction.duplicateStatus === 'EXACT') {
        throw new BadRequestException(
          'Uma das movimentações está marcada como duplicidade exata. Resolva a duplicidade antes de conciliar.',
        );
      }
    }

    const config = await this.settings.resolve(
      first.organizationId,
      first.companyId,
      first.financialAccountId,
    );

    if (!config.isEnabled) {
      throw new BadRequestException(
        'A conciliação está desabilitada para esta conta financeira.',
      );
    }

    if (
      !config.multipleMatchEnabled &&
      (transactions.length > 1 || dto.entries.length > 1)
    ) {
      throw new BadRequestException(
        'A conciliação múltipla está desabilitada para esta conta financeira.',
      );
    }

    const entities = await this.resolveEntries(
      dto.entries,
      first.companyId,
      first.direction,
    );

    // Saldo disponível de cada transação: o total menos o que já foi conciliado antes.
    // Sem isso, duas conciliações parciais poderiam somar mais que o valor movimentado.
    const availability = transactions.map((transaction) => ({
      transaction,
      availableCents:
        cents(transaction.amount) - cents(transaction.reconciledAmount),
    }));

    for (const entry of availability) {
      if (entry.availableCents <= 0) {
        throw new BadRequestException(
          'Uma das movimentações já teve todo o seu valor conciliado.',
        );
      }
    }

    const totalBankCents = availability.reduce(
      (total, entry) => total + entry.availableCents,
      0,
    );
    const totalSystemCents = dto.entries.reduce(
      (total, entry) => total + cents(entry.allocatedAmount),
      0,
    );
    const differenceCents = totalBankCents - totalSystemCents;

    const toleranceCents = Math.max(
      cents(config.amountTolerance),
      Math.round((totalSystemCents * Number(config.percentageTolerance)) / 100),
    );

    const withinTolerance = Math.abs(differenceCents) <= toleranceCents;

    if (!withinTolerance && !dto.differenceReason) {
      throw new BadRequestException(
        `Há uma diferença de ${fromCents(Math.abs(differenceCents)).toFixed(2)} entre o extrato e os lançamentos. Informe a justificativa.`,
      );
    }

    // Sobra bancária além da tolerância = conciliação parcial: parte do valor continua
    // esperando um lançamento. Falta bancária é o contrário — o extrato não cobre o que
    // foi alocado — e isso é divergência, não parcialidade.
    const isPartial = !withinTolerance && differenceCents > 0;

    if (isPartial && !config.partialMatchEnabled) {
      throw new BadRequestException(
        'A conciliação parcial está desabilitada para esta conta financeira.',
      );
    }

    const allocations = this.allocate(
      availability.map((entry) => ({
        id: entry.transaction.id,
        availableCents: entry.availableCents,
      })),
      dto.entries,
      isPartial,
    );

    const reconciliationType = this.typeOf(
      transactions.length,
      dto.entries.length,
      isPartial,
    );

    const suggestion = dto.suggestionId
      ? await this.prisma.reconciliationMatchSuggestion.findFirstOrThrow({
          where: { id: dto.suggestionId },
        })
      : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const reconciliation = await tx.reconciliation.create({
        data: {
          organizationId: first.organizationId,
          companyId: first.companyId,
          financialAccountId: first.financialAccountId,
          reconciliationType,
          status: ReconciliationStatus.ACTIVE,
          totalBankAmount: fromCents(totalBankCents),
          totalSystemAmount: fromCents(totalSystemCents),
          differenceAmount: fromCents(differenceCents),
          isPartial,
          isManual: suggestion === null,
          confidenceScore: suggestion?.score ?? null,
          differenceReason: dto.differenceReason,
          notes: dto.notes,
          reconciledBy: actor.id,
          items: {
            create: allocations.map((allocation) => ({
              bankTransactionId: allocation.bankTransactionId,
              entityType: allocation.entityType,
              entityId: allocation.entityId,
              bankAmount: fromCents(allocation.bankAmountCents),
              allocatedAmount: fromCents(allocation.allocatedAmountCents),
              differenceAmount: fromCents(
                allocation.bankAmountCents - allocation.allocatedAmountCents,
              ),
              relationType: allocation.relationType,
            })),
          },
        },
      });

      for (const entry of availability) {
        const consumedCents = allocations
          .filter((item) => item.bankTransactionId === entry.transaction.id)
          .reduce((total, item) => total + item.bankAmountCents, 0);

        const reconciledCents =
          cents(entry.transaction.reconciledAmount) + consumedCents;
        const remainingCents =
          cents(entry.transaction.amount) - reconciledCents;

        await tx.bankTransaction.update({
          where: { id: entry.transaction.id },
          data: {
            reconciledAmount: fromCents(reconciledCents),
            reconciliationStatus:
              remainingCents > 0
                ? BankTransactionReconciliationStatus.PARTIALLY_MATCHED
                : suggestion
                  ? BankTransactionReconciliationStatus.MATCHED
                  : BankTransactionReconciliationStatus.MANUALLY_MATCHED,
            unidentifiedReason: null,
            updatedBy: actor.id,
          },
        });

        await tx.reconciliationHistory.create({
          data: {
            organizationId: first.organizationId,
            companyId: first.companyId,
            financialAccountId: first.financialAccountId,
            bankTransactionId: entry.transaction.id,
            reconciliationId: reconciliation.id,
            actionType:
              remainingCents > 0
                ? ReconciliationHistoryAction.PARTIALLY_MATCHED
                : ReconciliationHistoryAction.MATCHED,
            previousStatus: entry.transaction.reconciliationStatus,
            newStatus:
              remainingCents > 0
                ? BankTransactionReconciliationStatus.PARTIALLY_MATCHED
                : BankTransactionReconciliationStatus.MATCHED,
            details: {
              reconciliationType,
              entries: entities.map((entity) => ({
                entityType: entity.entityType,
                entityId: entity.entityId,
                label: entity.label,
              })),
              differenceAmount: fromCents(differenceCents),
            },
            reason: dto.differenceReason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        });
      }

      if (suggestion) {
        await tx.reconciliationMatchSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: MatchSuggestionStatus.ACCEPTED,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          },
        });

        // As demais sugestões da mesma transação caducam: candidato de uma disputa já
        // decidida não deve continuar oferecido na tela como se ainda estivesse em aberto.
        await tx.reconciliationMatchSuggestion.updateMany({
          where: {
            bankTransactionId: suggestion.bankTransactionId,
            status: MatchSuggestionStatus.PENDING,
            NOT: { id: suggestion.id },
          },
          data: { status: MatchSuggestionStatus.EXPIRED },
        });
      }

      return reconciliation;
    });

    await this.audit.log({
      organizationId: first.organizationId,
      companyId: first.companyId,
      userId: actor.id,
      action: suggestion
        ? 'reconciliation.suggestion_accepted'
        : 'reconciliation.matched',
      entity: 'Reconciliation',
      entityId: created.id,
      newValue: {
        reconciliationType,
        bankTransactionIds: dto.bankTransactionIds,
        entries: dto.entries.map((entry) => ({
          entityType: entry.entityType,
          entityId: entry.entityId,
          allocatedAmount: entry.allocatedAmount,
        })),
        totalBankAmount: fromCents(totalBankCents),
        totalSystemAmount: fromCents(totalSystemCents),
        differenceAmount: fromCents(differenceCents),
        isPartial,
      },
      reason: dto.differenceReason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(created.id);
  }

  /**
   * Aceita uma sugestão do motor.
   *
   * Não é um caminho paralelo: monta o mesmo pedido de conciliação que a tela montaria e
   * chama `create`. Toda a validação — conta, sentido, saldo disponível, tolerância — vale
   * igual, porque uma sugestão de score alto continua sendo um palpite até alguém aceitar.
   */
  async acceptSuggestion(
    suggestionId: string,
    actor: RequestActor,
    notes?: string,
    differenceReason?: string,
  ) {
    const suggestion =
      await this.prisma.reconciliationMatchSuggestion.findFirstOrThrow({
        where: { id: suggestionId },
        include: { bankTransaction: true },
      });

    if (suggestion.status !== MatchSuggestionStatus.PENDING) {
      throw new BadRequestException(
        'Esta sugestão já foi revisada e não está mais pendente.',
      );
    }

    const transaction = suggestion.bankTransaction;

    if (
      suggestion.candidateEntityType ===
      ReconcilableEntityType.INTERNAL_TRANSFER
    ) {
      return this.linkTransfer(
        transaction.direction === BankTransactionDirection.OUT
          ? {
              outgoingTransactionId: transaction.id,
              incomingTransactionId: suggestion.candidateEntityId,
              notes,
            }
          : {
              outgoingTransactionId: suggestion.candidateEntityId,
              incomingTransactionId: transaction.id,
              notes,
            },
        actor,
        suggestionId,
      );
    }

    const entity = await this.describeEntity(
      suggestion.candidateEntityType,
      suggestion.candidateEntityId,
    );

    if (!entity) {
      throw new BadRequestException(
        'O lançamento sugerido não existe mais. Gere as sugestões novamente.',
      );
    }

    const availableCents =
      cents(transaction.amount) - cents(transaction.reconciledAmount);

    return this.create(
      {
        bankTransactionIds: [transaction.id],
        entries: [
          {
            entityType: suggestion.candidateEntityType,
            entityId: suggestion.candidateEntityId,
            // O valor alocado é o do lançamento, não o do extrato: é ele que diz quanto da
            // dívida está sendo quitada. A diferença, se houver, aparece explícita.
            allocatedAmount: Math.min(entity.amount, fromCents(availableCents)),
          },
        ],
        differenceReason,
        notes,
        suggestionId,
      },
      actor,
    );
  }

  /**
   * Desfaz a conciliação (seção 37).
   *
   * A conciliação **não é apagada**: passa a `UNMATCHED`, guardando quem desfez, quando e
   * por quê. Apagar deixaria a transação disponível de novo sem nenhum vestígio de que ela
   * já esteve conciliada — e a pergunta "quem desfez isso?" não teria resposta.
   */
  async unmatch(id: string, dto: UnmatchDto, actor: RequestActor) {
    const reconciliation = await this.prisma.reconciliation.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { items: { include: { bankTransaction: true } } },
    });

    if (reconciliation.status !== ReconciliationStatus.ACTIVE) {
      throw new BadRequestException(
        'Esta conciliação já foi desfeita ou cancelada.',
      );
    }

    const config = await this.settings.resolve(
      reconciliation.organizationId,
      reconciliation.companyId,
      reconciliation.financialAccountId,
    );

    if (!config.unmatchEnabled) {
      throw new BadRequestException(
        'A desconciliação está desabilitada para esta conta financeira.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reconciliation.update({
        where: { id },
        data: {
          status: ReconciliationStatus.UNMATCHED,
          unmatchedBy: actor.id,
          unmatchedAt: new Date(),
          unmatchReason: dto.reason,
        },
      });

      // Uma transação pode aparecer em vários itens da mesma conciliação; agrupar antes
      // evita devolver o saldo em duas etapas e gravar dois estados diferentes.
      const consumed = new Map<string, number>();

      for (const item of reconciliation.items) {
        consumed.set(
          item.bankTransactionId,
          (consumed.get(item.bankTransactionId) ?? 0) + cents(item.bankAmount),
        );
      }

      for (const [transactionId, consumedCents] of consumed) {
        const item = reconciliation.items.find(
          (candidate) => candidate.bankTransactionId === transactionId,
        );

        if (!item) continue;

        const reconciledCents = Math.max(
          0,
          cents(item.bankTransaction.reconciledAmount) - consumedCents,
        );

        await tx.bankTransaction.update({
          where: { id: transactionId },
          data: {
            reconciledAmount: fromCents(reconciledCents),
            reconciliationStatus:
              reconciledCents > 0
                ? BankTransactionReconciliationStatus.PARTIALLY_MATCHED
                : BankTransactionReconciliationStatus.AVAILABLE,
            updatedBy: actor.id,
          },
        });

        await tx.reconciliationHistory.create({
          data: {
            organizationId: reconciliation.organizationId,
            companyId: reconciliation.companyId,
            financialAccountId: reconciliation.financialAccountId,
            bankTransactionId: transactionId,
            reconciliationId: id,
            actionType: ReconciliationHistoryAction.UNMATCHED,
            previousStatus: item.bankTransaction.reconciliationStatus,
            newStatus:
              reconciledCents > 0
                ? BankTransactionReconciliationStatus.PARTIALLY_MATCHED
                : BankTransactionReconciliationStatus.AVAILABLE,
            reason: dto.reason,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        });
      }
    });

    await this.audit.log({
      organizationId: reconciliation.organizationId,
      companyId: reconciliation.companyId,
      userId: actor.id,
      action: 'reconciliation.unmatched',
      entity: 'Reconciliation',
      entityId: id,
      oldValue: {
        status: reconciliation.status,
        totalBankAmount: reconciliation.totalBankAmount,
      },
      newValue: { status: ReconciliationStatus.UNMATCHED },
      reason: dto.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(id);
  }

  // ── Transferência interna (seção 40) ──────────────────────────────────────

  /**
   * Liga a saída de uma conta à entrada de outra da mesma empresa.
   *
   * Transferência interna não é despesa nem receita: é o mesmo dinheiro aparecendo duas
   * vezes no extrato consolidado. Conciliar as duas pontas contra lançamentos separados
   * dobraria o movimento no fluxo de caixa.
   */
  async linkTransfer(
    dto: LinkTransferDto,
    actor: RequestActor,
    suggestionId?: string,
  ) {
    if (dto.outgoingTransactionId === dto.incomingTransactionId) {
      throw new BadRequestException(
        'A saída e a entrada precisam ser movimentações diferentes.',
      );
    }

    const [outgoing, incoming] = await Promise.all([
      this.prisma.bankTransaction.findFirstOrThrow({
        where: { id: dto.outgoingTransactionId, deletedAt: null },
      }),
      this.prisma.bankTransaction.findFirstOrThrow({
        where: { id: dto.incomingTransactionId, deletedAt: null },
      }),
    ]);

    if (outgoing.companyId !== incoming.companyId) {
      throw new BadRequestException(
        'As duas pontas da transferência precisam ser da mesma empresa.',
      );
    }

    if (outgoing.financialAccountId === incoming.financialAccountId) {
      throw new BadRequestException(
        'Transferência interna exige duas contas diferentes.',
      );
    }

    if (
      outgoing.direction !== BankTransactionDirection.OUT ||
      incoming.direction !== BankTransactionDirection.IN
    ) {
      throw new BadRequestException(
        'Informe uma saída na conta de origem e uma entrada na conta de destino.',
      );
    }

    for (const transaction of [outgoing, incoming]) {
      if (CLOSED_STATUSES.includes(transaction.reconciliationStatus)) {
        throw new BadRequestException(
          'Uma das pontas já está conciliada, ignorada ou cancelada.',
        );
      }
    }

    const config = await this.settings.resolve(
      outgoing.organizationId,
      outgoing.companyId,
      outgoing.financialAccountId,
    );

    const outgoingCents = cents(outgoing.amount);
    const incomingCents = cents(incoming.amount);
    const differenceCents = outgoingCents - incomingCents;
    const toleranceCents = cents(config.amountTolerance);

    // A diferença legítima é a tarifa da transferência. Fora da tolerância, alguém precisa
    // dizer o que é — senão a ponta que sobrou vira um ajuste silencioso.
    if (Math.abs(differenceCents) > toleranceCents && !dto.notes) {
      throw new BadRequestException(
        `Os valores das duas pontas diferem em ${fromCents(Math.abs(differenceCents)).toFixed(2)}. Descreva o motivo (tarifa, IOF) nas observações.`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const reconciliation = await tx.reconciliation.create({
        data: {
          organizationId: outgoing.organizationId,
          companyId: outgoing.companyId,
          // A conciliação fica na conta de origem; o item da outra ponta guarda a conta de
          // destino pela própria transação.
          financialAccountId: outgoing.financialAccountId,
          reconciliationType: ReconciliationType.TRANSFER,
          status: ReconciliationStatus.ACTIVE,
          totalBankAmount: fromCents(outgoingCents),
          totalSystemAmount: fromCents(incomingCents),
          differenceAmount: fromCents(differenceCents),
          isManual: suggestionId === undefined,
          differenceReason: differenceCents === 0 ? null : dto.notes,
          notes: dto.notes,
          reconciledBy: actor.id,
          items: {
            create: [
              {
                bankTransactionId: outgoing.id,
                entityType: ReconcilableEntityType.INTERNAL_TRANSFER,
                entityId: incoming.id,
                bankAmount: fromCents(outgoingCents),
                allocatedAmount: fromCents(outgoingCents),
                relationType: 'saida',
              },
              {
                bankTransactionId: incoming.id,
                entityType: ReconcilableEntityType.INTERNAL_TRANSFER,
                entityId: outgoing.id,
                bankAmount: fromCents(incomingCents),
                allocatedAmount: fromCents(incomingCents),
                relationType: 'entrada',
              },
            ],
          },
        },
      });

      for (const transaction of [outgoing, incoming]) {
        await tx.bankTransaction.update({
          where: { id: transaction.id },
          data: {
            reconciledAmount: transaction.amount,
            reconciliationStatus:
              BankTransactionReconciliationStatus.MANUALLY_MATCHED,
            unidentifiedReason: null,
            updatedBy: actor.id,
          },
        });

        await tx.reconciliationHistory.create({
          data: {
            organizationId: transaction.organizationId,
            companyId: transaction.companyId,
            financialAccountId: transaction.financialAccountId,
            bankTransactionId: transaction.id,
            reconciliationId: reconciliation.id,
            actionType: ReconciliationHistoryAction.MATCHED,
            previousStatus: transaction.reconciliationStatus,
            newStatus: BankTransactionReconciliationStatus.MANUALLY_MATCHED,
            details: {
              reconciliationType: ReconciliationType.TRANSFER,
              counterpartTransactionId:
                transaction.id === outgoing.id ? incoming.id : outgoing.id,
            },
            reason: dto.notes,
            performedBy: actor.id,
            ipAddress: actor.ipAddress,
            deviceInfo: actor.userAgent,
          },
        });
      }

      if (suggestionId) {
        await tx.reconciliationMatchSuggestion.update({
          where: { id: suggestionId },
          data: {
            status: MatchSuggestionStatus.ACCEPTED,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          },
        });
      }

      return reconciliation;
    });

    await this.audit.log({
      organizationId: outgoing.organizationId,
      companyId: outgoing.companyId,
      userId: actor.id,
      action: 'reconciliation.transfer_linked',
      entity: 'Reconciliation',
      entityId: created.id,
      newValue: {
        outgoingTransactionId: outgoing.id,
        incomingTransactionId: incoming.id,
        differenceAmount: fromCents(differenceCents),
      },
      reason: dto.notes,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.findOne(created.id);
  }

  // ── Comentários (seção 46) ────────────────────────────────────────────────

  async addComment(dto: ReconciliationCommentDto, actor: RequestActor) {
    if (
      !dto.bankTransactionId &&
      !dto.reconciliationId &&
      !dto.statementImportId
    ) {
      throw new BadRequestException(
        'Informe a movimentação, a conciliação ou a importação comentada.',
      );
    }

    return this.prisma.reconciliationComment.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        bankTransactionId: dto.bankTransactionId,
        reconciliationId: dto.reconciliationId,
        statementImportId: dto.statementImportId,
        comment: dto.comment,
        visibility: dto.visibility ?? ReconciliationCommentVisibility.INTERNAL,
        attachments: (dto.attachments ??
          []) as unknown as Prisma.InputJsonValue,
        createdBy: actor.id,
      },
    });
  }

  async comments(filters: {
    bankTransactionId?: string;
    reconciliationId?: string;
    statementImportId?: string;
  }) {
    return this.prisma.reconciliationComment.findMany({
      where: {
        deletedAt: null,
        ...(filters.bankTransactionId
          ? { bankTransactionId: filters.bankTransactionId }
          : {}),
        ...(filters.reconciliationId
          ? { reconciliationId: filters.reconciliationId }
          : {}),
        ...(filters.statementImportId
          ? { statementImportId: filters.statementImportId }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /**
   * Distribui o valor bancário entre os lançamentos.
   *
   * Consumo sequencial: cada lançamento puxa das transações na ordem até completar o valor
   * alocado. Um item por par (transação, lançamento) — é isso que faz um-para-muitos e
   * muitos-para-um caberem no mesmo modelo, sem tabela nem coluna extra para cada caso.
   */
  private allocate(
    transactions: { id: string; availableCents: number }[],
    entries: ReconciliationEntryDto[],
    isPartial: boolean,
  ): Allocation[] {
    const pool = transactions.map((transaction) => ({ ...transaction }));
    const allocations: Allocation[] = [];

    for (const entry of entries) {
      let remaining = cents(entry.allocatedAmount);

      for (const transaction of pool) {
        if (remaining <= 0) break;
        if (transaction.availableCents <= 0) continue;

        const taken = Math.min(remaining, transaction.availableCents);

        allocations.push({
          bankTransactionId: transaction.id,
          entityType: entry.entityType,
          entityId: entry.entityId,
          bankAmountCents: taken,
          allocatedAmountCents: taken,
          relationType: entry.relationType ?? null,
        });

        transaction.availableCents -= taken;
        remaining -= taken;
      }

      if (remaining > 0) {
        // O que restou foi alocado sem lastro bancário: registra como item de valor
        // bancário zero para a diferença aparecer no item, não sumir na conta do cabeçalho.
        allocations.push({
          bankTransactionId: transactions[0].id,
          entityType: entry.entityType,
          entityId: entry.entityId,
          bankAmountCents: 0,
          allocatedAmountCents: remaining,
          relationType: entry.relationType ?? null,
        });
      }
    }

    // Sobra bancária dentro da tolerância pertence à conciliação: sem absorvê-la, a
    // transação ficaria eternamente "parcial" por causa de centavos de arredondamento.
    if (!isPartial) {
      const leftover = pool.filter(
        (transaction) => transaction.availableCents > 0,
      );

      for (const transaction of leftover) {
        const last = allocations.find(
          (allocation) => allocation.bankTransactionId === transaction.id,
        );

        if (last) {
          last.bankAmountCents += transaction.availableCents;
          transaction.availableCents = 0;
        }
      }
    }

    return allocations;
  }

  /** Rótulo do formato da conciliação. Descritivo — a lógica não depende dele. */
  private typeOf(
    transactionCount: number,
    entryCount: number,
    isPartial: boolean,
  ): ReconciliationType {
    if (isPartial) return ReconciliationType.PARTIAL;
    if (transactionCount > 1) return ReconciliationType.MANY_TO_ONE;
    if (entryCount > 1) return ReconciliationType.ONE_TO_MANY;

    return ReconciliationType.ONE_TO_ONE;
  }

  private async resolveEntries(
    entries: ReconciliationEntryDto[],
    companyId: string,
    direction: BankTransactionDirection,
  ): Promise<ResolvedEntity[]> {
    const seen = new Set<string>();

    for (const entry of entries) {
      const key = `${entry.entityType}:${entry.entityId}`;

      if (seen.has(key)) {
        throw new BadRequestException(
          'O mesmo lançamento foi informado mais de uma vez na conciliação.',
        );
      }

      seen.add(key);

      if (!RESOLVABLE_TYPES.includes(entry.entityType)) {
        throw new BadRequestException(
          `Conciliação contra "${entry.entityType}" ainda não está disponível: o módulo correspondente será entregue nas próximas etapas.`,
        );
      }

      // Sentido é regra dura, não critério de pontuação: um crédito bancário conciliado
      // contra uma conta a pagar registra um pagamento que nunca saiu.
      if (
        direction === BankTransactionDirection.IN &&
        entry.entityType !== ReconcilableEntityType.INTERNAL_TRANSFER
      ) {
        throw new BadRequestException(
          'Entradas bancárias só podem ser conciliadas como transferência interna nesta etapa — Contas a Receber chega em módulo próprio.',
        );
      }
    }

    const resolved = await Promise.all(
      entries.map((entry) =>
        this.describeEntity(entry.entityType, entry.entityId),
      ),
    );

    return resolved.map((entity, index) => {
      if (!entity) {
        throw new BadRequestException(
          `O lançamento ${entries[index].entityId} não foi encontrado.`,
        );
      }

      return entity;
    });
  }

  /**
   * Descreve um lançamento conciliável.
   *
   * Devolve `null` quando o registro não existe — o chamador decide se isso é erro (ao
   * criar) ou apenas um vínculo órfão a exibir (ao ler uma conciliação antiga).
   */
  private async describeEntity(
    entityType: ReconcilableEntityType,
    entityId: string,
  ): Promise<ResolvedEntity | null> {
    const base = { entityType, entityId };

    switch (entityType) {
      case ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT: {
        const installment =
          await this.prisma.accountsPayableInstallment.findUnique({
            where: { id: entityId },
            include: {
              payable: {
                select: {
                  code: true,
                  description: true,
                  supplier: { select: { legalName: true, tradeName: true } },
                },
              },
            },
          });

        if (!installment) return null;

        return {
          ...base,
          label: `${installment.payable.code} — parcela ${installment.installmentNumber}`,
          description:
            installment.payable.description ??
            installment.payable.supplier?.tradeName ??
            installment.payable.supplier?.legalName ??
            '',
          amount: Number(
            cents(installment.paidAmount) > 0
              ? installment.paidAmount
              : installment.balanceAmount,
          ),
          referenceDate: installment.paidAt ?? installment.dueDate,
        };
      }

      case ReconcilableEntityType.ACCOUNTS_PAYABLE: {
        const payable = await this.prisma.accountsPayable.findUnique({
          where: { id: entityId },
          include: {
            supplier: { select: { legalName: true, tradeName: true } },
          },
        });

        if (!payable) return null;

        return {
          ...base,
          label: payable.code,
          description:
            payable.description ??
            payable.supplier?.tradeName ??
            payable.supplier?.legalName ??
            '',
          amount: Number(payable.balanceAmount),
          referenceDate: payable.dueDate,
        };
      }

      case ReconcilableEntityType.PAYMENT_SCHEDULE: {
        const schedule = await this.prisma.paymentSchedule.findUnique({
          where: { id: entityId },
          include: { payable: { select: { code: true, description: true } } },
        });

        if (!schedule) return null;

        return {
          ...base,
          label: `${schedule.code} — ${schedule.payable.code}`,
          description: schedule.payable.description ?? '',
          amount: Number(schedule.totalAmount),
          referenceDate: schedule.scheduledDate,
        };
      }

      case ReconcilableEntityType.PAYMENT_BATCH: {
        const batch = await this.prisma.paymentBatch.findUnique({
          where: { id: entityId },
        });

        if (!batch) return null;

        return {
          ...base,
          label: batch.name ? `${batch.code} — ${batch.name}` : batch.code,
          description: batch.notes ?? '',
          amount: Number(batch.totalAmount),
          referenceDate: batch.scheduledDate,
        };
      }

      case ReconcilableEntityType.INTERNAL_TRANSFER: {
        const counterpart = await this.prisma.bankTransaction.findUnique({
          where: { id: entityId },
          include: {
            financialAccount: { select: { name: true, displayName: true } },
          },
        });

        if (!counterpart) return null;

        return {
          ...base,
          label: `Transferência — ${counterpart.financialAccount.displayName ?? counterpart.financialAccount.name}`,
          description: counterpart.originalDescription,
          amount: Number(counterpart.amount),
          referenceDate: counterpart.transactionDate,
        };
      }

      default:
        return null;
    }
  }
}
