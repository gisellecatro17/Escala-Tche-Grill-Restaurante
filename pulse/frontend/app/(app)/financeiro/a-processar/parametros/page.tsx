"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Save, SlidersHorizontal } from "lucide-react";

import {
  useProcessingSettings,
  useUpdateProcessingSettings,
} from "@/lib/api/document-processing";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/treasury/field";
import type { DocumentProcessingSettings } from "@/types/document-processing";

/**
 * Parâmetros do processamento, por empresa.
 *
 * Mesmo desenho dos parâmetros da entrada: as edições ficam sobrepostas ao que veio do
 * servidor, sem copiar a resposta para estado em efeito.
 */
export default function ProcessamentoParametrosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: settings, isLoading } = useProcessingSettings(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const update = useUpdateProcessingSettings();

  const [edits, setEdits] = React.useState<Partial<DocumentProcessingSettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEdit = hasPermission("document_processing.manage_settings");
  const draft: DocumentProcessingSettings | null = settings
    ? { ...settings, ...edits }
    : null;
  const dirty = Object.keys(edits).length > 0;

  function set<Key extends keyof DocumentProcessingSettings>(
    key: Key,
    value: DocumentProcessingSettings[Key],
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
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <SlidersHorizontal className="size-5" />
          Parâmetros do processamento
        </h1>
        <p className="text-sm text-muted-foreground">
          Valem para a empresa selecionada no cabeçalho.
        </p>
      </div>

      {!canEdit && (
        <Alert>
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Seu perfil não tem a permissão de alterar os parâmetros do processamento.
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
            Valem para os próximos documentos processados.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Automação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Aplicar a regra de classificação automática"
            hint="A regra só preenche o que ninguém decidiu no documento."
            checked={draft.autoClassificationEnabled}
            disabled={!canEdit}
            onChange={(value) => set("autoClassificationEnabled", value)}
          />
          <Toggle
            label="Aplicar o rateio padrão"
            checked={draft.autoAllocationEnabled}
            disabled={!canEdit}
            onChange={(value) => set("autoAllocationEnabled", value)}
          />
          <Toggle
            label="Calcular as retenções do fornecedor"
            hint="O cálculo continua sendo sugestão: só a confirmação desconta o líquido."
            checked={draft.autoWithholdingEnabled}
            disabled={!canEdit}
            onChange={(value) => set("autoWithholdingEnabled", value)}
          />
          <Toggle
            label="Abrir o título automaticamente"
            hint="Só quando não houver retenção a decidir nem conferência pendente. Abrir é o que torna o lançamento uma obrigação — não paga nada."
            checked={draft.autoOpenWhenComplete}
            disabled={!canEdit}
            onChange={(value) => set("autoOpenWhenComplete", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exigências e limites</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Valor a partir do qual exige conferência"
            hint="Em branco: vale o limite do vínculo do fornecedor, se houver."
          >
            <Input
              inputMode="decimal"
              value={
                draft.approvalThresholdAmount === null
                  ? ""
                  : String(draft.approvalThresholdAmount)
              }
              disabled={!canEdit}
              onChange={(event) =>
                set(
                  "approvalThresholdAmount",
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            />
          </Field>

          <Field
            label="Prazo padrão (dias)"
            hint="Usado quando o documento não traz vencimento."
          >
            <Input
              type="number"
              min={0}
              max={365}
              value={draft.defaultPaymentTermDays}
              disabled={!canEdit}
              onChange={(event) =>
                set("defaultPaymentTermDays", Number(event.target.value))
              }
            />
          </Field>

          <Toggle
            label="Exigir categoria"
            checked={draft.requireCategory}
            disabled={!canEdit}
            onChange={(value) => set("requireCategory", value)}
          />
          <Toggle
            label="Exigir centro de custo"
            checked={draft.requireCostCenter}
            disabled={!canEdit}
            onChange={(value) => set("requireCostCenter", value)}
          />
          <Toggle
            label="Exigir projeto"
            checked={draft.requireProject}
            disabled={!canEdit}
            onChange={(value) => set("requireProject", value)}
          />
          <Toggle
            label="Bloquear parcelas que não fecham"
            hint="Impede processar quando a soma das parcelas não bate com o valor do lançamento."
            checked={draft.blockInstallmentMismatch}
            disabled={!canEdit}
            onChange={(value) => set("blockInstallmentMismatch", value)}
          />
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
