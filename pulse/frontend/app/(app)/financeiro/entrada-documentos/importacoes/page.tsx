"use client";

import Link from "next/link";
import { FileInput, Upload } from "lucide-react";

import { useDocumentIntakeOverview } from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BATCH_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  VALIDATING: "Validando",
  PROCESSING: "Processando",
  COMPLETED: "Concluído",
  COMPLETED_WITH_ERRORS: "Concluído com erros",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

/** Importações em lote (seção 63). Cada lote leva à caixa de entrada filtrada por ele. */
export default function ImportacoesPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data, isLoading } = useDocumentIntakeOverview(
    organizationId,
    selectedCompanyId ?? undefined,
  );

  const batches = data?.lastBatches ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/financeiro/entrada-documentos">
              <FileInput /> Entrada de documentos
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Importações em Lote</h1>
          <p className="text-sm text-muted-foreground">
            Cada lote registra o que entrou e o que foi recusado, com o motivo.
          </p>
        </div>
        <Button asChild>
          <Link href="/financeiro/entrada-documentos/enviar?modo=lote">
            <Upload /> Nova importação
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma importação em lote realizada.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead className="w-24">Total</TableHead>
                <TableHead className="w-24">Aceitos</TableHead>
                <TableHead className="w-24">Recusados</TableHead>
                <TableHead className="w-40">Situação</TableHead>
                <TableHead className="w-44">Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Link
                      href={`/financeiro/entrada-documentos/caixa-de-entrada?batchImportId=${batch.id}`}
                      className="font-medium hover:underline"
                    >
                      {batch.batchName ?? "Lote"}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{batch.totalFiles}</TableCell>
                  <TableCell className="tabular-nums text-emerald-600 dark:text-emerald-500">
                    {batch.validFiles}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {batch.invalidFiles > 0 ? (
                      <span className="text-destructive">{batch.invalidFiles}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        batch.status === "COMPLETED"
                          ? "default"
                          : batch.status === "FAILED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTimeBR(batch.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
