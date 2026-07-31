"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  History,
  Loader2,
  MessageSquare,
  Unlock,
  Wallet,
  XCircle,
} from "lucide-react";

import {
  usePaymentSchedule,
  useScheduleActions,
} from "@/lib/api/payment-scheduling";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import {
  BLOCK_REASON_LABELS,
  HISTORY_ACTION_LABELS,
  PAYMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  SITUATION_HINTS,
  SITUATION_LABELS,
  SITUATION_TONES,
  displayNameOf,
  type BankPaymentType,
  type SchedulePriority,
  type ScheduleBlockReason,
} from "@/types/payment-scheduling";

type Panel = "reschedule" | "block" | "unblock" | "cancel" | "comment" | null;

export default function ProgramacaoPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data: schedule, isLoading } = usePaymentSchedule(id);
  const actions = useScheduleActions(id);

  const [panel, setPanel] = React.useState<Panel>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  if (isLoading || !schedule) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const blocked = Boolean(schedule.blockedAt);

  function onError(caught: unknown, fallback: string) {
    setFailure(caught instanceof Error ? caught.message : fallback);
  }

  function close() {
    setPanel(null);
    setFailure(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar à fila">
          <Link href="/financeiro/agendamento/fila">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {schedule.code}
            <Badge variant={SITUATION_TONES[schedule.situation]}>
              {SITUATION_LABELS[schedule.situation]}
            </Badge>
            {schedule.priority !== "NORMAL" && (
              <Badge variant="outline">{PRIORITY_LABELS[schedule.priority]}</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {SITUATION_HINTS[schedule.situation]}
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

      {blocked && schedule.blockReason && (
        <Alert variant="destructive">
          <Ban />
          <AlertTitle>
            Bloqueada — {BLOCK_REASON_LABELS[schedule.blockReason]}
          </AlertTitle>
          <AlertDescription>
            {schedule.blockNotes ?? "Sem descrição."} Bloqueada em{" "}
            {formatDateTimeBR(schedule.blockedAt as string)}. Enquanto o bloqueio existir,
            a programação não entra em lote nem segue para o banco.
          </AlertDescription>
        </Alert>
      )}

      {schedule.balance?.insufficient && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            Faltam {formatCurrencyBRL(schedule.balance.shortfall)} na conta
          </AlertTitle>
          <AlertDescription>
            O saldo projetado de {schedule.balance.position.accountName} na data é{" "}
            {formatCurrencyBRL(schedule.balance.position.projectedBalance)}. Reprograme
            para outra data ou escolha outra conta.
          </AlertDescription>
        </Alert>
      )}

      {schedule.balance?.belowRecommended && (
        <Alert>
          <AlertTitle>Abaixo do saldo mínimo recomendado</AlertTitle>
          <AlertDescription>
            O pagamento cabe, mas deixa a conta abaixo do mínimo cadastrado na tesouraria.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Valor" value={formatCurrencyBRL(Number(schedule.totalAmount))} />
        <Info
          label="Data programada"
          value={
            schedule.scheduledDate ? formatDateBR(schedule.scheduledDate) : "Sem data"
          }
        />
        <Info
          label="Forma"
          value={
            schedule.bankPaymentType
              ? PAYMENT_TYPE_LABELS[schedule.bankPaymentType]
              : "—"
          }
        />
        <Info
          label="Lote"
          value={schedule.batch ? schedule.batch.code : "Fora de lote"}
        />
      </div>

      {/* ── Ações ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {hasPermission("payment_schedule.reschedule") && !blocked && (
          <Button onClick={() => setPanel("reschedule")}>
            <CalendarClock className="size-4" />
            Reprogramar
          </Button>
        )}
        {hasPermission("payment_schedule.block") && !blocked && (
          <Button variant="outline" onClick={() => setPanel("block")}>
            <Ban className="size-4" />
            Bloquear
          </Button>
        )}
        {hasPermission("payment_schedule.unblock") && blocked && (
          <Button variant="outline" onClick={() => setPanel("unblock")}>
            <Unlock className="size-4" />
            Liberar
          </Button>
        )}
        {hasPermission("payment_schedule.edit") &&
          schedule.status !== "CANCELLED" && (
            <Button variant="outline" onClick={() => setPanel("cancel")}>
              <XCircle className="size-4" />
              Cancelar programação
            </Button>
          )}
        <Button variant="ghost" onClick={() => setPanel("comment")}>
          <MessageSquare className="size-4" />
          Comentar
        </Button>
      </div>

      {panel === "reschedule" && (
        <ReschedulePanel
          current={schedule.scheduledDate}
          pending={actions.reschedule.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.reschedule.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível reprogramar."),
            })
          }
        />
      )}

      {panel === "block" && (
        <BlockPanel
          pending={actions.block.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.block.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível bloquear."),
            })
          }
        />
      )}

      {panel === "unblock" && (
        <TextPanel
          title="Liberar bloqueio"
          label="Motivo da liberação"
          submitLabel="Liberar"
          pending={actions.unblock.isPending}
          onCancel={close}
          onSubmit={(value) =>
            actions.unblock.mutate(
              { releaseReason: value },
              {
                onSuccess: close,
                onError: (caught) => onError(caught, "Não foi possível liberar."),
              },
            )
          }
        />
      )}

      {panel === "cancel" && (
        <TextPanel
          title="Cancelar programação"
          hint="As parcelas voltam à fila e o título continua devido. Cancelar aqui não cancela o título."
          label="Motivo do cancelamento"
          submitLabel="Cancelar programação"
          pending={actions.cancel.isPending}
          onCancel={close}
          onSubmit={(value) =>
            actions.cancel.mutate(
              { reason: value },
              {
                onSuccess: close,
                onError: (caught) => onError(caught, "Não foi possível cancelar."),
              },
            )
          }
        />
      )}

      {panel === "comment" && (
        <TextPanel
          title="Comentar"
          label="Comentário"
          submitLabel="Comentar"
          multiline
          pending={actions.comment.isPending}
          onCancel={close}
          onSubmit={(value) =>
            actions.comment.mutate(
              { body: value },
              {
                onSuccess: close,
                onError: (caught) => onError(caught, "Não foi possível comentar."),
              },
            )
          }
        />
      )}

      {/* ── Título de origem ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Título de origem</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Título" value={schedule.payable.code} />
          <Info
            label="Fornecedor"
            value={displayNameOf(schedule.payable.supplier)}
          />
          <Info
            label="Documento"
            value={schedule.payable.documentNumber ?? "—"}
          />
          <Info
            label="Vencimento do título"
            value={formatDateBR(schedule.payable.dueDate)}
          />
          <Info label="Descrição" value={schedule.payable.description ?? "—"} />
          <Info
            label="Data original desta programação"
            value={
              schedule.originalDate ? formatDateBR(schedule.originalDate) : "—"
            }
          />
          <Info
            label="Reprogramações"
            value={String(schedule.rescheduleCount)}
          />
          <div className="flex items-end">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/financeiro/contas-a-pagar/${schedule.payableId}`}>
                Abrir título
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Parcelas incluídas ──────────────────────────────────────────── */}
      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Parcelas incluídas ({schedule.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyBRL(Number(item.amount))}
                  </TableCell>
                  <TableCell className="text-sm">{item.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Posição da conta ────────────────────────────────────────────── */}
      {schedule.balance && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" />
              Posição da conta na data
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Conta" value={schedule.balance.position.accountName} />
            <Info
              label="Saldo de abertura"
              value={formatCurrencyBRL(schedule.balance.position.openingBalance)}
            />
            <Info
              label="Limite contratado"
              value={formatCurrencyBRL(schedule.balance.position.creditLimit)}
            />
            <Info
              label="Já comprometido"
              value={formatCurrencyBRL(schedule.balance.position.committedAmount)}
            />
            <Info
              label="Projetado antes deste pagamento"
              value={formatCurrencyBRL(schedule.balance.position.projectedBalance)}
            />
            <Info
              label="Projetado depois"
              value={formatCurrencyBRL(schedule.balance.projectedAfter)}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Comentários ─────────────────────────────────────────────────── */}
      {schedule.comments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comentários</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {schedule.comments.map((comment) => (
              <div key={comment.id} className="rounded-md border p-3">
                <p className="text-sm">{comment.body}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTimeBR(comment.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Histórico ───────────────────────────────────────────────────── */}
      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Histórico
          </CardTitle>
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
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">
                    {formatDateTimeBR(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {HISTORY_ACTION_LABELS[entry.action]}
                    {entry.field && (
                      <p className="text-xs text-muted-foreground">{entry.field}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{entry.previousValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.newValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.reason ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.ipAddress ?? "—"}
                  </TableCell>
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
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}

function ReschedulePanel({
  current,
  pending,
  onCancel,
  onSubmit,
}: {
  current: string | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [scheduledDate, setScheduledDate] = React.useState(
    current ? current.slice(0, 10) : "",
  );
  const [reason, setReason] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [paymentType, setPaymentType] = React.useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reprogramar pagamento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nova data" required>
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
              {(Object.keys(PAYMENT_TYPE_LABELS) as BankPaymentType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PAYMENT_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Motivo" required>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button
            disabled={!scheduledDate || !reason || pending}
            onClick={() =>
              onSubmit({
                scheduledDate,
                reason,
                ...(priority ? { priority } : {}),
                ...(paymentType ? { bankPaymentType: paymentType } : {}),
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Reprogramar
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BlockPanel({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [reason, setReason] = React.useState<ScheduleBlockReason>(
    "INSUFFICIENT_BALANCE",
  );
  const [notes, setNotes] = React.useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bloquear programação</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Motivo">
          <Select
            value={reason}
            onValueChange={(value) => setReason(value as ScheduleBlockReason)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BLOCK_REASON_LABELS) as ScheduleBlockReason[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {BLOCK_REASON_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Descrição">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <div className="flex gap-2 sm:col-span-2">
          <Button
            disabled={pending}
            onClick={() => onSubmit({ reason, ...(notes ? { notes } : {}) })}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Bloquear
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TextPanel({
  title,
  hint,
  label,
  submitLabel,
  multiline,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string;
  hint?: string;
  label: string;
  submitLabel: string;
  multiline?: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = React.useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

        <Field label={label} required>
          {multiline ? (
            <Textarea
              rows={4}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          ) : (
            <Input value={value} onChange={(event) => setValue(event.target.value)} />
          )}
        </Field>

        <div className="flex gap-2">
          <Button disabled={!value || pending} onClick={() => onSubmit(value)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
