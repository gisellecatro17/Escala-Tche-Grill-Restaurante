"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/format";
import {
  CONFIDENCE_LABELS,
  DUPLICATE_LABELS,
  RECONCILIATION_TYPE_LABELS,
  TRANSACTION_STATUS_LABELS,
  type BankTransactionDirection,
  type BankTransactionReconciliationStatus,
  type DuplicateStatus,
  type MatchConfidenceLevel,
  type ReconciliationType,
} from "@/types/reconciliation";

/** O back-end serializa `Decimal` como string; o front nunca deve assumir número. */
export function money(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function brl(value: string | number | null | undefined): string {
  return formatCurrencyBRL(money(value));
}

const STATUS_VARIANTS: Record<
  BankTransactionReconciliationStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  IMPORTED: "outline",
  AVAILABLE: "outline",
  MATCH_SUGGESTED: "secondary",
  PARTIALLY_MATCHED: "secondary",
  MATCHED: "default",
  MANUALLY_MATCHED: "default",
  UNIDENTIFIED: "destructive",
  IGNORED: "outline",
  DUPLICATE: "destructive",
  REVERSED: "outline",
  CANCELLED: "outline",
  ERROR: "destructive",
};

export function TransactionStatusBadge({
  status,
}: {
  status: BankTransactionReconciliationStatus;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {TRANSACTION_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Entrada e saída com cor e seta.
 *
 * O valor é sempre positivo no banco de dados — o sentido é o que dá significado a ele. Se
 * a tela mostrasse só o número, crédito e débito ficariam idênticos.
 */
export function DirectionAmount({
  direction,
  amount,
}: {
  direction: BankTransactionDirection;
  amount: string | number;
}) {
  const incoming = direction === "IN";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium tabular-nums ${
        incoming ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
      }`}
    >
      {incoming ? (
        <ArrowDownLeft className="size-3.5" />
      ) : (
        <ArrowUpRight className="size-3.5" />
      )}
      {brl(amount)}
    </span>
  );
}

export function DuplicateBadge({ status }: { status: DuplicateStatus }) {
  if (status === "NOT_DUPLICATE") return null;

  return (
    <Badge variant={status === "EXACT" ? "destructive" : "secondary"}>
      {DUPLICATE_LABELS[status]}
    </Badge>
  );
}

export function ConfidenceBadge({
  level,
  score,
}: {
  level: MatchConfidenceLevel;
  score: string | number;
}) {
  const variant =
    level === "VERY_HIGH" || level === "HIGH"
      ? "default"
      : level === "MEDIUM"
        ? "secondary"
        : "outline";

  return (
    <Badge variant={variant}>
      {CONFIDENCE_LABELS[level]} · {money(score).toFixed(0)}
    </Badge>
  );
}

export function ReconciliationTypeBadge({
  type,
}: {
  type: ReconciliationType;
}) {
  return <Badge variant="outline">{RECONCILIATION_TYPE_LABELS[type]}</Badge>;
}

/** Cartão de indicador do painel, no mesmo formato em todas as telas do módulo. */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Estado vazio com uma frase que explica o que fazer, não só "sem dados". */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
