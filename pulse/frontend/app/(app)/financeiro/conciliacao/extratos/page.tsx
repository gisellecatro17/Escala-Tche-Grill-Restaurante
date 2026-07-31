"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";

import { useStatementImports } from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { DuplicateBadge, EmptyState, brl } from "@/components/reconciliation/shared";
import {
  IMPORT_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  type BankStatementImportStatus,
} from "@/types/reconciliation";

const STATUS_OPTIONS: BankStatementImportStatus[] = [
  "READY_TO_IMPORT",
  "IMPORTED",
  "PARTIALLY_IMPORTED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
];

/** Extratos importados (seção 12). O arquivo original nunca é apagado. */
export default function ExtratosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [status, setStatus] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useStatementImports({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    status: status === "all" ? undefined : status,
    page,
    perPage: 20,
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
            <Link href="/financeiro/conciliacao">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <FileSpreadsheet className="size-5" />
              Extratos importados
            </h1>
            <p className="text-xs text-muted-foreground">
              Cada arquivo com o que ele trouxe e o que virou movimentação.
            </p>
          </div>
        </div>

        {hasPermission("reconciliation.import") && (
          <Button asChild>
            <Link href="/financeiro/conciliacao/importar">
              <Upload className="size-4" />
              Importar extrato
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="w-56">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {IMPORT_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Nenhum extrato importado"
          description="Importe o arquivo do banco para começar. Sem extrato não há o que conciliar — o saldo do Pulse fica sem confronto."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/financeiro/conciliacao/extratos/${item.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {item.originalFileName ?? "Arquivo sem nome"}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline">
                          {SOURCE_TYPE_LABELS[item.sourceType]}
                        </Badge>
                        <DuplicateBadge status={item.duplicateStatus} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.financialAccount?.displayName ??
                        item.financialAccount?.name ??
                        "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.statementStartDate && item.statementEndDate
                        ? `${formatDateBR(item.statementStartDate)} a ${formatDateBR(item.statementEndDate)}`
                        : "Não informado"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(item.totalCredits)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(item.totalDebits)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.validTransactionCount}/{item.transactionCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "IMPORTED"
                            ? "default"
                            : item.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {IMPORT_STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total}{" "}
            arquivo(s)
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
    </div>
  );
}
