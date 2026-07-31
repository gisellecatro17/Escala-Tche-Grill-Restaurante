"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileInput,
  Keyboard,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import {
  useCaptureDocument,
  useCreateManualEntry,
  useDocumentIntakeSettings,
  useUploadBatch,
  useUploadDocument,
  useValidateBoleto,
} from "@/lib/api/document-intake";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import {
  UploadDropzone,
  formatBytes,
  type DropzoneFile,
} from "@/components/document-intake/upload-dropzone";
import {
  DOCUMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  SOURCE_CHANNEL_LABELS,
  UNCONFIGURED_CHANNELS,
  type IntakeDocumentType,
  type IntakePriority,
} from "@/types/document-intake";

/**
 * Tela de envio (seções 8, 12, 13 e 14).
 *
 * Os quatro canais implementados ficam em abas, e os canais preparados mas sem conexão
 * aparecem listados como "Não configurado" — declarar o que ainda não existe é mais honesto
 * que omitir.
 */
export default function EnviarDocumentosPage() {
  // `useSearchParams` obriga a um limite de suspensão: sem ele a página inteira sairia da
  // pré-renderização estática e o build falha.
  return (
    <React.Suspense fallback={<Header />}>
      <EnviarDocumentos />
    </React.Suspense>
  );
}

function EnviarDocumentos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data: settings } = useDocumentIntakeSettings(organizationId, companyId);

  const modo = searchParams.get("modo");
  const initialTab =
    modo === "lote" ? "lote" : modo === "camera" ? "camera" : modo === "manual" ? "manual" : "arquivo";

  if (!companyId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Header />
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            Todo documento pertence a uma empresa. Selecione a empresa de destino no seletor
            do topo antes de enviar.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Header />

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="arquivo">
            <Upload className="size-4" /> Arquivo
          </TabsTrigger>
          <TabsTrigger value="lote">
            <FileInput className="size-4" /> Lote
          </TabsTrigger>
          <TabsTrigger value="camera">
            <Camera className="size-4" /> Câmera
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Keyboard className="size-4" /> Digitar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arquivo">
          <UploadForm
            organizationId={organizationId!}
            companyId={companyId}
            settings={settings}
            mode="single"
            onDone={(id) => router.push(`/financeiro/entrada-documentos/${id}`)}
            disabled={!hasPermission("document_intake.upload")}
          />
        </TabsContent>

        <TabsContent value="lote">
          <UploadForm
            organizationId={organizationId!}
            companyId={companyId}
            settings={settings}
            mode="batch"
            onDone={() => router.push("/financeiro/entrada-documentos/caixa-de-entrada")}
            disabled={!hasPermission("document_intake.batch_upload")}
          />
        </TabsContent>

        <TabsContent value="camera">
          <UploadForm
            organizationId={organizationId!}
            companyId={companyId}
            settings={settings}
            mode="capture"
            onDone={(id) => router.push(`/financeiro/entrada-documentos/${id}`)}
            disabled={!hasPermission("document_intake.capture")}
          />
        </TabsContent>

        <TabsContent value="manual">
          <ManualEntryForm
            organizationId={organizationId!}
            companyId={companyId}
            onDone={(id) => router.push(`/financeiro/entrada-documentos/${id}`)}
            disabled={!hasPermission("document_intake.manual_entry")}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Outros canais de entrada</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {UNCONFIGURED_CHANNELS.map((channel) => (
            <Badge key={channel} variant="outline" className="text-muted-foreground">
              {SOURCE_CHANNEL_LABELS[channel]}: não configurado
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
        <Link href="/financeiro/entrada-documentos">
          <FileInput /> Entrada de documentos
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">Enviar documentos</h1>
      <p className="text-sm text-muted-foreground">
        Envie boletos, notas fiscais, faturas, comprovantes e outros documentos financeiros.
      </p>
    </div>
  );
}

// ── Envio de arquivos ───────────────────────────────────────────────────────

function UploadForm({
  organizationId,
  companyId,
  settings,
  mode,
  onDone,
  disabled,
}: {
  organizationId: string;
  companyId: string;
  settings?: { maximumFileSize: number; maximumFilesPerUpload: number; allowedExtensions: string[] };
  mode: "single" | "batch" | "capture";
  onDone: (documentId: string) => void;
  disabled: boolean;
}) {
  const [files, setFiles] = React.useState<DropzoneFile[]>([]);
  const [documentType, setDocumentType] = React.useState<string>("auto");
  const [priority, setPriority] = React.useState<IntakePriority>("NORMAL");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    accepted: number;
    rejected: { fileName: string; reason: string }[];
    warnings: string[];
  } | null>(null);

  const upload = useUploadDocument();
  const uploadBatch = useUploadBatch();
  const capture = useCaptureDocument();

  const validFiles = files.filter((entry) => entry.localError === null);
  const busy = upload.isPending || uploadBatch.isPending || capture.isPending;

  async function submit() {
    setError(null);
    setResult(null);

    if (validFiles.length === 0) {
      setError("Selecione ao menos um arquivo válido.");
      return;
    }

    const common = {
      organizationId,
      companyId,
      documentType: documentType === "auto" ? undefined : documentType,
      priority,
      notes: notes.trim() || undefined,
    };

    try {
      if (mode === "batch") {
        const response = await uploadBatch.mutateAsync({
          ...common,
          files: validFiles.map((entry) => entry.file),
          sourceChannel: "BATCH_IMPORT",
        });

        setResult({ accepted: response.accepted, rejected: response.rejected, warnings: [] });
        setFiles([]);

        // Só sai da tela quando tudo entrou: com recusas, o usuário precisa ver o que falhou.
        if (response.rejected.length === 0) onDone("");
        return;
      }

      const mutation = mode === "capture" ? capture : upload;
      const response = await mutation.mutateAsync({
        ...common,
        file: validFiles[0].file,
        sourceChannel: mode === "capture" ? "CAMERA_CAPTURE" : "DRAG_AND_DROP",
      });

      onDone(response.document.id);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError([caught.message, ...caught.errors].filter(Boolean).join(" "));
      } else {
        setError(caught instanceof Error ? caught.message : "Falha inesperada no envio.");
      }
    }
  }

  if (disabled) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para este tipo de envio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Não foi possível enviar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert
          className={result.rejected.length > 0 ? "border-amber-500/40" : undefined}
        >
          <CheckCircle2 />
          <AlertTitle>
            {result.accepted} arquivo(s) enviado(s) com sucesso
          </AlertTitle>
          <AlertDescription>
            {result.rejected.length > 0 ? (
              <>
                <p>Os seguintes arquivos foram recusados:</p>
                <ul className="mt-1 list-inside list-disc">
                  {result.rejected.map((entry) => (
                    <li key={entry.fileName}>
                      <span className="font-medium">{entry.fileName}</span>: {entry.reason}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Link
                href="/financeiro/entrada-documentos/caixa-de-entrada"
                className="underline"
              >
                Ver na caixa de entrada
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <UploadDropzone
            files={files}
            onFilesChange={setFiles}
            multiple={mode === "batch"}
            capture={mode === "capture" ? "environment" : undefined}
            acceptedExtensions={settings?.allowedExtensions}
            maximumFileSize={settings?.maximumFileSize}
            maximumFiles={settings?.maximumFilesPerUpload}
          />

          {mode === "capture" && (
            <Alert>
              <Camera />
              <AlertTitle>Para uma boa captura</AlertTitle>
              <AlertDescription>
                Centralize o documento, evite sombras, garanta boa iluminação, capture todas
                as páginas e confira a nitidez antes de enviar. Nenhum filtro é aplicado — o
                conteúdo documental não é alterado.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tipo do documento"
              hint="Deixe automático para o sistema classificar."
            >
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Identificar automaticamente</SelectItem>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Prioridade">
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as IntakePriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Observação">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Informação adicional para quem vai revisar"
            />
          </Field>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Como o arquivo é tratado</AlertTitle>
        <AlertDescription>
          O tipo real é verificado pelo conteúdo, não pela extensão. O arquivo vai para
          armazenamento privado e só é acessível por link temporário. Nenhum documento gera
          pagamento: depois da leitura, ele fica aguardando sua revisão.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {validFiles.length > 0
            ? `${validFiles.length} arquivo(s) pronto(s) · ${formatBytes(
                validFiles.reduce((sum, entry) => sum + entry.file.size, 0),
              )}`
            : "Nenhum arquivo selecionado"}
        </span>
        <Button onClick={submit} disabled={busy || validFiles.length === 0}>
          <Send /> {busy ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

// ── Digitação manual ────────────────────────────────────────────────────────

function ManualEntryForm({
  organizationId,
  companyId,
  onDone,
  disabled,
}: {
  organizationId: string;
  companyId: string;
  onDone: (documentId: string) => void;
  disabled: boolean;
}) {
  const create = useCreateManualEntry();
  const validateBoleto = useValidateBoleto();

  const [values, setValues] = React.useState({
    documentType: "BOLETO" as IntakeDocumentType,
    documentNumber: "",
    issueDate: "",
    dueDate: "",
    grossAmount: "",
    description: "",
    digitableLine: "",
    notes: "",
    priority: "NORMAL" as IntakePriority,
  });
  const [error, setError] = React.useState<string | null>(null);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /**
   * Valida o código digitado e preenche valor e vencimento a partir dele.
   *
   * O código de barras é fonte mais confiável que a digitação: ele carrega valor e
   * vencimento com dígito verificador. Preencher a partir dele reduz erro de digitação.
   */
  async function checkBoleto() {
    setError(null);
    if (!values.digitableLine.trim()) return;

    try {
      const result = await validateBoleto.mutateAsync(values.digitableLine);

      if (!result.valid) {
        setError(result.errors.join(" "));
        return;
      }

      setValues((current) => ({
        ...current,
        grossAmount: result.amount !== null ? String(result.amount) : current.grossAmount,
        dueDate: result.dueDate ? result.dueDate.slice(0, 10) : current.dueDate,
      }));

      if (result.warnings.length > 0) setError(result.warnings.join(" "));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao validar o código.");
    }
  }

  async function submit() {
    setError(null);

    if (!values.grossAmount) {
      setError("Informe o valor do documento.");
      return;
    }

    try {
      const document = await create.mutateAsync({
        organizationId,
        companyId,
        documentType: values.documentType,
        documentNumber: values.documentNumber.trim() || undefined,
        issueDate: values.issueDate || undefined,
        dueDate: values.dueDate || undefined,
        grossAmount: Number(values.grossAmount),
        description: values.description.trim() || undefined,
        digitableLine: values.digitableLine.replace(/\D/g, "") || undefined,
        notes: values.notes.trim() || undefined,
        priority: values.priority,
      });

      onDone(document.id);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError([caught.message, ...caught.errors].filter(Boolean).join(" "));
      } else {
        setError(caught instanceof Error ? caught.message : "Falha inesperada.");
      }
    }
  }

  if (disabled) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para digitar documentos manualmente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Confira os dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo do documento" required>
            <Select
              value={values.documentType}
              onValueChange={(value) => set("documentType", value as IntakeDocumentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Número do documento">
            <Input
              value={values.documentNumber}
              onChange={(event) => set("documentNumber", event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Linha digitável ou código de barras"
              hint="Ao validar, o valor e o vencimento são preenchidos a partir do código."
            >
              <div className="flex gap-2">
                <Input
                  value={values.digitableLine}
                  onChange={(event) => set("digitableLine", event.target.value)}
                  placeholder="00190.50095 40144.816069 06809.350314 3 37370000000100"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={checkBoleto}
                  disabled={validateBoleto.isPending || !values.digitableLine.trim()}
                >
                  {validateBoleto.isPending ? "Validando…" : "Validar"}
                </Button>
              </div>
            </Field>
          </div>

          <Field label="Data de emissão">
            <Input
              type="date"
              value={values.issueDate}
              onChange={(event) => set("issueDate", event.target.value)}
            />
          </Field>

          <Field label="Data de vencimento">
            <Input
              type="date"
              value={values.dueDate}
              onChange={(event) => set("dueDate", event.target.value)}
            />
          </Field>

          <Field label="Valor" required>
            <Input
              value={values.grossAmount}
              inputMode="decimal"
              onChange={(event) => set("grossAmount", event.target.value)}
              placeholder="2450.00"
            />
          </Field>

          <Field label="Prioridade">
            <Select
              value={values.priority}
              onValueChange={(value) => set("priority", value as IntakePriority)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Descrição">
              <Input
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Energia elétrica — agosto/2026"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Observação">
              <Textarea
                value={values.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={2}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Mesmo fluxo dos demais canais</AlertTitle>
        <AlertDescription>
          O documento digitado passa pela mesma fila, pelas mesmas validações e pela mesma
          auditoria: fornecedor, categoria e centro de custo são definidos na revisão.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={create.isPending}>
          <Send /> {create.isPending ? "Salvando…" : "Registrar documento"}
        </Button>
      </div>
    </div>
  );
}
