"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Download, Loader2, MoreHorizontal } from "lucide-react";

import { useCompanies, type CompaniesFilters } from "@/lib/api/companies";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDocument } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyRowActions } from "@/components/companies/company-row-actions";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
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
import { COMPANY_SYSTEM_STATUS_LABELS, ESTABLISHMENT_TYPE_LABELS } from "@/types/company";

const PER_PAGE = 20;

export default function CompaniesListPage() {
  const { user, hasPermissionAnywhere } = useSession();
  const [search, setSearch] = React.useState("");
  const [systemStatus, setSystemStatus] = React.useState<string>("");
  const [establishmentType, setEstablishmentType] = React.useState<string>("");
  const [organizationId, setOrganizationId] = React.useState<string>("");
  const [page, setPage] = React.useState(1);

  const organizations = Array.from(
    new Map((user?.organizationMemberships ?? []).map((m) => [m.organizationId, m.organizationName])).entries(),
  );

  const filters: CompaniesFilters = {
    page,
    perPage: PER_PAGE,
    search: search || undefined,
    systemStatus: systemStatus || undefined,
    establishmentType: establishmentType || undefined,
    organizationId: organizationId || undefined,
    orderBy: "displayName",
    order: "asc",
  };

  const { data, isLoading, isError, isFetching } = useCompanies(filters);
  const canCreate = hasPermissionAnywhere("company.create");

  function clearFilters() {
    setSearch("");
    setSystemStatus("");
    setEstablishmentType("");
    setOrganizationId("");
    setPage(1);
  }

  function exportCsv() {
    if (!data?.items.length) return;
    const header = ["Código", "Nome de exibição", "Razão social", "Documento", "Cidade/UF", "Status"];
    const rows = data.items.map((c) => [
      c.internalCode ?? "",
      c.displayName ?? "",
      c.legalName ?? "",
      c.normalizedDocumentNumber ? formatDocument(c.normalizedDocumentNumber) : "",
      [c.addresses?.[0]?.city, c.addresses?.[0]?.state].filter(Boolean).join("/"),
      COMPANY_SYSTEM_STATUS_LABELS[c.systemStatus],
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "empresas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie as empresas vinculadas à organização.</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/cadastros/empresas/nova">+ Incluir nova empresa</Link>
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
            value={systemStatus || "all"}
            onValueChange={(v) => {
              setSystemStatus(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(COMPANY_SYSTEM_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={establishmentType || "all"}
            onValueChange={(v) => {
              setEstablishmentType(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Matriz ou filial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Matriz ou filial</SelectItem>
              {Object.entries(ESTABLISHMENT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {organizations.length > 1 && (
            <Select
              value={organizationId || "all"}
              onValueChange={(v) => {
                setOrganizationId(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as organizações</SelectItem>
                {organizations.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
          Não foi possível carregar as empresas. Tente novamente em instantes.
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
          <Building2 className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma empresa cadastrada.</p>
            <p className="text-sm text-muted-foreground">
              Cadastre a primeira empresa para começar a utilizar os módulos financeiros da Pulse.
            </p>
          </div>
          {canCreate && (
            <Button asChild>
              <Link href="/cadastros/empresas/nova">+ Incluir nova empresa</Link>
            </Button>
          )}
        </Card>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          {/* Tabela — telas médias e maiores */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome de exibição</TableHead>
                  <TableHead>Razão social</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última atualização</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="text-muted-foreground">{company.internalCode ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/cadastros/empresas/${company.id}`} className="hover:underline">
                        {company.displayName ?? company.legalName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{company.legalName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.normalizedDocumentNumber ? formatDocument(company.normalizedDocumentNumber) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ESTABLISHMENT_TYPE_LABELS[company.establishmentType]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.addresses?.[0] ? `${company.addresses[0].city}/${company.addresses[0].state}` : "—"}
                    </TableCell>
                    <TableCell>
                      <CompanyStatusBadge status={company.systemStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateBR(company.updatedAt)}</TableCell>
                    <TableCell>
                      <CompanyRowActions
                        company={company}
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

          {/* Cards — celular e tablet */}
          <div className="flex flex-col gap-3 md:hidden">
            {data.items.map((company) => (
              <Card key={company.id} className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/cadastros/empresas/${company.id}`} className="font-medium hover:underline">
                      {company.displayName ?? company.legalName ?? "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{company.legalName}</p>
                  </div>
                  <CompanyRowActions
                    company={company}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{company.normalizedDocumentNumber ? formatDocument(company.normalizedDocumentNumber) : "—"}</span>
                  <span>·</span>
                  <span>{ESTABLISHMENT_TYPE_LABELS[company.establishmentType]}</span>
                </div>
                <CompanyStatusBadge status={company.systemStatus} />
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.meta.total} empresa{data.meta.total === 1 ? "" : "s"} · página {data.meta.page} de{" "}
              {data.meta.totalPages}
              {isFetching && <Loader2 className="ml-2 inline size-3 animate-spin" />}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
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
