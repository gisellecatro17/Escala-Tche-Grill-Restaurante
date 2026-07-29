import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AllocationCriterion,
  AllocationTargetType,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  AllocationRuleLineDto,
  CreateAllocationRuleDto,
  UpdateAllocationRuleDto,
} from './dto/allocation-rule.dto';
import { StructureQueryDto } from './dto/common.dto';

/** Coluna de destino obrigatória para cada tipo de linha de rateio. */
const TARGET_FIELD: Record<AllocationTargetType, keyof AllocationRuleLineDto> =
  {
    COST_CENTER: 'costCenterId',
    RESULT_CENTER: 'resultCenterId',
    PROJECT: 'projectId',
    BUSINESS_UNIT: 'businessUnitId',
    CATEGORY: 'categoryId',
    ACCOUNT_PLAN: 'accountPlanId',
  };

const TARGET_LABEL: Record<AllocationTargetType, string> = {
  COST_CENTER: 'centro de custo',
  RESULT_CENTER: 'centro de resultado',
  PROJECT: 'projeto',
  BUSINESS_UNIT: 'unidade de negócio',
  CATEGORY: 'categoria',
  ACCOUNT_PLAN: 'conta do plano de contas',
};

/** Tolerância para erros de arredondamento ao somar percentuais. */
const PERCENTAGE_TOLERANCE = 0.01;

const RULE_INCLUDE = {
  lines: {
    orderBy: { sortOrder: 'asc' },
    include: {
      costCenter: { select: { id: true, name: true } },
      resultCenter: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      businessUnit: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      accountPlan: { select: { id: true, code: true, name: true } },
    },
  },
  category: { select: { id: true, name: true } },
} satisfies Prisma.AllocationRuleInclude;

@Injectable()
export class AllocationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(companyId: string, query: StructureQueryDto) {
    return this.prisma.allocationRule.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.includeInactive ? {} : { status: RecordStatus.ACTIVE }),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: RULE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.allocationRule.findFirst({
      where: { id, deletedAt: null },
      include: RULE_INCLUDE,
    });
    if (!rule) throw new NotFoundException('Rateio não encontrado.');
    return rule;
  }

  async create(dto: CreateAllocationRuleDto, actor: RequestUser) {
    const criterion = dto.criterion ?? AllocationCriterion.PERCENTAGE;
    this.assertLinesAreValid(dto.lines, criterion);

    const rule = await this.prisma.allocationRule.create({
      data: {
        companyId: dto.companyId,
        name: dto.name.trim(),
        description: dto.description,
        criterion,
        categoryId: dto.categoryId,
        customCriterionLabel: dto.customCriterionLabel,
        isDefault: dto.isDefault ?? false,
        status: dto.status,
        createdBy: actor.id,
        lines: {
          create: dto.lines.map((line, index) => this.mapLine(line, index)),
        },
      },
      include: RULE_INCLUDE,
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'AllocationRule',
      entityId: rule.id,
      newValue: { name: rule.name, criterion, lines: dto.lines.length },
    });

    return rule;
  }

  async update(id: string, dto: UpdateAllocationRuleDto, actor: RequestUser) {
    const current = await this.findOne(id);
    const criterion = dto.criterion ?? current.criterion;

    if (dto.lines) {
      this.assertLinesAreValid(dto.lines, criterion);
    }

    const rule = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        // Substituição integral: o rateio precisa fechar 100% como um todo.
        await tx.allocationRuleLine.deleteMany({
          where: { allocationRuleId: id },
        });
        await tx.allocationRuleLine.createMany({
          data: dto.lines.map((line, index) => ({
            allocationRuleId: id,
            ...this.mapLine(line, index),
          })),
        });
      }

      return tx.allocationRule.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          criterion: dto.criterion,
          categoryId: dto.categoryId,
          customCriterionLabel: dto.customCriterionLabel,
          isDefault: dto.isDefault,
          status: dto.status,
          updatedBy: actor.id,
        },
        include: RULE_INCLUDE,
      });
    });

    await this.audit.log({
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'AllocationRule',
      entityId: id,
      oldValue: { name: current.name, lines: current.lines.length },
      newValue: { name: rule.name, lines: rule.lines.length },
    });

    return rule;
  }

  async remove(id: string, actor: RequestUser) {
    const rule = await this.findOne(id);

    const [categories, classificationRules] = await Promise.all([
      this.prisma.category.count({
        where: { defaultAllocationRuleId: id, deletedAt: null },
      }),
      this.prisma.classificationRule.count({
        where: { allocationRuleId: id, deletedAt: null },
      }),
    ]);

    if (categories + classificationRules > 0) {
      throw new ConflictException(
        'Este rateio está em uso por categorias ou regras de classificação e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.allocationRule.update({
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
      entity: 'AllocationRule',
      entityId: id,
      oldValue: { name: rule.name },
    });

    return { id };
  }

  // ── Validação ──────────────────────────────────────────────────────────────

  /**
   * Garante que cada linha aponte para o destino do seu tipo, que os valores exigidos
   * pelo critério estejam preenchidos e que rateios percentuais fechem exatamente 100%.
   */
  private assertLinesAreValid(
    lines: AllocationRuleLineDto[],
    criterion: AllocationCriterion,
  ): void {
    if (lines.length === 0) {
      throw new BadRequestException('Informe ao menos uma linha de rateio.');
    }

    for (const [index, line] of lines.entries()) {
      const field = TARGET_FIELD[line.targetType];
      if (!line[field]) {
        throw new BadRequestException(
          `Informe o(a) ${TARGET_LABEL[line.targetType]} da linha ${index + 1} do rateio.`,
        );
      }

      if (
        criterion === AllocationCriterion.PERCENTAGE &&
        line.percentage == null
      ) {
        throw new BadRequestException(
          `Informe o percentual da linha ${index + 1} do rateio.`,
        );
      }

      if (
        criterion === AllocationCriterion.FIXED_AMOUNT &&
        line.fixedAmount == null
      ) {
        throw new BadRequestException(
          `Informe o valor da linha ${index + 1} do rateio.`,
        );
      }

      const usesWeight = (
        [
          AllocationCriterion.QUANTITY,
          AllocationCriterion.HOURS,
          AllocationCriterion.WEIGHT,
          AllocationCriterion.CUSTOM,
        ] as AllocationCriterion[]
      ).includes(criterion);

      if (usesWeight && line.weight == null) {
        throw new BadRequestException(
          `Informe a quantidade/peso da linha ${index + 1} do rateio.`,
        );
      }
    }

    if (criterion === AllocationCriterion.PERCENTAGE) {
      const total = lines.reduce(
        (sum, line) => sum + (line.percentage ?? 0),
        0,
      );
      if (Math.abs(total - 100) > PERCENTAGE_TOLERANCE) {
        throw new BadRequestException(
          `A soma dos percentuais do rateio deve ser exatamente 100%. Total informado: ${total.toFixed(2)}%.`,
        );
      }
    }

    // Um mesmo destino não pode aparecer duas vezes na mesma regra.
    const seen = new Set<string>();
    for (const line of lines) {
      const key = `${line.targetType}:${String(line[TARGET_FIELD[line.targetType]])}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          'O mesmo destino foi informado mais de uma vez no rateio.',
        );
      }
      seen.add(key);
    }
  }

  private mapLine(line: AllocationRuleLineDto, index: number) {
    return {
      targetType: line.targetType,
      costCenterId: line.costCenterId,
      resultCenterId: line.resultCenterId,
      projectId: line.projectId,
      businessUnitId: line.businessUnitId,
      categoryId: line.categoryId,
      accountPlanId: line.accountPlanId,
      percentage: line.percentage,
      fixedAmount: line.fixedAmount,
      weight: line.weight,
      sortOrder: line.sortOrder ?? index,
      notes: line.notes,
    };
  }
}
