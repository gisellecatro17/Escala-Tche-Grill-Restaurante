import { Injectable, NotFoundException } from '@nestjs/common';
import { HierarchyEntity, Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  PaginationQueryDto,
  paginate,
} from '../../common/dto/pagination-query.dto';
import { AuditService } from '../audit/audit.service';

export interface SnapshotParams {
  organizationId: string;
  companyId?: string | null;
  entity: HierarchyEntity;
  label?: string;
  reason?: string;
  actorId?: string | null;
}

/**
 * Versionamento das árvores da estrutura financeira. Um snapshot é gravado antes de
 * qualquer alteração estrutural (mover, importar, restaurar), permitindo auditar e
 * restaurar a organização anterior dos cadastros.
 */
@Injectable()
export class HierarchyVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    organizationId: string,
    entity: HierarchyEntity | undefined,
    companyId: string | undefined,
    query: PaginationQueryDto,
  ) {
    const where: Prisma.FinancialHierarchyVersionWhereInput = {
      organizationId,
      ...(entity ? { entity } : {}),
      ...(companyId ? { companyId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financialHierarchyVersion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        select: {
          id: true,
          entity: true,
          versionNumber: true,
          label: true,
          reason: true,
          itemCount: true,
          createdAt: true,
          createdBy: true,
        },
      }),
      this.prisma.financialHierarchyVersion.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const version = await this.prisma.financialHierarchyVersion.findUnique({
      where: { id },
    });
    if (!version) throw new NotFoundException('Versão não encontrada.');
    return version;
  }

  /** Grava um snapshot da estrutura atual da entidade informada. */
  async snapshot(params: SnapshotParams) {
    const items = await this.loadEntitySnapshot(
      params.entity,
      params.organizationId,
      params.companyId ?? undefined,
    );

    const last = await this.prisma.financialHierarchyVersion.findFirst({
      where: {
        organizationId: params.organizationId,
        companyId: params.companyId ?? null,
        entity: params.entity,
      },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    return this.prisma.financialHierarchyVersion.create({
      data: {
        organizationId: params.organizationId,
        companyId: params.companyId ?? null,
        entity: params.entity,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        label: params.label,
        reason: params.reason,
        snapshot: items as unknown as Prisma.InputJsonValue,
        itemCount: items.length,
        createdBy: params.actorId ?? null,
      },
    });
  }

  /**
   * Restaura a hierarquia (pai, ordem, nível e caminho) gravada em uma versão.
   * Registros criados depois do snapshot são preservados — nada é excluído.
   */
  async restore(id: string, reason: string, actor: RequestUser) {
    const version = await this.findOne(id);
    const snapshot = version.snapshot as unknown as SnapshotItem[];

    // Guarda o estado atual antes de sobrescrevê-lo, para permitir desfazer.
    await this.snapshot({
      organizationId: version.organizationId,
      companyId: version.companyId,
      entity: version.entity,
      label: `Antes da restauração da versão ${version.versionNumber}`,
      reason,
      actorId: actor.id,
    });

    const restored = await this.applySnapshot(version.entity, snapshot);

    await this.audit.log({
      organizationId: version.organizationId,
      companyId: version.companyId,
      userId: actor.id,
      action: 'RESTORE_VERSION',
      entity: 'FinancialHierarchyVersion',
      entityId: id,
      newValue: {
        entity: version.entity,
        versionNumber: version.versionNumber,
        restored,
      },
      reason,
    });

    return { id, restored };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async loadEntitySnapshot(
    entity: HierarchyEntity,
    organizationId: string,
    companyId?: string,
  ): Promise<SnapshotItem[]> {
    switch (entity) {
      case HierarchyEntity.ACCOUNT_PLAN: {
        const rows = await this.prisma.financialAccountPlan.findMany({
          where: {
            organizationId,
            deletedAt: null,
            ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
          },
          select: {
            id: true,
            code: true,
            name: true,
            parentAccountId: true,
            sortOrder: true,
            level: true,
            path: true,
          },
        });
        return rows.map((r) => ({ ...r, parentId: r.parentAccountId }));
      }
      case HierarchyEntity.CATEGORY: {
        const rows = await this.prisma.category.findMany({
          where: { deletedAt: null, ...(companyId ? { companyId } : {}) },
          select: {
            id: true,
            code: true,
            name: true,
            parentCategoryId: true,
            sortOrder: true,
            level: true,
            path: true,
          },
        });
        return rows.map((r) => ({ ...r, parentId: r.parentCategoryId }));
      }
      case HierarchyEntity.COST_CENTER: {
        const rows = await this.prisma.costCenter.findMany({
          where: { deletedAt: null, ...(companyId ? { companyId } : {}) },
          select: {
            id: true,
            code: true,
            name: true,
            parentCostCenterId: true,
            sortOrder: true,
            level: true,
            path: true,
          },
        });
        return rows.map((r) => ({ ...r, parentId: r.parentCostCenterId }));
      }
      case HierarchyEntity.RESULT_CENTER: {
        const rows = await this.prisma.resultCenter.findMany({
          where: { deletedAt: null, ...(companyId ? { companyId } : {}) },
          select: {
            id: true,
            code: true,
            name: true,
            parentResultCenterId: true,
            sortOrder: true,
            level: true,
            path: true,
          },
        });
        return rows.map((r) => ({ ...r, parentId: r.parentResultCenterId }));
      }
      case HierarchyEntity.BUSINESS_UNIT: {
        const rows = await this.prisma.businessUnit.findMany({
          where: {
            organizationId,
            deletedAt: null,
            ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
          },
          select: {
            id: true,
            code: true,
            name: true,
            parentBusinessUnitId: true,
            sortOrder: true,
            level: true,
            path: true,
          },
        });
        return rows.map((r) => ({ ...r, parentId: r.parentBusinessUnitId }));
      }
      case HierarchyEntity.PROJECT: {
        const rows = await this.prisma.project.findMany({
          where: {
            deletedAt: null,
            recordStatus: RecordStatus.ACTIVE,
            ...(companyId ? { companyId } : {}),
          },
          select: { id: true, code: true, name: true },
        });
        return rows.map((r) => ({
          ...r,
          parentId: null,
          sortOrder: 0,
          level: 0,
          path: r.name,
        }));
      }
    }
  }

  /** Reaplica pai/ordem/nível/caminho de cada item do snapshot que ainda existe. */
  private async applySnapshot(
    entity: HierarchyEntity,
    snapshot: SnapshotItem[],
  ): Promise<number> {
    if (entity === HierarchyEntity.PROJECT) {
      // Projetos não formam árvore — não há hierarquia a restaurar.
      return 0;
    }

    let restored = 0;

    for (const item of snapshot) {
      const data = {
        sortOrder: item.sortOrder ?? 0,
        level: item.level ?? 0,
        path: item.path ?? item.name,
      };

      try {
        switch (entity) {
          case HierarchyEntity.ACCOUNT_PLAN:
            await this.prisma.financialAccountPlan.update({
              where: { id: item.id },
              data: { ...data, parentAccountId: item.parentId },
            });
            break;
          case HierarchyEntity.CATEGORY:
            await this.prisma.category.update({
              where: { id: item.id },
              data: { ...data, parentCategoryId: item.parentId },
            });
            break;
          case HierarchyEntity.COST_CENTER:
            await this.prisma.costCenter.update({
              where: { id: item.id },
              data: { ...data, parentCostCenterId: item.parentId },
            });
            break;
          case HierarchyEntity.RESULT_CENTER:
            await this.prisma.resultCenter.update({
              where: { id: item.id },
              data: { ...data, parentResultCenterId: item.parentId },
            });
            break;
          case HierarchyEntity.BUSINESS_UNIT:
            await this.prisma.businessUnit.update({
              where: { id: item.id },
              data: { ...data, parentBusinessUnitId: item.parentId },
            });
            break;
        }
        restored += 1;
      } catch (error) {
        // Item excluído após o snapshot: ignora e segue restaurando os demais.
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        )) {
          throw error;
        }
      }
    }

    return restored;
  }
}

interface SnapshotItem {
  id: string;
  code: string | null;
  name: string;
  parentId: string | null;
  sortOrder?: number;
  level?: number;
  path?: string | null;
}
