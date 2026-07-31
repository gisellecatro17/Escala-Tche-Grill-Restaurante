"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Link2,
  Loader2,
} from "lucide-react";

import {
  useReconciliationActions,
  useTransferCandidates,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DirectionAmount,
  EmptyState,
  brl,
} from "@/components/reconciliation/shared";

/**
 * Transferências internas detectadas (seção 40).
 *
 * A tela **detecta** e propõe; quem confirma é uma pessoa. Fechar sozinho seria fundir duas
 * movimentações reais com base em coincidência de valor e data — e uma transferência
 * inventada some do fluxo de caixa duas vezes, em duas contas diferentes.
 */
export default function TransferenciasPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data, isLoading } = useTransferCandidates({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
  });

  const { linkTransfer } = useReconciliationActions();
  const canReconcile = hasPermission("reconciliation.reconcile");

  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

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
            <ArrowLeftRight className="size-5" />
            Transferências internas
          </h1>
          <p className="text-xs text-muted-foreground">
            Saídas de uma conta que casam com entradas de outra, na mesma
            empresa.
          </p>
        </div>
      </div>

      <Alert>
        <ArrowLeftRight className="size-4" />
        <AlertTitle>Transferência não é despesa nem receita</AlertTitle>
        <AlertDescription>
          É o mesmo dinheiro aparecendo duas vezes no extrato consolidado.
          Conciliar as duas pontas contra lançamentos separados dobraria o
          movimento no fluxo de caixa.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível vincular</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhum par candidato"
          description="Não há saída e entrada de mesmo valor, em contas diferentes da mesma empresa, dentro de dois dias uma da outra."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(data ?? []).map((pair) => {
            const key = `${pair.outgoing.id}:${pair.incoming.id}`;

            return (
              <Card key={key}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        Saída —{" "}
                        {pair.outgoing.financialAccount?.displayName ??
                          pair.outgoing.financialAccount?.name}
                      </p>
                      <Link
                        href={`/financeiro/conciliacao/transacoes/${pair.outgoing.id}`}
                        className="line-clamp-1 font-medium underline-offset-2 hover:underline"
                      >
                        {pair.outgoing.originalDescription}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateBR(pair.outgoing.transactionDate)}
                      </p>
                      <DirectionAmount
                        direction={pair.outgoing.direction}
                        amount={pair.outgoing.amount}
                      />
                    </div>

                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        Entrada —{" "}
                        {pair.incoming.financialAccount?.displayName ??
                          pair.incoming.financialAccount?.name}
                      </p>
                      <Link
                        href={`/financeiro/conciliacao/transacoes/${pair.incoming.id}`}
                        className="line-clamp-1 font-medium underline-offset-2 hover:underline"
                      >
                        {pair.incoming.originalDescription}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateBR(pair.incoming.transactionDate)}
                      </p>
                      <DirectionAmount
                        direction={pair.incoming.direction}
                        amount={pair.incoming.amount}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Diferença de {pair.differenceDays} dia(s)
                    {pair.differenceAmount !== 0 &&
                      ` e ${brl(pair.differenceAmount)}`}
                    .
                  </p>

                  {canReconcile && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-64 flex-1">
                        <Input
                          className="h-8"
                          value={notes[key] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder="Observação (obrigatória se os valores diferirem: tarifa, IOF)"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={linkTransfer.isPending}
                        onClick={() => {
                          setError(null);
                          linkTransfer.mutate(
                            {
                              outgoingTransactionId: pair.outgoing.id,
                              incomingTransactionId: pair.incoming.id,
                              notes: notes[key] || undefined,
                            },
                            {
                              onError: (caught: unknown) =>
                                setError(
                                  caught instanceof Error
                                    ? caught.message
                                    : "Não foi possível vincular as pontas.",
                                ),
                            },
                          );
                        }}
                      >
                        {linkTransfer.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Link2 className="size-3.5" />
                        )}
                        Confirmar transferência
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
