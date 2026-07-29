import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  CreateFinancialTagDto,
  UpdateFinancialTagDto,
} from './dto/financial-tag.dto';
import { StructureQueryDto, TagLinkDto } from './dto/common.dto';

/** Entidades que aceitam tags e a coluna correspondente em `financial_tag_links`. */
const TAGGABLE_ENTITIES = {
  Category: 'categoryId',
  FinancialAccountPlan: 'accountPlanId',
  CostCenter: 'costCenterId',
  ResultCenter: 'resultCenterId',
  Project: 'projectId',
  BusinessUnit: 'businessUnitId',
} as const;

type TaggableEntity = keyof typeof TAGGABLE_ENTITIES;

@Injectable()
export class FinancialTagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Normaliza o nome para comparação/unicidade (minúsculo, espaços colapsados). */
  private toSlug(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  findAll(
    organizationId: string,
    query: StructureQueryDto & { group?: string },
  ) {
    return this.prisma.financialTag.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(query.includeInactive ? {} : { status: RecordStatus.ACTIVE }),
        ...(query.companyId
          ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
          : {}),
        ...(query.group ? { group: query.group } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const tag = await this.prisma.financialTag.findFirst({
      where: { id, deletedAt: null },
      include: { links: { take: 50, orderBy: { createdAt: 'desc' } } },
    });
    if (!tag) throw new NotFoundException('Tag não encontrada.');
    return tag;
  }

  async create(dto: CreateFinancialTagDto, actor: RequestUser) {
    try {
      const tag = await this.prisma.financialTag.create({
        data: {
          organizationId: dto.organizationId,
          companyId: dto.companyId ?? null,
          name: dto.name.trim(),
          slug: this.toSlug(dto.name),
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          group: dto.group,
          status: dto.status,
          createdBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        userId: actor.id,
        action: 'CREATE',
        entity: 'FinancialTag',
        entityId: tag.id,
        newValue: { name: tag.name },
      });

      return tag;
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateFinancialTagDto, actor: RequestUser) {
    const current = await this.findOne(id);

    try {
      const tag = await this.prisma.financialTag.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.name ? this.toSlug(dto.name) : undefined,
          description: dto.description,
          color: dto.color,
          icon: dto.icon,
          group: dto.group,
          status: dto.status,
          updatedBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: current.organizationId,
        companyId: current.companyId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'FinancialTag',
        entityId: id,
        oldValue: { name: current.name },
        newValue: { name: tag.name },
      });

      return tag;
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  /** Vincula a tag a um cadastro da estrutura financeira. */
  async link(dto: TagLinkDto, actor: RequestUser) {
    const column = this.resolveColumn(dto.entityType);
    const tag = await this.findOne(dto.tagId);

    const existing = await this.prisma.financialTagLink.findUnique({
      where: {
        tagId_entityType_entityId: {
          tagId: dto.tagId,
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
    });

    if (existing) return existing;

    const [link] = await this.prisma.$transaction([
      this.prisma.financialTagLink.create({
        data: {
          tagId: dto.tagId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          [column]: dto.entityId,
          createdBy: actor.id,
        },
      }),
      this.prisma.financialTag.update({
        where: { id: dto.tagId },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    await this.audit.log({
      organizationId: tag.organizationId,
      companyId: tag.companyId,
      userId: actor.id,
      action: 'LINK_TAG',
      entity: dto.entityType,
      entityId: dto.entityId,
      newValue: { tagId: dto.tagId, tagName: tag.name },
    });

    return link;
  }

  async unlink(dto: TagLinkDto, actor: RequestUser) {
    this.resolveColumn(dto.entityType);
    const tag = await this.findOne(dto.tagId);

    const existing = await this.prisma.financialTagLink.findUnique({
      where: {
        tagId_entityType_entityId: {
          tagId: dto.tagId,
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Esta tag não está vinculada a este registro.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.financialTagLink.delete({ where: { id: existing.id } }),
      this.prisma.financialTag.update({
        where: { id: dto.tagId },
        // `max(0, count - 1)` evita contador negativo por vínculos removidos em cascata.
        data: { usageCount: { decrement: tag.usageCount > 0 ? 1 : 0 } },
      }),
    ]);

    await this.audit.log({
      organizationId: tag.organizationId,
      companyId: tag.companyId,
      userId: actor.id,
      action: 'UNLINK_TAG',
      entity: dto.entityType,
      entityId: dto.entityId,
      oldValue: { tagId: dto.tagId, tagName: tag.name },
    });

    return { id: existing.id };
  }

  /** Lista os registros marcados com uma tag — base para o filtro global por tag. */
  findLinkedEntities(tagId: string, entityType?: string) {
    return this.prisma.financialTagLink.findMany({
      where: { tagId, ...(entityType ? { entityType } : {}) },
      include: {
        category: { select: { id: true, name: true } },
        accountPlan: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        resultCenter: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        businessUnit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, actor: RequestUser) {
    const tag = await this.findOne(id);

    await this.prisma.financialTag.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: tag.organizationId,
      companyId: tag.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'FinancialTag',
      entityId: id,
      oldValue: { name: tag.name, usageCount: tag.usageCount },
    });

    return { id };
  }

  private resolveColumn(entityType: string): string {
    const column = TAGGABLE_ENTITIES[entityType as TaggableEntity];
    if (!column) {
      throw new BadRequestException(
        `Tipo de registro inválido para tags. Utilize um destes: ${Object.keys(TAGGABLE_ENTITIES).join(', ')}.`,
      );
    }
    return column;
  }

  private rethrowDuplicate(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Já existe uma tag com este nome.');
    }
  }
}
