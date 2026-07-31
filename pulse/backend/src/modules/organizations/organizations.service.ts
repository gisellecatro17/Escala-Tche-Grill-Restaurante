import { Injectable, NotFoundException } from '@nestjs/common';

import {
  PaginationQueryDto,
  paginate,
} from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto, actor: RequestUser) {
    const visibleOrganizationIds = actor.isPlatformAdmin
      ? undefined
      : Array.from(new Set(actor.memberships.map((m) => m.organizationId)));

    const where = {
      ...(visibleOrganizationIds ? { id: { in: visibleOrganizationIds } } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { [query.orderBy ?? 'name']: query.order ?? 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organização não encontrada.');
    }

    return organization;
  }

  async create(dto: CreateOrganizationDto, actor: RequestUser) {
    const organization = await this.prisma.organization.create({
      data: { name: dto.name, createdBy: actor.id, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: organization.id,
      userId: actor.id,
      action: 'CREATE',
      entity: 'Organization',
      entityId: organization.id,
      newValue: organization,
    });

    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto, actor: RequestUser) {
    const existing = await this.findOne(id);

    const organization = await this.prisma.organization.update({
      where: { id },
      data: { ...dto, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: id,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Organization',
      entityId: id,
      oldValue: existing,
      newValue: organization,
    });

    return organization;
  }

  async setStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    actor: RequestUser,
  ) {
    const existing = await this.findOne(id);

    const organization = await this.prisma.organization.update({
      where: { id },
      data: { status, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: id,
      userId: actor.id,
      action: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'Organization',
      entityId: id,
      field: 'status',
      oldValue: { status: existing.status },
      newValue: { status: organization.status },
    });

    return organization;
  }
}
