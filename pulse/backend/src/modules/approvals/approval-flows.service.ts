import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ApprovalApproverType,
  ApprovalRequestStatus,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import type {
  ApprovalFlowStepDto,
  CreateApprovalFlowDto,
  CreateDelegationDto,
  DelegationQueryDto,
  UpdateApprovalFlowDto,
} from './dto/approvals.dto';

/**
 * Cadastro dos fluxos de aprovação e das delegações por período.
 *
 * Editar um fluxo **não** mexe em solicitação em andamento: as etapas da solicitação são
 * cópias feitas no momento da abertura. Quem aprovou aprovou sob as regras que valiam.
 */
@Injectable()
export class ApprovalFlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Fluxos ────────────────────────────────────────────────────────────────

  async findAll(companyId: string, includeInactive = false) {
    return this.prisma.approvalFlow.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { status: RecordStatus.ACTIVE }),
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        _count: { select: { requests: true } },
      },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    return this.prisma.approvalFlow.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async scopeOf(id: string) {
    return this.prisma.approvalFlow.findFirstOrThrow({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true },
    });
  }

  async create(dto: CreateApprovalFlowDto, actor: RequestUser) {
    this.assertStepsAreValid(dto.steps);

    const flow = await this.prisma.approvalFlow.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        name: dto.name,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        costCenterId: dto.costCenterId ?? null,
        projectId: dto.projectId ?? null,
        businessUnitId: dto.businessUnitId ?? null,
        financialNatureId: dto.financialNatureId ?? null,
        contractId: dto.contractId ?? null,
        supplierId: dto.supplierId ?? null,
        paymentMethodId: dto.paymentMethodId ?? null,
        documentType: dto.documentType ?? null,
        direction: dto.direction ?? null,
        minimumAmount: dto.minimumAmount ?? null,
        maximumAmount: dto.maximumAmount ?? null,
        minimumPriority: dto.minimumPriority ?? null,
        priority: dto.priority ?? 100,
        defaultDeadlineHours: dto.defaultDeadlineHours ?? 48,
        notificationChannels: dto.notificationChannels ?? [],
        isDefault: dto.isDefault ?? false,
        createdBy: actor.id,
        steps: { create: dto.steps.map((step) => this.mapStep(step)) },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE_APPROVAL_FLOW',
      entity: 'ApprovalFlow',
      entityId: flow.id,
      newValue: { name: flow.name, steps: flow.steps.length },
    });

    return flow;
  }

  async update(id: string, dto: UpdateApprovalFlowDto, actor: RequestUser) {
    const before = await this.findOne(id);

    if (dto.steps) this.assertStepsAreValid(dto.steps);

    const flow = await this.prisma.$transaction(async (tx) => {
      if (dto.steps) {
        // As solicitações em andamento não são afetadas: elas guardam cópias das etapas.
        await tx.approvalFlowStep.deleteMany({ where: { flowId: id } });
        await tx.approvalFlowStep.createMany({
          data: dto.steps.map((step) => ({
            flowId: id,
            ...this.mapStep(step),
          })),
        });
      }

      return tx.approvalFlow.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.defaultDeadlineHours !== undefined
            ? { defaultDeadlineHours: dto.defaultDeadlineHours }
            : {}),
          ...(dto.notificationChannels !== undefined
            ? { notificationChannels: dto.notificationChannels }
            : {}),
          ...(dto.status !== undefined
            ? { status: dto.status as RecordStatus }
            : {}),
          updatedBy: actor.id,
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });

    await this.audit.log({
      organizationId: before.organizationId,
      companyId: before.companyId,
      userId: actor.id,
      action: dto.steps ? 'CHANGE_APPROVAL_FLOW_STEPS' : 'UPDATE_APPROVAL_FLOW',
      entity: 'ApprovalFlow',
      entityId: id,
      oldValue: { name: before.name, steps: before.steps.length },
      newValue: { name: flow.name, steps: flow.steps.length },
    });

    return flow;
  }

  /**
   * Exclui o fluxo logicamente.
   *
   * Recusa enquanto houver solicitação viva usando o fluxo: apagá-lo deixaria a solicitação
   * apontando para um fluxo que não existe mais, e o histórico perderia o "sob quais regras
   * isto foi aprovado".
   */
  async remove(id: string, actor: RequestUser) {
    const flow = await this.findOne(id);

    const live = await this.prisma.approvalRequest.count({
      where: {
        flowId: id,
        deletedAt: null,
        status: {
          in: [
            ApprovalRequestStatus.PENDING,
            ApprovalRequestStatus.IN_PROGRESS,
            ApprovalRequestStatus.WAITING_INFORMATION,
          ],
        },
      },
    });

    if (live > 0) {
      throw new BadRequestException(
        `Este fluxo tem ${live} solicitação(ões) em andamento. Conclua ou cancele antes de excluí-lo.`,
      );
    }

    await this.prisma.approvalFlow.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: flow.organizationId,
      companyId: flow.companyId,
      userId: actor.id,
      action: 'DELETE_APPROVAL_FLOW',
      entity: 'ApprovalFlow',
      entityId: id,
      oldValue: { name: flow.name },
    });

    return { deleted: true };
  }

  // ── Delegações ────────────────────────────────────────────────────────────

  async findDelegations(query: DelegationQueryDto) {
    const now = new Date();

    return this.prisma.approvalDelegation.findMany({
      where: {
        companyId: query.companyId,
        ...(query.delegatorId ? { delegatorId: query.delegatorId } : {}),
        ...(query.delegateId ? { delegateId: query.delegateId } : {}),
        ...(query.activeOnly
          ? {
              status: RecordStatus.ACTIVE,
              revokedAt: null,
              startsAt: { lte: now },
              endsAt: { gte: now },
            }
          : {}),
      },
      orderBy: [{ startsAt: 'desc' }],
    });
  }

  async createDelegation(dto: CreateDelegationDto, actor: RequestUser) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'A data final da delegação precisa ser posterior à inicial.',
      );
    }

    if (dto.delegatorId === dto.delegateId) {
      throw new BadRequestException(
        'Não faz sentido delegar aprovações para a própria pessoa.',
      );
    }

    // Uma delegação em cadeia (A→B enquanto B→C) esconderia quem realmente decidiu.
    const chained = await this.prisma.approvalDelegation.findFirst({
      where: {
        companyId: dto.companyId,
        delegatorId: dto.delegateId,
        status: RecordStatus.ACTIVE,
        revokedAt: null,
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
      select: { id: true },
    });

    if (chained) {
      throw new BadRequestException(
        'A pessoa indicada já delegou as próprias aprovações nesse período. Delegação em cadeia não é permitida.',
      );
    }

    const delegation = await this.prisma.approvalDelegation.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        delegatorId: dto.delegatorId,
        delegateId: dto.delegateId,
        reason: dto.reason ?? 'ABSENCE',
        description: dto.description ?? null,
        startsAt,
        endsAt,
        maximumAmount: dto.maximumAmount ?? null,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE_APPROVAL_DELEGATION',
      entity: 'ApprovalDelegation',
      entityId: delegation.id,
      newValue: {
        delegatorId: dto.delegatorId,
        delegateId: dto.delegateId,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        maximumAmount: dto.maximumAmount ?? null,
      },
      reason: dto.description ?? null,
    });

    return delegation;
  }

  /** Organização e empresa da delegação, para o controlador validar a permissão. */
  async delegationScopeOf(id: string) {
    return this.prisma.approvalDelegation.findFirstOrThrow({
      where: { id },
      select: { id: true, organizationId: true, companyId: true },
    });
  }

  async revokeDelegation(id: string, actor: RequestUser) {
    const delegation = await this.prisma.approvalDelegation.findFirstOrThrow({
      where: { id },
    });

    if (delegation.revokedAt) {
      throw new BadRequestException('Esta delegação já foi revogada.');
    }

    const revoked = await this.prisma.approvalDelegation.update({
      where: { id },
      data: {
        status: RecordStatus.INACTIVE,
        revokedBy: actor.id,
        revokedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: delegation.organizationId,
      companyId: delegation.companyId,
      userId: actor.id,
      action: 'REVOKE_APPROVAL_DELEGATION',
      entity: 'ApprovalDelegation',
      entityId: id,
      oldValue: { status: delegation.status },
      newValue: { status: RecordStatus.INACTIVE },
    });

    return revoked;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private mapStep(step: ApprovalFlowStepDto) {
    return {
      stepOrder: step.stepOrder,
      name: step.name,
      approverType: step.approverType ?? ApprovalApproverType.ROLE,
      approverUserId: step.approverUserId ?? null,
      approverRoleId: step.approverRoleId ?? null,
      requiredApprovals: step.requiredApprovals ?? 1,
      isMandatory: step.isMandatory ?? true,
      minimumAmount: step.minimumAmount ?? null,
      maximumAmount: step.maximumAmount ?? null,
      deadlineHours: step.deadlineHours ?? null,
      blockSelfApproval: step.blockSelfApproval ?? true,
      notes: step.notes ?? null,
    } satisfies Omit<Prisma.ApprovalFlowStepCreateManyInput, 'flowId'>;
  }

  /**
   * Confere o que uma etapa mal configurada quebraria só na hora de aprovar.
   *
   * Uma etapa `SPECIFIC_USER` sem usuário, ou `ROLE` sem perfil, cria uma solicitação que
   * ninguém consegue decidir — e o defeito só apareceria com o lançamento já travado na
   * fila.
   */
  private assertStepsAreValid(steps: ApprovalFlowStepDto[]) {
    const orders = new Set<number>();

    for (const step of steps) {
      if (orders.has(step.stepOrder)) {
        throw new BadRequestException(
          `Há duas etapas com a ordem ${step.stepOrder}. A ordem precisa ser única no fluxo.`,
        );
      }
      orders.add(step.stepOrder);

      const type = step.approverType ?? ApprovalApproverType.ROLE;

      if (type === ApprovalApproverType.SPECIFIC_USER && !step.approverUserId) {
        throw new BadRequestException(
          `A etapa "${step.name}" indica uma pessoa específica, mas nenhuma foi informada.`,
        );
      }

      if (type === ApprovalApproverType.ROLE && !step.approverRoleId) {
        throw new BadRequestException(
          `A etapa "${step.name}" exige um perfil, mas nenhum foi informado.`,
        );
      }

      if (
        type === ApprovalApproverType.SPECIFIC_USER &&
        (step.requiredApprovals ?? 1) > 1
      ) {
        throw new BadRequestException(
          `A etapa "${step.name}" exige mais de uma aprovação, mas está designada a uma única pessoa. Use um perfil ou reduza para uma aprovação.`,
        );
      }

      if (
        step.minimumAmount !== undefined &&
        step.maximumAmount !== undefined &&
        step.minimumAmount > step.maximumAmount
      ) {
        throw new BadRequestException(
          `A faixa de valor da etapa "${step.name}" está invertida.`,
        );
      }
    }
  }
}
