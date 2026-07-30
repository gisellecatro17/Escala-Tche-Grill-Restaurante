"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FlaskConical,
  Upload,
  XCircle,
} from "lucide-react";

import {
  useAnalyzeImport,
  useApplyImport,
  useImportRows,
  useSetImportMapping,
  useValidateImport,
} from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  HierarchyEntity,
  ImportRowStatus,
  StructureImportAnalysis,
  StructureImportBatch,
  StructureImportMode,
  StructureImportResult,
} from "@/types/financial-structure";

const STEPS = [
  "Arquivo",
  "Cadastro",
  "Colunas",
  "Validação",
  "Inconsistências",
  "Confirmação",
  "Resultado",
] as const;

/** Cadastros que a importação sabe criar. */
const IMPORTABLE_ENTITIES: { value: HierarchyEntity; label: string; needsCompany: boolean }[] =
  [
    { value: "ACCOUNT_PLAN", label: "Plano de contas", needsCompany: false },
    { value: "CATEGORY", label: "Categorias financeiras", needsCompany: true },
    { value: "COST_CENTER", label: "Centros de custo", needsCompany: true },
    { value: "RESULT_CENTER", label: "Centros de resultado", needsCompany: true },
    { value: "BUSINESS_UNIT", label: "Unidades de negócio", needsCompany: false },
  ];

const MODES: { value: StructureImportMode; label: string; hint: string }[] = [
  {
    value: "INSERT_ONLY",
    label: "Somente incluir",
    hint: "Cria os novos e mantém intocado o que já existe.",
  },
  {
    value: "INSERT_AND_UPDATE",
    label: "Incluir e atualizar",
    hint: "Cria os novos e atualiza o nome dos que já existem.",
  },
  {
    value: "UPDATE_ONLY",
    label: "Somente atualizar",
    hint: "Não cria nada; apenas atualiza o que já existe.",
  },
];

const ROW_STATUS_STYLE: Record<ImportRowStatus, { label: string; className: string }> = {
  VALID: { label: "Válida", className: "text-emerald-600 dark:text-emerald-500" },
  WARNING: { label: "Aviso", className: "text-amber-600 dark:text-amber-500" },
  ERROR: { label: "Erro", className: "text-destructive" },
};

/**
 * Assistente de importação em 7 etapas (seção 43). Cada etapa é uma chamada distinta ao
 * back-end: nada é criado antes da última confirmação, e a simulação permite conferir o
 * resultado sem gravar.
 */
export default function ImportarEstruturaPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [step, setStep] = React.useState(0);
  const [file, setFile] = React.useState<File | null>(null);
  const [pasted, setPasted] = React.useState("");
  const [entity, setEntity] = React.useState<HierarchyEntity>("ACCOUNT_PLAN");
  const [analysis, setAnalysis] = React.useState<StructureImportAnalysis | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [validated, setValidated] = React.useState<StructureImportBatch | null>(null);
  const [mode, setMode] = React.useState<StructureImportMode>("INSERT_ONLY");
  const [includeWarnings, setIncludeWarnings] = React.useState(false);
  const [result, setResult] = React.useState<StructureImportResult | null>(null);
  const [simulation, setSimulation] = React.useState<StructureImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const analyze = useAnalyzeImport();
  const setImportMapping = useSetImportMapping();
  const validate = useValidateImport();
  const apply = useApplyImport();

  const problemRows = useImportRows(
    step === 4 ? (analysis?.id ?? undefined) : undefined,
  );

  const selectedEntity = IMPORTABLE_ENTITIES.find((item) => item.value === entity);
  const missingCompany = Boolean(selectedEntity?.needsCompany) && !companyId;

  if (!hasPermission("financial_structure.import")) {
    return (
      <Alert variant="destructive">
        <XCircle />
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para importar a estrutura financeira.
        </AlertDescription>
      </Alert>
    );
  }

  async function run<T>(action: () => Promise<T>, onDone: (value: T) => void) {
    setError(null);
    try {
      onDone(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha inesperada.");
    }
  }

  async function handleAnalyze() {
    if (!organizationId) return;
    await run(
      () =>
        analyze.mutateAsync({
          organizationId,
          companyId: selectedEntity?.needsCompany ? companyId : undefined,
          entity,
          file: file ?? undefined,
          content: file ? undefined : pasted,
          fileName: file?.name,
        }),
      (data) => {
        setAnalysis(data);
        setMapping(data.suggestedMapping);
        setStep(2);
      },
    );
  }

  async function handleMapping() {
    if (!analysis) return;
    await run(
      async () => {
        await setImportMapping.mutateAsync({ id: analysis.id, mapping });
        return validate.mutateAsync(analysis.id);
      },
      (data) => {
        setValidated(data);
        setStep(4);
      },
    );
  }

  async function handleSimulate() {
    if (!analysis) return;
    await run(
      () =>
        apply.mutateAsync({ id: analysis.id, mode: "SIMULATE", includeWarnings }),
      setSimulation,
    );
  }

  async function handleApply() {
    if (!analysis) return;
    await run(
      () => apply.mutateAsync({ id: analysis.id, mode, includeWarnings }),
      (data) => {
        setResult(data);
        setStep(6);
      },
    );
  }

  const busy =
    analyze.isPending ||
    setImportMapping.isPending ||
    validate.isPending ||
    apply.isPending;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/cadastros/estrutura-financeira">
            <ArrowLeft /> Estrutura financeira
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Importar estrutura</h1>
        <p className="text-sm text-muted-foreground">
          Registros existentes nunca são excluídos pela importação. Você confere as
          inconsistências e pode simular antes de aplicar.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              index === step
                ? "border-primary bg-primary/10 font-medium text-primary"
                : index < step
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-500"
                  : "text-muted-foreground"
            }`}
          >
            {index < step ? <Check className="size-3" /> : <span>{index + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {error && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Não foi possível continuar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Etapa 1: arquivo */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Envie o arquivo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arquivo">Planilha ou arquivo (XLSX, CSV ou JSON)</Label>
              <Input
                id="arquivo"
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,.json"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="colado">Ou cole o conteúdo</Label>
              <Textarea
                id="colado"
                rows={6}
                placeholder={"codigo;descricao;codigo_pai\n1;Ativo;\n1.1;Ativo Circulante;1"}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                disabled={Boolean(file)}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  O arquivo enviado tem prioridade sobre o conteúdo colado.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(1)}
                disabled={!file && pasted.trim().length === 0}
              >
                Continuar <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 2: cadastro de destino */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Para qual cadastro?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Cadastro de destino</Label>
              <Select
                value={entity}
                onValueChange={(value) => setEntity(value as HierarchyEntity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTABLE_ENTITIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {missingCompany && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Selecione uma empresa</AlertTitle>
                <AlertDescription>
                  {selectedEntity?.label} pertencem a uma empresa. Escolha a empresa no
                  topo da tela antes de importar.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft /> Voltar
              </Button>
              <Button onClick={handleAnalyze} disabled={missingCompany || busy}>
                <Upload /> Ler arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 3: mapeamento de colunas */}
      {step === 2 && analysis && (
        <Card>
          <CardHeader>
            <CardTitle>3. Relacione as colunas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              O arquivo tem {analysis.totalRows} linha(s) e{" "}
              {analysis.headers.length} coluna(s). Sugerimos um mapeamento pelos nomes
              das colunas — confira antes de seguir.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {analysis.availableFields.map((field) => (
                <div key={field.field} className="flex flex-col gap-1.5">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select
                    value={mapping[field.field] ?? "__none__"}
                    onValueChange={(value) =>
                      setMapping((current) => {
                        const next = { ...current };
                        if (value === "__none__") delete next[field.field];
                        else next[field.field] = value;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não importar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não importar</SelectItem>
                      {analysis.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {analysis.sampleRows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {analysis.headers.map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.sampleRows.slice(0, 5).map((row, index) => (
                      <TableRow key={index}>
                        {analysis.headers.map((header) => (
                          <TableCell key={header} className="whitespace-nowrap">
                            {row[header]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft /> Voltar
              </Button>
              <Button
                onClick={handleMapping}
                disabled={busy || !mapping.code || !mapping.name}
              >
                Validar arquivo <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapas 4 e 5: validação e inconsistências */}
      {step === 4 && validated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              4 e 5. Validação
              <Badge variant="outline">{validated.validRows} válida(s)</Badge>
              {(validated.warningRows ?? 0) > 0 && (
                <Badge variant="outline">{validated.warningRows} com aviso</Badge>
              )}
              {validated.invalidRows > 0 && (
                <Badge variant="destructive">{validated.invalidRows} com erro</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {validated.invalidRows > 0 && (
              <Alert>
                <AlertTriangle />
                <AlertTitle>Linhas com erro serão ignoradas</AlertTitle>
                <AlertDescription>
                  O restante do arquivo continua válido. Corrija o arquivo e importe de
                  novo se quiser incluir essas linhas.
                </AlertDescription>
              </Alert>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead className="w-24">Situação</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(problemRows.data ?? [])
                    .filter((row) => row.validationStatus !== "VALID")
                    .slice(0, 50)
                    .map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                        <TableCell
                          className={ROW_STATUS_STYLE[row.validationStatus].className}
                        >
                          {ROW_STATUS_STYLE[row.validationStatus].label}
                        </TableCell>
                        <TableCell>{row.normalizedData?.code}</TableCell>
                        <TableCell>{row.normalizedData?.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(row.validationErrors ?? [])
                            .map((issue) => issue.message)
                            .join(" ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  {(problemRows.data ?? []).every(
                    (row) => row.validationStatus === "VALID",
                  ) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Nenhuma inconsistência: todas as linhas estão prontas para
                        importar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft /> Rever colunas
              </Button>
              <Button onClick={() => setStep(5)} disabled={validated.validRows === 0}>
                Continuar <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 6: confirmação */}
      {step === 5 && validated && (
        <Card>
          <CardHeader>
            <CardTitle>6. Como aplicar?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {MODES.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-sm ${
                    mode === option.value ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="modo"
                      checked={mode === option.value}
                      onChange={() => setMode(option.value)}
                    />
                    {option.label}
                  </span>
                  <span className="pl-6 text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </label>
              ))}
            </div>

            {(validated.warningRows ?? 0) > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={includeWarnings}
                  onCheckedChange={(checked) => setIncludeWarnings(checked === true)}
                />
                <span>
                  Incluir também as {validated.warningRows} linha(s) com aviso
                  <span className="block text-xs text-muted-foreground">
                    São linhas cujo código já existe no cadastro. Nenhuma delas será
                    excluída.
                  </span>
                </span>
              </label>
            )}

            {simulation && (
              <Alert>
                <FlaskConical />
                <AlertTitle>Resultado da simulação</AlertTitle>
                <AlertDescription>
                  Criaria {simulation.createdRows}, atualizaria {simulation.updatedRows} e
                  ignoraria {simulation.skippedRows} registro(s). Nada foi gravado.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(4)}>
                <ArrowLeft /> Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSimulate} disabled={busy}>
                  <FlaskConical /> Simular
                </Button>
                <Button onClick={handleApply} disabled={busy}>
                  <Check /> Aplicar importação
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 7: resultado */}
      {step === 6 && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-500" />
              7. Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Criados", value: result.createdRows },
                { label: "Atualizados", value: result.updatedRows },
                { label: "Ignorados", value: result.skippedRows },
              ].map((item) => (
                <div key={item.label} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>

            {result.messages.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border p-3 text-xs text-muted-foreground">
                {result.messages.slice(0, 20).map((message, index) => (
                  <span key={index}>{message}</span>
                ))}
              </div>
            )}

            <Alert>
              <CheckCircle2 />
              <AlertTitle>A estrutura anterior foi versionada</AlertTitle>
              <AlertDescription>
                Um snapshot foi gravado antes da importação, então é possível restaurar a
                árvore como ela estava.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/cadastros/estrutura-financeira">Voltar à estrutura</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/cadastros/estrutura-financeira/historico">
                  Ver histórico
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
