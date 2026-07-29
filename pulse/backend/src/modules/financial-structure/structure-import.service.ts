import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountKind,
  HierarchyEntity,
  Prisma,
  StructureImportFormat,
  StructureImportStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  ApplyImportDto,
  ExportStructureQueryDto,
  ImportStructureDto,
} from './dto/import-export.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';

/**
 * Cabeçalhos aceitos por modelo de origem. Os "modelos de ERP" não são integrações:
 * apenas mapeiam nomes de coluna diferentes para o mesmo formato tabular interno.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  code: ['codigo', 'code', 'conta', 'cod', 'classificacao', 'codigo_reduzido'],
  name: ['nome', 'descricao', 'name', 'description', 'titulo'],
  parentCode: [
    'codigo_pai',
    'conta_pai',
    'parent',
    'parent_code',
    'pai',
    'superior',
  ],
  type: ['tipo', 'type', 'grupo', 'natureza'],
  notes: ['observacoes', 'notes', 'obs'],
};

interface ParsedRow {
  line: number;
  code: string;
  name: string;
  parentCode?: string;
  type?: string;
  notes?: string;
}

interface RowError {
  line: number;
  message: string;
}

/** Entidades cujo import é suportado nesta etapa. */
const IMPORTABLE = [
  HierarchyEntity.ACCOUNT_PLAN,
  HierarchyEntity.CATEGORY,
  HierarchyEntity.COST_CENTER,
  HierarchyEntity.RESULT_CENTER,
  HierarchyEntity.BUSINESS_UNIT,
] as const;

@Injectable()
export class StructureImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  // ── Importação ─────────────────────────────────────────────────────────────

  /**
   * Etapa 1: valida o conteúdo e grava a pré-visualização. Nada é criado ainda —
   * o usuário confere os erros e só então aplica o lote.
   */
  async validate(
    dto: ImportStructureDto,
    fileContent: string | undefined,
    actor: RequestUser,
  ) {
    if (!IMPORTABLE.includes(dto.entity as (typeof IMPORTABLE)[number])) {
      throw new BadRequestException(
        'A importação está disponível para plano de contas, categorias, centros de custo, centros de resultado e unidades de negócio.',
      );
    }

    const content = fileContent ?? dto.content;
    if (!content?.trim()) {
      throw new BadRequestException(
        'Envie um arquivo ou informe o conteúdo a ser importado.',
      );
    }

    const { rows, errors } = this.parse(content);

    const batch = await this.prisma.financialStructureImport.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        entity: dto.entity,
        format: dto.format ?? StructureImportFormat.CSV,
        status:
          errors.length > 0
            ? StructureImportStatus.PENDING
            : StructureImportStatus.VALIDATED,
        fileName: dto.fileName,
        totalRows: rows.length + errors.length,
        validRows: rows.length,
        invalidRows: errors.length,
        errors: errors as unknown as Prisma.InputJsonValue,
        preview: rows as unknown as Prisma.InputJsonValue,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId ?? null,
      userId: actor.id,
      action: 'IMPORT_VALIDATE',
      entity: 'FinancialStructureImport',
      entityId: batch.id,
      newValue: {
        entity: dto.entity,
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        invalidRows: batch.invalidRows,
      },
    });

    return batch;
  }

  /** Etapa 2: aplica as linhas válidas do lote, versionando a árvore antes. */
  async apply(id: string, dto: ApplyImportDto, actor: RequestUser) {
    const batch = await this.prisma.financialStructureImport.findUnique({
      where: { id },
    });
    if (!batch)
      throw new NotFoundException('Lote de importação não encontrado.');

    if (batch.status === StructureImportStatus.APPLIED) {
      throw new ConflictException('Este lote de importação já foi aplicado.');
    }

    const rows = (batch.preview ?? []) as unknown as ParsedRow[];
    if (rows.length === 0) {
      throw new BadRequestException(
        'Não há linhas válidas para importar neste lote.',
      );
    }

    await this.versions.snapshot({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      entity: batch.entity,
      label: `Antes da importação ${batch.fileName ?? batch.id}`,
      reason: 'Importação de estrutura financeira',
      actorId: actor.id,
    });

    const result = await this.applyRows(
      batch.entity,
      batch.organizationId,
      batch.companyId,
      rows,
      dto.updateExisting ?? false,
      actor,
    );

    const updated = await this.prisma.financialStructureImport.update({
      where: { id },
      data: {
        status: StructureImportStatus.APPLIED,
        createdRows: result.created,
        updatedRows: result.updated,
        appliedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      userId: actor.id,
      action: 'IMPORT_APPLY',
      entity: 'FinancialStructureImport',
      entityId: id,
      newValue: { created: result.created, updated: result.updated },
    });

    return updated;
  }

  findBatches(organizationId: string, entity?: HierarchyEntity) {
    return this.prisma.financialStructureImport.findMany({
      where: { organizationId, ...(entity ? { entity } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Exportação ─────────────────────────────────────────────────────────────

  async export(query: ExportStructureQueryDto, actor: RequestUser) {
    const rows = await this.loadExportRows(query);

    await this.audit.log({
      organizationId: query.organizationId,
      companyId: query.companyId ?? null,
      userId: actor.id,
      action: 'EXPORT',
      entity: 'FinancialStructure',
      newValue: {
        entity: query.entity,
        format: query.format ?? 'csv',
        rows: rows.length,
      },
    });

    if ((query.format ?? 'csv') === 'json') {
      return { format: 'json' as const, entity: query.entity, rows };
    }

    return {
      format: 'csv' as const,
      entity: query.entity,
      content: this.toCsv(rows),
    };
  }

  // ── Parsing ────────────────────────────────────────────────────────────────

  /** Aceita CSV com `,` ou `;` e TSV; ignora linhas em branco. */
  private parse(content: string): { rows: ParsedRow[]; errors: RowError[] } {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'O arquivo precisa conter um cabeçalho e ao menos uma linha de dados.',
      );
    }

    const delimiter = this.detectDelimiter(lines[0]);
    const header = this.splitLine(lines[0], delimiter).map((h) =>
      this.normalizeHeader(h),
    );
    const columnIndex = this.mapColumns(header);

    if (columnIndex.code === -1 || columnIndex.name === -1) {
      throw new BadRequestException(
        'O arquivo precisa conter ao menos as colunas de código e nome/descrição.',
      );
    }

    const rows: ParsedRow[] = [];
    const errors: RowError[] = [];
    const seenCodes = new Set<string>();

    for (let i = 1; i < lines.length; i += 1) {
      const cells = this.splitLine(lines[i], delimiter);
      const lineNumber = i + 1;

      const code = (cells[columnIndex.code] ?? '').trim();
      const name = (cells[columnIndex.name] ?? '').trim();

      if (!code) {
        errors.push({ line: lineNumber, message: 'Código não informado.' });
        continue;
      }
      if (!name) {
        errors.push({
          line: lineNumber,
          message: 'Nome/descrição não informado.',
        });
        continue;
      }
      if (seenCodes.has(code)) {
        errors.push({
          line: lineNumber,
          message: `Código "${code}" repetido no arquivo.`,
        });
        continue;
      }

      seenCodes.add(code);
      rows.push({
        line: lineNumber,
        code,
        name,
        parentCode:
          columnIndex.parentCode >= 0
            ? (cells[columnIndex.parentCode] ?? '').trim() || undefined
            : undefined,
        type:
          columnIndex.type >= 0
            ? (cells[columnIndex.type] ?? '').trim() || undefined
            : undefined,
        notes:
          columnIndex.notes >= 0
            ? (cells[columnIndex.notes] ?? '').trim() || undefined
            : undefined,
      });
    }

    // Um pai citado precisa existir no arquivo ou já estar cadastrado; validado ao aplicar.
    return { rows, errors };
  }

  private detectDelimiter(headerLine: string): string {
    if (headerLine.includes('\t')) return '\t';
    if (headerLine.includes(';')) return ';';
    return ',';
  }

  private splitLine(line: string, delimiter: string): string[] {
    return line
      .split(delimiter)
      .map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'));
  }

  private normalizeHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_');
  }

  private mapColumns(header: string[]) {
    const find = (key: keyof typeof COLUMN_ALIASES) =>
      header.findIndex((h) => COLUMN_ALIASES[key].includes(h));

    return {
      code: find('code'),
      name: find('name'),
      parentCode: find('parentCode'),
      type: find('type'),
      notes: find('notes'),
    };
  }

  // ── Aplicação ──────────────────────────────────────────────────────────────

  private async applyRows(
    entity: HierarchyEntity,
    organizationId: string,
    companyId: string | null,
    rows: ParsedRow[],
    updateExisting: boolean,
    actor: RequestUser,
  ): Promise<{ created: number; updated: number }> {
    // Ordena por profundidade do código ("1" antes de "1.1") para que o pai exista antes do filho.
    const ordered = [...rows].sort(
      (a, b) => a.code.split('.').length - b.code.split('.').length,
    );

    const idByCode = new Map<string, string>();
    let created = 0;
    let updated = 0;

    for (const row of ordered) {
      const parentId = row.parentCode
        ? idByCode.get(row.parentCode)
        : undefined;

      const result = await this.upsertRow(
        entity,
        organizationId,
        companyId,
        row,
        parentId ?? null,
        updateExisting,
        actor,
      );

      idByCode.set(row.code, result.id);
      if (result.created) created += 1;
      else updated += 1;
    }

    return { created, updated };
  }

  private async upsertRow(
    entity: HierarchyEntity,
    organizationId: string,
    companyId: string | null,
    row: ParsedRow,
    parentId: string | null,
    updateExisting: boolean,
    actor: RequestUser,
  ): Promise<{ id: string; created: boolean }> {
    const base = {
      code: row.code,
      name: row.name,
      notes: row.notes,
      path: row.name,
      level: Math.max(0, row.code.split('.').length - 1),
    };

    switch (entity) {
      case HierarchyEntity.ACCOUNT_PLAN: {
        const existing = await this.prisma.financialAccountPlan.findFirst({
          where: { organizationId, companyId, code: row.code, deletedAt: null },
        });
        if (existing) {
          if (!updateExisting) return { id: existing.id, created: false };
          const up = await this.prisma.financialAccountPlan.update({
            where: { id: existing.id },
            data: { name: row.name, notes: row.notes, updatedBy: actor.id },
          });
          return { id: up.id, created: false };
        }
        const account = await this.prisma.financialAccountPlan.create({
          data: {
            ...base,
            organizationId,
            companyId,
            parentAccountId: parentId,
            accountKind: AccountKind.ANALYTICAL,
            createdBy: actor.id,
          },
        });
        return { id: account.id, created: true };
      }

      case HierarchyEntity.CATEGORY: {
        if (!companyId) {
          throw new BadRequestException(
            'Selecione a empresa para importar categorias.',
          );
        }
        const existing = await this.prisma.category.findFirst({
          where: { companyId, code: row.code, deletedAt: null },
        });
        if (existing) {
          if (!updateExisting) return { id: existing.id, created: false };
          const up = await this.prisma.category.update({
            where: { id: existing.id },
            data: { name: row.name, notes: row.notes, updatedBy: actor.id },
          });
          return { id: up.id, created: false };
        }
        const category = await this.prisma.category.create({
          data: {
            ...base,
            companyId,
            parentCategoryId: parentId,
            createdBy: actor.id,
          },
        });
        return { id: category.id, created: true };
      }

      case HierarchyEntity.COST_CENTER: {
        if (!companyId) {
          throw new BadRequestException(
            'Selecione a empresa para importar centros de custo.',
          );
        }
        const existing = await this.prisma.costCenter.findFirst({
          where: { companyId, code: row.code, deletedAt: null },
        });
        if (existing) {
          if (!updateExisting) return { id: existing.id, created: false };
          const up = await this.prisma.costCenter.update({
            where: { id: existing.id },
            data: { name: row.name, notes: row.notes, updatedBy: actor.id },
          });
          return { id: up.id, created: false };
        }
        const costCenter = await this.prisma.costCenter.create({
          data: {
            ...base,
            companyId,
            parentCostCenterId: parentId,
            createdBy: actor.id,
          },
        });
        return { id: costCenter.id, created: true };
      }

      case HierarchyEntity.RESULT_CENTER: {
        if (!companyId) {
          throw new BadRequestException(
            'Selecione a empresa para importar centros de resultado.',
          );
        }
        const existing = await this.prisma.resultCenter.findFirst({
          where: { companyId, code: row.code, deletedAt: null },
        });
        if (existing) {
          if (!updateExisting) return { id: existing.id, created: false };
          const up = await this.prisma.resultCenter.update({
            where: { id: existing.id },
            data: { name: row.name, notes: row.notes, updatedBy: actor.id },
          });
          return { id: up.id, created: false };
        }
        const resultCenter = await this.prisma.resultCenter.create({
          data: {
            ...base,
            companyId,
            parentResultCenterId: parentId,
            createdBy: actor.id,
          },
        });
        return { id: resultCenter.id, created: true };
      }

      case HierarchyEntity.BUSINESS_UNIT: {
        const existing = await this.prisma.businessUnit.findFirst({
          where: { organizationId, companyId, code: row.code, deletedAt: null },
        });
        if (existing) {
          if (!updateExisting) return { id: existing.id, created: false };
          const up = await this.prisma.businessUnit.update({
            where: { id: existing.id },
            data: { name: row.name, notes: row.notes, updatedBy: actor.id },
          });
          return { id: up.id, created: false };
        }
        const unit = await this.prisma.businessUnit.create({
          data: {
            ...base,
            organizationId,
            companyId,
            parentBusinessUnitId: parentId,
            createdBy: actor.id,
          },
        });
        return { id: unit.id, created: true };
      }

      default:
        throw new BadRequestException(
          'Importação não suportada para esta entidade.',
        );
    }
  }

  // ── Exportação ─────────────────────────────────────────────────────────────

  private async loadExportRows(
    query: ExportStructureQueryDto,
  ): Promise<Record<string, string>[]> {
    const toRow = (item: {
      code: string | null;
      name: string;
      parentCode?: string | null;
      level: number;
      path: string | null;
    }) => ({
      codigo: item.code ?? '',
      nome: item.name,
      codigo_pai: item.parentCode ?? '',
      nivel: String(item.level),
      caminho: item.path ?? '',
    });

    switch (query.entity) {
      case HierarchyEntity.ACCOUNT_PLAN: {
        const rows = await this.prisma.financialAccountPlan.findMany({
          where: {
            organizationId: query.organizationId,
            deletedAt: null,
            ...(query.companyId
              ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
              : {}),
          },
          include: { parentAccount: { select: { code: true } } },
          orderBy: { code: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentAccount?.code ?? null }),
        );
      }
      case HierarchyEntity.CATEGORY: {
        const rows = await this.prisma.category.findMany({
          where: { companyId: query.companyId, deletedAt: null },
          include: { parentCategory: { select: { code: true } } },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentCategory?.code ?? null }),
        );
      }
      case HierarchyEntity.COST_CENTER: {
        const rows = await this.prisma.costCenter.findMany({
          where: { companyId: query.companyId, deletedAt: null },
          include: { parentCostCenter: { select: { code: true } } },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentCostCenter?.code ?? null }),
        );
      }
      case HierarchyEntity.RESULT_CENTER: {
        const rows = await this.prisma.resultCenter.findMany({
          where: { companyId: query.companyId, deletedAt: null },
          include: { parentResultCenter: { select: { code: true } } },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentResultCenter?.code ?? null }),
        );
      }
      case HierarchyEntity.BUSINESS_UNIT: {
        const rows = await this.prisma.businessUnit.findMany({
          where: {
            organizationId: query.organizationId,
            deletedAt: null,
            ...(query.companyId
              ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
              : {}),
          },
          include: { parentBusinessUnit: { select: { code: true } } },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentBusinessUnit?.code ?? null }),
        );
      }
      case HierarchyEntity.PROJECT: {
        const rows = await this.prisma.project.findMany({
          where: { companyId: query.companyId, deletedAt: null },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) => ({
          codigo: r.code ?? '',
          nome: r.name,
          status: r.status,
          inicio: r.startDate ? r.startDate.toISOString().slice(0, 10) : '',
          fim: r.endDate ? r.endDate.toISOString().slice(0, 10) : '',
          orcamento: r.budgetAmount ? String(r.budgetAmount) : '',
        }));
      }
    }
  }

  private toCsv(rows: Record<string, string>[]): string {
    if (rows.length === 0) return '';

    const header = Object.keys(rows[0]);
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    return [
      header.map(escape).join(';'),
      ...rows.map((row) =>
        header.map((key) => escape(row[key] ?? '')).join(';'),
      ),
    ].join('\n');
  }
}
