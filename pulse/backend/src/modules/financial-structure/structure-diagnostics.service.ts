import { Injectable } from '@nestjs/common';
import {
  AccountKind,
  AccountPlanVersionStatus,
  DiagnosticSeverity,
  ProjectStatus,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { detectConflicts } from './utils/rule-matching.util';

export interface DiagnosticFinding {
  severity: DiagnosticSeverity;
  code: string;
  title: string;
  detail: string;
  entityType: string;
  affected: { id: string; label: string }[];
}

/**
 * Rotina de diagnóstico da seção 48. Só **detecta e relata** — nada é corrigido
 * automaticamente, porque a correção depende de decisão do usuário (mover, inativar,
 * ajustar prioridade).
 */
@Injectable()
export class StructureDiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  async run(organizationId: string, companyId?: string) {
    const findings: DiagnosticFinding[] = [];

    await Promise.all([
      this.checkCategoriesWithoutAccount(companyId, findings),
      this.checkAnalyticAccountsWithChildren(organizationId, findings),
      this.checkSyntheticAccountsAcceptingEntries(organizationId, findings),
      this.checkCostCentersWithoutResponsible(companyId, findings),
      this.checkExpiredButActive(companyId, findings),
      this.checkFinishedProjectsStillActive(companyId, findings),
      this.checkRulesWithoutConditionOrAction(companyId, findings),
      this.checkConflictingRules(companyId, findings),
      this.checkAllocationTotals(companyId, findings),
      this.checkDuplicateCodes(companyId, findings),
      this.checkStructuresWithoutActiveVersion(
        organizationId,
        companyId,
        findings,
      ),
      this.checkInactiveCategoriesInUse(companyId, findings),
    ]);

    const summary = {
      critical: findings.filter(
        (f) => f.severity === DiagnosticSeverity.CRITICAL,
      ).length,
      warning: findings.filter((f) => f.severity === DiagnosticSeverity.WARNING)
        .length,
      info: findings.filter((f) => f.severity === DiagnosticSeverity.INFO)
        .length,
    };

    return {
      summary,
      total: findings.length,
      // Críticos primeiro: são os que impedem a operação correta do módulo financeiro.
      findings: findings.sort(
        (a, b) =>
          this.severityWeight(a.severity) - this.severityWeight(b.severity),
      ),
    };
  }

  private severityWeight(severity: DiagnosticSeverity): number {
    return severity === DiagnosticSeverity.CRITICAL
      ? 0
      : severity === DiagnosticSeverity.WARNING
        ? 1
        : 2;
  }

  private push(
    findings: DiagnosticFinding[],
    finding: Omit<DiagnosticFinding, 'affected'> & {
      affected: { id: string; label: string }[];
    },
  ) {
    if (finding.affected.length > 0) findings.push(finding);
  }

  // ── Verificações ───────────────────────────────────────────────────────────

  private async checkCategoriesWithoutAccount(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;
    const rows = await this.prisma.financialCategory.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        accountPlanId: null,
      },
      select: { id: true, name: true },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.WARNING,
      code: 'CATEGORY_WITHOUT_ACCOUNT',
      title: 'Categorias sem conta do plano vinculada',
      detail:
        'Sem conta vinculada, estas categorias não aparecerão no DRE gerencial nem no balanço.',
      entityType: 'FinancialCategory',
      affected: rows.map((r) => ({ id: r.id, label: r.name })),
    });
  }

  private async checkAnalyticAccountsWithChildren(
    organizationId: string,
    findings: DiagnosticFinding[],
  ) {
    const rows = await this.prisma.financialAccountPlan.findMany({
      where: {
        organizationId,
        deletedAt: null,
        accountKind: AccountKind.ANALYTICAL,
        children: { some: { deletedAt: null } },
      },
      select: { id: true, code: true, name: true },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.CRITICAL,
      code: 'ANALYTIC_WITH_CHILDREN',
      title: 'Contas analíticas com contas filhas',
      detail:
        'Uma conta analítica recebe lançamentos e não deveria agrupar outras contas. Converta-a em sintética ou mova as filhas.',
      entityType: 'FinancialAccountPlan',
      affected: rows.map((r) => ({ id: r.id, label: `${r.code} ${r.name}` })),
    });
  }

  private async checkSyntheticAccountsAcceptingEntries(
    organizationId: string,
    findings: DiagnosticFinding[],
  ) {
    const rows = await this.prisma.financialAccountPlan.findMany({
      where: {
        organizationId,
        deletedAt: null,
        accountKind: AccountKind.SYNTHETIC,
        acceptsEntries: true,
      },
      select: { id: true, code: true, name: true },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.CRITICAL,
      code: 'SYNTHETIC_ACCEPTS_ENTRIES',
      title: 'Contas sintéticas marcadas para aceitar lançamentos',
      detail:
        'Contas sintéticas apenas consolidam valores. Permitir lançamentos nelas duplicaria valores nos relatórios.',
      entityType: 'FinancialAccountPlan',
      affected: rows.map((r) => ({ id: r.id, label: `${r.code} ${r.name}` })),
    });
  }

  private async checkCostCentersWithoutResponsible(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;
    const rows = await this.prisma.costCenter.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        responsibleUserId: null,
      },
      select: { id: true, name: true },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.INFO,
      code: 'COST_CENTER_WITHOUT_RESPONSIBLE',
      title: 'Centros de custo sem responsável',
      detail:
        'Sem responsável definido, não há a quem direcionar aprovações e alertas.',
      entityType: 'CostCenter',
      affected: rows.map((r) => ({ id: r.id, label: r.name })),
    });
  }

  private async checkExpiredButActive(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;
    const today = new Date();

    const [costCenters, resultCenters] = await Promise.all([
      this.prisma.costCenter.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          endDate: { lt: today },
        },
        select: { id: true, name: true },
        take: 50,
      }),
      this.prisma.resultCenter.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: RecordStatus.ACTIVE,
          endDate: { lt: today },
        },
        select: { id: true, name: true },
        take: 50,
      }),
    ]);

    this.push(findings, {
      severity: DiagnosticSeverity.WARNING,
      code: 'CENTER_EXPIRED_STILL_ACTIVE',
      title: 'Centros com vigência encerrada ainda ativos',
      detail:
        'A data de término já passou, mas o centro continua aceitando novos lançamentos.',
      entityType: 'CostCenter|ResultCenter',
      affected: [...costCenters, ...resultCenters].map((r) => ({
        id: r.id,
        label: r.name,
      })),
    });
  }

  private async checkFinishedProjectsStillActive(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;
    const today = new Date();

    const rows = await this.prisma.project.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [ProjectStatus.IN_PROGRESS, ProjectStatus.PLANNING] },
        endDate: { lt: today },
      },
      select: { id: true, name: true, endDate: true },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.WARNING,
      code: 'PROJECT_PAST_DUE_STILL_OPEN',
      title: 'Projetos com prazo vencido ainda em andamento',
      detail:
        'A data prevista de término já passou. Conclua, prorrogue ou marque o projeto como atrasado.',
      entityType: 'Project',
      affected: rows.map((r) => ({ id: r.id, label: r.name })),
    });
  }

  private async checkRulesWithoutConditionOrAction(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;

    const rows = await this.prisma.classificationRule.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
        OR: [{ conditions: { none: {} } }, { actions: { none: {} } }],
      },
      select: {
        id: true,
        name: true,
        _count: { select: { conditions: true, actions: true } },
      },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.CRITICAL,
      code: 'RULE_INCOMPLETE',
      title: 'Regras sem condição ou sem ação',
      detail:
        'Uma regra sem condição se aplicaria a todo lançamento; sem ação, não classifica nada. Em ambos os casos a regra é inútil ou perigosa.',
      entityType: 'ClassificationRule',
      affected: rows.map((r) => ({
        id: r.id,
        label: `${r.name} (${r._count.conditions} condição/ões, ${r._count.actions} ação/ões)`,
      })),
    });
  }

  private async checkConflictingRules(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;

    const rules = await this.prisma.classificationRule.findMany({
      where: { companyId, deletedAt: null, status: RecordStatus.ACTIVE },
      include: { actions: true },
    });

    const conflicts = detectConflicts(
      rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        actions: rule.actions,
      })),
    );

    this.push(findings, {
      severity: DiagnosticSeverity.CRITICAL,
      code: 'RULE_CONFLICT',
      title: 'Regras conflitantes',
      detail:
        'Regras de mesma prioridade aplicariam valores diferentes na mesma dimensão. Sem desempate, a automação fica suspensa.',
      entityType: 'ClassificationRule',
      affected: conflicts.map((conflict) => ({
        id: conflict.rules[0]?.id ?? '',
        label: `Prioridade ${conflict.priority} · ${conflict.field}: ${conflict.rules.map((r) => r.name).join(' x ')}`,
      })),
    });
  }

  private async checkAllocationTotals(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;

    const rules = await this.prisma.allocationRule.findMany({
      where: { companyId, deletedAt: null, status: RecordStatus.ACTIVE },
      include: { items: true },
    });

    const invalid = rules.filter((rule) => {
      if (rule.criterion !== 'PERCENTAGE') return false;
      const total = rule.items.reduce(
        (sum, item) => sum + Number(item.percentage ?? 0),
        0,
      );
      return Math.abs(total - 100) > 0.01;
    });

    this.push(findings, {
      severity: DiagnosticSeverity.CRITICAL,
      code: 'ALLOCATION_NOT_100',
      title: 'Rateios percentuais que não fecham 100%',
      detail:
        'Um rateio que não fecha 100% distribuiria valor a menos ou a mais nos relatórios.',
      entityType: 'AllocationRule',
      affected: invalid.map((rule) => ({
        id: rule.id,
        label: `${rule.name} (${rule.items
          .reduce((sum, item) => sum + Number(item.percentage ?? 0), 0)
          .toFixed(2)}%)`,
      })),
    });
  }

  private async checkDuplicateCodes(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;

    // Códigos equivalentes após normalização (ex.: "5.02" e "05.2") escapam da
    // constraint de unicidade, que compara o texto literal.
    const categories = await this.prisma.financialCategory.findMany({
      where: { companyId, deletedAt: null, code: { not: null } },
      select: { id: true, name: true, code: true, normalizedCode: true },
    });

    const seen = new Map<string, { id: string; label: string }[]>();
    for (const category of categories) {
      const key = category.normalizedCode ?? category.code ?? '';
      if (!key) continue;
      seen.set(key, [
        ...(seen.get(key) ?? []),
        { id: category.id, label: `${category.code} ${category.name}` },
      ]);
    }

    const duplicated = [...seen.values()]
      .filter((group) => group.length > 1)
      .flat();

    this.push(findings, {
      severity: DiagnosticSeverity.WARNING,
      code: 'DUPLICATE_CODE',
      title: 'Códigos equivalentes em categorias diferentes',
      detail:
        'Dois códigos que só diferem por zeros à esquerda confundem relatórios e importações.',
      entityType: 'FinancialCategory',
      affected: duplicated,
    });
  }

  private async checkStructuresWithoutActiveVersion(
    organizationId: string,
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    const accountCount = await this.prisma.financialAccountPlan.count({
      where: { organizationId, deletedAt: null },
    });
    if (accountCount === 0) return;

    const activeVersion =
      await this.prisma.financialAccountPlanVersion.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          status: AccountPlanVersionStatus.ACTIVE,
          ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
        },
        select: { id: true },
      });

    this.push(findings, {
      severity: DiagnosticSeverity.INFO,
      code: 'NO_ACTIVE_VERSION',
      title: 'Plano de contas sem versão ativa',
      detail:
        'O plano funciona sem versão, mas sem uma versão ativa não há registro formal de qual estrutura está valendo.',
      entityType: 'FinancialAccountPlanVersion',
      affected: activeVersion
        ? []
        : [
            {
              id: organizationId,
              label: 'Nenhuma versão ativa nesta organização',
            },
          ],
    });
  }

  private async checkInactiveCategoriesInUse(
    companyId: string | undefined,
    findings: DiagnosticFinding[],
  ) {
    if (!companyId) return;

    const rows = await this.prisma.financialCategory.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: RecordStatus.INACTIVE,
        OR: [
          { defaultForLinks: { some: {} } },
          { defaultRevenueForLinks: { some: {} } },
          { ruleActionsAsCategory: { some: {} } },
        ],
      },
      select: { id: true, name: true },
      take: 100,
    });

    this.push(findings, {
      severity: DiagnosticSeverity.WARNING,
      code: 'INACTIVE_CATEGORY_IN_USE',
      title: 'Categorias inativas ainda referenciadas',
      detail:
        'Fornecedores, clientes ou regras ainda apontam para estas categorias inativas.',
      entityType: 'FinancialCategory',
      affected: rows.map((r) => ({ id: r.id, label: r.name })),
    });
  }
}
