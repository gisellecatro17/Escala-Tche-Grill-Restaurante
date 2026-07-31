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
  FileQuestion,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import {
  useApproval,
  useApprovalActions,
  useApprovalComments,
  useApprovalHistory,
} from "@/lib/api/approvals";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTION_LABELS,
  APPROVER_TYPE_LABELS,
  PRIORITY_LABELS,
  REQUEST_STATUS_HINTS,
  REQUEST_STATUS_LABELS,
  STEP_STATUS_LABELS,
  formatDuration,
  type ApprovalRequestStatus,
  type ApprovalStepStatus,
} from "@/types/approvals";

const STATUS_VARIANT: Record<
  ApprovalRequestStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "outline",
  IN_PROGRESS: "default",
  APPROVED: "secondary",
  REJECTED: "destructive",
  WAITING_INFORMATION: "outline",
  CANCELLED: "destructive",
  EXPIRED: "destructive",
};

const STEP_VARIANT: Record<
  ApprovalStepStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "outline",
  IN_PROGRESS: "default",
  APPROVED: "secondary",
  REJECTED: "destructive",
  WAITING_INFORMATION: "outline",
  SKIPPED: "outline",
};

const LIVE: ApprovalRequestStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "WAITING_INFORMATION",
];

/**
 * Tela da solicitação de aprovação (seções 9 e 10).
 *
 * As nove ações da seção 9 ficam no cabeçalho, cada uma sob a sua permissão e só quando a
 * situação da solicitação as permite. Um botão que sempre aparece e às vezes falha ensina o
 * usuário a ignorar mensagens de erro.
 */
export default function AutorizacaoPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useSession();

  const { data: request, isLoading } = useApproval(id);
  const { data: comments } = useApprovalComments(id);
  const canAudit = hasPermission("approvals.audit");
  const { data: history } = useApprovalHistory(id, canAudit);
  const actions = useApprovalActions();

  const [commentText, setCommentText] = React.useState("");
  const [failure, setFailure] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Solicitação não encontrada</AlertTitle>
          <AlertDescription>
            Ela pode ter sido excluída ou pertencer a uma empresa à qual você não tem
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

  function withReason(prompt: string, work: (reason: string) => Promise<unknown>) {
    const reason = window.prompt(prompt);
    if (!reason?.trim()) return;
    run(() => work(reason.trim()));
  }

  const isLive = LIVE.includes(request.status);
  const currentStep = (request.steps ?? []).find(
    (step) => step.stepOrder === request.currentStepOrder,
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar à fila">
          <Link href="/financeiro/autorizacoes/fila">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {request.entry?.documentNumber
              ? `Autorização do documento nº ${request.entry.documentNumber}`
              : "Autorização"}
            <Badge variant={STATUS_VARIANT[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
            <Badge variant="outline">{PRIORITY_LABELS[request.priority]}</Badge>
            {request.attempt > 1 && (
              <Badge variant="secondary">{request.attempt}ª tentativa</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {REQUEST_STATUS_HINTS[request.status]}
          </p>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/financeiro/lancamentos/${request.entryId}`}>
            Ver lançamento
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {request.status === "REJECTED" && request.rejectionReason && (
        <Alert variant="destructive">
          <Ban />
          <AlertTitle>Reprovada</AlertTitle>
          <AlertDescription>{request.rejectionReason}</AlertDescription>
        </Alert>
      )}

      {request.status === "WAITING_INFORMATION" && (
        <Alert>
          <FileQuestion />
          <AlertTitle>Aguardando informações</AlertTitle>
          <AlertDescription>
            Alguém pediu ajuste ou documento. Responda no campo de comentários e retome a
            solicitação — o que já foi aprovado nas etapas anteriores não se perde.
          </AlertDescription>
        </Alert>
      )}

      {/* As nove ações da seção 9. */}
      <Card>
        <CardContent className="flex flex-wrap gap-2 py-3">
          {isLive && hasPermission("approvals.approve") && (
            <Button
              disabled={actions.approve.isPending}
              onClick={() =>
                run(() => actions.approve.mutateAsync({ id: request.id }))
              }
            >
              {actions.approve.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Aprovar
            </Button>
          )}

          {isLive && hasPermission("approvals.reject") && (
            <Button
              variant="destructive"
              onClick={() =>
                withReason("Informe o motivo da reprovação.", (reason) =>
                  actions.reject.mutateAsync({ id: request.id, reason }),
                )
              }
            >
              <Ban className="size-4" />
              Reprovar
            </Button>
          )}

          {isLive && hasPermission("approvals.approve") && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  withReason("O que precisa ser ajustado?", (reason) =>
                    actions.requestChanges.mutateAsync({ id: request.id, reason }),
                  )
                }
              >
                Solicitar ajuste
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  withReason("Quais documentos são necessários?", (reason) =>
                    actions.requestDocuments.mutateAsync({ id: request.id, reason }),
                  )
                }
              >
                <FileQuestion className="size-4" />
                Solicitar documentos
              </Button>
            </>
          )}

          {request.status === "WAITING_INFORMATION" && (
            <Button
              variant="outline"
              onClick={() =>
                run(() => actions.resume.mutateAsync({ id: request.id }))
              }
            >
              Retomar
            </Button>
          )}

          {isLive && hasPermission("approvals.delegate") && (
            <Button
              variant="outline"
              onClick={() => {
                const delegateId = window.prompt(
                  "Informe o id do usuário que assumirá esta etapa.",
                );
                if (!delegateId?.trim()) return;
                run(() =>
                  actions.delegate.mutateAsync({
                    id: request.id,
                    delegateId: delegateId.trim(),
                  }),
                );
              }}
            >
              <UserCheck className="size-4" />
              Delegar
            </Button>
          )}

          {isLive && (
            <Button
              variant="outline"
              onClick={() => {
                const userId = window.prompt(
                  "Informe o id do usuário a quem encaminhar para análise.",
                );
                if (!userId?.trim()) return;
                run(() =>
                  actions.forward.mutateAsync({
                    id: request.id,
                    userId: userId.trim(),
                  }),
                );
              }}
            >
              <Send className="size-4" />
              Encaminhar
            </Button>
          )}

          {isLive && hasPermission("approvals.manage") && (
            <Button
              variant="ghost"
              onClick={() =>
                withReason("Informe o motivo do cancelamento.", (reason) =>
                  actions.cancel.mutateAsync({ id: request.id, reason }),
                )
              }
            >
              <Ban className="size-4" />
              Cancelar fluxo
            </Button>
          )}

          {request.status !== "APPROVED" && hasPermission("approvals.manage") && (
            <Button
              variant="ghost"
              onClick={() =>
                withReason("Por que o fluxo será reiniciado?", (reason) =>
                  actions.restart.mutateAsync({ id: request.id, reason }),
                )
              }
            >
              <RotateCcw className="size-4" />
              Reiniciar fluxo
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Solicitação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info
              label="Valor"
              value={formatCurrencyBRL(Number(request.amount))}
              emphasis
            />
            <Info label="Fluxo" value={request.flow?.name ?? null} />
            <Info
              label="Empresa"
              value={
                request.company?.tradeName ?? request.company?.legalName ?? null
              }
            />
            <Info
              label="Fornecedor / cliente"
              value={
                request.entry?.supplier?.tradeName ??
                request.entry?.supplier?.legalName ??
                request.entry?.customer?.tradeName ??
                request.entry?.customer?.legalName ??
                null
              }
            />
            <Info label="Descrição" value={request.entry?.description ?? null} />
            <Info
              label="Etapa atual"
              value={currentStep ? currentStep.name : "Nenhuma"}
            />
            <Info
              label="Data limite"
              value={request.dueAt ? formatDateTimeBR(request.dueAt) : null}
            />
            <Info
              label="Tempo até a decisão"
              value={
                request.decisionSeconds === null
                  ? null
                  : formatDuration(request.decisionSeconds)
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Etapas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Aprovador</TableHead>
                  <TableHead>Assinaturas</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(request.steps ?? []).map((step) => (
                  <TableRow key={step.id}>
                    <TableCell className="tabular-nums">
                      {step.stepOrder}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{step.name}</p>
                      {!step.isMandatory && (
                        <p className="text-xs text-muted-foreground">
                          Não obrigatória
                        </p>
                      )}
                      {step.dueAt && (
                        <p className="text-xs text-muted-foreground">
                          até {formatDateTimeBR(step.dueAt)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {APPROVER_TYPE_LABELS[step.approverType]}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {step.approvalsGiven}/{step.requiredApprovals}
                      {step.actedOnBehalfOf && (
                        <p className="text-xs text-muted-foreground">
                          por delegação
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STEP_VARIANT[step.status]}>
                        {STEP_STATUS_LABELS[step.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              Etapas marcadas como dispensadas existem no fluxo, mas a alçada não as alcança
              neste valor.
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="comentarios">
        <TabsList>
          <TabsTrigger value="comentarios">
            Comentários
            {comments && comments.length > 0 && (
              <Badge variant="secondary">{comments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="comentarios">
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-col gap-2">
                <Textarea
                  rows={2}
                  placeholder="Escreva um comentário…"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                />
                <div>
                  <Button
                    size="sm"
                    disabled={!commentText.trim() || actions.comment.isPending}
                    onClick={() =>
                      run(async () => {
                        await actions.comment.mutateAsync({
                          id: request.id,
                          payload: {
                            text: commentText.trim(),
                            stepOrder: request.currentStepOrder ?? undefined,
                          },
                        });
                        setCommentText("");
                      })
                    }
                  >
                    <MessageSquare className="size-4" />
                    Comentar
                  </Button>
                </div>
              </div>

              {(comments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum comentário ainda.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(comments ?? []).map((comment) => (
                    <li key={comment.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTimeBR(comment.createdAt)}</span>
                        {comment.stepOrder !== null && (
                          <Badge variant="outline">
                            Etapa {comment.stepOrder}
                          </Badge>
                        )}
                        {comment.isDocumentRequest && (
                          <Badge variant="secondary">Pedido de documento</Badge>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {comment.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="py-4">
              {!canAudit ? (
                <p className="text-sm text-muted-foreground">
                  O histórico completo exige a permissão de auditoria das autorizações.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(history ?? []).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {formatDateTimeBR(entry.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ACTION_LABELS[entry.action]}
                          {entry.onBehalfOf && (
                            <span className="block text-xs text-muted-foreground">
                              por delegação
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.stepOrder ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Até onde a aprovação vai</AlertTitle>
        <AlertDescription>
          Aprovar autoriza a despesa a virar obrigação financeira. Autorização bancária,
          agendamento, remessa e pagamento são de módulos que ainda não existem.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Info({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | null;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasis ? "text-lg font-semibold tabular-nums" : "break-words text-sm"
        }
      >
        {value ?? "—"}
      </p>
    </div>
  );
}
