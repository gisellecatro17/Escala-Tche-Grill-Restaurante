"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark, Plus, Search, Star } from "lucide-react";

import { useFinancialAccounts } from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_TYPE_LABELS,
  type FinancialAccount,
  type FinancialAccountStatus,
} from "@/types/treasury";

const STATUS_VARIANT: Record<
  FinancialAccountStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  PENDING_VALIDATION: "outline",
  ACTIVE: "default",
  BLOCKED: "destructive",
  SUSPENDED: "outline",
  INACTIVE: "secondary",
  CLOSED: "secondary",
};

/** Agência e conta já chegam mascaradas quando falta permissão. */
function formatBankDetails(account: FinancialAccount) {
  const branch = [account.branchNumber, account.branchDigit]
    .filter(Boolean)
    .join("-");
  const number = [account.accountNumber, account.accountDigit]
    .filter(Boolean)
    .join("-");

  if (!branch && !number) return "—";
  return `${branch || "—"} / ${number || "—"}`;
}

export default function ContasFinanceirasPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [search, setSearch] = React.useState("");
  const [accountType, setAccountType] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useFinancialAccounts({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    search: search || undefined,
    accountType: accountType === "all" ? undefined : accountType,
    status: status === "all" ? undefined : status,
    page,
    perPage: 20,
  });

  const accounts = data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/cadastros/tesouraria">
              <Landmark /> Tesouraria
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Contas Financeiras
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre e gerencie as contas bancárias, caixas e carteiras da empresa.
          </p>
        </div>
        {hasPermission("financial_account.create") && (
          <Button asChild>
            <Link href="/cadastros/contas-financeiras/nova">
              <Plus /> Incluir nova conta
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, código ou conta"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={accountType}
            onValueChange={(value) => {
              setAccountType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma conta encontrada. Comece incluindo a conta bancária principal da
            empresa.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabela no desktop */}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead className="w-40">Agência / conta</TableHead>
                  <TableHead className="w-20">Moeda</TableHead>
                  <TableHead className="w-32">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={`/cadastros/contas-financeiras/${account.id}`}>
                        {account.internalCode ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/cadastros/contas-financeiras/${account.id}`}
                        className="flex items-center gap-1.5"
                      >
                        {account.isPrimary && (
                          <Star className="size-3.5 fill-current text-amber-500" />
                        )}
                        {account.displayName ?? account.name}
                        {account.isThirdParty && (
                          <Badge variant="outline" className="text-[10px]">
                            Terceiro
                          </Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ACCOUNT_TYPE_LABELS[account.accountType]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {account.financialInstitution?.shortName ??
                        account.financialInstitution?.legalName ??
                        "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatBankDetails(account)}
                    </TableCell>
                    <TableCell className="text-sm">{account.currencyCode}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[account.status]}>
                        {ACCOUNT_STATUS_LABELS[account.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards no celular */}
          <div className="flex flex-col gap-2 md:hidden">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/cadastros/contas-financeiras/${account.id}`}
              >
                <Card>
                  <CardContent className="flex flex-col gap-1 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {account.displayName ?? account.name}
                      </span>
                      <Badge variant={STATUS_VARIANT[account.status]}>
                        {ACCOUNT_STATUS_LABELS[account.status]}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ACCOUNT_TYPE_LABELS[account.accountType]}
                      {account.financialInstitution &&
                        ` · ${account.financialInstitution.shortName ?? account.financialInstitution.legalName}`}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatBankDetails(account)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.meta.total} conta(s) · página {data.meta.page} de{" "}
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
    </div>
  );
}
