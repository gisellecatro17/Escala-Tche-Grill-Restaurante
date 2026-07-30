"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, History, RotateCcw, Upload } from "lucide-react";

import {
  useImportBatches,
  useRestoreVersion,
  useStructureVersions,
} from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
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
  HIERARCHY_ENTITY_LABELS,
  type StructureImportStatus,
} from "@/types/financial-structure";

const IMPORT_STATUS_LABELS: Record<StructureImportStatus, string> = {
  PENDING: "Aguardando",
  VALIDATED: "Validado",
  APPLIED: "Aplicado",
  REJECTED: "Recusado",
  FAILED: "Falhou",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Histórico da estrutura financeira (seção 47): versões da árvore, com restauração, e os
 * lotes de importação já processados.
 */
export default function HistoricoEstruturaPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const versions = useStructureVersions(organizationId, undefined, companyId);
  const batches = useImportBatches(organizationId);
  const restore = useRestoreVersion();

  const canRestore = hasPermission("financial_structure.manage_versions");

  async function handleRestore(id: string, label: string) {
    const reason = window.prompt(
      `Restaurar "${label}"? Informe o motivo — ele fica registrado na auditoria.\n\nRegistros criados depois da versão são preservados.`,
    );
    if (!reason?.trim()) return;
    await restore.mutateAsync({ id, reason: reason.trim() });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/cadastros/estrutura-financeira">
            <ArrowLeft /> Estrutura financeira
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Histórico da estrutura
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada movimentação de árvore e cada importação gera um snapshot. Restaurar não
          exclui nada: os registros criados depois da versão são preservados.
        </p>
      </div>

      <Tabs defaultValue="versoes">
        <TabsList>
          <TabsTrigger value="versoes">
            <History className="size-4" /> Versões
          </TabsTrigger>
          <TabsTrigger value="importacoes">
            <Upload className="size-4" /> Importações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="versoes">
          <Card>
            <CardHeader>
              <CardTitle>Versões das árvores</CardTitle>
            </CardHeader>
            <CardContent>
              {versions.isLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (versions.data?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma versão gravada ainda. A primeira aparece quando uma conta for
                  movida na árvore ou uma importação for aplicada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Nº</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Rótulo / motivo</TableHead>
                        <TableHead className="w-20 text-right">Itens</TableHead>
                        <TableHead className="w-36">Data</TableHead>
                        {canRestore && <TableHead className="w-28" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versions.data?.items.map((version) => (
                        <TableRow key={version.id}>
                          <TableCell className="tabular-nums">
                            {version.versionNumber}
                          </TableCell>
                          <TableCell>
                            {HIERARCHY_ENTITY_LABELS[version.entity]}
                          </TableCell>
                          <TableCell className="text-sm">
                            {version.label ?? "—"}
                            {version.reason && (
                              <span className="block text-xs text-muted-foreground">
                                {version.reason}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {version.itemCount}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(version.createdAt)}
                          </TableCell>
                          {canRestore && (
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={restore.isPending}
                                onClick={() =>
                                  handleRestore(
                                    version.id,
                                    version.label ??
                                      `versão ${version.versionNumber}`,
                                  )
                                }
                              >
                                <RotateCcw /> Restaurar
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importacoes">
          <Card>
            <CardHeader>
              <CardTitle>Lotes de importação</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {batches.isLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (batches.data?.length ?? 0) === 0 ? (
                <Alert>
                  <Upload />
                  <AlertTitle>Nenhuma importação ainda</AlertTitle>
                  <AlertDescription>
                    Use o assistente de importação para trazer um plano de contas ou uma
                    lista de categorias de uma planilha.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="w-28">Situação</TableHead>
                        <TableHead className="w-40 text-right">Linhas</TableHead>
                        <TableHead className="w-36">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.data?.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="text-sm">
                            {batch.fileName ?? "conteúdo colado"}
                            <span className="block text-xs text-muted-foreground">
                              {batch.format}
                            </span>
                          </TableCell>
                          <TableCell>
                            {HIERARCHY_ENTITY_LABELS[batch.entity]}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                batch.status === "APPLIED" ? "default" : "outline"
                              }
                            >
                              {IMPORT_STATUS_LABELS[batch.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {batch.totalRows} lida(s)
                            <span className="block text-muted-foreground">
                              {batch.createdRows} criada(s) · {batch.updatedRows}{" "}
                              atualizada(s) · {batch.invalidRows} com erro
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(batch.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
