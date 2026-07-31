"use client";

import * as React from "react";
import Link from "next/link";
import { History, Search } from "lucide-react";

import { useIntakeDocuments } from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DOCUMENT_TYPE_LABELS,
  PROCESSING_STATUS_LABELS,
  SOURCE_CHANNEL_LABELS,
  type IntakeDocument,
} from "@/types/document-intake";

/**
 * Histórico da entrada de documentos (seções 48 e 49).
 *
 * Aqui não se altera nada: é o registro do que entrou, por onde entrou e o que aconteceu com
 * cada documento — inclusive os rejeitados, que ficam guardados e nunca são excluídos
 * automaticamente. O detalhe de cada mudança de situação, com autor e horário, está na aba
 * "Histórico" do próprio documento.
 */
export default function DocumentIntakeHistoryPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [channel, setChannel] = React.useState("all");
  const [receivedFrom, setReceivedFrom] = React.useState("");
  const [receivedTo, setReceivedTo] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useIntakeDocuments({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    search: search || undefined,
    processingStatus: status === "all" ? undefined : status,
    sourceChannel: channel === "all" ? undefined : channel,
    receivedFrom: receivedFrom || undefined,
    receivedTo: receivedTo || undefined,
    page,
    perPage: 25,
    orderBy: "receivedAt",
    order: "desc",
  });

  const documents = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  function resetToFirstPage<Value>(setter: (value: Value) => void) {
    return (value: Value) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <History className="size-5" />
          Histórico de entrada
        </h1>
        <p className="text-sm text-muted-foreground">
          Tudo o que chegou ao sistema, com a data de recebimento, o canal de origem e o
          desfecho de cada documento.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Número, fornecedor, arquivo…"
                value={search}
                onChange={(event) => resetToFirstPage(setSearch)(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Situação</Label>
            <Select value={status} onValueChange={resetToFirstPage(setStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PROCESSING_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Canal</Label>
            <Select value={channel} onValueChange={resetToFirstPage(setChannel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(SOURCE_CHANNEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>De</Label>
              <Input
                type="date"
                value={receivedFrom}
                onChange={(event) => resetToFirstPage(setReceivedFrom)(event.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Até</Label>
              <Input
                type="date"
                value={receivedTo}
                onChange={(event) => resetToFirstPage(setReceivedTo)(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum documento no período e nos filtros escolhidos.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Processado</TableHead>
                  <TableHead>Desfecho</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <Link
                        href={`/financeiro/entrada-documentos/${document.id}`}
                        className="font-medium hover:underline"
                      >
                        {document.documentNumber ??
                          document.displayName ??
                          document.originalFileName ??
                          "Sem identificação"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[document.documentType]}
                        {document.company &&
                          ` · ${document.company.tradeName ?? document.company.legalName ?? ""}`}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {SOURCE_CHANNEL_LABELS[document.sourceChannel]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTimeBR(document.receivedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {document.processedAt ? formatDateTimeBR(document.processedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{outcomeOf(document)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {PROCESSING_STATUS_LABELS[document.processingStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-2 md:hidden">
            {documents.map((document) => (
              <Card key={document.id}>
                <CardContent className="flex flex-col gap-1 py-3">
                  <Link
                    href={`/financeiro/entrada-documentos/${document.id}`}
                    className="font-medium hover:underline"
                  >
                    {document.documentNumber ??
                      document.displayName ??
                      document.originalFileName ??
                      "Sem identificação"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[document.documentType]} ·{" "}
                    {SOURCE_CHANNEL_LABELS[document.sourceChannel]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recebido em {formatDateTimeBR(document.receivedAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary">
                      {PROCESSING_STATUS_LABELS[document.processingStatus]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {outcomeOf(document)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data?.meta.total ?? 0} documento(s) · página {page} de {totalPages}
            </p>
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
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** O que aconteceu com o documento ao final — encaminhado, rejeitado ou arquivado. */
function outcomeOf(document: IntakeDocument): string {
  if (document.rejectedAt) return `Rejeitado em ${formatDateTimeBR(document.rejectedAt)}`;
  if (document.archivedAt) return `Arquivado em ${formatDateTimeBR(document.archivedAt)}`;
  if (document.forwardedAt) return `Encaminhado em ${formatDateTimeBR(document.forwardedAt)}`;
  return "Em andamento";
}
