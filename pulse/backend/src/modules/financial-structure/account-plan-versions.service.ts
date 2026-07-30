import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountPlanKind,
  AccountPlanVersionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  ActivateVersionDto,
  CreateAccountPlanVersionDto,
  UpdateAccountPlanVersionDto,
} from './dto/account-plan-version.dto';

/** Status a partir dos quais uma versão ainda pode ser editada. */
const EDITABLE_STATUSES: AccountPlanVersionStatus[] = [
  AccountPlanVersionStatus.DRAFT,
  AccountPlanVersionStatus.IN_REVIEW,
];

@Injectable()
export class AccountPlanVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(
    organizationId: string,
    companyId?: string,
    planType?: AccountPlanKind,
  ) {
    return this.prisma.financialAccountPlanVersion.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
        ...(planType ? { planType } : {}),
      },
      include: {
        _count: { select: { accounts: true } },
        previousVersion: {
          select: { id: true, name: true, versionNumber: true },
        },
      },
      orderBy: [{ planType: 'asc' }, { versionNumber: 'desc' }],
    });
  }

  async findOne(id: string) {
    const version = await this.prisma.financialAccountPlanVersion.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { accounts: true } },
        previousVersion: {
          select: { id: true, name: true, versionNumber: true },
        },
        nextVersions: { select: { id: true, name: true, versionNumber: true } },
      },
    });

    if (!version) throw new NotFoundException('Versão não encontrada.');
    return version;
  }

  async create(dto: CreateAccountPlanVersionDto, actor: RequestUser) {
    const planType = dto.planType ?? AccountPlanKind.MANAGEMENT;

    const last = await this.prisma.financialAccountPlanVersion.findFirst({
      where: {
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        planType,
      },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const version = await this.prisma.financialAccountPlanVersion.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        name: dto.name.trim(),
        description: dto.description,
        planType,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        reason: dto.reason,
        previousVersionId: dto.previousVersionId,
        status: dto.status ?? AccountPlanVersionStatus.DRAFT,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId ?? null,
      userId: actor.id,
      action: 'CREATE',
      entity: 'FinancialAccountPlanVersion',
      entityId: version.id,
      newValue: { name: version.name, versionNumber: version.versionNumber },
    });

    return version;
  }

  async update(
    id: string,
    dto: UpdateAccountPlanVersionDto,
    actor: RequestUser,
  ) {
    const current = await this.findOne(id);

    // Uma versão já ativa/substituída/arquivada não pode ser reescrita: ela é o
    // registro histórico do que estava valendo.
    if (!EDITABLE_STATUSES.includes(current.status)) {
      throw new ConflictException(
        'Somente versões em rascunho ou em revisão podem ser editadas. Crie uma nova versão.',
      );
    }

    const version = await this.prisma.financialAccountPlanVersion.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        planType: dto.planType,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        reason: dto.reason,
        status: dto.status,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'FinancialAccountPlanVersion',
      entityId: id,
      oldValue: { name: current.name, status: current.status },
      newValue: { name: version.name, status: version.status },
    });

    return version;
  }

  /**
   * Ativa a versão. Apenas **uma** versão pode estar ativa por tipo de plano e empresa
   * (seção 14): a que estiver ativa é automaticamente marcada como `SUPERSEDED`, dentro
   * da mesma transação, para nunca existirem duas ativas ao mesmo tempo.
   */
  async activate(id: string, dto: ActivateVersionDto, actor: RequestUser) {
    const version = await this.findOne(id);

    if (version.status === AccountPlanVersionStatus.ACTIVE) {
      throw new ConflictException('Esta versão já está ativa.');
    }
    if (version.status === AccountPlanVersionStatus.ARCHIVED) {
      throw new ConflictException(
        'Versões arquivadas não podem ser ativadas. Duplique-a para criar uma nova versão.',
      );
    }

    const scope: Prisma.FinancialAccountPlanVersionWhereInput = {
      organizationId: version.organizationId,
      companyId: version.companyId,
      planType: version.planType,
      status: AccountPlanVersionStatus.ACTIVE,
      deletedAt: null,
    };

    const previousActive =
      await this.prisma.financialAccountPlanVersion.findFirst({ where: scope });

    const activated = await this.prisma.$transaction(async (tx) => {
      if (previousActive) {
        await tx.financialAccountPlanVersion.update({
          where: { id: previousActive.id },
          data: {
            status: AccountPlanVersionStatus.SUPERSEDED,
            endDate: new Date(),
            updatedBy: actor.id,
          },
        });
      }

      return tx.financialAccountPlanVersion.update({
        where: { id },
        data: {
          status: AccountPlanVersionStatus.ACTIVE,
          activatedBy: actor.id,
          activatedAt: new Date(),
          reason: dto.reason,
          previousVersionId: version.previousVersionId ?? previousActive?.id,
          updatedBy: actor.id,
        },
      });
    });

    if (dto.copyAccountsFromPrevious && previousActive) {
      await this.copyAccounts(previousActive.id, id, actor);
    }

    await this.audit.log({
      organizationId: version.organizationId,
      companyId: version.companyId,
      userId: actor.id,
      action: 'ACTIVATE_VERSION',
      entity: 'FinancialAccountPlanVersion',
      entityId: id,
      oldValue: previousActive
        ? { supersededVersion: previousActive.versionNumber }
        : undefined,
      newValue: { versionNumber: activated.versionNumber },
      reason: dto.reason,
    });

    return activated;
  }

  async archive(id: string, actor: RequestUser) {
    const version = await this.findOne(id);

    if (version.status === AccountPlanVersionStatus.ACTIVE) {
      throw new BadRequestException(
        'A versão ativa não pode ser arquivada. Ative outra versão primeiro.',
      );
    }

    const archived = await this.prisma.financialAccountPlanVersion.update({
      where: { id },
      data: { status: AccountPlanVersionStatus.ARCHIVED, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: version.organizationId,
      companyId: version.companyId,
      userId: actor.id,
      action: 'ARCHIVE',
      entity: 'FinancialAccountPlanVersion',
      entityId: id,
      oldValue: { status: version.status },
      newValue: { status: archived.status },
    });

    return archived;
  }

  /**
   * Duplica a versão (cabeçalho + contas) como um novo rascunho. Não copia lançamentos,
   * saldos ou histórico de uso — apenas a estrutura (seção 46).
   */
  async duplicate(id: string, actor: RequestUser) {
    const source = await this.findOne(id);

    const created = await this.create(
      {
        organizationId: source.organizationId,
        companyId: source.companyId ?? undefined,
        name: `${source.name} (cópia)`,
        description: source.description ?? undefined,
        planType: source.planType,
        previousVersionId: source.id,
        reason: `Duplicada da versão ${source.versionNumber}`,
      },
      actor,
    );

    await this.copyAccounts(source.id, created.id, actor);

    await this.audit.log({
      organizationId: source.organizationId,
      companyId: source.companyId,
      userId: actor.id,
      action: 'DUPLICATE',
      entity: 'FinancialAccountPlanVersion',
      entityId: created.id,
      oldValue: { sourceVersion: source.versionNumber },
      newValue: { versionNumber: created.versionNumber },
    });

    return created;
  }

  /**
   * Copia as contas de uma versão para outra, preservando a hierarquia. O mapa
   * `idMap` liga a conta de origem à cópia, para que os pais sejam remapeados
   * corretamente — copiar sem isso deixaria os filhos apontando para a versão antiga.
   */
  private async copyAccounts(
    sourceVersionId: string,
    targetVersionId: string,
    actor: RequestUser,
  ): Promise<number> {
    const accounts = await this.prisma.financialAccountPlan.findMany({
      where: { versionId: sourceVersionId, deletedAt: null },
      orderBy: { level: 'asc' },
    });

    const idMap = new Map<string, string>();

    for (const account of accounts) {
      const created = await this.prisma.financialAccountPlan.create({
        data: {
          organizationId: account.organizationId,
          companyId: account.companyId,
          versionId: targetVersionId,
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
          financialNatureId: account.financialNatureId,
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
        },
      });

      idMap.set(account.id, created.id);
    }

    return idMap.size;
  }

  async remove(id: string, actor: RequestUser) {
    const version = await this.findOne(id);

    if (version.status !== AccountPlanVersionStatus.DRAFT) {
      throw new ConflictException(
        'Somente versões em rascunho podem ser excluídas. Utilize a opção Arquivar.',
      );
    }
    if (version._count.accounts > 0) {
      throw new ConflictException(
        'Esta versão possui contas vinculadas e não pode ser excluída. Utilize a opção Arquivar.',
      );
    }

    await this.prisma.financialAccountPlanVersion.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: version.organizationId,
      companyId: version.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'FinancialAccountPlanVersion',
      entityId: id,
      oldValue: { name: version.name, versionNumber: version.versionNumber },
    });

    return { id };
  }
}
