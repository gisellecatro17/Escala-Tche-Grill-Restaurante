import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  CreateFinancialNatureDto,
  UpdateFinancialNatureDto,
} from './dto/financial-nature.dto';
import { StructureQueryDto } from './dto/common.dto';

@Injectable()
export class FinancialNaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(organizationId: string, query: StructureQueryDto) {
    return this.prisma.financialNatureCatalog.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(query.includeInactive ? {} : { status: RecordStatus.ACTIVE }),
        ...(query.companyId
          ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
          : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const nature = await this.prisma.financialNatureCatalog.findFirst({
      where: { id, deletedAt: null },
    });
    if (!nature)
      throw new NotFoundException('Natureza financeira não encontrada.');
    return nature;
  }

  async create(dto: CreateFinancialNatureDto, actor: RequestUser) {
    try {
      const nature = await this.prisma.financialNatureCatalog.create({
        data: {
          organizationId: dto.organizationId,
          companyId: dto.companyId ?? null,
          code: dto.code?.trim(),
          name: dto.name.trim(),
          description: dto.description,
          kind: dto.kind,
          affectsResult: dto.affectsResult ?? true,
          affectsCashFlow: dto.affectsCashFlow ?? true,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status,
          createdBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        userId: actor.id,
        action: 'CREATE',
        entity: 'FinancialNature',
        entityId: nature.id,
        newValue: { name: nature.name, kind: nature.kind },
      });

      return nature;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateFinancialNatureDto, actor: RequestUser) {
    const current = await this.findOne(id);

    try {
      const nature = await this.prisma.financialNatureCatalog.update({
        where: { id },
        data: {
          code: dto.code?.trim(),
          name: dto.name?.trim(),
          description: dto.description,
          kind: dto.kind,
          affectsResult: dto.affectsResult,
          affectsCashFlow: dto.affectsCashFlow,
          color: dto.color,
          icon: dto.icon,
          sortOrder: dto.sortOrder,
          status: dto.status,
          updatedBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: current.organizationId,
        companyId: current.companyId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'FinancialNature',
        entityId: id,
        oldValue: { name: current.name, kind: current.kind },
        newValue: { name: nature.name, kind: nature.kind },
      });

      return nature;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async remove(id: string, actor: RequestUser) {
    const nature = await this.findOne(id);

    if (nature.isSystem) {
      throw new ConflictException(
        'Esta é uma natureza padrão do sistema e não pode ser excluída.',
      );
    }

    const [categories, accounts, rules] = await Promise.all([
      this.prisma.financialCategory.count({
        where: { financialNatureId: id, deletedAt: null },
      }),
      this.prisma.financialAccountPlan.count({
        where: { financialNatureId: id, deletedAt: null },
      }),
      this.prisma.classificationRule.count({
        where: { financialNatureId: id, deletedAt: null },
      }),
    ]);

    if (categories + accounts + rules > 0) {
      throw new ConflictException(
        'Esta natureza financeira está em uso e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.financialNatureCatalog.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: nature.organizationId,
      companyId: nature.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'FinancialNature',
      entityId: id,
      oldValue: { name: nature.name },
    });

    return { id };
  }

  private rethrowDuplicateCode(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Já existe uma natureza financeira com este código nesta organização.',
      );
    }
  }
}
