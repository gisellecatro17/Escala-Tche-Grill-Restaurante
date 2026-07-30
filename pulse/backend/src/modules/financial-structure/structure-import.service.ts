import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountKind,
  HierarchyEntity,
  ImportRowStatus,
  Prisma,
  StructureImportMode,
  StructureImportStatus,
} from '@prisma/client';

import ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  AnalyzeImportDto,
  ApplyImportWizardDto,
  ExportStructureFullQueryDto,
  ImportRowsQueryDto,
  SetImportMappingDto,
} from './dto/import-wizard.dto';
import { ExportStructureQueryDto } from './dto/import-export.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import { normalizeCode } from './utils/code-generation.util';
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  type ImportField,
  REQUIRED_IMPORT_FIELDS,
  detectFormat,
  parseStructureFile,
  suggestMapping,
} from './utils/structure-file.util';

interface NormalizedRow {
  code: string;
  name: string;
  parentCode?: string;
  type?: string;
  notes?: string;
  shortName?: string;
  accountType?: string;
  financialNature?: string;
}

interface RowIssue {
  field?: string;
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

/** Entidades que só existem dentro de uma empresa. */
const COMPANY_SCOPED: HierarchyEntity[] = [
  HierarchyEntity.CATEGORY,
  HierarchyEntity.COST_CENTER,
  HierarchyEntity.RESULT_CENTER,
];

const ENTITY_LABELS: Record<HierarchyEntity, string> = {
  ACCOUNT_PLAN: 'plano de contas',
  CATEGORY: 'categorias',
  COST_CENTER: 'centros de custo',
  RESULT_CENTER: 'centros de resultado',
  BUSINESS_UNIT: 'unidades de negócio',
  PROJECT: 'projetos',
};

@Injectable()
export class StructureImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  // ── Etapas 1 e 2: arquivo e cadastro de destino ────────────────────────────

  /**
   * Lê o arquivo, grava cada linha crua em `financial_structure_import_rows` e devolve os
   * cabeçalhos com o mapeamento sugerido. Nada é criado no cadastro: o lote nasce como
   * `PENDING` e só avança quando o usuário confirma o mapeamento e a validação.
   */
  async analyze(
    dto: AnalyzeImportDto,
    file: Buffer | undefined,
    actor: RequestUser,
  ) {
    this.assertImportable(dto.entity, dto.companyId);

    const buffer =
      file ?? (dto.content ? Buffer.from(dto.content, 'utf-8') : undefined);

    if (!buffer?.length) {
      throw new BadRequestException(
        'Envie um arquivo ou informe o conteúdo a ser importado.',
      );
    }

    const format = dto.format ?? detectFormat(dto.fileName);
    const parsed = await parseStructureFile(buffer, format, dto.fileName);
    const mapping = suggestMapping(parsed.headers);

    const batch = await this.prisma.financialStructureImport.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        entity: dto.entity,
        format,
        status: StructureImportStatus.PENDING,
        fileName: dto.fileName,
        totalRows: parsed.rows.length,
        mappingConfiguration: {
          headers: parsed.headers,
          mapping,
          confirmed: false,
        },
        createdBy: actor.id,
        startedBy: actor.id,
        startedAt: new Date(),
        rows: {
          create: parsed.rows.map((row, index) => ({
            // Numeração do arquivo: a linha 1 é o cabeçalho.
            rowNumber: index + 2,
            originalData: row,
            validationStatus: ImportRowStatus.WARNING,
            validationErrors: [{ message: 'Aguardando validação.' }],
          })),
        },
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId ?? null,
      userId: actor.id,
      action: 'IMPORT_ANALYZE',
      entity: 'FinancialStructureImport',
      entityId: batch.id,
      newValue: {
        entity: dto.entity,
        format,
        totalRows: parsed.rows.length,
      },
    });

    return {
      ...batch,
      headers: parsed.headers,
      suggestedMapping: mapping,
      availableFields: IMPORT_FIELDS.map((field) => ({
        field,
        label: IMPORT_FIELD_LABELS[field],
        required: REQUIRED_IMPORT_FIELDS.includes(field),
      })),
      sampleRows: parsed.rows.slice(0, 10),
    };
  }

  // ── Etapa 3: mapeamento de colunas ────────────────────────────────────────

  async setMapping(id: string, dto: SetImportMappingDto, actor: RequestUser) {
    const batch = await this.findBatch(id);
    this.assertNotApplied(batch.status);

    const config = this.readConfig(batch.mappingConfiguration);
    const mapping: Partial<Record<ImportField, string>> = {};

    for (const [field, column] of Object.entries(dto.mapping)) {
      if (!IMPORT_FIELDS.includes(field as ImportField)) {
        throw new BadRequestException(
          `O campo "${field}" não é reconhecido pela importação.`,
        );
      }
      if (!column) continue;
      if (!config.headers.includes(column)) {
        throw new BadRequestException(
          `A coluna "${column}" não existe no arquivo enviado.`,
        );
      }
      mapping[field as ImportField] = column;
    }

    const missing = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping[field]);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Informe a coluna correspondente a: ${missing
          .map((field) => IMPORT_FIELD_LABELS[field])
          .join(', ')}.`,
      );
    }

    const updated = await this.prisma.financialStructureImport.update({
      where: { id },
      data: {
        mappingConfiguration: {
          headers: config.headers,
          mapping,
          confirmed: true,
        },
      },
    });

    await this.audit.log({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      userId: actor.id,
      action: 'IMPORT_MAPPING',
      entity: 'FinancialStructureImport',
      entityId: id,
      newValue: mapping,
    });

    return updated;
  }

  // ── Etapas 4 e 5: validação e revisão das inconsistências ─────────────────

  /**
   * Valida linha por linha e grava o resultado em cada `financial_structure_import_row`.
   * Erro impede a linha de ser aplicada; aviso deixa a decisão para o usuário.
   */
  async validateBatch(id: string, actor: RequestUser) {
    const batch = await this.findBatch(id);
    this.assertNotApplied(batch.status);

    const { mapping } = this.readConfig(batch.mappingConfiguration);
    const missing = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping[field]);
    if (missing.length > 0) {
      throw new BadRequestException(
        'Confirme o mapeamento de colunas antes de validar o arquivo.',
      );
    }

    const rows = await this.prisma.financialStructureImportRow.findMany({
      where: { importId: id },
      orderBy: { rowNumber: 'asc' },
    });

    const normalized = rows.map((row) => ({
      row,
      data: this.applyMapping(
        row.originalData as Record<string, string>,
        mapping,
      ),
    }));

    const codesInFile = new Set(
      normalized
        .map((item) => normalizeCode(item.data.code ?? ''))
        .filter((code) => code.length > 0),
    );

    const existingCodes = await this.loadExistingCodes(
      batch.entity,
      batch.organizationId,
      batch.companyId,
      normalized.map((item) => item.data.code ?? ''),
    );

    const seen = new Set<string>();
    let valid = 0;
    let warning = 0;
    let invalid = 0;

    for (const { row, data } of normalized) {
      const issues = this.validateRow(data, {
        seen,
        codesInFile,
        existingCodes,
      });

      const status = issues.some((issue) => issue.message.startsWith('Aviso:'))
        ? ImportRowStatus.WARNING
        : issues.length > 0
          ? ImportRowStatus.ERROR
          : ImportRowStatus.VALID;

      if (status === ImportRowStatus.VALID) valid += 1;
      else if (status === ImportRowStatus.WARNING) warning += 1;
      else invalid += 1;

      await this.prisma.financialStructureImportRow.update({
        where: { id: row.id },
        data: {
          normalizedData: data as unknown as Prisma.InputJsonValue,
          validationStatus: status,
          validationErrors:
            issues.length > 0
              ? (issues as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
        },
      });
    }

    const updated = await this.prisma.financialStructureImport.update({
      where: { id },
      data: {
        status:
          invalid > 0
            ? StructureImportStatus.PENDING
            : StructureImportStatus.VALIDATED,
        totalRows: rows.length,
        validRows: valid,
        warningRows: warning,
        invalidRows: invalid,
        // O resumo por linha fica na tabela de linhas; aqui só o agregado.
        errors: Prisma.DbNull,
      },
    });

    await this.audit.log({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      userId: actor.id,
      action: 'IMPORT_VALIDATE',
      entity: 'FinancialStructureImport',
      entityId: id,
      newValue: { valid, warning, invalid },
    });

    return updated;
  }

  /**
   * Regras de validação por linha. Um "Aviso:" não bloqueia a importação — o usuário
   * decide na etapa de revisão se aplica ou não essas linhas.
   */
  private validateRow(
    data: NormalizedRow,
    context: {
      seen: Set<string>;
      codesInFile: Set<string>;
      existingCodes: Set<string>;
    },
  ): RowIssue[] {
    const issues: RowIssue[] = [];
    const code = (data.code ?? '').trim();
    const name = (data.name ?? '').trim();

    if (!code) {
      issues.push({ field: 'code', message: 'Código não informado.' });
    }
    if (!name) {
      issues.push({ field: 'name', message: 'Nome/descrição não informado.' });
    }
    if (issues.length > 0) return issues;

    const normalizedCode = normalizeCode(code);

    if (context.seen.has(normalizedCode)) {
      issues.push({
        field: 'code',
        message: `Código "${code}" repetido no arquivo.`,
      });
      return issues;
    }
    context.seen.add(normalizedCode);

    if (data.parentCode) {
      const parent = normalizeCode(data.parentCode);
      if (
        !context.codesInFile.has(parent) &&
        !context.existingCodes.has(parent)
      ) {
        issues.push({
          field: 'parentCode',
          message: `O registro superior "${data.parentCode}" não existe no arquivo nem no cadastro.`,
        });
        return issues;
      }
    }

    if (context.existingCodes.has(normalizedCode)) {
      issues.push({
        field: 'code',
        message: `Aviso: o código "${code}" já existe no cadastro. Será mantido ou atualizado conforme o modo escolhido, nunca excluído.`,
      });
    }

    return issues;
  }

  // ── Etapas 6 e 7: aplicação e resultado ───────────────────────────────────

  /**
   * Aplica as linhas aprovadas. Nenhum modo exclui registros existentes (seção 44):
   * `INSERT_ONLY` ignora o que já existe, `UPDATE_ONLY` só atualiza, e `SIMULATE`
   * não grava nada.
   */
  async applyBatch(id: string, dto: ApplyImportWizardDto, actor: RequestUser) {
    const batch = await this.findBatch(id);
    this.assertNotApplied(batch.status);

    const mode = dto.mode ?? StructureImportMode.INSERT_ONLY;
    const simulate = mode === StructureImportMode.SIMULATE;

    const acceptedStatuses = dto.includeWarnings
      ? [ImportRowStatus.VALID, ImportRowStatus.WARNING]
      : [ImportRowStatus.VALID];

    const rows = await this.prisma.financialStructureImportRow.findMany({
      where: { importId: id, validationStatus: { in: acceptedStatuses } },
      orderBy: { rowNumber: 'asc' },
    });

    if (rows.length === 0) {
      throw new BadRequestException(
        'Não há linhas aprovadas para importar. Revise as inconsistências ou inclua as linhas com aviso.',
      );
    }

    if (!simulate) {
      // Snapshot antes de tocar na árvore: permite desfazer a importação inteira.
      await this.versions.snapshot({
        organizationId: batch.organizationId,
        companyId: batch.companyId,
        entity: batch.entity,
        label: `Antes da importação ${batch.fileName ?? batch.id}`,
        reason: 'Importação de estrutura financeira',
        actorId: actor.id,
      });
    }

    const result = await this.applyRows(batch, rows, mode, actor);

    const updated = await this.prisma.financialStructureImport.update({
      where: { id },
      data: {
        importMode: mode,
        // A simulação mantém o lote disponível para ser aplicado de verdade depois.
        status: simulate
          ? StructureImportStatus.VALIDATED
          : StructureImportStatus.APPLIED,
        createdRows: result.created,
        updatedRows: result.updated,
        ...(simulate ? {} : { appliedAt: new Date(), completedAt: new Date() }),
      },
    });

    await this.audit.log({
      organizationId: batch.organizationId,
      companyId: batch.companyId,
      userId: actor.id,
      action: simulate ? 'IMPORT_SIMULATE' : 'IMPORT_APPLY',
      entity: 'FinancialStructureImport',
      entityId: id,
      newValue: {
        mode,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      },
    });

    return {
      ...updated,
      simulated: simulate,
      skippedRows: result.skipped,
      messages: result.messages,
    };
  }

  findRows(id: string, query: ImportRowsQueryDto) {
    return this.prisma.financialStructureImportRow.findMany({
      where: {
        importId: id,
        ...(query.status ? { validationStatus: query.status } : {}),
      },
      orderBy: { rowNumber: 'asc' },
      take: 1000,
    });
  }

  async findBatch(id: string) {
    const batch = await this.prisma.financialStructureImport.findUnique({
      where: { id },
    });
    if (!batch) {
      throw new NotFoundException('Lote de importação não encontrado.');
    }
    return batch;
  }

  findBatches(organizationId: string, entity?: HierarchyEntity) {
    return this.prisma.financialStructureImport.findMany({
      where: { organizationId, ...(entity ? { entity } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Helpers de lote ───────────────────────────────────────────────────────

  private assertImportable(entity: HierarchyEntity, companyId?: string | null) {
    if (!IMPORTABLE.includes(entity as (typeof IMPORTABLE)[number])) {
      throw new BadRequestException(
        'A importação está disponível para plano de contas, categorias, centros de custo, centros de resultado e unidades de negócio.',
      );
    }
    if (COMPANY_SCOPED.includes(entity) && !companyId) {
      throw new BadRequestException(
        `Selecione a empresa para importar ${ENTITY_LABELS[entity]}.`,
      );
    }
  }

  private assertNotApplied(status: StructureImportStatus) {
    if (status === StructureImportStatus.APPLIED) {
      throw new ConflictException('Este lote de importação já foi aplicado.');
    }
  }

  private readConfig(raw: Prisma.JsonValue | null): {
    headers: string[];
    mapping: Partial<Record<ImportField, string>>;
  } {
    const config = (raw ?? {}) as {
      headers?: string[];
      mapping?: Partial<Record<ImportField, string>>;
    };

    return { headers: config.headers ?? [], mapping: config.mapping ?? {} };
  }

  private applyMapping(
    original: Record<string, string>,
    mapping: Partial<Record<ImportField, string>>,
  ): NormalizedRow {
    const value = (field: ImportField) => {
      const column = mapping[field];
      if (!column) return undefined;
      const raw = (original[column] ?? '').trim();
      return raw.length > 0 ? raw : undefined;
    };

    return {
      code: value('code') ?? '',
      name: value('name') ?? '',
      parentCode: value('parentCode'),
      type: value('type'),
      notes: value('notes'),
      shortName: value('shortName'),
      accountType: value('accountType'),
      financialNature: value('financialNature'),
    };
  }

  /** Códigos já cadastrados, normalizados, para detectar duplicidade real. */
  private async loadExistingCodes(
    entity: HierarchyEntity,
    organizationId: string,
    companyId: string | null,
    codes: string[],
  ): Promise<Set<string>> {
    const wanted = codes
      .map((code) => (code ?? '').trim())
      .filter((code) => code.length > 0);

    if (wanted.length === 0) return new Set();

    const select = { code: true } as const;
    let rows: { code: string | null }[] = [];

    switch (entity) {
      case HierarchyEntity.ACCOUNT_PLAN:
        rows = await this.prisma.financialAccountPlan.findMany({
          where: { organizationId, companyId, deletedAt: null },
          select,
        });
        break;
      case HierarchyEntity.CATEGORY:
        rows = await this.prisma.financialCategory.findMany({
          where: { companyId: companyId!, deletedAt: null },
          select,
        });
        break;
      case HierarchyEntity.COST_CENTER:
        rows = await this.prisma.costCenter.findMany({
          where: { companyId: companyId!, deletedAt: null },
          select,
        });
        break;
      case HierarchyEntity.RESULT_CENTER:
        rows = await this.prisma.resultCenter.findMany({
          where: { companyId: companyId!, deletedAt: null },
          select,
        });
        break;
      case HierarchyEntity.BUSINESS_UNIT:
        rows = await this.prisma.businessUnit.findMany({
          where: { organizationId, companyId, deletedAt: null },
          select,
        });
        break;
      default:
        rows = [];
    }

    return new Set(
      rows
        .map((row) => normalizeCode(row.code ?? ''))
        .filter((code) => code.length > 0),
    );
  }

  // ── Aplicação ─────────────────────────────────────────────────────────────

  private async applyRows(
    batch: {
      id: string;
      entity: HierarchyEntity;
      organizationId: string;
      companyId: string | null;
    },
    rows: { id: string; rowNumber: number; normalizedData: Prisma.JsonValue }[],
    mode: StructureImportMode,
    actor: RequestUser,
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    messages: string[];
  }> {
    const items = rows.map((row) => ({
      row,
      data: (row.normalizedData ?? {}) as unknown as NormalizedRow,
    }));

    // Ordena por profundidade do código ("1" antes de "1.1") para o pai existir antes do filho.
    const ordered = [...items].sort(
      (a, b) =>
        (a.data.code ?? '').split('.').length -
        (b.data.code ?? '').split('.').length,
    );

    const idByCode = new Map<string, string>();
    const messages: string[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const { row, data } of ordered) {
      const parentId = data.parentCode
        ? (idByCode.get(normalizeCode(data.parentCode)) ??
          (await this.findExistingId(batch, data.parentCode)))
        : null;

      if (data.parentCode && !parentId) {
        skipped += 1;
        messages.push(
          `Linha ${row.rowNumber}: registro superior "${data.parentCode}" não encontrado; linha ignorada.`,
        );
        continue;
      }

      const outcome = await this.upsertRow(
        batch,
        data,
        parentId,
        mode,
        actor,
        row.id,
      );

      if (outcome.id) idByCode.set(normalizeCode(data.code), outcome.id);
      if (outcome.result === 'created') created += 1;
      else if (outcome.result === 'updated') updated += 1;
      else {
        skipped += 1;
        if (outcome.message)
          messages.push(`Linha ${row.rowNumber}: ${outcome.message}`);
      }
    }

    return { created, updated, skipped, messages };
  }

  /** Id de um registro já cadastrado pelo código, para reaproveitar como pai. */
  private async findExistingId(
    batch: {
      entity: HierarchyEntity;
      organizationId: string;
      companyId: string | null;
    },
    code: string,
  ): Promise<string | null> {
    const { entity, organizationId, companyId } = batch;

    switch (entity) {
      case HierarchyEntity.ACCOUNT_PLAN: {
        const row = await this.prisma.financialAccountPlan.findFirst({
          where: { organizationId, companyId, code, deletedAt: null },
          select: { id: true },
        });
        return row?.id ?? null;
      }
      case HierarchyEntity.CATEGORY: {
        const row = await this.prisma.financialCategory.findFirst({
          where: { companyId: companyId!, code, deletedAt: null },
          select: { id: true },
        });
        return row?.id ?? null;
      }
      case HierarchyEntity.COST_CENTER: {
        const row = await this.prisma.costCenter.findFirst({
          where: { companyId: companyId!, code, deletedAt: null },
          select: { id: true },
        });
        return row?.id ?? null;
      }
      case HierarchyEntity.RESULT_CENTER: {
        const row = await this.prisma.resultCenter.findFirst({
          where: { companyId: companyId!, code, deletedAt: null },
          select: { id: true },
        });
        return row?.id ?? null;
      }
      case HierarchyEntity.BUSINESS_UNIT: {
        const row = await this.prisma.businessUnit.findFirst({
          where: { organizationId, companyId, code, deletedAt: null },
          select: { id: true },
        });
        return row?.id ?? null;
      }
      default:
        return null;
    }
  }

  private async upsertRow(
    batch: {
      entity: HierarchyEntity;
      organizationId: string;
      companyId: string | null;
    },
    data: NormalizedRow,
    parentId: string | null,
    mode: StructureImportMode,
    actor: RequestUser,
    importRowId: string,
  ): Promise<{
    id: string | null;
    result: 'created' | 'updated' | 'skipped';
    message?: string;
  }> {
    const simulate = mode === StructureImportMode.SIMULATE;
    const { entity, organizationId, companyId } = batch;

    const existingId = await this.findExistingId(batch, data.code);

    if (existingId) {
      if (mode === StructureImportMode.INSERT_ONLY) {
        return {
          id: existingId,
          result: 'skipped',
          message: `código "${data.code}" já cadastrado; mantido sem alteração.`,
        };
      }
      if (simulate) return { id: existingId, result: 'updated' };

      await this.updateExisting(entity, existingId, data, actor);
      await this.markRow(importRowId, entity, existingId);
      return { id: existingId, result: 'updated' };
    }

    if (mode === StructureImportMode.UPDATE_ONLY) {
      return {
        id: null,
        result: 'skipped',
        message: `código "${data.code}" não existe e o modo escolhido apenas atualiza.`,
      };
    }

    // A simulação devolve um id fictício para que os filhos encontrem o pai dentro do
    // arquivo — sem isso, a contagem simulada ficaria menor que a real.
    if (simulate) {
      return { id: `simulado:${normalizeCode(data.code)}`, result: 'created' };
    }

    const base = {
      code: data.code,
      normalizedCode: normalizeCode(data.code),
      name: data.name,
      notes: data.notes,
      path: data.name,
      level: Math.max(0, data.code.split('.').length - 1),
      createdBy: actor.id,
    };

    let createdId: string;

    switch (entity) {
      case HierarchyEntity.ACCOUNT_PLAN: {
        const row = await this.prisma.financialAccountPlan.create({
          data: {
            ...base,
            shortName: data.shortName,
            organizationId,
            companyId,
            parentAccountId: parentId,
            accountKind: AccountKind.ANALYTICAL,
          },
        });
        createdId = row.id;
        break;
      }
      case HierarchyEntity.CATEGORY: {
        const row = await this.prisma.financialCategory.create({
          data: { ...base, companyId: companyId!, parentCategoryId: parentId },
        });
        createdId = row.id;
        break;
      }
      case HierarchyEntity.COST_CENTER: {
        const row = await this.prisma.costCenter.create({
          data: {
            ...base,
            companyId: companyId!,
            parentCostCenterId: parentId,
          },
        });
        createdId = row.id;
        break;
      }
      case HierarchyEntity.RESULT_CENTER: {
        const row = await this.prisma.resultCenter.create({
          data: {
            ...base,
            companyId: companyId!,
            parentResultCenterId: parentId,
          },
        });
        createdId = row.id;
        break;
      }
      case HierarchyEntity.BUSINESS_UNIT: {
        const row = await this.prisma.businessUnit.create({
          data: {
            ...base,
            organizationId,
            companyId,
            parentBusinessUnitId: parentId,
          },
        });
        createdId = row.id;
        break;
      }
      default:
        throw new BadRequestException(
          'Importação não suportada para esta entidade.',
        );
    }

    await this.markRow(importRowId, entity, createdId);
    return { id: createdId, result: 'created' };
  }

  private async updateExisting(
    entity: HierarchyEntity,
    id: string,
    data: NormalizedRow,
    actor: RequestUser,
  ) {
    // A atualização toca apenas em nome, nome curto e observações: código e posição na
    // árvore não são sobrescritos por importação.
    const patch = {
      name: data.name,
      notes: data.notes,
      updatedBy: actor.id,
    };

    switch (entity) {
      case HierarchyEntity.ACCOUNT_PLAN:
        await this.prisma.financialAccountPlan.update({
          where: { id },
          data: { ...patch, shortName: data.shortName },
        });
        break;
      case HierarchyEntity.CATEGORY:
        await this.prisma.financialCategory.update({
          where: { id },
          data: patch,
        });
        break;
      case HierarchyEntity.COST_CENTER:
        await this.prisma.costCenter.update({ where: { id }, data: patch });
        break;
      case HierarchyEntity.RESULT_CENTER:
        await this.prisma.resultCenter.update({ where: { id }, data: patch });
        break;
      case HierarchyEntity.BUSINESS_UNIT:
        await this.prisma.businessUnit.update({ where: { id }, data: patch });
        break;
      default:
        break;
    }
  }

  /** Liga a linha do arquivo ao registro criado/atualizado, para rastrear a origem. */
  private markRow(
    importRowId: string,
    entity: HierarchyEntity,
    entityId: string,
  ) {
    return this.prisma.financialStructureImportRow.update({
      where: { id: importRowId },
      data: { createdEntityType: entity, createdEntityId: entityId },
    });
  }

  // ── Exportação ────────────────────────────────────────────────────────────

  async export(
    query: ExportStructureQueryDto | ExportStructureFullQueryDto,
    actor: RequestUser,
  ) {
    const rows = await this.loadExportRows(query);
    const format = (query.format ?? 'csv') as string;

    await this.audit.log({
      organizationId: query.organizationId,
      companyId: query.companyId ?? null,
      userId: actor.id,
      action: 'EXPORT',
      entity: 'FinancialStructure',
      newValue: { entity: query.entity, format, rows: rows.length },
    });

    const fileBase = `${query.entity.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}`;

    if (format === 'json') {
      return { format: 'json' as const, entity: query.entity, rows };
    }

    if (format === 'xlsx') {
      const buffer = await this.toXlsx(rows, ENTITY_LABELS[query.entity]);
      return {
        format: 'xlsx' as const,
        entity: query.entity,
        fileName: `${fileBase}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: buffer.toString('base64'),
      };
    }

    if (format === 'pdf') {
      const buffer = this.toPdf(rows, ENTITY_LABELS[query.entity]);
      return {
        format: 'pdf' as const,
        entity: query.entity,
        fileName: `${fileBase}.pdf`,
        contentType: 'application/pdf',
        base64: buffer.toString('base64'),
      };
    }

    return {
      format: 'csv' as const,
      entity: query.entity,
      fileName: `${fileBase}.csv`,
      content: this.toCsv(rows),
    };
  }

  private async loadExportRows(
    query: ExportStructureQueryDto | ExportStructureFullQueryDto,
  ): Promise<Record<string, string>[]> {
    const includeInactive =
      'includeInactive' in query ? query.includeInactive === true : false;
    // Sem `includeInactive`, exporta apenas o que está ativo.
    const activeOnly = includeInactive
      ? {}
      : { structureStatus: 'ACTIVE' as const };

    const toRow = (item: {
      code: string | null;
      name: string;
      parentCode?: string | null;
      level: number;
      path: string | null;
      structureStatus?: string;
    }) => ({
      codigo: item.code ?? '',
      nome: item.name,
      codigo_pai: item.parentCode ?? '',
      nivel: String(item.level),
      caminho: item.path ?? '',
      situacao: item.structureStatus ?? '',
    });

    switch (query.entity) {
      case HierarchyEntity.ACCOUNT_PLAN: {
        const rows = await this.prisma.financialAccountPlan.findMany({
          where: {
            organizationId: query.organizationId,
            deletedAt: null,
            ...activeOnly,
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
        const rows = await this.prisma.financialCategory.findMany({
          where: { companyId: query.companyId, deletedAt: null, ...activeOnly },
          include: { parentCategory: { select: { code: true } } },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentCategory?.code ?? null }),
        );
      }
      case HierarchyEntity.COST_CENTER: {
        const rows = await this.prisma.costCenter.findMany({
          where: { companyId: query.companyId, deletedAt: null, ...activeOnly },
          include: { parentCostCenter: { select: { code: true } } },
          orderBy: { name: 'asc' },
        });
        return rows.map((r) =>
          toRow({ ...r, parentCode: r.parentCostCenter?.code ?? null }),
        );
      }
      case HierarchyEntity.RESULT_CENTER: {
        const rows = await this.prisma.resultCenter.findMany({
          where: { companyId: query.companyId, deletedAt: null, ...activeOnly },
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
            ...activeOnly,
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

  private async toXlsx(
    rows: Record<string, string>[],
    sheetName: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Estrutura');

    if (rows.length > 0) {
      const header = Object.keys(rows[0]);
      sheet.columns = header.map((key) => ({
        header: key.replace(/_/g, ' '),
        key,
        width: Math.max(14, key.length + 4),
      }));
      sheet.getRow(1).font = { bold: true };
      for (const row of rows) sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * PDF tabular mínimo, gerado sem dependência externa: uma página com fonte
   * monoespaçada, suficiente para conferência e impressão.
   */
  private toPdf(rows: Record<string, string>[], title: string): Buffer {
    const header = rows.length > 0 ? Object.keys(rows[0]) : [];
    const lines: string[] = [
      `Estrutura financeira — ${title}`,
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${rows.length} registro(s)`,
      '',
      header.map((key) => key.replace(/_/g, ' ').toUpperCase()).join('  |  '),
    ];

    for (const row of rows) {
      lines.push(header.map((key) => row[key] ?? '').join('  |  '));
    }

    const escapePdfText = (text: string) =>
      text.replace(/([\\()])/g, '\\$1').replace(/[^\x20-\x7E]/g, '?');

    // Cada linha é um `Td` de 14pt para baixo dentro do mesmo bloco de texto.
    const content = [
      'BT',
      '/F1 9 Tf',
      '40 800 Td',
      '14 TL',
      ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      'ET',
    ].join('\n');

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
  }
}
