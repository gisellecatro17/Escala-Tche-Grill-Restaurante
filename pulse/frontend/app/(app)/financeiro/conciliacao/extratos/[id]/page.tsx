"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Ban,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  useImportActions,
  useStatementImport,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DirectionAmount,
  DuplicateBadge,
  TransactionStatusBadge,
  brl,
} from "@/components/reconciliation/shared";
import {
  HISTORY_ACTION_LABELS,
  IMPORT_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
} from "@/types/reconciliation";

/**
 * Detalhe do extrato importado.
 *
 * O download passa por uma URL assinada e temporária, gerada na hora: o bucket é privado e
 * o acesso fica registrado. Um link fixo deixaria o extrato inteiro acessível a quem
 * descobrisse o caminho.
 */
export default function ExtratoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data, isLoading } = useStatementImport(id);
  const { download, reprocess, cancel, archive } = useImportActions();

  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const canImport = hasPermission("reconciliation.import");

  function fail(caught: unknown, fallback: string) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const balanceMismatch =
    data.closingBalance !== null &&
    data.calculatedClosingBalance !== null &&
    Number(data.closingBalance) !== Number(data.calculatedClosingBalance);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Voltar">
            <Link href="/financeiro/conciliacao/extratos">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <FileSpreadsheet className="size-5" />
              {data.originalFileName ?? "Arquivo sem nome"}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {SOURCE_TYPE_LABELS[data.sourceType]}
              </Badge>
              <Badge
                variant={data.status === "IMPORTED" ? "default" : "secondary"}
              >
                {IMPORT_STATUS_LABELS[data.status]}
              </Badge>
              <DuplicateBadge status={data.duplicateStatus} />
              {data.financialAccount &&
                (data.financialAccount.displayName ??
                  data.financialAccount.name)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPermission("reconciliation.download") && (
            <Button
              variant="outline"
              disabled={download.isPending}
              onClick={() =>
                download.mutate(data.id, {
                  onSuccess: (result) => window.open(result.url, "_blank"),
                  onError: (caught) =>
                    fail(caught, "Não foi possível gerar o link."),
                })
              }
            >
              {download.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Baixar original
            </Button>
          )}

          {canImport && data.status === "IMPORTED" && (
            <Button
              variant="outline"
              disabled={reprocess.isPending}
              onClick={() =>
                reprocess.mutate(data.id, {
                  onError: (caught) =>
                    fail(caught, "Não foi possível reprocessar."),
                })
              }
            >
              <RefreshCw className="size-4" />
              Reprocessar
            </Button>
          )}

          {canImport && data.status === "IMPORTED" && (
            <Button
              variant="outline"
              disabled={archive.isPending}
              onClick={() =>
                archive.mutate(data.id, {
                  onError: (caught) => fail(caught, "Não foi possível arquivar."),
                })
              }
            >
              <Archive className="size-4" />
              Arquivar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {balanceMismatch && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Saldo declarado diferente do calculado</AlertTitle>
          <AlertDescription>
            O arquivo declara {brl(data.closingBalance)} e a soma das
            movimentações dá {brl(data.calculatedClosingBalance)}. A diferença
            costuma indicar arquivo truncado ou linha recusada na leitura.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info
          label="Período"
          value={
            data.statementStartDate && data.statementEndDate
              ? `${formatDateBR(data.statementStartDate)} a ${formatDateBR(data.statementEndDate)}`
              : "Não informado"
          }
        />
        <Info label="Entradas" value={brl(data.totalCredits)} />
        <Info label="Saídas" value={brl(data.totalDebits)} />
        <Info
          label="Saldo final"
          value={
            data.closingBalance === null ? "—" : brl(data.closingBalance)
          }
        />
        <Info
          label="Movimentações"
          value={`${data.validTransactionCount} de ${data.transactionCount}`}
        />
        <Info
          label="Recusadas"
          value={String(data.invalidTransactionCount)}
        />
        <Info
          label="Duplicadas"
          value={String(data.duplicateTransactionCount)}
        />
        <Info
          label="Importado em"
          value={data.importedAt ? formatDateTimeBR(data.importedAt) : "—"}
        />
      </div>

      {canImport && data.status === "READY_TO_IMPORT" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cancelar importação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-64">
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo do cancelamento"
              />
            </div>
            <Button
              variant="destructive"
              disabled={!reason || cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { id: data.id, reason },
                  {
                    onSuccess: () => setReason(""),
                    onError: (caught) =>
                      fail(caught, "Não foi possível cancelar."),
                  },
                )
              }
            >
              <Ban className="size-4" />
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Movimentações do arquivo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.transactions ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateBR(item.transactionDate)}</TableCell>
                  <TableCell className="max-w-md truncate">
                    <Link
                      href={`/financeiro/conciliacao/transacoes/${item.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {item.originalDescription}
                    </Link>
                  </TableCell>
                  <TableCell>{item.documentNumber ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <DirectionAmount
                      direction={item.direction}
                      amount={item.amount}
                    />
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge
                      status={item.reconciliationStatus}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {(data.transactions ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Nenhuma movimentação importada deste arquivo ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="size-4" />
            Linha do tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data.history ?? []).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-baseline gap-2 border-b pb-2 text-sm last:border-0"
            >
              <Badge variant="outline">
                {HISTORY_ACTION_LABELS[entry.actionType]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateTimeBR(entry.performedAt)}
              </span>
              {entry.reason && <span>{entry.reason}</span>}
              {entry.ipAddress && (
                <span className="text-xs text-muted-foreground">
                  IP {entry.ipAddress}
                </span>
              )}
            </div>
          ))}
          {(data.history ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum registro na linha do tempo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
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
