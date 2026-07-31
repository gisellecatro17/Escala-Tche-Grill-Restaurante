"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Bot, ListChecks, Loader2 } from "lucide-react";

import {
  useBankTransactions,
  useEligibleAccounts,
  useSuggestionActions,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/reconciliation/shared";
import { TransactionTable } from "@/components/reconciliation/transaction-table";

/**
 * A fila de trabalho: o que ainda espera conciliação.
 *
 * A busca em lote gera sugestões para várias movimentações de uma vez — e continua sem
 * conciliar nenhuma. Cada uma vira "sugestão encontrada" e espera a confirmação humana.
 */
export default function AConciliarPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [accountId, setAccountId] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [generatingId, setGeneratingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [batchResult, setBatchResult] = React.useState<string | null>(null);

  const { data: accounts } = useEligibleAccounts(organizationId, companyId);
  const { data, isLoading } = useBankTransactions({
    organizationId,
    companyId,
    pendingOnly: true,
    financialAccountId: accountId === "all" ? undefined : accountId,
    page,
    perPage: 25,
  });

  const { generate, generateBatch } = useSuggestionActions();
  const canReconcile = hasPermission("reconciliation.reconcile");

  function fail(caught: unknown, fallback: string) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
            <Link href="/financeiro/conciliacao">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <ListChecks className="size-5" />
              Fila de conciliação
            </h1>
            <p className="text-xs text-muted-foreground">
              Movimentações do extrato que ainda esperam um lançamento
              correspondente.
            </p>
          </div>
        </div>

        {canReconcile && (
          <Button
            disabled={generateBatch.isPending || !organizationId}
            onClick={() => {
              setError(null);
              setBatchResult(null);
              generateBatch.mutate(
                {
                  organizationId,
                  companyId,
                  financialAccountId:
                    accountId === "all" ? undefined : accountId,
                  limit: 100,
                },
                {
                  onSuccess: (result) => {
                    const summary = result as {
                      processed: number;
                      withSuggestions: number;
                    };
                    setBatchResult(
                      `${summary.withSuggestions} de ${summary.processed} movimentação(ões) receberam sugestão. Nenhuma foi conciliada.`,
                    );
                  },
                  onError: (caught) =>
                    fail(caught, "Não foi possível gerar as sugestões."),
                },
              );
            }}
          >
            {generateBatch.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            Buscar correspondências em lote
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {batchResult && (
        <Alert>
          <Bot className="size-4" />
          <AlertTitle>Sugestões geradas</AlertTitle>
          <AlertDescription>{batchResult}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="w-64">
            <Select
              value={accountId}
              onValueChange={(value) => {
                setAccountId(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {(accounts ?? []).map((item) => (
                  <SelectItem key={item.account.id} value={item.account.id}>
                    {item.account.displayName ?? item.account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Fila vazia"
          description="Nenhuma movimentação esperando conciliação nesta conta. Importe um extrato novo ou confira as movimentações já fechadas."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <TransactionTable
              items={data?.items ?? []}
              generatingId={generatingId}
              onGenerate={
                canReconcile
                  ? (transactionId) => {
                      setError(null);
                      setGeneratingId(transactionId);
                      generate.mutate(transactionId, {
                        onSettled: () => setGeneratingId(null),
                        onError: (caught) =>
                          fail(caught, "Não foi possível gerar sugestões."),
                      });
                    }
                  : undefined
              }
              emptyMessage="Nenhuma movimentação pendente."
            />
          </CardContent>
        </Card>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total}{" "}
            pendente(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
