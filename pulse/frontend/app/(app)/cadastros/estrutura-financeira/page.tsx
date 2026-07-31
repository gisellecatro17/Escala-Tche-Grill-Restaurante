"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Copy,
  FolderTree,
  History,
  Info,
  Layers,
  Network,
  Scale,
  SplitSquareHorizontal,
  Tag as TagIcon,
  Tags,
  Target,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";

import {
  useAccountPlans,
  useAllocationRules,
  useBusinessUnits,
  useClassificationRules,
  useFinancialNatures,
  useFinancialTags,
  useResultCenters,
  useStructureDiagnostics,
} from "@/lib/api/financial-structure";
import { useCategories, useCostCenters } from "@/lib/api/taxonomy";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiagnosticSeverity } from "@/types/financial-structure";

const SEVERITY_STYLE: Record<
  DiagnosticSeverity,
  { label: string; icon: React.ReactNode; className: string }
> = {
  CRITICAL: {
    label: "Crítico",
    icon: <XCircle className="size-4" />,
    className: "border-destructive/40 text-destructive",
  },
  WARNING: {
    label: "Atenção",
    icon: <AlertTriangle className="size-4" />,
    className: "border-amber-500/40 text-amber-600 dark:text-amber-500",
  },
  INFO: {
    label: "Informativo",
    icon: <Info className="size-4" />,
    className: "border-border text-muted-foreground",
  },
};

/**
 * Visão geral da estrutura financeira (seções 1 a 3): quantos registros existem em cada
 * cadastro, atalhos para cada tela e os alertas do diagnóstico de inconsistências.
 */
export default function EstruturaFinanceiraPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const accountPlans = useAccountPlans(organizationId, companyId);
  const categories = useCategories(companyId);
  const costCenters = useCostCenters(companyId);
  const resultCenters = useResultCenters(companyId);
  const businessUnits = useBusinessUnits(organizationId, companyId);
  const natures = useFinancialNatures(organizationId, companyId);
  const tags = useFinancialTags(organizationId, companyId);
  const allocationRules = useAllocationRules(companyId);
  const classificationRules = useClassificationRules(companyId);
  const diagnostics = useStructureDiagnostics(organizationId, companyId);

  const cards = [
    {
      label: "Plano de contas",
      href: "/cadastros/plano-de-contas",
      icon: FolderTree,
      permission: "account_plan.view",
      count: accountPlans.data?.length,
      isLoading: accountPlans.isLoading,
      hint: "Estrutura contábil e gerencial em árvore",
    },
    {
      label: "Categorias financeiras",
      href: "/cadastros/categorias",
      icon: Tags,
      permission: "financial_category.view",
      count: categories.data?.length,
      isLoading: categories.isLoading,
      hint: "Classificação do dia a dia, com subcategorias",
    },
    {
      label: "Centros de custo",
      href: "/cadastros/centros-de-custo",
      icon: Layers,
      permission: "cost_center.view",
      count: costCenters.data?.length,
      isLoading: costCenters.isLoading,
      hint: "Onde o gasto acontece",
    },
    {
      label: "Centros de resultado",
      href: "/cadastros/centros-de-resultado",
      icon: Target,
      permission: "result_center.view",
      count: resultCenters.data?.length,
      isLoading: resultCenters.isLoading,
      hint: "Onde o resultado é apurado",
    },
    {
      label: "Unidades de negócio",
      href: "/cadastros/unidades-de-negocio",
      icon: Network,
      permission: "business_unit.view",
      count: businessUnits.data?.length,
      isLoading: businessUnits.isLoading,
      hint: "Filiais, marcas e frentes de operação",
    },
    {
      label: "Naturezas financeiras",
      href: "/cadastros/naturezas-financeiras",
      icon: Scale,
      permission: "financial_nature.view",
      count: natures.data?.length,
      isLoading: natures.isLoading,
      hint: "Receita, despesa, custo, transferência",
    },
    {
      label: "Tags financeiras",
      href: "/cadastros/tags-financeiras",
      icon: TagIcon,
      permission: "financial_tag.view",
      count: tags.data?.length,
      isLoading: tags.isLoading,
      hint: "Marcações livres, sem hierarquia",
    },
    {
      label: "Rateios",
      href: "/cadastros/rateios",
      icon: SplitSquareHorizontal,
      permission: "allocation_rule.view",
      count: allocationRules.data?.length,
      isLoading: allocationRules.isLoading,
      hint: "Divisão de um valor entre dimensões",
    },
    {
      label: "Regras de classificação",
      href: "/cadastros/regras-de-classificacao",
      icon: Wand2,
      permission: "classification_rule.view",
      count: classificationRules.data?.length,
      isLoading: classificationRules.isLoading,
      hint: "Sugestões automáticas por condição",
    },
  ].filter((card) => hasPermission(card.permission));

  const report = diagnostics.data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estrutura financeira
          </h1>
          <p className="text-sm text-muted-foreground">
            Plano de contas, categorias e as dimensões de análise. Cada dimensão é
            independente: uma despesa pode ter categoria, centro de custo, projeto e
            unidade de negócio ao mesmo tempo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission("financial_structure.import") && (
            <Button variant="outline" asChild>
              <Link href="/cadastros/estrutura-financeira/importar">
                <Upload /> Importar
              </Link>
            </Button>
          )}
          {hasPermission("financial_structure.duplicate") && (
            <Button variant="outline" asChild>
              <Link href="/cadastros/estrutura-financeira/duplicar">
                <Copy /> Duplicar entre empresas
              </Link>
            </Button>
          )}
          {hasPermission("financial_structure.manage_versions") && (
            <Button variant="outline" asChild>
              <Link href="/cadastros/estrutura-financeira/historico">
                <History /> Histórico
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!companyId && (
        <Alert>
          <Info />
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            Categorias, centros e projetos pertencem a uma empresa. Sem empresa
            selecionada, apenas os cadastros compartilhados pela organização aparecem.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <card.icon className="size-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {card.isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <span className="text-2xl font-semibold tabular-nums">
                    {card.count ?? 0}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{card.hint}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {hasPermission("financial_structure.view") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Diagnóstico da estrutura
              {report && report.total > 0 && (
                <span className="flex gap-1">
                  {report.summary.critical > 0 && (
                    <Badge variant="destructive">
                      {report.summary.critical} crítico(s)
                    </Badge>
                  )}
                  {report.summary.warning > 0 && (
                    <Badge variant="outline">
                      {report.summary.warning} atenção
                    </Badge>
                  )}
                  {report.summary.info > 0 && (
                    <Badge variant="outline">{report.summary.info} informativo</Badge>
                  )}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {diagnostics.isLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : !report || report.total === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma inconsistência encontrada na estrutura desta empresa.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  O diagnóstico apenas relata. Nada é corrigido automaticamente, porque a
                  correção depende de uma decisão sua.
                </p>
                {report.findings.map((finding) => {
                  const style = SEVERITY_STYLE[finding.severity];
                  return (
                    <div
                      key={finding.code}
                      className={`flex flex-col gap-1 rounded-md border p-3 ${style.className}`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {style.icon}
                        {finding.title}
                        <Badge variant="outline" className="ml-auto">
                          {finding.affected.length}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{finding.detail}</p>
                      <ul className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {finding.affected.slice(0, 6).map((item) => (
                          <li
                            key={item.id}
                            className="rounded bg-muted px-1.5 py-0.5"
                          >
                            {item.label}
                          </li>
                        ))}
                        {finding.affected.length > 6 && (
                          <li className="px-1.5 py-0.5">
                            e mais {finding.affected.length - 6}
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
