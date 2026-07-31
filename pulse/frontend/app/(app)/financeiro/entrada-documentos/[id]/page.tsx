"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileInput,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";

import {
  useDuplicateActions,
  useIntakeDocument,
  useIntakeDocumentActions,
  useIntakeDuplicates,
  useIntakeExtractedFields,
  useIntakeIssues,
  useIntakeProcessingJobs,
  useIntakeRelations,
  useIssueActions,
} from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentViewer } from "@/components/document-intake/document-viewer";
import {
  CONFIDENCE_BAND_LABELS,
  DOCUMENT_DIRECTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  DUPLICATE_MATCH_TYPE_LABELS,
  DUPLICATE_STATUS_LABELS,
  EXTRACTED_FIELD_LABELS,
  EXTRACTION_METHOD_LABELS,
  ISSUE_SEVERITY_LABELS,
  ISSUE_TYPE_LABELS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  PRIORITY_LABELS,
  PROCESSING_STATUS_LABELS,
  RELATION_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  SOURCE_CHANNEL_LABELS,
  confidenceBand,
  type IntakeDocument,
} from "@/types/document-intake";

const CONFIDENCE_CLASS: Record<string, string> = {
  HIGH: "text-emerald-600 dark:text-emerald-500",
  MEDIUM: "text-amber-600 dark:text-amber-500",
  LOW: "text-destructive",
  NONE: "text-muted-foreground",
};

function formatAmount(value: string | number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Tela do documento (seções 35, 36 e 37).
 *
 * O layout do prompt é documento à esquerda, dados à direita — em telas pequenas isso vira
 * abas, porque lado a lado em 400px de largura não é legível.
 */
export default function DocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data: document, isLoading } = useIntakeDocument(id);
  const actions = useIntakeDocumentActions();
  const [actionError, setActionError] = React.useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Falha inesperada.");
    }
  }

  /** Pede o motivo antes de agir — rejeição e reabertura exigem justificativa. */
  async function withReason(label: string, action: (reason: string) => Promise<unknown>) {
    const reason = window.prompt(`${label}\n\nInforme o motivo:`);
    if (!reason?.trim()) return;
    await run(() => action(reason.trim()));
  }

  if (isLoading || !document) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const band = confidenceBand(document.confidence);
  const canForward =
    hasPermission("document_intake.forward") &&
    !["READY_FOR_PROCESSING", "PROCESSED", "REJECTED", "ARCHIVED"].includes(
      document.processingStatus,
    );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/financeiro/entrada-documentos/caixa-de-entrada">
              <FileInput /> Caixa de entrada
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="truncate">
              {document.originalFileName ??
                document.documentNumber ??
                "Documento digitado"}
            </span>
            <Badge
              variant={
                document.processingStatus === "ERROR" ||
                document.processingStatus === "REJECTED"
                  ? "destructive"
                  : "default"
              }
            >
              {PROCESSING_STATUS_LABELS[document.processingStatus]}
            </Badge>
            <Badge variant="outline">
              {REVIEW_STATUS_LABELS[document.reviewStatus]}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {DOCUMENT_TYPE_LABELS[document.documentType]} ·{" "}
            {DOCUMENT_DIRECTION_LABELS[document.documentDirection]} ·{" "}
            {SOURCE_CHANNEL_LABELS[document.sourceChannel]} · recebido em{" "}
            {formatDateTimeBR(document.receivedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPermission("document_intake.review") && (
            <Button variant="outline" asChild>
              <Link href={`/financeiro/entrada-documentos/${document.id}/revisar`}>
                <CheckCircle2 /> Revisar
              </Link>
            </Button>
          )}
          {canForward && (
            <Button
              onClick={() =>
                void run(() => actions.forward.mutateAsync({ id: document.id }))
              }
              disabled={actions.forward.isPending}
            >
              <Send /> Encaminhar
            </Button>
          )}
          {hasPermission("document_intake.reprocess") && (
            <Button
              variant="outline"
              onClick={() => void run(() => actions.reprocess.mutateAsync(document.id))}
              disabled={actions.reprocess.isPending}
            >
              <RefreshCw /> Reprocessar
            </Button>
          )}
          {hasPermission("document_intake.reject") &&
            document.processingStatus !== "REJECTED" && (
              <Button
                variant="outline"
                onClick={() =>
                  void withReason("Rejeitar documento", (reason) =>
                    actions.reject.mutateAsync({
                      id: document.id,
                      rejectionReason: "OTHER",
                      notes: reason,
                    }),
                  )
                }
              >
                <Ban /> Rejeitar
              </Button>
            )}
          {hasPermission("document_intake.reopen") &&
            ["REJECTED", "ARCHIVED"].includes(document.processingStatus) && (
              <Button
                variant="outline"
                onClick={() =>
                  void withReason("Reabrir documento", (reason) =>
                    actions.reopen.mutateAsync({ id: document.id, reason }),
                  )
                }
              >
                <RotateCcw /> Reabrir
              </Button>
            )}
          {hasPermission("document_intake.archive") &&
            document.processingStatus !== "ARCHIVED" && (
              <Button
                variant="outline"
                onClick={() =>
                  void run(() => actions.archive.mutateAsync({ id: document.id }))
                }
              >
                <Archive /> Arquivar
              </Button>
            )}
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {!document.companyId && (
        <Alert variant="destructive">
          <Building2 />
          <AlertTitle>A empresa não foi identificada</AlertTitle>
          <AlertDescription>
            Este documento não pode ser encaminhado até que a empresa de destino seja
            definida. Use a revisão para selecionar a empresa.
          </AlertDescription>
        </Alert>
      )}

      <BlockingIssuesAlert documentId={document.id} />
      <DuplicateAlert document={document} />

      {/* Documento à esquerda, dados à direita (seção 35). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DocumentViewer documentId={document.id} document={document} />

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Dados do documento
                <span className={`text-xs font-medium ${CONFIDENCE_CLASS[band]}`}>
                  {CONFIDENCE_BAND_LABELS[band]}
                  {document.confidence !== null &&
                    ` · ${Math.round(Number(document.confidence))}%`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoField
                  label="Empresa"
                  value={
                    document.company
                      ? (document.company.tradeName ?? document.company.legalName)
                      : "Não identificada"
                  }
                />
                <InfoField
                  label="Fornecedor / cliente"
                  value={
                    document.supplier
                      ? (document.supplier.tradeName ?? document.supplier.legalName)
                      : document.customer
                        ? (document.customer.tradeName ?? document.customer.legalName)
                        : (document.issuerName ?? "Não identificado")
                  }
                />
                <InfoField label="Número" value={document.documentNumber} />
                <InfoField label="Série" value={document.documentSeries} />
                <InfoField
                  label="Chave de acesso"
                  value={
                    document.accessKey ? (
                      <span className="break-all font-mono text-xs">{document.accessKey}</span>
                    ) : null
                  }
                />
                <InfoField
                  label="Emissão"
                  value={document.issueDate ? formatDateBR(document.issueDate) : null}
                />
                <InfoField
                  label="Vencimento"
                  value={document.dueDate ? formatDateBR(document.dueDate) : null}
                />
                <InfoField label="Valor bruto" value={formatAmount(document.grossAmount)} />
                <InfoField label="Desconto" value={formatAmount(document.discountAmount)} />
                <InfoField
                  label="Retenções"
                  value={formatAmount(document.withholdingAmount)}
                />
                <InfoField label="Valor líquido" value={formatAmount(document.netAmount)} />
                <InfoField label="Prioridade" value={PRIORITY_LABELS[document.priority]} />
                <div className="sm:col-span-2">
                  <InfoField
                    label="Linha digitável"
                    value={
                      document.digitableLine ? (
                        <span className="break-all font-mono text-xs">
                          {document.digitableLine}
                        </span>
                      ) : null
                    }
                  />
                </div>
                {document.description && (
                  <div className="sm:col-span-2">
                    <InfoField label="Descrição" value={document.description} />
                  </div>
                )}
              </dl>

              {document.extractionMethod && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Lido por: {EXTRACTION_METHOD_LABELS[document.extractionMethod]}
                </p>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="campos">
            <TabsList>
              <TabsTrigger value="campos">Campos extraídos</TabsTrigger>
              <TabsTrigger value="pendencias">Pendências</TabsTrigger>
              <TabsTrigger value="duplicidades">Duplicidades</TabsTrigger>
              <TabsTrigger value="relacionados">Relacionados</TabsTrigger>
              <TabsTrigger value="processamento">Processamento</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="campos">
              <ExtractedFieldsTab documentId={document.id} />
            </TabsContent>
            <TabsContent value="pendencias">
              <IssuesTab documentId={document.id} />
            </TabsContent>
            <TabsContent value="duplicidades">
              <DuplicatesTab documentId={document.id} />
            </TabsContent>
            <TabsContent value="relacionados">
              <RelationsTab documentId={document.id} />
            </TabsContent>
            <TabsContent value="processamento">
              <JobsTab documentId={document.id} />
            </TabsContent>
            <TabsContent value="historico">
              <HistoryTab document={document} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Alertas ─────────────────────────────────────────────────────────────────

function BlockingIssuesAlert({ documentId }: { documentId: string }) {
  const { data: issues } = useIntakeIssues(documentId);

  const blocking = (issues ?? []).filter(
    (issue) =>
      issue.severity === "BLOCKING" && ["OPEN", "IN_PROGRESS"].includes(issue.status),
  );

  if (blocking.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>
        {blocking.length} pendência(s) bloqueante(s) impedem o encaminhamento
      </AlertTitle>
      <AlertDescription>
        <ul className="list-inside list-disc">
          {blocking.map((issue) => (
            <li key={issue.id}>{issue.description}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function DuplicateAlert({ document }: { document: IntakeDocument }) {
  const suspicious = [
    "POSSIBLE_DUPLICATE",
    "HIGH_PROBABILITY",
    "EXACT_DUPLICATE",
    "CONFIRMED_DUPLICATE",
  ].includes(document.duplicateStatus);

  if (!suspicious) return null;

  return (
    <Alert className="border-amber-500/40">
      <Copy />
      <AlertTitle>{DUPLICATE_STATUS_LABELS[document.duplicateStatus]}</AlertTitle>
      <AlertDescription>
        Confira a aba de duplicidades e compare com o documento existente antes de
        encaminhar.
      </AlertDescription>
    </Alert>
  );
}

// ── Abas ────────────────────────────────────────────────────────────────────

function ExtractedFieldsTab({ documentId }: { documentId: string }) {
  const { data: fields, isLoading } = useIntakeExtractedFields(documentId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (!fields || fields.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum campo foi extraído deste documento. Preencha os dados na revisão.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="w-28">Confiança</TableHead>
              <TableHead className="w-40">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => {
              const band = confidenceBand(field.confidence);

              return (
                <TableRow key={field.id}>
                  <TableCell className="text-sm">
                    {EXTRACTED_FIELD_LABELS[field.fieldName] ?? field.fieldName}
                  </TableCell>
                  <TableCell className="break-all text-sm">
                    {field.normalizedValue ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${CONFIDENCE_CLASS[band]}`}>
                      {field.confidence === null
                        ? "—"
                        : `${Math.round(Number(field.confidence))}%`}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {EXTRACTION_METHOD_LABELS[field.sourceMethod]}
                    {field.isManuallyChanged && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        corrigido
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IssuesTab({ documentId }: { documentId: string }) {
  const { data: issues, isLoading } = useIntakeIssues(documentId);
  const { resolve } = useIssueActions();
  const { hasPermission } = useSession();

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!issues || issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma pendência registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {issues.map((issue) => {
        const open = ["OPEN", "IN_PROGRESS"].includes(issue.status);

        return (
          <Card
            key={issue.id}
            className={
              issue.severity === "BLOCKING" && open ? "border-destructive/40" : undefined
            }
          >
            <CardContent className="flex flex-col gap-1.5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    issue.severity === "BLOCKING"
                      ? "destructive"
                      : issue.severity === "WARNING"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {ISSUE_SEVERITY_LABELS[issue.severity]}
                </Badge>
                <span className="text-sm font-medium">
                  {ISSUE_TYPE_LABELS[issue.issueType]}
                </span>
                {!open && (
                  <Badge variant="secondary" className="text-[10px]">
                    Resolvida
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTimeBR(issue.createdAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{issue.description}</p>
              {issue.resolution && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Solução:</span> {issue.resolution}
                </p>
              )}
              {open && hasPermission("document_intake.review") && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const resolution = window.prompt(
                        "Como esta pendência foi resolvida?",
                      );
                      if (!resolution?.trim()) return;
                      void resolve.mutateAsync({
                        id: documentId,
                        issueId: issue.id,
                        resolution: resolution.trim(),
                      });
                    }}
                  >
                    <CheckCircle2 /> Resolver
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DuplicatesTab({ documentId }: { documentId: string }) {
  const { data: matches, isLoading } = useIntakeDuplicates(documentId);
  const { confirm, dismiss, replace, check } = useDuplicateActions();
  const { hasPermission } = useSession();
  const [error, setError] = React.useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  async function decide(
    action: "confirm" | "dismiss" | "replace",
    matchId: string,
    requiresReason: boolean,
  ) {
    setError(null);
    const label = {
      confirm: "Confirmar que este documento é duplicado",
      dismiss: "Liberar como não duplicado",
      replace: "Substituir o documento anterior por este",
    }[action];

    const reason = requiresReason
      ? window.prompt(`${label}\n\nInforme a justificativa:`)
      : window.confirm(`${label}?`)
        ? ""
        : null;

    if (reason === null) return;
    if (requiresReason && !reason.trim()) return;

    try {
      const mutation = { confirm, dismiss, replace }[action];
      await mutation.mutateAsync({
        id: documentId,
        matchId,
        reason: reason.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha inesperada.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!matches || matches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <p>Nenhuma suspeita de duplicidade.</p>
            {hasPermission("document_intake.manage_duplicates") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void check.mutateAsync(documentId)}
                disabled={check.isPending}
              >
                <RefreshCw /> Verificar de novo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        matches.map((match) => {
          const score = Number(match.similarityScore);
          const requiresReason = score >= 75;
          const decided = match.decision !== "PENDING";

          return (
            <Card key={match.id} className={decided ? undefined : "border-amber-500/40"}>
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={score >= 96 ? "destructive" : "outline"}>
                    {DUPLICATE_MATCH_TYPE_LABELS[match.matchType]}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">{score}% de semelhança</span>
                  {decided && (
                    <Badge variant="secondary" className="text-[10px]">
                      {match.decision === "CONFIRMED"
                        ? "Duplicidade confirmada"
                        : match.decision === "DISMISSED"
                          ? "Liberado"
                          : match.decision === "REPLACED"
                            ? "Substituído"
                            : match.decision}
                    </Badge>
                  )}
                </div>

                {match.matchedDocument && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-medium">
                      {match.matchedDocument.originalFileName ?? match.matchedDocument.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {match.matchedDocument.issuerName ?? "—"} ·{" "}
                      {formatAmount(match.matchedDocument.grossAmount)}
                      {match.matchedDocument.dueDate &&
                        ` · vence ${formatDateBR(match.matchedDocument.dueDate)}`}
                    </p>
                    <Link
                      href={`/financeiro/entrada-documentos/${match.matchedDocument.id}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs underline"
                    >
                      <ExternalLink className="size-3" /> Abrir documento existente
                    </Link>
                  </div>
                )}

                {match.matchingFields && match.matchingFields.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Campos coincidentes: {match.matchingFields.join(", ")}
                  </p>
                )}

                {match.decisionReason && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Justificativa:</span> {match.decisionReason}
                  </p>
                )}

                {!decided && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {hasPermission("document_intake.manage_duplicates") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void decide("confirm", match.id, false)}
                      >
                        Confirmar duplicidade
                      </Button>
                    )}
                    {hasPermission("document_intake.override_duplicate") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void decide("dismiss", match.id, requiresReason)}
                      >
                        Não é duplicado
                      </Button>
                    )}
                    {hasPermission("document_intake.manage_duplicates") &&
                      match.matchedDocumentId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void decide("replace", match.id, false)}
                        >
                          Substituir anterior
                        </Button>
                      )}
                  </div>
                )}

                {!decided && requiresReason && (
                  <p className="text-xs text-muted-foreground">
                    A semelhança é alta: liberar como não duplicado exige justificativa.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function RelationsTab({ documentId }: { documentId: string }) {
  const { data: relations, isLoading } = useIntakeRelations(documentId);

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (!relations || relations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum documento relacionado. Nota fiscal e boleto, fatura e comprovante podem ser
          vinculados sem que os arquivos sejam fundidos.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        {relations.map((relation) => {
          const other =
            relation.sourceDocumentId === documentId
              ? relation.targetDocument
              : relation.sourceDocument;

          return (
            <div
              key={relation.id}
              className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-0"
            >
              <Badge variant="outline">{RELATION_TYPE_LABELS[relation.relationType]}</Badge>
              {other && (
                <Link
                  href={`/financeiro/entrada-documentos/${other.id}`}
                  className="hover:underline"
                >
                  {other.originalFileName ?? other.id}
                </Link>
              )}
              {relation.notes && (
                <span className="text-xs text-muted-foreground">{relation.notes}</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function JobsTab({ documentId }: { documentId: string }) {
  const { data: jobs, isLoading } = useIntakeProcessingJobs(documentId);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum processamento registrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="w-32">Situação</TableHead>
              <TableHead className="w-24">Tentativa</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="text-sm">
                  {JOB_TYPE_LABELS[job.jobType]}
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTimeBR(job.createdAt)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      job.status === "COMPLETED"
                        ? "default"
                        : job.status === "DEAD_LETTER" || job.status === "FAILED"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {job.status === "RUNNING" && <Loader2 className="size-3 animate-spin" />}
                    {JOB_STATUS_LABELS[job.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {job.attemptNumber}/{job.maximumAttempts}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {job.errorMessage ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HistoryTab({ document }: { document: IntakeDocument }) {
  const history = document.statusHistory ?? [];

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma mudança de situação registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" /> Histórico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 border-b pb-2 last:border-0">
              <div className="flex flex-wrap items-baseline gap-2">
                {entry.newProcessingStatus && (
                  <span className="text-xs">
                    {entry.previousProcessingStatus &&
                      `${PROCESSING_STATUS_LABELS[entry.previousProcessingStatus]} → `}
                    <span className="font-medium">
                      {PROCESSING_STATUS_LABELS[entry.newProcessingStatus]}
                    </span>
                  </span>
                )}
                {entry.newReviewStatus && (
                  <Badge variant="outline" className="text-[10px]">
                    {REVIEW_STATUS_LABELS[entry.newReviewStatus]}
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTimeBR(entry.changedAt)}
                </span>
              </div>
              {entry.reason && (
                <span className="text-xs text-muted-foreground">{entry.reason}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
