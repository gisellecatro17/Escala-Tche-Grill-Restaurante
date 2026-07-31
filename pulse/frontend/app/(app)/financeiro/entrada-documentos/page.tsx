"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Copy,
  FileInput,
  FileSpreadsheet,
  Info,
  Inbox,
  Keyboard,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";

import { useDocumentIntakeOverview } from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ISSUE_SEVERITY_LABELS,
  JOB_TYPE_LABELS,
  PROCESSING_STATUS_LABELS,
  SOURCE_CHANNEL_LABELS,
} from "@/types/document-intake";

/** Formata segundos em algo legível: "2 min", "1 h 15 min". */
function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toString().replace(".", ",")}%`;
}

/**
 * Visão geral da entrada de documentos (seção 6).
 *
 * Os cards levam direto para a caixa de entrada já filtrada — o operador chega na tela
 * sabendo o que precisa fazer e clica no número que quer resolver.
 */
export default function EntradaDocumentosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useDocumentIntakeOverview(organizationId, companyId);

  const cards = [
    {
      label: "Aguardando processamento",
      value: data?.cards.awaitingProcessing,
      href: "/financeiro/entrada-documentos/caixa-de-entrada?processingStatus=QUEUED",
      icon: Inbox,
      tone: "" as const,
    },
    {
      label: "Em processamento",
      value: data?.cards.processing,
      href: "/financeiro/entrada-documentos/processamento",
      icon: Loader2,
      tone: "" as const,
    },
    {
      label: "Com pendências",
      value: data?.cards.pendingReview,
      href: "/financeiro/entrada-documentos/pendencias",
      icon: AlertTriangle,
      tone: "border-amber-500/40" as const,
    },
    {
      label: "Possíveis duplicidades",
      value: data?.cards.possibleDuplicates,
      href: "/financeiro/entrada-documentos/duplicidades",
      icon: Copy,
      tone: "border-amber-500/40" as const,
    },
    {
      label: "Processados hoje",
      value: data?.cards.processedToday,
      href: "/financeiro/entrada-documentos/processados",
      icon: FileInput,
      tone: "" as const,
    },
    {
      label: "Com erro",
      value: data?.cards.withError,
      href: "/financeiro/entrada-documentos/erros",
      icon: XCircle,
      tone: "border-destructive/40" as const,
    },
  ];

  const shortcuts = [
    {
      label: "Enviar documentos",
      href: "/financeiro/entrada-documentos/enviar",
      icon: Plus,
      permission: "document_intake.upload",
      primary: true,
    },
    {
      label: "Importar planilha",
      href: "/financeiro/entrada-documentos/enviar?modo=lote",
      icon: FileSpreadsheet,
      permission: "document_intake.batch_upload",
    },
    {
      label: "Capturar com câmera",
      href: "/financeiro/entrada-documentos/enviar?modo=camera",
      icon: Camera,
      permission: "document_intake.capture",
    },
    {
      label: "Digitar documento",
      href: "/financeiro/entrada-documentos/enviar?modo=manual",
      icon: Keyboard,
      permission: "document_intake.manual_entry",
    },
    {
      label: "Consultar pendências",
      href: "/financeiro/entrada-documentos/pendencias",
      icon: AlertTriangle,
      permission: "document_intake.view",
    },
    {
      label: "Revisar duplicidades",
      href: "/financeiro/entrada-documentos/duplicidades",
      icon: Copy,
      permission: "document_intake.view",
    },
  ].filter((shortcut) => hasPermission(shortcut.permission));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entrada de Documentos</h1>
          <p className="text-sm text-muted-foreground">
            A porta de entrada documental do Pulse. Envie boletos, notas fiscais, faturas e
            comprovantes; o sistema lê, identifica e prepara para processamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shortcuts
            .filter((shortcut) => shortcut.primary)
            .map((shortcut) => (
              <Button key={shortcut.href} asChild>
                <Link href={shortcut.href}>
                  <shortcut.icon /> {shortcut.label}
                </Link>
              </Button>
            ))}
          <Button variant="outline" asChild>
            <Link href="/financeiro/entrada-documentos/caixa-de-entrada">
              <Inbox /> Caixa de entrada
            </Link>
          </Button>
        </div>
      </div>

      {!companyId && (
        <Alert>
          <Info />
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            Documentos pertencem a uma empresa. Sem empresa selecionada, os números somam
            toda a organização.
          </AlertDescription>
        </Alert>
      )}

      {data && data.cards.unassignedCompany > 0 && (
        <Alert className="border-amber-500/40">
          <AlertTriangle />
          <AlertTitle>
            {data.cards.unassignedCompany} documento(s) sem empresa identificada
          </AlertTitle>
          <AlertDescription>
            Esses documentos não podem ser encaminhados até que a empresa de destino seja
            definida.{" "}
            <Link
              href="/financeiro/entrada-documentos/caixa-de-entrada?unassignedCompany=true"
              className="underline"
            >
              Resolver agora
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="group">
            <Card className={`h-full transition-colors group-hover:border-primary/50 ${card.tone}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <card.icon className="size-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <span className="text-2xl font-semibold tabular-nums">
                    {card.value ?? 0}
                  </span>
                )}
                <span className="ml-1.5 text-xs text-muted-foreground">documentos</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {shortcuts.filter((shortcut) => !shortcut.primary).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {shortcuts
              .filter((shortcut) => !shortcut.primary)
              .map((shortcut) => (
                <Button key={shortcut.href} variant="outline" size="sm" asChild>
                  <Link href={shortcut.href}>
                    <shortcut.icon /> {shortcut.label}
                  </Link>
                </Button>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Indicadores</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <Indicator
                  label="Tempo médio de processamento"
                  value={formatDuration(data.indicators.averageProcessingSeconds)}
                />
                <Indicator
                  label="Documentos reconhecidos"
                  value={formatPercentage(data.indicators.recognizedPercentage)}
                  hint="Confiança de 75% ou mais"
                />
                <Indicator
                  label="Fornecedores identificados"
                  value={formatPercentage(data.indicators.supplierIdentifiedPercentage)}
                  hint="Sobre os documentos a pagar"
                />
                <Indicator
                  label="Com divergência"
                  value={formatPercentage(data.indicators.divergencePercentage)}
                  hint="Pendências bloqueantes abertas"
                />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fila de processamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Indicator label="Na fila" value={String(data.queue.pending)} />
                  <Indicator label="Executando" value={String(data.queue.running)} />
                  <Indicator label="Na fila de erro" value={String(data.queue.deadLetter)} />
                  <Indicator label="Cancelados" value={String(data.queue.cancelled)} />
                </dl>
                {data.queue.oldestPending && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Job mais antigo aguardando:{" "}
                    {JOB_TYPE_LABELS[data.queue.oldestPending.jobType]} desde{" "}
                    {formatDateTimeBR(data.queue.oldestPending.availableAt)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.keys(data.issues) as (keyof typeof data.issues)[]).map(
                    (severity) =>
                      data.issues[severity] > 0 && (
                        <Badge
                          key={severity}
                          variant={severity === "BLOCKING" ? "destructive" : "outline"}
                        >
                          {data.issues[severity]} {ISSUE_SEVERITY_LABELS[severity].toLowerCase()}
                        </Badge>
                      ),
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recebidos por canal</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.byChannel.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum documento recebido ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.byChannel
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <li key={row.channel} className="flex justify-between gap-2">
                      <span>{SOURCE_CHANNEL_LABELS[row.channel]}</span>
                      <span className="tabular-nums text-muted-foreground">{row.count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Erros recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma falha de processamento registrada.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.recentErrors.map((error) => (
                  <li key={error.id}>
                    <Link
                      href={`/financeiro/entrada-documentos/${error.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 hover:underline"
                    >
                      <span>{error.originalFileName ?? error.id}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeBR(error.receivedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data && data.lastBatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas importações</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {data.lastBatches.map((batch) => (
                <li
                  key={batch.id}
                  className="flex flex-wrap items-baseline gap-x-3 border-b pb-2 last:border-0"
                >
                  <span className="font-medium">{batch.batchName ?? "Lote"}</span>
                  <span className="text-xs text-muted-foreground">
                    {batch.validFiles} aceito(s)
                    {batch.invalidFiles > 0 && ` · ${batch.invalidFiles} recusado(s)`}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTimeBR(batch.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data && (
        <Alert>
          <Info />
          <AlertTitle>Sobre o encaminhamento</AlertTitle>
          <AlertDescription>{data.note}</AlertDescription>
        </Alert>
      )}

      {data && data.byStatus.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Situação dos documentos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {data.byStatus
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <Link
                  key={row.status}
                  href={`/financeiro/entrada-documentos/caixa-de-entrada?processingStatus=${row.status}`}
                >
                  <Badge variant="outline" className="hover:border-primary/50">
                    {PROCESSING_STATUS_LABELS[row.status]}: {row.count}
                  </Badge>
                </Link>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Indicator({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
