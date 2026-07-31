"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  Coins,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Percent,
  RotateCcw,
  Undo2,
  Unlock,
  Wallet,
  XCircle,
} from "lucide-react";

import {
  useAccountsPayableDetail,
  useLateCharges,
  usePayableActions,
  usePayableComments,
  usePayableHistory,
  useReverseAdjustment,
  useReversePayment,
} from "@/lib/api/accounts-payable";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import {
  ADJUSTMENT_SOURCE_LABELS,
  ADJUSTMENT_TYPE_LABELS,
  BLOCK_REASON_LABELS,
  HISTORY_ACTION_LABELS,
  PRIORITY_LABELS,
  SITUATION_HINTS,
  SITUATION_LABELS,
  SITUATION_TONES,
  TAX_LABELS,
  displayNameOf,
  type AdjustmentType,
  type BlockReason,
} from "@/types/accounts-payable";

type Panel =
  | "payment"
  | "adjustment"
  | "schedule"
  | "block"
  | "unblock"
  | "renegotiate"
  | "cancel"
  | "reopen"
  | "comment"
  | null;

export default function TituloPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data: payable, isLoading } = useAccountsPayableDetail(id);
  const { data: history } = usePayableHistory(id);
  const { data: comments } = usePayableComments(id);
  const actions = usePayableActions(id);
  const reversePayment = useReversePayment();
  const reverseAdjustment = useReverseAdjustment();

  const [panel, setPanel] = React.useState<Panel>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [showCharges, setShowCharges] = React.useState(false);

  const { data: charges } = useLateCharges(id, showCharges);

  if (isLoading || !payable) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const blocked = Boolean(payable.activeBlock);
  const openBalance = Number(payable.balanceAmount);

  const canPay = hasPermission("accounts_payable.partial_payment") && !blocked;
  const canEdit = hasPermission("accounts_payable.edit") && !blocked;

  function onError(caught: unknown, fallback: string) {
    setFailure(caught instanceof Error ? caught.message : fallback);
  }

  function close() {
    setPanel(null);
    setFailure(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar aos títulos">
          <Link href="/financeiro/contas-a-pagar/titulos">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {payable.code}
            <Badge variant={SITUATION_TONES[payable.situation]}>
              {SITUATION_LABELS[payable.situation]}
            </Badge>
            {payable.priority !== "NORMAL" && (
              <Badge variant="outline">{PRIORITY_LABELS[payable.priority]}</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {SITUATION_HINTS[payable.situation]}
          </p>
        </div>
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {payable.activeBlock && (
        <Alert variant="destructive">
          <Ban />
          <AlertTitle>
            Título bloqueado — {BLOCK_REASON_LABELS[payable.activeBlock.reason]}
          </AlertTitle>
          <AlertDescription>
            {payable.activeBlock.description ??
              "Sem descrição."}{" "}
            Bloqueado em {formatDateTimeBR(payable.activeBlock.blockedAt)}. Enquanto o
            bloqueio existir, o título não recebe baixa nem segue para agendamento bancário.
          </AlertDescription>
        </Alert>
      )}

      {payable.isOverdue && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Vencido há {payable.overdueDays} dia(s)</AlertTitle>
          <AlertDescription>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => setShowCharges(true)}
            >
              Ver juros e multa sugeridos
            </Button>{" "}
            — a prévia não grava nada; quem aplica é você.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Resumo financeiro ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Amount label="Valor original" value={payable.originalAmount} />
        <Amount label="Valor líquido" value={payable.netAmount} />
        <Amount label="Pago" value={payable.paidAmount} />
        <Amount label="Saldo" value={payable.balanceAmount} emphasis />
      </div>

      {(Number(payable.interestAmount) > 0 ||
        Number(payable.penaltyAmount) > 0 ||
        Number(payable.discountAmount) > 0 ||
        Number(payable.withholdingAmount) > 0 ||
        Number(payable.advanceAmount) > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Amount label="Juros" value={payable.interestAmount} />
          <Amount label="Multa" value={payable.penaltyAmount} />
          <Amount label="Descontos" value={payable.discountAmount} />
          <Amount label="Retenções" value={payable.withholdingAmount} />
          <Amount label="Adiantamentos" value={payable.advanceAmount} />
        </div>
      )}

      {/* ── Ações ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {canPay && openBalance > 0 && (
          <Button onClick={() => setPanel("payment")}>
            <Wallet className="size-4" />
            Registrar pagamento
          </Button>
        )}
        {canEdit && openBalance > 0 && (
          <Button variant="outline" onClick={() => setPanel("schedule")}>
            <CalendarClock className="size-4" />
            Programar pagamento
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" onClick={() => setPanel("adjustment")}>
            <Percent className="size-4" />
            Lançar ajuste
          </Button>
        )}
        {hasPermission("accounts_payable.renegotiate") && !blocked && openBalance > 0 && (
          <Button variant="outline" onClick={() => setPanel("renegotiate")}>
            <RotateCcw className="size-4" />
            Renegociar
          </Button>
        )}
        {hasPermission("accounts_payable.block") && !blocked && (
          <Button variant="outline" onClick={() => setPanel("block")}>
            <Ban className="size-4" />
            Bloquear
          </Button>
        )}
        {hasPermission("accounts_payable.unblock") && blocked && (
          <Button variant="outline" onClick={() => setPanel("unblock")}>
            <Unlock className="size-4" />
            Liberar bloqueio
          </Button>
        )}
        {hasPermission("accounts_payable.cancel") && payable.status !== "CANCELLED" && (
          <Button variant="outline" onClick={() => setPanel("cancel")}>
            <XCircle className="size-4" />
            Cancelar título
          </Button>
        )}
        {hasPermission("accounts_payable.reopen") && payable.status === "CANCELLED" && (
          <Button variant="outline" onClick={() => setPanel("reopen")}>
            <Undo2 className="size-4" />
            Reabrir
          </Button>
        )}
        <Button variant="ghost" onClick={() => setPanel("comment")}>
          <MessageSquare className="size-4" />
          Comentar
        </Button>
      </div>

      {/* ── Painéis de ação ─────────────────────────────────────────────── */}
      {panel === "payment" && (
        <PaymentPanel
          payable={payable}
          pending={actions.partialPayment.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.partialPayment.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível registrar."),
            })
          }
        />
      )}

      {panel === "adjustment" && (
        <AdjustmentPanel
          pending={actions.adjust.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.adjust.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível aplicar o ajuste."),
            })
          }
        />
      )}

      {panel === "schedule" && (
        <SimplePanel
          title="Programar pagamento"
          hint="A programação vale dentro do Pulse. Nada é enviado ao banco — isso é do módulo de Agendamento Bancário."
          fields={[{ key: "scheduledPaymentDate", label: "Data do pagamento", type: "date" }]}
          submitLabel="Programar"
          pending={actions.schedule.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.schedule.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível programar."),
            })
          }
        />
      )}

      {panel === "block" && (
        <BlockPanel
          pending={actions.block.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.block.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível bloquear."),
            })
          }
        />
      )}

      {panel === "unblock" && (
        <SimplePanel
          title="Liberar bloqueio"
          hint="O bloqueio some da fila, mas continua no histórico do título."
          fields={[{ key: "releaseReason", label: "Motivo da liberação", type: "text" }]}
          submitLabel="Liberar"
          pending={actions.unblock.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.unblock.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível liberar."),
            })
          }
        />
      )}

      {panel === "cancel" && (
        <SimplePanel
          title="Cancelar título"
          hint="O registro permanece. Um título com pagamento registrado precisa ter os pagamentos estornados antes."
          fields={[{ key: "reason", label: "Motivo do cancelamento", type: "text" }]}
          submitLabel="Cancelar título"
          pending={actions.cancel.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.cancel.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível cancelar."),
            })
          }
        />
      )}

      {panel === "reopen" && (
        <SimplePanel
          title="Reabrir título"
          hint="As parcelas canceladas voltam a ficar em aberto."
          fields={[{ key: "reason", label: "Motivo da reabertura", type: "text" }]}
          submitLabel="Reabrir"
          pending={actions.reopen.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.reopen.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível reabrir."),
            })
          }
        />
      )}

      {panel === "renegotiate" && (
        <RenegotiatePanel
          balance={openBalance}
          pending={actions.renegotiate.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.renegotiate.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível renegociar."),
            })
          }
        />
      )}

      {panel === "comment" && (
        <SimplePanel
          title="Comentar"
          fields={[{ key: "body", label: "Comentário", type: "textarea" }]}
          submitLabel="Comentar"
          pending={actions.comment.isPending}
          onCancel={close}
          onSubmit={(payload) =>
            actions.comment.mutate(payload, {
              onSuccess: close,
              onError: (caught) => onError(caught, "Não foi possível comentar."),
            })
          }
        />
      )}

      {showCharges && charges && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Juros e multa sugeridos — memória de cálculo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Juros de {charges.monthlyRate}% ao mês e multa de {charges.penaltyRate}%,
              com {charges.gracePeriodDays} dia(s) de tolerância. Nada foi gravado: use
              &ldquo;Lançar ajuste&rdquo; para aplicar.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Dias em atraso</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Multa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.lines.map((line) => (
                  <TableRow key={line.installmentId}>
                    <TableCell>{line.installmentNumber}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.overdueDays}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(line.interest)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(line.penalty)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="ghost" size="sm" onClick={() => setShowCharges(false)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Dados do título ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dados do título</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Fornecedor" value={displayNameOf(payable.supplier)} />
          <Info label="Empresa" value={displayNameOf(payable.company)} />
          <Info label="Documento" value={payable.documentNumber ?? "—"} />
          <Info label="Série" value={payable.documentSeries ?? "—"} />
          <Info
            label="Emissão"
            value={payable.issueDate ? formatDateBR(payable.issueDate) : "—"}
          />
          <Info
            label="Competência"
            value={
              payable.competenceDate ? formatDateBR(payable.competenceDate) : "—"
            }
          />
          <Info label="Vencimento" value={formatDateBR(payable.dueDate)} />
          <Info label="Descrição" value={payable.description ?? "—"} />
          <Info label="Linha digitável" value={payable.digitableLine ?? "—"} />
          <Info label="Código de barras" value={payable.barcode ?? "—"} />
          <Info label="Chave PIX" value={payable.pixKey ?? "—"} />
          <Info
            label="Pedido de compra"
            value={payable.purchaseOrderNumber ?? "—"}
          />
        </CardContent>
      </Card>

      {/* ── Origem ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Origem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {payable.sourceIntakeDocumentId && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/financeiro/entrada-documentos/${payable.sourceIntakeDocumentId}`}
              >
                Documento original
              </Link>
            </Button>
          )}
          {payable.entryId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/financeiro/lancamentos/${payable.entryId}`}>
                Pré-lançamento
              </Link>
            </Button>
          )}
          {payable.approvalRequestId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/financeiro/autorizacoes/${payable.approvalRequestId}`}>
                Aprovação
              </Link>
            </Button>
          )}
          {!payable.sourceIntakeDocumentId && !payable.entryId && (
            <p className="text-sm text-muted-foreground">
              Título criado manualmente, sem documento de origem.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Parcelas ────────────────────────────────────────────────────── */}
      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Parcelas ({payable.installments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payable.installments.map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell>{installment.installmentNumber}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateBR(installment.dueDate)}
                    {installment.dueDate !== installment.originalDueDate && (
                      <p className="text-xs text-muted-foreground">
                        original: {formatDateBR(installment.originalDueDate)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrencyBRL(Number(installment.netAmount))}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrencyBRL(Number(installment.paidAmount))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatCurrencyBRL(Number(installment.balanceAmount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SITUATION_TONES[installment.status]}>
                      {SITUATION_LABELS[installment.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Retenções ───────────────────────────────────────────────────── */}
      {payable.withholdings.length > 0 && (
        <Card className="overflow-x-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Retenções</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tributo</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payable.withholdings.map((withholding) => (
                  <TableRow key={withholding.id}>
                    <TableCell>{TAX_LABELS[withholding.taxType]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(Number(withholding.calculationBase))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(withholding.rate)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(Number(withholding.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Pagamentos e ajustes ────────────────────────────────────────── */}
      {payable.payments.length > 0 && (
        <Card className="overflow-x-auto">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="size-4" />
              Pagamentos registrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Abatido</TableHead>
                  <TableHead className="text-right">Saiu do caixa</TableHead>
                  <TableHead>Comprovante</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payable.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {formatDateBR(payment.paidAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(Number(payment.amount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(Number(payment.settledAmount))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {payment.receiptNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={payment.status === "ACTIVE" ? "default" : "outline"}
                      >
                        {payment.status === "ACTIVE" ? "Ativo" : "Estornado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status === "ACTIVE" &&
                        hasPermission("accounts_payable.partial_payment") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const reason = window.prompt("Motivo do estorno:");
                              if (!reason) return;
                              setFailure(null);
                              reversePayment.mutate(
                                { paymentId: payment.id, reason },
                                {
                                  onError: (caught) =>
                                    onError(caught, "Não foi possível estornar."),
                                },
                              );
                            }}
                          >
                            Estornar
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {payable.adjustments.length > 0 && (
        <Card className="overflow-x-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Juros, multa e descontos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Memória de cálculo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payable.adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>{ADJUSTMENT_TYPE_LABELS[adjustment.type]}</TableCell>
                    <TableCell className="text-sm">
                      {ADJUSTMENT_SOURCE_LABELS[adjustment.source]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(Number(adjustment.amount))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {adjustment.calculationBase
                        ? `${formatCurrencyBRL(Number(adjustment.calculationBase))} × ${Number(adjustment.rate ?? 0)}%${
                            adjustment.overdueDays
                              ? ` · ${adjustment.overdueDays} dia(s)`
                              : ""
                          }`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{adjustment.reason ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {adjustment.status === "ACTIVE" &&
                        hasPermission("accounts_payable.edit") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const reason = window.prompt("Motivo do estorno:");
                              if (!reason) return;
                              setFailure(null);
                              reverseAdjustment.mutate(
                                { adjustmentId: adjustment.id, reason },
                                {
                                  onError: (caught) =>
                                    onError(caught, "Não foi possível estornar."),
                                },
                              );
                            }}
                          >
                            Estornar
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Renegociações ───────────────────────────────────────────────── */}
      {payable.renegotiations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Renegociações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {payable.renegotiations.map((renegotiation) => (
              <div key={renegotiation.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{renegotiation.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(renegotiation.effectiveAt)} ·{" "}
                  {formatCurrencyBRL(Number(renegotiation.previousNetAmount))} →{" "}
                  {formatCurrencyBRL(Number(renegotiation.newNetAmount))}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cronograma anterior:{" "}
                  {renegotiation.previousSchedule
                    .map(
                      (line) =>
                        `${line.installmentNumber}) ${formatDateBR(line.dueDate)} — ${formatCurrencyBRL(line.netAmount)}`,
                    )
                    .join(" · ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Comentários ─────────────────────────────────────────────────── */}
      {comments && comments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comentários</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border p-3">
                <p className="text-sm">{comment.body}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTimeBR(comment.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Histórico ───────────────────────────────────────────────────── */}
      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Justificativa</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">
                    {formatDateTimeBR(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {HISTORY_ACTION_LABELS[entry.action]}
                    {entry.field && (
                      <p className="text-xs text-muted-foreground">{entry.field}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{entry.previousValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.newValue ?? "—"}</TableCell>
                  <TableCell className="text-xs">{entry.justification ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Componentes de apoio ─────────────────────────────────────────────────────

function Amount({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`tabular-nums ${emphasis ? "text-xl font-semibold" : "text-lg font-medium"}`}
        >
          {formatCurrencyBRL(Number(value))}
        </p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}

function PaymentPanel({
  payable,
  pending,
  onCancel,
  onSubmit,
}: {
  payable: { balanceAmount: string; installments: { id: string; installmentNumber: number; balanceAmount: string; dueDate: string }[] };
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const openInstallments = payable.installments.filter(
    (installment) => Number(installment.balanceAmount) > 0,
  );

  const [installmentId, setInstallmentId] = React.useState(ALL_INSTALLMENTS);
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [interest, setInterest] = React.useState("");
  const [penalty, setPenalty] = React.useState("");
  const [discount, setDiscount] = React.useState("");
  const [receiptNumber, setReceiptNumber] = React.useState("");

  const balance =
    installmentId === ALL_INSTALLMENTS
      ? Number(payable.balanceAmount)
      : Number(
          openInstallments.find((installment) => installment.id === installmentId)
            ?.balanceAmount ?? 0,
        );

  const settled =
    Number(amount || 0) + Number(interest || 0) + Number(penalty || 0) - Number(discount || 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Registrar pagamento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Parcela" hint="Sem escolher, o valor é aplicado da mais antiga em diante.">
          <Select value={installmentId} onValueChange={setInstallmentId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_INSTALLMENTS}>Distribuir pelas parcelas</SelectItem>
              {openInstallments.map((installment) => (
                <SelectItem key={installment.id} value={installment.id}>
                  {installment.installmentNumber} — {formatDateBR(installment.dueDate)} —{" "}
                  {formatCurrencyBRL(Number(installment.balanceAmount))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Valor abatido (R$)"
          required
          hint={`Saldo disponível: ${formatCurrencyBRL(balance)}`}
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label="Data do pagamento" required>
          <Input
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
          />
        </Field>

        <Field label="Juros pagos (R$)">
          <Input
            inputMode="decimal"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
          />
        </Field>

        <Field label="Multa paga (R$)">
          <Input
            inputMode="decimal"
            value={penalty}
            onChange={(event) => setPenalty(event.target.value)}
          />
        </Field>

        <Field label="Desconto obtido (R$)">
          <Input
            inputMode="decimal"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </Field>

        <Field label="Comprovante">
          <Input
            value={receiptNumber}
            onChange={(event) => setReceiptNumber(event.target.value)}
          />
        </Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <Alert>
            <AlertTitle>
              Saiu do caixa: {formatCurrencyBRL(settled)}
            </AlertTitle>
            <AlertDescription>
              Abatido do saldo: {formatCurrencyBRL(Number(amount || 0))}. Registrar a baixa
              não executa o pagamento — o envio ao banco é do módulo de Pagamentos.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <Button
            disabled={!amount || Number(amount) <= 0 || pending}
            onClick={() =>
              onSubmit({
                ...(installmentId !== ALL_INSTALLMENTS ? { installmentId } : {}),
                amount: Number(amount),
                paidAt,
                ...(interest ? { interestAmount: Number(interest) } : {}),
                ...(penalty ? { penaltyAmount: Number(penalty) } : {}),
                ...(discount ? { discountAmount: Number(discount) } : {}),
                ...(receiptNumber ? { receiptNumber } : {}),
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Registrar pagamento
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const ALL_INSTALLMENTS = "__spread__";

function AdjustmentPanel({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [type, setType] = React.useState<AdjustmentType>("INTEREST");
  const [amount, setAmount] = React.useState("");
  const [calculationBase, setCalculationBase] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [overdueDays, setOverdueDays] = React.useState("");
  const [reason, setReason] = React.useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Lançar ajuste</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Tipo">
          <Select value={type} onValueChange={(value) => setType(value as AdjustmentType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ADJUSTMENT_TYPE_LABELS) as AdjustmentType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {ADJUSTMENT_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Valor (R$)" required>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label="Base de cálculo (R$)" hint="Aparece na memória de cálculo.">
          <Input
            inputMode="decimal"
            value={calculationBase}
            onChange={(event) => setCalculationBase(event.target.value)}
          />
        </Field>

        <Field label="Percentual aplicado">
          <Input
            inputMode="decimal"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>

        <Field label="Dias em atraso">
          <Input
            type="number"
            min={0}
            value={overdueDays}
            onChange={(event) => setOverdueDays(event.target.value)}
          />
        </Field>

        <Field label="Motivo" required>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <Button
            disabled={!amount || !reason || pending}
            onClick={() =>
              onSubmit({
                type,
                amount: Number(amount),
                ...(calculationBase ? { calculationBase: Number(calculationBase) } : {}),
                ...(rate ? { rate: Number(rate) } : {}),
                ...(overdueDays ? { overdueDays: Number(overdueDays) } : {}),
                reason,
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Aplicar ajuste
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BlockPanel({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [reason, setReason] = React.useState<BlockReason>("DOCUMENT_PENDING");
  const [description, setDescription] = React.useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bloquear título</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Motivo">
          <Select value={reason} onValueChange={(value) => setReason(value as BlockReason)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BLOCK_REASON_LABELS) as BlockReason[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {BLOCK_REASON_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Descrição">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="flex gap-2 sm:col-span-2">
          <Button
            disabled={pending}
            onClick={() => onSubmit({ reason, ...(description ? { description } : {}) })}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Bloquear
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RenegotiatePanel({
  balance,
  pending,
  onCancel,
  onSubmit,
}: {
  balance: number;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [count, setCount] = React.useState(2);
  const [firstDueDate, setFirstDueDate] = React.useState("");
  const [interestAdded, setInterestAdded] = React.useState("");
  const [penaltyAdded, setPenaltyAdded] = React.useState("");
  const [discountGranted, setDiscountGranted] = React.useState("");
  const [reason, setReason] = React.useState("");

  const total =
    Math.round(
      (balance + Number(interestAdded || 0) + Number(penaltyAdded || 0) -
        Number(discountGranted || 0)) *
        100,
    ) / 100;

  // Mesma convenção do resto do sistema: a sobra do arredondamento vai na última parcela,
  // senão a soma não fecha com o acordo e o back-end recusa.
  const installments = React.useMemo(() => {
    if (!firstDueDate || count < 1) return [];

    const totalCents = Math.round(total * 100);
    const base = Math.floor(totalCents / count);
    const remainder = totalCents - base * count;
    const first = new Date(firstDueDate);

    return Array.from({ length: count }, (_, index) => {
      const due = new Date(first);
      due.setUTCMonth(due.getUTCMonth() + index);

      return {
        installmentNumber: index + 1,
        dueDate: due.toISOString().slice(0, 10),
        amount: (index === count - 1 ? base + remainder : base) / 100,
      };
    });
  }, [firstDueDate, count, total]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Renegociar título</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Número de parcelas" required>
          <Input
            type="number"
            min={1}
            max={120}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </Field>

        <Field label="Primeiro vencimento" required>
          <Input
            type="date"
            value={firstDueDate}
            onChange={(event) => setFirstDueDate(event.target.value)}
          />
        </Field>

        <Field label="Juros incluídos (R$)">
          <Input
            inputMode="decimal"
            value={interestAdded}
            onChange={(event) => setInterestAdded(event.target.value)}
          />
        </Field>

        <Field label="Multa incluída (R$)">
          <Input
            inputMode="decimal"
            value={penaltyAdded}
            onChange={(event) => setPenaltyAdded(event.target.value)}
          />
        </Field>

        <Field label="Desconto concedido (R$)">
          <Input
            inputMode="decimal"
            value={discountGranted}
            onChange={(event) => setDiscountGranted(event.target.value)}
          />
        </Field>

        <Field label="Motivo" required>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <Alert>
            <AlertTitle>
              Saldo atual {formatCurrencyBRL(balance)} → novo total{" "}
              {formatCurrencyBRL(total)}
            </AlertTitle>
            <AlertDescription>
              {installments.length > 0
                ? installments
                    .map(
                      (installment) =>
                        `${installment.installmentNumber}) ${formatDateBR(installment.dueDate)} — ${formatCurrencyBRL(installment.amount)}`,
                    )
                    .join(" · ")
                : "Informe o primeiro vencimento para ver o novo cronograma."}
              <br />O cronograma anterior fica guardado no histórico do título.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <Button
            disabled={installments.length === 0 || !reason || pending}
            onClick={() =>
              onSubmit({
                installments,
                reason,
                ...(interestAdded ? { interestAdded: Number(interestAdded) } : {}),
                ...(penaltyAdded ? { penaltyAdded: Number(penaltyAdded) } : {}),
                ...(discountGranted ? { discountGranted: Number(discountGranted) } : {}),
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Renegociar
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SimplePanel({
  title,
  hint,
  fields,
  submitLabel,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string;
  hint?: string;
  fields: { key: string; label: string; type: "text" | "date" | "textarea" }[];
  submitLabel: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const complete = fields.every((field) => values[field.key]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

        {fields.map((field) => (
          <Field key={field.key} label={field.label} required>
            {field.type === "textarea" ? (
              <Textarea
                rows={4}
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            ) : (
              <Input
                type={field.type === "date" ? "date" : "text"}
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            )}
          </Field>
        ))}

        <div className="flex gap-2">
          <Button disabled={!complete || pending} onClick={() => onSubmit(values)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
