"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Save, SlidersHorizontal } from "lucide-react";

import {
  useDocumentIntakeSettings,
  useUpdateDocumentIntakeSettings,
} from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/treasury/field";
import { DEFAULT_ACCEPTED_EXTENSIONS } from "@/components/document-intake/upload-dropzone";
import type { DocumentIntakeSettings } from "@/types/document-intake";

/**
 * Parâmetros da entrada de documentos (seção 82).
 *
 * São parâmetros **por empresa**: cada uma define o que aceita receber, quando exige revisão
 * e o que bloqueia o encaminhamento. Nenhum deles libera pagamento — o mais longe que vão é
 * permitir que um documento de alta confiança siga para a próxima etapa sem revisão manual.
 *
 * As edições ficam sobrepostas ao que veio do servidor, sem copiar a resposta para estado em
 * efeito: assim uma revalidação não apaga o que o usuário está digitando.
 */
export default function DocumentIntakeSettingsPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: settings, isLoading } = useDocumentIntakeSettings(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const update = useUpdateDocumentIntakeSettings();

  const [edits, setEdits] = React.useState<Partial<DocumentIntakeSettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEdit = hasPermission("document_intake.manage_settings");
  const draft: DocumentIntakeSettings | null = settings ? { ...settings, ...edits } : null;
  const dirty = Object.keys(edits).length > 0;

  function set<Key extends keyof DocumentIntakeSettings>(
    key: Key,
    value: DocumentIntakeSettings[Key],
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
          Parâmetros da entrada de documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Valem para a empresa selecionada no cabeçalho. Cada empresa tem os seus.
        </p>
      </div>

      {!canEdit && (
        <Alert>
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Seu perfil não tem a permissão de alterar os parâmetros da entrada de documentos.
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
            As novas regras valem para os próximos documentos recebidos.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Arquivos aceitos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Tamanho máximo por arquivo (MB)">
            <Input
              type="number"
              min={1}
              value={Math.round(draft.maximumFileSize / (1024 * 1024))}
              disabled={!canEdit}
              onChange={(event) =>
                set("maximumFileSize", Number(event.target.value) * 1024 * 1024)
              }
            />
          </Field>
          <Field label="Arquivos por envio">
            <Input
              type="number"
              min={1}
              value={draft.maximumFilesPerUpload}
              disabled={!canEdit}
              onChange={(event) => set("maximumFilesPerUpload", Number(event.target.value))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Extensões permitidas"
              hint="Separadas por vírgula. O sistema confere o conteúdo do arquivo, não a extensão informada — a lista aqui é um filtro a mais, não a única barreira. Arquivos compactados continuam bloqueados."
            >
              <Input
                value={draft.allowedExtensions.join(", ")}
                disabled={!canEdit}
                placeholder={DEFAULT_ACCEPTED_EXTENSIONS.join(", ")}
                onChange={(event) =>
                  set(
                    "allowedExtensions",
                    event.target.value
                      .split(",")
                      .map((extension) => extension.trim().toLowerCase())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Leitura e reconhecimento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Usar OCR quando não houver texto"
            hint="O OCR só entra em imagens e PDFs sem texto. XML, texto nativo e código de barras têm prioridade e não passam por ele."
            checked={draft.ocrEnabled}
            disabled={!canEdit}
            onChange={(value) => set("ocrEnabled", value)}
          />
          <Toggle
            label="Ler código de barras e linha digitável"
            checked={draft.barcodeReadingEnabled}
            disabled={!canEdit}
            onChange={(value) => set("barcodeReadingEnabled", value)}
          />
          <Field
            label="Confiança mínima (%)"
            hint="Abaixo disso o documento vai para revisão manual."
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={Number(draft.minimumConfidence)}
              disabled={!canEdit}
              onChange={(event) => set("minimumConfidence", Number(event.target.value))}
            />
          </Field>
          <Field label="Confiança alta (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={Number(draft.highConfidenceThreshold)}
              disabled={!canEdit}
              onChange={(event) => set("highConfidenceThreshold", Number(event.target.value))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revisão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Exigir revisão humana"
            hint="Recomendado. Com a revisão obrigatória, nenhum documento chega ao processamento sem alguém ter olhado."
            checked={draft.mandatoryReview}
            disabled={!canEdit}
            onChange={(value) => set("mandatoryReview", value)}
          />
          <Toggle
            label="Encaminhar sozinho quando a confiança for alta"
            hint="Vale apenas para documentos sem pendências e sem duplicidade. Encaminhar não cria obrigação financeira nem autoriza pagamento."
            checked={draft.autoForwardHighConfidence}
            disabled={!canEdit || draft.mandatoryReview}
            onChange={(value) => set("autoForwardHighConfidence", value)}
          />
          <Field label="Prazo de revisão (horas)">
            <Input
              type="number"
              min={1}
              value={draft.reviewDeadlineHours}
              disabled={!canEdit}
              onChange={(event) => set("reviewDeadlineHours", Number(event.target.value))}
            />
          </Field>
          <Toggle
            label="Avisar os responsáveis"
            checked={draft.notificationsEnabled}
            disabled={!canEdit}
            onChange={(value) => set("notificationsEnabled", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exigências e bloqueios</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
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
            label="Verificar duplicidade"
            checked={draft.duplicateValidationEnabled}
            disabled={!canEdit}
            onChange={(value) => set("duplicateValidationEnabled", value)}
          />
          <Toggle
            label="Bloquear encaminhamento de duplicados"
            hint="A liberação continua possível, mas exige justificativa de quem tem permissão."
            checked={draft.blockDuplicates}
            disabled={!canEdit || !draft.duplicateValidationEnabled}
            onChange={(value) => set("blockDuplicates", value)}
          />
          <Toggle
            label="Bloquear código de barras inválido"
            checked={draft.blockInvalidBarcode}
            disabled={!canEdit}
            onChange={(value) => set("blockInvalidBarcode", value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cadastro rápido e retenção</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Permitir criar fornecedor durante a revisão"
            checked={draft.quickSupplierCreationEnabled}
            disabled={!canEdit}
            onChange={(value) => set("quickSupplierCreationEnabled", value)}
          />
          <Toggle
            label="Permitir criar cliente durante a revisão"
            checked={draft.quickCustomerCreationEnabled}
            disabled={!canEdit}
            onChange={(value) => set("quickCustomerCreationEnabled", value)}
          />
          <Toggle
            label="Permitir substituir o arquivo"
            hint="A substituição cria uma nova versão. O arquivo original nunca é sobrescrito."
            checked={draft.allowFileReplacement}
            disabled={!canEdit}
            onChange={(value) => set("allowFileReplacement", value)}
          />
          <Toggle
            label="Permitir excluir rascunhos"
            hint="Vale só para documentos que ainda não foram encaminhados. A exclusão é lógica: o registro permanece para auditoria."
            checked={draft.allowDraftDeletion}
            disabled={!canEdit}
            onChange={(value) => set("allowDraftDeletion", value)}
          />
          <Field
            label="Retenção dos arquivos (dias)"
            hint="Tempo mínimo de guarda do arquivo recebido."
          >
            <Input
              type="number"
              min={1}
              value={draft.retentionDays}
              disabled={!canEdit}
              onChange={(event) => set("retentionDays", Number(event.target.value))}
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
