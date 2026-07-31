"use client";

import Link from "next/link";
import { ArrowLeft, Bot, CircleHelp } from "lucide-react";

import { useUnidentifiedTransactions } from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DirectionAmount,
  EmptyState,
  TransactionStatusBadge,
} from "@/components/reconciliation/shared";
import { TRANSACTION_TYPE_LABELS } from "@/types/reconciliation";

/**
 * Movimentações que o extrato trouxe e ninguém identificou (seção 39).
 *
 * É a lista mais importante do módulo: cada linha aqui é dinheiro que entrou ou saiu do
 * banco sem lançamento correspondente no Pulse — ou seja, um buraco no fechamento.
 */
export default function NaoIdentificadasPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data, isLoading } = useUnidentifiedTransactions({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/conciliacao">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <CircleHelp className="size-5" />
            Movimentações não identificadas
          </h1>
          <p className="text-xs text-muted-foreground">
            Dinheiro que passou pelo banco sem lançamento correspondente no
            Pulse.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CircleHelp}
          title="Nada sem identificação"
          description="Toda movimentação do período tem correspondência ou já foi tratada. É o estado que o fechamento espera encontrar."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Sugestões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((item) => (
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
                        {item.documentNumber && (
                          <Badge variant="outline">
                            Doc {item.documentNumber}
                          </Badge>
                        )}
                      </div>
                      {item.unidentifiedReason && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.unidentifiedReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.financialAccount.displayName ??
                        item.financialAccount.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <DirectionAmount
                        direction={item.direction}
                        amount={item.amount}
                      />
                    </TableCell>
                    <TableCell>
                      <TransactionStatusBadge
                        status={item.reconciliationStatus}
                      />
                    </TableCell>
                    <TableCell>
                      {item._count.suggestions > 0 ? (
                        <Badge variant="secondary">
                          {item._count.suggestions} candidato(s)
                        </Badge>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Bot className="size-3" />
                          nenhuma busca
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
