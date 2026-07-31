"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Loader2, MoreHorizontal, Users } from "lucide-react";

import { useCustomers, type CustomersFilters } from "@/lib/api/customers";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR, formatDocument } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerFinancialStatusBadge } from "@/components/customers/customer-financial-status-badge";
import { CustomerLinkStatusBadge } from "@/components/customers/customer-link-status-badge";
import { CustomerRowActions } from "@/components/customers/customer-row-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSTOMER_LINK_STATUS_LABELS } from "@/types/customer";

const PER_PAGE = 20;

export default function CustomersListPage() {
  const { user, selectedCompanyId, currentMembership, hasPermission } = useSession();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filters: CustomersFilters = {
    page,
    perPage: PER_PAGE,
    search: search || undefined,
    status: status || undefined,
    companyId: selectedCompanyId ?? undefined,
    orderBy: "updatedAt",
    order: "desc",
  };

  const { data, isLoading, isError, isFetching } = useCustomers(filters);
  const canCreate = hasPermission("customer.create");
  const organizationId = user?.organizationMemberships.find((m) => m.organizationId)?.organizationId ?? "";

  function clearFilters() {
    setSearch("");
    setStatus("");
    setPage(1);
  }

  function exportCsv() {
    if (!data?.items.length) return;
    const header = ["Código", "Nome de exibição", "Razão social", "Documento", "Status"];
    const rows = data.items.map((l) => [
      l.internalCode ?? "",
      l.customer.displayName ?? "",
      l.customer.legalName ?? "",
      l.customer.normalizedDocumentNumber ? formatDocument(l.customer.normalizedDocumentNumber) : "",
      CUSTOMER_LINK_STATUS_LABELS[l.status],
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie os clientes e prospects vinculados à empresa selecionada.</p>
          {currentMembership && <p className="text-sm text-muted-foreground">Empresa: {currentMembership.companyName}</p>}
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/cadastros/clientes/novo">+ Incluir novo cliente</Link>
          </Button>
        )}
      </div>

      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input
              placeholder="Pesquisar por razão social, fantasia, código ou documento"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={status || "all"}
            onValueChange={(v) => {
              setStatus(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(CUSTOMER_LINK_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!data?.items.length}>
            <Download />
            Exportar
          </Button>
        </div>
      </Card>

      {isError && (
        <Card className="p-8 text-center text-sm text-destructive">
          Não foi possível carregar os clientes. Tente novamente em instantes.
        </Card>
      )}

      {isLoading && (
        <Card className="flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </Card>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Users className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum cliente cadastrado.</p>
            <p className="text-sm text-muted-foreground">
              Cadastre o primeiro cliente ou prospect para começar a organizar as contas a receber e a classificação
              financeira automática.
            </p>
          </div>
          {canCreate && (
            <Button asChild>
              <Link href="/cadastros/clientes/novo">+ Incluir novo cliente</Link>
            </Button>
          )}
        </Card>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome de exibição</TableHead>
                  <TableHead>Razão social</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Categoria de receita</TableHead>
                  <TableHead>Limite de crédito</TableHead>
                  <TableHead>Situação financeira</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última atualização</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="text-muted-foreground">{link.internalCode ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/cadastros/clientes/${link.customerId}`} className="hover:underline">
                        {link.customer.displayName ?? link.customer.legalName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{link.customer.legalName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {link.customer.normalizedDocumentNumber ? formatDocument(link.customer.normalizedDocumentNumber) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{link.defaultRevenueCategory?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{link.creditLimit != null ? formatCurrencyBRL(link.creditLimit) : "—"}</TableCell>
                    <TableCell>
                      <CustomerFinancialStatusBadge status={link.financialStatus} />
                    </TableCell>
                    <TableCell>
                      <CustomerLinkStatusBadge status={link.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateBR(link.updatedAt)}</TableCell>
                    <TableCell>
                      <CustomerRowActions
                        link={link}
                        organizationId={organizationId}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((link) => (
              <Card key={link.id} className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/cadastros/clientes/${link.customerId}`} className="font-medium hover:underline">
                      {link.customer.displayName ?? link.customer.legalName ?? "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{link.customer.legalName}</p>
                  </div>
                  <CustomerRowActions
                    link={link}
                    organizationId={organizationId}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{link.customer.normalizedDocumentNumber ? formatDocument(link.customer.normalizedDocumentNumber) : "—"}</span>
                  <span>·</span>
                  <span>{link.defaultRevenueCategory?.name ?? "Sem categoria"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CustomerLinkStatusBadge status={link.status} />
                  <CustomerFinancialStatusBadge status={link.financialStatus} />
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.meta.total} cliente{data.meta.total === 1 ? "" : "s"} · página {data.meta.page} de {data.meta.totalPages}
              {isFetching && <Loader2 className="ml-2 inline size-3 animate-spin" />}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
