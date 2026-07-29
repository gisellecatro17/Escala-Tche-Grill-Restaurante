import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HierarchyEntity, Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { HierarchyVersionsService } from '../financial-structure/hierarchy-versions.service';
import {
  DuplicateNodeDto,
  MoveNodeDto,
} from '../financial-structure/dto/common.dto';
import {
  assertNoCycle,
  buildTree,
  collectSubtreeIds,
  computeLevelAndPath,
} from '../financial-structure/utils/tree.util';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';

const CATEGORY_INCLUDE = {
  accountPlan: { select: { id: true, code: true, name: true } },
  financialNature: { select: { id: true, name: true, kind: true } },
  defaultCostCenter: { select: { id: true, name: true } },
  defaultResultCenter: { select: { id: true, name: true } },
  defaultProject: { select: { id: true, name: true } },
  defaultBusinessUnit: { select: { id: true, name: true } },
  defaultAllocationRule: { select: { id: true, name: true } },
  tagLinks: { include: { tag: true } },
} satisfies Prisma.CategoryInclude;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  /**
   * Listagem simples usada pelo cadastro rápido de Fornecedores/Clientes.
   * A assinatura original (`companyId`, `search`) é preservada.
   */
  findAll(companyId: string, search?: string, includeInactive = false) {
    return this.prisma.category.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { status: RecordStatus.ACTIVE }),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findTree(companyId: string, includeInactive = false) {
    const categories = await this.prisma.category.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { status: RecordStatus.ACTIVE }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return buildTree(
      categories,
      (c) => c.id,
      (c) => c.parentCategoryId,
    );
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...CATEGORY_INCLUDE,
        parentCategory: { select: { id: true, name: true, code: true } },
        subcategories: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true, status: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) throw new NotFoundException('Categoria não encontrada.');
    return category;
  }

  async create(dto: CreateCategoryDto, actor?: RequestUser) {
    if (dto.parentCategoryId) {
      const parent = await this.prisma.category.findFirst({
        where: {
          id: dto.parentCategoryId,
          companyId: dto.companyId,
          deletedAt: null,
        },
      });
      if (!parent) {
        throw new NotFoundException('Categoria de origem não encontrada.');
      }
    }

    const { level, path } = await this.resolveLevelAndPath(
      dto.parentCategoryId ?? null,
      dto.companyId,
      dto.name,
    );

    try {
      const category = await this.prisma.category.create({
        data: {
          companyId: dto.companyId,
          parentCategoryId: dto.parentCategoryId,
          name: dto.name.trim(),
          code: dto.code?.trim(),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder ?? 0,
          notes: dto.notes,
          accountPlanId: dto.accountPlanId,
          financialNatureId: dto.financialNatureId,
          defaultCostCenterId: dto.defaultCostCenterId,
          defaultResultCenterId: dto.defaultResultCenterId,
          defaultProjectId: dto.defaultProjectId,
          defaultBusinessUnitId: dto.defaultBusinessUnitId,
          defaultSupplierId: dto.defaultSupplierId,
          defaultCustomerId: dto.defaultCustomerId,
          defaultBankAccountId: dto.defaultBankAccountId,
          defaultPaymentMethod: dto.defaultPaymentMethod,
          managementAccount: dto.managementAccount,
          defaultDescription: dto.defaultDescription,
          defaultHistory: dto.defaultHistory,
          defaultAllocationRuleId: dto.defaultAllocationRuleId,
          autoClassificationEnabled: dto.autoClassificationEnabled ?? true,
          status: dto.status,
          level,
          path,
          createdBy: actor?.id,
        },
      });

      await this.audit.log({
        companyId: dto.companyId,
        userId: actor?.id,
        action: 'CREATE',
        entity: 'Category',
        entityId: category.id,
        newValue: { name: category.name, code: category.code },
      });

      return category;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto, actor: RequestUser) {
    const current = await this.findOne(id);

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code?.trim(),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder,
          notes: dto.notes,
          accountPlanId: dto.accountPlanId,
          financialNatureId: dto.financialNatureId,
          defaultCostCenterId: dto.defaultCostCenterId,
          defaultResultCenterId: dto.defaultResultCenterId,
          defaultProjectId: dto.defaultProjectId,
          defaultBusinessUnitId: dto.defaultBusinessUnitId,
          defaultSupplierId: dto.defaultSupplierId,
          defaultCustomerId: dto.defaultCustomerId,
          defaultBankAccountId: dto.defaultBankAccountId,
          defaultPaymentMethod: dto.defaultPaymentMethod,
          managementAccount: dto.managementAccount,
          defaultDescription: dto.defaultDescription,
          defaultHistory: dto.defaultHistory,
          defaultAllocationRuleId: dto.defaultAllocationRuleId,
          autoClassificationEnabled: dto.autoClassificationEnabled,
          status: dto.status,
          updatedBy: actor.id,
        },
      });

      if (dto.name && dto.name.trim() !== current.name) {
        await this.recalculateSubtree(id, current.companyId);
      }

      await this.audit.log({
        companyId: current.companyId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'Category',
        entityId: id,
        oldValue: { name: current.name, code: current.code },
        newValue: { name: category.name, code: category.code },
      });

      return category;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async move(id: string, dto: MoveNodeDto, actor: RequestUser) {
    const current = await this.findOne(id);
    const newParentId = dto.parentId ?? null;

    const all = await this.prisma.category.findMany({
      where: { companyId: current.companyId, deletedAt: null },
      select: { id: true, parentCategoryId: true },
    });

    assertNoCycle(
      id,
      newParentId,
      new Map(all.map((c) => [c.id, c.parentCategoryId])),
      'Não é possível mover uma categoria para dentro dela mesma ou de uma subcategoria.',
    );

    const company = await this.prisma.company.findUnique({
      where: { id: current.companyId },
      select: { organizationId: true },
    });

    if (company) {
      await this.versions.snapshot({
        organizationId: company.organizationId,
        companyId: current.companyId,
        entity: HierarchyEntity.CATEGORY,
        reason: dto.reason ?? 'Movimentação de categoria na árvore',
        actorId: actor.id,
      });
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        parentCategoryId: newParentId,
        sortOrder: dto.sortOrder ?? current.sortOrder,
        updatedBy: actor.id,
      },
    });

    await this.recalculateSubtree(id, current.companyId);

    await this.audit.log({
      companyId: current.companyId,
      userId: actor.id,
      action: 'MOVE',
      entity: 'Category',
      entityId: id,
      field: 'parentCategoryId',
      oldValue: { parentCategoryId: current.parentCategoryId },
      newValue: { parentCategoryId: newParentId },
      reason: dto.reason,
    });

    return updated;
  }

  async duplicate(id: string, dto: DuplicateNodeDto, actor: RequestUser) {
    const source = await this.findOne(id);
    const targetCompanyId = dto.targetCompanyId ?? source.companyId;
    const sameCompany = targetCompanyId === source.companyId;

    const created = await this.prisma.category.create({
      data: {
        companyId: targetCompanyId,
        // Fora da empresa de origem a árvore e as dimensões são outras.
        parentCategoryId: sameCompany ? source.parentCategoryId : null,
        name: dto.name?.trim() ?? `${source.name} (cópia)`,
        code:
          dto.code?.trim() ??
          (source.code ? `${source.code}-COPIA` : undefined),
        description: source.description,
        color: source.color,
        icon: source.icon,
        sortOrder: source.sortOrder,
        notes: source.notes,
        accountPlanId: source.accountPlanId,
        financialNatureId: source.financialNatureId,
        defaultCostCenterId: sameCompany ? source.defaultCostCenterId : null,
        defaultResultCenterId: sameCompany
          ? source.defaultResultCenterId
          : null,
        defaultProjectId: sameCompany ? source.defaultProjectId : null,
        defaultBusinessUnitId: sameCompany
          ? source.defaultBusinessUnitId
          : null,
        defaultAllocationRuleId: sameCompany
          ? source.defaultAllocationRuleId
          : null,
        defaultPaymentMethod: source.defaultPaymentMethod,
        managementAccount: source.managementAccount,
        defaultDescription: source.defaultDescription,
        defaultHistory: source.defaultHistory,
        autoClassificationEnabled: source.autoClassificationEnabled,
        createdBy: actor.id,
      },
    });

    if (dto.includeChildren) {
      await this.duplicateChildren(id, created.id, targetCompanyId, actor);
    }

    await this.recalculateSubtree(created.id, targetCompanyId);

    await this.audit.log({
      companyId: targetCompanyId,
      userId: actor.id,
      action: 'DUPLICATE',
      entity: 'Category',
      entityId: created.id,
      oldValue: { sourceId: id },
      newValue: {
        name: created.name,
        includeChildren: Boolean(dto.includeChildren),
      },
    });

    return created;
  }

  async remove(id: string, actor: RequestUser) {
    const category = await this.findOne(id);

    if (category.isSystem) {
      throw new ConflictException(
        'Esta é uma categoria padrão do sistema e não pode ser excluída.',
      );
    }

    if (category.subcategories.length > 0) {
      throw new ConflictException(
        'Esta categoria possui subcategorias e não pode ser excluída. Exclua ou mova as subcategorias primeiro.',
      );
    }

    const [
      supplierLinks,
      supplierSubLinks,
      customerLinks,
      customerSubLinks,
      rules,
    ] = await Promise.all([
      this.prisma.supplierCompanyLink.count({
        where: { defaultCategoryId: id },
      }),
      this.prisma.supplierCompanyLink.count({
        where: { defaultSubcategoryId: id },
      }),
      this.prisma.customerCompanyLink.count({
        where: { defaultRevenueCategoryId: id },
      }),
      this.prisma.customerCompanyLink.count({
        where: { defaultSubcategoryId: id },
      }),
      this.prisma.classificationRule.count({
        where: { categoryId: id, deletedAt: null },
      }),
    ]);

    if (
      supplierLinks +
        supplierSubLinks +
        customerLinks +
        customerSubLinks +
        rules >
      0
    ) {
      throw new ConflictException(
        'Esta categoria está em uso por fornecedores, clientes ou regras de classificação e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      companyId: category.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'Category',
      entityId: id,
      oldValue: { name: category.name, code: category.code },
    });

    return { id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveLevelAndPath(
    parentId: string | null,
    companyId: string,
    name: string,
  ) {
    const all = await this.prisma.category.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentCategoryId: true },
    });

    return computeLevelAndPath(
      parentId,
      new Map(
        all.map((c) => [c.id, { name: c.name, parentId: c.parentCategoryId }]),
      ),
      name,
    );
  }

  private async recalculateSubtree(rootId: string, companyId: string) {
    const all = await this.prisma.category.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentCategoryId: true },
    });

    const nodesById = new Map(
      all.map((c) => [c.id, { name: c.name, parentId: c.parentCategoryId }]),
    );
    const childrenOf = new Map<string, string[]>();
    for (const category of all) {
      if (!category.parentCategoryId) continue;
      const list = childrenOf.get(category.parentCategoryId) ?? [];
      list.push(category.id);
      childrenOf.set(category.parentCategoryId, list);
    }

    const affected = collectSubtreeIds(rootId, childrenOf);

    await this.prisma.$transaction(
      affected.map((categoryId) => {
        const node = nodesById.get(categoryId);
        const { level, path } = computeLevelAndPath(
          node?.parentId ?? null,
          nodesById,
          node?.name ?? '',
        );
        return this.prisma.category.update({
          where: { id: categoryId },
          data: { level, path },
        });
      }),
    );
  }

  private async duplicateChildren(
    sourceParentId: string,
    targetParentId: string,
    targetCompanyId: string,
    actor: RequestUser,
  ) {
    const children = await this.prisma.category.findMany({
      where: { parentCategoryId: sourceParentId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    for (const child of children) {
      const created = await this.prisma.category.create({
        data: {
          companyId: targetCompanyId,
          parentCategoryId: targetParentId,
          name: child.name,
          code: child.code ? `${child.code}-COPIA` : undefined,
          description: child.description,
          color: child.color,
          icon: child.icon,
          sortOrder: child.sortOrder,
          notes: child.notes,
          accountPlanId: child.accountPlanId,
          financialNatureId: child.financialNatureId,
          autoClassificationEnabled: child.autoClassificationEnabled,
          createdBy: actor.id,
        },
      });

      await this.duplicateChildren(
        child.id,
        created.id,
        targetCompanyId,
        actor,
      );
    }
  }

  private rethrowDuplicateCode(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Já existe uma categoria com este código nesta empresa.',
      );
    }
  }
}
