import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HierarchyEntity, Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from './dto/business-unit.dto';
import { MoveNodeDto, StructureQueryDto } from './dto/common.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import {
  assertNoCycle,
  buildTree,
  collectSubtreeIds,
  computeLevelAndPath,
} from './utils/tree.util';

@Injectable()
export class BusinessUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  private scopeWhere(
    organizationId: string,
    companyId?: string,
    includeInactive = false,
  ): Prisma.BusinessUnitWhereInput {
    return {
      organizationId,
      deletedAt: null,
      ...(includeInactive ? {} : { status: RecordStatus.ACTIVE }),
      ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
    };
  }

  findAll(organizationId: string, query: StructureQueryDto) {
    return this.prisma.businessUnit.findMany({
      where: {
        ...this.scopeWhere(
          organizationId,
          query.companyId,
          query.includeInactive,
        ),
        ...(query.parentId ? { parentBusinessUnitId: query.parentId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findTree(
    organizationId: string,
    companyId?: string,
    includeInactive = false,
  ) {
    const items = await this.prisma.businessUnit.findMany({
      where: this.scopeWhere(organizationId, companyId, includeInactive),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return buildTree(
      items,
      (i) => i.id,
      (i) => i.parentBusinessUnitId,
    );
  }

  async findOne(id: string) {
    const unit = await this.prisma.businessUnit.findFirst({
      where: { id, deletedAt: null },
      include: {
        parentBusinessUnit: { select: { id: true, code: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true },
          orderBy: { name: 'asc' },
        },
        tagLinks: { include: { tag: true } },
      },
    });

    if (!unit)
      throw new NotFoundException('Unidade de negócio não encontrada.');
    return unit;
  }

  async create(dto: CreateBusinessUnitDto, actor: RequestUser) {
    if (dto.parentBusinessUnitId) {
      const parent = await this.prisma.businessUnit.findFirst({
        where: {
          id: dto.parentBusinessUnitId,
          organizationId: dto.organizationId,
          deletedAt: null,
        },
      });
      if (!parent) {
        throw new NotFoundException('Unidade de negócio pai não encontrada.');
      }
    }

    const { level, path } = await this.resolveLevelAndPath(
      dto.parentBusinessUnitId ?? null,
      dto.organizationId,
      dto.name,
    );

    try {
      const unit = await this.prisma.businessUnit.create({
        data: {
          organizationId: dto.organizationId,
          companyId: dto.companyId ?? null,
          parentBusinessUnitId: dto.parentBusinessUnitId ?? null,
          code: dto.code?.trim(),
          name: dto.name.trim(),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder ?? 0,
          responsibleUserId: dto.responsibleUserId,
          notes: dto.notes,
          status: dto.status,
          level,
          path,
          createdBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        userId: actor.id,
        action: 'CREATE',
        entity: 'BusinessUnit',
        entityId: unit.id,
        newValue: { code: unit.code, name: unit.name },
      });

      return unit;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateBusinessUnitDto, actor: RequestUser) {
    const current = await this.findOne(id);

    try {
      const unit = await this.prisma.businessUnit.update({
        where: { id },
        data: {
          code: dto.code?.trim(),
          name: dto.name?.trim(),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder,
          responsibleUserId: dto.responsibleUserId,
          notes: dto.notes,
          status: dto.status,
          updatedBy: actor.id,
        },
      });

      if (dto.name && dto.name.trim() !== current.name) {
        await this.recalculateSubtree(id, current.organizationId);
      }

      await this.audit.log({
        organizationId: current.organizationId,
        companyId: current.companyId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'BusinessUnit',
        entityId: id,
        oldValue: { code: current.code, name: current.name },
        newValue: { code: unit.code, name: unit.name },
      });

      return unit;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async move(id: string, dto: MoveNodeDto, actor: RequestUser) {
    const current = await this.findOne(id);
    const newParentId = dto.parentId ?? null;

    const all = await this.prisma.businessUnit.findMany({
      where: { organizationId: current.organizationId, deletedAt: null },
      select: { id: true, parentBusinessUnitId: true },
    });

    assertNoCycle(
      id,
      newParentId,
      new Map(all.map((i) => [i.id, i.parentBusinessUnitId])),
      'Não é possível mover uma unidade para dentro dela mesma ou de uma unidade filha.',
    );

    await this.versions.snapshot({
      organizationId: current.organizationId,
      companyId: current.companyId,
      entity: HierarchyEntity.BUSINESS_UNIT,
      reason: dto.reason ?? 'Movimentação de unidade de negócio',
      actorId: actor.id,
    });

    const updated = await this.prisma.businessUnit.update({
      where: { id },
      data: {
        parentBusinessUnitId: newParentId,
        sortOrder: dto.sortOrder ?? current.sortOrder,
        updatedBy: actor.id,
      },
    });

    await this.recalculateSubtree(id, current.organizationId);

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'MOVE',
      entity: 'BusinessUnit',
      entityId: id,
      field: 'parentBusinessUnitId',
      oldValue: { parentBusinessUnitId: current.parentBusinessUnitId },
      newValue: { parentBusinessUnitId: newParentId },
      reason: dto.reason,
    });

    return updated;
  }

  async remove(id: string, actor: RequestUser) {
    const unit = await this.findOne(id);

    if (unit.isSystem) {
      throw new ConflictException(
        'Esta é uma unidade padrão do sistema e não pode ser excluída.',
      );
    }

    if (unit.children.length > 0) {
      throw new ConflictException(
        'Esta unidade possui unidades filhas e não pode ser excluída. Exclua ou mova as filhas primeiro.',
      );
    }

    const [categories, projects, rules, allocationLines] = await Promise.all([
      this.prisma.category.count({
        where: { defaultBusinessUnitId: id, deletedAt: null },
      }),
      this.prisma.project.count({
        where: { businessUnitId: id, deletedAt: null },
      }),
      this.prisma.classificationRule.count({
        where: { businessUnitId: id, deletedAt: null },
      }),
      this.prisma.allocationRuleLine.count({ where: { businessUnitId: id } }),
    ]);

    if (categories + projects + rules + allocationLines > 0) {
      throw new ConflictException(
        'Esta unidade de negócio está em uso e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.businessUnit.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: unit.organizationId,
      companyId: unit.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'BusinessUnit',
      entityId: id,
      oldValue: { code: unit.code, name: unit.name },
    });

    return { id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveLevelAndPath(
    parentId: string | null,
    organizationId: string,
    name: string,
  ) {
    const all = await this.prisma.businessUnit.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, parentBusinessUnitId: true },
    });

    return computeLevelAndPath(
      parentId,
      new Map(
        all.map((i) => [
          i.id,
          { name: i.name, parentId: i.parentBusinessUnitId },
        ]),
      ),
      name,
    );
  }

  private async recalculateSubtree(rootId: string, organizationId: string) {
    const all = await this.prisma.businessUnit.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, parentBusinessUnitId: true },
    });

    const nodesById = new Map(
      all.map((i) => [
        i.id,
        { name: i.name, parentId: i.parentBusinessUnitId },
      ]),
    );
    const childrenOf = new Map<string, string[]>();
    for (const item of all) {
      if (!item.parentBusinessUnitId) continue;
      const list = childrenOf.get(item.parentBusinessUnitId) ?? [];
      list.push(item.id);
      childrenOf.set(item.parentBusinessUnitId, list);
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
        return this.prisma.businessUnit.update({
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
        'Já existe uma unidade de negócio com este código nesta organização.',
      );
    }
  }
}
