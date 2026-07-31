import { Injectable } from '@nestjs/common';
import {
  ApprovalRequestStatus,
  ApprovalStepStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const LIVE: ApprovalRequestStatus[] = [
  ApprovalRequestStatus.PENDING,
  ApprovalRequestStatus.IN_PROGRESS,
  ApprovalRequestStatus.WAITING_INFORMATION,
];

/**
 * Indicadores das autorizações (seção 3).
 *
 * O "valor total pendente" soma apenas solicitações vivas: incluir aprovadas e reprovadas
 * daria um número maior que o que de fato espera decisão, e é justamente esse número que
 * alguém usa para decidir se precisa entrar na fila hoje.
 */
@Injectable()
export class ApprovalDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async build(organizationId: string, companyId: string | undefined) {
    const scope: Prisma.ApprovalRequestWhereInput = {
      organizationId,
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
    };

    const now = new Date();

    const [
      pending,
      pendingAmount,
      overdue,
      urgent,
      rejected,
      byCompany,
      byStatus,
      decided,
    ] = await this.prisma.$transaction([
      this.prisma.approvalRequest.count({
        where: { ...scope, status: { in: LIVE } },
      }),
      this.prisma.approvalRequest.aggregate({
        where: { ...scope, status: { in: LIVE } },
        _sum: { amount: true },
      }),
      this.prisma.approvalRequest.count({
        where: { ...scope, status: { in: LIVE }, dueAt: { lt: now } },
      }),
      this.prisma.approvalRequest.count({
        where: { ...scope, status: { in: LIVE }, priority: 'URGENT' },
      }),
      this.prisma.approvalRequest.count({
        where: { ...scope, status: ApprovalRequestStatus.REJECTED },
      }),
      this.prisma.approvalRequest.groupBy({
        by: ['companyId'],
        where: { ...scope, status: { in: LIVE } },
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { companyId: 'asc' },
      }),
      this.prisma.approvalRequest.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.approvalRequest.aggregate({
        where: {
          ...scope,
          status: ApprovalRequestStatus.APPROVED,
          decisionSeconds: { not: null },
        },
        _avg: { decisionSeconds: true },
        _count: { _all: true },
      }),
    ]);

    const [byApprover, byCostCenter, companies] = await Promise.all([
      this.byApprover(organizationId, companyId),
      this.byCostCenter(organizationId, companyId),
      this.companyNames(byCompany.map((row) => row.companyId)),
    ]);

    return {
      cards: {
        pending,
        pendingAmount: Number(pendingAmount._sum.amount ?? 0),
        overdue,
        urgent,
        rejected,
        approvedTotal: countOf(
          byStatus.find((row) => row.status === ApprovalRequestStatus.APPROVED),
        ),
      },
      byCompany: byCompany.map((row) => ({
        companyId: row.companyId,
        companyName: companies.get(row.companyId) ?? null,
        count: countOf(row),
        amount: Number(row._sum?.amount ?? 0),
      })),
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: countOf(row),
      })),
      byApprover,
      byCostCenter,
      indicators: {
        averageDecisionSeconds:
          decided._avg.decisionSeconds === null
            ? null
            : Math.round(decided._avg.decisionSeconds),
        decidedCount: decided._count._all,
      },
      note: 'Aprovação de despesa. Nenhum pagamento é autorizado, agendado ou executado neste módulo.',
    };
  }

  /**
   * Fila por aprovador designado.
   *
   * Só conta as etapas em andamento com pessoa nomeada: etapas por perfil não têm um dono
   * único, e atribuí-las a alguém daria uma fila que não corresponde à realidade.
   */
  private async byApprover(
    organizationId: string,
    companyId: string | undefined,
  ) {
    const steps = await this.prisma.approvalRequestStep.groupBy({
      by: ['approverUserId'],
      where: {
        status: ApprovalStepStatus.IN_PROGRESS,
        approverUserId: { not: null },
        request: {
          organizationId,
          ...(companyId ? { companyId } : {}),
          deletedAt: null,
          status: { in: LIVE },
        },
      },
      _count: { _all: true },
      orderBy: { approverUserId: 'asc' },
    });

    const userIds = steps
      .map((row) => row.approverUserId)
      .filter((id): id is string => id !== null);

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const names = new Map(users.map((user) => [user.id, user.name]));

    return steps.map((row) => ({
      userId: row.approverUserId,
      userName: names.get(row.approverUserId as string) ?? null,
      count: countOf(row),
    }));
  }

  private async byCostCenter(
    organizationId: string,
    companyId: string | undefined,
  ) {
    const requests = await this.prisma.approvalRequest.findMany({
      where: {
        organizationId,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
        status: { in: LIVE },
      },
      select: { amount: true, entry: { select: { costCenterId: true } } },
    });

    const totals = new Map<string, { count: number; amount: number }>();

    for (const request of requests) {
      const key = request.entry.costCenterId ?? 'SEM_CENTRO_DE_CUSTO';
      const current = totals.get(key) ?? { count: 0, amount: 0 };
      totals.set(key, {
        count: current.count + 1,
        amount: current.amount + Number(request.amount),
      });
    }

    const ids = [...totals.keys()].filter(
      (key) => key !== 'SEM_CENTRO_DE_CUSTO',
    );

    const costCenters = await this.prisma.costCenter.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    const names = new Map(costCenters.map((item) => [item.id, item.name]));

    return [...totals.entries()].map(([id, totalsForId]) => ({
      costCenterId: id === 'SEM_CENTRO_DE_CUSTO' ? null : id,
      costCenterName: names.get(id) ?? null,
      ...totalsForId,
    }));
  }

  private async companyNames(ids: string[]) {
    const companies = await this.prisma.company.findMany({
      where: { id: { in: ids } },
      select: { id: true, legalName: true, tradeName: true },
    });

    return new Map(
      companies.map((company) => [
        company.id,
        company.tradeName ?? company.legalName ?? null,
      ]),
    );
  }
}

/**
 * Contagem de uma linha do `groupBy`.
 *
 * O tipo gerado pelo Prisma declara `_count` como opcional mesmo quando ele foi pedido, e
 * espalhar `?._count?._all ?? 0` por toda a montagem do painel esconderia o que se está
 * lendo. O helper concentra isso em um lugar.
 */
function countOf(
  row: { _count?: { _all?: number } | true } | undefined,
): number {
  if (!row || row._count === undefined || row._count === true) return 0;
  return row._count._all ?? 0;
}
