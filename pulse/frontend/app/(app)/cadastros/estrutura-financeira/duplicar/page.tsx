"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Info, ShieldAlert, XCircle } from "lucide-react";

import { useCompanies } from "@/lib/api/companies";
import { useDuplicateStructure } from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DuplicationResult } from "@/types/financial-structure";

/** Cadastros que podem ser copiados, com o padrão de cada um (seção 46). */
const REGISTRIES = [
  { key: "accountPlan", label: "Plano de contas", defaultOn: true },
  { key: "categories", label: "Categorias financeiras", defaultOn: true },
  { key: "costCenters", label: "Centros de custo", defaultOn: true },
  { key: "resultCenters", label: "Centros de resultado", defaultOn: true },
  { key: "businessUnits", label: "Unidades de negócio", defaultOn: false },
  { key: "financialTags", label: "Tags financeiras", defaultOn: false },
] as const;

type RegistryKey = (typeof REGISTRIES)[number]["key"];

/**
 * Duplicação da estrutura entre empresas. A tela deixa explícito o que **não** é copiado,
 * porque a expectativa errada aqui custaria caro: ninguém quer descobrir depois que
 * esperava os lançamentos junto.
 */
export default function DuplicarEstruturaPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const companies = useCompanies({ page: 1, perPage: 100 });
  const duplicate = useDuplicateStructure();

  const [sourceCompanyId, setSourceCompanyId] = React.useState("");
  const [targetCompanyId, setTargetCompanyId] = React.useState(
    selectedCompanyId ?? "",
  );
  const [selected, setSelected] = React.useState<Record<RegistryKey, boolean>>(
    () =>
      Object.fromEntries(
        REGISTRIES.map((item) => [item.key, item.defaultOn]),
      ) as Record<RegistryKey, boolean>,
  );
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [result, setResult] = React.useState<DuplicationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!hasPermission("financial_structure.duplicate")) {
    return (
      <Alert variant="destructive">
        <XCircle />
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para duplicar a estrutura financeira.
        </AlertDescription>
      </Alert>
    );
  }

  const sameCompany =
    Boolean(sourceCompanyId) && sourceCompanyId === targetCompanyId;
  const nothingSelected = !Object.values(selected).some(Boolean);
  const canSubmit =
    Boolean(organizationId) &&
    Boolean(sourceCompanyId) &&
    Boolean(targetCompanyId) &&
    !sameCompany &&
    !nothingSelected &&
    reason.trim().length > 0;

  async function handleSubmit() {
    setError(null);
    try {
      setResult(
        await duplicate.mutateAsync({
          sourceCompanyId,
          targetCompanyId,
          ...selected,
          includeInactive,
          reason: reason.trim(),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha inesperada.");
    }
  }

  const options = companies.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/cadastros/estrutura-financeira">
            <ArrowLeft /> Estrutura financeira
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Duplicar estrutura entre empresas
        </h1>
        <p className="text-sm text-muted-foreground">
          Útil ao abrir uma filial: a nova empresa já nasce com a mesma estrutura de
          análise da matriz.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Não foi possível duplicar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Duplicação concluída</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="w-24 text-right">Copiados</TableHead>
                    <TableHead className="w-32 text-right">Já existiam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.reports.map((report) => (
                    <TableRow key={report.registry}>
                      <TableCell>{report.registry}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {report.copied}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {report.skipped}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Alert>
              <Info />
              <AlertTitle>O que não foi copiado</AlertTitle>
              <AlertDescription>
                {result.notCopied.join(", ")}. Esses dados pertencem à empresa que os
                gerou.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button asChild>
                <Link href="/cadastros/estrutura-financeira">
                  Voltar à estrutura
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Duplicar de novo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Origem e destino</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Copiar de</Label>
                <Select value={sourceCompanyId} onValueChange={setSourceCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.tradeName ?? company.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Copiar para</Label>
                <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.tradeName ?? company.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sameCompany && (
              <Alert variant="destructive">
                <XCircle />
                <AlertTitle>Empresas iguais</AlertTitle>
                <AlertDescription>
                  A origem e o destino precisam ser empresas diferentes.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Label>O que copiar</Label>
              {REGISTRIES.map((registry) => (
                <label
                  key={registry.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selected[registry.key]}
                    onCheckedChange={(checked) =>
                      setSelected((current) => ({
                        ...current,
                        [registry.key]: checked === true,
                      }))
                    }
                  />
                  {registry.label}
                </label>
              ))}
              {nothingSelected && (
                <p className="text-xs text-destructive">
                  Selecione ao menos um cadastro.
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(checked === true)}
              />
              Copiar também os registros inativos e arquivados
            </label>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                placeholder="Abertura da filial do centro"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Fica registrado na auditoria da empresa de destino.
              </p>
            </div>

            <Alert>
              <ShieldAlert />
              <AlertTitle>O que a duplicação nunca faz</AlertTitle>
              <AlertDescription>
                Não copia lançamentos, saldos, movimentações, conciliações, orçamentos
                realizados, histórico de uso nem a auditoria da empresa de origem. O que já
                existe no destino é preservado, jamais sobrescrito ou excluído.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || duplicate.isPending}
              >
                <Copy /> Duplicar estrutura
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
