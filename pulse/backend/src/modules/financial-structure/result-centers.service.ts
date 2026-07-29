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
  CreateResultCenterDto,
  UpdateResultCenterDto,
} from './dto/result-center.dto';
import {
  DuplicateNodeDto,
  MoveNodeDto,
  StructureQueryDto,
} from './dto/common.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import {
  assertNoCycle,
  buildTree,
  collectSubtreeIds,
  computeLevelAndPath,
} from './utils/tree.util';

@Injectable()
export class ResultCentersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  findAll(companyId: string, query: StructureQueryDto) {
    return this.prisma.resultCenter.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.includeInactive ? {} : { status: RecordStatus.ACTIVE }),
        ...(query.parentId ? { parentResultCenterId: query.parentId } : {}),
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

  async findTree(companyId: string, includeInactive = false) {
    const items = await this.prisma.resultCenter.findMany({
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
      (i) => i.parentResultCenterId,
    );
  }

  async findOne(id: string) {
    const center = await this.prisma.resultCenter.findFirst({
      where: { id, deletedAt: null },
      include: {
        parentResultCenter: { select: { id: true, code: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true },
          orderBy: { name: 'asc' },
        },
        tagLinks: { include: { tag: true } },
      },
    });

    if (!center)
      throw new NotFoundException('Centro de resultado não encontrado.');
    return center;
  }

  async create(dto: CreateResultCenterDto, actor: RequestUser) {
    await this.assertParentExists(dto.parentResultCenterId, dto.companyId);
    const { level, path } = await this.resolveLevelAndPath(
      dto.parentResultCenterId ?? null,
      dto.companyId,
      dto.name,
    );

    try {
      const center = await this.prisma.resultCenter.create({
        data: {
          companyId: dto.companyId,
          parentResultCenterId: dto.parentResultCenterId ?? null,
          code: dto.code?.trim(),
          name: dto.name.trim(),
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
          createdBy: actor.id,
        },
      });

      // Um pai deixa de ser folha e passa a apenas agrupar.
      if (dto.parentResultCenterId) {
        await this.prisma.resultCenter.update({
          where: { id: dto.parentResultCenterId },
          data: { acceptsEntries: false },
        });
      }

      await this.audit.log({
        companyId: dto.companyId,
        userId: actor.id,
        action: 'CREATE',
        entity: 'ResultCenter',
        entityId: center.id,
        newValue: { code: center.code, name: center.name },
      });

      return center;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateResultCenterDto, actor: RequestUser) {
    const current = await this.findOne(id);

    try {
      const center = await this.prisma.resultCenter.update({
        where: { id },
        data: {
          code: dto.code?.trim(),
          name: dto.name?.trim(),
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
        entity: 'ResultCenter',
        entityId: id,
        oldValue: { code: current.code, name: current.name },
        newValue: { code: center.code, name: center.name },
      });

      return center;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async move(id: string, dto: MoveNodeDto, actor: RequestUser) {
    const current = await this.findOne(id);
    const newParentId = dto.parentId ?? null;

    const all = await this.prisma.resultCenter.findMany({
      where: { companyId: current.companyId, deletedAt: null },
      select: { id: true, parentResultCenterId: true },
    });

    assertNoCycle(
      id,
      newParentId,
      new Map(all.map((i) => [i.id, i.parentResultCenterId])),
      'Não é possível mover um centro de resultado para dentro dele mesmo ou de um centro filho.',
    );

    const company = await this.prisma.company.findUnique({
      where: { id: current.companyId },
      select: { organizationId: true },
    });

    if (company) {
      await this.versions.snapshot({
        organizationId: company.organizationId,
        companyId: current.companyId,
        entity: HierarchyEntity.RESULT_CENTER,
        reason: dto.reason ?? 'Movimentação de centro de resultado',
        actorId: actor.id,
      });
    }

    const updated = await this.prisma.resultCenter.update({
      where: { id },
      data: {
        parentResultCenterId: newParentId,
        sortOrder: dto.sortOrder ?? current.sortOrder,
        updatedBy: actor.id,
      },
    });

    await this.recalculateSubtree(id, current.companyId);

    await this.audit.log({
      companyId: current.companyId,
      userId: actor.id,
      action: 'MOVE',
      entity: 'ResultCenter',
      entityId: id,
      field: 'parentResultCenterId',
      oldValue: { parentResultCenterId: current.parentResultCenterId },
      newValue: { parentResultCenterId: newParentId },
      reason: dto.reason,
    });

    return updated;
  }

  async duplicate(id: string, dto: DuplicateNodeDto, actor: RequestUser) {
    const source = await this.findOne(id);
    const targetCompanyId = dto.targetCompanyId ?? source.companyId;

    const created = await this.prisma.resultCenter.create({
      data: {
        companyId: targetCompanyId,
        // Em outra empresa a árvore de destino é diferente: o item nasce na raiz.
        parentResultCenterId:
          targetCompanyId === source.companyId
            ? source.parentResultCenterId
            : null,
        code:
          dto.code?.trim() ??
          (source.code ? `${source.code}-COPIA` : undefined),
        name: dto.name?.trim() ?? `${source.name} (cópia)`,
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
      entity: 'ResultCenter',
      entityId: created.id,
      oldValue: { sourceId: id },
      newValue: { name: created.name },
    });

    return created;
  }

  async remove(id: string, actor: RequestUser) {
    const center = await this.findOne(id);

    if (center.isSystem) {
      throw new ConflictException(
        'Este é um centro de resultado padrão do sistema e não pode ser excluído.',
      );
    }

    if (center.children.length > 0) {
      throw new ConflictException(
        'Este centro de resultado possui centros filhos e não pode ser excluído. Exclua ou mova os filhos primeiro.',
      );
    }

    const [categories, projects, rules, allocationLines] = await Promise.all([
      this.prisma.category.count({
        where: { defaultResultCenterId: id, deletedAt: null },
      }),
      this.prisma.project.count({
        where: { resultCenterId: id, deletedAt: null },
      }),
      this.prisma.classificationRule.count({
        where: { resultCenterId: id, deletedAt: null },
      }),
      this.prisma.allocationRuleLine.count({ where: { resultCenterId: id } }),
    ]);

    if (categories + projects + rules + allocationLines > 0) {
      throw new ConflictException(
        'Este centro de resultado está em uso e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.resultCenter.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      companyId: center.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'ResultCenter',
      entityId: id,
      oldValue: { code: center.code, name: center.name },
    });

    return { id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertParentExists(
    parentId: string | undefined,
    companyId: string,
  ) {
    if (!parentId) return;

    const parent = await this.prisma.resultCenter.findFirst({
      where: { id: parentId, companyId, deletedAt: null },
    });

    if (!parent) {
      throw new NotFoundException('Centro de resultado pai não encontrado.');
    }
  }

  private async resolveLevelAndPath(
    parentId: string | null,
    companyId: string,
    name: string,
  ) {
    const all = await this.prisma.resultCenter.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentResultCenterId: true },
    });

    return computeLevelAndPath(
      parentId,
      new Map(
        all.map((i) => [
          i.id,
          { name: i.name, parentId: i.parentResultCenterId },
        ]),
      ),
      name,
    );
  }

  private async recalculateSubtree(rootId: string, companyId: string) {
    const all = await this.prisma.resultCenter.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, parentResultCenterId: true },
    });

    const nodesById = new Map(
      all.map((i) => [
        i.id,
        { name: i.name, parentId: i.parentResultCenterId },
      ]),
    );
    const childrenOf = new Map<string, string[]>();
    for (const item of all) {
      if (!item.parentResultCenterId) continue;
      const list = childrenOf.get(item.parentResultCenterId) ?? [];
      list.push(item.id);
      childrenOf.set(item.parentResultCenterId, list);
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
        return this.prisma.resultCenter.update({
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
        'Já existe um centro de resultado com este código nesta empresa.',
      );
    }
  }
}
