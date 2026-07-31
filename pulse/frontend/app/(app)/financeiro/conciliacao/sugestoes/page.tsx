"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Lightbulb, ThumbsDown } from "lucide-react";

import { useBankTransactions, useSuggestionActions } from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConfidenceBadge,
  DirectionAmount,
  EmptyState,
  brl,
} from "@/components/reconciliation/shared";
import { ENTITY_TYPE_LABELS } from "@/types/reconciliation";

/**
 * Sugestões aguardando revisão (seções 30 e 31).
 *
 * A tela existe porque a decisão é humana: o motor pode acertar noventa vezes seguidas e
 * ainda assim a nonagésima primeira precisa de alguém olhando. Cada linha mostra os
 * critérios que produziram o score, não só o número.
 */
export default function SugestoesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [page, setPage] = React.useState(1);
  const [reasons, setReasons] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading } = useBankTransactions({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    reconciliationStatus: "MATCH_SUGGESTED",
    page,
    perPage: 20,
  });

  const { accept, dismiss } = useSuggestionActions();
  const canReconcile = hasPermission("reconciliation.reconcile");

  function fail(caught: unknown, fallback: string) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/conciliacao">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="size-5" />
            Sugestões de conciliação
          </h1>
          <p className="text-xs text-muted-foreground">
            O sistema apontou um candidato. A confirmação é sua — nada foi
            conciliado automaticamente.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nenhuma sugestão aguardando"
          description="Gere sugestões pela fila de conciliação. O motor compara valor, data, documento e fornecedor — e só sugere acima do score mínimo configurado."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(data?.items ?? []).map((transaction) => {
            const suggestion = transaction.suggestions?.[0];
            if (!suggestion) return null;

            const criteria = suggestion.matchingCriteria;

            return (
              <Card key={transaction.id}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        Extrato bancário
                      </p>
                      <Link
                        href={`/financeiro/conciliacao/transacoes/${transaction.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {transaction.originalDescription}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateBR(transaction.transactionDate)} ·{" "}
                        {transaction.financialAccount?.displayName ??
                          transaction.financialAccount?.name}
                      </p>
                      <div className="mt-1">
                        <DirectionAmount
                          direction={transaction.direction}
                          amount={transaction.amount}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        Lançamento sugerido
                      </p>
                      <p className="font-medium">
                        {criteria.label ??
                          ENTITY_TYPE_LABELS[suggestion.candidateEntityType]}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ENTITY_TYPE_LABELS[suggestion.candidateEntityType]}
                        {criteria.supplierName
                          ? ` · ${criteria.supplierName}`
                          : ""}
                        {criteria.referenceDate
                          ? ` · ${formatDateBR(criteria.referenceDate)}`
                          : ""}
                      </p>
                      <p className="mt-1 font-medium tabular-nums">
                        {criteria.candidateAmount !== undefined
                          ? brl(criteria.candidateAmount)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ConfidenceBadge
                      level={suggestion.confidenceLevel}
                      score={suggestion.score}
                    />
                    {(criteria.criteria ?? []).map((item) => (
                      <span
                        key={item.criterion}
                        className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                        title={item.detail}
                      >
                        +{item.points} {item.criterion}
                      </span>
                    ))}
                  </div>

                  {canReconcile && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Button
                        size="sm"
                        disabled={accept.isPending}
                        onClick={() =>
                          accept.mutate(
                            { id: suggestion.id },
                            {
                              onError: (caught) =>
                                fail(caught, "Não foi possível aceitar."),
                            },
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        Aceitar e conciliar
                      </Button>
                      <div className="min-w-56 flex-1">
                        <Input
                          className="h-8"
                          value={reasons[suggestion.id] ?? ""}
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [suggestion.id]: event.target.value,
                            }))
                          }
                          placeholder="Motivo do descarte"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dismiss.isPending || !reasons[suggestion.id]}
                        onClick={() =>
                          dismiss.mutate(
                            {
                              id: suggestion.id,
                              reason: reasons[suggestion.id] ?? "",
                            },
                            {
                              onError: (caught) =>
                                fail(caught, "Não foi possível descartar."),
                            },
                          )
                        }
                      >
                        <ThumbsDown className="size-3.5" />
                        Descartar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.meta.page} de {data.meta.totalPages}
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
