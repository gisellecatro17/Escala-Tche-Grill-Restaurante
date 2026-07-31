"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpCircle,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Ban,
  Coins,
  ListChecks,
  Percent,
  SlidersHorizontal,
  Wallet,
  Zap,
} from "lucide-react";

import { useAccountsPayableDashboard } from "@/lib/api/accounts-payable";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL } from "@/lib/format";
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
import type { DashboardGroup } from "@/types/accounts-payable";

/**
 * Painel do Contas a Pagar (seção 3).
 *
 * Todo indicador soma o **saldo**, não o valor original: a pergunta que este painel responde
 * é quanto a empresa ainda deve. E todo número leva à lista já filtrada — indicador que não
 * leva a lugar nenhum é enfeite.
 */
export default function ContasAPagarPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useAccountsPayableDashboard(organizationId, companyId);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ArrowUpCircle className="size-5" />
            Contas a pagar
          </h1>
          <p className="text-sm text-muted-foreground">
            As obrigações da empresa, do título gerado até a liquidação.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/financeiro/contas-a-pagar/titulos">
              <ListChecks className="size-4" />
              Ver títulos
            </Link>
          </Button>
          {hasPermission("accounts_payable.edit") && (
            <Button variant="ghost" size="icon" asChild title="Parâmetros">
              <Link href="/financeiro/contas-a-pagar/parametros">
                <SlidersHorizontal className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Indicator
          icon={<Wallet className="size-4" />}
          label="Total a pagar"
          value={formatCurrencyBRL(data.openTotal)}
          hint={`${data.openCount} título(s) em aberto`}
          href="/financeiro/contas-a-pagar/titulos"
        />
        <Indicator
          icon={<AlertTriangle className="size-4" />}
          label="Vencido"
          value={formatCurrencyBRL(data.overdueTotal)}
          href="/financeiro/contas-a-pagar/titulos?overdue=true"
          tone="danger"
        />
        <Indicator
          icon={<CalendarDays className="size-4" />}
          label="Vence hoje"
          value={formatCurrencyBRL(data.dueTodayTotal)}
          href="/financeiro/contas-a-pagar/titulos"
        />
        <Indicator
          icon={<CalendarRange className="size-4" />}
          label="Próximos 7 dias"
          value={formatCurrencyBRL(data.dueThisWeekTotal)}
          href="/financeiro/contas-a-pagar/titulos"
        />
        <Indicator
          icon={<CalendarClock className="size-4" />}
          label="Até o fim do mês"
          value={formatCurrencyBRL(data.dueThisMonthTotal)}
          href="/financeiro/contas-a-pagar/titulos"
        />
        <Indicator
          icon={<CalendarClock className="size-4" />}
          label="Programados"
          value={formatCurrencyBRL(data.scheduledTotal)}
          hint="Programados no Pulse, sem envio ao banco"
          href="/financeiro/contas-a-pagar/titulos?situation=SCHEDULED"
        />
        <Indicator
          icon={<Ban className="size-4" />}
          label="Bloqueados"
          value={formatCurrencyBRL(data.blockedTotal)}
          hint="Não seguem para pagamento"
          href="/financeiro/contas-a-pagar/titulos?blocked=true"
          tone="danger"
        />
        <Indicator
          icon={<Zap className="size-4" />}
          label="Urgentes"
          value={formatCurrencyBRL(data.urgentTotal)}
          href="/financeiro/contas-a-pagar/titulos?priority=URGENT"
        />
        <Indicator
          icon={<Percent className="size-4" />}
          label="Juros lançados"
          value={formatCurrencyBRL(data.forecastInterest)}
          hint="Já registrados em títulos em aberto"
        />
        <Indicator
          icon={<Percent className="size-4" />}
          label="Multas lançadas"
          value={formatCurrencyBRL(data.forecastPenalty)}
        />
        <Indicator
          icon={<Coins className="size-4" />}
          label="Descontos lançados"
          value={formatCurrencyBRL(data.forecastDiscount)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <GroupCard title="Por empresa" rows={data.byCompany} />
        <GroupCard title="Por fornecedor" rows={data.bySupplier} />
        <GroupCard title="Por categoria" rows={data.byCategory} />
        <GroupCard title="Por centro de custo" rows={data.byCostCenter} />
        <GroupCard title="Por projeto" rows={data.byProject} />
        <GroupCard title="Por forma de pagamento" rows={data.byPaymentMethod} />
        <GroupCard title="Por conta financeira" rows={data.byFinancialAccount} />
      </div>

      <p className="text-xs text-muted-foreground">
        Os valores somam o saldo em aberto de cada título. Um título de R$ 10.000 com
        R$ 7.000 já pagos pesa R$ 3.000 aqui.
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
            Nada em aberto nesta dimensão.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Títulos</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
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
