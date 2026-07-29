import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { paginate } from '../../common/dto/pagination-query.dto';
import { AuditService } from '../audit/audit.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { DuplicateNodeDto, StructureQueryDto } from './dto/common.dto';

const PROJECT_INCLUDE = {
  customer: { select: { id: true, displayName: true, legalName: true } },
  costCenter: { select: { id: true, name: true } },
  resultCenter: { select: { id: true, name: true } },
  businessUnit: { select: { id: true, name: true } },
  tagLinks: { include: { tag: true } },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    companyId: string,
    query: StructureQueryDto & { status?: string },
  ) {
    const where: Prisma.ProjectWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.includeInactive ? {} : { recordStatus: RecordStatus.ACTIVE }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: PROJECT_INCLUDE,
        orderBy: { [query.orderBy ?? 'name']: query.order ?? 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.project.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: PROJECT_INCLUDE,
    });

    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  async create(dto: CreateProjectDto, actor: RequestUser) {
    this.assertDates(dto.startDate, dto.endDate);

    try {
      const project = await this.prisma.project.create({
        data: {
          companyId: dto.companyId,
          code: dto.code?.trim(),
          name: dto.name.trim(),
          description: dto.description,
          customerId: dto.customerId,
          costCenterId: dto.costCenterId,
          resultCenterId: dto.resultCenterId,
          businessUnitId: dto.businessUnitId,
          responsibleUserId: dto.responsibleUserId,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          status: dto.status ?? ProjectStatus.PLANNING,
          budgetAmount: dto.budgetAmount,
          color: dto.color,
          icon: dto.icon,
          notes: dto.notes,
          recordStatus: dto.recordStatus,
          createdBy: actor.id,
        },
        include: PROJECT_INCLUDE,
      });

      await this.audit.log({
        companyId: dto.companyId,
        userId: actor.id,
        action: 'CREATE',
        entity: 'Project',
        entityId: project.id,
        newValue: { code: project.code, name: project.name },
      });

      return project;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateProjectDto, actor: RequestUser) {
    const current = await this.findOne(id);

    this.assertDates(
      dto.startDate ?? current.startDate?.toISOString(),
      dto.endDate ?? current.endDate?.toISOString(),
    );

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          code: dto.code?.trim(),
          name: dto.name?.trim(),
          description: dto.description,
          customerId: dto.customerId,
          costCenterId: dto.costCenterId,
          resultCenterId: dto.resultCenterId,
          businessUnitId: dto.businessUnitId,
          responsibleUserId: dto.responsibleUserId,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          status: dto.status,
          budgetAmount: dto.budgetAmount,
          color: dto.color,
          icon: dto.icon,
          notes: dto.notes,
          recordStatus: dto.recordStatus,
          updatedBy: actor.id,
        },
        include: PROJECT_INCLUDE,
      });

      await this.audit.log({
        companyId: current.companyId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'Project',
        entityId: id,
        oldValue: { name: current.name, status: current.status },
        newValue: { name: project.name, status: project.status },
      });

      return project;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async duplicate(id: string, dto: DuplicateNodeDto, actor: RequestUser) {
    const source = await this.findOne(id);
    const targetCompanyId = dto.targetCompanyId ?? source.companyId;

    const created = await this.prisma.project.create({
      data: {
        companyId: targetCompanyId,
        code:
          dto.code?.trim() ??
          (source.code ? `${source.code}-COPIA` : undefined),
        name: dto.name?.trim() ?? `${source.name} (cópia)`,
        description: source.description,
        // Dimensões pertencem à empresa de origem; ao mudar de empresa elas não se aplicam.
        customerId:
          targetCompanyId === source.companyId ? source.customerId : null,
        costCenterId:
          targetCompanyId === source.companyId ? source.costCenterId : null,
        resultCenterId:
          targetCompanyId === source.companyId ? source.resultCenterId : null,
        businessUnitId:
          targetCompanyId === source.companyId ? source.businessUnitId : null,
        responsibleUserId: source.responsibleUserId,
        startDate: source.startDate,
        endDate: source.endDate,
        status: ProjectStatus.PLANNING,
        budgetAmount: source.budgetAmount,
        color: source.color,
        icon: source.icon,
        notes: source.notes,
        createdBy: actor.id,
      },
      include: PROJECT_INCLUDE,
    });

    await this.audit.log({
      companyId: targetCompanyId,
      userId: actor.id,
      action: 'DUPLICATE',
      entity: 'Project',
      entityId: created.id,
      oldValue: { sourceId: id },
      newValue: { name: created.name },
    });

    return created;
  }

  async remove(id: string, actor: RequestUser) {
    const project = await this.findOne(id);

    const [categories, rules, allocationLines] = await Promise.all([
      this.prisma.category.count({
        where: { defaultProjectId: id, deletedAt: null },
      }),
      this.prisma.classificationRule.count({
        where: { projectId: id, deletedAt: null },
      }),
      this.prisma.allocationRuleLine.count({ where: { projectId: id } }),
    ]);

    if (categories + rules + allocationLines > 0) {
      throw new ConflictException(
        'Este projeto está em uso por categorias, regras ou rateios e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.project.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        recordStatus: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      companyId: project.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'Project',
      entityId: id,
      oldValue: { code: project.code, name: project.name },
    });

    return { id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private assertDates(startDate?: string | null, endDate?: string | null) {
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'A data final do projeto deve ser posterior à data inicial.',
      );
    }
  }

  private rethrowDuplicateCode(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Já existe um projeto com este código nesta empresa.',
      );
    }
  }
}
