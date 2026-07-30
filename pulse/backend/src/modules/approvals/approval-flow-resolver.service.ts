import { Injectable } from '@nestjs/common';
import {
  ApprovalPriority,
  RecordStatus,
  type ApprovalFlow,
  type ApprovalFlowStep,
  type FinancialEntry,
  type IntakeDocumentType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

type FlowWithSteps = ApprovalFlow & { steps: ApprovalFlowStep[] };

/**
 * O que o lançamento não guarda, mas o fluxo pode exigir.
 *
 * `documentType` vive no documento de origem e `contractIds` nos contratos do vínculo do
 * fornecedor. Recebê-los prontos evita que o resolvedor faça consultas por conta própria —
 * ele decide, quem chama busca.
 */
export interface FlowMatchContext {
  documentType: IntakeDocumentType | null;
  contractIds: string[];
}

/** Ordem de urgência, para comparar `minimumPriority` com a da solicitação. */
const PRIORITY_ORDER: Record<ApprovalPriority, number> = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

/** Critérios que tornam um fluxo mais específico que outro no desempate. */
const SPECIFICITY_FIELDS = [
  'supplierId',
  'contractId',
  'projectId',
  'costCenterId',
  'categoryId',
  'businessUnitId',
  'financialNatureId',
  'paymentMethodId',
  'documentType',
  'direction',
  'minimumAmount',
  'maximumAmount',
  'minimumPriority',
] as const;

/**
 * Escolhe o fluxo de aprovação de um lançamento (seções 6 e 7).
 *
 * Um fluxo casa quando **todos** os critérios preenchidos batem. Critério nulo significa
 * "qualquer" — um fluxo sem nenhum critério é o fluxo padrão da empresa.
 *
 * O desempate é em duas camadas: primeiro a prioridade configurada (menor número vence),
 * depois a **especificidade** — o fluxo que exige mais coisas ganha do genérico. Sem a
 * segunda camada, dois fluxos com a mesma prioridade seriam decididos pela ordem de
 * inserção no banco, o que é o mesmo que decidir por sorteio.
 */
@Injectable()
export class ApprovalFlowResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    entry: FinancialEntry,
    priority: ApprovalPriority,
    context: FlowMatchContext,
  ): Promise<FlowWithSteps | null> {
    const flows = await this.prisma.approvalFlow.findMany({
      where: {
        companyId: entry.companyId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const amount = Number(entry.netAmount);

    const matching = flows.filter((flow) =>
      this.matches(flow, entry, amount, priority, context),
    );

    if (matching.length === 0) return null;

    return matching.sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority;
      }
      return this.specificityOf(second) - this.specificityOf(first);
    })[0];
  }

  /**
   * Etapas que valem para este valor.
   *
   * É aqui que a alçada financeira acontece: uma etapa com `minimumAmount` de 100.000 só
   * entra em lançamentos que a alcançam. Etapas obrigatórias fora da faixa não são
   * descartadas — elas ficam `SKIPPED`, para que o histórico mostre que a alçada existia e
   * não se aplicava.
   */
  applicableSteps(
    steps: ApprovalFlowStep[],
    amount: number,
  ): { step: ApprovalFlowStep; applies: boolean }[] {
    return steps.map((step) => ({
      step,
      applies:
        (step.minimumAmount === null || amount >= Number(step.minimumAmount)) &&
        (step.maximumAmount === null || amount <= Number(step.maximumAmount)),
    }));
  }

  private matches(
    flow: FlowWithSteps,
    entry: FinancialEntry,
    amount: number,
    priority: ApprovalPriority,
    context: FlowMatchContext,
  ): boolean {
    if (flow.steps.length === 0) return false;

    const pairs: [string | null, string | null][] = [
      [flow.categoryId, entry.categoryId],
      [flow.costCenterId, entry.costCenterId],
      [flow.projectId, entry.projectId],
      [flow.businessUnitId, entry.businessUnitId],
      [flow.financialNatureId, entry.financialNatureId],
      [flow.supplierId, entry.supplierId],
      [flow.paymentMethodId, entry.paymentMethodId],
    ];

    for (const [required, actual] of pairs) {
      if (required !== null && required !== actual) return false;
    }

    if (flow.direction !== null && flow.direction !== entry.direction) {
      return false;
    }

    if (
      flow.documentType !== null &&
      flow.documentType !== context.documentType
    ) {
      return false;
    }

    // Contrato: o lançamento não aponta para um contrato específico, então o critério casa
    // quando o contrato exigido está entre os contratos ativos do vínculo do fornecedor.
    if (
      flow.contractId !== null &&
      !context.contractIds.includes(flow.contractId)
    ) {
      return false;
    }

    if (flow.minimumAmount !== null && amount < Number(flow.minimumAmount)) {
      return false;
    }
    if (flow.maximumAmount !== null && amount > Number(flow.maximumAmount)) {
      return false;
    }

    if (
      flow.minimumPriority !== null &&
      PRIORITY_ORDER[priority] < PRIORITY_ORDER[flow.minimumPriority]
    ) {
      return false;
    }

    return true;
  }

  private specificityOf(flow: FlowWithSteps): number {
    return SPECIFICITY_FIELDS.filter(
      (field) => flow[field] !== null && flow[field] !== undefined,
    ).length;
  }
}
