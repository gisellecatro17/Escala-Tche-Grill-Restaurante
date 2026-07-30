"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileClock, Inbox } from "lucide-react";

import { useProcessingQueue } from "@/lib/api/document-processing";
import { useFinancialEntrySummary } from "@/lib/api/document-processing";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
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
import {
  DOCUMENT_TYPE_LABELS,
  PRIORITY_LABELS,
} from "@/types/document-intake";

/**
 * Fila do processamento.
 *
 * Lista os documentos que a entrada encaminhou e que ainda não viraram lançamento. O
 * critério é a **ausência do lançamento**, não uma situação nova no documento — assim a
 * fila nunca discorda do que existe de fato.
 */
export default function AProcessarPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useProcessingQueue(organizationId, companyId, page);
  const { data: summary } = useFinancialEntrySummary(organizationId, companyId);

  const documents = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const canProcess = hasPermission("document_processing.process");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <FileClock className="size-5" />A processar
        </h1>
        <p className="text-sm text-muted-foreground">
          Documentos encaminhados pela entrada que ainda não viraram lançamento
          financeiro.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Na fila"
          value={String(data?.meta.total ?? 0)}
          hint="Documentos aguardando processamento"
        />
        <SummaryCard
          label="A pagar em aberto"
          value={formatCurrencyBRL(summary?.payable.total ?? 0)}
          hint={`${summary?.payable.count ?? 0} lançamento(s)`}
        />
        <SummaryCard
          label="A receber em aberto"
          value={formatCurrencyBRL(summary?.receivable.total ?? 0)}
          hint={`${summary?.receivable.count ?? 0} lançamento(s)`}
        />
        <SummaryCard
          label="Retenções a decidir"
          value={String(summary?.withholdingsToConfirm ?? 0)}
          hint="Sugeridas, ainda sem confirmação"
        />
      </div>

      {summary && (
        <p className="text-xs text-muted-foreground">{summary.note}</p>
      )}

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nada na fila</p>
            <p className="text-sm text-muted-foreground">
              Todo documento encaminhado já foi processado.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-2">
              <Link href="/financeiro/entrada-documentos/processados">
                Ver documentos prontos na entrada
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fornecedor / cliente</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <p className="font-medium">
                        {document.documentNumber ??
                          document.displayName ??
                          document.originalFileName ??
                          "Sem identificação"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[document.documentType]}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {document.supplier?.tradeName ??
                        document.supplier?.legalName ??
                        document.customer?.tradeName ??
                        document.customer?.legalName ??
                        "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {document.dueDate ? formatDateBR(document.dueDate) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {document.grossAmount === null
                        ? "—"
                        : formatCurrencyBRL(Number(document.grossAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          document.priority === "URGENT" ||
                          document.priority === "HIGH"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {PRIORITY_LABELS[document.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" asChild disabled={!canProcess}>
                        <Link href={`/financeiro/a-processar/${document.id}`}>
                          Processar
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
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
                  <p className="font-medium">
                    {document.documentNumber ??
                      document.displayName ??
                      document.originalFileName ??
                      "Sem identificação"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[document.documentType]} ·{" "}
                    {document.dueDate ? formatDateBR(document.dueDate) : "sem vencimento"}
                  </p>
                  <p className="text-sm tabular-nums">
                    {document.grossAmount === null
                      ? "—"
                      : formatCurrencyBRL(Number(document.grossAmount))}
                  </p>
                  <Button size="sm" asChild disabled={!canProcess} className="mt-2">
                    <Link href={`/financeiro/a-processar/${document.id}`}>
                      Processar
                    </Link>
                  </Button>
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

      {!canProcess && (
        <Alert>
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Seu perfil não tem a permissão de processar documentos.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
