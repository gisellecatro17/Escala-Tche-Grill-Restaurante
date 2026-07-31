"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CreditCard,
  History,
  KeyRound,
  Landmark,
  Lock,
  Pencil,
  Plug,
  Users,
  Wallet,
} from "lucide-react";

import {
  useAccountActivationPendencies,
  useAccountAudit,
  useAccountIntegrations,
  useAccountLifecycle,
  useAccountLimits,
  useAccountUsers,
  useCompanyPixKeys,
  useCreateOpeningBalance,
  useFinancialAccount,
  useOpeningBalances,
} from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ACCOUNT_PURPOSE_LABELS,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_TYPE_LABELS,
  BALANCE_TYPE_LABELS,
  BANK_LIMIT_TYPE_LABELS,
  INTEGRATION_STATUS_LABELS,
  INTEGRATION_TYPE_LABELS,
  PIX_KEY_TYPE_LABELS,
  RECONCILIATION_MODE_LABELS,
  type FinancialAccount,
} from "@/types/treasury";

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/** Valores monetários chegam como "••••••••" quando falta permissão de ver saldo. */
function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" && value.includes("•")) return value;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export default function ContaFinanceiraPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: account, isLoading } = useFinancialAccount(id);
  const { data: pendencies } = useAccountActivationPendencies(id);
  const lifecycle = useAccountLifecycle();

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

  if (isLoading || !account) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canActivate =
    hasPermission("financial_account.activate") &&
    ["DRAFT", "PENDING_VALIDATION", "INACTIVE", "BLOCKED", "SUSPENDED"].includes(
      account.status,
    );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/cadastros/contas-financeiras">
              <Landmark /> Contas financeiras
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {account.displayName ?? account.name}
            <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>
              {ACCOUNT_STATUS_LABELS[account.status]}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[account.accountType]} ·{" "}
            {ACCOUNT_PURPOSE_LABELS[account.purpose]}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPermission("financial_account.update") &&
            account.status !== "CLOSED" && (
              <Button variant="outline" asChild>
                <Link href={`/cadastros/contas-financeiras/${id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
            )}
          {canActivate && (
            <Button
              onClick={() => void lifecycle.activate.mutateAsync(id)}
              disabled={lifecycle.activate.isPending}
            >
              <CheckCircle2 /> Ativar
            </Button>
          )}
          {hasPermission("financial_account.block") && account.status === "ACTIVE" && (
            <Button
              variant="outline"
              onClick={() =>
                void withReason(
                  "Bloquear esta conta impede novas movimentações. Saldo, extratos e histórico são mantidos.",
                  (reason) => lifecycle.block.mutateAsync({ id, reason }),
                )
              }
            >
              <Ban /> Bloquear
            </Button>
          )}
          {hasPermission("financial_account.unblock") &&
            account.status === "BLOCKED" && (
              <Button
                variant="outline"
                onClick={() =>
                  void withReason("Desbloquear esta conta.", (reason) =>
                    lifecycle.unblock.mutateAsync({ id, reason }),
                  )
                }
              >
                <CheckCircle2 /> Desbloquear
              </Button>
            )}
          {hasPermission("financial_account.close") &&
            account.status !== "CLOSED" && (
              <Button variant="outline" asChild>
                <Link href={`/cadastros/contas-financeiras/${id}?encerrar=1`}>
                  <Lock /> Encerrar
                </Link>
              </Button>
            )}
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {account.isThirdParty && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Conta de terceiro</AlertTitle>
          <AlertDescription>
            O titular desta conta é diferente da empresa.
            {account.thirdPartyReason && ` Motivo: ${account.thirdPartyReason}`}
          </AlertDescription>
        </Alert>
      )}

      {pendencies && pendencies.pendencies.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>A conta ainda não pode ser ativada</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {pendencies.pendencies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="visao-geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="saldos">
            <Wallet className="size-4" /> Saldos e limites
          </TabsTrigger>
          <TabsTrigger value="pix">
            <KeyRound className="size-4" /> Chaves PIX
          </TabsTrigger>
          <TabsTrigger value="responsaveis">
            <Users className="size-4" /> Responsáveis
          </TabsTrigger>
          <TabsTrigger value="integracoes">
            <Plug className="size-4" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <OverviewTab account={account} />
        </TabsContent>

        <TabsContent value="saldos">
          <BalancesTab accountId={id} />
        </TabsContent>

        <TabsContent value="pix">
          <PixTab accountId={id} organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="responsaveis">
          <UsersTab accountId={id} />
        </TabsContent>

        <TabsContent value="integracoes">
          <IntegrationsTab accountId={id} />
        </TabsContent>

        <TabsContent value="historico">
          <HistoryTab accountId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ account }: { account: FinancialAccount }) {
  const branch = [account.branchNumber, account.branchDigit]
    .filter(Boolean)
    .join("-");
  const number = [account.accountNumber, account.accountDigit]
    .filter(Boolean)
    .join("-");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Código interno" value={account.internalCode} />
            <InfoField label="Nome" value={account.name} />
            <InfoField
              label="Tipo"
              value={ACCOUNT_TYPE_LABELS[account.accountType]}
            />
            <InfoField
              label="Finalidade"
              value={ACCOUNT_PURPOSE_LABELS[account.purpose]}
            />
            <InfoField label="Moeda" value={account.currencyCode} />
            <InfoField
              label="Início"
              value={account.startDate ? formatDateBR(account.startDate) : null}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados bancários</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoField
              label="Instituição"
              value={
                account.financialInstitution?.shortName ??
                account.financialInstitution?.legalName
              }
            />
            <InfoField label="Agência" value={branch || null} />
            <InfoField label="Conta" value={number || null} />
            <InfoField label="Titular" value={account.holderName} />
            <InfoField label="Documento" value={account.holderDocument} />
            {account.physicalLocation && (
              <InfoField label="Local físico" value={account.physicalLocation} />
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoField
              label="Conta do plano"
              value={
                account.accountPlan
                  ? `${account.accountPlan.code} ${account.accountPlan.name}`
                  : null
              }
            />
            <InfoField
              label="Conciliação"
              value={RECONCILIATION_MODE_LABELS[account.reconciliationMode]}
            />
            <InfoField
              label="Saldo mínimo"
              value={formatAmount(account.minimumRecommendedBalance)}
            />
            <InfoField
              label="Centro de custo"
              value={account.costCenter?.name}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vínculos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Chaves PIX" value={account._count?.pixKeys ?? 0} />
            <InfoField
              label="Cartões"
              value={
                <span className="flex items-center gap-1">
                  <CreditCard className="size-3.5" />
                  {account._count?.cards ?? 0}
                </span>
              }
            />
            <InfoField label="Responsáveis" value={account._count?.users ?? 0} />
            <InfoField
              label="Integrações"
              value={account._count?.integrations ?? 0}
            />
          </dl>
        </CardContent>
      </Card>

      <Alert className="md:col-span-2">
        <AlertTriangle />
        <AlertTitle>Saldos e movimentações</AlertTitle>
        <AlertDescription>
          Os saldos bancário, conciliado e disponível serão calculados quando o módulo
          financeiro registrar movimentações. Nesta etapa existe apenas o saldo de
          implantação.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function BalancesTab({ accountId }: { accountId: string }) {
  const { hasPermission } = useSession();
  const { data: balances } = useOpeningBalances(accountId);
  const { data: limits } = useAccountLimits(accountId);
  const createBalance = useCreateOpeningBalance();

  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const hasApproved = (balances ?? []).some((b) => b.status === "APPROVED");

  async function submit() {
    setError(null);
    try {
      await createBalance.mutateAsync({
        accountId,
        payload: {
          balanceDate: date,
          balanceAmount: Number(amount),
          reason: reason || undefined,
        },
      });
      setAmount("");
      setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha inesperada.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo inicial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {(balances ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum saldo inicial registrado.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24">Natureza</TableHead>
                    <TableHead className="w-32">Situação</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(balances ?? []).map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell>{formatDateBR(balance.balanceDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(balance.balanceAmount)}
                      </TableCell>
                      <TableCell>
                        {BALANCE_TYPE_LABELS[balance.balanceType]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            balance.status === "APPROVED" ? "default" : "secondary"
                          }
                        >
                          {balance.status === "APPROVED"
                            ? "Vigente"
                            : balance.status === "SUPERSEDED"
                              ? "Substituído"
                              : balance.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {balance.reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasPermission("financial_account.manage_initial_balance") && (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <p className="text-sm font-medium">
                {hasApproved ? "Corrigir o saldo inicial" : "Registrar o saldo inicial"}
              </p>
              {hasApproved && (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>Esta conta já possui saldo registrado</AlertTitle>
                  <AlertDescription>
                    A alteração exige justificativa. O saldo anterior é preservado como
                    substituído — nada é apagado.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                {hasApproved && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Motivo</Label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Correção do extrato"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!date || !amount || createBalance.isPending}
                  onClick={() => void submit()}
                >
                  Registrar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites contratados</CardTitle>
        </CardHeader>
        <CardContent>
          {(limits ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum limite cadastrado.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalidade</TableHead>
                    <TableHead className="text-right">Contratado</TableHead>
                    <TableHead className="w-24 text-right">Taxa</TableHead>
                    <TableHead className="w-32">Vigência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(limits ?? []).map((limit) => (
                    <TableRow key={limit.id}>
                      <TableCell>{BANK_LIMIT_TYPE_LABELS[limit.limitType]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(limit.contractedAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {limit.interestRate ? `${limit.interestRate}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {limit.endDate ? formatDateBR(limit.endDate) : "Indeterminada"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PixTab({
  accountId,
  organizationId,
}: {
  accountId: string;
  organizationId: string | undefined;
}) {
  const { data: keys } = useCompanyPixKeys(organizationId, {
    financialAccountId: accountId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Chaves PIX desta conta
          <Button variant="outline" size="sm" asChild>
            <Link href="/cadastros/chaves-pix">Gerenciar chaves</Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(keys ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma chave PIX vinculada a esta conta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(keys ?? []).map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
              >
                <Badge variant="outline">{PIX_KEY_TYPE_LABELS[key.pixType]}</Badge>
                <span className="font-mono text-xs">{key.pixKey}</span>
                {key.isPrimary && <Badge>Principal</Badge>}
                {key.validationStatus === "UNVERIFIED" && (
                  <Badge variant="outline">Pendente de validação</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UsersTab({ accountId }: { accountId: string }) {
  const { data: users } = useAccountUsers(accountId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Responsáveis e alçadas</CardTitle>
      </CardHeader>
      <CardContent>
        {(users ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum usuário vinculado. O mesmo usuário pode ter alçadas diferentes em
            contas diferentes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-right">Limite de movimentação</TableHead>
                  <TableHead className="text-right">Limite de aprovação</TableHead>
                  <TableHead>Pode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      {link.user?.name ?? link.userId}
                      <span className="block text-xs text-muted-foreground">
                        {link.user?.email}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(link.transactionLimit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(link.approvalLimit)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {link.canViewBalance && (
                          <Badge variant="outline" className="text-[10px]">
                            ver saldo
                          </Badge>
                        )}
                        {link.canSchedulePayment && (
                          <Badge variant="outline" className="text-[10px]">
                            agendar
                          </Badge>
                        )}
                        {link.canAuthorizePayment && (
                          <Badge variant="outline" className="text-[10px]">
                            autorizar
                          </Badge>
                        )}
                        {link.canReconcile && (
                          <Badge variant="outline" className="text-[10px]">
                            conciliar
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationsTab({ accountId }: { accountId: string }) {
  const { data: integrations } = useAccountIntegrations(accountId);

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Plug />
        <AlertTitle>Integrações preparadas, ainda não executadas</AlertTitle>
        <AlertDescription>
          A conexão real com o banco virá com a importação bancária e a conciliação. As
          credenciais ficam em cofre: o sistema guarda apenas a referência, nunca o
          segredo.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrações configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          {(integrations ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma integração configurada.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(integrations ?? []).map((integration) => (
                <li
                  key={integration.id}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {INTEGRATION_TYPE_LABELS[integration.integrationType]}
                    </span>
                    {integration.provider && (
                      <span className="text-muted-foreground">
                        · {integration.provider}
                      </span>
                    )}
                    <Badge variant="outline" className="ml-auto">
                      {INTEGRATION_STATUS_LABELS[integration.status]}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Ambiente: {integration.environment === "PRODUCTION" ? "Produção" : "Homologação"}
                    {" · "}
                    Credencial:{" "}
                    {integration.hasCredentials ? "configurada" : "não configurada"}
                    {" · "}
                    Última sincronização:{" "}
                    {integration.lastSyncAt
                      ? formatDateTimeBR(integration.lastSyncAt)
                      : "ainda não realizada"}
                  </span>
                  {integration.lastErrorMessage && (
                    <span className="text-xs text-destructive">
                      {integration.lastErrorMessage}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab({ accountId }: { accountId: string }) {
  const { data } = useAccountAudit(accountId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico e auditoria</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Mudanças de situação</h3>
          {(data?.statusHistory ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mudança registrada.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(data?.statusHistory ?? []).map((entry) => (
                <li key={entry.id} className="border-b pb-2 last:border-0">
                  <span className="font-medium">
                    {entry.previousStatus
                      ? `${ACCOUNT_STATUS_LABELS[entry.previousStatus as keyof typeof ACCOUNT_STATUS_LABELS]} → `
                      : ""}
                    {ACCOUNT_STATUS_LABELS[entry.newStatus as keyof typeof ACCOUNT_STATUS_LABELS]}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDateTimeBR(entry.changedAt)}
                  </span>
                  {entry.reason && (
                    <span className="block text-xs text-muted-foreground">
                      {entry.reason}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Trilha de auditoria</h3>
          {(data?.auditLogs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {(data?.auditLogs ?? []).map((log) => (
                <li key={log.id} className="flex flex-wrap gap-2">
                  <span className="font-mono">{log.action}</span>
                  {log.field && <span>({log.field})</span>}
                  <span className="ml-auto">{formatDateTimeBR(log.createdAt)}</span>
                  {log.reason && <span className="w-full">{log.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
