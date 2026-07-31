import { Injectable } from '@nestjs/common';
import {
  BankStatementSourceType,
  ReconciliationHistoryAction,
  type ReconciliationSettings,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import type { UpdateReconciliationSettingsDto } from './dto/reconciliation.dto';

/** Formatos que este módulo efetivamente lê (seção 9). */
export const IMPLEMENTED_SOURCES: BankStatementSourceType[] = [
  BankStatementSourceType.OFX,
  BankStatementSourceType.CSV,
  BankStatementSourceType.XLSX,
  BankStatementSourceType.MANUAL,
];

/**
 * Parâmetros da conciliação (seções 47 e 60).
 *
 * A configuração é resolvida em duas camadas: a da **conta** vence a da **empresa**. Uma
 * conta de investimento e uma conta corrente não têm a mesma tolerância nem aceitam os
 * mesmos formatos, e uma configuração só forçaria a mais restritiva às duas.
 */
@Injectable()
export class ReconciliationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Configuração efetiva: a da conta, ou a da empresa quando a conta não tem a sua. */
  async resolve(
    organizationId: string,
    companyId: string,
    financialAccountId?: string | null,
  ): Promise<ReconciliationSettings> {
    if (financialAccountId) {
      const specific = await this.prisma.reconciliationSettings.findFirst({
        where: { companyId, financialAccountId },
      });

      if (specific) return specific;
    }

    return this.companyDefaults(organizationId, companyId);
  }

  /** Configuração da empresa, criada com os padrões na primeira leitura. */
  async companyDefaults(
    organizationId: string,
    companyId: string,
  ): Promise<ReconciliationSettings> {
    const existing = await this.prisma.reconciliationSettings.findFirst({
      where: { companyId, financialAccountId: null },
    });

    if (existing) return existing;

    return this.prisma.reconciliationSettings.create({
      data: {
        organizationId,
        companyId,
        // Só o que o módulo sabe ler. Os canais de integração aparecem na tela como
        // "não configurado" enquanto o módulo de integração não existir.
        allowedImportTypes: IMPLEMENTED_SOURCES,
      },
    });
  }

  /** Todas as configurações da empresa: a geral e as exceções por conta. */
  async listForCompany(organizationId: string, companyId: string) {
    const company = await this.companyDefaults(organizationId, companyId);

    const perAccount = await this.prisma.reconciliationSettings.findMany({
      where: { companyId, NOT: { financialAccountId: null } },
      include: {
        financialAccount: {
          select: {
            id: true,
            name: true,
            displayName: true,
            accountType: true,
          },
        },
      },
    });

    return { company, perAccount };
  }

  async update(
    organizationId: string,
    companyId: string,
    dto: UpdateReconciliationSettingsDto,
    actor: RequestActor,
  ) {
    const { financialAccountId, ...fields } = dto;

    const before = await this.resolve(
      organizationId,
      companyId,
      financialAccountId,
    );

    const existing = await this.prisma.reconciliationSettings.findFirst({
      where: { companyId, financialAccountId: financialAccountId ?? null },
      select: { id: true },
    });

    const updated = existing
      ? await this.prisma.reconciliationSettings.update({
          where: { id: existing.id },
          data: { ...fields, updatedBy: actor.id },
        })
      : await this.prisma.reconciliationSettings.create({
          data: {
            organizationId,
            companyId,
            financialAccountId: financialAccountId ?? null,
            // Herdar da empresa em vez de recomeçar dos padrões: quem cria uma exceção de
            // conta quer mudar um item, não redefinir tudo.
            allowedImportTypes: before.allowedImportTypes,
            amountTolerance: before.amountTolerance,
            percentageTolerance: before.percentageTolerance,
            dateToleranceDays: before.dateToleranceDays,
            minimumSuggestionScore: before.minimumSuggestionScore,
            ...fields,
            createdBy: actor.id,
          },
        });

    await this.prisma.reconciliationHistory.create({
      data: {
        organizationId,
        companyId,
        financialAccountId: financialAccountId ?? null,
        actionType: ReconciliationHistoryAction.SETTINGS_CHANGED,
        details: fields,
        performedBy: actor.id,
        ipAddress: actor.ipAddress,
        deviceInfo: actor.userAgent,
      },
    });

    await this.audit.log({
      organizationId,
      companyId,
      userId: actor.id,
      action: 'reconciliation.settings_updated',
      entity: 'ReconciliationSettings',
      entityId: updated.id,
      oldValue: before,
      newValue: fields,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /**
   * Contas elegíveis da empresa, com a configuração de cada uma (seção 8).
   *
   * Devolve a conta **e** o que ela aceita — a tela precisa dos dois juntos para dizer
   * "esta conta não aceita CSV" antes de a pessoa escolher o arquivo.
   */
  async eligibleAccounts(organizationId: string, companyId: string) {
    const [accounts, settings, company] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          displayName: true,
          accountType: true,
          status: true,
          financialInstitution: {
            select: { id: true, shortName: true, legalName: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.reconciliationSettings.findMany({
        where: { companyId, NOT: { financialAccountId: null } },
      }),
      this.companyDefaults(organizationId, companyId),
    ]);

    const lastImports = await this.prisma.bankStatementImport.groupBy({
      by: ['financialAccountId'],
      where: { companyId, deletedAt: null },
      _max: { importedAt: true },
      orderBy: { financialAccountId: 'asc' },
    });

    return accounts.map((account) => {
      const specific = settings.find(
        (item) => item.financialAccountId === account.id,
      );
      const effective = specific ?? company;

      return {
        account,
        settingsId: specific?.id ?? null,
        inheritsFromCompany: !specific,
        isEnabled: effective.isEnabled,
        allowedImportTypes: effective.allowedImportTypes,
        maximumFileSize: effective.maximumFileSize,
        amountTolerance: effective.amountTolerance,
        percentageTolerance: effective.percentageTolerance,
        dateToleranceDays: effective.dateToleranceDays,
        minimumSuggestionScore: effective.minimumSuggestionScore,
        manualTransactionEnabled: effective.manualTransactionEnabled,
        partialMatchEnabled: effective.partialMatchEnabled,
        multipleMatchEnabled: effective.multipleMatchEnabled,
        unmatchEnabled: effective.unmatchEnabled,
        lastImportedAt:
          lastImports.find((item) => item.financialAccountId === account.id)
            ?._max.importedAt ?? null,
      };
    });
  }
}
