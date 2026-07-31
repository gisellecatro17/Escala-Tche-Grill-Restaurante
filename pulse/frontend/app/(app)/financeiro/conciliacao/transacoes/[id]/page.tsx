"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  EyeOff,
  History,
  Loader2,
  Receipt,
  ThumbsDown,
  Undo2,
} from "lucide-react";

import {
  useBankTransaction,
  useSuggestionActions,
  useTransactionActions,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConfidenceBadge,
  DirectionAmount,
  DuplicateBadge,
  TransactionStatusBadge,
  brl,
  money,
} from "@/components/reconciliation/shared";
import {
  ENTITY_TYPE_LABELS,
  HISTORY_ACTION_LABELS,
  RECONCILIATION_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  SUGGESTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  type MatchSuggestion,
} from "@/types/reconciliation";

/**
 * Detalhe da movimentação bancária: sugestões, conciliação e histórico.
 *
 * A tela mostra **por que** cada sugestão foi feita, não só o score. Um número sozinho não
 * ajuda a decidir — quem revisa precisa saber se a sugestão veio do valor exato ou de um
 * nome parecido, porque a confiança nas duas coisas é muito diferente.
 */
export default function TransacaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data, isLoading } = useBankTransaction(id);
  const { generate, accept, dismiss } = useSuggestionActions();
  const { ignore } = useTransactionActions();

  const [error, setError] = React.useState<string | null>(null);
  const [dismissReason, setDismissReason] = React.useState<
    Record<string, string>
  >({});
  const [ignoreReason, setIgnoreReason] = React.useState("");

  const canReconcile = hasPermission("reconciliation.reconcile");

  function fail(caught: unknown, fallback: string) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const pending = money(data.amount) - money(data.reconciledAmount);
  const suggestions = data.suggestions ?? [];
  const openSuggestions = suggestions.filter(
    (item) => item.status === "PENDING",
  );
  const settled =
    data.reconciliationStatus === "MATCHED" ||
    data.reconciliationStatus === "MANUALLY_MATCHED";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Voltar">
            <Link href="/financeiro/conciliacao/a-conciliar">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Receipt className="size-5" />
              {data.originalDescription}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {formatDateBR(data.transactionDate)}
              <TransactionStatusBadge status={data.reconciliationStatus} />
              <Badge variant="outline">
                {TRANSACTION_TYPE_LABELS[data.transactionType]}
              </Badge>
              <Badge variant="outline">
                {SOURCE_TYPE_LABELS[data.sourceType]}
              </Badge>
              <DuplicateBadge status={data.duplicateStatus} />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canReconcile && !settled && (
            <Button
              variant="outline"
              disabled={generate.isPending}
              onClick={() =>
                generate.mutate(data.id, {
                  onError: (caught) =>
                    fail(caught, "Não foi possível gerar sugestões."),
                })
              }
            >
              {generate.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
              Buscar correspondências
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data.isManual && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Movimentação digitada, não importada</AlertTitle>
          <AlertDescription>
            {data.manualReason ??
              "Registrada manualmente. Ela não veio do arquivo do banco."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Valor</p>
          <p className="text-lg">
            <DirectionAmount direction={data.direction} amount={data.amount} />
          </p>
        </div>
        <Info label="Conciliado" value={brl(data.reconciledAmount)} />
        <Info label="Em aberto" value={brl(pending)} />
        <Info
          label="Conta"
          value={
            data.financialAccount?.displayName ??
            data.financialAccount?.name ??
            "—"
          }
        />
        <Info label="Documento" value={data.documentNumber ?? "—"} />
        <Info
          label="Contraparte"
          value={data.payeeName ?? data.payerName ?? "—"}
        />
        <Info label="Identificador PIX" value={data.pixEndToEndId ?? "—"} />
        <Info
          label="Arquivo de origem"
          value={data.statementImport?.originalFileName ?? "Digitação manual"}
        />
      </div>

      {data.unidentifiedReason && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Não identificada</AlertTitle>
          <AlertDescription>{data.unidentifiedReason}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Sugestões de correspondência
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            O sistema apenas sugere. Nenhuma conciliação acontece sem alguém
            confirmar — por mais alto que o score seja.
          </p>

          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma sugestão gerada ainda. Use &quot;Buscar
              correspondências&quot;.
            </p>
          )}

          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              canReconcile={canReconcile && !settled}
              busy={accept.isPending || dismiss.isPending}
              reason={dismissReason[suggestion.id] ?? ""}
              onReasonChange={(value) =>
                setDismissReason((current) => ({
                  ...current,
                  [suggestion.id]: value,
                }))
              }
              onAccept={() =>
                accept.mutate(
                  { id: suggestion.id },
                  {
                    onError: (caught) =>
                      fail(caught, "Não foi possível aceitar a sugestão."),
                  },
                )
              }
              onDismiss={() =>
                dismiss.mutate(
                  {
                    id: suggestion.id,
                    reason: dismissReason[suggestion.id] ?? "",
                  },
                  {
                    onError: (caught) =>
                      fail(caught, "Não foi possível descartar a sugestão."),
                  },
                )
              }
            />
          ))}
        </CardContent>
      </Card>

      {(data.reconciliationItems ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conciliações desta movimentação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(data.reconciliationItems ?? []).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-0"
              >
                <Badge
                  variant={
                    item.reconciliation.status === "ACTIVE"
                      ? "default"
                      : "outline"
                  }
                >
                  {RECONCILIATION_TYPE_LABELS[
                    item.reconciliation.reconciliationType
                  ]}
                </Badge>
                <span>{ENTITY_TYPE_LABELS[item.entityType]}</span>
                <span className="tabular-nums">
                  {brl(item.allocatedAmount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTimeBR(item.reconciliation.reconciledAt)}
                </span>
                <Link
                  href={`/financeiro/conciliacao/conciliadas?id=${item.reconciliation.id}`}
                  className="text-xs underline"
                >
                  ver conciliação
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasPermission("reconciliation.ignore") && !settled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tirar da fila</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <Input
                value={ignoreReason}
                onChange={(event) => setIgnoreReason(event.target.value)}
                placeholder="Por que esta movimentação não precisa ser conciliada"
              />
            </div>
            <Button
              variant="outline"
              disabled={!ignoreReason || ignore.isPending}
              onClick={() =>
                ignore.mutate(
                  { id: data.id, reason: ignoreReason },
                  {
                    onSuccess: () => setIgnoreReason(""),
                    onError: (caught) =>
                      fail(caught, "Não foi possível ignorar."),
                  },
                )
              }
            >
              <EyeOff className="size-4" />
              Ignorar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="size-4" />
            Linha do tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data.history ?? []).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-baseline gap-2 border-b pb-2 text-sm last:border-0"
            >
              <Badge variant="outline">
                {HISTORY_ACTION_LABELS[entry.actionType]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateTimeBR(entry.performedAt)}
              </span>
              {entry.reason && <span>{entry.reason}</span>}
              {entry.ipAddress && (
                <span className="text-xs text-muted-foreground">
                  IP {entry.ipAddress}
                </span>
              )}
            </div>
          ))}
          {(data.history ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum registro na linha do tempo.
            </p>
          )}
        </CardContent>
      </Card>

      {openSuggestions.length === 0 && !settled && (
        <p className="text-xs text-muted-foreground">
          Sem sugestão aceitável? A conciliação manual, com escolha livre dos
          lançamentos, está em{" "}
          <Link href="/financeiro/conciliacao/a-conciliar" className="underline">
            fila de conciliação
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Um candidato, com a memória de cálculo aberta. */
function SuggestionCard({
  suggestion,
  canReconcile,
  busy,
  reason,
  onReasonChange,
  onAccept,
  onDismiss,
}: {
  suggestion: MatchSuggestion;
  canReconcile: boolean;
  busy: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const criteria = suggestion.matchingCriteria;
  const isPending = suggestion.status === "PENDING";

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {criteria.label ?? ENTITY_TYPE_LABELS[suggestion.candidateEntityType]}
          </p>
          <p className="text-xs text-muted-foreground">
            {ENTITY_TYPE_LABELS[suggestion.candidateEntityType]}
            {criteria.supplierName ? ` · ${criteria.supplierName}` : ""}
            {criteria.candidateAmount !== undefined
              ? ` · ${brl(criteria.candidateAmount)}`
              : ""}
            {criteria.referenceDate
              ? ` · ${formatDateBR(criteria.referenceDate)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge
            level={suggestion.confidenceLevel}
            score={suggestion.score}
          />
          {!isPending && (
            <Badge variant="outline">
              {SUGGESTION_STATUS_LABELS[suggestion.status]}
            </Badge>
          )}
        </div>
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        {(criteria.criteria ?? []).map((item) => (
          <li key={item.criterion} className="flex gap-2">
            <span className="font-medium text-foreground">
              +{item.points} {item.criterion}
            </span>
            <span>{item.detail}</span>
          </li>
        ))}
        {(criteria.criteria ?? []).length === 0 && (
          <li>Sem memória de cálculo registrada.</li>
        )}
      </ul>

      {(money(suggestion.differenceAmount) !== 0 ||
        suggestion.differenceDays !== 0) && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Diferença de {brl(suggestion.differenceAmount)} e{" "}
          {suggestion.differenceDays} dia(s).
        </p>
      )}

      {suggestion.dismissalReason && (
        <p className="mt-2 text-xs text-muted-foreground">
          Descartada: {suggestion.dismissalReason}
        </p>
      )}

      {canReconcile && isPending && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Button size="sm" disabled={busy} onClick={onAccept}>
            <Check className="size-3.5" />
            Aceitar e conciliar
          </Button>
          <div className="min-w-56 flex-1">
            <Input
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Motivo do descarte"
              className="h-8"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !reason}
            onClick={onDismiss}
          >
            <ThumbsDown className="size-3.5" />
            Descartar
          </Button>
        </div>
      )}

      {suggestion.status === "ACCEPTED" && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Undo2 className="size-3" />
          Para reverter, desfaça a conciliação na tela de conciliações.
        </p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
