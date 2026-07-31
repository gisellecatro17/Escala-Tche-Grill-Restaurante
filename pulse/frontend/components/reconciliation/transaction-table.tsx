"use client";

import Link from "next/link";
import { Bot, Loader2 } from "lucide-react";

import { formatDateBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DirectionAmount,
  DuplicateBadge,
  TransactionStatusBadge,
  brl,
  money,
} from "@/components/reconciliation/shared";
import {
  TRANSACTION_TYPE_LABELS,
  type BankTransactionListItem,
} from "@/types/reconciliation";

/**
 * A tabela de movimentações, compartilhada pelas telas que listam extrato.
 *
 * Uma só implementação porque "a conciliar", "não identificadas" e "todas" mostram os
 * mesmos dados com filtros diferentes — três tabelas separadas divergiriam na primeira vez
 * que uma coluna mudasse.
 */
export function TransactionTable({
  items,
  onGenerate,
  generatingId,
  emptyMessage,
}: {
  items: BankTransactionListItem[];
  onGenerate?: (id: string) => void;
  generatingId?: string | null;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Histórico</TableHead>
            <TableHead>Conta</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Sugestão</TableHead>
            {onGenerate && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const best = item.suggestions?.[0];
            const pending =
              money(item.amount) - money(item.reconciledAmount);

            return (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateBR(item.transactionDate)}
                </TableCell>
                <TableCell className="max-w-sm">
                  <Link
                    href={`/financeiro/conciliacao/transacoes/${item.id}`}
                    className="line-clamp-1 font-medium underline-offset-2 hover:underline"
                  >
                    {item.originalDescription}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">
                      {TRANSACTION_TYPE_LABELS[item.transactionType]}
                    </Badge>
                    {item.isManual && <Badge variant="secondary">Digitada</Badge>}
                    <DuplicateBadge status={item.duplicateStatus} />
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {item.financialAccount?.displayName ??
                    item.financialAccount?.name ??
                    "—"}
                </TableCell>
                <TableCell className="text-right">
                  <DirectionAmount
                    direction={item.direction}
                    amount={item.amount}
                  />
                  {money(item.reconciledAmount) > 0 &&
                    pending > 0 && (
                      <div className="text-xs text-muted-foreground">
                        resta {brl(pending)}
                      </div>
                    )}
                </TableCell>
                <TableCell>
                  <TransactionStatusBadge status={item.reconciliationStatus} />
                </TableCell>
                <TableCell className="text-sm">
                  {best ? (
                    <Link
                      href={`/financeiro/conciliacao/transacoes/${item.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {best.matchingCriteria.label ?? "Candidato encontrado"} ·{" "}
                      {money(best.score).toFixed(0)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {onGenerate && (
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={generatingId === item.id}
                      onClick={() => onGenerate(item.id)}
                    >
                      {generatingId === item.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Bot className="size-3.5" />
                      )}
                      Buscar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={onGenerate ? 7 : 6}
                className="text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
