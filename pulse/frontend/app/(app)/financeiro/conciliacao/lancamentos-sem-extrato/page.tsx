"use client";

import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";

import { useEntriesWithoutStatement } from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
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
import { EmptyState, brl } from "@/components/reconciliation/shared";

/**
 * O espelho da fila de não identificadas (seção 41).
 *
 * Um pagamento registrado como pago que o banco nunca mostrou é tão grave quanto uma saída
 * bancária sem lançamento. As duas listas juntas fecham a pergunta "o que está fora do
 * lugar?" pelos dois lados — uma sozinha só conta metade da história.
 */
export default function LancamentosSemExtratoPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data, isLoading } = useEntriesWithoutStatement({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
  });

  const empty =
    (data?.installments.length ?? 0) === 0 && (data?.schedules.length ?? 0) === 0;

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
            <FileSearch className="size-5" />
            Lançamentos sem extrato
          </h1>
          <p className="text-xs text-muted-foreground">
            O Pulse registrou a saída, mas nenhuma movimentação bancária
            corresponde a ela.
          </p>
        </div>
      </div>

      <Alert>
        <FileSearch className="size-4" />
        <AlertTitle>Por que isso importa</AlertTitle>
        <AlertDescription>
          Um pagamento marcado como pago que o banco nunca mostrou significa uma
          de duas coisas: o extrato daquele dia não foi importado, ou a baixa foi
          registrada sem que o dinheiro saísse.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : empty ? (
        <EmptyState
          icon={FileSearch}
          title="Todo lançamento tem contrapartida no extrato"
          description="Nenhuma baixa registrada no período ficou sem movimentação bancária correspondente."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Parcelas baixadas sem movimentação ({data?.installments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Baixado em</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.installments ?? []).map((item) => (
                    <TableRow key={item.entityId}>
                      <TableCell className="font-medium">
                        {item.code} — parcela {item.installmentNumber}
                      </TableCell>
                      <TableCell>{item.supplierName ?? "—"}</TableCell>
                      <TableCell className="max-w-sm truncate">
                        {item.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {item.referenceDate
                          ? formatDateBR(item.referenceDate)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.installments ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Nenhuma parcela nesta situação.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Programações enviadas sem movimentação ({data?.schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programação</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.schedules ?? []).map((item) => (
                    <TableRow key={item.entityId}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.payableCode}</TableCell>
                      <TableCell className="max-w-sm truncate">
                        {item.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {item.referenceDate
                          ? formatDateBR(item.referenceDate)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.schedules ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground"
                      >
                        Nenhuma programação nesta situação.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
