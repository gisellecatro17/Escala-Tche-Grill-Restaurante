"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LockOpen,
  ShieldCheck,
} from "lucide-react";

import {
  useFinancialEntry,
  useFinancialEntryActions,
  useWithholdingActions,
} from "@/lib/api/document-processing";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALLOCATION_TARGET_LABELS,
  DIMENSION_LABELS,
  DIMENSION_SOURCE_LABELS,
  ENTRY_DIRECTION_LABELS,
  ENTRY_ORIGIN_LABELS,
  ENTRY_STATUS_HINTS,
  ENTRY_STATUS_LABELS,
  TAX_TYPE_LABELS,
  WITHHOLDING_STATUS_LABELS,
  type FinancialEntry,
  type FinancialEntryStatus,
} from "@/types/document-processing";

const STATUS_VARIANT: Record<
  FinancialEntryStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "secondary",
  OPEN: "default",
  CANCELLED: "destructive",
};

/**
 * Tela do lançamento financeiro.
 *
 * O título é o que a fila de processamento produziu. As ações disponíveis param em "abrir":
 * pagar, agendar e dar baixa são de módulos que ainda não existem, e nada aqui finge que
 * existem.
 */
export default function LancamentoPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data: entry, isLoading } = useFinancialEntry(id);
  const actions = useFinancialEntryActions();
  const withholdings = useWithholdingActions();

  const [failure, setFailure] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Lançamento não encontrado</AlertTitle>
          <AlertDescription>
            Ele pode ter sido excluído ou pertencer a uma empresa à qual você não tem
            acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  function run(work: () => Promise<unknown>) {
    setFailure(null);
    void work().catch((caught: unknown) =>
      setFailure(
        caught instanceof Error
          ? caught.message
          : "Não foi possível concluir a ação.",
      ),
    );
  }

  const pendingWithholdings = (entry.withholdings ?? []).filter(
    (item) => item.status === "SUGGESTED",
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar">
          <Link
            href={
              entry.direction === "PAYABLE"
                ? "/financeiro/contas-a-pagar"
                : "/financeiro/contas-a-receber"
            }
          >
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 truncate text-lg font-semibold">
            {entry.documentNumber
              ? `Lançamento nº ${entry.documentNumber}`
              : "Lançamento"}
            <Badge variant={STATUS_VARIANT[entry.status]}>
              {ENTRY_STATUS_LABELS[entry.status]}
            </Badge>
            <Badge variant="outline">
              {ENTRY_DIRECTION_LABELS[entry.direction]}
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground">
            {ENTRY_STATUS_HINTS[entry.status]}
          </p>
        </div>

        {entry.sourceIntakeDocumentId && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/financeiro/entrada-documentos/${entry.sourceIntakeDocumentId}`}
            >
              Documento de origem
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        )}

        {entry.status === "PENDING_APPROVAL" &&
          hasPermission("document_processing.approve") && (
            <Button
              variant="outline"
              size="sm"
              disabled={actions.approve.isPending}
              onClick={() => run(() => actions.approve.mutateAsync(entry.id))}
            >
              {actions.approve.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Conferir
            </Button>
          )}

        {entry.status === "DRAFT" &&
          hasPermission("document_processing.open") && (
            <Button
              size="sm"
              disabled={actions.open.isPending}
              onClick={() => run(() => actions.open.mutateAsync(entry.id))}
            >
              {actions.open.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LockOpen className="size-4" />
              )}
              Abrir título
            </Button>
          )}

        {entry.status !== "CANCELLED" &&
          hasPermission("document_processing.cancel") && (
            <Button
              variant="ghost"
              size="sm"
              disabled={actions.cancel.isPending}
              onClick={() => {
                const reason = window.prompt(
                  "Informe o motivo do cancelamento. O documento volta para a fila do processamento.",
                );
                if (!reason?.trim()) return;
                run(() =>
                  actions.cancel.mutateAsync({ id: entry.id, reason: reason.trim() }),
                );
              }}
            >
              <Ban className="size-4" />
              Cancelar
            </Button>
          )}
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {entry.status === "CANCELLED" && entry.cancellationReason && (
        <Alert variant="destructive">
          <Ban />
          <AlertTitle>Lançamento cancelado</AlertTitle>
          <AlertDescription>{entry.cancellationReason}</AlertDescription>
        </Alert>
      )}

      {pendingWithholdings.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>
            {pendingWithholdings.length === 1
              ? "Há uma retenção aguardando decisão"
              : `Há ${pendingWithholdings.length} retenções aguardando decisão`}
          </AlertTitle>
          <AlertDescription>
            Enquanto não forem confirmadas, elas não descontam o valor líquido — e o título
            não pode ser aberto.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Valores</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Amount label="Bruto" value={entry.grossAmount} />
          <Amount label="Desconto" value={entry.discountAmount} />
          <Amount label="Juros" value={entry.interestAmount} />
          <Amount label="Multa" value={entry.penaltyAmount} />
          <Amount label="Retenções" value={entry.withholdingAmount} />
          <Amount label="Líquido" value={entry.netAmount} emphasis />
        </CardContent>
      </Card>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="parcelas">
            Parcelas
            {entry.installments && entry.installments.length > 0 && (
              <Badge variant="secondary">{entry.installments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rateio">
            Rateio
            {entry.allocations && entry.allocations.length > 0 && (
              <Badge variant="secondary">{entry.allocations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="retencoes">
            Retenções
            {entry.withholdings && entry.withholdings.length > 0 && (
              <Badge variant="secondary">{entry.withholdings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Empresa" value={companyOf(entry)} />
              <Info
                label={entry.direction === "PAYABLE" ? "Fornecedor" : "Cliente"}
                value={partyOf(entry)}
              />
              <Info label="Origem" value={ENTRY_ORIGIN_LABELS[entry.origin]} />
              <Info label="Número" value={entry.documentNumber} />
              <Info label="Série" value={entry.documentSeries} />
              <Info label="Chave de acesso" value={entry.accessKey} />
              <Info
                label="Emissão"
                value={entry.issueDate ? formatDateBR(entry.issueDate) : null}
              />
              <Info
                label="Competência"
                value={
                  entry.competenceDate ? formatDateBR(entry.competenceDate) : null
                }
              />
              <Info label="Descrição" value={entry.description} />
              <Info label="Linha digitável" value={entry.digitableLine} />
              <Info label="Código de barras" value={entry.barcode} />
              <Info label="Chave PIX" value={entry.pixKey} />

              <div className="sm:col-span-2 lg:col-span-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Classificação e a origem de cada decisão
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(entry.classificationSources ?? {}).map(
                    ([dimension, source]) => (
                      <Badge key={dimension} variant="outline">
                        {DIMENSION_LABELS[dimension] ?? dimension}:{" "}
                        {DIMENSION_SOURCE_LABELS[source]}
                      </Badge>
                    ),
                  )}
                  {!entry.classificationSources && (
                    <span className="text-sm text-muted-foreground">
                      Sem classificação registrada.
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parcelas">
          <Card>
            <CardContent className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entry.installments ?? []).map((installment) => (
                    <TableRow key={installment.id}>
                      <TableCell>
                        {installment.installmentNumber}/
                        {installment.totalInstallments}
                      </TableCell>
                      <TableCell>{formatDateBR(installment.dueDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyBRL(Number(installment.netAmount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            installment.status === "OPEN"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {installment.status === "OPEN"
                            ? "Em aberto"
                            : "Cancelada"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                Não existe situação &quot;paga&quot;: a liquidação será registrada pelo
                módulo de pagamentos, que ainda não foi desenvolvido.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rateio">
          <Card>
            <CardContent className="py-4">
              {(entry.allocations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este lançamento não foi rateado.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Destino</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(entry.allocations ?? []).map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            {ALLOCATION_TARGET_LABELS[allocation.targetType]}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(allocation.percentage).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrencyBRL(Number(allocation.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="mt-2 text-xs text-muted-foreground">
                    O rateio foi gravado no lançamento: alterar a regra de rateio depois
                    não muda este título.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retencoes">
          <Card>
            <CardContent className="py-4">
              {(entry.withholdings ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma retenção calculada para este lançamento.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tributo</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Alíquota</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(entry.withholdings ?? []).map((withholding) => (
                      <TableRow key={withholding.id}>
                        <TableCell>
                          {TAX_TYPE_LABELS[withholding.taxType]}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyBRL(Number(withholding.calculationBase))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(withholding.rate).toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyBRL(Number(withholding.amount))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              withholding.status === "CONFIRMED"
                                ? "default"
                                : withholding.status === "DISMISSED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {WITHHOLDING_STATUS_LABELS[withholding.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {withholding.status === "SUGGESTED" &&
                            hasPermission(
                              "document_processing.manage_withholdings",
                            ) && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    run(() =>
                                      withholdings.confirm.mutateAsync({
                                        id: entry.id,
                                        withholdingId: withholding.id,
                                      }),
                                    )
                                  }
                                >
                                  Confirmar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const reason = window.prompt(
                                      "Informe o motivo de descartar esta retenção.",
                                    );
                                    if (!reason?.trim()) return;
                                    run(() =>
                                      withholdings.dismiss.mutateAsync({
                                        id: entry.id,
                                        withholdingId: withholding.id,
                                        reason: reason.trim(),
                                      }),
                                    );
                                  }}
                                >
                                  Descartar
                                </Button>
                              </div>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Confirmar é o ato que desconta o valor líquido. O sistema calcula pela
                alíquota do cadastro, não decide alíquota nem gera guia.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entry.statusHistory ?? []).map((history) => (
                    <TableRow key={history.id}>
                      <TableCell className="text-sm">
                        {formatDateTimeBR(history.changedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {history.previousStatus
                          ? ENTRY_STATUS_LABELS[history.previousStatus]
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ENTRY_STATUS_LABELS[history.newStatus]}
                      </TableCell>
                      <TableCell className="text-sm">
                        {history.reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Até onde este módulo vai</AlertTitle>
        <AlertDescription>
          O título fica em aberto. Autorização de pagamento, agendamento bancário, remessa,
          baixa e conciliação não fazem parte deste módulo.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Amount({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasis
            ? "text-lg font-semibold tabular-nums"
            : "text-sm tabular-nums"
        }
      >
        {formatCurrencyBRL(Number(value))}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value ?? "—"}</p>
    </div>
  );
}

function companyOf(entry: FinancialEntry): string | null {
  return entry.company?.tradeName ?? entry.company?.legalName ?? null;
}

function partyOf(entry: FinancialEntry): string | null {
  const party = entry.supplier ?? entry.customer;
  return party?.tradeName ?? party?.legalName ?? null;
}
