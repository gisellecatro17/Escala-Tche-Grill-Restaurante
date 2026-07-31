import { Injectable } from '@nestjs/common';
import {
  ApprovalApproverType,
  RecordStatus,
  type ApprovalDelegation,
  type ApprovalRequestStep,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';

export interface ApproverEligibility {
  allowed: boolean;
  /** Motivo da recusa, em texto que pode ir direto para a tela. */
  reason: string | null;
  /** Delegação usada, quando a pessoa está agindo no lugar de outra. */
  delegation: ApprovalDelegation | null;
  /** Quem a pessoa está representando. Nulo quando aprova em nome próprio. */
  onBehalfOf: string | null;
}

const DENIED = (reason: string): ApproverEligibility => ({
  allowed: false,
  reason,
  delegation: null,
  onBehalfOf: null,
});

/**
 * Decide se uma pessoa pode decidir uma etapa.
 *
 * São quatro perguntas, nesta ordem — e a ordem importa porque a primeira resposta negativa
 * é a que vira mensagem na tela:
 *
 * 1. Tem a permissão `approvals.approve` na empresa? Delegação **não** cria permissão.
 * 2. É o aprovador designado — diretamente, pelo perfil, ou por delegação vigente?
 * 3. Não está aprovando o que ela mesma criou, quando isso é bloqueado?
 * 4. O valor cabe no limite individual do vínculo com a empresa?
 */
@Injectable()
export class ApproverResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async check(options: {
    actor: RequestUser;
    companyId: string;
    step: ApprovalRequestStep;
    amount: number;
    /** Quem criou o lançamento — para bloquear a autoaprovação. */
    requestedBy: string | null;
    blockSelfApprovalGlobally: boolean;
    enforceIndividualLimit: boolean;
  }): Promise<ApproverEligibility> {
    const { actor, companyId, step, amount } = options;

    if (
      !actor.isPlatformAdmin &&
      !this.hasPermission(actor, companyId, 'approvals.approve')
    ) {
      return DENIED(
        'Você não tem permissão para aprovar nesta empresa. Uma delegação não substitui a permissão.',
      );
    }

    const designation = await this.resolveDesignation(options);
    if (!designation.allowed) return designation;

    if (
      (options.blockSelfApprovalGlobally || step.blockSelfApproval) &&
      options.requestedBy !== null &&
      options.requestedBy === actor.id
    ) {
      return DENIED(
        'Você criou este lançamento e não pode aprová-lo. Peça a outro aprovador desta etapa.',
      );
    }

    if (options.enforceIndividualLimit) {
      const limit = await this.limitOf(actor, companyId, designation);
      if (limit !== null && amount > limit) {
        return DENIED(
          `O valor excede o seu limite de aprovação nesta empresa (${limit.toFixed(2)}).`,
        );
      }
    }

    return designation;
  }

  /** Delegações vigentes que apontam para esta pessoa nesta empresa, hoje. */
  async activeDelegationsFor(
    userId: string,
    companyId: string,
    reference = new Date(),
  ): Promise<ApprovalDelegation[]> {
    return this.prisma.approvalDelegation.findMany({
      where: {
        companyId,
        delegateId: userId,
        status: RecordStatus.ACTIVE,
        revokedAt: null,
        startsAt: { lte: reference },
        endsAt: { gte: reference },
      },
      orderBy: { endsAt: 'asc' },
    });
  }

  /**
   * A pessoa é o aprovador designado da etapa?
   *
   * `ANY_WITH_PERMISSION` já passou no teste de permissão acima, então basta. Nos outros
   * dois casos, ou ela é a designada, ou recebeu delegação de quem é.
   */
  private async resolveDesignation(options: {
    actor: RequestUser;
    companyId: string;
    step: ApprovalRequestStep;
  }): Promise<ApproverEligibility> {
    const { actor, companyId, step } = options;

    const allowed: ApproverEligibility = {
      allowed: true,
      reason: null,
      delegation: null,
      onBehalfOf: null,
    };

    if (step.approverType === ApprovalApproverType.ANY_WITH_PERMISSION) {
      return allowed;
    }

    if (actor.isPlatformAdmin) return allowed;

    if (step.approverType === ApprovalApproverType.SPECIFIC_USER) {
      if (step.approverUserId === actor.id) return allowed;

      const delegation = await this.delegationFrom(
        actor.id,
        companyId,
        step.approverUserId,
      );

      if (delegation) {
        return {
          allowed: true,
          reason: null,
          delegation,
          onBehalfOf: delegation.delegatorId,
        };
      }

      return DENIED('Esta etapa está designada a outra pessoa.');
    }

    // ROLE: a pessoa precisa ter o perfil exigido nesta empresa.
    const hasRole = await this.hasRole(
      actor.id,
      companyId,
      step.approverRoleId,
    );
    if (hasRole) return allowed;

    const delegations = await this.activeDelegationsFor(actor.id, companyId);

    for (const delegation of delegations) {
      if (
        await this.hasRole(
          delegation.delegatorId,
          companyId,
          step.approverRoleId,
        )
      ) {
        return {
          allowed: true,
          reason: null,
          delegation,
          onBehalfOf: delegation.delegatorId,
        };
      }
    }

    return DENIED('Seu perfil não é o exigido por esta etapa.');
  }

  private async delegationFrom(
    delegateId: string,
    companyId: string,
    delegatorId: string | null,
  ): Promise<ApprovalDelegation | null> {
    if (!delegatorId) return null;

    const now = new Date();

    return this.prisma.approvalDelegation.findFirst({
      where: {
        companyId,
        delegateId,
        delegatorId,
        status: RecordStatus.ACTIVE,
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });
  }

  private async hasRole(
    userId: string,
    companyId: string,
    roleId: string | null,
  ): Promise<boolean> {
    if (!roleId) return false;

    const membership = await this.prisma.userCompanyRole.findFirst({
      where: {
        userId,
        companyId,
        roleId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });

    return membership !== null;
  }

  /**
   * Teto de valor da pessoa nesta empresa.
   *
   * Quando age por delegação, valem **os dois** tetos: o de quem delegou e o da delegação,
   * o que for menor. Ninguém pode aprovar por delegação mais do que quem delegou poderia.
   */
  private async limitOf(
    actor: RequestUser,
    companyId: string,
    designation: ApproverEligibility,
  ): Promise<number | null> {
    if (actor.isPlatformAdmin) return null;

    const ownLimit = await this.membershipLimit(actor.id, companyId);

    if (!designation.delegation || !designation.onBehalfOf) return ownLimit;

    const delegatorLimit = await this.membershipLimit(
      designation.onBehalfOf,
      companyId,
    );
    const delegationCap =
      designation.delegation.maximumAmount === null
        ? null
        : Number(designation.delegation.maximumAmount);

    const limits = [delegatorLimit, delegationCap].filter(
      (limit): limit is number => limit !== null,
    );

    return limits.length === 0 ? null : Math.min(...limits);
  }

  private async membershipLimit(
    userId: string,
    companyId: string,
  ): Promise<number | null> {
    const membership = await this.prisma.userCompanyRole.findFirst({
      where: { userId, companyId, status: RecordStatus.ACTIVE },
      select: { approvalLimit: true },
    });

    return membership?.approvalLimit === null ||
      membership?.approvalLimit === undefined
      ? null
      : Number(membership.approvalLimit);
  }

  private hasPermission(
    actor: RequestUser,
    companyId: string,
    permission: string,
  ): boolean {
    return (
      actor.memberships
        .find((membership) => membership.companyId === companyId)
        ?.permissions.includes(permission) ?? false
    );
  }
}
