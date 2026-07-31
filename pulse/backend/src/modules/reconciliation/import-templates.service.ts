import { BadRequestException, Injectable } from '@nestjs/common';
import { BankStatementSourceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import type {
  ImportTemplateDto,
  TemplateQueryDto,
} from './dto/reconciliation.dto';
import type {
  ColumnMapping,
  MappableField,
  SignRule,
} from './parsers/tabular-import.service';

/** Formatos tabulares. OFX traz a estrutura no próprio arquivo e não precisa de modelo. */
const TABULAR_TYPES: BankStatementSourceType[] = [
  BankStatementSourceType.CSV,
  BankStatementSourceType.XLSX,
];

/** Campos que um modelo precisa mapear para produzir uma transação utilizável. */
const REQUIRED_FIELDS: MappableField[] = ['transactionDate', 'description'];

const SIGN_RULES = ['CREDIT_DEBIT_COLUMNS', 'SIGNED_AMOUNT', 'TYPE_COLUMN'];

/**
 * Modelos de importação (seção 13).
 *
 * Cada banco exporta a planilha do seu jeito, e reconfigurar o mapeamento a cada importação
 * é onde o erro entra: alguém troca a coluna de crédito pela de débito e o extrato inteiro
 * inverte. O modelo salva a configuração validada uma vez e a reaplica.
 */
@Injectable()
export class ImportTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: TemplateQueryDto) {
    const where: Prisma.BankStatementImportTemplateWhereInput = {
      deletedAt: null,
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      // Modelo sem empresa é da organização inteira; filtrar por empresa precisa trazer os
      // dois, senão os modelos compartilhados somem justamente de quem os usaria.
      ...(query.companyId
        ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
        : {}),
      ...(query.bankCode ? { bankCode: query.bankCode } : {}),
      ...(query.fileType ? { fileType: query.fileType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.bankStatementImportTemplate.findMany({
        where,
        include: {
          financialAccount: {
            select: { id: true, name: true, displayName: true },
          },
          _count: { select: { imports: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.bankStatementImportTemplate.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    return this.prisma.bankStatementImportTemplate.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        financialAccount: {
          select: { id: true, name: true, displayName: true },
        },
        imports: {
          where: { deletedAt: null },
          select: {
            id: true,
            originalFileName: true,
            importedAt: true,
            status: true,
          },
          orderBy: { importedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(dto: ImportTemplateDto, actor: RequestActor) {
    this.validate(dto);

    const created = await this.prisma.bankStatementImportTemplate.create({
      data: {
        ...this.dataOf(dto),
        createdBy: actor.id,
      },
    });

    if (dto.isDefault) await this.clearOtherDefaults(created.id, created);

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'reconciliation.import_template_created',
      entity: 'BankStatementImportTemplate',
      entityId: created.id,
      newValue: {
        name: dto.name,
        fileType: dto.fileType,
        bankCode: dto.bankCode,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return created;
  }

  async update(id: string, dto: ImportTemplateDto, actor: RequestActor) {
    const before =
      await this.prisma.bankStatementImportTemplate.findFirstOrThrow({
        where: { id, deletedAt: null },
      });

    this.validate(dto);

    const updated = await this.prisma.bankStatementImportTemplate.update({
      where: { id },
      data: { ...this.dataOf(dto), updatedBy: actor.id },
    });

    if (dto.isDefault) await this.clearOtherDefaults(id, updated);

    await this.audit.log({
      organizationId: before.organizationId,
      companyId: before.companyId,
      userId: actor.id,
      action: 'reconciliation.import_template_updated',
      entity: 'BankStatementImportTemplate',
      entityId: id,
      oldValue: {
        name: before.name,
        columnMapping: before.columnMapping,
        signRule: before.signRule,
      },
      newValue: {
        name: dto.name,
        columnMapping: dto.columnMapping as unknown as Prisma.InputJsonValue,
        signRule: dto.signRule as unknown as Prisma.InputJsonValue,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /**
   * Arquiva o modelo.
   *
   * Soft delete e não remoção: as importações já feitas apontam para ele, e apagar deixaria
   * o histórico sem explicar como aquele arquivo foi lido.
   */
  async remove(id: string, actor: RequestActor) {
    const template =
      await this.prisma.bankStatementImportTemplate.findFirstOrThrow({
        where: { id, deletedAt: null },
      });

    const removed = await this.prisma.bankStatementImportTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, isDefault: false },
    });

    await this.audit.log({
      organizationId: template.organizationId,
      companyId: template.companyId,
      userId: actor.id,
      action: 'reconciliation.import_template_removed',
      entity: 'BankStatementImportTemplate',
      entityId: id,
      oldValue: { name: template.name },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return removed;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /**
   * Recusa o modelo que não produziria uma transação válida.
   *
   * A validação é aqui e não na tela: um modelo salvo errado só falha na importação
   * seguinte, quando ninguém mais lembra o que foi configurado.
   */
  private validate(dto: ImportTemplateDto) {
    if (!TABULAR_TYPES.includes(dto.fileType)) {
      throw new BadRequestException(
        'Modelos de importação valem para arquivos tabulares (CSV, TXT, XLS, XLSX). OFX traz a estrutura no próprio arquivo.',
      );
    }

    const mapping = dto.columnMapping as ColumnMapping;

    for (const field of REQUIRED_FIELDS) {
      if (mapping[field] === undefined || mapping[field] === null) {
        throw new BadRequestException(
          `O mapeamento precisa indicar a coluna de "${field}".`,
        );
      }
    }

    const rule = dto.signRule as unknown as SignRule;

    if (!rule || !SIGN_RULES.includes(rule.kind)) {
      throw new BadRequestException(
        `Informe como o sinal é determinado: ${SIGN_RULES.join(', ')}.`,
      );
    }

    // Nunca assumir o sinal (seção 21): cada modo exige a coluna que o sustenta, e sem ela
    // o parser teria de adivinhar se um valor é entrada ou saída.
    if (rule.kind === 'CREDIT_DEBIT_COLUMNS') {
      if (mapping.credit === undefined && mapping.debit === undefined) {
        throw new BadRequestException(
          'Com colunas separadas, mapeie ao menos uma entre "credit" e "debit".',
        );
      }
    } else if (mapping.amount === undefined) {
      throw new BadRequestException(
        'Mapeie a coluna "amount" com o valor da movimentação.',
      );
    }

    if (rule.kind === 'TYPE_COLUMN') {
      if (mapping.type === undefined) {
        throw new BadRequestException(
          'Com coluna de tipo, mapeie "type" e informe os textos de crédito e débito.',
        );
      }

      if (!rule.creditValues?.length && !rule.debitValues?.length) {
        throw new BadRequestException(
          'Informe quais textos da coluna de tipo significam crédito e quais significam débito.',
        );
      }
    }
  }

  private dataOf(dto: ImportTemplateDto) {
    return {
      organizationId: dto.organizationId,
      companyId: dto.companyId ?? null,
      financialAccountId: dto.financialAccountId ?? null,
      name: dto.name,
      bankCode: dto.bankCode ?? null,
      fileType: dto.fileType,
      delimiter: dto.delimiter ?? null,
      encoding: dto.encoding ?? null,
      dateFormat: dto.dateFormat ?? null,
      decimalSeparator: dto.decimalSeparator ?? null,
      thousandSeparator: dto.thousandSeparator ?? null,
      headerRow: dto.headerRow ?? null,
      dataStartRow: dto.dataStartRow ?? null,
      footerRowsToIgnore: dto.footerRowsToIgnore ?? 0,
      columnMapping: dto.columnMapping as unknown as Prisma.InputJsonValue,
      signRule: dto.signRule as unknown as Prisma.InputJsonValue,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
    };
  }

  /** Só um padrão por conta (ou por banco, quando o modelo não é de uma conta). */
  private async clearOtherDefaults(
    id: string,
    template: {
      organizationId: string;
      financialAccountId: string | null;
      bankCode: string | null;
    },
  ) {
    await this.prisma.bankStatementImportTemplate.updateMany({
      where: {
        id: { not: id },
        organizationId: template.organizationId,
        deletedAt: null,
        isDefault: true,
        ...(template.financialAccountId
          ? { financialAccountId: template.financialAccountId }
          : { bankCode: template.bankCode }),
      },
      data: { isDefault: false },
    });
  }
}
