"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useApprovalActions, useApprovals } from "@/lib/api/approvals";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  type ApprovalRequest,
  type ApprovalRequestStatus,
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

export default function FilaPage() {
  // Os cartões do painel entram na fila já filtrados, então os filtros iniciais vêm da URL.
  return (
    <React.Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <Fila />
    </React.Suspense>
  );
}

/**
 * Tela principal das autorizações (seções 8 e 12).
 *
 * A tabela do desktop tem as doze colunas da seção 8. No celular vira lista de cartões, com
 * o botão de aprovar ao alcance do polegar — quem aprova no celular aprova em pé, no meio de
 * outra coisa (seção 13).
 */
function Fila() {
  const searchParams = useSearchParams();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState(
    searchParams.get("status") ?? "IN_PROGRESS",
  );
  const [priority, setPriority] = React.useState(
    searchParams.get("priority") ?? "all",
  );
  const [overdue, setOverdue] = React.useState(
    searchParams.get("overdue") === "true",
  );
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [batchResult, setBatchResult] = React.useState<{
    succeeded: number;
    failed: { id: string; reason: string }[];
  } | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  const { data, isLoading } = useApprovals({
    organizationId,
    companyId: selectedCompanyId ?? undefined,
    search: search || undefined,
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    overdue: overdue || undefined,
    assignedToUserId: onlyMine ? user?.id : undefined,
    page,
    perPage: 25,
  });

  const actions = useApprovalActions();
  const requests = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  const canApprove = hasPermission("approvals.approve");
  const canReject = hasPermission("approvals.reject");

  const allSelected =
    requests.length > 0 && requests.every((item) => selected.has(item.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBatch(action: "APPROVE" | "REJECT") {
    const ids = [...selected];
    if (ids.length === 0) return;

    const reason =
      action === "REJECT"
        ? window.prompt(
            `Informe o motivo da reprovação das ${ids.length} solicitações selecionadas.`,
          )
        : null;

    if (action === "REJECT" && !reason?.trim()) return;

    // Resumo antes de confirmar (seção 12): o total em dinheiro é o que faz alguém parar.
    const total = requests
      .filter((item) => selected.has(item.id))
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const confirmed = window.confirm(
      `${action === "APPROVE" ? "Aprovar" : "Reprovar"} ${ids.length} solicitação(ões), somando ${formatCurrencyBRL(total)}?\n\n` +
        "Cada uma é tratada isoladamente: as que não passarem na alçada serão listadas ao final.",
    );

    if (!confirmed) return;

    setFailure(null);
    actions.batch.mutate(
      {
        requestIds: ids,
        action,
        ...(reason ? { reason: reason.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          setBatchResult(result);
          setSelected(new Set());
        },
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error
              ? caught.message
              : "Não foi possível concluir a ação em lote.",
          ),
      },
    );
  }

  function reset<Value>(setter: (value: Value) => void) {
    return (value: Value) => {
      setter(value);
      setPage(1);
      setSelected(new Set());
    };
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/autorizacoes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Fila de autorizações</h1>
          <p className="text-xs text-muted-foreground">
            Urgentes primeiro, depois o que vence antes.
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

      {batchResult && (
        <Alert variant={batchResult.failed.length > 0 ? "destructive" : "default"}>
          <AlertTitle>
            {batchResult.succeeded} solicitação(ões) concluída(s)
            {batchResult.failed.length > 0 &&
              `, ${batchResult.failed.length} não`}
          </AlertTitle>
          {batchResult.failed.length > 0 && (
            <AlertDescription>
              <ul className="list-inside list-disc">
                {batchResult.failed.map((item) => (
                  <li key={item.id}>{item.reason}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Número ou descrição do lançamento…"
                value={search}
                onChange={(event) => reset(setSearch)(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Situação</Label>
            <Select value={status} onValueChange={reset(setStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={reset(setPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={overdue}
                onCheckedChange={(value) => reset(setOverdue)(value === true)}
              />
              Só as vencidas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={onlyMine}
                onCheckedChange={(value) => reset(setOnlyMine)(value === true)}
              />
              Designadas a mim
            </label>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-sm font-medium">
              {selected.size} selecionada(s)
            </span>
            {canApprove && (
              <Button
                size="sm"
                disabled={actions.batch.isPending}
                onClick={() => runBatch("APPROVE")}
              >
                {actions.batch.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Aprovar em lote
              </Button>
            )}
            {canReject && (
              <Button
                size="sm"
                variant="destructive"
                disabled={actions.batch.isPending}
                onClick={() => runBatch("REJECT")}
              >
                <Ban className="size-4" />
                Reprovar em lote
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Limpar seleção
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nada aguardando decisão</p>
            <p className="text-sm text-muted-foreground">
              Nenhuma solicitação nos filtros escolhidos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(value) =>
                        setSelected(
                          value === true
                            ? new Set(requests.map((item) => item.id))
                            : new Set(),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Fluxo</TableHead>
                  <TableHead>Etapa atual</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Data limite</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(request.id)}
                        onCheckedChange={() => toggle(request.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/financeiro/autorizacoes/${request.id}`}
                        className="font-medium hover:underline"
                      >
                        {request.entry?.documentNumber ??
                          request.entry?.description ??
                          "Sem número"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.company?.tradeName ??
                        request.company?.legalName ??
                        "—"}
                    </TableCell>
                    <TableCell className="text-sm">{partyOf(request)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCurrencyBRL(Number(request.amount))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.flow?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {currentStepOf(request)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[request.status]}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.dueAt ? (
                        <span
                          className={
                            new Date(request.dueAt) < new Date()
                              ? "text-destructive"
                              : undefined
                          }
                        >
                          {formatDateTimeBR(request.dueAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.priority === "URGENT" ||
                          request.priority === "HIGH"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {PRIORITY_LABELS[request.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/financeiro/autorizacoes/${request.id}`}>
                          Abrir
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-2 xl:hidden">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex flex-col gap-2 py-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selected.has(request.id)}
                      onCheckedChange={() => toggle(request.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/financeiro/autorizacoes/${request.id}`}
                        className="font-medium hover:underline"
                      >
                        {request.entry?.documentNumber ??
                          request.entry?.description ??
                          "Sem número"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {partyOf(request)} ·{" "}
                        {request.company?.tradeName ??
                          request.company?.legalName ??
                          ""}
                      </p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrencyBRL(Number(request.amount))}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS_VARIANT[request.status]}>
                      {REQUEST_STATUS_LABELS[request.status]}
                    </Badge>
                    <Badge variant="outline">
                      {PRIORITY_LABELS[request.priority]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {currentStepOf(request)}
                    </span>
                  </div>

                  {/* Aprovação rápida no celular: o botão principal ocupa a largura toda. */}
                  <Button size="sm" asChild className="w-full">
                    <Link href={`/financeiro/autorizacoes/${request.id}`}>
                      Analisar e decidir
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data?.meta.total ?? 0} solicitação(ões) · página {page} de{" "}
              {totalPages}
            </p>
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
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function partyOf(request: ApprovalRequest): string {
  const party = request.entry?.supplier ?? request.entry?.customer;
  return party?.tradeName ?? party?.legalName ?? "—";
}

/** Etapa em andamento e quem falta assinar, quando a etapa exige mais de uma assinatura. */
function currentStepOf(request: ApprovalRequest): string {
  const step = (request.steps ?? []).find(
    (item) => item.stepOrder === request.currentStepOrder,
  );

  if (!step) return "—";

  return step.requiredApprovals > 1
    ? `${step.name} (${step.approvalsGiven}/${step.requiredApprovals})`
    : step.name;
}
