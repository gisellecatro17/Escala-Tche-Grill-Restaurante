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

const RULE_INCLUDE = {
  category: { select: { id: true, name: true } },
  accountPlan: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, name: true } },
  resultCenter: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  businessUnit: { select: { id: true, name: true } },
  financialNature: { select: { id: true, name: true, kind: true } },
  allocationRule: { select: { id: true, name: true } },
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
        createdBy: actor.id,
      },
      include: RULE_INCLUDE,
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'ClassificationRule',
      entityId: rule.id,
      newValue: { name: rule.name, matchValue: rule.matchValue },
    });

    return rule;
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
