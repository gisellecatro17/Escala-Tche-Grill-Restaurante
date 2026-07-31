"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Landmark, Save, ShieldCheck } from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import {
  useFinancialAccounts,
  useTreasurySettings,
  useUpdateTreasurySettings,
} from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Field } from "@/components/treasury/field";
import {
  RECONCILIATION_MODE_LABELS,
  type ReconciliationMode,
  type TreasurySettings,
} from "@/types/treasury";

const NONE = "none";

/** Contas padrão: cada uma aponta para uma conta financeira da própria empresa. */
const DEFAULT_ACCOUNT_FIELDS = [
  { key: "primaryFinancialAccountId", label: "Conta principal" },
  { key: "defaultPaymentAccountId", label: "Conta padrão para pagamentos" },
  { key: "defaultReceiptAccountId", label: "Conta padrão para recebimentos" },
  { key: "defaultTaxAccountId", label: "Conta padrão para tributos" },
  { key: "defaultPayrollAccountId", label: "Conta padrão para folha" },
  { key: "defaultCashAccountId", label: "Caixa padrão" },
] as const;

const RULE_FIELDS = [
  {
    key: "allowNegativeBalance",
    label: "Permitir saldo negativo",
    hint: "Sem isto, um lançamento que deixaria a conta negativa é recusado.",
  },
  {
    key: "allowInactiveAccountOperations",
    label: "Permitir movimentar conta inativa",
  },
  { key: "requireAvailableBalance", label: "Exigir saldo disponível" },
  { key: "requireAttachment", label: "Exigir anexo nos lançamentos" },
  { key: "requireRegisteredBeneficiary", label: "Exigir favorecido cadastrado" },
  {
    key: "requireHolderValidation",
    label: "Exigir validação de titularidade",
    hint: "O documento do titular precisa coincidir com o do favorecido.",
  },
  { key: "allowThirdPartyAccounts", label: "Permitir contas de terceiros" },
  {
    key: "allowOpeningBalanceChange",
    label: "Permitir corrigir saldo de implantação",
  },
  { key: "allowManualEntries", label: "Permitir lançamentos manuais" },
] as const;

const SEGREGATION_FIELDS = [
  { key: "requireSegregationOfDuties", label: "Exigir segregação de funções" },
  {
    key: "segregateEntryFromApproval",
    label: "Quem lança não aprova",
  },
  {
    key: "segregateApprovalFromReconciliation",
    label: "Quem aprova não concilia",
  },
  { key: "allowSelfApproval", label: "Permitir aprovar o próprio lançamento" },
] as const;

type BooleanKey =
  | (typeof RULE_FIELDS)[number]["key"]
  | (typeof SEGREGATION_FIELDS)[number]["key"]
  | "requireDualApproval";

export default function ParametrosTesourariaPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data: settings, isLoading } = useTreasurySettings(organizationId, companyId);
  const { data: accounts } = useFinancialAccounts({
    organizationId,
    companyId,
    perPage: 100,
  });
  const updateSettings = useUpdateTreasurySettings();

  // Em vez de copiar a resposta da API para um estado (o que exigiria um efeito e
  // descartaria revalidações), guardamos apenas os campos que o usuário mexeu e os
  // aplicamos sobre o que veio do servidor.
  const [edits, setEdits] = React.useState<Partial<TreasurySettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const draft: TreasurySettings | null = settings ? { ...settings, ...edits } : null;

  const canEdit = hasPermission("treasury.manage_settings");

  function set<K extends keyof TreasurySettings>(key: K, value: TreasurySettings[K]) {
    setEdits((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function setFlag(key: BooleanKey, value: boolean) {
    set(key, value);
  }

  function optionalNumber(value: string | number | null) {
    if (value === null || value === "") return undefined;
    return Number(value);
  }

  async function submit() {
    if (!draft || !organizationId || !companyId) return;
    setError(null);

    const accountIds = Object.fromEntries(
      DEFAULT_ACCOUNT_FIELDS.map((field) => [
        field.key,
        draft[field.key] ?? undefined,
      ]),
    );

    const flags = Object.fromEntries(
      [...RULE_FIELDS, ...SEGREGATION_FIELDS].map((field) => [
        field.key,
        draft[field.key],
      ]),
    );

    try {
      await updateSettings.mutateAsync({
        organizationId,
        companyId,
        payload: {
          ...accountIds,
          ...flags,
          currencyCode: draft.currencyCode,
          minimumSafetyBalance: optionalNumber(draft.minimumSafetyBalance),
          requireDualApproval: draft.requireDualApproval,
          dualApprovalAmount: optionalNumber(draft.dualApprovalAmount),
          cardExpirationAlertDays: Number(draft.cardExpirationAlertDays),
          accountClosingAlertDays: Number(draft.accountClosingAlertDays),
          defaultReconciliationMode: draft.defaultReconciliationMode,
          amountTolerance: Number(draft.amountTolerance),
          dateToleranceDays: Number(draft.dateToleranceDays),
        },
      });
      setEdits({});
      setSaved(true);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError([caught.message, ...caught.errors].filter(Boolean).join(" "));
      } else {
        setError(caught instanceof Error ? caught.message : "Falha inesperada.");
      }
    }
  }

  if (!companyId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            Os parâmetros de tesouraria são por empresa. Selecione a empresa para
            configurá-los.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || !draft) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const accountOptions = accounts?.items ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/cadastros/tesouraria">
            <Landmark /> Tesouraria
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Parâmetros de Tesouraria
        </h1>
        <p className="text-sm text-muted-foreground">
          Regras que os módulos financeiros seguirão ao movimentar as contas desta
          empresa.
        </p>
      </div>

      {!canEdit && (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Você pode consultar os parâmetros, mas não alterá-los.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Parâmetros salvos</AlertTitle>
          <AlertDescription>
            As novas regras valem para os próximos lançamentos.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contas padrão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {DEFAULT_ACCOUNT_FIELDS.map((field) => (
            <Field key={field.key} label={field.label}>
              <Select
                value={draft[field.key] ?? NONE}
                disabled={!canEdit}
                onValueChange={(value) =>
                  set(field.key, value === NONE ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName ?? account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moeda e saldos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Moeda">
            <Input
              value={draft.currencyCode}
              disabled={!canEdit}
              maxLength={3}
              onChange={(event) =>
                set("currencyCode", event.target.value.toUpperCase())
              }
            />
          </Field>
          <Field
            label="Saldo mínimo de segurança"
            hint="Usado para alertar quando o caixa fica abaixo do colchão desejado."
          >
            <Input
              value={draft.minimumSafetyBalance ?? ""}
              inputMode="decimal"
              disabled={!canEdit}
              onChange={(event) => set("minimumSafetyBalance", event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras de movimentação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {RULE_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-0.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft[field.key]}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => setFlag(field.key, checked === true)}
                />
                {field.label}
              </label>
              {"hint" in field && field.hint && (
                <p className="ml-6 text-xs text-muted-foreground">{field.hint}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aprovação e segregação de funções</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.requireDualApproval}
              disabled={!canEdit}
              onCheckedChange={(checked) =>
                setFlag("requireDualApproval", checked === true)
              }
            />
            Exigir dupla aprovação
          </label>
          {draft.requireDualApproval && (
            <Field
              label="Valor a partir do qual exigir dupla aprovação"
              required
              hint="Obrigatório quando a dupla aprovação está ativa."
            >
              <Input
                value={draft.dualApprovalAmount ?? ""}
                inputMode="decimal"
                disabled={!canEdit}
                onChange={(event) => set("dualApprovalAmount", event.target.value)}
                placeholder="10000.00"
              />
            </Field>
          )}
          {SEGREGATION_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft[field.key]}
                disabled={!canEdit}
                onCheckedChange={(checked) => setFlag(field.key, checked === true)}
              />
              {field.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas e conciliação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Alertar cartão vencendo em (dias)">
            <Input
              value={String(draft.cardExpirationAlertDays)}
              inputMode="numeric"
              disabled={!canEdit}
              onChange={(event) =>
                set("cardExpirationAlertDays", Number(event.target.value || 0))
              }
            />
          </Field>
          <Field label="Alertar encerramento de conta em (dias)">
            <Input
              value={String(draft.accountClosingAlertDays)}
              inputMode="numeric"
              disabled={!canEdit}
              onChange={(event) =>
                set("accountClosingAlertDays", Number(event.target.value || 0))
              }
            />
          </Field>
          <Field label="Regime de conciliação padrão">
            <Select
              value={draft.defaultReconciliationMode}
              disabled={!canEdit}
              onValueChange={(value) =>
                set("defaultReconciliationMode", value as ReconciliationMode)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECONCILIATION_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Tolerância de valor"
            hint="Diferença aceita entre extrato e lançamento."
          >
            <Input
              value={String(draft.amountTolerance)}
              inputMode="decimal"
              disabled={!canEdit}
              onChange={(event) => set("amountTolerance", event.target.value)}
            />
          </Field>
          <Field label="Tolerância de data (dias)">
            <Input
              value={String(draft.dateToleranceDays)}
              inputMode="numeric"
              disabled={!canEdit}
              onChange={(event) =>
                set("dateToleranceDays", Number(event.target.value || 0))
              }
            />
          </Field>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={updateSettings.isPending}>
            <Save /> {updateSettings.isPending ? "Salvando…" : "Salvar parâmetros"}
          </Button>
        </div>
      )}
    </div>
  );
}
