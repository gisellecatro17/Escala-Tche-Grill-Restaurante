"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Archive,
  CheckCircle2,
  Copy,
  FileInput,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";

import {
  useBatchActions,
  useIntakeDocuments,
  type IntakeDocumentFilters,
} from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONFIDENCE_BAND_LABELS,
  DOCUMENT_TYPE_LABELS,
  DUPLICATE_STATUS_LABELS,
  PRIORITY_LABELS,
  PROCESSING_STATUS_LABELS,
  SOURCE_CHANNEL_LABELS,
  confidenceBand,
  type IntakeDocument,
  type IntakeProcessingStatus,
} from "@/types/document-intake";

const STATUS_VARIANT: Record<
  IntakeProcessingStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  UPLOADED: "secondary",
  VALIDATING: "outline",
  STORED: "secondary",
  QUEUED: "outline",
  EXTRACTING: "outline",
  CLASSIFYING: "outline",
  MATCHING: "outline",
  VALIDATING_DATA: "outline",
  PENDING_REVIEW: "default",
  READY_FOR_PROCESSING: "default",
  PROCESSED: "secondary",
  ERROR: "destructive",
  REJECTED: "destructive",
  DUPLICATE: "destructive",
  ARCHIVED: "secondary",
};

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

function partyName(document: IntakeDocument) {
  const party = document.supplier ?? document.customer;
  if (party) return party.tradeName ?? party.legalName ?? "—";
  return document.issuerName ?? "—";
}

/**
 * Caixa de entrada (seções 33, 34 e 48).
 *
 * O mesmo componente serve todas as filas do menu: cada tela passa `fixedFilters` com o
 * recorte que lhe interessa. Assim "Com pendências", "Com erro" e "Processados" não são
 * três listagens diferentes que podem divergir — são a mesma, filtrada.
 */
export function DocumentInbox({
  title,
  description,
  fixedFilters = {},
  showFilters = true,
}: {
  title: string;
  description: string;
  fixedFilters?: Partial<IntakeDocumentFilters>;
  showFilters?: boolean;
}) {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [search, setSearch] = React.useState("");
  const [documentType, setDocumentType] = React.useState("all");
  const [processingStatus, setProcessingStatus] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [batchResult, setBatchResult] = React.useState<{
    succeeded: number;
    failed: { documentId: string; reason: string }[];
  } | null>(null);

  const { data, isLoading } = useIntakeDocuments({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    search: search || undefined,
    documentType: documentType === "all" ? undefined : documentType,
    processingStatus: processingStatus === "all" ? undefined : processingStatus,
    priority: priority === "all" ? undefined : priority,
    page,
    perPage: 25,
    ...fixedFilters,
  });

  const batch = useBatchActions();
  const documents = data?.items ?? [];

  const allSelected = documents.length > 0 && documents.every((item) => selected.has(item.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(documents.map((item) => item.id)));
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Executa uma ação em lote e mostra o que passou e o que falhou (seção 48). */
  async function runBatch(
    action: "forward" | "reprocess" | "archive",
    confirmation: string,
  ) {
    if (selected.size === 0) return;
    if (!window.confirm(`${confirmation}\n\n${selected.size} documento(s) selecionado(s).`)) {
      return;
    }

    const mutation = batch[action];
    const result = await mutation.mutateAsync({ documentIds: [...selected] });
    setBatchResult({ succeeded: result.succeeded, failed: result.failed });
    setSelected(new Set());
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/financeiro/entrada-documentos">
              <FileInput /> Entrada de documentos
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {hasPermission("document_intake.upload") && (
          <Button asChild>
            <Link href="/financeiro/entrada-documentos/enviar">
              <Send /> Enviar documentos
            </Link>
          </Button>
        )}
      </div>

      {batchResult && (
        <Alert className={batchResult.failed.length > 0 ? "border-amber-500/40" : undefined}>
          <CheckCircle2 />
          <AlertTitle>{batchResult.succeeded} documento(s) processado(s)</AlertTitle>
          {batchResult.failed.length > 0 && (
            <AlertDescription>
              <p>Os seguintes não foram alterados:</p>
              <ul className="mt-1 list-inside list-disc">
                {batchResult.failed.map((entry) => (
                  <li key={entry.documentId}>
                    <Link
                      href={`/financeiro/entrada-documentos/${entry.documentId}`}
                      className="underline"
                    >
                      {entry.documentId.slice(0, 8)}
                    </Link>
                    : {entry.reason}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      {showFilters && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por arquivo, número, emitente ou chave"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Select
              value={documentType}
              onValueChange={(value) => {
                setDocumentType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {fixedFilters.processingStatus === undefined && (
              <Select
                value={processingStatus}
                onValueChange={(value) => {
                  setProcessingStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {Object.entries(PROCESSING_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={priority}
              onValueChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {selected.size > 0 && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm font-medium">
              {selected.size} selecionado(s)
            </span>
            {hasPermission("document_intake.forward") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void runBatch(
                    "forward",
                    "Encaminhar os documentos selecionados para processamento? Cada um passa pelas mesmas validações.",
                  )
                }
                disabled={batch.forward.isPending}
              >
                <Send /> Encaminhar
              </Button>
            )}
            {hasPermission("document_intake.reprocess") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runBatch("reprocess", "Reprocessar os documentos selecionados?")}
                disabled={batch.reprocess.isPending}
              >
                <RefreshCw /> Reprocessar
              </Button>
            )}
            {hasPermission("document_intake.archive") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runBatch("archive", "Arquivar os documentos selecionados?")}
                disabled={batch.archive.isPending}
              >
                <Archive /> Arquivar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum documento encontrado com estes filtros.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabela no desktop */}
          <div className="hidden overflow-x-auto rounded-md border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="w-36">Tipo</TableHead>
                  <TableHead>Fornecedor / cliente</TableHead>
                  <TableHead className="w-24">Emissão</TableHead>
                  <TableHead className="w-24">Vencimento</TableHead>
                  <TableHead className="w-28">Valor</TableHead>
                  <TableHead className="w-24">Confiança</TableHead>
                  <TableHead className="w-40">Situação</TableHead>
                  <TableHead className="w-24">Pendências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => {
                  const band = confidenceBand(document.confidence);

                  return (
                    <TableRow key={document.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(document.id)}
                          onCheckedChange={() => toggle(document.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/financeiro/entrada-documentos/${document.id}`}
                          className="flex flex-col hover:underline"
                        >
                          <span className="font-medium">
                            {document.originalFileName ??
                              document.documentNumber ??
                              "Documento digitado"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {SOURCE_CHANNEL_LABELS[document.sourceChannel]} ·{" "}
                            {formatDateTimeBR(document.receivedAt)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {DOCUMENT_TYPE_LABELS[document.documentType]}
                      </TableCell>
                      <TableCell className="text-sm">{partyName(document)}</TableCell>
                      <TableCell className="text-sm">
                        {document.issueDate ? formatDateBR(document.issueDate) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {document.dueDate ? formatDateBR(document.dueDate) : "—"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatAmount(document.grossAmount)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium ${CONFIDENCE_CLASS[band]}`}
                          title={CONFIDENCE_BAND_LABELS[band]}
                        >
                          {document.confidence === null
                            ? "—"
                            : `${Math.round(Number(document.confidence))}%`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={STATUS_VARIANT[document.processingStatus]}>
                            {PROCESSING_STATUS_LABELS[document.processingStatus]}
                          </Badge>
                          {!document.companyId && (
                            <Badge variant="outline" className="text-[10px] text-amber-600">
                              Sem empresa
                            </Badge>
                          )}
                          {["POSSIBLE_DUPLICATE", "HIGH_PROBABILITY", "EXACT_DUPLICATE", "CONFIRMED_DUPLICATE"].includes(
                            document.duplicateStatus,
                          ) && (
                            <Badge variant="outline" className="text-[10px] text-amber-600">
                              <Copy className="size-3" />
                              {DUPLICATE_STATUS_LABELS[document.duplicateStatus]}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {document._count && document._count.issues > 0 ? (
                          <Badge variant="outline">
                            <AlertTriangle className="size-3" />
                            {document._count.issues}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Cards no celular e no tablet */}
          <div className="flex flex-col gap-2 lg:hidden">
            {documents.map((document) => (
              <Card key={document.id}>
                <CardContent className="flex flex-col gap-1.5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/financeiro/entrada-documentos/${document.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate font-medium">
                        {document.originalFileName ??
                          document.documentNumber ??
                          "Documento digitado"}
                      </p>
                    </Link>
                    <Checkbox
                      checked={selected.has(document.id)}
                      onCheckedChange={() => toggle(document.id)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS_VARIANT[document.processingStatus]}>
                      {PROCESSING_STATUS_LABELS[document.processingStatus]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {DOCUMENT_TYPE_LABELS[document.documentType]}
                    </span>
                    {document._count && document._count.issues > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {document._count.issues} pendência(s)
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{partyName(document)}</p>
                  <p className="text-sm tabular-nums">
                    {formatAmount(document.grossAmount)}
                    {document.dueDate && (
                      <span className="text-muted-foreground">
                        {" "}
                        · vence {formatDateBR(document.dueDate)}
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.meta.total} documento(s) · página {data.meta.page} de{" "}
                {data.meta.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Ban className="size-3.5" />
        Nenhum documento desta tela gera pagamento. O encaminhamento entrega o documento ao
        módulo financeiro, que ainda será construído.
      </p>
    </div>
  );
}
