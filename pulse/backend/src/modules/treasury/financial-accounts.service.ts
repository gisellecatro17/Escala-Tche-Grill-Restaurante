import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinancialAccountStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { paginate } from '../../common/dto/pagination-query.dto';
import { onlyDigits } from '../../common/utils/normalize.util';
import { hasPermissionAnywhere } from '../../common/utils/access-control.util';
import { AuditService } from '../audit/audit.service';
import {
  CloseFinancialAccountDto,
  CreateFinancialAccountDto,
  FinancialAccountQueryDto,
  FinancialAccountStatusChangeDto,
  UpdateFinancialAccountDto,
} from './dto/financial-account.dto';
import {
  buildAccountIdentifier,
  buildDisplayName,
  isBankAccount,
} from './utils/account-identity.util';
import {
  ACCOUNT_BALANCE_FIELDS,
  maskBalances,
  maskBankData,
} from './utils/treasury-mask.util';

const ACCOUNT_INCLUDE = {
  financialInstitution: {
    select: { id: true, legalName: true, shortName: true, compeCode: true },
  },
  businessUnit: { select: { id: true, name: true } },
  costCenter: { select: { id: true, name: true } },
  accountPlan: { select: { id: true, code: true, name: true } },
  _count: {
    select: { pixKeys: true, cards: true, users: true, integrations: true },
  },
} satisfies Prisma.FinancialAccountInclude;

/**
 * Transições permitidas do ciclo de vida (seções 30 a 34).
 *
 * `CLOSED` é terminal de propósito: uma conta encerrada junto ao banco não volta a
 * operar por uma reativação simples — seria preciso cadastrar a conta de novo.
 */
const STATUS_TRANSITIONS: Record<
  FinancialAccountStatus,
  FinancialAccountStatus[]
> = {
  [FinancialAccountStatus.DRAFT]: [
    FinancialAccountStatus.PENDING_VALIDATION,
    FinancialAccountStatus.ACTIVE,
    FinancialAccountStatus.INACTIVE,
  ],
  [FinancialAccountStatus.PENDING_VALIDATION]: [
    FinancialAccountStatus.ACTIVE,
    FinancialAccountStatus.INACTIVE,
  ],
  [FinancialAccountStatus.ACTIVE]: [
    FinancialAccountStatus.BLOCKED,
    FinancialAccountStatus.SUSPENDED,
    FinancialAccountStatus.INACTIVE,
    FinancialAccountStatus.CLOSED,
  ],
  [FinancialAccountStatus.BLOCKED]: [
    FinancialAccountStatus.ACTIVE,
    FinancialAccountStatus.SUSPENDED,
    FinancialAccountStatus.INACTIVE,
    FinancialAccountStatus.CLOSED,
  ],
  [FinancialAccountStatus.SUSPENDED]: [
    FinancialAccountStatus.ACTIVE,
    FinancialAccountStatus.BLOCKED,
    FinancialAccountStatus.INACTIVE,
    FinancialAccountStatus.CLOSED,
  ],
  [FinancialAccountStatus.INACTIVE]: [
    FinancialAccountStatus.ACTIVE,
    FinancialAccountStatus.CLOSED,
  ],
  [FinancialAccountStatus.CLOSED]: [],
};

const STATUS_LABELS: Record<FinancialAccountStatus, string> = {
  DRAFT: 'em rascunho',
  PENDING_VALIDATION: 'pendente de validação',
  ACTIVE: 'ativa',
  BLOCKED: 'bloqueada',
  SUSPENDED: 'suspensa',
  INACTIVE: 'inativa',
  CLOSED: 'encerrada',
};

@Injectable()
export class FinancialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Consulta ──────────────────────────────────────────────────────────────

  async findAll(
    organizationId: string,
    query: FinancialAccountQueryDto,
    actor: RequestUser,
  ) {
    const where: Prisma.FinancialAccountWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.accountType ? { accountType: query.accountType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.financialInstitutionId
        ? { financialInstitutionId: query.financialInstitutionId }
        : {}),
      ...(query.businessUnitId ? { businessUnitId: query.businessUnitId } : {}),
      ...(query.responsibleUserId
        ? { responsibleUserId: query.responsibleUserId }
        : {}),
      ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
      ...(query.isPrimary !== undefined ? { isPrimary: query.isPrimary } : {}),
      ...(query.hasPix ? { pixKeys: { some: { deletedAt: null } } } : {}),
      ...(query.hasIntegration
        ? { integrations: { some: { deletedAt: null } } }
        : {}),
      ...(query.hasOpeningBalance
        ? { openingBalances: { some: { status: 'APPROVED' } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { internalCode: { contains: query.search, mode: 'insensitive' } },
              {
                accountNumber: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.financialAccount.count({ where }),
    ]);

    return paginate(
      items.map((account) => this.applyMasking(account, actor)),
      total,
      query.page,
      query.perPage,
    );
  }

  async findOne(id: string, actor?: RequestUser) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...ACCOUNT_INCLUDE,
        openingBalances: {
          where: { status: 'APPROVED' },
          orderBy: { balanceDate: 'desc' },
          take: 1,
        },
        limits: { where: { deletedAt: null, status: 'ACTIVE' } },
        pixKeys: { where: { deletedAt: null } },
      },
    });

    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');

    return actor ? this.applyMasking(account, actor) : account;
  }

  /** Escopo da conta, para o controller validar a permissão antes de qualquer ação. */
  async scopeOf(id: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true, status: true },
    });

    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');
    return account;
  }

  /**
   * Mascara dados bancários e saldos conforme as permissões do usuário. Aplicado em
   * toda saída — listagem, detalhe e histórico.
   */
  private applyMasking<T extends Record<string, unknown>>(
    account: T,
    actor: RequestUser,
  ): T {
    let result = account;

    if (!hasPermissionAnywhere(actor, 'financial_account.view_bank_data')) {
      result = maskBankData(result as never);
    }
    if (!hasPermissionAnywhere(actor, 'financial_account.view_balance')) {
      result = maskBalances(result, ACCOUNT_BALANCE_FIELDS);
    }

    return result;
  }

  // ── Criação e edição ──────────────────────────────────────────────────────

  /** Rascunho: valida o mínimo para o usuário poder voltar depois. */
  createDraft(dto: CreateFinancialAccountDto, actor: RequestUser) {
    return this.create(dto, actor, FinancialAccountStatus.DRAFT);
  }

  async create(
    dto: CreateFinancialAccountDto,
    actor: RequestUser,
    status: FinancialAccountStatus = FinancialAccountStatus.PENDING_VALIDATION,
  ) {
    const company = await this.assertCompanyInOrganization(
      dto.companyId,
      dto.organizationId,
    );

    if (status !== FinancialAccountStatus.DRAFT) {
      this.assertBankFieldsPresent(dto);
    }

    await this.assertThirdPartyAllowed(dto, company, actor);
    await this.assertNoDuplicateAccount(dto);

    const institution = dto.financialInstitutionId
      ? await this.prisma.financialInstitution.findUnique({
          where: { id: dto.financialInstitutionId },
          select: { shortName: true, legalName: true },
        })
      : null;

    const account = await this.prisma.financialAccount.create({
      data: {
        ...this.buildPersistablePayload(dto),
        // Obrigatórios na criação: o helper os declara opcionais por servir também à edição.
        name: dto.name.trim(),
        accountType: dto.accountType,
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        displayName: buildDisplayName(
          dto.displayName,
          institution?.shortName ?? institution?.legalName,
          dto.name.trim(),
        ),
        normalizedAccountIdentifier: buildAccountIdentifier(dto),
        normalizedHolderDocument: dto.holderDocument
          ? onlyDigits(dto.holderDocument)
          : null,
        thirdPartyApprovedBy: dto.isThirdParty ? actor.id : null,
        thirdPartyApprovedAt: dto.isThirdParty ? new Date() : null,
        status,
        createdBy: actor.id,
      },
      include: ACCOUNT_INCLUDE,
    });

    await this.recordStatusChange(account.id, null, status, null, actor);

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE',
      entity: 'FinancialAccount',
      entityId: account.id,
      newValue: {
        name: account.name,
        accountType: account.accountType,
        isThirdParty: account.isThirdParty,
      },
      reason: dto.thirdPartyReason,
    });

    return this.applyMasking(account, actor);
  }

  async update(id: string, dto: UpdateFinancialAccountDto, actor: RequestUser) {
    const current = await this.prisma.financialAccount.findFirst({
      where: { id, deletedAt: null },
      include: { company: { select: { normalizedDocumentNumber: true } } },
    });
    if (!current)
      throw new NotFoundException('Conta financeira não encontrada.');

    if (current.status === FinancialAccountStatus.CLOSED) {
      throw new ConflictException(
        'Uma conta encerrada não pode ser editada. O histórico dela é registro do que foi movimentado.',
      );
    }

    // Mexer em agência, conta ou titular é alteração crítica: exige permissão própria
    // e fica registrada com valor anterior e novo (seção 46).
    const touchesBankData = [
      dto.branchNumber,
      dto.branchDigit,
      dto.accountNumber,
      dto.accountDigit,
      dto.holderName,
      dto.holderDocument,
    ].some((value) => value !== undefined);

    if (
      touchesBankData &&
      !hasPermissionAnywhere(actor, 'financial_account.view_bank_data')
    ) {
      throw new ForbiddenException(
        'Você não possui permissão para alterar dados bancários.',
      );
    }

    const merged = { ...current, ...dto };

    if (dto.isThirdParty !== undefined || touchesBankData) {
      await this.assertThirdPartyAllowed(
        merged as unknown as CreateFinancialAccountDto,
        { normalizedDocumentNumber: current.company.normalizedDocumentNumber },
        actor,
      );
    }

    if (touchesBankData || dto.financialInstitutionId !== undefined) {
      await this.assertNoDuplicateAccount(
        {
          companyId: current.companyId,
          financialInstitutionId:
            dto.financialInstitutionId ?? current.financialInstitutionId,
          branchNumber: dto.branchNumber ?? current.branchNumber,
          branchDigit: dto.branchDigit ?? current.branchDigit,
          accountNumber: dto.accountNumber ?? current.accountNumber,
          accountDigit: dto.accountDigit ?? current.accountDigit,
        } as CreateFinancialAccountDto,
        id,
      );
    }

    const account = await this.prisma.financialAccount.update({
      where: { id },
      data: {
        ...this.buildPersistablePayload(dto),
        ...(touchesBankData
          ? {
              normalizedAccountIdentifier: buildAccountIdentifier({
                financialInstitutionId:
                  dto.financialInstitutionId ?? current.financialInstitutionId,
                branchNumber: dto.branchNumber ?? current.branchNumber,
                branchDigit: dto.branchDigit ?? current.branchDigit,
                accountNumber: dto.accountNumber ?? current.accountNumber,
                accountDigit: dto.accountDigit ?? current.accountDigit,
              }),
            }
          : {}),
        ...(dto.holderDocument !== undefined
          ? {
              normalizedHolderDocument: dto.holderDocument
                ? onlyDigits(dto.holderDocument)
                : null,
            }
          : {}),
        updatedBy: actor.id,
      },
      include: ACCOUNT_INCLUDE,
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: touchesBankData ? 'UPDATE_BANK_DATA' : 'UPDATE',
      entity: 'FinancialAccount',
      entityId: id,
      // Nos dados bancários grava-se apenas o que mudou, sem repetir o número completo
      // da conta na trilha de auditoria.
      oldValue: touchesBankData
        ? {
            branchNumber: current.branchNumber,
            accountNumber: current.accountNumber,
          }
        : { name: current.name },
      newValue: touchesBankData
        ? {
            branchNumber: account.branchNumber,
            accountNumber: account.accountNumber,
          }
        : { name: account.name },
    });

    return this.applyMasking(account, actor);
  }

  /** Campos que vêm direto do DTO para a tabela, sem transformação. */
  private buildPersistablePayload(
    dto: CreateFinancialAccountDto | UpdateFinancialAccountDto,
  ) {
    return {
      internalCode: dto.internalCode,
      name: dto.name?.trim(),
      accountType: dto.accountType,
      purpose: dto.purpose,
      financialInstitutionId: dto.financialInstitutionId,
      businessUnitId: dto.businessUnitId,
      costCenterId: dto.costCenterId,
      accountPlanId: dto.accountPlanId,
      financialNatureId: dto.financialNatureId,
      branchNumber: dto.branchNumber,
      branchDigit: dto.branchDigit,
      accountNumber: dto.accountNumber,
      accountDigit: dto.accountDigit,
      holderName: dto.holderName,
      holderDocument: dto.holderDocument,
      isThirdParty: dto.isThirdParty,
      thirdPartyReason: dto.thirdPartyReason,
      country: dto.country,
      swiftCode: dto.swiftCode,
      iban: dto.iban,
      agreementNumber: dto.agreementNumber,
      bankClientCode: dto.bankClientCode,
      walletNumber: dto.walletNumber,
      walletVariation: dto.walletVariation,
      assignorCode: dto.assignorCode,
      bankNotes: dto.bankNotes,
      physicalLocation: dto.physicalLocation,
      responsibleUserId: dto.responsibleUserId,
      requiresDailyClosing: dto.requiresDailyClosing,
      checkFrequencyDays: dto.checkFrequencyDays,
      currencyCode: dto.currencyCode,
      isPrimary: dto.isPrimary,
      isDefaultForPayments: dto.isDefaultForPayments,
      isDefaultForReceipts: dto.isDefaultForReceipts,
      isDefaultForTaxes: dto.isDefaultForTaxes,
      isDefaultForPayroll: dto.isDefaultForPayroll,
      isDefaultForTransfers: dto.isDefaultForTransfers,
      allowsNegativeBalance: dto.allowsNegativeBalance,
      allowsManualEntries: dto.allowsManualEntries,
      allowsImports: dto.allowsImports,
      allowsIntegrations: dto.allowsIntegrations,
      allowsRetroactiveEntries: dto.allowsRetroactiveEntries,
      requiresAttachment: dto.requiresAttachment,
      requiresHistory: dto.requiresHistory,
      requiresCategory: dto.requiresCategory,
      reconciliationMode: dto.reconciliationMode,
      feeCategoryId: dto.feeCategoryId,
      interestPaidCategoryId: dto.interestPaidCategoryId,
      interestEarnedCategoryId: dto.interestEarnedCategoryId,
      iofCategoryId: dto.iofCategoryId,
      yieldCategoryId: dto.yieldCategoryId,
      transferCategoryId: dto.transferCategoryId,
      investmentCategoryId: dto.investmentCategoryId,
      redemptionCategoryId: dto.redemptionCategoryId,
      reversalCategoryId: dto.reversalCategoryId,
      minimumRecommendedBalance: dto.minimumRecommendedBalance,
      maximumRecommendedBalance: dto.maximumRecommendedBalance,
      blockedBalance: dto.blockedBalance,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      notes: dto.notes,
    };
  }

  // ── Validações ────────────────────────────────────────────────────────────

  private async assertCompanyInOrganization(
    companyId: string,
    organizationId: string,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        normalizedDocumentNumber: true,
      },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada.');

    // Sem esta checagem, um payload poderia vincular a conta a uma empresa de outra
    // organização e furar o isolamento entre clientes do BPO.
    if (company.organizationId !== organizationId) {
      throw new BadRequestException(
        'A empresa informada não pertence a esta organização.',
      );
    }

    return company;
  }

  private assertBankFieldsPresent(dto: CreateFinancialAccountDto) {
    if (!isBankAccount(dto.accountType)) return;

    const missing: string[] = [];
    if (!dto.financialInstitutionId) missing.push('a instituição financeira');
    if (!dto.branchNumber) missing.push('a agência');
    if (!dto.accountNumber) missing.push('o número da conta');

    if (missing.length > 0) {
      throw new BadRequestException(
        `Para este tipo de conta, informe ${missing.join(', ')}.`,
      );
    }
  }

  /**
   * Conta de terceiro: o titular difere da empresa. Exige justificativa, permissão
   * específica e — quando os parâmetros da empresa proíbem — é recusada de vez.
   */
  private async assertThirdPartyAllowed(
    dto: Pick<
      CreateFinancialAccountDto,
      | 'isThirdParty'
      | 'thirdPartyReason'
      | 'holderDocument'
      | 'companyId'
      | 'isPrimary'
    >,
    company: { normalizedDocumentNumber: string | null },
    actor: RequestUser,
  ) {
    const holderDocument = dto.holderDocument
      ? onlyDigits(dto.holderDocument)
      : null;

    const documentsDiffer =
      Boolean(holderDocument) &&
      Boolean(company.normalizedDocumentNumber) &&
      holderDocument !== company.normalizedDocumentNumber;

    // O sinalizador não é aceito pelo valor de face: se os documentos batem, não é
    // conta de terceiro; se divergem, é — ainda que o payload diga o contrário.
    if (!documentsDiffer && !dto.isThirdParty) return;

    if (documentsDiffer && !dto.isThirdParty) {
      throw new BadRequestException(
        'O titular da conta é diferente da empresa selecionada. Confirme que é uma conta de terceiro e informe o motivo.',
      );
    }

    if (!dto.thirdPartyReason?.trim()) {
      throw new BadRequestException(
        'Informe o motivo da utilização de uma conta de terceiro.',
      );
    }

    if (!hasPermissionAnywhere(actor, 'treasury.allow_third_party_account')) {
      throw new ForbiddenException(
        'Você não possui permissão para cadastrar contas de terceiro.',
      );
    }

    if (dto.isPrimary) {
      throw new BadRequestException(
        'Uma conta de terceiro não pode ser definida como conta principal da empresa.',
      );
    }

    const settings = dto.companyId
      ? await this.prisma.treasurySettings.findUnique({
          where: { companyId: dto.companyId },
          select: { allowThirdPartyAccounts: true },
        })
      : null;

    if (settings && !settings.allowThirdPartyAccounts) {
      throw new ForbiddenException(
        'Os parâmetros de tesouraria desta empresa não permitem contas de terceiro.',
      );
    }
  }

  /** Impede duas contas com a mesma agência/conta na mesma empresa. */
  private async assertNoDuplicateAccount(
    dto: Pick<
      CreateFinancialAccountDto,
      | 'companyId'
      | 'financialInstitutionId'
      | 'branchNumber'
      | 'branchDigit'
      | 'accountNumber'
      | 'accountDigit'
    >,
    ignoreId?: string,
  ) {
    const identifier = buildAccountIdentifier(dto);
    if (!identifier) return;

    const existing = await this.prisma.financialAccount.findFirst({
      where: {
        companyId: dto.companyId,
        normalizedAccountIdentifier: identifier,
        deletedAt: null,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true, displayName: true, name: true },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma conta com estes dados bancários: "${existing.displayName ?? existing.name}".`,
      );
    }
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  /** Pendências que impedem a ativação (seção 31). */
  async findActivationPendencies(id: string): Promise<string[]> {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: true } } },
    });
    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');

    const pendencies: string[] = [];

    if (isBankAccount(account.accountType)) {
      if (!account.financialInstitutionId) {
        pendencies.push('Informe a instituição financeira.');
      }
      if (!account.branchNumber) pendencies.push('Informe a agência.');
      if (!account.accountNumber) pendencies.push('Informe o número da conta.');
      if (!account.holderDocument) {
        pendencies.push('Confirme a titularidade da conta.');
      }
    }

    if (!account.currencyCode) pendencies.push('Informe a moeda.');

    if (!account.responsibleUserId && account._count.users === 0) {
      pendencies.push('Informe o responsável pela conta.');
    }

    if (!account.accountPlanId) {
      pendencies.push('Defina a conta do plano de contas.');
    }

    return pendencies;
  }

  async activate(id: string, actor: RequestUser) {
    const account = await this.assertTransition(
      id,
      FinancialAccountStatus.ACTIVE,
    );

    const pendencies = await this.findActivationPendencies(id);
    if (pendencies.length > 0) {
      throw new BadRequestException({
        message: 'A conta ainda não pode ser ativada.',
        errors: pendencies,
      });
    }

    return this.changeStatus(
      account,
      FinancialAccountStatus.ACTIVE,
      null,
      actor,
    );
  }

  async block(
    id: string,
    dto: FinancialAccountStatusChangeDto,
    actor: RequestUser,
  ) {
    const account = await this.assertTransition(
      id,
      FinancialAccountStatus.BLOCKED,
    );
    return this.changeStatus(
      account,
      FinancialAccountStatus.BLOCKED,
      dto.reason,
      actor,
    );
  }

  async unblock(
    id: string,
    dto: FinancialAccountStatusChangeDto,
    actor: RequestUser,
  ) {
    const account = await this.scopeOf(id);

    if (account.status !== FinancialAccountStatus.BLOCKED) {
      throw new ConflictException('Esta conta não está bloqueada.');
    }

    return this.changeStatus(
      account,
      FinancialAccountStatus.ACTIVE,
      dto.reason,
      actor,
    );
  }

  async suspend(
    id: string,
    dto: FinancialAccountStatusChangeDto,
    actor: RequestUser,
  ) {
    const account = await this.assertTransition(
      id,
      FinancialAccountStatus.SUSPENDED,
    );
    return this.changeStatus(
      account,
      FinancialAccountStatus.SUSPENDED,
      dto.reason,
      actor,
    );
  }

  async deactivate(
    id: string,
    dto: FinancialAccountStatusChangeDto,
    actor: RequestUser,
  ) {
    const account = await this.assertTransition(
      id,
      FinancialAccountStatus.INACTIVE,
    );
    return this.changeStatus(
      account,
      FinancialAccountStatus.INACTIVE,
      dto.reason,
      actor,
    );
  }

  /**
   * Encerramento (seção 34): exige data, saldo final e motivo. Não é reversível por
   * reativação simples — o histórico permanece, mas a conta não volta a operar.
   */
  async close(id: string, dto: CloseFinancialAccountDto, actor: RequestUser) {
    const account = await this.assertTransition(
      id,
      FinancialAccountStatus.CLOSED,
    );

    const updated = await this.prisma.financialAccount.update({
      where: { id },
      data: {
        status: FinancialAccountStatus.CLOSED,
        closingDate: new Date(dto.closingDate),
        closingBalance: dto.closingBalance,
        closingReason: dto.reason,
        closingDocumentId: dto.closingDocumentId,
        updatedBy: actor.id,
      },
    });

    await this.recordStatusChange(
      id,
      account.status,
      FinancialAccountStatus.CLOSED,
      dto.reason,
      actor,
    );

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'CLOSE',
      entity: 'FinancialAccount',
      entityId: id,
      oldValue: { status: account.status },
      newValue: {
        status: FinancialAccountStatus.CLOSED,
        closingDate: dto.closingDate,
      },
      reason: dto.reason,
    });

    return updated;
  }

  private async assertTransition(id: string, next: FinancialAccountStatus) {
    const account = await this.scopeOf(id);
    const allowed = STATUS_TRANSITIONS[account.status];

    if (!allowed.includes(next)) {
      throw new ConflictException(
        `Uma conta ${STATUS_LABELS[account.status]} não pode passar para "${STATUS_LABELS[next]}".`,
      );
    }

    return account;
  }

  private async changeStatus(
    account: {
      id: string;
      organizationId: string;
      companyId: string;
      status: FinancialAccountStatus;
    },
    next: FinancialAccountStatus,
    reason: string | null,
    actor: RequestUser,
  ) {
    const updated = await this.prisma.financialAccount.update({
      where: { id: account.id },
      data: { status: next, updatedBy: actor.id },
    });

    await this.recordStatusChange(
      account.id,
      account.status,
      next,
      reason,
      actor,
    );

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: `STATUS_${next}`,
      entity: 'FinancialAccount',
      entityId: account.id,
      field: 'status',
      oldValue: { status: account.status },
      newValue: { status: next },
      reason,
    });

    return updated;
  }

  private recordStatusChange(
    financialAccountId: string,
    previousStatus: FinancialAccountStatus | null,
    newStatus: FinancialAccountStatus,
    reason: string | null,
    actor: RequestUser,
  ) {
    return this.prisma.financialAccountStatusHistory.create({
      data: {
        financialAccountId,
        previousStatus,
        newStatus,
        reason,
        changedBy: actor.id,
      },
    });
  }

  // ── Uso e exclusão ────────────────────────────────────────────────────────

  /**
   * Vínculos da conta. O front-end usa isso para explicar por que a exclusão está
   * bloqueada e oferecer inativar ou encerrar no lugar (seção 35).
   */
  async usage(id: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            openingBalances: true,
            limits: true,
            pixKeys: true,
            users: true,
            integrations: true,
            cards: true,
            receiptMethods: true,
          },
        },
      },
    });

    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');

    const relations = [
      { label: 'Saldos iniciais', count: account._count.openingBalances },
      { label: 'Limites', count: account._count.limits },
      { label: 'Chaves PIX', count: account._count.pixKeys },
      { label: 'Usuários vinculados', count: account._count.users },
      { label: 'Integrações', count: account._count.integrations },
      { label: 'Cartões', count: account._count.cards },
      { label: 'Formas de recebimento', count: account._count.receiptMethods },
    ];

    const total = relations.reduce((sum, item) => sum + item.count, 0);

    return {
      id,
      status: account.status,
      inUse: total > 0,
      // Só rascunho sem nenhum vínculo pode ser excluído fisicamente.
      canDelete: total === 0 && account.status === FinancialAccountStatus.DRAFT,
      total,
      relations,
    };
  }

  async remove(id: string, actor: RequestUser) {
    const usage = await this.usage(id);
    const account = await this.scopeOf(id);

    if (account.status !== FinancialAccountStatus.DRAFT) {
      throw new ConflictException(
        'Somente contas em rascunho podem ser excluídas. Utilize as opções Inativar ou Encerrar.',
      );
    }

    if (usage.inUse) {
      throw new ConflictException(
        'Esta conta possui registros vinculados e não pode ser excluída. Utilize a opção Inativar ou Encerrar.',
      );
    }

    await this.prisma.financialAccount.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'FinancialAccount',
      entityId: id,
    });

    return { id };
  }

  /** Trilha de auditoria da conta, incluindo o histórico de status. */
  async findAudit(id: string) {
    const account = await this.scopeOf(id);

    const [statusHistory, auditLogs] = await Promise.all([
      this.prisma.financialAccountStatusHistory.findMany({
        where: { financialAccountId: id },
        orderBy: { changedAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { entity: 'FinancialAccount', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return { accountId: account.id, statusHistory, auditLogs };
  }
}
