"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Layers, Loader2, Plus } from "lucide-react";

import { useBatchActions, usePaymentBatches } from "@/lib/api/payment-scheduling";
import { useFinancialAccounts } from "@/lib/api/treasury";
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
  BATCH_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  type BankPaymentType,
  type PaymentBatchStatus,
} from "@/types/payment-scheduling";

/**
 * Lotes de pagamento (seção 8).
 *
 * Um lote é sempre de uma empresa, uma conta e uma data — o arquivo de remessa é por
 * convênio bancário, que é por conta. A restrição aparece já na criação para que ninguém
 * monte um lote que o banco recusaria.
 */
export default function LotesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = usePaymentBatches({ organizationId, companyId, perPage: 50 });
  const { data: accountsPage } = useFinancialAccounts({
    organizationId,
    companyId,
    perPage: 100,
  });
  const accounts = React.useMemo(
    () => accountsPage?.items ?? [],
    [accountsPage],
  );
  const actions = useBatchActions();

  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [paymentType, setPaymentType] = React.useState("");
  const [failure, setFailure] = React.useState<string | null>(null);

  const batches = data?.items ?? [];

  function submit() {
    if (!organizationId || !companyId) return;
    setFailure(null);

    actions.create.mutate(
      {
        organizationId,
        companyId,
        financialAccountId: accountId,
        scheduledDate,
        ...(name ? { name } : {}),
        ...(paymentType ? { bankPaymentType: paymentType } : {}),
      },
      {
        onSuccess: () => {
          setCreating(false);
          setName("");
          setAccountId("");
          setScheduledDate("");
        },
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error ? caught.message : "Não foi possível criar o lote.",
          ),
      },
    );
  }

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
            <Layers className="size-5" />
            Lotes de pagamento
          </h1>
          <p className="text-xs text-muted-foreground">
            Um lote por empresa, conta e data. Nenhuma remessa é gerada nesta etapa.
          </p>
        </div>
        {hasPermission("payment_schedule.batch") && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo lote
          </Button>
        )}
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Lote não criado</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo lote</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Conta de origem" required>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName ?? account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Data de pagamento" required>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
              />
            </Field>

            <Field label="Nome" hint="Opcional — ajuda a achar o lote depois.">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>

            <Field
              label="Forma de pagamento"
              hint="Em branco: lote misto, que a remessa futura separa."
            >
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Misto" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_TYPE_LABELS) as BankPaymentType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PAYMENT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                disabled={!accountId || !scheduledDate || actions.create.isPending}
                onClick={submit}
              >
                {actions.create.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Criar lote
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
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum lote criado.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Data prevista</TableHead>
                <TableHead className="text-right">Títulos</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Link
                      href={`/financeiro/agendamento/lotes/${batch.id}`}
                      className="font-medium hover:underline"
                    >
                      {batch.code}
                    </Link>
                    {batch.name && (
                      <p className="text-xs text-muted-foreground">{batch.name}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.company?.tradeName ?? batch.company?.legalName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.financialAccount?.displayName ??
                      batch.financialAccount?.name ??
                      "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.financialAccount?.financialInstitution?.shortName ??
                      batch.financialAccount?.financialInstitution?.legalName ??
                      "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateBR(batch.scheduledDate)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {batch.itemCount}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatCurrencyBRL(Number(batch.totalAmount))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        batch.status === "CANCELLED"
                          ? "outline"
                          : batch.status === "READY_TO_SEND"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {BATCH_STATUS_LABELS[batch.status as PaymentBatchStatus]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Alert>
        <AlertTitle>Fechar o lote não envia nada ao banco</AlertTitle>
        <AlertDescription>
          Um lote fechado fica &ldquo;pronto para envio&rdquo;: é o estado que a Execução
          Bancária vai consumir quando existir. Remessa CNAB, PIX e retorno bancário não
          fazem parte desta etapa.
        </AlertDescription>
      </Alert>
    </div>
  );
}
