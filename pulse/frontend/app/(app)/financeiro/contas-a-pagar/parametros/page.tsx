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
  useAccountsPayableSettings,
  useUpdateAccountsPayableSettings,
} from "@/lib/api/accounts-payable";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  PRIORITY_LABELS,
  type AccountsPayablePriority,
  type AccountsPayableSettings,
} from "@/types/accounts-payable";

export default function ContasAPagarParametrosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: settings, isLoading } = useAccountsPayableSettings(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const update = useUpdateAccountsPayableSettings();

  const [edits, setEdits] = React.useState<Partial<AccountsPayableSettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEdit = hasPermission("accounts_payable.edit");
  const draft: AccountsPayableSettings | null = settings
    ? { ...settings, ...edits }
    : null;
  const dirty = Object.keys(edits).length > 0;

  function set<Key extends keyof AccountsPayableSettings>(
    key: Key,
    value: AccountsPayableSettings[Key],
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
          <Link href="/financeiro/contas-a-pagar">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal className="size-5" />
            Parâmetros do contas a pagar
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
            Seu perfil não tem a permissão de editar o contas a pagar.
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
          <AlertDescription>Valem para os próximos títulos.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Geração do título</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Gerar o título automaticamente na aprovação"
            hint="Desligado, o lançamento fica aprovado e alguém precisa gerar o título à mão."
            checked={draft.autoGenerateOnApproval}
            disabled={!canEdit}
            onChange={(value) => set("autoGenerateOnApproval", value)}
          />
          <Toggle
            label="Bloquear título de documento com pendência"
            hint="O título nasce bloqueado quando o documento de origem tem pendência aberta."
            checked={draft.autoBlockWhenDocumentPending}
            disabled={!canEdit}
            onChange={(value) => set("autoBlockWhenDocumentPending", value)}
          />
          <Field
            label="Prefixo do código"
            hint="O sequencial é por empresa e por ano (ex.: CP-2026-000042)."
          >
            <Input
              value={draft.codePrefix}
              disabled={!canEdit}
              onChange={(event) => set("codePrefix", event.target.value)}
            />
          </Field>
          <Field label="Prioridade padrão">
            <Select
              value={draft.defaultPriority}
              disabled={!canEdit}
              onValueChange={(value) =>
                set("defaultPriority", value as AccountsPayablePriority)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as AccountsPayablePriority[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {PRIORITY_LABELS[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Encargos por atraso</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Juros ao mês (%)"
            hint="Usado só na prévia. Aplicar continua sendo um ato de alguém."
          >
            <Input
              inputMode="decimal"
              value={draft.defaultMonthlyInterestRate ?? ""}
              disabled={!canEdit}
              onChange={(event) =>
                set(
                  "defaultMonthlyInterestRate",
                  event.target.value === "" ? null : event.target.value,
                )
              }
            />
          </Field>
          <Field label="Multa (%)">
            <Input
              inputMode="decimal"
              value={draft.defaultPenaltyRate ?? ""}
              disabled={!canEdit}
              onChange={(event) =>
                set(
                  "defaultPenaltyRate",
                  event.target.value === "" ? null : event.target.value,
                )
              }
            />
          </Field>
          <Field label="Dias de tolerância">
            <Input
              type="number"
              min={0}
              max={90}
              value={draft.gracePeriodDays}
              disabled={!canEdit}
              onChange={(event) =>
                set("gracePeriodDays", Number(event.target.value))
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Controles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Permitir baixa parcial"
            hint="Desligado, só a baixa integral do saldo."
            checked={draft.allowPartialPayment}
            disabled={!canEdit}
            onChange={(value) => set("allowPartialPayment", value)}
          />
          <Toggle
            label="Exigir justificativa para mudar vencimento"
            hint="É a alteração que a auditoria mais questiona."
            checked={draft.requireJustificationOnDueDateChange}
            disabled={!canEdit}
            onChange={(value) => set("requireJustificationOnDueDateChange", value)}
          />
          <Toggle
            label="Exigir justificativa para mudar valor, fornecedor, centro de custo ou projeto"
            checked={draft.requireJustificationOnAmountChange}
            disabled={!canEdit}
            onChange={(value) => set("requireJustificationOnAmountChange", value)}
          />
          <Field
            label="Prazo de reabertura (dias)"
            hint="Em branco: sem prazo. Reabrir um cancelamento antigo quase sempre é engano."
          >
            <Input
              type="number"
              min={0}
              value={draft.reopenWindowDays ?? ""}
              disabled={!canEdit}
              onChange={(event) =>
                set(
                  "reopenWindowDays",
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            />
          </Field>
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
