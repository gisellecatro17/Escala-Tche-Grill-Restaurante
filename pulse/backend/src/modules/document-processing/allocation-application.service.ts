import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AllocationCriterion,
  RecordStatus,
  type AllocationRuleItem,
  type AllocationTargetType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface AppliedAllocation {
  targetType: AllocationTargetType;
  costCenterId: string | null;
  resultCenterId: string | null;
  projectId: string | null;
  businessUnitId: string | null;
  categoryId: string | null;
  accountPlanId: string | null;
  percentage: number;
  amount: number;
  sortOrder: number;
}

/** Tolerância de um centésimo de ponto percentual ao conferir o fechamento em 100%. */
const PERCENTAGE_TOLERANCE = 0.01;

/**
 * Materializa o rateio no lançamento.
 *
 * A regra de rateio é um cadastro vivo: alguém pode mudar os percentuais amanhã. O que foi
 * aplicado a **este** título não pode mudar junto, senão um relatório de mês fechado passa
 * a devolver outro número. Por isso o resultado é gravado, não recalculado a cada leitura.
 *
 * Critérios que não são percentuais (quantidade, horas, peso, área, consumo) viram
 * percentual aqui, derivado da soma dos pesos — a regra guarda o peso, o lançamento guarda
 * a fração que aquele peso representou no dia em que foi aplicada.
 */
@Injectable()
export class AllocationApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async materialize(
    allocationRuleId: string | null,
    netAmount: number,
  ): Promise<AppliedAllocation[]> {
    if (!allocationRuleId) return [];

    const rule = await this.prisma.allocationRule.findFirst({
      where: {
        id: allocationRuleId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!rule || rule.items.length === 0) return [];

    const percentages = this.percentagesOf(
      rule.criterion,
      rule.items,
      netAmount,
    );
    const total = percentages.reduce((sum, value) => sum + value, 0);

    if (Math.abs(total - 100) > PERCENTAGE_TOLERANCE) {
      throw new BadRequestException(
        `O rateio "${rule.name}" soma ${total.toFixed(2)}% em vez de 100%. Corrija a regra antes de processar.`,
      );
    }

    const totalCents = Math.round(netAmount * 100);
    let distributedCents = 0;

    return rule.items.map((item, index) => {
      const isLast = index === rule.items.length - 1;
      // A sobra de arredondamento vai para a última linha, como nas parcelas: é a única
      // forma de a soma das linhas bater exatamente com o valor do título.
      const cents = isLast
        ? totalCents - distributedCents
        : Math.round(totalCents * (percentages[index] / 100));

      distributedCents += cents;

      return {
        targetType: item.targetType,
        costCenterId: item.costCenterId,
        resultCenterId: item.resultCenterId,
        projectId: item.projectId,
        businessUnitId: item.businessUnitId,
        categoryId: item.categoryId,
        accountPlanId: item.accountPlanId,
        percentage: percentages[index],
        amount: cents / 100,
        sortOrder: item.sortOrder,
      };
    });
  }

  private percentagesOf(
    criterion: AllocationCriterion,
    items: AllocationRuleItem[],
    netAmount: number,
  ): number[] {
    if (criterion === AllocationCriterion.PERCENTAGE) {
      return items.map((item) => Number(item.percentage ?? 0));
    }

    if (criterion === AllocationCriterion.FIXED_AMOUNT) {
      if (netAmount <= 0) {
        throw new BadRequestException(
          'Rateio por valor fixo exige um lançamento com valor maior que zero.',
        );
      }
      return items.map(
        (item) => (Number(item.fixedAmount ?? 0) / netAmount) * 100,
      );
    }

    // Quantidade, horas, peso, área, consumo e critério próprio: o peso vira fração.
    const weights = items.map((item) => Number(item.weight ?? 0));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    if (totalWeight <= 0) {
      throw new BadRequestException(
        'O rateio não tem pesos informados; não há como distribuir o valor.',
      );
    }

    return weights.map((weight) => (weight / totalWeight) * 100);
  }
}
