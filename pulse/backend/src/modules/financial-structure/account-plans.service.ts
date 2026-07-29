import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountKind,
  FinancialAccountPlan,
  HierarchyEntity,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  CreateAccountPlanDto,
  UpdateAccountPlanDto,
} from './dto/account-plan.dto';
import {
  DuplicateNodeDto,
  MoveNodeDto,
  StructureQueryDto,
} from './dto/common.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import {
  assertNoCycle,
  buildTree,
  collectSubtreeIds,
  computeLevelAndPath,
} from './utils/tree.util';

@Injectable()
export class AccountPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  /** Escopo: contas da organização (companyId nulo) + contas exclusivas da empresa. */
  private scopeWhere(
    organizationId: string,
    companyId?: string,
    includeInactive = false,
  ): Prisma.FinancialAccountPlanWhereInput {
    return {
      organizationId,
      deletedAt: null,
      ...(includeInactive ? {} : { status: RecordStatus.ACTIVE }),
      ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
    };
  }

  async findAll(query: StructureQueryDto & { organizationId: string }) {
    return this.prisma.financialAccountPlan.findMany({
      where: {
        ...this.scopeWhere(
          query.organizationId,
          query.companyId,
          query.includeInactive,
        ),
        ...(query.parentId ? { parentAccountId: query.parentId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ code: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  /** Retorna a árvore completa já aninhada, pronta para renderização. */
  async findTree(
    organizationId: string,
    companyId?: string,
    includeInactive = false,
  ) {
    const accounts = await this.prisma.financialAccountPlan.findMany({
      where: this.scopeWhere(organizationId, companyId, includeInactive),
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return buildTree(
      accounts,
      (a) => a.id,
      (a) => a.parentAccountId,
    );
  }

  async findOne(id: string) {
    const account = await this.prisma.financialAccountPlan.findFirst({
      where: { id, deletedAt: null },
      include: {
        parentAccount: { select: { id: true, code: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true, accountKind: true },
          orderBy: { code: 'asc' },
        },
        financialNature: { select: { id: true, name: true, kind: true } },
        tagLinks: { include: { tag: true } },
      },
    });

    if (!account) throw new NotFoundException('Conta não encontrada.');
    return account;
  }

  async create(dto: CreateAccountPlanDto, actor: RequestUser) {
    const parent = await this.resolveParent(
      dto.parentAccountId,
      dto.organizationId,
    );
    const { level, path } = await this.resolveLevelAndPath(
      dto.parentAccountId ?? null,
      dto.organizationId,
      dto.name,
    );

    const accountKind = dto.accountKind ?? AccountKind.ANALYTICAL;

    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const created = await tx.financialAccountPlan.create({
          data: {
            organizationId: dto.organizationId,
            companyId: dto.companyId ?? null,
            parentAccountId: dto.parentAccountId ?? null,
            code: dto.code.trim(),
            name: dto.name.trim(),
            description: dto.description,
            accountType: dto.accountType,
            accountKind,
            financialNatureId: dto.financialNatureId,
            // Contas sintéticas nunca aceitam lançamentos, independentemente do payload.
            acceptsEntries:
              accountKind === AccountKind.SYNTHETIC
                ? false
                : (dto.acceptsEntries ?? true),
            color: dto.color,
            icon: dto.icon,
            sortOrder: dto.sortOrder ?? 0,
            notes: dto.notes,
            status: dto.status,
            level,
            path,
            createdBy: actor.id,
          },
        });

        // Um pai deixa de ser folha: passa a sintético e para de aceitar lançamentos.
        if (parent && parent.accountKind !== AccountKind.SYNTHETIC) {
          await tx.financialAccountPlan.update({
            where: { id: parent.id },
            data: { accountKind: AccountKind.SYNTHETIC, acceptsEntries: false },
          });
        }

        return created;
      });

      await this.audit.log({
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        userId: actor.id,
        action: 'CREATE',
        entity: 'FinancialAccountPlan',
        entityId: account.id,
        newValue: { code: account.code, name: account.name },
      });

      return account;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateAccountPlanDto, actor: RequestUser) {
    const current = await this.findOne(id);

    const nextKind = dto.accountKind ?? current.accountKind;
    const data: Prisma.FinancialAccountPlanUpdateInput = {
      code: dto.code?.trim(),
      name: dto.name?.trim(),
      description: dto.description,
      accountType: dto.accountType,
      accountKind: dto.accountKind,
      acceptsEntries:
        nextKind === AccountKind.SYNTHETIC ? false : dto.acceptsEntries,
      color: dto.color,
      icon: dto.icon,
      sortOrder: dto.sortOrder,
      notes: dto.notes,
      status: dto.status,
      updatedBy: actor.id,
      ...(dto.financialNatureId !== undefined
        ? {
            financialNature: dto.financialNatureId
              ? { connect: { id: dto.financialNatureId } }
              : { disconnect: true },
          }
        : {}),
    };

    try {
      const account = await this.prisma.financialAccountPlan.update({
        where: { id },
        data,
      });

      // Renomear a conta muda o caminho materializado de toda a subárvore.
      if (dto.name && dto.name.trim() !== current.name) {
        await this.recalculateSubtree(id, current.organizationId);
      }

      await this.audit.log({
        organizationId: current.organizationId,
        companyId: current.companyId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'FinancialAccountPlan',
        entityId: id,
        oldValue: { code: current.code, name: current.name },
        newValue: { code: account.code, name: account.name },
      });

      return account;
    } catch (error) {
      this.rethrowDuplicateCode(error);
      throw error;
    }
  }

  /** Move a conta para outro pai, versionando a árvore antes da alteração. */
  async move(id: string, dto: MoveNodeDto, actor: RequestUser) {
    const current = await this.findOne(id);
    const newParentId = dto.parentId ?? null;

    const siblings = await this.prisma.financialAccountPlan.findMany({
      where: { organizationId: current.organizationId, deletedAt: null },
      select: { id: true, parentAccountId: true },
    });

    assertNoCycle(
      id,
      newParentId,
      new Map(siblings.map((s) => [s.id, s.parentAccountId])),
      'Não é possível mover uma conta para dentro dela mesma ou de uma conta filha.',
    );

    if (newParentId) {
      const parent = await this.resolveParent(
        newParentId,
        current.organizationId,
      );
      if (parent && parent.accountKind !== AccountKind.SYNTHETIC) {
        await this.prisma.financialAccountPlan.update({
          where: { id: parent.id },
          data: { accountKind: AccountKind.SYNTHETIC, acceptsEntries: false },
        });
      }
    }

    await this.versions.snapshot({
      organizationId: current.organizationId,
      companyId: current.companyId,
      entity: HierarchyEntity.ACCOUNT_PLAN,
      reason: dto.reason ?? 'Movimentação de conta na árvore',
      actorId: actor.id,
    });

    const updated = await this.prisma.financialAccountPlan.update({
      where: { id },
      data: {
        parentAccountId: newParentId,
        sortOrder: dto.sortOrder ?? current.sortOrder,
        updatedBy: actor.id,
      },
    });

    await this.recalculateSubtree(id, current.organizationId);

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'MOVE',
      entity: 'FinancialAccountPlan',
      entityId: id,
      field: 'parentAccountId',
      oldValue: { parentAccountId: current.parentAccountId },
      newValue: { parentAccountId: newParentId },
      reason: dto.reason,
    });

    return updated;
  }

  async duplicate(id: string, dto: DuplicateNodeDto, actor: RequestUser) {
    const source = await this.findOne(id);

    const created = await this.prisma.financialAccountPlan.create({
      data: {
        organizationId: source.organizationId,
        companyId: dto.targetCompanyId ?? source.companyId,
        parentAccountId: source.parentAccountId,
        code: dto.code?.trim() ?? `${source.code}-COPIA`,
        name: dto.name?.trim() ?? `${source.name} (cópia)`,
        description: source.description,
        accountType: source.accountType,
        accountKind: source.accountKind,
        financialNatureId: source.financialNatureId,
        acceptsEntries: source.acceptsEntries,
        color: source.color,
        icon: source.icon,
        sortOrder: source.sortOrder,
        notes: source.notes,
        level: source.level,
        path: source.path,
        createdBy: actor.id,
      },
    });

    if (dto.includeChildren) {
      await this.duplicateChildren(id, created.id, actor);
      await this.recalculateSubtree(created.id, source.organizationId);
    }

    await this.audit.log({
      organizationId: source.organizationId,
      companyId: created.companyId,
      userId: actor.id,
      action: 'DUPLICATE',
      entity: 'FinancialAccountPlan',
      entityId: created.id,
      oldValue: { sourceId: id },
      newValue: {
        code: created.code,
        includeChildren: Boolean(dto.includeChildren),
      },
    });

    return created;
  }

  /**
   * Exclusão lógica. Bloqueada para contas de sistema, contas com filhos ativos e
   * contas já referenciadas por categorias ou regras de classificação.
   */
  async remove(id: string, actor: RequestUser) {
    const account = await this.findOne(id);

    if (account.isSystem) {
      throw new ConflictException(
        'Esta é uma conta padrão do sistema e não pode ser excluída.',
      );
    }

    const activeChildren = account.children.length;
    if (activeChildren > 0) {
      throw new ConflictException(
        'Esta conta possui contas filhas e não pode ser excluída. Exclua ou mova as contas filhas primeiro.',
      );
    }

    const [categories, rules] = await Promise.all([
      this.prisma.category.count({
        where: { accountPlanId: id, deletedAt: null },
      }),
      this.prisma.classificationRule.count({
        where: { accountPlanId: id, deletedAt: null },
      }),
    ]);

    if (categories > 0 || rules > 0) {
      throw new ConflictException(
        'Esta conta está em uso por categorias ou regras de classificação e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.financialAccountPlan.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: RecordStatus.INACTIVE,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'FinancialAccountPlan',
      entityId: id,
      oldValue: { code: account.code, name: account.name },
    });

    return { id };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveParent(
    parentAccountId: string | undefined,
    organizationId: string,
  ): Promise<FinancialAccountPlan | null> {
    if (!parentAccountId) return null;

    const parent = await this.prisma.financialAccountPlan.findFirst({
      where: { id: parentAccountId, organizationId, deletedAt: null },
    });

    if (!parent) {
      throw new NotFoundException('Conta pai não encontrada.');
    }

    return parent;
  }

  private async resolveLevelAndPath(
    parentAccountId: string | null,
    organizationId: string,
    name: string,
  ) {
    const all = await this.prisma.financialAccountPlan.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, parentAccountId: true },
    });

    return computeLevelAndPath(
      parentAccountId,
      new Map(
        all.map((a) => [a.id, { name: a.name, parentId: a.parentAccountId }]),
      ),
      name,
    );
  }

  /** Recalcula `level`/`path` do nó e de todos os seus descendentes. */
  private async recalculateSubtree(rootId: string, organizationId: string) {
    const all = await this.prisma.financialAccountPlan.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, parentAccountId: true },
    });

    const nodesById = new Map(
      all.map((a) => [a.id, { name: a.name, parentId: a.parentAccountId }]),
    );
    const childrenOf = new Map<string, string[]>();
    for (const account of all) {
      if (!account.parentAccountId) continue;
      const list = childrenOf.get(account.parentAccountId) ?? [];
      list.push(account.id);
      childrenOf.set(account.parentAccountId, list);
    }

    const affected = collectSubtreeIds(rootId, childrenOf);

    await this.prisma.$transaction(
      affected.map((accountId) => {
        const node = nodesById.get(accountId);
        const { level, path } = computeLevelAndPath(
          node?.parentId ?? null,
          nodesById,
          node?.name ?? '',
        );
        return this.prisma.financialAccountPlan.update({
          where: { id: accountId },
          data: { level, path },
        });
      }),
    );
  }

  private async duplicateChildren(
    sourceParentId: string,
    targetParentId: string,
    actor: RequestUser,
  ) {
    const children = await this.prisma.financialAccountPlan.findMany({
      where: { parentAccountId: sourceParentId, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    for (const child of children) {
      const created = await this.prisma.financialAccountPlan.create({
        data: {
          organizationId: child.organizationId,
          companyId: child.companyId,
          parentAccountId: targetParentId,
          code: `${child.code}-COPIA`,
          name: child.name,
          description: child.description,
          accountType: child.accountType,
          accountKind: child.accountKind,
          financialNatureId: child.financialNatureId,
          acceptsEntries: child.acceptsEntries,
          color: child.color,
          icon: child.icon,
          sortOrder: child.sortOrder,
          notes: child.notes,
          createdBy: actor.id,
        },
      });

      await this.duplicateChildren(child.id, created.id, actor);
    }
  }

  private rethrowDuplicateCode(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Já existe uma conta com este código nesta organização.',
      );
    }
  }

  /** Valida que uma conta pode receber lançamentos — usada pelos módulos futuros. */
  assertAcceptsEntries(account: FinancialAccountPlan): void {
    if (!account.acceptsEntries) {
      throw new BadRequestException(
        'Esta conta é sintética e não aceita lançamentos. Selecione uma conta analítica.',
      );
    }
  }
}
