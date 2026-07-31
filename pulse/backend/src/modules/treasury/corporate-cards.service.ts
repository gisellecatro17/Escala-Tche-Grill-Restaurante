import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorporateCardStatus, Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { paginate } from '../../common/dto/pagination-query.dto';
import { AuditService } from '../audit/audit.service';
import {
  CorporateCardQueryDto,
  CorporateCardStatusChangeDto,
  CreateCorporateCardDto,
  UpdateCorporateCardDto,
  UpsertCardUserDto,
} from './dto/corporate-card.dto';

const CARD_INCLUDE = {
  financialAccount: { select: { id: true, displayName: true, name: true } },
  financialInstitution: {
    select: { id: true, shortName: true, legalName: true },
  },
  costCenter: { select: { id: true, name: true } },
  businessUnit: { select: { id: true, name: true } },
  _count: { select: { users: true } },
} satisfies Prisma.CorporateCardInclude;

/** Dias de antecedência padrão do alerta de vencimento, quando a empresa não configurou. */
const DEFAULT_EXPIRATION_ALERT_DAYS = 30;

@Injectable()
export class CorporateCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string, query: CorporateCardQueryDto) {
    const alertLimit = new Date();
    alertLimit.setDate(alertLimit.getDate() + DEFAULT_EXPIRATION_ALERT_DAYS);

    const where: Prisma.CorporateCardWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.financialAccountId
        ? { financialAccountId: query.financialAccountId }
        : {}),
      ...(query.financialInstitutionId
        ? { financialInstitutionId: query.financialInstitutionId }
        : {}),
      ...(query.brand
        ? { brand: { contains: query.brand, mode: 'insensitive' } }
        : {}),
      ...(query.cardType ? { cardType: query.cardType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.responsibleUserId
        ? { responsibleUserId: query.responsibleUserId }
        : {}),
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      ...(query.lastFourDigits
        ? { lastFourDigits: { contains: query.lastFourDigits } }
        : {}),
      ...(query.isVirtual !== undefined ? { isVirtual: query.isVirtual } : {}),
      ...(query.expiringSoon
        ? { expirationDate: { lte: alertLimit, gte: new Date() } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { holderName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.corporateCard.findMany({
        where,
        include: CARD_INCLUDE,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.corporateCard.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const card = await this.prisma.corporateCard.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...CARD_INCLUDE,
        users: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!card) throw new NotFoundException('Cartão não encontrado.');
    return card;
  }

  async scopeOf(id: string) {
    const card = await this.prisma.corporateCard.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        status: true,
        lastFourDigits: true,
      },
    });

    if (!card) throw new NotFoundException('Cartão não encontrado.');
    return card;
  }

  async create(dto: CreateCorporateCardDto, actor: RequestUser) {
    await this.assertCompanyInOrganization(dto.companyId, dto.organizationId);
    await this.assertAccountBelongsToCompany(
      dto.financialAccountId,
      dto.companyId,
    );
    this.assertBillingCycle(dto.closingDay, dto.dueDay);
    await this.assertNoDuplicateCard(dto);

    const card = await this.prisma.corporateCard.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        financialAccountId: dto.financialAccountId,
        financialInstitutionId: dto.financialInstitutionId,
        businessUnitId: dto.businessUnitId,
        costCenterId: dto.costCenterId,
        defaultCategoryId: dto.defaultCategoryId,
        defaultProjectId: dto.defaultProjectId,
        accountPlanId: dto.accountPlanId,
        name: dto.name.trim(),
        displayName:
          dto.displayName?.trim() ??
          `${dto.name.trim()} — final ${dto.lastFourDigits}`,
        cardType: dto.cardType,
        brand: dto.brand,
        lastFourDigits: dto.lastFourDigits,
        holderName: dto.holderName,
        responsibleUserId: dto.responsibleUserId,
        isPhysical: dto.isPhysical,
        isVirtual: dto.isVirtual,
        totalLimit: dto.totalLimit,
        transactionLimit: dto.transactionLimit,
        closingDay: dto.closingDay,
        dueDay: dto.dueDay,
        allowsInstallments: dto.allowsInstallments,
        maximumInstallments: dto.maximumInstallments,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : null,
        notes: dto.notes,
        status: CorporateCardStatus.ACTIVE,
        createdBy: actor.id,
      },
      include: CARD_INCLUDE,
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'CorporateCard',
      entityId: card.id,
      // Só o final do cartão vai para a auditoria — nunca mais que isso.
      newValue: { name: card.name, lastFourDigits: card.lastFourDigits },
    });

    return card;
  }

  async update(id: string, dto: UpdateCorporateCardDto, actor: RequestUser) {
    const current = await this.scopeOf(id);
    this.assertBillingCycle(dto.closingDay, dto.dueDay);

    if (dto.financialAccountId) {
      await this.assertAccountBelongsToCompany(
        dto.financialAccountId,
        current.companyId,
      );
    }

    const card = await this.prisma.corporateCard.update({
      where: { id },
      data: {
        financialAccountId: dto.financialAccountId,
        financialInstitutionId: dto.financialInstitutionId,
        businessUnitId: dto.businessUnitId,
        costCenterId: dto.costCenterId,
        defaultCategoryId: dto.defaultCategoryId,
        defaultProjectId: dto.defaultProjectId,
        accountPlanId: dto.accountPlanId,
        name: dto.name?.trim(),
        displayName: dto.displayName?.trim(),
        cardType: dto.cardType,
        brand: dto.brand,
        lastFourDigits: dto.lastFourDigits,
        holderName: dto.holderName,
        responsibleUserId: dto.responsibleUserId,
        isPhysical: dto.isPhysical,
        isVirtual: dto.isVirtual,
        totalLimit: dto.totalLimit,
        transactionLimit: dto.transactionLimit,
        closingDay: dto.closingDay,
        dueDay: dto.dueDay,
        allowsInstallments: dto.allowsInstallments,
        maximumInstallments: dto.maximumInstallments,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : undefined,
        notes: dto.notes,
        updatedBy: actor.id,
      },
      include: CARD_INCLUDE,
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'CorporateCard',
      entityId: id,
      newValue: {
        name: card.name,
        totalLimit: card.totalLimit?.toString() ?? null,
      },
    });

    return card;
  }

  async setStatus(
    id: string,
    status: CorporateCardStatus,
    dto: CorporateCardStatusChangeDto | undefined,
    actor: RequestUser,
  ) {
    const current = await this.scopeOf(id);

    if (current.status === status) {
      throw new ConflictException('O cartão já está nesta situação.');
    }

    const card = await this.prisma.corporateCard.update({
      where: { id },
      data: { status, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: `CARD_${status}`,
      entity: 'CorporateCard',
      entityId: id,
      field: 'status',
      oldValue: { status: current.status },
      newValue: { status },
      reason: dto?.reason,
    });

    return card;
  }

  /** Vínculos do cartão, para explicar por que a exclusão está bloqueada. */
  async usage(id: string) {
    const card = await this.prisma.corporateCard.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: true } } },
    });
    if (!card) throw new NotFoundException('Cartão não encontrado.');

    const relations = [
      { label: 'Portadores vinculados', count: card._count.users },
    ];
    const total = relations.reduce((sum, item) => sum + item.count, 0);

    return {
      id,
      status: card.status,
      inUse: total > 0,
      canDelete: total === 0 && card.status === CorporateCardStatus.DRAFT,
      total,
      relations,
    };
  }

  async remove(id: string, actor: RequestUser) {
    const card = await this.scopeOf(id);
    const usage = await this.usage(id);

    if (!usage.canDelete) {
      throw new ConflictException(
        'Este cartão possui registros vinculados e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.corporateCard.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: card.organizationId,
      companyId: card.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'CorporateCard',
      entityId: id,
    });

    return { id };
  }

  // ── Portadores do cartão (seção 40) ───────────────────────────────────────

  findUsers(corporateCardId: string) {
    return this.prisma.corporateCardUser.findMany({
      where: { corporateCardId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async upsertUser(
    corporateCardId: string,
    dto: UpsertCardUserDto,
    actor: RequestUser,
  ) {
    const card = await this.scopeOf(corporateCardId);

    const data = {
      isPrimary: dto.isPrimary ?? false,
      individualLimit: dto.individualLimit,
      transactionLimit: dto.transactionLimit,
      costCenterId: dto.costCenterId,
      businessUnitId: dto.businessUnitId,
      projectId: dto.projectId,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      status: dto.status,
    };

    const link = await this.prisma.$transaction(async (tx) => {
      // Só um portador principal por cartão.
      if (dto.isPrimary) {
        await tx.corporateCardUser.updateMany({
          where: {
            corporateCardId,
            isPrimary: true,
            userId: { not: dto.userId },
          },
          data: { isPrimary: false },
        });
      }

      return tx.corporateCardUser.upsert({
        where: {
          corporateCardId_userId: { corporateCardId, userId: dto.userId },
        },
        create: {
          corporateCardId,
          userId: dto.userId,
          ...data,
          createdBy: actor.id,
        },
        update: { ...data, deletedAt: null },
      });
    });

    await this.audit.log({
      organizationId: card.organizationId,
      companyId: card.companyId,
      userId: actor.id,
      action: 'UPSERT_CARD_USER',
      entity: 'CorporateCardUser',
      entityId: link.id,
      newValue: {
        userId: dto.userId,
        individualLimit: dto.individualLimit
          ? String(dto.individualLimit)
          : null,
      },
    });

    return link;
  }

  async removeUser(
    corporateCardId: string,
    userId: string,
    actor: RequestUser,
  ) {
    const card = await this.scopeOf(corporateCardId);

    const link = await this.prisma.corporateCardUser.findFirst({
      where: { corporateCardId, userId, deletedAt: null },
    });
    if (!link)
      throw new NotFoundException('Portador não vinculado a este cartão.');

    await this.prisma.corporateCardUser.update({
      where: { id: link.id },
      data: { deletedAt: new Date(), status: RecordStatus.INACTIVE },
    });

    await this.audit.log({
      organizationId: card.organizationId,
      companyId: card.companyId,
      userId: actor.id,
      action: 'REMOVE_CARD_USER',
      entity: 'CorporateCardUser',
      entityId: link.id,
      oldValue: { userId },
    });

    return { id: link.id };
  }

  // ── Alertas (seção 39) ────────────────────────────────────────────────────

  /**
   * Situações que merecem atenção: cartão vencendo, cartão já vencido, cartão sem
   * responsável e cartão preso a uma conta que não está mais ativa.
   */
  async findAlerts(organizationId: string, companyId?: string) {
    const settings = companyId
      ? await this.prisma.treasurySettings.findUnique({
          where: { companyId },
          select: { cardExpirationAlertDays: true },
        })
      : null;

    const alertDays =
      settings?.cardExpirationAlertDays ?? DEFAULT_EXPIRATION_ALERT_DAYS;
    const today = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + alertDays);

    const scope = {
      organizationId,
      deletedAt: null,
      status: CorporateCardStatus.ACTIVE,
      ...(companyId ? { companyId } : {}),
    } satisfies Prisma.CorporateCardWhereInput;

    const [expiringSoon, expired, withoutResponsible, inactiveAccount] =
      await Promise.all([
        this.prisma.corporateCard.findMany({
          where: { ...scope, expirationDate: { gte: today, lte: limit } },
          select: {
            id: true,
            name: true,
            lastFourDigits: true,
            expirationDate: true,
          },
        }),
        this.prisma.corporateCard.findMany({
          where: { ...scope, expirationDate: { lt: today } },
          select: {
            id: true,
            name: true,
            lastFourDigits: true,
            expirationDate: true,
          },
        }),
        this.prisma.corporateCard.findMany({
          where: { ...scope, responsibleUserId: null, users: { none: {} } },
          select: { id: true, name: true, lastFourDigits: true },
        }),
        this.prisma.corporateCard.findMany({
          where: {
            ...scope,
            financialAccount: { status: { not: 'ACTIVE' } },
          },
          select: { id: true, name: true, lastFourDigits: true },
        }),
      ]);

    return {
      alertDays,
      expiringSoon,
      expired,
      withoutResponsible,
      inactiveAccount,
      total:
        expiringSoon.length +
        expired.length +
        withoutResponsible.length +
        inactiveAccount.length,
    };
  }

  // ── Validações ────────────────────────────────────────────────────────────

  private async assertCompanyInOrganization(
    companyId: string,
    organizationId: string,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { organizationId: true },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (company.organizationId !== organizationId) {
      throw new BadRequestException(
        'A empresa informada não pertence a esta organização.',
      );
    }
  }

  /** A conta que paga a fatura precisa ser da mesma empresa do cartão. */
  private async assertAccountBelongsToCompany(
    financialAccountId: string | undefined,
    companyId: string,
  ) {
    if (!financialAccountId) return;

    const account = await this.prisma.financialAccount.findFirst({
      where: { id: financialAccountId, deletedAt: null },
      select: { companyId: true },
    });

    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');
    if (account.companyId !== companyId) {
      throw new BadRequestException(
        'A conta financeira informada pertence a outra empresa.',
      );
    }
  }

  private assertBillingCycle(closingDay?: number, dueDay?: number) {
    for (const [label, day] of [
      ['fechamento', closingDay],
      ['vencimento', dueDay],
    ] as const) {
      if (day !== undefined && (day < 1 || day > 31)) {
        throw new BadRequestException(
          `O dia de ${label} deve estar entre 1 e 31.`,
        );
      }
    }
  }

  /**
   * Mesmo final, mesma instituição e mesma validade na mesma empresa é o mesmo cartão.
   * A validade entra na chave porque a renovação reaproveita os quatro últimos dígitos.
   */
  private async assertNoDuplicateCard(dto: CreateCorporateCardDto) {
    const existing = await this.prisma.corporateCard.findFirst({
      where: {
        companyId: dto.companyId,
        financialInstitutionId: dto.financialInstitutionId ?? null,
        lastFourDigits: dto.lastFourDigits,
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : null,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new ConflictException(
        `O cartão informado já está cadastrado: "${existing.name}".`,
      );
    }
  }
}
