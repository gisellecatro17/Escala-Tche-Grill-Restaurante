"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Save,
  SlidersHorizontal,
} from "lucide-react";

import {
  useSchedulingSettings,
  useUpdateSchedulingSettings,
} from "@/lib/api/payment-scheduling";
import { useSession } from "@/lib/auth/session-context";
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
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/treasury/field";
import {
  FUTURE_PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  type BankPaymentType,
  type PaymentScheduleSettings,
  type SchedulePriority,
} from "@/types/payment-scheduling";

export default function AgendamentoParametrosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: settings, isLoading } = useSchedulingSettings(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const update = useUpdateSchedulingSettings();

  const [edits, setEdits] = React.useState<Partial<PaymentScheduleSettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEdit = hasPermission("payment_schedule.edit");
  const draft: PaymentScheduleSettings | null = settings
    ? { ...settings, ...edits }
    : null;
  const dirty = Object.keys(edits).length > 0;

  function set<Key extends keyof PaymentScheduleSettings>(
    key: Key,
    value: PaymentScheduleSettings[Key],
  ) {
    setSaved(false);
    setEdits((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (!organizationId || !selectedCompanyId || !dirty) return;

    setError(null);
    update.mutate(
      { organizationId, companyId: selectedCompanyId, payload: edits },
      {
        onSuccess: () => {
          setEdits({});
          setSaved(true);
        },
        onError: (caught: unknown) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível salvar os parâmetros.",
          ),
      },
    );
  }

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/agendamento">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal className="size-5" />
            Parâmetros do agendamento
          </h1>
          <p className="text-xs text-muted-foreground">
            Valem para a empresa selecionada no cabeçalho.
          </p>
        </div>
      </div>

      {!canEdit && (
        <Alert>
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Seu perfil não tem a permissão de editar o agendamento.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Parâmetros não salvos</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert>
          <AlertTitle>Parâmetros salvos</AlertTitle>
          <AlertDescription>
            Valem para as próximas programações e lotes.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras de data</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Impedir data retroativa"
            hint="Programar para ontem é quase sempre engano de digitação."
            checked={draft.blockRetroactiveDates}
            disabled={!canEdit}
            onChange={(value) => set("blockRetroactiveDates", value)}
          />
          <Field
            label="Prazo mínimo (dias)"
            hint="Dias entre programar e pagar, para o banco processar."
          >
            <Input
              type="number"
              min={0}
              max={30}
              value={draft.minimumLeadTimeDays}
              disabled={!canEdit}
              onChange={(event) =>
                set("minimumLeadTimeDays", Number(event.target.value))
              }
            />
          </Field>
          <Toggle
            label="Exigir motivo em toda reprogramação"
            hint="Recomendado. É a alteração que a auditoria mais questiona."
            checked={draft.requireReasonOnReschedule}
            disabled={!canEdit}
            onChange={(value) => set("requireReasonOnReschedule", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saldo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Considerar limites contratados como caixa"
            hint="Cheque especial e capital de giro entram no poder de gasto da projeção."
            checked={draft.considerCreditLimits}
            disabled={!canEdit}
            onChange={(value) => set("considerCreditLimits", value)}
          />
          <Toggle
            label="Bloquear programação sem saldo"
            hint="Desligado, o sistema alerta e a decisão continua sendo de quem programa — útil para quem sabe que o dinheiro entra na véspera."
            checked={draft.blockOnInsufficientBalance}
            disabled={!canEdit}
            onChange={(value) => set("blockOnInsufficientBalance", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Padrões e códigos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Prefixo da programação">
            <Input
              value={draft.schedulePrefix}
              disabled={!canEdit}
              onChange={(event) => set("schedulePrefix", event.target.value)}
            />
          </Field>
          <Field label="Prefixo do lote">
            <Input
              value={draft.batchPrefix}
              disabled={!canEdit}
              onChange={(event) => set("batchPrefix", event.target.value)}
            />
          </Field>
          <Field label="Prioridade padrão">
            <Select
              value={draft.defaultPriority}
              disabled={!canEdit}
              onValueChange={(value) =>
                set("defaultPriority", value as SchedulePriority)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
          <Field label="Forma de pagamento padrão">
            <Select
              value={draft.defaultBankPaymentType ?? ""}
              disabled={!canEdit}
              onValueChange={(value) =>
                set("defaultBankPaymentType", value as BankPaymentType)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sem padrão" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Formas de pagamento suportadas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Os tipos estão declarados para que a execução bancária os consuma sem
            refatoração. Nesta etapa nenhum arquivo é gerado e nenhuma API de banco é
            chamada.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PAYMENT_TYPE_LABELS) as BankPaymentType[]).map((key) => (
              <Badge
                key={key}
                variant={FUTURE_PAYMENT_TYPES.includes(key) ? "secondary" : "outline"}
              >
                {PAYMENT_TYPE_LABELS[key]}
                {FUTURE_PAYMENT_TYPES.includes(key) && " · futuro"}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button disabled={!canEdit || !dirty || update.isPending} onClick={save}>
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Salvar parâmetros
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setEdits({})}>
            Descartar alterações
          </Button>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
