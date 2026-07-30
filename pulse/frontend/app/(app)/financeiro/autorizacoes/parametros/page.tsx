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
  useApprovalSettings,
  useUpdateApprovalSettings,
} from "@/lib/api/approvals";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/treasury/field";
import {
  NOTIFICATION_CHANNEL_LABELS,
  UNIMPLEMENTED_CHANNELS,
  type ApprovalNotificationChannel,
  type ApprovalSettings,
} from "@/types/approvals";

export default function AutorizacoesParametrosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: settings, isLoading } = useApprovalSettings(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const update = useUpdateApprovalSettings();

  const [edits, setEdits] = React.useState<Partial<ApprovalSettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEdit = hasPermission("approvals.manage");
  const draft: ApprovalSettings | null = settings
    ? { ...settings, ...edits }
    : null;
  const dirty = Object.keys(edits).length > 0;

  function set<Key extends keyof ApprovalSettings>(
    key: Key,
    value: ApprovalSettings[Key],
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
          <Link href="/financeiro/autorizacoes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal className="size-5" />
            Parâmetros das autorizações
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
            Seu perfil não tem a permissão de gerenciar as autorizações.
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
            Valem para as próximas solicitações abertas.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quando exigir aprovação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Exigir aprovação de todo lançamento"
            hint="Com isso ligado, um lançamento sem fluxo correspondente é recusado no processamento em vez de seguir direto."
            checked={draft.requireApprovalForAll}
            disabled={!canEdit}
            onChange={(value) => set("requireApprovalForAll", value)}
          />
          <Field
            label="Aprovação obrigatória acima de (R$)"
            hint="Em branco: só os fluxos decidem."
          >
            <Input
              inputMode="decimal"
              value={
                draft.mandatoryAboveAmount === null
                  ? ""
                  : String(draft.mandatoryAboveAmount)
              }
              disabled={!canEdit}
              onChange={(event) =>
                set(
                  "mandatoryAboveAmount",
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras de decisão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Impedir aprovar o que a própria pessoa criou"
            hint="Recomendado. Vale mesmo quando a etapa do fluxo permite."
            checked={draft.blockSelfApprovalGlobally}
            disabled={!canEdit}
            onChange={(value) => set("blockSelfApprovalGlobally", value)}
          />
          <Toggle
            label="Respeitar o limite individual do usuário"
            hint="O limite de aprovação gravado no vínculo do usuário com a empresa."
            checked={draft.enforceIndividualLimit}
            disabled={!canEdit}
            onChange={(value) => set("enforceIndividualLimit", value)}
          />
          <Toggle
            label="Expirar solicitações vencidas"
            hint="Expirar não é reprovar: a solicitação sai da fila e alguém precisa reiniciar o fluxo."
            checked={draft.expireOverdueRequests}
            disabled={!canEdit}
            onChange={(value) => set("expireOverdueRequests", value)}
          />
          <Field label="Prazo padrão das etapas (horas)">
            <Input
              type="number"
              min={1}
              value={draft.defaultDeadlineHours}
              disabled={!canEdit}
              onChange={(event) =>
                set("defaultDeadlineHours", Number(event.target.value))
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notificações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Os canais ficam declarados aqui, mas nenhum envio real acontece nesta etapa —
            o módulo de notificações ainda não foi desenvolvido.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              Object.keys(NOTIFICATION_CHANNEL_LABELS) as ApprovalNotificationChannel[]
            ).map((channel) => {
              const selected = draft.notificationChannels.includes(channel);

              return (
                <Button
                  key={channel}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  disabled={!canEdit}
                  onClick={() =>
                    set(
                      "notificationChannels",
                      selected
                        ? draft.notificationChannels.filter(
                            (item) => item !== channel,
                          )
                        : [...draft.notificationChannels, channel],
                    )
                  }
                >
                  {NOTIFICATION_CHANNEL_LABELS[channel]}
                  {UNIMPLEMENTED_CHANNELS.includes(channel) && (
                    <Badge variant="secondary">futuro</Badge>
                  )}
                </Button>
              );
            })}
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
