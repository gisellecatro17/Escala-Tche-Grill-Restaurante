"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, Plus, UserCheck } from "lucide-react";

import {
  useApprovalDelegations,
  useDelegationActions,
} from "@/lib/api/approvals";
import { useCompanyUsers } from "@/lib/api/companies";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Field } from "@/components/treasury/field";
import {
  DELEGATION_REASON_LABELS,
  type ApprovalDelegationReason,
} from "@/types/approvals";

/**
 * Delegações de aprovação (seção 11).
 *
 * Delegar não concede permissão: quem recebe já precisa poder aprovar na empresa. A
 * delegação apenas permite agir **no lugar de** outra pessoa, e toda aprovação dada assim
 * fica marcada com quem foi representado.
 */
export default function DelegacoesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data: delegations, isLoading } = useApprovalDelegations(companyId);
  // `useCompanyUsers` devolve paginado; a lista de opções vive em `items`.
  const { data: usersPage } = useCompanyUsers(companyId);
  const users = React.useMemo(() => usersPage?.items ?? [], [usersPage]);
  const actions = useDelegationActions();

  const [creating, setCreating] = React.useState(false);
  const [delegatorId, setDelegatorId] = React.useState("");
  const [delegateId, setDelegateId] = React.useState("");
  const [reason, setReason] = React.useState<ApprovalDelegationReason>("VACATION");
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [maximumAmount, setMaximumAmount] = React.useState("");
  const [failure, setFailure] = React.useState<string | null>(null);

  const canDelegate = hasPermission("approvals.delegate");

  const names = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const membership of users) {
      map.set(membership.user.id, membership.user.name);
    }
    return map;
  }, [users]);

  function submit() {
    if (!organizationId || !companyId) return;
    setFailure(null);

    actions.create.mutate(
      {
        organizationId,
        companyId,
        delegatorId,
        delegateId,
        reason,
        startsAt,
        endsAt,
        ...(maximumAmount ? { maximumAmount: Number(maximumAmount) } : {}),
      },
      {
        onSuccess: () => {
          setCreating(false);
          setDelegatorId("");
          setDelegateId("");
          setMaximumAmount("");
        },
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error
              ? caught.message
              : "Não foi possível criar a delegação.",
          ),
      },
    );
  }

  const today = new Date();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/autorizacoes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <UserCheck className="size-5" />
            Delegações de aprovação
          </h1>
          <p className="text-xs text-muted-foreground">
            Férias, licença, viagem ou ausência — sem travar a fila.
          </p>
        </div>
        {canDelegate && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nova delegação
          </Button>
        )}
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Delegação não criada</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova delegação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Quem delega" required>
              <Select value={delegatorId} onValueChange={setDelegatorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((membership) => (
                    <SelectItem key={membership.user.id} value={membership.user.id}>
                      {membership.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Quem assume"
              required
              hint="Precisa já ter permissão de aprovar nesta empresa."
            >
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((membership) => membership.user.id !== delegatorId)
                    .map((membership) => (
                      <SelectItem key={membership.user.id} value={membership.user.id}>
                        {membership.user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Motivo">
              <Select
                value={reason}
                onValueChange={(value) =>
                  setReason(value as ApprovalDelegationReason)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DELEGATION_REASON_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Início" required>
              <Input
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </Field>

            <Field label="Fim" required>
              <Input
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </Field>

            <Field
              label="Teto da delegação (R$)"
              hint="Em branco: vale o limite de quem delegou. Nunca mais que ele."
            >
              <Input
                inputMode="decimal"
                value={maximumAmount}
                onChange={(event) => setMaximumAmount(event.target.value)}
              />
            </Field>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button
                disabled={
                  !delegatorId ||
                  !delegateId ||
                  !startsAt ||
                  !endsAt ||
                  actions.create.isPending
                }
                onClick={submit}
              >
                {actions.create.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Criar delegação
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (delegations ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma delegação cadastrada.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quem delegou</TableHead>
                <TableHead>Quem assume</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Teto</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(delegations ?? []).map((delegation) => {
                const active =
                  delegation.status === "ACTIVE" &&
                  !delegation.revokedAt &&
                  new Date(delegation.startsAt) <= today &&
                  new Date(delegation.endsAt) >= today;

                return (
                  <TableRow key={delegation.id}>
                    <TableCell className="text-sm">
                      {names.get(delegation.delegatorId) ?? delegation.delegatorId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {names.get(delegation.delegateId) ?? delegation.delegateId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {DELEGATION_REASON_LABELS[delegation.reason]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateBR(delegation.startsAt)} a{" "}
                      {formatDateBR(delegation.endsAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {delegation.maximumAmount === null
                        ? "—"
                        : formatCurrencyBRL(Number(delegation.maximumAmount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "default" : "secondary"}>
                        {delegation.revokedAt
                          ? "Revogada"
                          : active
                            ? "Vigente"
                            : "Fora do período"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canDelegate && !delegation.revokedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (!window.confirm("Revogar esta delegação?")) return;
                            setFailure(null);
                            actions.revoke.mutate(delegation.id, {
                              onError: (caught: unknown) =>
                                setFailure(
                                  caught instanceof Error
                                    ? caught.message
                                    : "Não foi possível revogar.",
                                ),
                            });
                          }}
                        >
                          Revogar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Alert>
        <AlertTitle>Delegar não é conceder acesso</AlertTitle>
        <AlertDescription>
          Quem recebe a delegação precisa ter a permissão de aprovar na empresa, e nunca
          aprova mais do que quem delegou poderia. Delegação em cadeia não é permitida — ela
          esconderia quem realmente decidiu.
        </AlertDescription>
      </Alert>
    </div>
  );
}
