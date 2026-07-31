"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CircleHelp,
  Clock,
  FileSearch,
  GitCompareArrows,
  Layers,
  Lightbulb,
  ListChecks,
  Scale,
  SlidersHorizontal,
  Upload,
} from "lucide-react";

import { useReconciliationDashboard } from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard, brl } from "@/components/reconciliation/shared";
import { TRANSACTION_STATUS_LABELS } from "@/types/reconciliation";

/**
 * Painel da conciliação (seções 24 a 26).
 *
 * Duas taxas em vez de uma: por quantidade e por valor. Elas andam diferentes quando sobram
 * muitas transações pequenas — e é exatamente essa diferença que diz se o que falta é
 * trabalho de digitação ou risco financeiro de verdade.
 */
export default function ConciliacaoPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data, isLoading } = useReconciliationDashboard({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const { cards, indicators } = data;
  const staleAccounts = data.balances.filter((row) => row.lastImport === null);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <GitCompareArrows className="size-5" />
            Conciliação bancária
          </h1>
          <p className="text-sm text-muted-foreground">
            O que o banco mostra e o que o Pulse registrou, lado a lado. Nenhuma
            conciliação acontece sozinha: o sistema sugere, você confirma.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission("reconciliation.import") && (
            <Button asChild>
              <Link href="/financeiro/conciliacao/importar">
                <Upload className="size-4" />
                Importar extrato
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/financeiro/conciliacao/a-conciliar">
              <ListChecks className="size-4" />
              Fila de conciliação
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/financeiro/conciliacao/configuracoes">
              <SlidersHorizontal className="size-4" />
              Parâmetros
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Período de {formatDateBR(data.period.from)} a{" "}
        {formatDateBR(data.period.to)}.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          icon={Layers}
          label="Movimentações no período"
          value={String(cards.totalTransactions)}
          hint={brl(cards.totalAmount)}
        />
        <MetricCard
          icon={BadgeCheck}
          label="Conciliadas"
          value={String(cards.reconciledTransactions)}
          hint={brl(cards.reconciledAmount)}
        />
        <MetricCard
          icon={Clock}
          label="Pendentes"
          value={String(cards.pendingTransactions)}
          hint={brl(cards.pendingAmount)}
          tone={cards.pendingTransactions > 0 ? "warning" : undefined}
        />
        <MetricCard
          icon={CircleHelp}
          label="Não identificadas"
          value={String(cards.unidentifiedTransactions)}
          hint="Sem lançamento correspondente"
          tone={cards.unidentifiedTransactions > 0 ? "danger" : undefined}
        />
        <MetricCard
          icon={Lightbulb}
          label="Sugestões aguardando"
          value={String(cards.pendingSuggestions)}
          hint="Exigem confirmação humana"
        />
        <MetricCard
          icon={Scale}
          label="Conciliadas em parte"
          value={String(cards.partiallyMatchedTransactions)}
          hint="Ainda com saldo aberto"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Diferenças em aberto"
          value={brl(cards.openDifferences)}
          tone={cards.openDifferences !== 0 ? "warning" : undefined}
        />
        <MetricCard
          icon={GitCompareArrows}
          label="Taxa por quantidade"
          value={`${indicators.reconciliationRateByCount}%`}
        />
        <MetricCard
          icon={Banknote}
          label="Taxa por valor"
          value={`${indicators.reconciliationRateByAmount}%`}
        />
        <MetricCard
          icon={CalendarClock}
          label="Dias até conciliar"
          value={String(indicators.averageDaysToReconcile)}
          hint="Média do período"
        />
      </div>

      {staleAccounts.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {staleAccounts.length} conta(s) sem nenhum extrato importado
          </AlertTitle>
          <AlertDescription>
            {staleAccounts
              .map((row) => row.account.displayName ?? row.account.name)
              .join(", ")}
            . Sem extrato não há o que conciliar — o saldo do Pulse fica sem
            confronto.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Saldo por conta</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Último extrato</TableHead>
                  <TableHead className="text-right">Saldo do extrato</TableHead>
                  <TableHead className="text-right">Movimento</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.balances.map((row) => (
                  <TableRow key={row.account.id}>
                    <TableCell>
                      {row.account.displayName ?? row.account.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.lastImport?.statementEndDate
                        ? formatDateBR(row.lastImport.statementEndDate)
                        : "Nunca importado"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.statementClosingBalance === null
                        ? "—"
                        : brl(row.statementClosingBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(row.periodNet)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.pendingTransactions}
                    </TableCell>
                  </TableRow>
                ))}
                {data.balances.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Nenhuma conta financeira cadastrada nesta empresa.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Movimentações por situação</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byStatus.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      {TRANSACTION_STATUS_LABELS[row.status]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {data.byStatus.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Nenhuma movimentação no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Indicadores do período</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Banknote}
            label="Entradas"
            value={brl(indicators.creditAmount)}
          />
          <MetricCard
            icon={Banknote}
            label="Saídas"
            value={brl(indicators.debitAmount)}
          />
          <MetricCard
            icon={Lightbulb}
            label="Sugestões aceitas"
            value={String(indicators.acceptedSuggestions)}
            hint={`Score médio ${indicators.averageSuggestionScore.toFixed(0)}`}
          />
          <MetricCard
            icon={Lightbulb}
            label="Sugestões descartadas"
            value={String(indicators.dismissedSuggestions)}
          />
          <MetricCard
            icon={Layers}
            label="Duplicidades"
            value={String(indicators.duplicateTransactions)}
            tone={indicators.duplicateTransactions > 0 ? "warning" : undefined}
          />
          <MetricCard
            icon={FileSearch}
            label="Digitadas manualmente"
            value={String(indicators.manualTransactions)}
          />
          <MetricCard
            icon={ListChecks}
            label="Atribuições abertas"
            value={String(indicators.openAssignments)}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Atribuições atrasadas"
            value={String(indicators.overdueAssignments)}
            tone={indicators.overdueAssignments > 0 ? "danger" : undefined}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/financeiro/conciliacao/sugestoes">
            <Lightbulb className="size-4" />
            Sugestões
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro/conciliacao/nao-identificadas">
            <CircleHelp className="size-4" />
            Não identificadas
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro/conciliacao/lancamentos-sem-extrato">
            <FileSearch className="size-4" />
            Lançamentos sem extrato
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro/conciliacao/transferencias">
            <ArrowLeftRight className="size-4" />
            Transferências internas
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro/conciliacao/conciliadas">
            <BadgeCheck className="size-4" />
            Conciliações registradas
          </Link>
        </Button>
      </div>
    </div>
  );
}
