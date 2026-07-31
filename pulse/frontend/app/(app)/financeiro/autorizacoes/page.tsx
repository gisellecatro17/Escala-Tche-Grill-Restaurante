"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";

import { useApprovalDashboard } from "@/lib/api/approvals";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { REQUEST_STATUS_LABELS, formatDuration } from "@/types/approvals";

/**
 * Painel das autorizações (seção 3).
 *
 * Cada número aponta para a fila já filtrada: um indicador que não leva a lugar nenhum é
 * decoração, e quem abre este painel abre para agir.
 */
export default function AutorizacoesPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useApprovalDashboard(organizationId, companyId);

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
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5" />
          Autorizações
        </h1>
        <p className="text-sm text-muted-foreground">
          Governança das despesas: quem aprova, até quanto e em que ordem.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <IndicatorCard
          icon={<Clock className="size-4" />}
          label="Aguardando aprovação"
          value={String(data.cards.pending)}
          href="/financeiro/autorizacoes/fila"
        />
        <IndicatorCard
          icon={<Timer className="size-4" />}
          label="Valor total pendente"
          value={formatCurrencyBRL(data.cards.pendingAmount)}
          href="/financeiro/autorizacoes/fila"
        />
        <IndicatorCard
          icon={<AlertTriangle className="size-4" />}
          label="Aprovações vencidas"
          value={String(data.cards.overdue)}
          href="/financeiro/autorizacoes/fila?overdue=true"
          highlight={data.cards.overdue > 0}
        />
        <IndicatorCard
          icon={<Zap className="size-4" />}
          label="Urgentes"
          value={String(data.cards.urgent)}
          href="/financeiro/autorizacoes/fila?priority=URGENT"
          highlight={data.cards.urgent > 0}
        />
        <IndicatorCard
          icon={<Ban className="size-4" />}
          label="Recusadas"
          value={String(data.cards.rejected)}
          href="/financeiro/autorizacoes/fila?status=REJECTED"
        />
        <IndicatorCard
          icon={<CheckCircle2 className="size-4" />}
          label="Tempo médio de aprovação"
          value={formatDuration(data.indicators.averageDecisionSeconds)}
          href="/financeiro/autorizacoes/fila?status=APPROVED"
          hint={`${data.indicators.decidedCount} decisão(ões)`}
        />
      </div>

      <Alert>
        <ShieldCheck />
        <AlertTitle>O que aprovar significa aqui</AlertTitle>
        <AlertDescription>{data.note}</AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Por empresa"
          rows={data.byCompany.map((row) => ({
            key: row.companyId,
            label: row.companyName ?? "Empresa sem nome",
            count: row.count,
            amount: row.amount,
          }))}
        />

        <BreakdownCard
          title="Por centro de custo"
          rows={data.byCostCenter.map((row) => ({
            key: row.costCenterId ?? "sem",
            label: row.costCenterName ?? "Sem centro de custo",
            count: row.count,
            amount: row.amount,
          }))}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Por aprovador</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byApprover.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa em andamento designada a uma pessoa específica.
                Etapas por perfil não aparecem aqui — elas não têm um dono único.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aprovador</TableHead>
                    <TableHead className="text-right">Na fila</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byApprover.map((row) => (
                    <TableRow key={row.userId ?? "sem"}>
                      <TableCell>{row.userName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Por situação</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Solicitações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byStatus.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <Link
                        href={`/financeiro/autorizacoes/fila?status=${row.status}`}
                        className="hover:underline"
                      >
                        {REQUEST_STATUS_LABELS[row.status]}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/financeiro/autorizacoes/fila">
            Abrir a fila
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro/autorizacoes/fluxos">Fluxos e alçadas</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/financeiro/autorizacoes/delegacoes">Delegações</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/financeiro/autorizacoes/parametros">Parâmetros</Link>
        </Button>
      </div>
    </div>
  );
}

function IndicatorCard({
  icon,
  label,
  value,
  href,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={highlight ? "border-destructive/50" : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            {icon}
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; count: number; amount: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada aguardando aprovação.
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
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyBRL(row.amount)}
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
