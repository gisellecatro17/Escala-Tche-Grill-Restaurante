"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  Filter,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  useBulkScheduleActions,
  useCreateSchedule,
  usePaymentSchedules,
  useSchedulablePayables,
} from "@/lib/api/payment-scheduling";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field } from "@/components/treasury/field";
import {
  PAYMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  SITUATION_LABELS,
  SITUATION_TONES,
  displayNameOf,
  type BankPaymentType,
  type SchedulePriority,
  type ScheduleSituation,
} from "@/types/payment-scheduling";

const ALL = "__all__";

export default function FilaPage() {
  return (
    <React.Suspense fallback={<Header />}>
      <Fila />
    </React.Suspense>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/agendamento">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks className="size-5" />
          Fila de pagamentos
        </h1>
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function Fila() {
  const params = useSearchParams();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [search, setSearch] = React.useState("");
  const [situation, setSituation] = React.useState(params.get("situation") ?? ALL);
  const [priority, setPriority] = React.useState(params.get("priority") ?? ALL);
  const [paymentType, setPaymentType] = React.useState(ALL);
  const [blocked, setBlocked] = React.useState(params.get("blocked") === "true");
  const [rescheduled, setRescheduled] = React.useState(
    params.get("rescheduled") === "true",
  );
  const [scheduledFrom, setScheduledFrom] = React.useState("");
  const [scheduledTo, setScheduledTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [showFilters, setShowFilters] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [bulkPanel, setBulkPanel] = React.useState(false);
  const [addPanel, setAddPanel] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const filters = React.useMemo(
    () => ({
      organizationId,
      companyId,
      page,
      perPage: 25,
      ...(search ? { search } : {}),
      ...(situation !== ALL ? { situation } : {}),
      ...(priority !== ALL ? { priority } : {}),
      ...(paymentType !== ALL ? { bankPaymentType: paymentType } : {}),
      ...(blocked ? { blocked: true } : {}),
      ...(rescheduled ? { rescheduled: true } : {}),
      ...(scheduledFrom ? { scheduledFrom } : {}),
      ...(scheduledTo ? { scheduledTo } : {}),
    }),
    [
      organizationId,
      companyId,
      page,
      search,
      situation,
      priority,
      paymentType,
      blocked,
      rescheduled,
      scheduledFrom,
      scheduledTo,
    ],
  );

  const { data, isLoading } = usePaymentSchedules(filters);
  const bulk = useBulkScheduleActions();

  const items = data?.items ?? [];
  const selectedItems = items.filter((item) => selected.includes(item.id));
  const selectedTotal = selectedItems.reduce(
    (total, item) => total + Number(item.totalAmount),
    0,
  );

  const activeFilters =
    (situation !== ALL ? 1 : 0) +
    (priority !== ALL ? 1 : 0) +
    (paymentType !== ALL ? 1 : 0) +
    (blocked ? 1 : 0) +
    (rescheduled ? 1 : 0) +
    (scheduledFrom ? 1 : 0) +
    (scheduledTo ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/agendamento">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="size-5" />
            Fila de pagamentos
          </h1>
          <p className="text-xs text-muted-foreground">
            {data ? `${data.meta.total} programação(ões)` : "Carregando…"}
          </p>
        </div>
        {hasPermission("payment_schedule.create") && (
          <Button onClick={() => setAddPanel((current) => !current)}>
            <Plus className="size-4" />
            Programar títulos
          </Button>
        )}
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters((current) => !current)}
        >
          <Filter className="size-4" />
          Filtros
          {activeFilters > 0 && <Badge variant="secondary">{activeFilters}</Badge>}
        </Button>
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {addPanel && companyId && organizationId && (
        <SchedulablePanel
          organizationId={organizationId}
          companyId={companyId}
          onClose={() => setAddPanel(false)}
          onError={setFailure}
        />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por código da programação, do título ou número do documento"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
      </div>

      {showFilters && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Situação">
              <Select
                value={situation}
                onValueChange={(value) => {
                  setPage(1);
                  setSituation(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {(Object.keys(SITUATION_LABELS) as ScheduleSituation[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SITUATION_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Prioridade">
              <Select
                value={priority}
                onValueChange={(value) => {
                  setPage(1);
                  setPriority(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {(Object.keys(PRIORITY_LABELS) as SchedulePriority[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PRIORITY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Forma de pagamento">
              <Select
                value={paymentType}
                onValueChange={(value) => {
                  setPage(1);
                  setPaymentType(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {(Object.keys(PAYMENT_TYPE_LABELS) as BankPaymentType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PAYMENT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Data programada de">
              <Input
                type="date"
                value={scheduledFrom}
                onChange={(event) => {
                  setPage(1);
                  setScheduledFrom(event.target.value);
                }}
              />
            </Field>

            <Field label="Data programada até">
              <Input
                type="date"
                value={scheduledTo}
                onChange={(event) => {
                  setPage(1);
                  setScheduledTo(event.target.value);
                }}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                size="sm"
                variant={blocked ? "default" : "outline"}
                onClick={() => {
                  setPage(1);
                  setBlocked((current) => !current);
                }}
              >
                <Ban className="size-4" />
                Somente bloqueados
              </Button>
              <Button
                size="sm"
                variant={rescheduled ? "default" : "outline"}
                onClick={() => {
                  setPage(1);
                  setRescheduled((current) => !current);
                }}
              >
                <CalendarClock className="size-4" />
                Somente reprogramados
              </Button>
              {activeFilters > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSituation(ALL);
                    setPriority(ALL);
                    setPaymentType(ALL);
                    setBlocked(false);
                    setRescheduled(false);
                    setScheduledFrom("");
                    setScheduledTo("");
                    setPage(1);
                  }}
                >
                  <X className="size-4" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Resumo antes da confirmação (seção 7) ────────────────────────── */}
      {selected.length > 0 && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {selected.length} programação(ões) selecionada(s) —{" "}
                {formatCurrencyBRL(selectedTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                O resumo é sempre exibido antes de qualquer alteração em massa.
              </p>
            </div>
            {hasPermission("payment_schedule.edit") && (
              <Button size="sm" onClick={() => setBulkPanel((current) => !current)}>
                Alterar em massa
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Limpar seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {bulkPanel && selected.length > 0 && (
        <BulkPanel
          count={selected.length}
          total={selectedTotal}
          pending={bulk.update.isPending || bulk.cancel.isPending}
          onCancel={() => setBulkPanel(false)}
          onApply={(payload) => {
            setFailure(null);
            bulk.update.mutate(
              { scheduleIds: selected, ...payload },
              {
                onSuccess: (result) => {
                  setBulkPanel(false);
                  setSelected([]);
                  if (result.failed > 0) {
                    setFailure(
                      `${result.failed} de ${result.total} não pôde ser alterada: ${result.results
                        .filter((item) => !item.ok)
                        .map((item) => item.error)
                        .join(" · ")}`,
                    );
                  }
                },
                onError: (caught: unknown) =>
                  setFailure(
                    caught instanceof Error ? caught.message : "Falha na alteração.",
                  ),
              },
            );
          }}
          onCancelSchedules={(reason) => {
            setFailure(null);
            bulk.cancel.mutate(
              { scheduleIds: selected, reason },
              {
                onSuccess: () => {
                  setBulkPanel(false);
                  setSelected([]);
                },
                onError: (caught: unknown) =>
                  setFailure(
                    caught instanceof Error ? caught.message : "Falha ao cancelar.",
                  ),
              },
            );
          }}
        />
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma programação encontrada com estes filtros.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.length === items.length && items.length > 0}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? items.map((item) => item.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Data programada</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(item.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/financeiro/agendamento/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.payable.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.payable.documentNumber ?? item.code}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {displayNameOf(item.payable.supplier)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {displayNameOf(item.company)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.scheduledDate ? formatDateBR(item.scheduledDate) : "—"}
                    {item.rescheduleCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {item.rescheduleCount}ª alteração
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatCurrencyBRL(Number(item.totalAmount))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.bankPaymentType
                      ? PAYMENT_TYPE_LABELS[item.bankPaymentType]
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PRIORITY_LABELS[item.priority]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.batch ? (
                      <Link
                        href={`/financeiro/agendamento/lotes/${item.batch.id}`}
                        className="hover:underline"
                      >
                        {item.batch.code}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SITUATION_TONES[item.situation]}>
                      {SITUATION_LABELS[item.situation]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {data.meta.page} de {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
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

/** Títulos elegíveis do Contas a Pagar, para entrar na fila. */
function SchedulablePanel({
  organizationId,
  companyId,
  onClose,
  onError,
}: {
  organizationId: string;
  companyId: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { data, isLoading } = useSchedulablePayables({ companyId, perPage: 25 });
  const create = useCreateSchedule();

  const [scheduledDate, setScheduledDate] = React.useState("");
  const [chosen, setChosen] = React.useState<string[]>([]);

  const items = data?.items ?? [];
  const chosenItems = items.filter((item) => chosen.includes(item.id));
  const total = chosenItems.reduce(
    (sum, item) => sum + Number(item.balanceAmount),
    0,
  );

  function submit() {
    if (chosen.length === 0) return;

    let remaining = chosen.length;

    for (const payableId of chosen) {
      create.mutate(
        {
          organizationId,
          companyId,
          payableId,
          ...(scheduledDate ? { scheduledDate } : {}),
        },
        {
          onSettled: () => {
            remaining -= 1;
            if (remaining === 0) {
              setChosen([]);
              onClose();
            }
          },
          onError: (caught: unknown) =>
            onError(
              caught instanceof Error ? caught.message : "Falha ao programar título.",
            ),
        },
      );
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Títulos do Contas a Pagar sem programação
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum título elegível. Títulos bloqueados no Contas a Pagar não aparecem aqui —
            o bloqueio de lá existe justamente para impedir que cheguem ao banco.
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
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Parcelas livres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={chosen.includes(item.id)}
                          onCheckedChange={(checked) =>
                            setChosen((current) =>
                              checked
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm">{item.code}</TableCell>
                      <TableCell className="text-sm">
                        {displayNameOf(item.supplier)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateBR(item.dueDate)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrencyBRL(Number(item.balanceAmount))}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {item.installments.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Data de pagamento"
                hint="Em branco: a programação nasce aguardando data."
              >
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                />
              </Field>
            </div>

            {chosen.length > 0 && (
              <Alert>
                <AlertTitle>
                  {chosen.length} título(s) — {formatCurrencyBRL(total)}
                </AlertTitle>
                <AlertDescription>
                  Todas as parcelas livres de cada título entram na programação.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <div className="flex gap-2">
          <Button disabled={chosen.length === 0 || create.isPending} onClick={submit}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Programar selecionados
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkPanel({
  count,
  total,
  pending,
  onCancel,
  onApply,
  onCancelSchedules,
}: {
  count: number;
  total: number;
  pending: boolean;
  onCancel: () => void;
  onApply: (payload: Record<string, unknown>) => void;
  onCancelSchedules: (reason: string) => void;
}) {
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [priority, setPriority] = React.useState(ALL);
  const [paymentType, setPaymentType] = React.useState(ALL);
  const [reason, setReason] = React.useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4" />
          Alterar {count} programação(ões) — {formatCurrencyBRL(total)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nova data">
          <Input
            type="date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
          />
        </Field>

        <Field label="Prioridade">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Não alterar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Não alterar</SelectItem>
              {(Object.keys(PRIORITY_LABELS) as SchedulePriority[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PRIORITY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Forma de pagamento">
          <Select value={paymentType} onValueChange={setPaymentType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Não alterar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Não alterar</SelectItem>
              {(Object.keys(PAYMENT_TYPE_LABELS) as BankPaymentType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PAYMENT_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Motivo"
          hint="Obrigatório para alterar a data de quem já está programado."
        >
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button
            disabled={pending}
            onClick={() =>
              onApply({
                ...(scheduledDate ? { scheduledDate } : {}),
                ...(priority !== ALL ? { priority } : {}),
                ...(paymentType !== ALL ? { bankPaymentType: paymentType } : {}),
                ...(reason ? { reason } : {}),
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Aplicar às {count} selecionadas
          </Button>
          <Button
            variant="outline"
            disabled={!reason || pending}
            onClick={() => {
              if (!window.confirm(`Cancelar ${count} programação(ões)?`)) return;
              onCancelSchedules(reason);
            }}
          >
            Cancelar programações
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
