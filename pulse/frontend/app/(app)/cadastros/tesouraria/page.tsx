"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Info,
  KeyRound,
  Landmark,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import { useTreasuryOverview } from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_STATUS_LABELS } from "@/types/treasury";

/**
 * Visão geral da tesouraria (seções 4 e 6): quantas contas, cartões, chaves e formas
 * existem, quais pendências precisam de atenção e o que mudou por último.
 */
export default function TesourariaPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useTreasuryOverview(organizationId, companyId);

  const cards = [
    {
      label: "Contas Financeiras",
      href: "/cadastros/contas-financeiras",
      icon: Landmark,
      permission: "financial_account.view",
      value: data?.accounts.active,
      caption: data
        ? [
            `${data.accounts.active} ativa(s)`,
            data.accounts.draft > 0 ? `${data.accounts.draft} em rascunho` : null,
            data.accounts.blocked > 0 ? `${data.accounts.blocked} bloqueada(s)` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
    },
    {
      label: "Cartões Corporativos",
      href: "/cadastros/cartoes",
      icon: CreditCard,
      permission: "card.view",
      value: data?.cards.active,
      caption: data
        ? data.cards.expiringSoon > 0
          ? `${data.cards.expiringSoon} próximo(s) do vencimento`
          : "Nenhum próximo do vencimento"
        : "",
    },
    {
      label: "Chaves PIX",
      href: "/cadastros/chaves-pix",
      icon: KeyRound,
      permission: "financial_account.view",
      value: data?.pixKeys.total,
      caption: data
        ? data.pixKeys.pendingValidation > 0
          ? `${data.pixKeys.pendingValidation} pendente(s) de validação`
          : "Todas validadas"
        : "",
    },
    {
      label: "Formas de Pagamento",
      href: "/cadastros/formas-de-pagamento",
      icon: ArrowUpCircle,
      permission: "payment_method.view",
      value: data?.methods.payment,
      caption: "ativas",
    },
    {
      label: "Formas de Recebimento",
      href: "/cadastros/formas-de-recebimento",
      icon: ArrowDownCircle,
      permission: "receipt_method.view",
      value: data?.methods.receipt,
      caption: "ativas",
    },
    {
      label: "Favorecidos",
      href: "/cadastros/favorecidos-bancarios",
      icon: Users,
      permission: "treasury.view",
      value: undefined,
      caption: "Contas e chaves já cadastradas",
    },
  ].filter((card) => hasPermission(card.permission));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tesouraria</h1>
          <p className="text-sm text-muted-foreground">
            Contas bancárias, caixas, carteiras, cartões e meios de pagamento da empresa.
            Toda movimentação financeira futura apontará para uma conta deste cadastro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission("financial_account.create") && (
            <Button asChild>
              <Link href="/cadastros/contas-financeiras/nova">
                <Plus /> Incluir nova conta
              </Link>
            </Button>
          )}
          {hasPermission("card.create") && (
            <Button variant="outline" asChild>
              <Link href="/cadastros/cartoes/novo">
                <Plus /> Incluir novo cartão
              </Link>
            </Button>
          )}
          {hasPermission("treasury.manage_settings") && (
            <Button variant="outline" asChild>
              <Link href="/cadastros/tesouraria/parametros">
                <Settings /> Parâmetros
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!companyId && (
        <Alert>
          <Info />
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            Contas bancárias pertencem a uma empresa e não são compartilhadas entre
            empresas diferentes. Sem empresa selecionada, os números somam toda a
            organização.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <card.icon className="size-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <span className="text-2xl font-semibold tabular-nums">
                    {card.value ?? "—"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{card.caption}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Pendências
              {data && data.pendenciesTotal > 0 && (
                <Badge variant="outline">{data.pendenciesTotal}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : !data || data.pendencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma pendência: as contas estão com responsável, vínculo contábil e
                regime de conciliação definidos.
              </p>
            ) : (
              data.pendencies.map((group) => (
                <div
                  key={group.code}
                  className="flex flex-col gap-1 rounded-md border border-amber-500/40 p-3"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="size-4" />
                    {group.label}
                    <Badge variant="outline" className="ml-auto">
                      {group.items.length}
                    </Badge>
                  </div>
                  <ul className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {group.items.slice(0, 6).map((item) => (
                      <li key={item.id} className="rounded bg-muted px-1.5 py-0.5">
                        {item.displayName ?? item.name}
                      </li>
                    ))}
                    {group.items.length > 6 && (
                      <li className="px-1.5 py-0.5">
                        e mais {group.items.length - 6}
                      </li>
                    )}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas alterações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : !data || data.recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma mudança de situação registrada ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {data.recentChanges.map((change) => (
                  <li
                    key={change.id}
                    className="flex flex-wrap items-baseline gap-x-2 border-b pb-2 last:border-0"
                  >
                    <span className="font-medium">
                      {change.financialAccount.displayName ??
                        change.financialAccount.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {change.previousStatus
                        ? `${ACCOUNT_STATUS_LABELS[change.previousStatus]} → `
                        : ""}
                      {ACCOUNT_STATUS_LABELS[change.newStatus]}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTimeBR(change.changedAt)}
                    </span>
                    {change.reason && (
                      <span className="w-full text-xs text-muted-foreground">
                        {change.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data && (
        <Alert>
          <Info />
          <AlertTitle>Sobre os saldos</AlertTitle>
          <AlertDescription>{data.note}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
