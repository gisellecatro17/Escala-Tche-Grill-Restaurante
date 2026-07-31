"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Plus } from "lucide-react";

import {
  useBankTransactions,
  useEligibleAccounts,
  useTransactionActions,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import { TransactionTable } from "@/components/reconciliation/transaction-table";
import {
  DIRECTION_LABELS,
  TRANSACTION_STATUS_LABELS,
  type BankTransactionReconciliationStatus,
} from "@/types/reconciliation";

const STATUS_OPTIONS: BankTransactionReconciliationStatus[] = [
  "AVAILABLE",
  "MATCH_SUGGESTED",
  "PARTIALLY_MATCHED",
  "MATCHED",
  "MANUALLY_MATCHED",
  "UNIDENTIFIED",
  "IGNORED",
];

/** Todas as movimentações do extrato, com filtros (seção 17). */
export default function TransacoesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [direction, setDirection] = React.useState("all");
  const [accountId, setAccountId] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [manualOpen, setManualOpen] = React.useState(false);

  const { data: accounts } = useEligibleAccounts(organizationId, companyId);
  const { data, isLoading } = useBankTransactions({
    organizationId,
    companyId,
    search: search || undefined,
    reconciliationStatus: status === "all" ? undefined : status,
    direction: direction === "all" ? undefined : direction,
    financialAccountId: accountId === "all" ? undefined : accountId,
    page,
    perPage: 25,
  });

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
            <Link href="/financeiro/conciliacao">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Layers className="size-5" />
              Movimentações bancárias
            </h1>
            <p className="text-xs text-muted-foreground">
              Tudo que veio do extrato, em qualquer situação.
            </p>
          </div>
        </div>

        {hasPermission("reconciliation.create_manual_transaction") && (
          <Button onClick={() => setManualOpen(true)}>
            <Plus className="size-4" />
            Registrar movimentação
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => reset(setSearch)(event.target.value)}
            placeholder="Buscar no histórico, documento ou contraparte"
          />
          <Select value={status} onValueChange={reset(setStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              {STATUS_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {TRANSACTION_STATUS_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={reset(setDirection)}>
            <SelectTrigger>
              <SelectValue placeholder="Sentido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Entradas e saídas</SelectItem>
              <SelectItem value="IN">{DIRECTION_LABELS.IN}</SelectItem>
              <SelectItem value="OUT">{DIRECTION_LABELS.OUT}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accountId} onValueChange={reset(setAccountId)}>
            <SelectTrigger>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {(accounts ?? []).map((item) => (
                <SelectItem key={item.account.id} value={item.account.id}>
                  {item.account.displayName ?? item.account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <TransactionTable
              items={data?.items ?? []}
              emptyMessage="Nenhuma movimentação encontrada com estes filtros."
            />
          </CardContent>
        </Card>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total}{" "}
            movimentação(ões)
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

      <ManualTransactionDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        organizationId={organizationId}
        companyId={companyId}
        accounts={(accounts ?? [])
          .filter((item) => item.manualTransactionEnabled)
          .map((item) => ({
            id: item.account.id,
            label: item.account.displayName ?? item.account.name,
          }))}
      />
    </div>
  );
}

/**
 * Digitação manual (seção 16).
 *
 * A movimentação digitada é marcada como manual e exige justificativa. Ela **não pode** se
 * passar por extrato bancário: sem essa distinção, uma conciliação fechada com dados
 * inventados seria indistinguível de uma fechada contra o extrato de verdade.
 */
function ManualTransactionDialog({
  open,
  onOpenChange,
  organizationId,
  companyId,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | undefined;
  companyId: string | undefined;
  accounts: { id: string; label: string }[];
}) {
  const { createManual } = useTransactionActions();

  const [accountId, setAccountId] = React.useState("");
  const [direction, setDirection] = React.useState("OUT");
  const [date, setDate] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [documentNumber, setDocumentNumber] = React.useState("");
  const [manualReason, setManualReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const ready =
    accountId && date && amount && description && manualReason.length > 0;

  function submit() {
    if (!organizationId || !companyId || !ready) return;

    setError(null);
    createManual.mutate(
      {
        organizationId,
        companyId,
        financialAccountId: accountId,
        direction,
        transactionDate: date,
        amount: Number(amount),
        description,
        documentNumber: documentNumber || undefined,
        manualReason,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAmount("");
          setDescription("");
          setDocumentNumber("");
          setManualReason("");
        },
        onError: (caught: unknown) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível registrar a movimentação.",
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar movimentação manual</DialogTitle>
          <DialogDescription>
            Fica marcada como digitada, com o motivo registrado. Ela nunca se
            confunde com o que veio do banco.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível registrar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Conta" required>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Sentido" required>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUT">{DIRECTION_LABELS.OUT}</SelectItem>
                <SelectItem value="IN">{DIRECTION_LABELS.IN}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Data" required>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>

          <Field label="Valor" required hint="Sempre positivo.">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Histórico" required>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Como a movimentação deve aparecer"
              />
            </Field>
          </div>

          <Field label="Documento">
            <Input
              value={documentNumber}
              onChange={(event) => setDocumentNumber(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Por que está sendo digitada"
              required
              hint="Fica no histórico e na auditoria."
            >
              <Textarea
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
                rows={2}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!ready || createManual.isPending}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
