import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RecordStatus, StructureStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { DuplicateStructureDto } from './dto/duplicate-structure.dto';

/** Resultado da cópia de um cadastro: quantos vieram e quantos já existiam. */
export interface CopyReport {
  registry: string;
  copied: number;
  skipped: number;
}

@Injectable()
export class StructureDuplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Copia a estrutura de uma empresa para outra (seção 46).
   *
   * Copia **apenas a estrutura**: nunca lançamentos, saldos, movimentações,
   * conciliações, orçamentos realizados, histórico de uso ou auditoria da origem.
   * Registros já existentes no destino são ignorados, jamais sobrescritos ou excluídos.
   */
  async duplicate(dto: DuplicateStructureDto, actor: RequestUser) {
    if (dto.sourceCompanyId === dto.targetCompanyId) {
      throw new BadRequestException(
        'A empresa de origem e a de destino precisam ser diferentes.',
      );
    }

    const [source, target] = await Promise.all([
      this.prisma.company.findFirst({
        where: { id: dto.sourceCompanyId, deletedAt: null },
        select: { id: true, organizationId: true, tradeName: true },
      }),
      this.prisma.company.findFirst({
        where: { id: dto.targetCompanyId, deletedAt: null },
        select: { id: true, organizationId: true, tradeName: true },
      }),
    ]);

    if (!source)
      throw new NotFoundException('Empresa de origem não encontrada.');
    if (!target)
      throw new NotFoundException('Empresa de destino não encontrada.');

    // O isolamento é validado aqui, no back-end: copiar entre organizações vazaria
    // dados de um cliente do BPO para outro.
    if (source.organizationId !== target.organizationId) {
      throw new BadRequestException(
        'A duplicação só é permitida entre empresas da mesma organização.',
      );
    }

    const organizationId = source.organizationId;
    const reports: CopyReport[] = [];
    const idMaps = {
      accountPlan: new Map<string, string>(),
      category: new Map<string, string>(),
      costCenter: new Map<string, string>(),
      resultCenter: new Map<string, string>(),
      businessUnit: new Map<string, string>(),
      tag: new Map<string, string>(),
    };

    // A ordem importa: unidades e centros antes das categorias, que os referenciam.
    if (dto.businessUnits !== false && dto.businessUnits) {
      reports.push(
        await this.copyBusinessUnits(
          dto,
          organizationId,
          idMaps.businessUnit,
          actor,
        ),
      );
    }
    if (dto.accountPlan !== false) {
      reports.push(
        await this.copyAccountPlans(
          dto,
          organizationId,
          idMaps.accountPlan,
          actor,
        ),
      );
    }
    if (dto.costCenters !== false) {
      reports.push(await this.copyCostCenters(dto, idMaps.costCenter, actor));
    }
    if (dto.resultCenters !== false) {
      reports.push(
        await this.copyResultCenters(dto, idMaps.resultCenter, actor),
      );
    }
    if (dto.financialTags) {
      reports.push(await this.copyTags(dto, organizationId, idMaps.tag, actor));
    }
    if (dto.categories !== false) {
      reports.push(await this.copyCategories(dto, idMaps, actor));
    }

    await this.audit.log({
      organizationId,
      companyId: dto.targetCompanyId,
      userId: actor.id,
      action: 'DUPLICATE_STRUCTURE',
      entity: 'FinancialStructure',
      entityId: dto.targetCompanyId,
      oldValue: { sourceCompanyId: dto.sourceCompanyId },
      newValue: { reports: JSON.parse(JSON.stringify(reports)) as object },
      reason: dto.reason,
    });

    return {
      sourceCompanyId: dto.sourceCompanyId,
      targetCompanyId: dto.targetCompanyId,
      reports,
      totalCopied: reports.reduce((sum, report) => sum + report.copied, 0),
      // Deixado explícito na resposta para que a tela reforce o que não foi copiado.
      notCopied: [
        'lançamentos',
        'saldos',
        'movimentações',
        'conciliações',
        'orçamentos realizados',
        'histórico de uso',
        'auditoria da empresa de origem',
      ],
    };
  }

  /** Só traz os ativos, a menos que o usuário peça explicitamente os inativos. */
  private statusFilter(dto: DuplicateStructureDto) {
    return dto.includeInactive
      ? {}
      : {
          structureStatus: StructureStatus.ACTIVE,
          status: RecordStatus.ACTIVE,
        };
  }

  private async copyAccountPlans(
    dto: DuplicateStructureDto,
    organizationId: string,
    idMap: Map<string, string>,
    actor: RequestUser,
  ): Promise<CopyReport> {
    const source = await this.prisma.financialAccountPlan.findMany({
      where: {
        organizationId,
        companyId: dto.sourceCompanyId,
        deletedAt: null,
        ...this.statusFilter(dto),
      },
      orderBy: { level: 'asc' },
    });

    const existing = await this.prisma.financialAccountPlan.findMany({
      where: { companyId: dto.targetCompanyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const existingByCode = new Map(existing.map((row) => [row.code, row.id]));

    let copied = 0;
    let skipped = 0;

    for (const account of source) {
      const already = existingByCode.get(account.code);
      if (already) {
        // Já existe no destino: preservado como está, para não perder vínculos.
        idMap.set(account.id, already);
        skipped += 1;
        continue;
      }

      const created = await this.prisma.financialAccountPlan.create({
        data: {
          organizationId,
          companyId: dto.targetCompanyId,
          parentAccountId: account.parentAccountId
            ? (idMap.get(account.parentAccountId) ?? null)
            : null,
          code: account.code,
          normalizedCode: account.normalizedCode,
          name: account.name,
          shortName: account.shortName,
          description: account.description,
          accountType: account.accountType,
          accountKind: account.accountKind,
          planType: account.planType,
          accountGroup: account.accountGroup,
          acceptsEntries: account.acceptsEntries,
          allowsAllocations: account.allowsAllocations,
          allowsBudget: account.allowsBudget,
          showInCashFlow: account.showInCashFlow,
          showInIncomeStatement: account.showInIncomeStatement,
          showInManagementBalance: account.showInManagementBalance,
          showInReports: account.showInReports,
          color: account.color,
          icon: account.icon,
          sortOrder: account.sortOrder,
          level: account.level,
          path: account.path,
          notes: account.notes,
          createdBy: actor.id,
          // `lastUsedAt` fica nulo de propósito: o histórico de uso não é copiado.
        },
      });

      idMap.set(account.id, created.id);
      copied += 1;
    }

    return { registry: 'Plano de contas', copied, skipped };
  }

  private async copyCostCenters(
    dto: DuplicateStructureDto,
    idMap: Map<string, string>,
    actor: RequestUser,
  ): Promise<CopyReport> {
    const source = await this.prisma.costCenter.findMany({
      where: {
        companyId: dto.sourceCompanyId,
        deletedAt: null,
        ...this.statusFilter(dto),
      },
      orderBy: { level: 'asc' },
    });

    const existing = await this.prisma.costCenter.findMany({
      where: { companyId: dto.targetCompanyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const existingByCode = new Map(
      existing.filter((row) => row.code).map((row) => [row.code!, row.id]),
    );

    let copied = 0;
    let skipped = 0;

    for (const center of source) {
      const already = center.code ? existingByCode.get(center.code) : undefined;
      if (already) {
        idMap.set(center.id, already);
        skipped += 1;
        continue;
      }

      const created = await this.prisma.costCenter.create({
        data: {
          companyId: dto.targetCompanyId,
          parentCostCenterId: center.parentCostCenterId
            ? (idMap.get(center.parentCostCenterId) ?? null)
            : null,
          code: center.code,
          normalizedCode: center.normalizedCode,
          name: center.name,
          description: center.description,
          level: center.level,
          path: center.path,
          notes: center.notes,
          createdBy: actor.id,
          // Responsável e vigência não são copiados: são decisões da nova empresa.
        },
      });

      idMap.set(center.id, created.id);
      copied += 1;
    }

    return { registry: 'Centros de custo', copied, skipped };
  }

  private async copyResultCenters(
    dto: DuplicateStructureDto,
    idMap: Map<string, string>,
    actor: RequestUser,
  ): Promise<CopyReport> {
    const source = await this.prisma.resultCenter.findMany({
      where: {
        companyId: dto.sourceCompanyId,
        deletedAt: null,
        ...this.statusFilter(dto),
      },
      orderBy: { level: 'asc' },
    });

    const existing = await this.prisma.resultCenter.findMany({
      where: { companyId: dto.targetCompanyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const existingByCode = new Map(
      existing.filter((row) => row.code).map((row) => [row.code!, row.id]),
    );

    let copied = 0;
    let skipped = 0;

    for (const center of source) {
      const already = center.code ? existingByCode.get(center.code) : undefined;
      if (already) {
        idMap.set(center.id, already);
        skipped += 1;
        continue;
      }

      const created = await this.prisma.resultCenter.create({
        data: {
          companyId: dto.targetCompanyId,
          parentResultCenterId: center.parentResultCenterId
            ? (idMap.get(center.parentResultCenterId) ?? null)
            : null,
          code: center.code,
          name: center.name,
          description: center.description,
          level: center.level,
          path: center.path,
          notes: center.notes,
          createdBy: actor.id,
        },
      });

      idMap.set(center.id, created.id);
      copied += 1;
    }

    return { registry: 'Centros de resultado', copied, skipped };
  }

  private async copyBusinessUnits(
    dto: DuplicateStructureDto,
    organizationId: string,
    idMap: Map<string, string>,
    actor: RequestUser,
  ): Promise<CopyReport> {
    const source = await this.prisma.businessUnit.findMany({
      where: {
        organizationId,
        companyId: dto.sourceCompanyId,
        deletedAt: null,
        ...this.statusFilter(dto),
      },
      orderBy: { level: 'asc' },
    });

    const existing = await this.prisma.businessUnit.findMany({
      where: { companyId: dto.targetCompanyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const existingByCode = new Map(
      existing.filter((row) => row.code).map((row) => [row.code!, row.id]),
    );

    let copied = 0;
    let skipped = 0;

    for (const unit of source) {
      const already = unit.code ? existingByCode.get(unit.code) : undefined;
      if (already) {
        idMap.set(unit.id, already);
        skipped += 1;
        continue;
      }

      const created = await this.prisma.businessUnit.create({
        data: {
          organizationId,
          companyId: dto.targetCompanyId,
          parentBusinessUnitId: unit.parentBusinessUnitId
            ? (idMap.get(unit.parentBusinessUnitId) ?? null)
            : null,
          code: unit.code,
          name: unit.name,
          description: unit.description,
          level: unit.level,
          path: unit.path,
          notes: unit.notes,
          createdBy: actor.id,
        },
      });

      idMap.set(unit.id, created.id);
      copied += 1;
    }

    return { registry: 'Unidades de negócio', copied, skipped };
  }

  private async copyTags(
    dto: DuplicateStructureDto,
    organizationId: string,
    idMap: Map<string, string>,
    actor: RequestUser,
  ): Promise<CopyReport> {
    const source = await this.prisma.financialTag.findMany({
      where: {
        organizationId,
        companyId: dto.sourceCompanyId,
        deletedAt: null,
        ...this.statusFilter(dto),
      },
    });

    const existing = await this.prisma.financialTag.findMany({
      where: { companyId: dto.targetCompanyId, deletedAt: null },
      select: { id: true, name: true },
    });
    const existingByName = new Map(existing.map((row) => [row.name, row.id]));

    let copied = 0;
    let skipped = 0;

    for (const tag of source) {
      const already = existingByName.get(tag.name);
      if (already) {
        idMap.set(tag.id, already);
        skipped += 1;
        continue;
      }

      const created = await this.prisma.financialTag.create({
        data: {
          organizationId,
          companyId: dto.targetCompanyId,
          name: tag.name,
          slug: tag.slug,
          description: tag.description,
          color: tag.color,
          createdBy: actor.id,
          // Os vínculos (`links`) não são copiados: eles apontam para registros da origem.
        },
      });

      idMap.set(tag.id, created.id);
      copied += 1;
    }

    return { registry: 'Tags', copied, skipped };
  }

  private async copyCategories(
    dto: DuplicateStructureDto,
    idMaps: {
      category: Map<string, string>;
      accountPlan: Map<string, string>;
      costCenter: Map<string, string>;
      resultCenter: Map<string, string>;
      businessUnit: Map<string, string>;
    },
    actor: RequestUser,
  ): Promise<CopyReport> {
    const source = await this.prisma.financialCategory.findMany({
      where: {
        companyId: dto.sourceCompanyId,
        deletedAt: null,
        ...this.statusFilter(dto),
      },
      orderBy: { level: 'asc' },
    });

    const existing = await this.prisma.financialCategory.findMany({
      where: { companyId: dto.targetCompanyId, deletedAt: null },
      select: { id: true, name: true, parentCategoryId: true },
    });
    // Nome + pai identifica a categoria: o código é opcional neste cadastro.
    const existingByKey = new Map(
      existing.map((row) => [
        `${row.parentCategoryId ?? ''}|${row.name}`,
        row.id,
      ]),
    );

    let copied = 0;
    let skipped = 0;

    for (const category of source) {
      const mappedParent = category.parentCategoryId
        ? (idMaps.category.get(category.parentCategoryId) ?? null)
        : null;

      const already = existingByKey.get(
        `${mappedParent ?? ''}|${category.name}`,
      );
      if (already) {
        idMaps.category.set(category.id, already);
        skipped += 1;
        continue;
      }

      const created = await this.prisma.financialCategory.create({
        data: {
          companyId: dto.targetCompanyId,
          parentCategoryId: mappedParent,
          code: category.code,
          normalizedCode: category.normalizedCode,
          name: category.name,
          description: category.description,
          categoryType: category.categoryType,
          level: category.level,
          path: category.path,
          notes: category.notes,
          // Os padrões apontam para os registros já copiados; se algum não foi
          // copiado, o campo fica nulo em vez de apontar para outra empresa.
          accountPlanId: category.accountPlanId
            ? (idMaps.accountPlan.get(category.accountPlanId) ?? null)
            : null,
          defaultCostCenterId: category.defaultCostCenterId
            ? (idMaps.costCenter.get(category.defaultCostCenterId) ?? null)
            : null,
          defaultResultCenterId: category.defaultResultCenterId
            ? (idMaps.resultCenter.get(category.defaultResultCenterId) ?? null)
            : null,
          defaultBusinessUnitId: category.defaultBusinessUnitId
            ? (idMaps.businessUnit.get(category.defaultBusinessUnitId) ?? null)
            : null,
          createdBy: actor.id,
        },
      });

      idMaps.category.set(category.id, created.id);
      copied += 1;
    }

    return { registry: 'Categorias financeiras', copied, skipped };
  }
}
