"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  useFinancialEntries,
  useFinancialEntrySummary,
  type FinancialEntryFilters,
} from "@/lib/api/document-processing";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
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
  ENTRY_STATUS_LABELS,
  type FinancialEntry,
  type FinancialEntryStatus,
} from "@/types/document-processing";

const STATUS_VARIANT: Record<
  FinancialEntryStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "secondary",
  OPEN: "default",
  CANCELLED: "destructive",
};

/**
 * Lista de contas a pagar ou a receber.
 *
 * O mesmo componente serve às duas telas: a direção é fixada por quem monta a página, e o
 * resto — filtros, colunas, totais — é idêntico. Duplicar a tela só para trocar uma palavra
 * criaria dois lugares para corrigir o mesmo defeito.
 */
export function EntryList({
  title,
  description,
  fixedFilters,
}: {
  title: string;
  description: string;
  fixedFilters: Partial<FinancialEntryFilters>;
}) {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("OPEN");
  const [dueFrom, setDueFrom] = React.useState("");
  const [dueTo, setDueTo] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useFinancialEntries({
    organizationId,
    companyId,
    search: search || undefined,
    status: status === "all" ? undefined : status,
    dueFrom: dueFrom || undefined,
    dueTo: dueTo || undefined,
    page,
    perPage: 25,
    ...fixedFilters,
  });

  const { data: summary } = useFinancialEntrySummary(organizationId, companyId);

  const entries = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const isPayable = fixedFilters.direction === "PAYABLE";
  const openTotal = isPayable ? summary?.payable : summary?.receivable;

  function reset<Value>(setter: (value: Value) => void) {
    return (value: Value) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Total em aberto</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrencyBRL(openTotal?.total ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {openTotal?.count ?? 0} lançamento(s)
            </p>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            {summary?.note}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Número, descrição, fornecedor…"
                value={search}
                onChange={(event) => reset(setSearch)(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Situação</Label>
            <Select value={status} onValueChange={reset(setStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(ENTRY_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Vence de</Label>
            <Input
              type="date"
              value={dueFrom}
              onChange={(event) => reset(setDueFrom)(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Vence até</Label>
            <Input
              type="date"
              value={dueTo}
              onChange={(event) => reset(setDueTo)(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento nos filtros escolhidos.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>{isPayable ? "Fornecedor" : "Cliente"}</TableHead>
                  <TableHead>Próximo vencimento</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Link
                        href={`/financeiro/lancamentos/${entry.id}`}
                        className="font-medium hover:underline"
                      >
                        {entry.documentNumber ?? entry.description ?? "Sem número"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {entry.installments && entry.installments.length > 1
                          ? `${entry.installments.length} parcelas`
                          : "Parcela única"}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{partyOf(entry)}</TableCell>
                    <TableCell className="text-sm">
                      {nextDueDateOf(entry) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(Number(entry.netAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[entry.status]}>
                        {ENTRY_STATUS_LABELS[entry.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-2 md:hidden">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex flex-col gap-1 py-3">
                  <Link
                    href={`/financeiro/lancamentos/${entry.id}`}
                    className="font-medium hover:underline"
                  >
                    {entry.documentNumber ?? entry.description ?? "Sem número"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {partyOf(entry)}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm tabular-nums">
                      {formatCurrencyBRL(Number(entry.netAmount))}
                    </span>
                    <Badge variant={STATUS_VARIANT[entry.status]}>
                      {ENTRY_STATUS_LABELS[entry.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data?.meta.total ?? 0} lançamento(s) · página {page} de {totalPages}
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

function partyOf(entry: FinancialEntry): string {
  const party = entry.supplier ?? entry.customer;
  return party?.tradeName ?? party?.legalName ?? "—";
}

/** Vencimento da primeira parcela ainda em aberto — é o que o operador precisa ver. */
function nextDueDateOf(entry: FinancialEntry): string | null {
  const open = (entry.installments ?? [])
    .filter((installment) => installment.status === "OPEN")
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate));

  return open.length > 0 ? formatDateBR(open[0].dueDate) : null;
}
