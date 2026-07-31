"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LineChart,
  Loader2,
  Play,
} from "lucide-react";

import { usePaymentSchedules, useSimulation } from "@/lib/api/payment-scheduling";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field } from "@/components/treasury/field";
import { displayNameOf } from "@/types/payment-scheduling";

/** Primeiro e último dia do mês corrente, em ISO. */
function monthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

/**
 * Simulação financeira (seção 10).
 *
 * As alterações são hipotéticas e nada é gravado: dá para empurrar três pagamentos e ver o
 * caixa sem precisar alterar dados de verdade e desfazer depois — que é como uma simulação
 * vira uma alteração acidental.
 */
export default function SimulacaoPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const range = React.useMemo(() => monthRange(), []);
  const [from, setFrom] = React.useState(range.from);
  const [to, setTo] = React.useState(range.to);
  const [considerLimits, setConsiderLimits] = React.useState(true);
  const [moves, setMoves] = React.useState<Record<string, string>>({});
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [failure, setFailure] = React.useState<string | null>(null);

  const { data: schedules } = usePaymentSchedules({
    organizationId,
    companyId,
    scheduledFrom: from,
    scheduledTo: to,
    perPage: 50,
  });

  const simulation = useSimulation();
  const result = simulation.data;

  function run() {
    if (!companyId) return;
    setFailure(null);

    const changes = [
      ...Object.entries(moves)
        .filter(([, date]) => date)
        .map(([scheduleId, scheduledDate]) => ({ scheduleId, scheduledDate })),
      ...excluded.map((scheduleId) => ({ scheduleId, excluded: true })),
    ];

    simulation.mutate(
      {
        companyId,
        from,
        to,
        considerCreditLimits: considerLimits,
        ...(changes.length > 0 ? { changes } : {}),
      },
      {
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error ? caught.message : "Não foi possível simular.",
          ),
      },
    );
  }

  const items = schedules?.items ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/agendamento">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <LineChart className="size-5" />
            Simulação financeira
          </h1>
          <p className="text-xs text-muted-foreground">
            Nada é gravado. As alterações valem só para este cálculo.
          </p>
        </div>
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Simulação não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período e premissas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="De">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="Até">
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Considerar limites contratados</p>
              <p className="text-xs text-muted-foreground">
                Cheque especial e capital de giro entram como caixa disponível.
              </p>
            </div>
            <Switch
              checked={considerLimits}
              onCheckedChange={setConsiderLimits}
            />
          </div>
          <div className="flex items-end">
            <Button disabled={!companyId || simulation.isPending} onClick={run}>
              {simulation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Simular
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Cenário hipotético ──────────────────────────────────────────── */}
      {items.length > 0 && (
        <Card className="overflow-x-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Alterações hipotéticas ({Object.keys(moves).filter((key) => moves[key]).length + excluded.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data atual</TableHead>
                  <TableHead>Data simulada</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Tirar da simulação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.payable.code}</TableCell>
                    <TableCell className="text-sm">
                      {displayNameOf(item.payable.supplier)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.scheduledDate ? formatDateBR(item.scheduledDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        className="w-40"
                        value={moves[item.id] ?? ""}
                        onChange={(event) =>
                          setMoves((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(Number(item.totalAmount))}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={excluded.includes(item.id)}
                        onCheckedChange={(checked) =>
                          setExcluded((current) =>
                            checked
                              ? [...current, item.id]
                              : current.filter((value) => value !== item.id),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Resultado ───────────────────────────────────────────────────── */}
      {result && (
        <>
          {result.hasDeficit ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>
                Déficit previsto de {formatCurrencyBRL(result.totalDeficit)}
              </AlertTitle>
              <AlertDescription>
                O caixa não cobre o desembolso deste cenário. Teste outras datas antes de
                reprogramar de verdade.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>
                Caixa cobre o período — sobra de {formatCurrencyBRL(result.totalSurplus)}
              </AlertTitle>
              <AlertDescription>
                {result.scheduleCount} pagamento(s) somando{" "}
                {formatCurrencyBRL(result.totalOutflow)}.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary
              label="Poder de gasto"
              value={formatCurrencyBRL(result.totalSpendingPower)}
            />
            <Summary
              label="Total a desembolsar"
              value={formatCurrencyBRL(result.totalOutflow)}
            />
            <Summary
              label="Déficit previsto"
              value={formatCurrencyBRL(result.totalDeficit)}
              danger={result.totalDeficit > 0}
            />
            <Summary
              label="Excesso de caixa"
              value={formatCurrencyBRL(result.totalSurplus)}
            />
          </div>

          {result.unassigned > 0 && (
            <Alert>
              <AlertTitle>
                {result.unassigned} programação(ões) fora da projeção
              </AlertTitle>
              <AlertDescription>
                Sem conta ou sem data definida — defina os dois para elas entrarem no
                cálculo.
              </AlertDescription>
            </Alert>
          )}

          {result.accounts.map((account) => (
            <Card key={account.accountId} className="overflow-x-auto">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {account.accountName}
                  {account.deficit > 0 && (
                    <Badge variant="destructive">
                      Déficit de {formatCurrencyBRL(account.deficit)}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Abertura {formatCurrencyBRL(account.openingBalance)} · limite{" "}
                  {formatCurrencyBRL(account.creditLimit)} · desembolso{" "}
                  {formatCurrencyBRL(account.totalOutflow)}
                  {account.lowestBalanceDate &&
                    ` · pior dia: ${formatDateBR(account.lowestBalanceDate)}`}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Pagamentos</TableHead>
                      <TableHead className="text-right">Desembolso</TableHead>
                      <TableHead className="text-right">Saldo projetado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.days.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="text-sm">
                          {formatDateBR(day.date)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {day.scheduleCount}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrencyBRL(day.outflow)}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-medium tabular-nums ${
                            day.projectedBalance < 0 ? "text-destructive" : ""
                          }`}
                        >
                          {formatCurrencyBRL(day.projectedBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        A projeção não tem entradas: o Pulse ainda não tem Contas a Receber nem fluxo de
        caixa. Ela responde &ldquo;o que já existe em conta cobre o que está
        programado?&rdquo;.
      </p>
    </div>
  );
}

function Summary({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? "border-destructive/40" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-lg font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
