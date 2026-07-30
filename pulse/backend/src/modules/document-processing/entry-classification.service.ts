import { Injectable } from '@nestjs/common';
import {
  FinancialEntryDimensionSource,
  type IntakeDocument,
  type SupplierCompanyLink,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ClassificationRulesService } from '../financial-structure/classification-rules.service';

/** As dimensões que a classificação resolve. */
export const DIMENSIONS = [
  'categoryId',
  'subcategoryId',
  'accountPlanId',
  'costCenterId',
  'resultCenterId',
  'projectId',
  'businessUnitId',
  'financialNatureId',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export interface ResolvedClassification {
  values: Partial<Record<Dimension, string | null>>;
  /** Quem decidiu cada dimensão. É o que permite revisar sem adivinhar. */
  sources: Partial<Record<Dimension, FinancialEntryDimensionSource>>;
  appliedClassificationRuleId: string | null;
  appliedAllocationRuleId: string | null;
  description: string | null;
  history: string | null;
}

/**
 * Resolve a classificação do lançamento.
 *
 * A ordem é deliberada e vai da decisão mais específica para a mais genérica:
 *
 * 1. **O que a pessoa já escolheu no documento.** Se alguém preencheu a categoria na
 *    revisão da entrada, nenhuma regra sobrescreve isso — a revisão é o ato humano mais
 *    recente sobre esse documento.
 * 2. **Regra de classificação automática** que casar, quando habilitada.
 * 3. **Padrões do vínculo** do fornecedor com a empresa.
 *
 * Cada dimensão é decidida isoladamente: uma regra pode definir o centro de custo sem
 * mexer na categoria que veio do documento. Misturar as origens é o comportamento certo —
 * o que não pode é perder o registro de qual origem venceu, e por isso `sources` acompanha
 * cada valor.
 */
@Injectable()
export class EntryClassificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: ClassificationRulesService,
  ) {}

  async resolve(
    document: IntakeDocument,
    link: SupplierCompanyLink | null,
    options: { autoClassificationEnabled: boolean },
  ): Promise<ResolvedClassification> {
    const values: Partial<Record<Dimension, string | null>> = {};
    const sources: Partial<Record<Dimension, FinancialEntryDimensionSource>> =
      {};

    // 1. O que já veio decidido no documento.
    for (const dimension of DIMENSIONS) {
      const value = document[dimension];
      if (value) {
        values[dimension] = value;
        sources[dimension] = FinancialEntryDimensionSource.DOCUMENT;
      }
    }

    let appliedClassificationRuleId: string | null = null;
    let appliedAllocationRuleId: string | null = null;
    let description: string | null = null;
    let history: string | null = null;

    // 2. Regra de classificação automática.
    if (options.autoClassificationEnabled && document.companyId) {
      const simulation = await this.rules.simulate({
        companyId: document.companyId,
        description: document.description ?? document.displayName ?? '',
        counterpartyName: document.issuerName ?? undefined,
        counterpartyDocument: document.issuerDocument ?? undefined,
        documentNumber: document.documentNumber ?? undefined,
        amount:
          document.grossAmount === null
            ? undefined
            : Number(document.grossAmount),
      });

      if (simulation.appliedRule && simulation.classification) {
        appliedClassificationRuleId = simulation.appliedRule.id;
        appliedAllocationRuleId =
          simulation.classification.allocationRule?.id ?? null;
        description = simulation.classification.description ?? null;
        history = simulation.classification.history ?? null;

        const fromRule: Partial<Record<Dimension, string | null>> = {
          categoryId: simulation.classification.category?.id ?? null,
          accountPlanId: simulation.classification.accountPlan?.id ?? null,
          costCenterId: simulation.classification.costCenter?.id ?? null,
          resultCenterId: simulation.classification.resultCenter?.id ?? null,
          projectId: simulation.classification.project?.id ?? null,
          businessUnitId: simulation.classification.businessUnit?.id ?? null,
          financialNatureId:
            simulation.classification.financialNature?.id ?? null,
        };

        this.fill(values, sources, fromRule, {
          source: FinancialEntryDimensionSource.CLASSIFICATION_RULE,
        });
      }
    }

    // 3. Padrões do vínculo do fornecedor.
    if (link) {
      this.fill(
        values,
        sources,
        {
          categoryId: link.defaultCategoryId,
          subcategoryId: link.defaultSubcategoryId,
          costCenterId: link.defaultCostCenterId,
        },
        { source: FinancialEntryDimensionSource.SUPPLIER_DEFAULT },
      );

      description ??= link.defaultDescription;
      history ??= link.defaultHistory;
    }

    // 4. Plano de contas e rateio padrão da categoria escolhida.
    if (values.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({
        where: { id: values.categoryId },
        select: {
          accountPlanId: true,
          financialNatureId: true,
          defaultCostCenterId: true,
          defaultAllocationRuleId: true,
        },
      });

      if (category) {
        this.fill(
          values,
          sources,
          {
            accountPlanId: category.accountPlanId,
            financialNatureId: category.financialNatureId,
            costCenterId: category.defaultCostCenterId,
          },
          { source: FinancialEntryDimensionSource.CATEGORY_DEFAULT },
        );

        appliedAllocationRuleId ??= category.defaultAllocationRuleId;
      }
    }

    return {
      values,
      sources,
      appliedClassificationRuleId,
      appliedAllocationRuleId,
      description: description ?? document.description ?? null,
      history,
    };
  }

  /** Preenche apenas o que ainda está vazio: quem chegou antes na ordem manda. */
  private fill(
    values: Partial<Record<Dimension, string | null>>,
    sources: Partial<Record<Dimension, FinancialEntryDimensionSource>>,
    incoming: Partial<Record<Dimension, string | null>>,
    options: { source: FinancialEntryDimensionSource },
  ) {
    for (const [dimension, value] of Object.entries(incoming) as [
      Dimension,
      string | null,
    ][]) {
      if (!value) continue;
      if (values[dimension]) continue;

      values[dimension] = value;
      sources[dimension] = options.source;
    }
  }
}
