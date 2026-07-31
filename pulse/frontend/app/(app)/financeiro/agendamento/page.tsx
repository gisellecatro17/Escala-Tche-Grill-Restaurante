"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock,
  Layers,
  LineChart,
  ListChecks,
  SlidersHorizontal,
  Wallet,
  Zap,
} from "lucide-react";

import { useSchedulingDashboard } from "@/lib/api/payment-scheduling";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL } from "@/lib/format";
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
import {
  PAYMENT_TYPE_LABELS,
  type BankPaymentType,
  type DashboardGroup,
} from "@/types/payment-scheduling";

/**
 * Painel do agendamento bancário (seção 3).
 *
 * Os totais programados **não** incluem o que está bloqueado: dinheiro travado não vai
 * sair, e somá-lo faria o painel pedir um caixa que ninguém precisa ter. Bloqueados
 * aparecem no seu próprio indicador.
 */
export default function AgendamentoPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useSchedulingDashboard(organizationId, companyId);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const deficits = data.accountPositions.filter(
    (position) => position.projectedBalance < 0,
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="size-5" />
            Agendamento bancário
          </h1>
          <p className="text-sm text-muted-foreground">
            Quando cada obrigação sai, de que conta e em que lote. Nenhum pagamento é
            executado aqui.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/financeiro/agendamento/fila">
              <ListChecks className="size-4" />
              Fila de pagamentos
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/financeiro/agendamento/lotes">
              <Layers className="size-4" />
              Lotes
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/financeiro/agendamento/simulacao">
              <LineChart className="size-4" />
              Simulação
            </Link>
          </Button>
          {hasPermission("payment_schedule.edit") && (
            <Button variant="ghost" size="icon" asChild title="Parâmetros">
              <Link href="/financeiro/agendamento/parametros">
                <SlidersHorizontal className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {deficits.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {deficits.length} conta(s) com saldo projetado negativo
          </AlertTitle>
          <AlertDescription>
            {deficits
              .map(
                (position) =>
                  `${position.accountName}: ${formatCurrencyBRL(position.projectedBalance)}`,
              )
              .join(" · ")}
            . Use a simulação para testar outras datas antes de reprogramar.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Indicator
          icon={<CalendarDays className="size-4" />}
          label="Programado para hoje"
          value={formatCurrencyBRL(data.dueTodayTotal)}
          hint={`${data.dueTodayCount} pagamento(s)`}
          href="/financeiro/agendamento/fila"
        />
        <Indicator
          icon={<CalendarRange className="size-4" />}
          label="Próximos 7 dias"
          value={formatCurrencyBRL(data.dueThisWeekTotal)}
          href="/financeiro/agendamento/fila"
        />
        <Indicator
          icon={<CalendarClock className="size-4" />}
          label="Até o fim do mês"
          value={formatCurrencyBRL(data.dueThisMonthTotal)}
          href="/financeiro/agendamento/fila"
        />
        <Indicator
          icon={<Clock className="size-4" />}
          label="Aguardando programação"
          value={formatCurrencyBRL(data.pendingSchedulingTotal)}
          hint={`${data.pendingSchedulingCount} título(s)`}
          href="/financeiro/agendamento/fila?situation=PENDING_SCHEDULING"
        />
        <Indicator
          icon={<Zap className="size-4" />}
          label="Urgentes e críticos"
          value={formatCurrencyBRL(data.urgentTotal)}
          hint={`${data.urgentCount} pagamento(s)`}
          href="/financeiro/agendamento/fila?priority=URGENT"
        />
        <Indicator
          icon={<Ban className="size-4" />}
          label="Bloqueados"
          value={formatCurrencyBRL(data.blockedTotal)}
          hint={`${data.blockedCount} pagamento(s)`}
          href="/financeiro/agendamento/fila?blocked=true"
          tone="danger"
        />
        <Indicator
          icon={<CalendarClock className="size-4" />}
          label="Reprogramados"
          value={formatCurrencyBRL(data.rescheduledTotal)}
          hint={`${data.rescheduledCount} pagamento(s)`}
          href="/financeiro/agendamento/fila?rescheduled=true"
        />
        <Indicator
          icon={<Layers className="size-4" />}
          label="Lotes aguardando envio"
          value={String(data.batchesAwaitingCount)}
          hint={formatCurrencyBRL(data.batchesAwaitingTotal)}
          href="/financeiro/agendamento/lotes"
        />
        <Indicator
          icon={<Ban className="size-4" />}
          label="Lotes bloqueados"
          value={String(data.batchesBlockedCount)}
          hint="Com programação travada dentro"
          href="/financeiro/agendamento/lotes"
          tone={data.batchesBlockedCount > 0 ? "danger" : undefined}
        />
      </div>

      {/* ── Saldo projetado por conta ────────────────────────────────────── */}
      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4" />
            Saldo projetado por conta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.accountPositions.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Selecione uma empresa no cabeçalho para ver as contas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Saldo de abertura</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead className="text-right">Programado</TableHead>
                  <TableHead className="text-right">Projetado</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accountPositions.map((position) => (
                  <TableRow key={position.accountId}>
                    <TableCell className="text-sm">{position.accountName}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(position.openingBalance)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(position.creditLimit)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(position.committedAmount)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm font-medium tabular-nums ${
                        position.projectedBalance < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatCurrencyBRL(position.projectedBalance)}
                    </TableCell>
                    <TableCell>
                      {position.unavailable ? (
                        <Badge variant="destructive">
                          {position.unavailableReason}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disponível</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <GroupCard title="Por empresa" rows={data.byCompany} />
        <GroupCard title="Por conta bancária" rows={data.byFinancialAccount} />
        <GroupCard
          title="Por forma de pagamento"
          rows={data.byPaymentType.map((row) => ({
            ...row,
            label:
              row.key === null
                ? "Sem tipo definido"
                : PAYMENT_TYPE_LABELS[row.key as BankPaymentType],
          }))}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        O saldo vem do saldo de abertura aprovado na tesouraria menos o que está bloqueado —
        o Pulse ainda não registra movimento bancário. Quando a conciliação existir, este
        painel passa a ler o saldo real sem que nada mais mude.
      </p>
    </div>
  );
}

function Indicator({
  icon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "danger";
}) {
  const content = (
    <Card className={tone === "danger" ? "border-destructive/40" : undefined}>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <p
          className={`text-lg font-semibold tabular-nums ${
            tone === "danger" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="transition-opacity hover:opacity-80">
      {content}
    </Link>
  );
}

function GroupCard({ title, rows }: { title: string; rows: DashboardGroup[] }) {
  return (
    <Card className="overflow-x-auto">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            Nada programado nesta dimensão.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 8).map((row) => (
                <TableRow key={row.key ?? row.label}>
                  <TableCell className="text-sm">{row.label}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {row.count}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrencyBRL(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
