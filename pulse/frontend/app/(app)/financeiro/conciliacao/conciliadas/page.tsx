"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, Undo2 } from "lucide-react";

import {
  useReconciliationActions,
  useReconciliations,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  ReconciliationTypeBadge,
  brl,
  money,
} from "@/components/reconciliation/shared";
import {
  ENTITY_TYPE_LABELS,
  RECONCILIATION_STATUS_LABELS,
} from "@/types/reconciliation";

/**
 * Conciliações registradas (seções 35 e 37).
 *
 * Desfazer **não apaga**: a conciliação passa a "desfeita", guardando quem desfez, quando e
 * por quê. Apagar deixaria a movimentação disponível de novo sem vestígio de que já esteve
 * conciliada — e a pergunta "quem desfez isso?" ficaria sem resposta.
 */
export default function ConciliadasPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [page, setPage] = React.useState(1);
  const [reasons, setReasons] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading } = useReconciliations({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    page,
    perPage: 20,
  });

  const { unmatch } = useReconciliationActions();
  const canUnmatch = hasPermission("reconciliation.unmatch");

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
            <BadgeCheck className="size-5" />
            Conciliações registradas
          </h1>
          <p className="text-xs text-muted-foreground">
            Cada vínculo confirmado entre extrato e sistema, com quem confirmou.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível desfazer</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Nenhuma conciliação registrada"
          description="As conciliações confirmadas aparecem aqui, com os lançamentos que entraram em cada uma e a diferença apurada."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(data?.items ?? []).map((item) => {
            const difference = money(item.differenceAmount);
            const active = item.status === "ACTIVE";

            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ReconciliationTypeBadge type={item.reconciliationType} />
                      <Badge variant={active ? "default" : "outline"}>
                        {RECONCILIATION_STATUS_LABELS[item.status]}
                      </Badge>
                      {item.isPartial && (
                        <Badge variant="secondary">Parcial</Badge>
                      )}
                      {item.isManual ? (
                        <Badge variant="outline">Manual</Badge>
                      ) : (
                        <Badge variant="outline">
                          Sugestão aceita
                          {item.confidenceScore
                            ? ` · ${money(item.confidenceScore).toFixed(0)}`
                            : ""}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeBR(item.reconciledAt)}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {brl(item.totalBankAmount)}
                      </p>
                      {difference !== 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          diferença de {brl(difference)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-sm">
                    {item.items.map((line) => (
                      <div
                        key={line.id}
                        className="flex flex-wrap items-center gap-2 text-muted-foreground"
                      >
                        <span className="text-foreground">
                          {ENTITY_TYPE_LABELS[line.entityType]}
                        </span>
                        <span className="tabular-nums">
                          {brl(line.allocatedAmount)}
                        </span>
                        {line.bankTransaction && (
                          <Link
                            href={`/financeiro/conciliacao/transacoes/${line.bankTransactionId}`}
                            className="line-clamp-1 max-w-md underline-offset-2 hover:underline"
                          >
                            {line.bankTransaction.originalDescription}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>

                  {item.differenceReason && (
                    <p className="text-xs text-muted-foreground">
                      Justificativa da diferença: {item.differenceReason}
                    </p>
                  )}

                  {item.status === "UNMATCHED" && (
                    <p className="text-xs text-muted-foreground">
                      Desfeita em{" "}
                      {item.unmatchedAt
                        ? formatDateTimeBR(item.unmatchedAt)
                        : "—"}
                      {item.unmatchReason ? `: ${item.unmatchReason}` : ""}
                    </p>
                  )}

                  {canUnmatch && active && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-64 flex-1">
                        <Input
                          className="h-8"
                          value={reasons[item.id] ?? ""}
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Por que esta conciliação está sendo desfeita"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={unmatch.isPending || !reasons[item.id]}
                        onClick={() => {
                          setError(null);
                          unmatch.mutate(
                            { id: item.id, reason: reasons[item.id] ?? "" },
                            {
                              onError: (caught: unknown) =>
                                setError(
                                  caught instanceof Error
                                    ? caught.message
                                    : "Não foi possível desfazer.",
                                ),
                            },
                          );
                        }}
                      >
                        <Undo2 className="size-3.5" />
                        Desfazer
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
            Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total}{" "}
            conciliação(ões)
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
