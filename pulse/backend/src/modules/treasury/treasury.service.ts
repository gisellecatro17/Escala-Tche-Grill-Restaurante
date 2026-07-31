import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BeneficiaryEntityType,
  CorporateCardStatus,
  FinancialAccountStatus,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { hasPermissionAnywhere } from '../../common/utils/access-control.util';
import {
  maskAccountFragment,
  maskPixKeyValue,
} from '../../common/utils/mask.util';
import { AuditService } from '../audit/audit.service';
import { UpdateTreasurySettingsDto } from './dto/treasury-settings.dto';

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Parâmetros de tesouraria (seção 47) ───────────────────────────────────

  /**
   * Devolve os parâmetros da empresa, criando o registro com os padrões na primeira
   * consulta — assim a tela nunca precisa lidar com "ainda não configurado".
   */
  async findSettings(organizationId: string, companyId: string) {
    const existing = await this.prisma.treasurySettings.findUnique({
      where: { companyId },
    });
    if (existing) return existing;

    return this.prisma.treasurySettings.create({
      data: { organizationId, companyId },
    });
  }

  async updateSettings(
    organizationId: string,
    companyId: string,
    dto: UpdateTreasurySettingsDto,
    actor: RequestUser,
  ) {
    const current = await this.findSettings(organizationId, companyId);

    await this.assertDefaultAccountsBelongToCompany(dto, companyId);

    if (
      dto.requireDualApproval &&
      !dto.dualApprovalAmount &&
      !current.dualApprovalAmount
    ) {
      throw new BadRequestException(
        'Informe o valor a partir do qual a dupla aprovação será exigida.',
      );
    }

    const settings = await this.prisma.treasurySettings.update({
      where: { companyId },
      data: { ...dto, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'UPDATE_TREASURY_SETTINGS',
      entity: 'TreasurySettings',
      entityId: settings.id,
      oldValue: {
        requireDualApproval: current.requireDualApproval,
        allowThirdPartyAccounts: current.allowThirdPartyAccounts,
        requireSegregationOfDuties: current.requireSegregationOfDuties,
      },
      newValue: {
        requireDualApproval: settings.requireDualApproval,
        allowThirdPartyAccounts: settings.allowThirdPartyAccounts,
        requireSegregationOfDuties: settings.requireSegregationOfDuties,
      },
    });

    return settings;
  }

  /** Uma conta padrão de outra empresa deixaria os lançamentos caindo no lugar errado. */
  private async assertDefaultAccountsBelongToCompany(
    dto: UpdateTreasurySettingsDto,
    companyId: string,
  ) {
    const ids = [
      dto.primaryFinancialAccountId,
      dto.defaultPaymentAccountId,
      dto.defaultReceiptAccountId,
      dto.defaultTaxAccountId,
      dto.defaultPayrollAccountId,
      dto.defaultCashAccountId,
    ].filter((id): id is string => Boolean(id));

    if (ids.length === 0) return;

    const accounts = await this.prisma.financialAccount.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, companyId: true, name: true },
    });

    const foreign = accounts.find((account) => account.companyId !== companyId);
    if (foreign) {
      throw new BadRequestException(
        `A conta "${foreign.name}" pertence a outra empresa e não pode ser usada como conta padrão.`,
      );
    }

    const missing = ids.filter((id) => !accounts.some((a) => a.id === id));
    if (missing.length > 0) {
      throw new BadRequestException(
        'Uma das contas informadas não foi encontrada.',
      );
    }
  }

  // ── Visão geral da tesouraria (seções 4 e 6) ──────────────────────────────

  /**
   * Consolidado da tesouraria: contagens por situação, alertas e pendências. Não
   * calcula saldo movimentado — não existe movimentação ainda, e somar saldos
   * iniciais como se fossem saldo atual seria enganoso.
   */
  async findOverview(organizationId: string, companyId: string | undefined) {
    const scope: Prisma.FinancialAccountWhereInput = {
      organizationId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const cardScope: Prisma.CorporateCardWhereInput = {
      organizationId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const settings = companyId
      ? await this.prisma.treasurySettings.findUnique({
          where: { companyId },
          select: { cardExpirationAlertDays: true },
        })
      : null;

    const alertLimit = new Date();
    alertLimit.setDate(
      alertLimit.getDate() + (settings?.cardExpirationAlertDays ?? 30),
    );

    const [
      activeAccounts,
      draftAccounts,
      inactiveAccounts,
      blockedAccounts,
      activeCards,
      expiringCards,
      pixKeys,
      pendingPixKeys,
      paymentMethods,
      receiptMethods,
      withoutResponsible,
      withoutAccountPlan,
      withoutReconciliation,
      openingBalances,
      limits,
    ] = await Promise.all([
      this.prisma.financialAccount.count({
        where: { ...scope, status: FinancialAccountStatus.ACTIVE },
      }),
      this.prisma.financialAccount.count({
        where: { ...scope, status: FinancialAccountStatus.DRAFT },
      }),
      this.prisma.financialAccount.count({
        where: { ...scope, status: FinancialAccountStatus.INACTIVE },
      }),
      this.prisma.financialAccount.count({
        where: { ...scope, status: FinancialAccountStatus.BLOCKED },
      }),
      this.prisma.corporateCard.count({
        where: { ...cardScope, status: CorporateCardStatus.ACTIVE },
      }),
      this.prisma.corporateCard.count({
        where: {
          ...cardScope,
          status: CorporateCardStatus.ACTIVE,
          expirationDate: { gte: new Date(), lte: alertLimit },
        },
      }),
      this.prisma.companyPixKey.count({
        where: {
          organizationId,
          deletedAt: null,
          ...(companyId ? { companyId } : {}),
        },
      }),
      this.prisma.companyPixKey.count({
        where: {
          organizationId,
          deletedAt: null,
          validationStatus: 'UNVERIFIED',
          ...(companyId ? { companyId } : {}),
        },
      }),
      this.prisma.paymentMethodCatalog.count({
        where: {
          organizationId,
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
        },
      }),
      this.prisma.receiptMethod.count({
        where: {
          organizationId,
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
        },
      }),
      this.prisma.financialAccount.findMany({
        where: {
          ...scope,
          responsibleUserId: null,
          users: { none: { deletedAt: null } },
        },
        select: { id: true, name: true, displayName: true },
        take: 20,
      }),
      this.prisma.financialAccount.findMany({
        where: { ...scope, accountPlanId: null },
        select: { id: true, name: true, displayName: true },
        take: 20,
      }),
      this.prisma.financialAccount.findMany({
        where: { ...scope, reconciliationMode: 'NOT_RECONCILABLE' },
        select: { id: true, name: true, displayName: true },
        take: 20,
      }),
      this.prisma.financialAccountOpeningBalance.count({
        where: {
          status: 'APPROVED',
          financialAccount: scope,
        },
      }),
      this.prisma.financialAccountLimit.count({
        where: {
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          financialAccount: scope,
        },
      }),
    ]);

    const recentChanges =
      await this.prisma.financialAccountStatusHistory.findMany({
        where: { financialAccount: scope },
        orderBy: { changedAt: 'desc' },
        take: 10,
        include: {
          financialAccount: {
            select: { id: true, name: true, displayName: true },
          },
        },
      });

    const pendencies = [
      {
        code: 'ACCOUNT_WITHOUT_RESPONSIBLE',
        label: 'Contas sem responsável',
        items: withoutResponsible,
      },
      {
        code: 'ACCOUNT_WITHOUT_ACCOUNT_PLAN',
        label: 'Contas sem vínculo contábil',
        items: withoutAccountPlan,
      },
      {
        code: 'ACCOUNT_WITHOUT_RECONCILIATION',
        label: 'Contas sem configuração de conciliação',
        items: withoutReconciliation,
      },
    ].filter((group) => group.items.length > 0);

    return {
      accounts: {
        active: activeAccounts,
        draft: draftAccounts,
        inactive: inactiveAccounts,
        blocked: blockedAccounts,
      },
      cards: { active: activeCards, expiringSoon: expiringCards },
      pixKeys: { total: pixKeys, pendingValidation: pendingPixKeys },
      methods: { payment: paymentMethods, receipt: receiptMethods },
      structure: { openingBalances, limits },
      pendencies,
      pendenciesTotal: pendencies.reduce(
        (sum, group) => sum + group.items.length,
        0,
      ),
      recentChanges,
      // Saldo movimentado não existe nesta etapa: só há saldo de implantação.
      note: 'Os saldos bancário, conciliado e disponível serão calculados quando o módulo financeiro registrar movimentações.',
    };
  }

  // ── Histórico de situação das contas ──────────────────────────────────────

  /**
   * Histórico paginado das mudanças de situação das contas da organização.
   *
   * A visão geral traz apenas as dez últimas; esta rota existe para a tela de histórico,
   * onde o interesse é auditar o passado inteiro de uma conta ou de todas elas.
   */
  async findStatusHistory(
    organizationId: string,
    filters: {
      companyId?: string;
      financialAccountId?: string;
      page: number;
      perPage: number;
    },
  ) {
    const where: Prisma.FinancialAccountStatusHistoryWhereInput = {
      financialAccount: {
        organizationId,
        deletedAt: null,
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
      },
      ...(filters.financialAccountId
        ? { financialAccountId: filters.financialAccountId }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.financialAccountStatusHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
        include: {
          financialAccount: {
            select: { id: true, name: true, displayName: true },
          },
        },
      }),
      this.prisma.financialAccountStatusHistory.count({ where }),
    ]);

    // `changedBy` guarda só o id (não é relação no schema), então o nome de quem mudou
    // vem em uma consulta à parte — uma para a página inteira, não uma por linha.
    const actorIds = [
      ...new Set(
        rows.map((row) => row.changedBy).filter((id): id is string => !!id),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const actorById = new Map(actors.map((user) => [user.id, user]));

    const items = rows.map((row) => ({
      ...row,
      changedByUser: row.changedBy
        ? (actorById.get(row.changedBy) ?? null)
        : null,
    }));

    return paginate(items, total, filters.page, filters.perPage);
  }

  // ── Favorecidos bancários (seção 45) ──────────────────────────────────────

  /**
   * Visão consolidada dos favorecidos. **Não duplica** dados: lê as contas e chaves PIX
   * já cadastradas nos fornecedores e as apresenta em um lugar só.
   */
  async findBeneficiaries(
    organizationId: string,
    filters: {
      companyId?: string;
      search?: string;
      entityType?: BeneficiaryEntityType;
    },
    actor: RequestUser,
  ) {
    const canSeeFullData = hasPermissionAnywhere(
      actor,
      'treasury.view_sensitive_data',
    );

    const wantsSuppliers =
      !filters.entityType ||
      filters.entityType === BeneficiaryEntityType.SUPPLIER;

    if (!wantsSuppliers) {
      // Funcionários, sócios e órgãos públicos ganharão cadastro próprio adiante.
      return { items: [], total: 0, sources: [] as string[] };
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filters.search
          ? {
              OR: [
                {
                  legalName: { contains: filters.search, mode: 'insensitive' },
                },
                {
                  tradeName: { contains: filters.search, mode: 'insensitive' },
                },
              ],
            }
          : {}),
        ...(filters.companyId
          ? {
              companyLinks: {
                some: { companyId: filters.companyId, deletedAt: null },
              },
            }
          : {}),
      },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        documentNumber: true,
        bankAccounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            branchNumber: true,
            branchDigit: true,
            accountNumber: true,
            accountDigit: true,
            holderName: true,
            holderDocument: true,
            isPrimary: true,
            isThirdParty: true,
            verificationStatus: true,
            status: true,
            updatedAt: true,
            financialInstitution: {
              select: { id: true, shortName: true, legalName: true },
            },
          },
        },
        pixKeys: {
          where: { deletedAt: null },
          select: {
            id: true,
            pixType: true,
            pixKey: true,
            isPrimary: true,
            verificationStatus: true,
            status: true,
          },
        },
      },
      take: 200,
    });

    const items = suppliers.flatMap((supplier) =>
      supplier.bankAccounts.map((account) => ({
        entityType: BeneficiaryEntityType.SUPPLIER,
        entityId: supplier.id,
        entityName: supplier.tradeName ?? supplier.legalName,
        entityDocument: canSeeFullData
          ? supplier.documentNumber
          : maskAccountFragment(supplier.documentNumber),
        bankAccountId: account.id,
        institution:
          account.financialInstitution?.shortName ??
          account.financialInstitution?.legalName ??
          null,
        branch: canSeeFullData
          ? [account.branchNumber, account.branchDigit]
              .filter(Boolean)
              .join('-')
          : maskAccountFragment(account.branchNumber),
        account: canSeeFullData
          ? [account.accountNumber, account.accountDigit]
              .filter(Boolean)
              .join('-')
          : maskAccountFragment(account.accountNumber),
        holderName: account.holderName,
        holderDocument: canSeeFullData
          ? account.holderDocument
          : maskAccountFragment(account.holderDocument),
        isPrimary: account.isPrimary,
        isThirdParty: account.isThirdParty,
        verificationStatus: account.verificationStatus,
        status: account.status,
        pixKeys: supplier.pixKeys.map((key) => ({
          id: key.id,
          pixType: key.pixType,
          pixKey: canSeeFullData ? key.pixKey : maskPixKeyValue(key.pixKey),
          isPrimary: key.isPrimary,
          verificationStatus: key.verificationStatus,
        })),
        updatedAt: account.updatedAt,
      })),
    );

    return {
      items,
      total: items.length,
      // Deixa explícito de onde vieram os dados: nada aqui é um cadastro novo.
      sources: ['supplier_bank_accounts', 'supplier_pix_keys'],
    };
  }
}
