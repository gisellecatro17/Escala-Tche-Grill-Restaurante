import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  ApprovalActionType,
  ApprovalPriority,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  FinancialEntryStatus,
  Prisma,
  type ApprovalSettings,
  type FinancialEntry,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { ApprovalFlowResolverService } from './approval-flow-resolver.service';
import { ApproverResolverService } from './approver-resolver.service';
import { PayableGenerationService } from '../accounts-payable/payable-generation.service';
import type {
  ApprovalQueryDto,
  BatchApprovalDto,
  CommentDto,
  DecisionDto,
  DelegateRequestDto,
  ForwardRequestDto,
  PriorityDto,
  ReasonDto,
} from './dto/approvals.dto';

/** Situações em que a solicitação ainda espera alguma decisão. */
const LIVE_STATUSES: ApprovalRequestStatus[] = [
  ApprovalRequestStatus.PENDING,
  ApprovalRequestStatus.IN_PROGRESS,
  ApprovalRequestStatus.WAITING_INFORMATION,
];

const REQUEST_INCLUDE = {
  company: { select: { id: true, legalName: true, tradeName: true } },
  flow: { select: { id: true, name: true } },
  entry: {
    select: {
      id: true,
      documentNumber: true,
      description: true,
      direction: true,
      netAmount: true,
      status: true,
      categoryId: true,
      costCenterId: true,
      sourceIntakeDocumentId: true,
      supplier: { select: { id: true, legalName: true, tradeName: true } },
      customer: { select: { id: true, legalName: true, tradeName: true } },
    },
  },
  steps: { orderBy: { stepOrder: 'asc' }, include: { approvals: true } },
} satisfies Prisma.ApprovalRequestInclude;

/**
 * Solicitações de aprovação.
 *
 * O módulo fica entre "A Processar" e "Contas a Pagar": um lançamento com solicitação viva
 * **não pode ser aberto**, e é isso que garante o critério de aceite 9 — nenhum documento
 * chega a Contas a Pagar sem concluir as etapas obrigatórias.
 *
 * Nada aqui paga, agenda ou autoriza saída de dinheiro no banco. Aprovar significa "esta
 * despesa está autorizada a virar obrigação".
 */
@Injectable()
export class ApprovalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly flows: ApprovalFlowResolverService,
    private readonly approvers: ApproverResolverService,
    private readonly payables: PayableGenerationService,
  ) {}

  // ── Parâmetros ────────────────────────────────────────────────────────────

  async findSettings(
    organizationId: string,
    companyId: string,
  ): Promise<ApprovalSettings> {
    const existing = await this.prisma.approvalSettings.findUnique({
      where: { companyId },
    });

    if (existing) return existing;

    return this.prisma.approvalSettings.create({
      data: { organizationId, companyId },
    });
  }

  async updateSettings(
    organizationId: string,
    companyId: string,
    data: Prisma.ApprovalSettingsUpdateInput,
    actor: RequestUser,
  ) {
    const before = await this.findSettings(organizationId, companyId);

    const updated = await this.prisma.approvalSettings.update({
      where: { companyId },
      data: { ...data, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'UPDATE_APPROVAL_SETTINGS',
      entity: 'ApprovalSettings',
      entityId: updated.id,
      oldValue: before,
      newValue: updated,
    });

    return updated;
  }

  // ── Abertura ──────────────────────────────────────────────────────────────

  /**
   * Abre a solicitação de aprovação de um lançamento.
   *
   * Devolve `null` quando nenhum fluxo casa **e** a empresa não exige aprovação — nesse
   * caso o lançamento segue sem passar por aqui, que é o comportamento correto para
   * empresas que não usam governança de aprovação.
   */
  async openFor(
    entry: FinancialEntry,
    actor: RequestUser,
    options: { priority?: ApprovalPriority } = {},
  ) {
    const live = await this.prisma.approvalRequest.findFirst({
      where: {
        entryId: entry.id,
        deletedAt: null,
        status: { in: LIVE_STATUSES },
      },
      select: { id: true },
    });

    if (live) {
      throw new ConflictException(
        'Este lançamento já tem uma solicitação de aprovação em andamento.',
      );
    }

    const settings = await this.findSettings(
      entry.organizationId,
      entry.companyId,
    );
    const priority = options.priority ?? ApprovalPriority.NORMAL;
    const amount = Number(entry.netAmount);

    const context = await this.matchContextOf(entry);
    const flow = await this.flows.resolve(entry, priority, context);

    if (!flow) {
      const required =
        settings.requireApprovalForAll ||
        (settings.mandatoryAboveAmount !== null &&
          amount > Number(settings.mandatoryAboveAmount));

      if (required) {
        throw new BadRequestException(
          'Esta empresa exige aprovação, mas nenhum fluxo de aprovação corresponde a este lançamento. Configure um fluxo padrão.',
        );
      }

      return null;
    }

    const applicable = this.flows.applicableSteps(flow.steps, amount);
    const mandatory = applicable.filter(
      ({ step, applies }) => applies && step.isMandatory,
    );

    if (mandatory.length === 0) {
      throw new BadRequestException(
        `O fluxo "${flow.name}" não tem nenhuma etapa obrigatória para este valor. Ajuste as alçadas antes de solicitar aprovação.`,
      );
    }

    const previous = await this.prisma.approvalRequest.count({
      where: { entryId: entry.id },
    });

    const now = new Date();
    let cursor = new Date(now);

    const steps = applicable.map(({ step, applies }) => {
      const hours = step.deadlineHours ?? flow.defaultDeadlineHours;
      if (applies) cursor = addHours(cursor, hours);

      return {
        flowStepId: step.id,
        stepOrder: step.stepOrder,
        name: step.name,
        approverType: step.approverType,
        approverUserId: step.approverUserId,
        approverRoleId: step.approverRoleId,
        requiredApprovals: step.requiredApprovals,
        isMandatory: step.isMandatory,
        blockSelfApproval: step.blockSelfApproval,
        // Fora da faixa de valor: a etapa fica registrada como dispensada, para o
        // histórico mostrar que a alçada existia e não se aplicava.
        status: applies
          ? ApprovalStepStatus.PENDING
          : ApprovalStepStatus.SKIPPED,
        dueAt: applies ? new Date(cursor) : null,
      };
    });

    const firstApplicable = steps.find(
      (step) => step.status === ApprovalStepStatus.PENDING,
    );

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.approvalRequest.create({
        data: {
          organizationId: entry.organizationId,
          companyId: entry.companyId,
          entryId: entry.id,
          flowId: flow.id,
          attempt: previous + 1,
          status: ApprovalRequestStatus.IN_PROGRESS,
          priority,
          amount: entry.netAmount,
          currentStepOrder: firstApplicable?.stepOrder ?? null,
          dueAt: cursor,
          startedAt: now,
          requestedBy: entry.createdBy ?? actor.id,
          steps: { create: steps },
        },
        include: REQUEST_INCLUDE,
      });

      await tx.approvalRequestStep.updateMany({
        where: {
          requestId: created.id,
          stepOrder: firstApplicable?.stepOrder ?? -1,
        },
        data: {
          status: ApprovalStepStatus.IN_PROGRESS,
          startedAt: now,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: created.id,
          action: ApprovalActionType.CREATED,
          actorId: actor.id,
          newStatus: ApprovalRequestStatus.IN_PROGRESS,
          reason: `Fluxo "${flow.name}" aplicado.`,
          metadata: {
            flowId: flow.id,
            amount,
            mandatorySteps: mandatory.length,
            skippedSteps: applicable.filter(({ applies }) => !applies).length,
          },
        },
      });

      return created;
    });

    await this.audit.log({
      organizationId: entry.organizationId,
      companyId: entry.companyId,
      userId: actor.id,
      action: 'OPEN_APPROVAL_REQUEST',
      entity: 'ApprovalRequest',
      entityId: request.id,
      newValue: {
        entryId: entry.id,
        flow: flow.name,
        amount,
        steps: steps.length,
        note: 'Aprovação de despesa. Não autoriza pagamento nem movimenta banco.',
      },
    });

    return request;
  }

  /**
   * Existe alguma solicitação viva para este lançamento?
   *
   * É o que o módulo de processamento consulta antes de abrir o título — o gate do critério
   * de aceite 9.
   */
  async hasPendingApproval(entryId: string): Promise<boolean> {
    const live = await this.prisma.approvalRequest.count({
      where: {
        entryId,
        deletedAt: null,
        status: { in: LIVE_STATUSES },
      },
    });

    return live > 0;
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  async scopeOf(id: string) {
    return this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        status: true,
        entryId: true,
      },
    });
  }

  async findAll(query: ApprovalQueryDto) {
    const where: Prisma.ApprovalRequestWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.flowId ? { flowId: query.flowId } : {}),
      ...(query.overdue
        ? { dueAt: { lt: new Date() }, status: { in: LIVE_STATUSES } }
        : {}),
      ...(query.minimumAmount !== undefined
        ? { amount: { gte: query.minimumAmount } }
        : {}),
      ...(query.maximumAmount !== undefined
        ? { amount: { lte: query.maximumAmount } }
        : {}),
      ...(query.entryId ? { entryId: query.entryId } : {}),
      ...(query.supplierId ? { entry: { supplierId: query.supplierId } } : {}),
      ...(query.categoryId ? { entry: { categoryId: query.categoryId } } : {}),
      ...(query.costCenterId
        ? { entry: { costCenterId: query.costCenterId } }
        : {}),
      // "Minha fila": solicitações cuja etapa atual está designada a esta pessoa.
      ...(query.assignedToUserId
        ? {
            steps: {
              some: {
                status: ApprovalStepStatus.IN_PROGRESS,
                approverUserId: query.assignedToUserId,
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            entry: {
              OR: [
                {
                  documentNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  description: { contains: query.search, mode: 'insensitive' },
                },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        // Urgente primeiro, depois o que vence antes: é a ordem em que se aprova.
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    return this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        ...REQUEST_INCLUDE,
        comments: { orderBy: { createdAt: 'desc' } },
        history: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  // ── Decisões ──────────────────────────────────────────────────────────────

  async approve(id: string, dto: DecisionDto, actor: RequestUser) {
    const { request, step, settings } = await this.loadForDecision(id);

    const eligibility = await this.approvers.check({
      actor,
      companyId: request.companyId,
      step,
      amount: Number(request.amount),
      requestedBy: request.requestedBy,
      blockSelfApprovalGlobally: settings.blockSelfApprovalGlobally,
      enforceIndividualLimit: settings.enforceIndividualLimit,
    });

    if (!eligibility.allowed) {
      throw new ForbiddenException(eligibility.reason ?? undefined);
    }

    const already = await this.prisma.approvalStepApproval.findFirst({
      where: { requestStepId: step.id, approvedBy: actor.id },
      select: { id: true },
    });

    if (already) {
      throw new ConflictException(
        'Você já aprovou esta etapa. A dupla aprovação exige duas pessoas diferentes.',
      );
    }

    const givenAfter = step.approvalsGiven + 1;
    const stepComplete = givenAfter >= step.requiredApprovals;

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalStepApproval.create({
        data: {
          requestStepId: step.id,
          approvedBy: actor.id,
          onBehalfOf: eligibility.onBehalfOf,
          delegationId: eligibility.delegation?.id ?? null,
          comment: dto.comment ?? null,
        },
      });

      await tx.approvalRequestStep.update({
        where: { id: step.id },
        data: {
          approvalsGiven: givenAfter,
          ...(stepComplete
            ? {
                status: ApprovalStepStatus.APPROVED,
                decidedBy: actor.id,
                decidedAt: new Date(),
                decisionComment: dto.comment ?? null,
                actedOnBehalfOf: eligibility.onBehalfOf,
              }
            : {}),
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          action: ApprovalActionType.APPROVED,
          stepOrder: step.stepOrder,
          actorId: actor.id,
          onBehalfOf: eligibility.onBehalfOf,
          reason: dto.comment ?? null,
          metadata: {
            approvalsGiven: givenAfter,
            requiredApprovals: step.requiredApprovals,
          },
        },
      });

      if (stepComplete) {
        await this.advance(tx, request.id, step.stepOrder, actor);
      }
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'APPROVE_APPROVAL_STEP',
      entity: 'ApprovalRequest',
      entityId: request.id,
      newValue: {
        stepOrder: step.stepOrder,
        onBehalfOf: eligibility.onBehalfOf,
        stepComplete,
      },
      reason: dto.comment ?? null,
    });

    await this.settleApproved(request.id, actor);

    return this.findOne(id);
  }

  async reject(id: string, dto: ReasonDto, actor: RequestUser) {
    const { request, step, settings } = await this.loadForDecision(id);

    const eligibility = await this.approvers.check({
      actor,
      companyId: request.companyId,
      step,
      amount: Number(request.amount),
      requestedBy: request.requestedBy,
      blockSelfApprovalGlobally: settings.blockSelfApprovalGlobally,
      enforceIndividualLimit: settings.enforceIndividualLimit,
    });

    if (!eligibility.allowed) {
      throw new ForbiddenException(eligibility.reason ?? undefined);
    }

    const decidedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRequestStep.update({
        where: { id: step.id },
        data: {
          status: ApprovalStepStatus.REJECTED,
          decidedBy: actor.id,
          decidedAt,
          decisionComment: dto.reason,
          actedOnBehalfOf: eligibility.onBehalfOf,
        },
      });

      await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: ApprovalRequestStatus.REJECTED,
          rejectionReason: dto.reason,
          decidedAt,
          decisionSeconds: secondsBetween(request.startedAt, decidedAt),
          currentStepOrder: null,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          action: ApprovalActionType.REJECTED,
          stepOrder: step.stepOrder,
          actorId: actor.id,
          onBehalfOf: eligibility.onBehalfOf,
          previousStatus: request.status,
          newStatus: ApprovalRequestStatus.REJECTED,
          reason: dto.reason,
        },
      });
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'REJECT_APPROVAL_REQUEST',
      entity: 'ApprovalRequest',
      entityId: request.id,
      newValue: { stepOrder: step.stepOrder },
      reason: dto.reason,
    });

    return this.findOne(id);
  }

  /**
   * Devolve a solicitação para quem pediu, sem reprovar.
   *
   * A etapa fica marcada como aguardando informação e a solicitação inteira também: a
   * decisão volta a ser possível assim que alguém responder, sem perder o que já foi
   * aprovado nas etapas anteriores.
   */
  async requestChanges(
    id: string,
    dto: ReasonDto,
    actor: RequestUser,
    options: { documents?: boolean } = {},
  ) {
    const { request, step, settings } = await this.loadForDecision(id);

    const eligibility = await this.approvers.check({
      actor,
      companyId: request.companyId,
      step,
      amount: Number(request.amount),
      requestedBy: request.requestedBy,
      blockSelfApprovalGlobally: settings.blockSelfApprovalGlobally,
      enforceIndividualLimit: settings.enforceIndividualLimit,
    });

    if (!eligibility.allowed) {
      throw new ForbiddenException(eligibility.reason ?? undefined);
    }

    const action = options.documents
      ? ApprovalActionType.DOCUMENTS_REQUESTED
      : ApprovalActionType.CHANGES_REQUESTED;

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRequestStep.update({
        where: { id: step.id },
        data: { status: ApprovalStepStatus.WAITING_INFORMATION },
      });

      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status: ApprovalRequestStatus.WAITING_INFORMATION },
      });

      await tx.approvalComment.create({
        data: {
          requestId: request.id,
          stepOrder: step.stepOrder,
          authorId: actor.id,
          text: dto.reason,
          isDocumentRequest: options.documents ?? false,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          action,
          stepOrder: step.stepOrder,
          actorId: actor.id,
          previousStatus: request.status,
          newStatus: ApprovalRequestStatus.WAITING_INFORMATION,
          reason: dto.reason,
        },
      });
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: options.documents
        ? 'REQUEST_APPROVAL_DOCUMENTS'
        : 'REQUEST_APPROVAL_CHANGES',
      entity: 'ApprovalRequest',
      entityId: request.id,
      reason: dto.reason,
    });

    return this.findOne(id);
  }

  /** Retoma a solicitação devolvida, colocando a etapa atual de volta em andamento. */
  async resume(id: string, dto: CommentDto, actor: RequestUser) {
    const request = await this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (request.status !== ApprovalRequestStatus.WAITING_INFORMATION) {
      throw new BadRequestException(
        'Só uma solicitação aguardando informações pode ser retomada.',
      );
    }

    const step = request.steps.find(
      (item) => item.status === ApprovalStepStatus.WAITING_INFORMATION,
    );

    await this.prisma.$transaction(async (tx) => {
      if (step) {
        await tx.approvalRequestStep.update({
          where: { id: step.id },
          data: { status: ApprovalStepStatus.IN_PROGRESS },
        });
      }

      await tx.approvalRequest.update({
        where: { id },
        data: { status: ApprovalRequestStatus.IN_PROGRESS },
      });

      if (dto.text) {
        await tx.approvalComment.create({
          data: {
            requestId: id,
            stepOrder: step?.stepOrder ?? null,
            authorId: actor.id,
            text: dto.text,
          },
        });
      }

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          action: ApprovalActionType.COMMENTED,
          stepOrder: step?.stepOrder ?? null,
          actorId: actor.id,
          previousStatus: ApprovalRequestStatus.WAITING_INFORMATION,
          newStatus: ApprovalRequestStatus.IN_PROGRESS,
          reason: dto.text ?? 'Informações prestadas.',
        },
      });
    });

    return this.findOne(id);
  }

  // ── Delegação, encaminhamento e comentários ───────────────────────────────

  /**
   * Delega esta solicitação a outra pessoa.
   *
   * Diferente da delegação por período (que vale para tudo), esta muda o aprovador **desta**
   * etapa. Quem recebe precisa ter a permissão na empresa — delegar não concede acesso.
   */
  async delegate(id: string, dto: DelegateRequestDto, actor: RequestUser) {
    const { request, step } = await this.loadForDecision(id);

    const membership = await this.prisma.userCompanyRole.findFirst({
      where: {
        userId: dto.delegateId,
        companyId: request.companyId,
        status: 'ACTIVE',
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const canApprove = membership?.role.permissions.some(
      (link) => link.permission.slug === 'approvals.approve',
    );

    if (!canApprove) {
      throw new BadRequestException(
        'A pessoa indicada não tem permissão para aprovar nesta empresa.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRequestStep.update({
        where: { id: step.id },
        data: {
          approverType: 'SPECIFIC_USER',
          approverUserId: dto.delegateId,
          approverRoleId: null,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          action: ApprovalActionType.DELEGATED,
          stepOrder: step.stepOrder,
          actorId: actor.id,
          reason: dto.reason ?? null,
          metadata: { delegateId: dto.delegateId },
        },
      });
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'DELEGATE_APPROVAL_STEP',
      entity: 'ApprovalRequest',
      entityId: request.id,
      newValue: { stepOrder: step.stepOrder, delegateId: dto.delegateId },
      reason: dto.reason ?? null,
    });

    return this.findOne(id);
  }

  /** Encaminha para outra pessoa opinar, sem transferir a decisão. */
  async forward(id: string, dto: ForwardRequestDto, actor: RequestUser) {
    const request = await this.scopeOf(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalComment.create({
        data: {
          requestId: id,
          authorId: actor.id,
          text: dto.note ?? 'Encaminhado para análise.',
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          action: ApprovalActionType.FORWARDED,
          actorId: actor.id,
          reason: dto.note ?? null,
          metadata: { forwardedTo: dto.userId },
        },
      });
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'FORWARD_APPROVAL_REQUEST',
      entity: 'ApprovalRequest',
      entityId: id,
      newValue: { forwardedTo: dto.userId },
    });

    return this.findOne(id);
  }

  async comment(id: string, dto: CommentDto, actor: RequestUser) {
    const request = await this.scopeOf(id);

    const created = await this.prisma.approvalComment.create({
      data: {
        requestId: id,
        stepOrder: dto.stepOrder ?? null,
        authorId: actor.id,
        text: dto.text ?? '',
        attachmentIds: dto.attachmentIds ?? [],
      },
    });

    await this.prisma.approvalHistory.create({
      data: {
        requestId: id,
        action: ApprovalActionType.COMMENTED,
        stepOrder: dto.stepOrder ?? null,
        actorId: actor.id,
        reason: dto.text ?? null,
      },
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'COMMENT_APPROVAL_REQUEST',
      entity: 'ApprovalComment',
      entityId: created.id,
    });

    return created;
  }

  async findComments(id: string) {
    return this.prisma.approvalComment.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findHistory(id: string) {
    return this.prisma.approvalHistory.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  async cancel(id: string, dto: ReasonDto, actor: RequestUser) {
    const request = await this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    if (!LIVE_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        'Só uma solicitação em andamento pode ser cancelada.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id },
        data: {
          status: ApprovalRequestStatus.CANCELLED,
          cancellationReason: dto.reason,
          decidedAt: new Date(),
          currentStepOrder: null,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          action: ApprovalActionType.CANCELLED,
          actorId: actor.id,
          previousStatus: request.status,
          newStatus: ApprovalRequestStatus.CANCELLED,
          reason: dto.reason,
        },
      });
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'CANCEL_APPROVAL_REQUEST',
      entity: 'ApprovalRequest',
      entityId: id,
      reason: dto.reason,
    });

    return this.findOne(id);
  }

  /**
   * Reinicia o fluxo: encerra a solicitação atual e abre outra do zero.
   *
   * A anterior **não** é apagada. O que ela registrou — quem aprovou o quê, e por quê foi
   * reiniciada — é justamente o que uma auditoria vai querer ver.
   */
  async restart(id: string, dto: ReasonDto, actor: RequestUser) {
    const request = await this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { entry: true },
    });

    if (request.status === ApprovalRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Uma solicitação aprovada não pode ser reiniciada. Cancele o lançamento e processe o documento novamente.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (LIVE_STATUSES.includes(request.status)) {
        await tx.approvalRequest.update({
          where: { id },
          data: {
            status: ApprovalRequestStatus.CANCELLED,
            cancellationReason: `Fluxo reiniciado: ${dto.reason}`,
            decidedAt: new Date(),
            currentStepOrder: null,
          },
        });
      }

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          action: ApprovalActionType.RESTARTED,
          actorId: actor.id,
          previousStatus: request.status,
          newStatus: ApprovalRequestStatus.CANCELLED,
          reason: dto.reason,
        },
      });
    });

    const reopened = await this.openFor(request.entry, actor, {
      priority: request.priority,
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'RESTART_APPROVAL_REQUEST',
      entity: 'ApprovalRequest',
      entityId: id,
      newValue: { newRequestId: reopened?.id ?? null },
      reason: dto.reason,
    });

    return reopened;
  }

  async changePriority(id: string, dto: PriorityDto, actor: RequestUser) {
    const request = await this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { priority: dto.priority },
    });

    await this.prisma.approvalHistory.create({
      data: {
        requestId: id,
        action: ApprovalActionType.PRIORITY_CHANGED,
        actorId: actor.id,
        reason: dto.reason ?? null,
        metadata: { from: request.priority, to: dto.priority },
      },
    });

    await this.audit.log({
      organizationId: request.organizationId,
      companyId: request.companyId,
      userId: actor.id,
      action: 'CHANGE_APPROVAL_PRIORITY',
      entity: 'ApprovalRequest',
      entityId: id,
      oldValue: { priority: request.priority },
      newValue: { priority: dto.priority },
    });

    return updated;
  }

  /**
   * Marca como expiradas as solicitações que passaram do prazo (seção 4).
   *
   * Expirar não é reprovar: a solicitação sai da fila ativa, mas o lançamento não é negado —
   * alguém precisa reiniciar o fluxo conscientemente.
   */
  async expireOverdue(companyId: string, reference = new Date()) {
    const settings = await this.prisma.approvalSettings.findUnique({
      where: { companyId },
    });

    if (settings && !settings.expireOverdueRequests) return { expired: 0 };

    const overdue = await this.prisma.approvalRequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: LIVE_STATUSES },
        dueAt: { lt: reference },
      },
      select: { id: true, status: true },
    });

    for (const request of overdue) {
      await this.prisma.$transaction([
        this.prisma.approvalRequest.update({
          where: { id: request.id },
          data: {
            status: ApprovalRequestStatus.EXPIRED,
            currentStepOrder: null,
          },
        }),
        this.prisma.approvalHistory.create({
          data: {
            requestId: request.id,
            action: ApprovalActionType.EXPIRED,
            previousStatus: request.status,
            newStatus: ApprovalRequestStatus.EXPIRED,
            reason: 'Prazo de aprovação vencido.',
          },
        }),
      ]);
    }

    return { expired: overdue.length };
  }

  // ── Lote ──────────────────────────────────────────────────────────────────

  /**
   * Aplica a mesma decisão a várias solicitações.
   *
   * Cada uma é tratada isoladamente: uma recusa por falta de alçada não derruba as demais,
   * e o resultado devolve exatamente quais falharam e por quê. Um lote que falha inteiro
   * porque um item não passou seria pior que aprovar de uma em uma.
   */
  async runBatch(dto: BatchApprovalDto, actor: RequestUser) {
    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of dto.requestIds) {
      try {
        switch (dto.action) {
          case 'APPROVE':
            await this.approve(id, { comment: dto.comment }, actor);
            break;
          case 'REJECT':
            await this.reject(
              id,
              { reason: dto.reason ?? 'Reprovado em lote.' },
              actor,
            );
            break;
          case 'DELEGATE':
            await this.delegate(
              id,
              { delegateId: dto.delegateId as string, reason: dto.reason },
              actor,
            );
            break;
          case 'PRIORITY':
            await this.changePriority(
              id,
              {
                priority: dto.priority as ApprovalPriority,
                reason: dto.reason,
              },
              actor,
            );
            break;
        }
        succeeded.push(id);
      } catch (error) {
        failed.push({
          id,
          reason:
            error instanceof Error
              ? error.message
              : 'Não foi possível concluir a ação.',
        });
      }
    }

    return {
      succeeded: succeeded.length,
      failed,
      total: dto.requestIds.length,
    };
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private async loadForDecision(id: string) {
    const request = await this.prisma.approvalRequest.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!LIVE_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        'Esta solicitação já foi encerrada e não aceita novas decisões.',
      );
    }

    const step = request.steps.find(
      (item) =>
        item.status === ApprovalStepStatus.IN_PROGRESS ||
        item.status === ApprovalStepStatus.WAITING_INFORMATION,
    );

    if (!step) {
      throw new BadRequestException(
        'Esta solicitação não tem etapa em andamento.',
      );
    }

    const settings = await this.findSettings(
      request.organizationId,
      request.companyId,
    );

    return { request, step, settings };
  }

  /**
   * Fecha o ciclo quando a solicitação inteira foi aprovada: abre o lançamento e gera o
   * título a pagar (critério de aceite 1 do Contas a Pagar).
   *
   * Roda **depois** da transação da decisão, e não dentro dela, por duas razões. A decisão
   * de aprovar já está gravada e não pode ser desfeita porque a geração do título falhou;
   * e aninhar uma transação dentro de outra no Prisma cria um segundo cliente que não
   * enxerga o que a primeira ainda não confirmou.
   */
  private async settleApproved(requestId: string, actor: RequestUser) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      select: { status: true, entryId: true },
    });

    if (request?.status !== ApprovalRequestStatus.APPROVED) return;

    await this.prisma.financialEntry.updateMany({
      where: {
        id: request.entryId,
        status: FinancialEntryStatus.PENDING_APPROVAL,
      },
      data: {
        status: FinancialEntryStatus.OPEN,
        openedAt: new Date(),
        approvedBy: actor.id,
        approvedAt: new Date(),
      },
    });

    await this.payables.generateFromEntry(request.entryId, actor);
  }

  /** Avança para a próxima etapa aplicável, ou conclui a solicitação. */
  private async advance(
    tx: Prisma.TransactionClient,
    requestId: string,
    fromStepOrder: number,
    actor: RequestUser,
  ) {
    const next = await tx.approvalRequestStep.findFirst({
      where: {
        requestId,
        stepOrder: { gt: fromStepOrder },
        status: ApprovalStepStatus.PENDING,
      },
      orderBy: { stepOrder: 'asc' },
    });

    if (next) {
      await tx.approvalRequestStep.update({
        where: { id: next.id },
        data: {
          status: ApprovalStepStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      await tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: ApprovalRequestStatus.IN_PROGRESS,
          currentStepOrder: next.stepOrder,
        },
      });

      return;
    }

    const request = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { startedAt: true, status: true },
    });

    const decidedAt = new Date();

    await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: ApprovalRequestStatus.APPROVED,
        currentStepOrder: null,
        decidedAt,
        decisionSeconds: secondsBetween(request.startedAt, decidedAt),
      },
    });

    await tx.approvalHistory.create({
      data: {
        requestId,
        action: ApprovalActionType.APPROVED,
        actorId: actor.id,
        previousStatus: request.status,
        newStatus: ApprovalRequestStatus.APPROVED,
        reason: 'Todas as etapas obrigatórias foram aprovadas.',
      },
    });
  }

  /** Dados que o lançamento não guarda mas o casamento de fluxo pode exigir. */
  private async matchContextOf(entry: FinancialEntry) {
    const documentType = entry.sourceIntakeDocumentId
      ? ((
          await this.prisma.intakeDocument.findUnique({
            where: { id: entry.sourceIntakeDocumentId },
            select: { documentType: true },
          })
        )?.documentType ?? null)
      : null;

    const contracts = entry.supplierCompanyLinkId
      ? await this.prisma.supplierContract.findMany({
          where: {
            supplierCompanyLinkId: entry.supplierCompanyLinkId,
            deletedAt: null,
          },
          select: { id: true },
        })
      : [];

    return {
      documentType,
      contractIds: contracts.map((contract) => contract.id),
    };
  }
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function secondsBetween(start: Date | null, end: Date): number | null {
  if (!start) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

/** Situações do lançamento que ainda aceitam abrir uma solicitação de aprovação. */
export const APPROVABLE_ENTRY_STATUSES: FinancialEntryStatus[] = [
  FinancialEntryStatus.DRAFT,
  FinancialEntryStatus.PENDING_APPROVAL,
];
