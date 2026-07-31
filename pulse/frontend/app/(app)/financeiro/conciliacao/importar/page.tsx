"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CopyCheck,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";

import {
  useConfirmImport,
  useEligibleAccounts,
  useImportTemplates,
  useUploadStatement,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
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
import { DirectionAmount, brl } from "@/components/reconciliation/shared";
import {
  DUPLICATE_LABELS,
  SOURCE_TYPE_LABELS,
  type ImportPreview,
} from "@/types/reconciliation";

/**
 * Importação de extrato (seções 7 a 23).
 *
 * O fluxo é **validar → conferir → confirmar**, sempre. Importar direto seria uma chamada a
 * menos e um estrago a mais: um arquivo com o mapeamento errado entraria inteiro, e
 * desfazer significaria apagar movimentações que já poderiam ter sido conciliadas.
 */
export default function ImportarExtratoPage() {
  const router = useRouter();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data: accounts } = useEligibleAccounts(organizationId, companyId);
  const { data: templates } = useImportTemplates({ organizationId, companyId });

  const upload = useUploadStatement();
  const confirm = useConfirmImport();

  const [file, setFile] = React.useState<File | null>(null);
  const [accountId, setAccountId] = React.useState<string>("");
  const [templateId, setTemplateId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canImport = hasPermission("reconciliation.import");
  const account = accounts?.find((item) => item.account.id === accountId);

  /** Um arquivo tabular sem modelo cai no mapeamento padrão e quase sempre falha. */
  const needsTemplate =
    file !== null && /\.(csv|txt|xlsx|xls)$/i.test(file.name) && !templateId;

  function send() {
    if (!organizationId || !companyId || !file || !accountId) return;

    setError(null);
    upload.mutate(
      {
        organizationId,
        companyId,
        financialAccountId: accountId,
        file,
        importTemplateId: templateId || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: (result) => setPreview(result),
        onError: (caught: unknown) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível ler o arquivo.",
          ),
      },
    );
  }

  function confirmImport(overrideDuplicate: boolean) {
    if (!preview) return;

    setError(null);
    confirm.mutate(
      {
        id: preview.importId,
        overrideDuplicate,
        ...(overrideDuplicate
          ? { duplicateReason: "Importação liberada após conferência da prévia." }
          : {}),
      },
      {
        onSuccess: () =>
          router.push(`/financeiro/conciliacao/extratos/${preview.importId}`),
        onError: (caught: unknown) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível confirmar a importação.",
          ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/conciliacao">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Upload className="size-5" />
            Importar extrato
          </h1>
          <p className="text-xs text-muted-foreground">
            O arquivo é lido e conferido antes de virar movimentação. Nada é
            importado até você confirmar.
          </p>
        </div>
      </div>

      {!canImport && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Sem permissão para importar</AlertTitle>
          <AlertDescription>
            Você pode consultar os extratos já importados, mas não enviar novos.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível continuar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1. Arquivo e conta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="Conta financeira"
            required
            hint="Só aparecem contas com a conciliação habilitada."
          >
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {(accounts ?? [])
                  .filter((item) => item.isEnabled)
                  .map((item) => (
                    <SelectItem key={item.account.id} value={item.account.id}>
                      {item.account.displayName ?? item.account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Modelo de importação"
            hint="Obrigatório para CSV e planilha; o OFX traz a estrutura no próprio arquivo."
          >
            <Select
              value={templateId || "none"}
              onValueChange={(value) =>
                setTemplateId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem modelo (OFX)</SelectItem>
                {(templates?.items ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Arquivo" required>
            <Input
              type="file"
              accept=".ofx,.csv,.txt,.xlsx,.xls"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </Field>

          <Field label="Observações">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Contexto da importação, se houver."
              rows={2}
            />
          </Field>

          {account && (
            <p className="text-xs text-muted-foreground md:col-span-2">
              Esta conta aceita:{" "}
              {account.allowedImportTypes
                .map((type) => SOURCE_TYPE_LABELS[type])
                .join(", ")}
              . Tamanho máximo:{" "}
              {(account.maximumFileSize / 1024 / 1024).toFixed(0)} MB.
            </p>
          )}

          {needsTemplate && (
            <Alert className="md:col-span-2">
              <AlertTriangle className="size-4" />
              <AlertTitle>Arquivo tabular sem modelo</AlertTitle>
              <AlertDescription>
                CSV e planilha não dizem quais colunas são o quê. Sem um modelo
                de leitura, o Pulse não sabe onde está a data, o valor nem o
                sinal — e nunca vai adivinhar.{" "}
                <Link
                  href="/financeiro/conciliacao/modelos"
                  className="underline"
                >
                  Cadastrar um modelo
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}

          <div className="md:col-span-2">
            <Button
              onClick={send}
              disabled={
                !canImport ||
                !file ||
                !accountId ||
                needsTemplate ||
                upload.isPending
              }
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Ler e conferir
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && <PreviewPanel preview={preview} />}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3. Confirmar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {preview.errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>O arquivo não pode ser importado</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc">
                    {preview.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                {preview.counts.valid} movimentação(ões) serão criadas nesta
                conta. As linhas com erro não entram — o arquivo original fica
                guardado e pode ser reprocessado.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => confirmImport(false)}
                disabled={preview.errors.length > 0 || confirm.isPending}
              >
                {confirm.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Confirmar importação
              </Button>

              {preview.duplicate &&
                preview.duplicate.status !== "NOT_DUPLICATE" && (
                  <Button
                    variant="outline"
                    onClick={() => confirmImport(true)}
                    disabled={confirm.isPending}
                  >
                    <CopyCheck className="size-4" />
                    Importar mesmo assim
                  </Button>
                )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** A prévia mostra o que vai entrar — e o que o arquivo diz que deveria bater. */
function PreviewPanel({ preview }: { preview: ImportPreview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          2. Prévia — {preview.fileName}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Formato" value={SOURCE_TYPE_LABELS[preview.sourceType]} />
          <Info
            label="Período"
            value={
              preview.header.startDate && preview.header.endDate
                ? `${formatDateBR(preview.header.startDate)} a ${formatDateBR(preview.header.endDate)}`
                : "Não informado no arquivo"
            }
          />
          <Info label="Entradas" value={brl(preview.totals.credits)} />
          <Info label="Saídas" value={brl(preview.totals.debits)} />
          <Info
            label="Saldo final do arquivo"
            value={
              preview.header.closingBalance === null
                ? "Não informado"
                : brl(preview.header.closingBalance)
            }
          />
          <Info
            label="Saldo calculado"
            value={
              preview.totals.calculatedClosingBalance === null
                ? "—"
                : brl(preview.totals.calculatedClosingBalance)
            }
          />
          <Info
            label="Linhas lidas"
            value={`${preview.counts.valid} válidas de ${preview.counts.total}`}
          />
          <Info
            label="Duplicidades"
            value={String(preview.counts.duplicates)}
          />
        </div>

        {preview.balanceMatches === false && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>O saldo do arquivo não fecha</AlertTitle>
            <AlertDescription>
              O saldo final declarado no extrato não bate com a soma das
              movimentações lidas. Confira se o arquivo está completo antes de
              importar — conciliar sobre um extrato truncado esconde o que ficou
              de fora.
            </AlertDescription>
          </Alert>
        )}

        {preview.duplicate && preview.duplicate.status !== "NOT_DUPLICATE" && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {DUPLICATE_LABELS[preview.duplicate.status]}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {preview.duplicate.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {preview.duplicate.previousFileName && (
                <p className="mt-1">
                  Arquivo anterior: {preview.duplicate.previousFileName}
                  {preview.duplicate.previousImportedAt &&
                    ` (importado em ${formatDateBR(preview.duplicate.previousImportedAt)})`}
                  .
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {preview.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Avisos da leitura</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {preview.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linha</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.sample.map((row) => (
                <TableRow key={row.lineNumber}>
                  <TableCell className="tabular-nums">
                    {row.lineNumber}
                  </TableCell>
                  <TableCell>
                    {row.transactionDate
                      ? formatDateBR(row.transactionDate)
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-sm truncate">
                    {row.originalDescription}
                  </TableCell>
                  <TableCell>{row.documentNumber ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.direction && row.amount !== null ? (
                      <DirectionAmount
                        direction={row.direction}
                        amount={row.amount}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {row.errors.length > 0 ? (
                      <Badge variant="destructive">{row.errors[0]}</Badge>
                    ) : row.duplicateStatus !== "NOT_DUPLICATE" ? (
                      <Badge variant="secondary">
                        {DUPLICATE_LABELS[row.duplicateStatus]}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Válida</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Amostra das primeiras linhas. A importação processa o arquivo inteiro.
        </p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
