import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BankIntegrationStatus,
  OpeningBalanceStatus,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { onlyDigits } from '../../common/utils/normalize.util';
import { hasPermissionAnywhere } from '../../common/utils/access-control.util';
import { AuditService } from '../audit/audit.service';
import {
  CreateAccountIntegrationDto,
  CreateAccountLimitDto,
  CreateCompanyPixKeyDto,
  CreateOpeningBalanceDto,
  UpdateAccountIntegrationDto,
  UpdateAccountLimitDto,
  UpdateCompanyPixKeyDto,
  UpsertAccountUserDto,
} from './dto/account-details.dto';
import { assertValidPixKey, normalizePixKey } from './utils/pix-key.util';
import { maskPixKey } from './utils/treasury-mask.util';

/**
 * Padrões que denunciam uma credencial enviada por engano no lugar da referência ao
 * cofre. Guardar isso no banco vazaria o segredo em backups, logs e telas.
 */
const SECRET_LIKE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^[A-Za-z0-9+/]{60,}={0,2}$/,
  /"(client_secret|password|secret|token|api_key)"\s*:/i,
];

@Injectable()
export class AccountDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadAccount(financialAccountId: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: financialAccountId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        status: true,
        accountType: true,
      },
    });

    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');
    return account;
  }

  // ── Saldo inicial (seções 18 e 19) ────────────────────────────────────────

  findOpeningBalances(financialAccountId: string) {
    return this.prisma.financialAccountOpeningBalance.findMany({
      where: { financialAccountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registra o saldo de implantação. Quando já existe um saldo aprovado, a correção
   * exige justificativa e permissão — e o registro anterior vira `SUPERSEDED` em vez de
   * ser sobrescrito, porque ele é a prova do que valia antes.
   */
  async createOpeningBalance(
    financialAccountId: string,
    dto: CreateOpeningBalanceDto,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);

    const current = await this.prisma.financialAccountOpeningBalance.findFirst({
      where: { financialAccountId, status: OpeningBalanceStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
    });

    if (current) {
      if (!dto.reason?.trim()) {
        throw new BadRequestException(
          'Esta conta já possui saldo inicial registrado. O saldo inicial não pode ser alterado sem justificativa.',
        );
      }

      if (
        !hasPermissionAnywhere(
          actor,
          'financial_account.manage_initial_balance',
        )
      ) {
        throw new ForbiddenException(
          'Você não possui permissão para alterar o saldo inicial desta conta.',
        );
      }

      const settings = await this.prisma.treasurySettings.findUnique({
        where: { companyId: account.companyId },
        select: { allowOpeningBalanceChange: true },
      });

      if (settings && !settings.allowOpeningBalanceChange) {
        throw new ForbiddenException(
          'Os parâmetros de tesouraria desta empresa não permitem alterar o saldo inicial.',
        );
      }
    }

    const balance = await this.prisma.$transaction(async (tx) => {
      if (current) {
        // O saldo anterior permanece na tabela como histórico do que estava valendo.
        await tx.financialAccountOpeningBalance.update({
          where: { id: current.id },
          data: { status: OpeningBalanceStatus.SUPERSEDED },
        });
      }

      return tx.financialAccountOpeningBalance.create({
        data: {
          financialAccountId,
          balanceDate: new Date(dto.balanceDate),
          balanceAmount: dto.balanceAmount,
          balanceType: dto.balanceType,
          source: dto.source,
          documentAttachmentId: dto.documentAttachmentId,
          reason: dto.reason,
          status: OpeningBalanceStatus.APPROVED,
          createdBy: actor.id,
          approvedBy: actor.id,
          approvedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: current ? 'UPDATE_OPENING_BALANCE' : 'CREATE_OPENING_BALANCE',
      entity: 'FinancialAccountOpeningBalance',
      entityId: balance.id,
      field: 'balanceAmount',
      oldValue: current
        ? {
            balanceAmount: current.balanceAmount.toString(),
            balanceDate: current.balanceDate.toISOString(),
          }
        : undefined,
      newValue: {
        balanceAmount: String(dto.balanceAmount),
        balanceDate: dto.balanceDate,
      },
      reason: dto.reason,
    });

    return balance;
  }

  // ── Limites bancários (seção 21) ──────────────────────────────────────────

  findLimits(financialAccountId: string) {
    return this.prisma.financialAccountLimit.findMany({
      where: { financialAccountId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLimit(
    financialAccountId: string,
    dto: CreateAccountLimitDto,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);
    this.assertDateRange(dto.startDate, dto.endDate);

    const limit = await this.prisma.financialAccountLimit.create({
      data: {
        financialAccountId,
        limitType: dto.limitType,
        contractedAmount: dto.contractedAmount,
        interestRate: dto.interestRate,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        documentAttachmentId: dto.documentAttachmentId,
        responsibleUserId: dto.responsibleUserId,
        notes: dto.notes,
        status: dto.status,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'CREATE_LIMIT',
      entity: 'FinancialAccountLimit',
      entityId: limit.id,
      newValue: {
        limitType: dto.limitType,
        contractedAmount: String(dto.contractedAmount),
      },
    });

    return limit;
  }

  async updateLimit(
    financialAccountId: string,
    limitId: string,
    dto: UpdateAccountLimitDto,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);

    const current = await this.prisma.financialAccountLimit.findFirst({
      where: { id: limitId, financialAccountId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Limite não encontrado.');

    this.assertDateRange(
      dto.startDate ?? current.startDate?.toISOString(),
      dto.endDate ?? current.endDate?.toISOString(),
    );

    const limit = await this.prisma.financialAccountLimit.update({
      where: { id: limitId },
      data: {
        limitType: dto.limitType,
        contractedAmount: dto.contractedAmount,
        interestRate: dto.interestRate,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        documentAttachmentId: dto.documentAttachmentId,
        responsibleUserId: dto.responsibleUserId,
        notes: dto.notes,
        status: dto.status,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'UPDATE_LIMIT',
      entity: 'FinancialAccountLimit',
      entityId: limitId,
      oldValue: { contractedAmount: current.contractedAmount.toString() },
      newValue: { contractedAmount: String(limit.contractedAmount) },
    });

    return limit;
  }

  private assertDateRange(start?: string | null, end?: string | null) {
    if (start && end && new Date(end) <= new Date(start)) {
      throw new BadRequestException(
        'A data final deve ser posterior à data inicial.',
      );
    }
  }

  // ── Chaves PIX da empresa (seções 22 e 23) ────────────────────────────────

  async findPixKeys(
    organizationId: string,
    filters: {
      companyId?: string;
      financialAccountId?: string;
      status?: RecordStatus;
    },
    actor: RequestUser,
  ) {
    const keys = await this.prisma.companyPixKey.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.financialAccountId
          ? { financialAccountId: filters.financialAccountId }
          : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        financialAccount: {
          select: { id: true, displayName: true, name: true },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    if (hasPermissionAnywhere(actor, 'treasury.view_sensitive_data'))
      return keys;
    return keys.map((key) => maskPixKey(key));
  }

  /** Escopo da chave, para o controller validar a permissão antes de qualquer ação. */
  async pixKeyScopeOf(id: string) {
    const key = await this.prisma.companyPixKey.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, organizationId: true, companyId: true },
    });

    if (!key) throw new NotFoundException('Chave PIX não encontrada.');
    return key;
  }

  async findPixKey(id: string, actor: RequestUser) {
    const key = await this.prisma.companyPixKey.findFirst({
      where: { id, deletedAt: null },
      include: {
        financialAccount: {
          select: { id: true, displayName: true, name: true },
        },
      },
    });

    if (!key) throw new NotFoundException('Chave PIX não encontrada.');

    return hasPermissionAnywhere(actor, 'treasury.view_sensitive_data')
      ? key
      : maskPixKey(key);
  }

  async createPixKey(dto: CreateCompanyPixKeyDto, actor: RequestUser) {
    assertValidPixKey(dto.pixType, dto.pixKey);
    const normalizedKey = normalizePixKey(dto.pixType, dto.pixKey);

    await this.assertPixKeyIsUnique(dto.companyId, normalizedKey);

    if (dto.financialAccountId) {
      const account = await this.loadAccount(dto.financialAccountId);
      if (account.companyId !== dto.companyId) {
        throw new BadRequestException(
          'A conta informada pertence a outra empresa.',
        );
      }
    }

    const key = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) await this.demoteOtherPrimaryKeys(tx, dto.companyId);

      return tx.companyPixKey.create({
        data: {
          organizationId: dto.organizationId,
          companyId: dto.companyId,
          financialAccountId: dto.financialAccountId,
          financialInstitutionId: dto.financialInstitutionId,
          pixType: dto.pixType,
          pixKey: dto.pixKey.trim(),
          normalizedKey,
          holderName: dto.holderName,
          holderDocument: dto.holderDocument,
          normalizedHolderDocument: dto.holderDocument
            ? onlyDigits(dto.holderDocument)
            : null,
          purpose: dto.purpose,
          isPrimary: dto.isPrimary ?? false,
          isForBilling: dto.isForBilling ?? false,
          isForSuppliers: dto.isForSuppliers ?? false,
          isForCustomers: dto.isForCustomers ?? false,
          proofDocumentId: dto.proofDocumentId,
          notes: dto.notes,
          createdBy: actor.id,
        },
      });
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'CREATE_PIX_KEY',
      entity: 'CompanyPixKey',
      entityId: key.id,
      // O valor da chave não vai para a auditoria: o tipo e a finalidade bastam.
      newValue: { pixType: dto.pixType, purpose: dto.purpose ?? 'GENERAL' },
    });

    return key;
  }

  async updatePixKey(
    id: string,
    dto: UpdateCompanyPixKeyDto,
    actor: RequestUser,
  ) {
    const current = await this.prisma.companyPixKey.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Chave PIX não encontrada.');

    let normalizedKey = current.normalizedKey;

    if (dto.pixKey || dto.pixType) {
      const pixType = dto.pixType ?? current.pixType;
      const pixKey = dto.pixKey ?? current.pixKey;
      assertValidPixKey(pixType, pixKey);
      normalizedKey = normalizePixKey(pixType, pixKey);

      if (normalizedKey !== current.normalizedKey) {
        await this.assertPixKeyIsUnique(current.companyId, normalizedKey);
      }
    }

    const key = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await this.demoteOtherPrimaryKeys(tx, current.companyId, id);
      }

      return tx.companyPixKey.update({
        where: { id },
        data: {
          financialAccountId: dto.financialAccountId,
          financialInstitutionId: dto.financialInstitutionId,
          pixType: dto.pixType,
          pixKey: dto.pixKey?.trim(),
          normalizedKey,
          holderName: dto.holderName,
          holderDocument: dto.holderDocument,
          ...(dto.holderDocument !== undefined
            ? {
                normalizedHolderDocument: dto.holderDocument
                  ? onlyDigits(dto.holderDocument)
                  : null,
              }
            : {}),
          purpose: dto.purpose,
          isPrimary: dto.isPrimary,
          isForBilling: dto.isForBilling,
          isForSuppliers: dto.isForSuppliers,
          isForCustomers: dto.isForCustomers,
          proofDocumentId: dto.proofDocumentId,
          notes: dto.notes,
          updatedBy: actor.id,
        },
      });
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE_PIX_KEY',
      entity: 'CompanyPixKey',
      entityId: id,
      oldValue: { pixType: current.pixType },
      newValue: { pixType: key.pixType },
    });

    return key;
  }

  async setPixKeyStatus(id: string, status: RecordStatus, actor: RequestUser) {
    const current = await this.prisma.companyPixKey.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Chave PIX não encontrada.');

    const key = await this.prisma.companyPixKey.update({
      where: { id },
      data: { status, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: status === RecordStatus.ACTIVE ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'CompanyPixKey',
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status },
    });

    return key;
  }

  async removePixKey(id: string, actor: RequestUser) {
    const current = await this.prisma.companyPixKey.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Chave PIX não encontrada.');

    await this.prisma.companyPixKey.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'CompanyPixKey',
      entityId: id,
      oldValue: { pixType: current.pixType },
    });

    return { id };
  }

  /**
   * A mesma chave não pode ser cadastrada duas vezes na empresa. A mensagem cita a
   * conta que já a usa, para o usuário conseguir chegar lá.
   */
  private async assertPixKeyIsUnique(companyId: string, normalizedKey: string) {
    const existing = await this.prisma.companyPixKey.findFirst({
      where: { companyId, normalizedKey, deletedAt: null },
      include: {
        financialAccount: { select: { displayName: true, name: true } },
      },
    });

    if (existing) {
      const accountName =
        existing.financialAccount?.displayName ??
        existing.financialAccount?.name ??
        'outra conta';
      throw new ConflictException(
        `Esta chave PIX já está cadastrada na conta "${accountName}".`,
      );
    }
  }

  /** Só uma chave principal por empresa. */
  private demoteOtherPrimaryKeys(
    tx: Prisma.TransactionClient,
    companyId: string,
    ignoreId?: string,
  ) {
    return tx.companyPixKey.updateMany({
      where: {
        companyId,
        isPrimary: true,
        deletedAt: null,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      data: { isPrimary: false },
    });
  }

  // ── Usuários da conta (seção 24) ──────────────────────────────────────────

  findUsers(financialAccountId: string) {
    return this.prisma.financialAccountUser.findMany({
      where: { financialAccountId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Vincula ou atualiza um usuário na conta. É `upsert` porque revincular alguém que
   * já esteve na conta é o caso comum, e um erro de chave duplicada aqui não ajudaria.
   */
  async upsertUser(
    financialAccountId: string,
    dto: UpsertAccountUserDto,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);

    const data = {
      roleId: dto.roleId,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      viewLimit: dto.viewLimit,
      transactionLimit: dto.transactionLimit,
      approvalLimit: dto.approvalLimit,
      canViewBalance: dto.canViewBalance,
      canViewBankData: dto.canViewBankData,
      canCreateEntry: dto.canCreateEntry,
      canImportStatement: dto.canImportStatement,
      canReconcile: dto.canReconcile,
      canSchedulePayment: dto.canSchedulePayment,
      canAuthorizePayment: dto.canAuthorizePayment,
      canUpdateOpeningBalance: dto.canUpdateOpeningBalance,
      canUpdateLimits: dto.canUpdateLimits,
      canManageIntegration: dto.canManageIntegration,
      canExport: dto.canExport,
      status: dto.status,
    };

    const link = await this.prisma.financialAccountUser.upsert({
      where: {
        financialAccountId_userId: { financialAccountId, userId: dto.userId },
      },
      create: {
        financialAccountId,
        userId: dto.userId,
        ...data,
        createdBy: actor.id,
      },
      update: { ...data, deletedAt: null },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'UPSERT_ACCOUNT_USER',
      entity: 'FinancialAccountUser',
      entityId: link.id,
      newValue: {
        userId: dto.userId,
        canAuthorizePayment: dto.canAuthorizePayment ?? false,
        approvalLimit: dto.approvalLimit ? String(dto.approvalLimit) : null,
      },
    });

    return link;
  }

  async removeUser(
    financialAccountId: string,
    userId: string,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);

    const link = await this.prisma.financialAccountUser.findFirst({
      where: { financialAccountId, userId, deletedAt: null },
    });
    if (!link)
      throw new NotFoundException('Usuário não vinculado a esta conta.');

    await this.prisma.financialAccountUser.update({
      where: { id: link.id },
      data: { deletedAt: new Date(), status: RecordStatus.INACTIVE },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'REMOVE_ACCOUNT_USER',
      entity: 'FinancialAccountUser',
      entityId: link.id,
      oldValue: { userId },
    });

    return { id: link.id };
  }

  // ── Integrações bancárias (seções 26 a 28) ────────────────────────────────

  async findIntegrations(financialAccountId: string) {
    const integrations = await this.prisma.financialAccountIntegration.findMany(
      {
        where: { financialAccountId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    );

    // A referência ao cofre nunca sai da API: o front só precisa saber se existe.
    return integrations.map(({ credentialsReference, ...integration }) => ({
      ...integration,
      hasCredentials: Boolean(credentialsReference),
    }));
  }

  async createIntegration(
    financialAccountId: string,
    dto: CreateAccountIntegrationDto,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);
    this.assertNotASecret(dto.credentialsReference);

    const integration = await this.prisma.financialAccountIntegration.create({
      data: {
        financialAccountId,
        integrationType: dto.integrationType,
        provider: dto.provider,
        externalAccountId: dto.externalAccountId,
        environment: dto.environment,
        supportsBalance: dto.supportsBalance,
        supportsStatements: dto.supportsStatements,
        supportsPayments: dto.supportsPayments,
        supportsBilling: dto.supportsBilling,
        supportsReconciliation: dto.supportsReconciliation,
        credentialsReference: dto.credentialsReference,
        credentialsUpdatedAt: dto.credentialsReference ? new Date() : null,
        nextSyncAt: dto.nextSyncAt ? new Date(dto.nextSyncAt) : null,
        notes: dto.notes,
        status: dto.credentialsReference
          ? BankIntegrationStatus.PENDING
          : BankIntegrationStatus.NOT_CONFIGURED,
        configuredBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'CREATE_INTEGRATION',
      entity: 'FinancialAccountIntegration',
      entityId: integration.id,
      newValue: {
        integrationType: dto.integrationType,
        provider: dto.provider ?? null,
        environment: dto.environment ?? 'SANDBOX',
      },
    });

    const { credentialsReference, ...safe } = integration;
    return { ...safe, hasCredentials: Boolean(credentialsReference) };
  }

  async updateIntegration(
    financialAccountId: string,
    integrationId: string,
    dto: UpdateAccountIntegrationDto,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);
    this.assertNotASecret(dto.credentialsReference);

    const current = await this.prisma.financialAccountIntegration.findFirst({
      where: { id: integrationId, financialAccountId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Integração não encontrada.');

    const integration = await this.prisma.financialAccountIntegration.update({
      where: { id: integrationId },
      data: {
        integrationType: dto.integrationType,
        provider: dto.provider,
        externalAccountId: dto.externalAccountId,
        environment: dto.environment,
        supportsBalance: dto.supportsBalance,
        supportsStatements: dto.supportsStatements,
        supportsPayments: dto.supportsPayments,
        supportsBilling: dto.supportsBilling,
        supportsReconciliation: dto.supportsReconciliation,
        credentialsReference: dto.credentialsReference,
        ...(dto.credentialsReference
          ? { credentialsUpdatedAt: new Date() }
          : {}),
        nextSyncAt: dto.nextSyncAt ? new Date(dto.nextSyncAt) : undefined,
        notes: dto.notes,
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'UPDATE_INTEGRATION',
      entity: 'FinancialAccountIntegration',
      entityId: integrationId,
      // Trocar a credencial é registrado como evento, sem o valor em si.
      newValue: {
        credentialsRotated: Boolean(dto.credentialsReference),
        environment: integration.environment,
      },
    });

    const { credentialsReference, ...safe } = integration;
    return { ...safe, hasCredentials: Boolean(credentialsReference) };
  }

  /**
   * Teste de conexão. Nesta etapa é **simulado**: só confere se a configuração está
   * completa. Nenhuma chamada sai para o banco — a integração real virá depois.
   */
  async testIntegration(
    financialAccountId: string,
    integrationId: string,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);

    const integration = await this.prisma.financialAccountIntegration.findFirst(
      {
        where: { id: integrationId, financialAccountId, deletedAt: null },
      },
    );
    if (!integration) throw new NotFoundException('Integração não encontrada.');

    const problems: string[] = [];
    if (!integration.provider)
      problems.push('Informe o provedor da integração.');
    if (!integration.externalAccountId) {
      problems.push('Informe o identificador da conta no provedor.');
    }
    if (!integration.credentialsReference) {
      problems.push('Configure a credencial no cofre de segredos.');
    }

    const success = problems.length === 0;

    await this.prisma.financialAccountIntegration.update({
      where: { id: integrationId },
      data: {
        status: success
          ? BankIntegrationStatus.PENDING
          : BankIntegrationStatus.ERROR,
        lastErrorCode: success ? null : 'INCOMPLETE_CONFIGURATION',
        lastErrorMessage: success ? null : problems.join(' '),
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: 'TEST_INTEGRATION',
      entity: 'FinancialAccountIntegration',
      entityId: integrationId,
      newValue: { success },
    });

    return {
      success,
      simulated: true,
      message: success
        ? 'Configuração completa. A conexão real será validada quando a integração bancária for habilitada.'
        : 'Configuração incompleta.',
      problems,
    };
  }

  async setIntegrationStatus(
    financialAccountId: string,
    integrationId: string,
    status: BankIntegrationStatus,
    actor: RequestUser,
  ) {
    const account = await this.loadAccount(financialAccountId);

    const current = await this.prisma.financialAccountIntegration.findFirst({
      where: { id: integrationId, financialAccountId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Integração não encontrada.');

    if (
      status === BankIntegrationStatus.ACTIVE &&
      !current.credentialsReference
    ) {
      throw new BadRequestException(
        'Configure a credencial antes de ativar a integração.',
      );
    }

    const integration = await this.prisma.financialAccountIntegration.update({
      where: { id: integrationId },
      data: {
        status,
        // Desconectar apaga o ponteiro: a credencial deixa de ser alcançável pelo sistema.
        ...(status === BankIntegrationStatus.DISCONNECTED
          ? { credentialsReference: null, credentialsUpdatedAt: null }
          : {}),
      },
    });

    await this.audit.log({
      organizationId: account.organizationId,
      companyId: account.companyId,
      userId: actor.id,
      action: `INTEGRATION_${status}`,
      entity: 'FinancialAccountIntegration',
      entityId: integrationId,
      oldValue: { status: current.status },
      newValue: { status },
    });

    const { credentialsReference, ...safe } = integration;
    return { ...safe, hasCredentials: Boolean(credentialsReference) };
  }

  /**
   * Recusa o que parecer credencial de verdade. O campo é um **ponteiro** para o cofre;
   * gravar o segredo aqui o exporia em backups, logs e telas.
   */
  private assertNotASecret(value?: string | null) {
    if (!value) return;

    if (SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(value.trim()))) {
      throw new BadRequestException(
        'Este campo aceita apenas a referência ao segredo no cofre (ex.: "vault://..."), nunca a credencial em si.',
      );
    }
  }
}
