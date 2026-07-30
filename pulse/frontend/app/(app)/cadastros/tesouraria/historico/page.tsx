"use client";

import * as React from "react";
import Link from "next/link";
import { History, Landmark } from "lucide-react";

import { useFinancialAccounts, useTreasuryStatusHistory } from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
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
import { ACCOUNT_STATUS_LABELS } from "@/types/treasury";

const ALL = "all";

/**
 * Histórico das mudanças de situação das contas financeiras (seções 21 e 22).
 * A visão geral mostra as dez últimas; aqui o histórico inteiro fica navegável.
 */
export default function HistoricoTesourariaPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [accountId, setAccountId] = React.useState(ALL);
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useTreasuryStatusHistory(organizationId, {
    companyId,
    financialAccountId: accountId === ALL ? undefined : accountId,
    page,
    perPage: 25,
  });
  const { data: accounts } = useFinancialAccounts({
    organizationId,
    companyId,
    perPage: 100,
  });

  const entries = data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/cadastros/tesouraria">
            <Landmark /> Tesouraria
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <History className="size-5" /> Histórico de Situação
        </h1>
        <p className="text-sm text-muted-foreground">
          Toda ativação, bloqueio, suspensão, inativação e encerramento de conta, com o
          motivo informado e quem executou.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Select
            value={accountId}
            onValueChange={(value) => {
              setAccountId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as contas</SelectItem>
              {(accounts?.items ?? []).map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.displayName ?? account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <span className="text-sm text-muted-foreground">
              {data.meta.total} registro(s)
            </span>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma mudança de situação registrada.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Quando</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="w-56">Mudança</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-40">Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTimeBR(entry.changedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/cadastros/contas-financeiras/${entry.financialAccount.id}`}
                        className="underline"
                      >
                        {entry.financialAccount.displayName ??
                          entry.financialAccount.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1 text-xs">
                        {entry.previousStatus && (
                          <>
                            <Badge variant="secondary">
                              {ACCOUNT_STATUS_LABELS[entry.previousStatus]}
                            </Badge>
                            →
                          </>
                        )}
                        <Badge
                          variant={
                            entry.newStatus === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {ACCOUNT_STATUS_LABELS[entry.newStatus]}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{entry.reason ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {entry.changedByUser?.name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                página {data.meta.page} de {data.meta.totalPages}
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
    </div>
  );
}
