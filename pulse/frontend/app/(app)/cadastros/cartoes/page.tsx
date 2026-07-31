"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, Landmark, Plus, Search } from "lucide-react";

import { useCardAlerts, useCorporateCards } from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CARD_STATUS_LABELS,
  CARD_TYPE_LABELS,
  type CorporateCardStatus,
} from "@/types/treasury";

const STATUS_VARIANT: Record<
  CorporateCardStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  BLOCKED: "destructive",
  EXPIRED: "destructive",
  CANCELLED: "secondary",
  INACTIVE: "secondary",
};

export default function CartoesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [search, setSearch] = React.useState("");
  const [cardType, setCardType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useCorporateCards({
    organizationId,
    companyId,
    search: search || undefined,
    cardType: cardType === "all" ? undefined : cardType,
    status: status === "all" ? undefined : status,
    page,
    perPage: 20,
  });
  const { data: alerts } = useCardAlerts(organizationId, companyId);

  const cards = data?.items ?? [];

  const alertGroups = [
    { label: "Vencendo em breve", items: alerts?.expiringSoon ?? [] },
    { label: "Vencidos", items: alerts?.expired ?? [] },
    { label: "Sem responsável", items: alerts?.withoutResponsible ?? [] },
    { label: "Conta pagadora inativa", items: alerts?.inactiveAccount ?? [] },
  ].filter((group) => group.items.length > 0);

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
            Cartões Corporativos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cartões de crédito, débito e pré-pagos da empresa. O sistema guarda apenas
            os quatro últimos dígitos.
          </p>
        </div>
        {hasPermission("card.create") && (
          <Button asChild>
            <Link href="/cadastros/cartoes/novo">
              <Plus /> Incluir novo cartão
            </Link>
          </Button>
        )}
      </div>

      {alertGroups.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-500">
              <AlertTriangle className="size-4" />
              Alertas
              <Badge variant="outline" className="ml-auto">
                {alerts?.total ?? 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alertGroups.map((group) => (
              <div key={group.label} className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">{group.label}:</span>
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/cadastros/cartoes/${item.id}`}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs hover:underline"
                  >
                    {item.name} •••• {item.lastFourDigits}
                  </Link>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, bandeira ou final"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={cardType}
            onValueChange={(value) => {
              setCardType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
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
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              {Object.entries(CARD_STATUS_LABELS).map(([value, label]) => (
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
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cartão cadastrado.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cartão</TableHead>
                  <TableHead className="w-36">Tipo</TableHead>
                  <TableHead className="w-28">Final</TableHead>
                  <TableHead>Conta pagadora</TableHead>
                  <TableHead className="w-28">Validade</TableHead>
                  <TableHead className="w-24">Portadores</TableHead>
                  <TableHead className="w-28">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <Link
                        href={`/cadastros/cartoes/${card.id}`}
                        className="flex items-center gap-1.5"
                      >
                        <CreditCard className="size-3.5 text-muted-foreground" />
                        {card.displayName ?? card.name}
                        {card.brand && (
                          <span className="text-xs text-muted-foreground">
                            {card.brand}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {CARD_TYPE_LABELS[card.cardType]}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      •••• {card.lastFourDigits}
                    </TableCell>
                    <TableCell className="text-sm">
                      {card.financialAccount
                        ? (card.financialAccount.displayName ??
                          card.financialAccount.name)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {card.expirationDate ? formatDateBR(card.expirationDate) : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {card._count?.users ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[card.status]}>
                        {CARD_STATUS_LABELS[card.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {cards.map((card) => (
              <Link key={card.id} href={`/cadastros/cartoes/${card.id}`}>
                <Card>
                  <CardContent className="flex flex-col gap-1 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {card.displayName ?? card.name}
                      </span>
                      <Badge variant={STATUS_VARIANT[card.status]}>
                        {CARD_STATUS_LABELS[card.status]}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {CARD_TYPE_LABELS[card.cardType]}
                      {card.brand && ` · ${card.brand}`}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      •••• {card.lastFourDigits}
                      {card.expirationDate &&
                        ` · válido até ${formatDateBR(card.expirationDate)}`}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.meta.total} cartão(ões) · página {data.meta.page} de{" "}
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
