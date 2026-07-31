import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StructureStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { DeactivateStructureDto } from './dto/lifecycle.dto';

/** Cadastros da estrutura financeira que compartilham o ciclo de vida da seção 70. */
export type StructureModelKey =
  | 'financialAccountPlan'
  | 'financialCategory'
  | 'costCenter'
  | 'resultCenter'
  | 'project'
  | 'businessUnit'
  | 'financialNatureCatalog'
  | 'financialTag'
  | 'allocationRule'
  | 'classificationRule';

interface UsageRelation {
  /** Nome da relação no Prisma, usada em `_count`. */
  relation: string;
  /** Rótulo exibido ao usuário. */
  label: string;
}

interface StructureModelDescriptor {
  /** Nome da entidade no log de auditoria. */
  entity: string;
  /** Como o registro é chamado nas mensagens ("A conta", "O centro de custo"). */
  article: string;
  friendlyName: string;
  /** Relação dos filhos diretos, quando o cadastro é hierárquico. */
  childrenRelation?: string;
  /** Relação do pai, para impedir ativar um filho sob um pai inativo. */
  parentRelation?: string;
  /** Vínculos contados em `usage`. */
  usage: UsageRelation[];
  /**
   * Nome do campo `RecordStatus` do modelo. O projeto guarda o ciclo operacional em
   * `status` (`ProjectStatus`) e o ativo/inativo em `recordStatus`, por isso o nome é
   * configurável — escrever no campo errado apagaria o andamento do projeto.
   */
  recordStatusField?: string;
}

const MODELS: Record<StructureModelKey, StructureModelDescriptor> = {
  financialAccountPlan: {
    entity: 'FinancialAccountPlan',
    article: 'A',
    friendlyName: 'conta do plano de contas',
    childrenRelation: 'children',
    parentRelation: 'parentAccount',
    usage: [
      { relation: 'categories', label: 'Categorias vinculadas' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
      { relation: 'allocationLines', label: 'Linhas de rateio' },
      { relation: 'ruleActions', label: 'Ações de regras' },
      { relation: 'children', label: 'Contas filhas' },
    ],
  },
  financialCategory: {
    entity: 'FinancialCategory',
    article: 'A',
    friendlyName: 'categoria financeira',
    childrenRelation: 'subcategories',
    parentRelation: 'parentCategory',
    usage: [
      { relation: 'subcategories', label: 'Subcategorias' },
      {
        relation: 'defaultForLinks',
        label: 'Fornecedores que a usam como padrão',
      },
      {
        relation: 'defaultRevenueForLinks',
        label: 'Clientes que a usam como padrão',
      },
      { relation: 'defaultForContracts', label: 'Contratos' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
      { relation: 'allocationLines', label: 'Linhas de rateio' },
      { relation: 'ruleActionsAsCategory', label: 'Ações de regras' },
    ],
  },
  costCenter: {
    entity: 'CostCenter',
    article: 'O',
    friendlyName: 'centro de custo',
    childrenRelation: 'children',
    parentRelation: 'parentCostCenter',
    usage: [
      { relation: 'children', label: 'Centros filhos' },
      { relation: 'links', label: 'Fornecedores vinculados' },
      { relation: 'customerLinks', label: 'Clientes vinculados' },
      { relation: 'contracts', label: 'Contratos' },
      { relation: 'projects', label: 'Projetos' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
      { relation: 'allocationLines', label: 'Linhas de rateio' },
    ],
  },
  resultCenter: {
    entity: 'ResultCenter',
    article: 'O',
    friendlyName: 'centro de resultado',
    childrenRelation: 'children',
    parentRelation: 'parentResultCenter',
    usage: [
      { relation: 'children', label: 'Centros filhos' },
      { relation: 'projects', label: 'Projetos' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
      { relation: 'allocationLines', label: 'Linhas de rateio' },
      {
        relation: 'defaultForCategories',
        label: 'Categorias que o usam como padrão',
      },
    ],
  },
  project: {
    entity: 'Project',
    article: 'O',
    friendlyName: 'projeto',
    childrenRelation: 'childProjects',
    parentRelation: 'parentProject',
    recordStatusField: 'recordStatus',
    usage: [
      { relation: 'childProjects', label: 'Subprojetos' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
      { relation: 'allocationLines', label: 'Linhas de rateio' },
      {
        relation: 'defaultForCategories',
        label: 'Categorias que o usam como padrão',
      },
    ],
  },
  businessUnit: {
    entity: 'BusinessUnit',
    article: 'A',
    friendlyName: 'unidade de negócio',
    childrenRelation: 'children',
    parentRelation: 'parentBusinessUnit',
    usage: [
      { relation: 'children', label: 'Unidades filhas' },
      { relation: 'costCenters', label: 'Centros de custo' },
      { relation: 'resultCenters', label: 'Centros de resultado' },
      { relation: 'projects', label: 'Projetos' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
    ],
  },
  financialNatureCatalog: {
    entity: 'FinancialNatureCatalog',
    article: 'A',
    friendlyName: 'natureza financeira',
    usage: [
      { relation: 'categories', label: 'Categorias' },
      { relation: 'accountPlans', label: 'Contas do plano' },
      { relation: 'classificationRules', label: 'Regras de classificação' },
    ],
  },
  financialTag: {
    entity: 'FinancialTag',
    article: 'A',
    friendlyName: 'tag',
    usage: [
      { relation: 'links', label: 'Registros marcados' },
      { relation: 'ruleActions', label: 'Ações de regras' },
    ],
  },
  allocationRule: {
    entity: 'AllocationRule',
    article: 'A',
    friendlyName: 'regra de rateio',
    usage: [
      { relation: 'items', label: 'Linhas do rateio' },
      {
        relation: 'defaultForCategories',
        label: 'Categorias que a usam como padrão',
      },
      { relation: 'classificationRules', label: 'Regras de classificação' },
    ],
  },
  classificationRule: {
    entity: 'ClassificationRule',
    article: 'A',
    friendlyName: 'regra de classificação',
    usage: [
      { relation: 'conditions', label: 'Condições' },
      { relation: 'actions', label: 'Ações' },
    ],
  },
};

/**
 * Ativação, inativação, arquivamento e consulta de uso dos cadastros da estrutura
 * financeira (seção 70).
 *
 * Nada é excluído aqui: inativar e arquivar apenas mudam o `structureStatus`, de modo
 * que os lançamentos e o histórico que já apontam para o registro continuem íntegros.
 */
@Injectable()
export class StructureLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private delegate(model: StructureModelKey) {
    // O acesso dinâmico é intencional: o descritor é que define o modelo.
    return this.prisma[model] as unknown as {
      findFirst: (args: unknown) => Promise<Record<string, any> | null>;
      update: (args: unknown) => Promise<Record<string, any>>;
    };
  }

  private countSelect(descriptor: StructureModelDescriptor) {
    return Object.fromEntries(
      descriptor.usage.map((relation) => [relation.relation, true]),
    );
  }

  private async load(model: StructureModelKey, id: string) {
    const descriptor = MODELS[model];

    const record = await this.delegate(model).findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: this.countSelect(descriptor) },
        ...(descriptor.parentRelation
          ? {
              [descriptor.parentRelation]: {
                select: { id: true, name: true, structureStatus: true },
              },
            }
          : {}),
      },
    });

    if (!record) {
      throw new NotFoundException(
        `${descriptor.article} ${descriptor.friendlyName} não foi encontrada.`,
      );
    }

    return { descriptor, record };
  }

  /**
   * Organização e empresa do registro, para que o controller valide a permissão **antes**
   * de qualquer alteração. O isolamento é sempre resolvido no back-end.
   */
  async scopeOf(model: StructureModelKey, id: string) {
    const descriptor = MODELS[model];

    const record = await this.delegate(model).findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true },
    });

    if (!record) {
      throw new NotFoundException(
        `${descriptor.article} ${descriptor.friendlyName} não foi encontrada.`,
      );
    }

    return {
      organizationId: record.organizationId as string,
      companyId: (record.companyId as string | null) ?? null,
    };
  }

  /**
   * Vínculos do registro. O front-end usa isso para explicar por que um registro não
   * pode ser excluído e oferecer a inativação no lugar.
   */
  async usage(model: StructureModelKey, id: string) {
    const { descriptor, record } = await this.load(model, id);

    const counts = (record._count ?? {}) as Record<string, number>;

    const relations = descriptor.usage.map((relation) => ({
      relation: relation.relation,
      label: relation.label,
      count: Number(counts[relation.relation] ?? 0),
    }));

    const total = relations.reduce((sum, item) => sum + item.count, 0);

    return {
      id,
      entity: descriptor.entity,
      structureStatus: record.structureStatus as StructureStatus,
      inUse: total > 0,
      // Registro em uso não é excluído: a exclusão apagaria a referência de
      // lançamentos e relatórios já existentes.
      canDelete: total === 0 && record.isSystem !== true,
      total,
      relations,
    };
  }

  async activate(model: StructureModelKey, id: string, actor: RequestUser) {
    const { descriptor, record } = await this.load(model, id);

    if (record.structureStatus === StructureStatus.ACTIVE) {
      throw new ConflictException(
        `${descriptor.article} ${descriptor.friendlyName} já está ativa.`,
      );
    }

    // Um registro ativo dentro de um pai inativo não apareceria nas árvores e
    // relatórios: o pai filtra a subárvore inteira.
    const parent = descriptor.parentRelation
      ? (record[descriptor.parentRelation] as {
          name: string;
          structureStatus: StructureStatus;
        } | null)
      : null;

    if (parent && parent.structureStatus !== StructureStatus.ACTIVE) {
      throw new ConflictException(
        `Não é possível ativar: o registro superior "${parent.name}" está inativo. Ative-o primeiro.`,
      );
    }

    return this.applyStatus(
      model,
      id,
      descriptor,
      StructureStatus.ACTIVE,
      'ACTIVATE',
      record,
      actor,
    );
  }

  async deactivate(
    model: StructureModelKey,
    id: string,
    dto: DeactivateStructureDto,
    actor: RequestUser,
  ) {
    const { descriptor, record } = await this.load(model, id);

    if (record.structureStatus === StructureStatus.INACTIVE) {
      throw new ConflictException(
        `${descriptor.article} ${descriptor.friendlyName} já está inativa.`,
      );
    }

    await this.assertNoActiveChildren(model, id, descriptor);

    return this.applyStatus(
      model,
      id,
      descriptor,
      StructureStatus.INACTIVE,
      'DEACTIVATE',
      record,
      actor,
      dto.reason,
    );
  }

  /**
   * Arquiva o registro: ele sai das listagens e dos seletores, mas continua
   * consultável e íntegro para os lançamentos históricos.
   */
  async archive(
    model: StructureModelKey,
    id: string,
    dto: DeactivateStructureDto,
    actor: RequestUser,
  ) {
    const { descriptor, record } = await this.load(model, id);

    if (record.structureStatus === StructureStatus.ARCHIVED) {
      throw new ConflictException(
        `${descriptor.article} ${descriptor.friendlyName} já está arquivada.`,
      );
    }

    await this.assertNoActiveChildren(model, id, descriptor);

    return this.applyStatus(
      model,
      id,
      descriptor,
      StructureStatus.ARCHIVED,
      'ARCHIVE',
      record,
      actor,
      dto.reason,
    );
  }

  private async assertNoActiveChildren(
    model: StructureModelKey,
    id: string,
    descriptor: StructureModelDescriptor,
  ) {
    if (!descriptor.childrenRelation) return;

    const parentField = this.parentFieldFor(model);
    if (!parentField) return;

    const activeChildren = await (
      this.prisma[model] as unknown as {
        count: (args: unknown) => Promise<number>;
      }
    ).count({
      where: {
        [parentField]: id,
        deletedAt: null,
        structureStatus: StructureStatus.ACTIVE,
      },
    });

    if (activeChildren > 0) {
      throw new ConflictException(
        `Existem ${activeChildren} registro(s) ativo(s) abaixo deste. Inative-os primeiro para não deixá-los órfãos em uma subárvore inativa.`,
      );
    }
  }

  private parentFieldFor(model: StructureModelKey): string | null {
    const fields: Partial<Record<StructureModelKey, string>> = {
      financialAccountPlan: 'parentAccountId',
      financialCategory: 'parentCategoryId',
      costCenter: 'parentCostCenterId',
      resultCenter: 'parentResultCenterId',
      project: 'parentProjectId',
      businessUnit: 'parentBusinessUnitId',
    };
    return fields[model] ?? null;
  }

  private async applyStatus(
    model: StructureModelKey,
    id: string,
    descriptor: StructureModelDescriptor,
    structureStatus: StructureStatus,
    action: string,
    previous: Record<string, unknown>,
    actor: RequestUser,
    reason?: string,
  ) {
    const updated = await this.delegate(model).update({
      where: { id },
      data: {
        structureStatus,
        // O ativo/inativo acompanha o `structureStatus`, mas nunca escreve no campo de
        // ciclo operacional: o `status` do projeto guarda o andamento, não a vigência.
        [descriptor.recordStatusField ?? 'status']:
          structureStatus === StructureStatus.ACTIVE ? 'ACTIVE' : 'INACTIVE',
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: previous.organizationId as string,
      companyId: (previous.companyId as string | null) ?? null,
      userId: actor.id,
      action,
      entity: descriptor.entity,
      entityId: id,
      field: 'structureStatus',
      oldValue: { structureStatus: previous.structureStatus as string },
      newValue: { structureStatus },
      reason,
    });

    return updated;
  }
}
