"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Play,
  ShieldCheck,
} from "lucide-react";

import {
  useProcessDocument,
  useProcessingPreview,
} from "@/lib/api/document-processing";
import { useIntakeDocument } from "@/lib/api/document-intake";
import { useAllocationRules } from "@/lib/api/financial-structure";
import { useCategories, useCostCenters } from "@/lib/api/taxonomy";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field } from "@/components/treasury/field";
import {
  ALLOCATION_TARGET_LABELS,
  DIMENSION_LABELS,
  DIMENSION_SOURCE_LABELS,
  ENTRY_DIRECTION_LABELS,
  TAX_TYPE_LABELS,
} from "@/types/document-processing";

const NONE = "__none__";

/**
 * Tela de processamento do documento.
 *
 * Mostra a **prévia** — o que o sistema faria — antes de gravar qualquer coisa. Cada
 * dimensão da classificação vem etiquetada com a origem (regra automática, padrão do
 * cadastro, decidido no documento), porque "categoria: Carnes" sozinho não diz se alguém
 * conferiu aquilo.
 *
 * Processar cria o título. Não paga, não agenda e não autoriza nada.
 */
export default function ProcessarDocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { selectedCompanyId, hasPermission } = useSession();

  const { data: document } = useIntakeDocument(id);
  const { data: preview, isLoading, error } = useProcessingPreview(id);
  const process = useProcessDocument();

  const companyId = document?.companyId ?? selectedCompanyId ?? undefined;
  const { data: categories } = useCategories(companyId);
  const { data: costCenters } = useCostCenters(companyId);
  const { data: allocationRules } = useAllocationRules(companyId);

  const [installmentCount, setInstallmentCount] = React.useState(1);
  const [firstDueDate, setFirstDueDate] = React.useState<string>("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [costCenterId, setCostCenterId] = React.useState<string>("");
  const [allocationRuleId, setAllocationRuleId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [failure, setFailure] = React.useState<string | null>(null);

  const canProcess = hasPermission("document_processing.process");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Este documento não pode ser processado</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "Confira se ele foi encaminhado pela entrada e se tem empresa, valor e direção definidos."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // A prévia já traz a classificação resolvida; o que o usuário escolher aqui a substitui.
  const effectiveCategoryId =
    categoryId || preview.classification.values.categoryId || "";
  const effectiveCostCenterId =
    costCenterId || preview.classification.values.costCenterId || "";

  function submit() {
    setFailure(null);

    const classification: Record<string, string> = {};
    if (categoryId) classification.categoryId = categoryId;
    if (costCenterId) classification.costCenterId = costCenterId;

    process.mutate(
      {
        id,
        payload: {
          ...(Object.keys(classification).length > 0 ? { classification } : {}),
          ...(allocationRuleId ? { allocationRuleId } : {}),
          installmentCount,
          ...(firstDueDate ? { firstDueDate } : {}),
          ...(notes ? { notes } : {}),
        },
      },
      {
        onSuccess: (entry) => router.push(`/financeiro/lancamentos/${entry.id}`),
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error
              ? caught.message
              : "Não foi possível processar o documento.",
          ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar à fila">
          <Link href="/financeiro/a-processar">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">
            Processar{" "}
            {preview.document.documentNumber
              ? `documento nº ${preview.document.documentNumber}`
              : (preview.document.displayName ?? "documento")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {ENTRY_DIRECTION_LABELS[preview.direction]} ·{" "}
            {formatCurrencyBRL(preview.amounts.gross)}
            {preview.document.dueDate &&
              ` · vence em ${formatDateBR(preview.document.dueDate)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/financeiro/entrada-documentos/${id}`}>
            Ver documento
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      </div>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Processar cria o título, não paga nada</AlertTitle>
        <AlertDescription>
          O lançamento nasce como rascunho ou aguardando conferência e precisa ser aberto
          para virar obrigação. Autorização, agendamento e pagamento são de módulos que
          ainda não existem.
        </AlertDescription>
      </Alert>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Processamento não concluído</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {preview.requiresApproval && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Vai exigir conferência</AlertTitle>
          <AlertDescription>
            O valor supera o limite configurado, então o lançamento nascerá aguardando
            conferência dos dados.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Classificação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(preview.classification.values)
                .filter(([, value]) => Boolean(value))
                .map(([dimension]) => (
                  <div key={dimension} className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">
                      {DIMENSION_LABELS[dimension] ?? dimension}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {DIMENSION_SOURCE_LABELS[
                        preview.classification.sources[dimension]
                      ] ?? "—"}
                    </Badge>
                  </div>
                ))}
            </div>

            {preview.classification.appliedClassificationRuleId && (
              <p className="text-xs text-muted-foreground">
                Uma regra de classificação automática foi aplicada.
              </p>
            )}

            <Field
              label="Categoria"
              hint="Escolher aqui substitui o que a regra ou o cadastro decidiram."
            >
              <Select
                value={effectiveCategoryId || NONE}
                onValueChange={(value) =>
                  setCategoryId(value === NONE ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Não definida" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não definida</SelectItem>
                  {(categories ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Centro de custo">
              <Select
                value={effectiveCostCenterId || NONE}
                onValueChange={(value) =>
                  setCostCenterId(value === NONE ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Não definido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não definido</SelectItem>
                  {(costCenters ?? []).map((costCenter) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Rateio">
              <Select
                value={
                  allocationRuleId ||
                  preview.classification.appliedAllocationRuleId ||
                  NONE
                }
                onValueChange={(value) =>
                  setAllocationRuleId(value === NONE ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sem rateio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem rateio</SelectItem>
                  {(allocationRules ?? []).map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {rule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parcelas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Quantidade de parcelas">
                <Input
                  type="number"
                  min={1}
                  max={360}
                  value={installmentCount}
                  onChange={(event) =>
                    setInstallmentCount(Math.max(1, Number(event.target.value)))
                  }
                />
              </Field>
              <Field label="Primeiro vencimento">
                <Input
                  type="date"
                  value={
                    firstDueDate ||
                    (preview.document.dueDate?.slice(0, 10) ?? "")
                  }
                  onChange={(event) => setFirstDueDate(event.target.value)}
                />
              </Field>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.installments.map((installment) => (
                  <TableRow key={installment.installmentNumber}>
                    <TableCell>
                      {installment.installmentNumber}/
                      {installment.totalInstallments}
                    </TableCell>
                    <TableCell>{formatDateBR(installment.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(installment.netAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <p className="text-xs text-muted-foreground">
              A prévia mostra a divisão atual. Alterar a quantidade acima só tem efeito ao
              processar — a lista é recalculada no servidor.
            </p>
          </CardContent>
        </Card>

        {preview.allocations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rateio a aplicar</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.allocations.map((allocation, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {ALLOCATION_TARGET_LABELS[allocation.targetType]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {allocation.percentage.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyBRL(allocation.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {preview.withholdings.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Retenções sugeridas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tributo</TableHead>
                    <TableHead className="text-right">Alíquota</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.withholdings.map((withholding) => (
                    <TableRow key={withholding.taxType}>
                      <TableCell>
                        {TAX_TYPE_LABELS[withholding.taxType]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {withholding.rate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyBRL(withholding.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                Total sugerido: {formatCurrencyBRL(preview.suggestedWithholdingTotal)}.
                As retenções <strong>não</strong> descontam o valor líquido enquanto não
                forem confirmadas no lançamento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Valores do lançamento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Amount label="Bruto" value={preview.amounts.gross} />
          <Amount label="Desconto" value={preview.amounts.discount} />
          <Amount label="Juros" value={preview.amounts.interest} />
          <Amount label="Multa" value={preview.amounts.penalty} />
          <Amount label="Retenções" value={preview.amounts.withholding} />
          <Amount label="Líquido" value={preview.amounts.net} emphasis />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Field label="Observações do processamento">
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button disabled={!canProcess || process.isPending} onClick={submit}>
          {process.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Processar e gerar lançamento
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/financeiro/a-processar">Cancelar</Link>
        </Button>
      </div>
    </div>
  );
}

function Amount({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
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
        {formatCurrencyBRL(value)}
      </p>
    </div>
  );
}
