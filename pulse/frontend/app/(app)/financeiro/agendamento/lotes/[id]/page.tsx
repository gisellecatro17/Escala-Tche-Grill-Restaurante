"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";

import {
  useBatchActions,
  usePaymentBatch,
  usePaymentSchedules,
} from "@/lib/api/payment-scheduling";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BATCH_STATUS_LABELS,
  HISTORY_ACTION_LABELS,
  SITUATION_LABELS,
  SITUATION_TONES,
  displayNameOf,
} from "@/types/payment-scheduling";

export default function LotePage() {
  const { id } = useParams<{ id: string }>();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: batch, isLoading } = usePaymentBatch(id);
  const actions = useBatchActions(id);

  // Programações da mesma conta e ainda fora de lote — as únicas que podem entrar.
  const { data: available } = usePaymentSchedules({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    situation: "SCHEDULED",
    financialAccountId: batch?.financialAccountId,
    perPage: 50,
  });

  const [adding, setAdding] = React.useState(false);
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [rejected, setRejected] = React.useState<
    { scheduleId: string; reason: string }[]
  >([]);

  if (isLoading || !batch) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const open = batch.status === "OPEN";
  const canManage = hasPermission("payment_schedule.batch");

  const candidates = (available?.items ?? []).filter(
    (item) => item.batchId === null,
  );

  const chosenTotal = candidates
    .filter((item) => chosen.includes(item.id))
    .reduce((total, item) => total + Number(item.totalAmount), 0);

  function onError(caught: unknown, fallback: string) {
    setFailure(caught instanceof Error ? caught.message : fallback);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar aos lotes">
          <Link href="/financeiro/agendamento/lotes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            <Layers className="size-5" />
            {batch.code}
            <Badge
              variant={
                batch.status === "READY_TO_SEND"
                  ? "default"
                  : batch.status === "CANCELLED"
                    ? "outline"
                    : "secondary"
              }
            >
              {BATCH_STATUS_LABELS[batch.status]}
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground">
            {batch.name ?? "Sem nome"} ·{" "}
            {batch.financialAccount?.displayName ?? batch.financialAccount?.name} ·{" "}
            {formatDateBR(batch.scheduledDate)}
          </p>
        </div>
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {rejected.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{rejected.length} programação(ões) recusada(s)</AlertTitle>
          <AlertDescription>
            {rejected.map((item) => item.reason).join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      {batch.blockedCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {batch.blockedCount} programação(ões) bloqueada(s) neste lote
          </AlertTitle>
          <AlertDescription>
            O lote não pode ser fechado enquanto houver bloqueio. Libere ou remova.
          </AlertDescription>
        </Alert>
      )}

      {batch.balance.position.projectedBalance < Number(batch.totalAmount) && (
        <Alert variant="destructive">
          <Wallet />
          <AlertTitle>Saldo projetado abaixo do total do lote</AlertTitle>
          <AlertDescription>
            A conta projeta{" "}
            {formatCurrencyBRL(batch.balance.position.projectedBalance)} para{" "}
            {formatDateBR(batch.scheduledDate)} e o lote soma{" "}
            {formatCurrencyBRL(Number(batch.totalAmount))}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Títulos" value={String(batch.itemCount)} />
        <Info
          label="Valor total"
          value={formatCurrencyBRL(Number(batch.totalAmount))}
        />
        <Info
          label="Saldo projetado da conta"
          value={formatCurrencyBRL(batch.balance.position.projectedBalance)}
        />
        <Info
          label="Banco"
          value={
            batch.financialAccount?.financialInstitution?.shortName ??
            batch.financialAccount?.financialInstitution?.legalName ??
            "—"
          }
        />
      </div>

      {canManage && open && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdding((current) => !current)}>
            <Plus className="size-4" />
            Incluir programações
          </Button>
          <Button
            variant="outline"
            disabled={!batch.readyToClose || actions.update.isPending}
            onClick={() => {
              setFailure(null);
              actions.update.mutate(
                { status: "READY_TO_SEND" },
                {
                  onError: (caught) => onError(caught, "Não foi possível fechar."),
                },
              );
            }}
          >
            <Lock className="size-4" />
            Fechar para envio
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const reason = window.prompt("Motivo do cancelamento do lote:");
              if (!reason) return;
              setFailure(null);
              actions.update.mutate(
                { status: "CANCELLED", reason },
                {
                  onError: (caught) => onError(caught, "Não foi possível cancelar."),
                },
              );
            }}
          >
            <XCircle className="size-4" />
            Cancelar lote
          </Button>
          {selectedItems.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setFailure(null);
                actions.removeSchedules.mutate(
                  { scheduleIds: selectedItems },
                  {
                    onSuccess: () => setSelectedItems([]),
                    onError: (caught) => onError(caught, "Não foi possível remover."),
                  },
                );
              }}
            >
              <Trash2 className="size-4" />
              Remover {selectedItems.length} do lote
            </Button>
          )}
        </div>
      )}

      {batch.status === "READY_TO_SEND" && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Lote fechado e pronto para envio</AlertTitle>
          <AlertDescription>
            Nada foi enviado ao banco. Este é o estado que a Execução Bancária vai consumir
            quando o módulo existir — remessa CNAB, PIX e retorno não fazem parte desta
            etapa.
          </AlertDescription>
        </Alert>
      )}

      {adding && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Programações disponíveis para este lote
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma programação livre nesta conta. Um lote só aceita programações da
                mesma empresa e da mesma conta — o arquivo de remessa é por convênio.
              </p>
            ) : (
              <>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Título</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={chosen.includes(item.id)}
                              onCheckedChange={(checked) =>
                                setChosen((current) =>
                                  checked
                                    ? [...current, item.id]
                                    : current.filter((value) => value !== item.id),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.payable.code}
                          </TableCell>
                          <TableCell className="text-sm">
                            {displayNameOf(item.payable.supplier)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.scheduledDate
                              ? formatDateBR(item.scheduledDate)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {formatCurrencyBRL(Number(item.totalAmount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {chosen.length > 0 && (
                  <Alert>
                    <AlertTitle>
                      {chosen.length} programação(ões) — {formatCurrencyBRL(chosenTotal)}
                    </AlertTitle>
                    <AlertDescription>
                      Incluir alinha a data e a conta de cada uma com as do lote.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button
                disabled={chosen.length === 0 || actions.addSchedules.isPending}
                onClick={() => {
                  setFailure(null);
                  setRejected([]);
                  actions.addSchedules.mutate(
                    { scheduleIds: chosen },
                    {
                      onSuccess: (result) => {
                        setChosen([]);
                        setAdding(false);
                        setRejected(result.rejected);
                      },
                      onError: (caught) => onError(caught, "Não foi possível incluir."),
                    },
                  );
                }}
              >
                {actions.addSchedules.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Incluir selecionadas
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Títulos do lote ({batch.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {batch.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Lote vazio. Um lote vazio não pode ser fechado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && open && <TableHead className="w-10" />}
                  <TableHead>#</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.items.map((item) => (
                  <TableRow key={item.id}>
                    {canManage && open && (
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.schedule.id)}
                          onCheckedChange={(checked) =>
                            setSelectedItems((current) =>
                              checked
                                ? [...current, item.schedule.id]
                                : current.filter((value) => value !== item.schedule.id),
                            )
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>{item.sequence}</TableCell>
                    <TableCell>
                      <Link
                        href={`/financeiro/agendamento/${item.schedule.id}`}
                        className="hover:underline"
                      >
                        {item.schedule.payable.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {displayNameOf(item.schedule.payable.supplier)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(Number(item.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          SITUATION_TONES[
                            item.schedule.blockedAt ? "BLOCKED" : item.schedule.status
                          ]
                        }
                      >
                        {
                          SITUATION_LABELS[
                            item.schedule.blockedAt ? "BLOCKED" : item.schedule.status
                          ]
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico do lote</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">
                    {formatDateTimeBR(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {HISTORY_ACTION_LABELS[entry.action]}
                  </TableCell>
                  <TableCell className="text-xs">{entry.previousValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.newValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-medium tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
