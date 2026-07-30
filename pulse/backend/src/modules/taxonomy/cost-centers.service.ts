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
  CreateCostCenterDto,
  UpdateCostCenterDto,
} from './dto/create-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  /** Assinatura original preservada para o cadastro rápido de Fornecedores/Clientes. */
  findAll(companyId: string, search?: string, includeInactive = false) {
    return this.prisma.costCenter.findMany({
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
    const items = await this.prisma.costCenter.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { status: RecordStatus.ACTIVE }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return buildTree(
      items,
      (i) => i.id,
      (i) => i.parentCostCenterId,
    );
  }

  async findOne(id: string) {
    const costCenter = await this.prisma.costCenter.findFirst({
      where: { id, deletedAt: null },
      include: {
        parentCostCenter: { select: { id: true, code: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true, status: true },
          orderBy: { name: 'asc' },
        },
        tagLinks: { include: { tag: true } },
      },
    });

    if (!costCenter)
      throw new NotFoundException('Centro de custo não encontrado.');
    return costCenter;
  }

  async create(dto: CreateCostCenterDto, actor?: RequestUser) {
    if (dto.parentCostCenterId) {
      const parent = await this.prisma.costCenter.findFirst({
        where: {
          id: dto.parentCostCenterId,
          companyId: dto.companyId,
          deletedAt: null,
        },
      });
      if (!parent) {
        throw new NotFoundException('Centro de custo pai não encontrado.');
      }
    }

    const { level, path } = await this.resolveLevelAndPath(
      dto.parentCostCenterId ?? null,
      dto.companyId,
      dto.name,
    );

    try {
      const costCenter = await this.prisma.costCenter.create({
        data: {
          companyId: dto.companyId,
          parentCostCenterId: dto.parentCostCenterId,
          name: dto.name.trim(),
          code: dto.code?.trim(),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder ?? 0,
          acceptsEntries: dto.acceptsEntries ?? true,
          responsibleUserId: dto.responsibleUserId,
          notes: dto.notes,
          status: dto.status,
          level,
          path,
          createdBy: actor?.id,
        },
      });

      // Um pai deixa de ser folha: passa a apenas agrupar.
      if (dto.parentCostCenterId) {
        await this.prisma.costCenter.update({
          where: { id: dto.parentCostCenterId },
          data: { acceptsEntries: false },
        });
      }

      await this.audit.log({
        companyId: dto.companyId,
        userId: actor?.id,
        action: 'CREATE',
        entity: 'CostCenter',
        entityId: costCenter.id,
        newValue: { name: costCenter.name, code: costCenter.code },
      });

      return costCenter;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCostCenterDto, actor: RequestUser) {
    const current = await this.findOne(id);

    try {
      const costCenter = await this.prisma.costCenter.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code?.trim(),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder,
          acceptsEntries: dto.acceptsEntries,
          responsibleUserId: dto.responsibleUserId,
          notes: dto.notes,
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
        entity: 'CostCenter',
        entityId: id,
        oldValue: { name: current.name, code: current.code },
        newValue: { name: costCenter.name, code: costCenter.code },
      });

      return costCenter;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async move(id: string, dto: MoveNodeDto, actor: RequestUser) {
    const current = await this.findOne(id);
    const newParentId = dto.parentId ?? null;

    const all = await this.prisma.costCenter.findMany({
      where: { companyId: current.companyId, deletedAt: null },
      select: { id: true, parentCostCenterId: true },
    });

    assertNoCycle(
      id,
      newParentId,
      new Map(all.map((c) => [c.id, c.parentCostCenterId])),
      'Não é possível mover um centro de custo para dentro dele mesmo ou de um centro filho.',
    );

    const company = await this.prisma.company.findUnique({
      where: { id: current.companyId },
      select: { organizationId: true },
    });

    if (company) {
      await this.versions.snapshot({
        organizationId: company.organizationId,
        companyId: current.companyId,
        entity: HierarchyEntity.COST_CENTER,
        reason: dto.reason ?? 'Movimentação de centro de custo',
        actorId: actor.id,
      });
    }

    const updated = await this.prisma.costCenter.update({
      where: { id },
      data: {
        parentCostCenterId: newParentId,
        sortOrder: dto.sortOrder ?? current.sortOrder,
        updatedBy: actor.id,
      },
    });

    await this.recalculateSubtree(id, current.companyId);

    await this.audit.log({
      companyId: current.companyId,
      userId: actor.id,
      action: 'MOVE',
      entity: 'CostCenter',
      entityId: id,
      field: 'parentCostCenterId',
      oldValue: { parentCostCenterId: current.parentCostCenterId },
      newValue: { parentCostCenterId: newParentId },
      reason: dto.reason,
    });

    return updated;
  }

  async duplicate(id: string, dto: DuplicateNodeDto, actor: RequestUser) {
    const source = await this.findOne(id);
    const targetCompanyId = dto.targetCompanyId ?? source.companyId;

    const created = await this.prisma.costCenter.create({
      data: {
        companyId: targetCompanyId,
        parentCostCenterId:
          targetCompanyId === source.companyId
            ? source.parentCostCenterId
            : null,
        name: dto.name?.trim() ?? `${source.name} (cópia)`,
        code:
          dto.code?.trim() ??
          (source.code ? `${source.code}-COPIA` : undefined),
        description: source.description,
        color: source.color,
        icon: source.icon,
        sortOrder: source.sortOrder,
        acceptsEntries: source.acceptsEntries,
        notes: source.notes,
        createdBy: actor.id,
      },
    });

    await this.recalculateSubtree(created.id, targetCompanyId);

    await this.audit.log({
      companyId: targetCompanyId,
      userId: actor.id,
      action: 'DUPLICATE',
      entity: 'CostCenter',
      entityId: created.id,
      oldValue: { sourceId: id },
      newValue: { name: created.name },
    });

    return created;
  }

  async remove(id: string, actor: RequestUser) {
    const costCenter = await this.findOne(id);

    if (costCenter.isSystem) {
      throw new ConflictException(
        'Este é um centro de custo padrão do sistema e não pode ser excluído.',
      );
    }

    if (costCenter.children.length > 0) {
      throw new ConflictException(
        'Este centro de custo possui centros filhos e não pode ser excluído. Exclua ou mova os filhos primeiro.',
      );
    }

    const [supplierLinks, customerLinks, categories, projects, rules, lines] =
      await Promise.all([
        this.prisma.supplierCompanyLink.count({
          where: { defaultCostCenterId: id },
        }),
        this.prisma.customerCompanyLink.count({
          where: { defaultResultCenterId: id },
        }),
        this.prisma.financialCategory.count({
          where: { defaultCostCenterId: id, deletedAt: null },
        }),
        this.prisma.project.count({
          where: { costCenterId: id, deletedAt: null },
        }),
        this.prisma.classificationRule.count({
          where: { costCenterId: id, deletedAt: null },
        }),
        this.prisma.allocationRuleItem.count({ where: { costCenterId: id } }),
      ]);

    if (
      supplierLinks + customerLinks + categories + projects + rules + lines >
      0
    ) {
      throw new ConflictException(
        'Este centro de custo está em uso e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.costCenter.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      companyId: costCenter.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'CostCenter',
      entityId: id,
      oldValue: { name: costCenter.name, code: costCenter.code },
    });

    return { id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveLevelAndPath(
    parentId: string | null,
    companyId: string,
    name: string,
  ) {
    const all = await this.prisma.costCenter.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentCostCenterId: true },
    });

    return computeLevelAndPath(
      parentId,
      new Map(
        all.map((c) => [
          c.id,
          { name: c.name, parentId: c.parentCostCenterId },
        ]),
      ),
      name,
    );
  }

  private async recalculateSubtree(rootId: string, companyId: string) {
    const all = await this.prisma.costCenter.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentCostCenterId: true },
    });

    const nodesById = new Map(
      all.map((c) => [c.id, { name: c.name, parentId: c.parentCostCenterId }]),
    );
    const childrenOf = new Map<string, string[]>();
    for (const item of all) {
      if (!item.parentCostCenterId) continue;
      const list = childrenOf.get(item.parentCostCenterId) ?? [];
      list.push(item.id);
      childrenOf.set(item.parentCostCenterId, list);
    }

    const affected = collectSubtreeIds(rootId, childrenOf);

    await this.prisma.$transaction(
      affected.map((itemId) => {
        const node = nodesById.get(itemId);
        const { level, path } = computeLevelAndPath(
          node?.parentId ?? null,
          nodesById,
          node?.name ?? '',
        );
        return this.prisma.costCenter.update({
          where: { id: itemId },
          data: { level, path },
        });
      }),
    );
  }

  private rethrowDuplicateCode(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Já existe um centro de custo com este código nesta empresa.',
      );
    }
  }
}
