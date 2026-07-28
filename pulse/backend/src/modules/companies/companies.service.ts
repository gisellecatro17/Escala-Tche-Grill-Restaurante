import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  PaginationQueryDto,
  paginate,
} from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto, actor: RequestUser) {
    const visibleCompanyIds = actor.isPlatformAdmin
      ? undefined
      : actor.memberships.map((m) => m.companyId);

    const where = {
      ...(visibleCompanyIds ? { id: { in: visibleCompanyIds } } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                tradeName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              { document: { contains: query.search.replace(/\D/g, '') } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { [query.orderBy ?? 'name']: query.order ?? 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.company.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return company;
  }

  async create(dto: CreateCompanyDto, actor: RequestUser) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organização não encontrada.');
    }

    try {
      const company = await this.prisma.company.create({
        data: {
          organizationId: dto.organizationId,
          name: dto.name,
          tradeName: dto.tradeName,
          document: dto.document.replace(/\D/g, ''),
          email: dto.email,
          phone: dto.phone,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: company.organizationId,
        companyId: company.id,
        userId: actor.id,
        action: 'CREATE',
        entity: 'Company',
        entityId: company.id,
        newValue: company,
      });

      return company;
    } catch (error) {
      this.rethrowIfDuplicateDocument(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCompanyDto, actor: RequestUser) {
    const existing = await this.findOne(id);

    try {
      const company = await this.prisma.company.update({
        where: { id },
        data: { ...dto, updatedBy: actor.id },
      });

      await this.audit.log({
        organizationId: company.organizationId,
        companyId: id,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'Company',
        entityId: id,
        oldValue: existing,
        newValue: company,
      });

      return company;
    } catch (error) {
      this.rethrowIfDuplicateDocument(error);
      throw error;
    }
  }

  async setStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED',
    actor: RequestUser,
  ) {
    const existing = await this.findOne(id);

    const company = await this.prisma.company.update({
      where: { id },
      data: { status, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: company.organizationId,
      companyId: id,
      userId: actor.id,
      action: `STATUS_${status}`,
      entity: 'Company',
      entityId: id,
      field: 'status',
      oldValue: { status: existing.status },
      newValue: { status: company.status },
    });

    return company;
  }

  private rethrowIfDuplicateDocument(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_ERROR_CODE
    ) {
      throw new ConflictException(
        'Já existe uma empresa cadastrada com este CNPJ.',
      );
    }
  }
}
