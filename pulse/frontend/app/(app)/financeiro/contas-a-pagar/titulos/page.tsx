"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Filter,
  ListChecks,
  Search,
  X,
} from "lucide-react";

import { useAccountsPayable } from "@/lib/api/accounts-payable";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
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
import { Field } from "@/components/treasury/field";
import {
  PRIORITY_LABELS,
  SITUATION_LABELS,
  SITUATION_TONES,
  displayNameOf,
  type AccountsPayablePriority,
  type PayableSituation,
} from "@/types/accounts-payable";

const ALL = "__all__";

/**
 * Tela principal do Contas a Pagar (seção 5).
 *
 * `useSearchParams` obriga a fronteira de Suspense — sem ela o build de produção falha com
 * `missing-suspense-with-csr-bailout`. Os indicadores do painel chegam aqui já com o
 * filtro na URL, então ela precisa mesmo ler a query.
 */
export default function TitulosPage() {
  return (
    <React.Suspense fallback={<Header />}>
      <Titulos />
    </React.Suspense>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/contas-a-pagar">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ListChecks className="size-5" />
          Títulos a pagar
        </h1>
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function Titulos() {
  const params = useSearchParams();
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [search, setSearch] = React.useState("");
  const [situation, setSituation] = React.useState<string>(
    params.get("situation") ?? ALL,
  );
  const [priority, setPriority] = React.useState<string>(
    params.get("priority") ?? ALL,
  );
  const [overdue, setOverdue] = React.useState(params.get("overdue") === "true");
  const [blocked, setBlocked] = React.useState(params.get("blocked") === "true");
  const [dueFrom, setDueFrom] = React.useState("");
  const [dueTo, setDueTo] = React.useState("");
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");
  const [documentNumber, setDocumentNumber] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [showFilters, setShowFilters] = React.useState(false);

  const filters = React.useMemo(
    () => ({
      organizationId,
      companyId: selectedCompanyId ?? undefined,
      page,
      perPage: 25,
      ...(search ? { search } : {}),
      ...(situation !== ALL ? { situation } : {}),
      ...(priority !== ALL ? { priority } : {}),
      ...(overdue ? { overdue: true } : {}),
      ...(blocked ? { blocked: true } : {}),
      ...(dueFrom ? { dueFrom } : {}),
      ...(dueTo ? { dueTo } : {}),
      ...(minAmount ? { minAmount: Number(minAmount) } : {}),
      ...(maxAmount ? { maxAmount: Number(maxAmount) } : {}),
      ...(documentNumber ? { documentNumber } : {}),
      ...(tag ? { tag } : {}),
    }),
    [
      organizationId,
      selectedCompanyId,
      page,
      search,
      situation,
      priority,
      overdue,
      blocked,
      dueFrom,
      dueTo,
      minAmount,
      maxAmount,
      documentNumber,
      tag,
    ],
  );

  const { data, isLoading } = useAccountsPayable(filters);
  const items = data?.items ?? [];

  const activeFilters =
    (situation !== ALL ? 1 : 0) +
    (priority !== ALL ? 1 : 0) +
    (overdue ? 1 : 0) +
    (blocked ? 1 : 0) +
    (dueFrom ? 1 : 0) +
    (dueTo ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (documentNumber ? 1 : 0) +
    (tag ? 1 : 0);

  function clearFilters() {
    setSituation(ALL);
    setPriority(ALL);
    setOverdue(false);
    setBlocked(false);
    setDueFrom("");
    setDueTo("");
    setMinAmount("");
    setMaxAmount("");
    setDocumentNumber("");
    setTag("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/contas-a-pagar">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="size-5" />
            Títulos a pagar
          </h1>
          <p className="text-xs text-muted-foreground">
            {data ? `${data.meta.total} título(s)` : "Carregando…"}
          </p>
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters((current) => !current)}
        >
          <Filter className="size-4" />
          Filtros
          {activeFilters > 0 && <Badge variant="secondary">{activeFilters}</Badge>}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por código, descrição ou número do documento"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
      </div>

      {showFilters && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Situação">
              <Select
                value={situation}
                onValueChange={(value) => {
                  setPage(1);
                  setSituation(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {(Object.keys(SITUATION_LABELS) as PayableSituation[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SITUATION_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Prioridade">
              <Select
                value={priority}
                onValueChange={(value) => {
                  setPage(1);
                  setPriority(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {(Object.keys(PRIORITY_LABELS) as AccountsPayablePriority[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {PRIORITY_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Vencimento de">
              <Input
                type="date"
                value={dueFrom}
                onChange={(event) => {
                  setPage(1);
                  setDueFrom(event.target.value);
                }}
              />
            </Field>

            <Field label="Vencimento até">
              <Input
                type="date"
                value={dueTo}
                onChange={(event) => {
                  setPage(1);
                  setDueTo(event.target.value);
                }}
              />
            </Field>

            <Field label="Valor mínimo (R$)">
              <Input
                inputMode="decimal"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
              />
            </Field>

            <Field label="Valor máximo (R$)">
              <Input
                inputMode="decimal"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
              />
            </Field>

            <Field label="Número do documento">
              <Input
                value={documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
              />
            </Field>

            <Field label="Tag">
              <Input value={tag} onChange={(event) => setTag(event.target.value)} />
            </Field>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                size="sm"
                variant={overdue ? "default" : "outline"}
                onClick={() => {
                  setPage(1);
                  setOverdue((current) => !current);
                }}
              >
                Somente vencidos
              </Button>
              <Button
                size="sm"
                variant={blocked ? "default" : "outline"}
                onClick={() => {
                  setPage(1);
                  setBlocked((current) => !current);
                }}
              >
                <Ban className="size-4" />
                Somente bloqueados
              </Button>
              {activeFilters > 0 && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  <X className="size-4" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum título encontrado com estes filtros.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Valor original</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Última atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/financeiro/contas-a-pagar/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.documentNumber
                        ? `Doc. ${item.documentNumber}`
                        : (item.description ?? "—")}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {displayNameOf(item.supplier)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {displayNameOf(item.company)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrencyBRL(Number(item.originalAmount))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatCurrencyBRL(Number(item.balanceAmount))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateBR(item.dueDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SITUATION_TONES[item.situation]}>
                      {SITUATION_LABELS[item.situation]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {PRIORITY_LABELS[item.priority]}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTimeBR(item.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {data.meta.page} de {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Categoria, centro de custo, projeto, conta financeira e forma de pagamento aparecem
        no detalhe de cada título — a lista mostra o que cabe sem rolagem horizontal em
        tablet.
      </p>
    </div>
  );
}
