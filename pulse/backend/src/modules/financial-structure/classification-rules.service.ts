import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassificationMatchField,
  ClassificationMatchType,
  ClassificationRule,
  Prisma,
  RecordStatus,
  RuleConditionField,
  RuleConditionOperator,
  TransactionOrigin,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  CreateClassificationRuleDto,
  SimulateClassificationDto,
  UpdateClassificationRuleDto,
} from './dto/classification-rule.dto';
import { StructureQueryDto } from './dto/common.dto';
import {
  RuleActionDto,
  RuleConditionDto,
  TestRuleDto,
} from './dto/rule-condition-action.dto';
import {
  detectConflicts,
  evaluateRule,
  normalizeForMatching,
  type EvaluableCondition,
} from './utils/rule-matching.util';

const RULE_INCLUDE = {
  category: { select: { id: true, name: true } },
  accountPlan: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, name: true } },
  resultCenter: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  businessUnit: { select: { id: true, name: true } },
  financialNature: { select: { id: true, name: true, kind: true } },
  allocationRule: { select: { id: true, name: true } },
  conditions: { orderBy: { sortOrder: 'asc' } },
  actions: {
    include: {
      category: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true } },
      resultCenter: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      businessUnit: { select: { id: true, name: true } },
      accountPlan: { select: { id: true, code: true, name: true } },
      financialNature: { select: { id: true, name: true, kind: true } },
      allocationRule: { select: { id: true, name: true } },
      tag: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ClassificationRuleInclude;

@Injectable()
export class ClassificationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(companyId: string, query: StructureQueryDto) {
    return this.prisma.classificationRule.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.includeInactive ? {} : { status: RecordStatus.ACTIVE }),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { matchValue: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: RULE_INCLUDE,
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.classificationRule.findFirst({
      where: { id, deletedAt: null },
      include: RULE_INCLUDE,
    });
    if (!rule)
      throw new NotFoundException('Regra de classificação não encontrada.');
    return rule;
  }

  async create(dto: CreateClassificationRuleDto, actor: RequestUser) {
    this.assertRuleIsValid(dto);

    const rule = await this.prisma.classificationRule.create({
      data: {
        companyId: dto.companyId,
        name: dto.name.trim(),
        description: dto.description,
        matchField: dto.matchField,
        matchType: dto.matchType,
        matchValue: dto.matchValue.trim(),
        caseSensitive: dto.caseSensitive ?? false,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        origin: dto.origin,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        accountPlanId: dto.accountPlanId,
        costCenterId: dto.costCenterId,
        resultCenterId: dto.resultCenterId,
        projectId: dto.projectId,
        businessUnitId: dto.businessUnitId,
        financialNatureId: dto.financialNatureId,
        allocationRuleId: dto.allocationRuleId,
        supplierId: dto.supplierId,
        customerId: dto.customerId,
        appliedDescription: dto.appliedDescription,
        appliedHistory: dto.appliedHistory,
        priority: dto.priority ?? 100,
        confidenceThreshold: dto.confidenceThreshold ?? 95,
        autoApply: dto.autoApply ?? false,
        status: dto.status,
        automatic: dto.automatic ?? false,
        requiresConfirmation: dto.requiresConfirmation ?? true,
        sourceType: dto.origin,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        createdBy: actor.id,
        conditions: { create: this.buildConditions(dto) },
        actions: { create: this.buildActions(dto) },
      },
      include: RULE_INCLUDE,
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'ClassificationRule',
      entityId: rule.id,
      newValue: {
        name: rule.name,
        conditions: rule.conditions.length,
        actions: rule.actions.length,
      },
    });

    return rule;
  }

  /**
   * Monta as condições da regra. Quando `conditions` não é informado, deriva **uma**
   * condição dos campos planos (`matchField`/`matchType`/`matchValue`), que continuam
   * servindo de atalho para o caso simples de critério único. Assim a tabela
   * `classification_rule_conditions` é sempre a fonte de verdade da avaliação.
   */
  private buildConditions(
    dto: Partial<CreateClassificationRuleDto>,
  ): Prisma.ClassificationRuleConditionUncheckedCreateWithoutClassificationRuleInput[] {
    if (dto.conditions?.length) {
      return dto.conditions.map((condition, index) =>
        this.mapCondition(condition, index),
      );
    }

    if (!dto.matchValue) return [];

    return [
      {
        field: this.legacyFieldToConditionField(dto.matchField),
        operator: this.legacyTypeToOperator(dto.matchType),
        value: dto.matchValue.trim(),
        normalizedValue: normalizeForMatching(dto.matchValue),
        sortOrder: 0,
      },
    ];
  }

  private mapCondition(
    condition: RuleConditionDto,
    index: number,
  ): Prisma.ClassificationRuleConditionUncheckedCreateWithoutClassificationRuleInput {
    return {
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
      normalizedValue: normalizeForMatching(condition.value),
      secondaryValue: condition.secondaryValue,
      sortOrder: condition.sortOrder ?? index,
    };
  }

  /**
   * Monta as ações. Quando `actions` não é informado, deriva **uma** ação das dimensões
   * planas do DTO, preservando a API simples já usada pelo front-end.
   */
  private buildActions(
    dto: Partial<CreateClassificationRuleDto>,
  ): Prisma.ClassificationRuleActionUncheckedCreateWithoutClassificationRuleInput[] {
    if (dto.actions?.length) {
      return dto.actions.map((action) => this.mapAction(action));
    }

    const derived: Prisma.ClassificationRuleActionUncheckedCreateWithoutClassificationRuleInput =
      {
        supplierId: dto.supplierId,
        customerId: dto.customerId,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        accountPlanId: dto.accountPlanId,
        costCenterId: dto.costCenterId,
        resultCenterId: dto.resultCenterId,
        projectId: dto.projectId,
        businessUnitId: dto.businessUnitId,
        financialNatureId: dto.financialNatureId,
        allocationRuleId: dto.allocationRuleId,
        defaultDescription: dto.appliedDescription,
        defaultHistory: dto.appliedHistory,
      };

    // Sem nenhuma dimensão informada não há ação a registrar.
    const hasAny = Object.values(derived).some((value) => value != null);
    return hasAny ? [derived] : [];
  }

  private mapAction(
    action: RuleActionDto,
  ): Prisma.ClassificationRuleActionUncheckedCreateWithoutClassificationRuleInput {
    return {
      supplierId: action.supplierId,
      customerId: action.customerId,
      categoryId: action.categoryId,
      subcategoryId: action.subcategoryId,
      accountPlanId: action.accountPlanId,
      costCenterId: action.costCenterId,
      resultCenterId: action.resultCenterId,
      projectId: action.projectId,
      businessUnitId: action.businessUnitId,
      financialNatureId: action.financialNatureId,
      allocationRuleId: action.allocationRuleId,
      paymentMethodId: action.paymentMethodId,
      bankAccountId: action.bankAccountId,
      tagId: action.tagId,
      defaultDescription: action.defaultDescription,
      defaultHistory: action.defaultHistory,
      responsibleUserId: action.responsibleUserId,
      requiresApproval: action.requiresApproval ?? false,
      suggestReconciliation: action.suggestReconciliation ?? false,
      createFinancialEntry: action.createFinancialEntry ?? false,
      autoMatch: action.autoMatch ?? false,
    };
  }

  private legacyFieldToConditionField(
    field: ClassificationMatchField | undefined,
  ): RuleConditionField {
    switch (field) {
      case ClassificationMatchField.COUNTERPARTY_NAME:
        return RuleConditionField.SUPPLIER;
      case ClassificationMatchField.COUNTERPARTY_DOCUMENT:
        return RuleConditionField.CNPJ;
      case ClassificationMatchField.BANK_HISTORY:
        return RuleConditionField.BANK_HISTORY;
      case ClassificationMatchField.AMOUNT:
        return RuleConditionField.AMOUNT;
      case ClassificationMatchField.DOCUMENT_NUMBER:
        return RuleConditionField.DOCUMENT_NUMBER;
      default:
        return RuleConditionField.DESCRIPTION;
    }
  }

  private legacyTypeToOperator(
    type: ClassificationMatchType | undefined,
  ): RuleConditionOperator {
    switch (type) {
      case ClassificationMatchType.EQUALS:
        return RuleConditionOperator.EQUALS;
      case ClassificationMatchType.STARTS_WITH:
        return RuleConditionOperator.STARTS_WITH;
      case ClassificationMatchType.ENDS_WITH:
        return RuleConditionOperator.ENDS_WITH;
      case ClassificationMatchType.REGEX:
        return RuleConditionOperator.REGEX;
      case ClassificationMatchType.DOCUMENT_NUMBER:
        return RuleConditionOperator.EQUALS;
      case ClassificationMatchType.AMOUNT_RANGE:
        return RuleConditionOperator.BETWEEN;
      default:
        return RuleConditionOperator.CONTAINS;
    }
  }

  /**
   * Simulador da seção 40: avalia as condições reais de cada regra ativa e devolve a
   * regra vencedora, as demais candidatas e os conflitos. **Nada é persistido.**
   */
  async testRule(dto: TestRuleDto) {
    const rules = await this.prisma.classificationRule.findMany({
      where: {
        companyId: dto.companyId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
      },
      include: RULE_INCLUDE,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const matched = rules.filter((rule) =>
      evaluateRule(rule.conditions as EvaluableCondition[], dto),
    );
    const winner = matched[0];
    const conflicts = detectConflicts(
      matched.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        actions: rule.actions,
      })),
    );

    return {
      matchedCount: matched.length,
      appliedRule: winner
        ? {
            id: winner.id,
            name: winner.name,
            priority: winner.priority,
            confidence: winner.confidenceThreshold,
            automatic: winner.automatic,
            requiresConfirmation: winner.requiresConfirmation,
          }
        : null,
      suggestedActions: winner?.actions ?? [],
      otherMatches: matched.slice(1).map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
      })),
      conflicts,
      // Um conflito suspende a automação: não há desempate objetivo (seção 39).
      automationSuspended: conflicts.length > 0,
      persisted: false,
      note: 'Simulação apenas — nenhum lançamento foi criado ou classificado.',
    };
  }

  /** Lista conflitos entre as regras ativas da empresa (seção 39). */
  async findConflicts(companyId: string) {
    const rules = await this.prisma.classificationRule.findMany({
      where: { companyId, deletedAt: null, status: RecordStatus.ACTIVE },
      include: { actions: true },
      orderBy: { priority: 'asc' },
    });

    const conflicts = detectConflicts(
      rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        actions: rule.actions,
      })),
    );

    return { total: conflicts.length, conflicts };
  }

  async update(
    id: string,
    dto: UpdateClassificationRuleDto,
    actor: RequestUser,
  ) {
    const current = await this.findOne(id);

    // Valida a regra já com os valores resultantes da mesclagem (atual + alterações).
    this.assertRuleIsValid({
      matchType: dto.matchType ?? current.matchType,
      matchValue: dto.matchValue ?? current.matchValue,
      minAmount:
        dto.minAmount ??
        (current.minAmount != null ? Number(current.minAmount) : undefined),
      maxAmount:
        dto.maxAmount ??
        (current.maxAmount != null ? Number(current.maxAmount) : undefined),
    });

    const rule = await this.prisma.classificationRule.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        matchField: dto.matchField,
        matchType: dto.matchType,
        matchValue: dto.matchValue?.trim(),
        caseSensitive: dto.caseSensitive,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        origin: dto.origin,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        accountPlanId: dto.accountPlanId,
        costCenterId: dto.costCenterId,
        resultCenterId: dto.resultCenterId,
        projectId: dto.projectId,
        businessUnitId: dto.businessUnitId,
        financialNatureId: dto.financialNatureId,
        allocationRuleId: dto.allocationRuleId,
        supplierId: dto.supplierId,
        customerId: dto.customerId,
        appliedDescription: dto.appliedDescription,
        appliedHistory: dto.appliedHistory,
        priority: dto.priority,
        confidenceThreshold: dto.confidenceThreshold,
        autoApply: dto.autoApply,
        status: dto.status,
        updatedBy: actor.id,
      },
      include: RULE_INCLUDE,
    });

    await this.audit.log({
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'ClassificationRule',
      entityId: id,
      oldValue: { name: current.name, matchValue: current.matchValue },
      newValue: { name: rule.name, matchValue: rule.matchValue },
    });

    return rule;
  }

  async remove(id: string, actor: RequestUser) {
    const rule = await this.findOne(id);

    await this.prisma.classificationRule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      companyId: rule.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'ClassificationRule',
      entityId: id,
      oldValue: { name: rule.name },
    });

    return { id };
  }

  /**
   * Simula a classificação de um lançamento hipotético. **Nada é persistido** — o motor
   * automático real só existirá com os módulos de importação bancária e contas a
   * pagar/receber. Serve para o usuário validar suas regras antes de confiar nelas.
   */
  async simulate(dto: SimulateClassificationDto) {
    const rules = await this.prisma.classificationRule.findMany({
      where: {
        companyId: dto.companyId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
      },
      include: RULE_INCLUDE,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const matched = rules.filter((rule) => this.matches(rule, dto));
    const winner = matched[0];

    return {
      matchedCount: matched.length,
      // Menor prioridade numérica vence; as demais ficam listadas para diagnóstico.
      appliedRule: winner
        ? {
            id: winner.id,
            name: winner.name,
            priority: winner.priority,
            autoApply: winner.autoApply,
            confidenceThreshold: winner.confidenceThreshold,
          }
        : null,
      classification: winner
        ? {
            category: winner.category,
            accountPlan: winner.accountPlan,
            costCenter: winner.costCenter,
            resultCenter: winner.resultCenter,
            project: winner.project,
            businessUnit: winner.businessUnit,
            financialNature: winner.financialNature,
            allocationRule: winner.allocationRule,
            description: winner.appliedDescription,
            history: winner.appliedHistory,
          }
        : null,
      otherMatches: matched.slice(1).map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
      })),
      persisted: false,
      note: 'Simulação apenas — nenhum lançamento foi criado ou classificado.',
    };
  }

  // ── Motor de comparação ────────────────────────────────────────────────────

  private matches(
    rule: ClassificationRule,
    input: SimulateClassificationDto,
  ): boolean {
    if (
      rule.origin !== TransactionOrigin.ANY &&
      input.origin &&
      rule.origin !== input.origin
    ) {
      return false;
    }

    if (input.amount != null) {
      if (rule.minAmount != null && input.amount < Number(rule.minAmount))
        return false;
      if (rule.maxAmount != null && input.amount > Number(rule.maxAmount))
        return false;
    }

    if (rule.matchType === ClassificationMatchType.AMOUNT_RANGE) {
      // A faixa já foi verificada acima; sem valor informado não há como casar.
      return input.amount != null;
    }

    const target = this.resolveTargetValue(rule.matchField, input);
    if (!target) return false;

    const haystack = rule.caseSensitive ? target : target.toLowerCase();
    const needle = rule.caseSensitive
      ? rule.matchValue
      : rule.matchValue.toLowerCase();

    switch (rule.matchType) {
      case ClassificationMatchType.EQUALS:
        return haystack === needle;
      case ClassificationMatchType.STARTS_WITH:
        return haystack.startsWith(needle);
      case ClassificationMatchType.ENDS_WITH:
        return haystack.endsWith(needle);
      case ClassificationMatchType.REGEX:
        return this.safeRegexTest(rule.matchValue, target, rule.caseSensitive);
      case ClassificationMatchType.DOCUMENT_NUMBER:
        return (
          haystack.replace(/\D/g, '') === needle.replace(/\D/g, '') &&
          needle.replace(/\D/g, '').length > 0
        );
      case ClassificationMatchType.CONTAINS:
      default:
        return haystack.includes(needle);
    }
  }

  private resolveTargetValue(
    field: ClassificationMatchField,
    input: SimulateClassificationDto,
  ): string | undefined {
    switch (field) {
      case ClassificationMatchField.COUNTERPARTY_NAME:
        return input.counterpartyName;
      case ClassificationMatchField.COUNTERPARTY_DOCUMENT:
        return input.counterpartyDocument;
      case ClassificationMatchField.BANK_HISTORY:
        return input.bankHistory;
      case ClassificationMatchField.DOCUMENT_NUMBER:
        return input.documentNumber;
      case ClassificationMatchField.AMOUNT:
        return input.amount != null ? String(input.amount) : undefined;
      case ClassificationMatchField.DESCRIPTION:
      default:
        return input.description;
    }
  }

  /** Uma expressão inválida salva no passado não pode derrubar a simulação inteira. */
  private safeRegexTest(
    pattern: string,
    value: string,
    caseSensitive: boolean,
  ): boolean {
    try {
      return new RegExp(pattern, caseSensitive ? '' : 'i').test(value);
    } catch {
      return false;
    }
  }

  private assertRuleIsValid(
    dto: Partial<CreateClassificationRuleDto> & {
      matchType?: ClassificationMatchType;
    },
  ): void {
    if (
      dto.minAmount != null &&
      dto.maxAmount != null &&
      dto.maxAmount < dto.minAmount
    ) {
      throw new BadRequestException(
        'O valor máximo da regra deve ser maior ou igual ao valor mínimo.',
      );
    }

    if (dto.matchType === ClassificationMatchType.REGEX && dto.matchValue) {
      try {
        new RegExp(dto.matchValue);
      } catch {
        throw new BadRequestException(
          'A expressão regular informada é inválida. Revise o padrão da regra.',
        );
      }
    }
  }
}
