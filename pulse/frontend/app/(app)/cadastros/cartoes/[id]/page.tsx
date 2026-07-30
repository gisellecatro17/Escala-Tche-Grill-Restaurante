"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CreditCard,
  Pencil,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  useCardUsers,
  useCorporateCard,
  useCorporateCardActions,
} from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CARD_STATUS_LABELS,
  CARD_TYPE_LABELS,
  type CorporateCard,
} from "@/types/treasury";

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export default function CartaoPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data: card, isLoading } = useCorporateCard(id);
  const { block, unblock, deactivate } = useCorporateCardActions();
  const [actionError, setActionError] = React.useState<string | null>(null);

  async function withReason(
    label: string,
    action: (reason: string) => Promise<unknown>,
  ) {
    const reason = window.prompt(`${label}\n\nInforme o motivo:`);
    if (!reason?.trim()) return;
    setActionError(null);
    try {
      await action(reason.trim());
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Falha inesperada.");
    }
  }

  if (isLoading || !card) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }


  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/cadastros/cartoes">
              <CreditCard /> Cartões corporativos
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {card.displayName ?? card.name}
            <Badge variant={card.status === "ACTIVE" ? "default" : "secondary"}>
              {CARD_STATUS_LABELS[card.status]}
            </Badge>
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            **** **** **** {card.lastFourDigits}
            {card.brand && ` · ${card.brand}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPermission("card.update") && (
            <Button variant="outline" asChild>
              <Link href={`/cadastros/cartoes/${card.id}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
          )}
          {hasPermission("card.unblock") && card.status === "BLOCKED" && (
            <Button
              variant="outline"
              onClick={() =>
                withReason("Desbloquear cartão", (reason) =>
                  unblock.mutateAsync({ id: card.id, reason }),
                )
              }
            >
              <CheckCircle2 /> Desbloquear
            </Button>
          )}
          {hasPermission("card.block") && card.status === "ACTIVE" && (
            <Button
              variant="outline"
              onClick={() =>
                withReason("Bloquear cartão", (reason) =>
                  block.mutateAsync({ id: card.id, reason }),
                )
              }
            >
              <Ban /> Bloquear
            </Button>
          )}
          {hasPermission("card.deactivate") &&
            card.status !== "INACTIVE" &&
            card.status !== "CANCELLED" && (
            <Button
              variant="outline"
              onClick={() =>
                withReason("Inativar cartão", (reason) =>
                  deactivate.mutateAsync({ id: card.id, reason }),
                )
              }
            >
              <Ban /> Inativar
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="users">Portadores</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identificação</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Nome" value={card.name} />
                <InfoField label="Tipo" value={CARD_TYPE_LABELS[card.cardType]} />
                <InfoField label="Bandeira" value={card.brand} />
                <InfoField
                  label="Final"
                  value={
                    <span className="font-mono">**** **** **** {card.lastFourDigits}</span>
                  }
                />
                <InfoField label="Nome impresso" value={card.holderName} />
                <InfoField
                  label="Formato"
                  value={
                    [card.isPhysical && "Físico", card.isVirtual && "Virtual"]
                      .filter(Boolean)
                      .join(" e ") || "—"
                  }
                />
                <InfoField
                  label="Emissão"
                  value={card.issueDate ? formatDateBR(card.issueDate) : "—"}
                />
                <InfoField
                  label="Validade"
                  value={
                    card.expirationDate ? formatDateBR(card.expirationDate) : "—"
                  }
                />
                <InfoField
                  label="Última atualização"
                  value={formatDateTimeBR(card.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vínculos, limites e ciclo</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField
                  label="Conta que paga a fatura"
                  value={
                    card.financialAccount ? (
                      <Link
                        href={`/cadastros/contas-financeiras/${card.financialAccount.id}`}
                        className="underline"
                      >
                        {card.financialAccount.displayName ??
                          card.financialAccount.name}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoField
                  label="Instituição emissora"
                  value={
                    card.financialInstitution?.shortName ??
                    card.financialInstitution?.legalName
                  }
                />
                <InfoField label="Centro de custo" value={card.costCenter?.name} />
                <InfoField label="Limite total" value={formatAmount(card.totalLimit)} />
                <InfoField
                  label="Limite por transação"
                  value={formatAmount(card.transactionLimit)}
                />
                <InfoField
                  label="Fechamento / vencimento"
                  value={
                    card.closingDay && card.dueDay
                      ? `dia ${card.closingDay} / dia ${card.dueDay}`
                      : "—"
                  }
                />
                <InfoField
                  label="Parcelamento"
                  value={
                    card.allowsInstallments
                      ? `até ${card.maximumInstallments ?? "—"}x`
                      : "Não permite"
                  }
                />
              </dl>
              {card.notes && (
                <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {card.notes}
                </p>
              )}
            </CardContent>
          </Card>

          <Alert>
            <ShieldCheck />
            <AlertTitle>Dados sensíveis</AlertTitle>
            <AlertDescription>
              Número completo, código de segurança e senha não são armazenados pelo
              Pulse. Apenas os quatro últimos dígitos ficam registrados, para
              identificação do cartão e conciliação da fatura.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="users">
          <CardUsersTab card={card} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardUsersTab({ card }: { card: CorporateCard }) {
  const { data: users, isLoading } = useCardUsers(card.id);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!users || users.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum portador vinculado. Sem portador definido o cartão aparece nos alertas
          da tesouraria.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" /> Portadores
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="w-24">Principal</TableHead>
              <TableHead className="w-40">Limite individual</TableHead>
              <TableHead className="w-40">Limite por transação</TableHead>
              <TableHead className="w-24">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((cardUser) => (
              <TableRow key={cardUser.id}>
                <TableCell>
                  <span className="font-medium">{cardUser.user?.name ?? "—"}</span>
                  {cardUser.user?.email && (
                    <span className="block text-xs text-muted-foreground">
                      {cardUser.user.email}
                    </span>
                  )}
                </TableCell>
                <TableCell>{cardUser.isPrimary ? "Sim" : "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {formatAmount(cardUser.individualLimit)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatAmount(cardUser.transactionLimit)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={cardUser.status === "ACTIVE" ? "default" : "secondary"}
                  >
                    {cardUser.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
