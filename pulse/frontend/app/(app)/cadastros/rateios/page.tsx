"use client";

import * as React from "react";
import { Loader2, Plus, SplitSquareHorizontal, Trash2 } from "lucide-react";

import {
  useAllocationRules,
  useCreateAllocationRule,
  useDeleteAllocationRule,
  useResultCenters,
} from "@/lib/api/financial-structure";
import { useCostCenters } from "@/lib/api/taxonomy";
import { ApiRequestError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALLOCATION_CRITERION_LABELS,
  ALLOCATION_TARGET_LABELS,
  type AllocationCriterion,
  type AllocationTargetType,
} from "@/types/financial-structure";

interface DraftLine {
  targetType: AllocationTargetType;
  targetId?: string;
  percentage?: number;
  fixedAmount?: number;
  weight?: number;
}

export default function AllocationRulesPage() {
  const { selectedCompanyId, hasPermission } = useSession();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: rules, isLoading } = useAllocationRules(selectedCompanyId ?? undefined);
  const createRule = useCreateAllocationRule();
  const deleteRule = useDeleteAllocationRule();

  const canManage = hasPermission("allocation-rules.manage");
  const canDelete = hasPermission("allocation-rules.delete");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rateios</h1>
          <p className="text-sm text-muted-foreground">
            Divisão automática de um lançamento entre várias dimensões. Rateios percentuais precisam
            fechar exatamente 100%.
          </p>
        </div>
        {canManage && <Button onClick={() => setDialogOpen(true)}>+ Incluir novo rateio</Button>}
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </Card>
      ) : (rules ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <SplitSquareHorizontal className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum rateio cadastrado. Um exemplo típico é dividir a conta de energia entre
            Restaurante (60%) e Administrativo (40%).
          </p>
        </Card>
      ) : (
        (rules ?? []).map((rule) => (
          <Card key={rule.id} className="gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-sm text-muted-foreground">
                  {ALLOCATION_CRITERION_LABELS[rule.criterion]}
                  {rule.category ? ` · ${rule.category.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {rule.isDefault && <Badge>Padrão</Badge>}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (window.confirm(`Excluir o rateio "${rule.name}"?`)) {
                        deleteRule.mutate(rule.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {rule.lines.map((line, index) => (
                <li key={line.id ?? index} className="flex justify-between border-b pb-1 last:border-0">
                  <span className="text-muted-foreground">
                    {ALLOCATION_TARGET_LABELS[line.targetType]} ·{" "}
                    {line.costCenter?.name ??
                      line.resultCenter?.name ??
                      line.project?.name ??
                      line.businessUnit?.name ??
                      line.category?.name ??
                      line.accountPlan?.name ??
                      "—"}
                  </span>
                  <span className="font-medium">
                    {line.percentage != null
                      ? `${Number(line.percentage)}%`
                      : line.fixedAmount != null
                        ? `R$ ${Number(line.fixedAmount).toFixed(2)}`
                        : line.weight != null
                          ? `peso ${Number(line.weight)}`
                          : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      {dialogOpen && selectedCompanyId && (
        <AllocationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={selectedCompanyId}
          isSubmitting={createRule.isPending}
          onSubmit={async (payload) => {
            await createRule.mutateAsync({ ...payload, companyId: selectedCompanyId });
          }}
        />
      )}
    </div>
  );
}

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

function AllocationDialog({
  open,
  onOpenChange,
  companyId,
  isSubmitting,
  onSubmit,
}: AllocationDialogProps) {
  const [name, setName] = React.useState("");
  const [criterion, setCriterion] = React.useState<AllocationCriterion>("PERCENTAGE");
  const [lines, setLines] = React.useState<DraftLine[]>([
    { targetType: "COST_CENTER", percentage: 100 },
  ]);
  const [error, setError] = React.useState<string | null>(null);

  const { data: costCenters } = useCostCenters(companyId);
  const { data: resultCenters } = useResultCenters(companyId);

  const total = lines.reduce((sum, line) => sum + (line.percentage ?? 0), 0);
  const percentageValid = criterion !== "PERCENTAGE" || Math.abs(total - 100) <= 0.01;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        criterion,
        lines: lines.map((line) => ({
          targetType: line.targetType,
          ...(line.targetType === "COST_CENTER" ? { costCenterId: line.targetId } : {}),
          ...(line.targetType === "RESULT_CENTER" ? { resultCenterId: line.targetId } : {}),
          percentage: criterion === "PERCENTAGE" ? line.percentage : undefined,
          fixedAmount: criterion === "FIXED_AMOUNT" ? line.fixedAmount : undefined,
          weight: !["PERCENTAGE", "FIXED_AMOUNT"].includes(criterion) ? line.weight : undefined,
        })),
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Não foi possível salvar o rateio.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>+ Incluir novo rateio</DialogTitle>
          <DialogDescription>
            Defina como o valor de um lançamento será dividido entre as dimensões.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rateio de energia"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Critério</Label>
              <Select
                value={criterion}
                onValueChange={(v) => setCriterion(v as AllocationCriterion)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ALLOCATION_CRITERION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Linhas do rateio</Label>
            {lines.map((line, index) => {
              const options = line.targetType === "COST_CENTER" ? costCenters : resultCenters;
              return (
                <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                  <div className="flex w-40 flex-col gap-1.5">
                    <Label className="text-xs">Dimensão</Label>
                    <Select
                      value={line.targetType}
                      onValueChange={(v) =>
                        updateLine(index, {
                          targetType: v as AllocationTargetType,
                          targetId: undefined,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COST_CENTER">Centro de custo</SelectItem>
                        <SelectItem value="RESULT_CENTER">Centro de resultado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <Label className="text-xs">Destino</Label>
                    <Select
                      value={line.targetId}
                      onValueChange={(v) => updateLine(index, { targetId: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(options ?? []).map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex w-28 flex-col gap-1.5">
                    <Label className="text-xs">
                      {criterion === "PERCENTAGE"
                        ? "%"
                        : criterion === "FIXED_AMOUNT"
                          ? "Valor"
                          : "Peso"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={
                        criterion === "PERCENTAGE"
                          ? (line.percentage ?? "")
                          : criterion === "FIXED_AMOUNT"
                            ? (line.fixedAmount ?? "")
                            : (line.weight ?? "")
                      }
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : undefined;
                        updateLine(
                          index,
                          criterion === "PERCENTAGE"
                            ? { percentage: value }
                            : criterion === "FIXED_AMOUNT"
                              ? { fixedAmount: value }
                              : { weight: value },
                        );
                      }}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() =>
                setLines((current) => [...current, { targetType: "COST_CENTER" }])
              }
            >
              <Plus /> Incluir nova linha
            </Button>

            {criterion === "PERCENTAGE" && (
              <p
                className={
                  percentageValid ? "text-sm text-success" : "text-sm text-destructive"
                }
              >
                Total: {total.toFixed(2)}%{percentageValid ? "" : " — o rateio deve fechar 100%."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !percentageValid || isSubmitting}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
