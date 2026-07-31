"use client";

import * as React from "react";
import { Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";

import {
  useClassificationRules,
  useCreateClassificationRule,
  useDeleteClassificationRule,
  useSimulateClassification,
} from "@/lib/api/financial-structure";
import { useCategories, useCostCenters } from "@/lib/api/taxonomy";
import { ApiRequestError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CLASSIFICATION_MATCH_FIELD_LABELS,
  CLASSIFICATION_MATCH_TYPE_LABELS,
  TRANSACTION_ORIGIN_LABELS,
  type ClassificationMatchField,
  type ClassificationMatchType,
  type SimulationResult,
  type TransactionOrigin,
} from "@/types/financial-structure";

export default function ClassificationRulesPage() {
  const { selectedCompanyId, hasPermission } = useSession();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [simulateOpen, setSimulateOpen] = React.useState(false);

  const { data: rules, isLoading } = useClassificationRules(selectedCompanyId ?? undefined);
  const createRule = useCreateClassificationRule();
  const deleteRule = useDeleteClassificationRule();

  const canManage = hasPermission("classification_rule.manage");
  const canDelete = hasPermission("classification_rule.delete");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Regras de classificação</h1>
          <p className="text-sm text-muted-foreground">
            Ensinam o sistema a reconhecer lançamentos automaticamente a partir da descrição, da
            contraparte ou do valor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSimulateOpen(true)}>
            <Wand2 /> Simular
          </Button>
          {canManage && <Button onClick={() => setDialogOpen(true)}>+ Incluir nova regra</Button>}
        </div>
      </div>

      <Alert>
        <Sparkles className="size-4" />
        <AlertTitle>As regras ainda não classificam lançamentos automaticamente.</AlertTitle>
        <AlertDescription>
          Nesta etapa elas são apenas cadastradas e podem ser simuladas. A aplicação automática
          passa a valer quando os módulos de importação bancária e de contas a pagar/receber
          existirem — a base de aprendizado já está preparada para isso.
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (rules ?? []).length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma regra cadastrada. Um exemplo típico: descrição contém &quot;COELBA&quot; →
            categoria Energia, centro de custo Administrativo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead>Aplica</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rules ?? []).map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="text-muted-foreground">{rule.priority}</TableCell>
                  <TableCell className="font-medium">
                    {rule.name}
                    {rule.autoApply && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Automática
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CLASSIFICATION_MATCH_FIELD_LABELS[rule.matchField]}{" "}
                    {CLASSIFICATION_MATCH_TYPE_LABELS[rule.matchType].toLowerCase()}{" "}
                    <span className="font-mono">{rule.matchValue}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[rule.category?.name, rule.costCenter?.name].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {TRANSACTION_ORIGIN_LABELS[rule.origin]}
                  </TableCell>
                  <TableCell>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Excluir a regra "${rule.name}"?`)) {
                            deleteRule.mutate(rule.id);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {dialogOpen && selectedCompanyId && (
        <RuleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={selectedCompanyId}
          isSubmitting={createRule.isPending}
          onSubmit={async (payload) => {
            await createRule.mutateAsync({ ...payload, companyId: selectedCompanyId });
          }}
        />
      )}

      {simulateOpen && selectedCompanyId && (
        <SimulateDialog
          open={simulateOpen}
          onOpenChange={setSimulateOpen}
          companyId={selectedCompanyId}
        />
      )}
    </div>
  );
}

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

function RuleDialog({ open, onOpenChange, companyId, isSubmitting, onSubmit }: RuleDialogProps) {
  const [name, setName] = React.useState("");
  const [matchField, setMatchField] = React.useState<ClassificationMatchField>("DESCRIPTION");
  const [matchType, setMatchType] = React.useState<ClassificationMatchType>("CONTAINS");
  const [matchValue, setMatchValue] = React.useState("");
  const [origin, setOrigin] = React.useState<TransactionOrigin>("ANY");
  const [categoryId, setCategoryId] = React.useState<string | undefined>();
  const [costCenterId, setCostCenterId] = React.useState<string | undefined>();
  const [priority, setPriority] = React.useState(100);
  const [error, setError] = React.useState<string | null>(null);

  const { data: categories } = useCategories(companyId);
  const { data: costCenters } = useCostCenters(companyId);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        matchField,
        matchType,
        matchValue: matchValue.trim(),
        origin,
        categoryId,
        costCenterId,
        priority,
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Não foi possível salvar a regra.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>+ Incluir nova regra</DialogTitle>
          <DialogDescription>
            Quando a condição casar, as dimensões abaixo serão sugeridas para o lançamento.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Nome da regra</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fatura COELBA"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Campo analisado</Label>
            <Select
              value={matchField}
              onValueChange={(v) => setMatchField(v as ClassificationMatchField)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLASSIFICATION_MATCH_FIELD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Comparação</Label>
            <Select
              value={matchType}
              onValueChange={(v) => setMatchType(v as ClassificationMatchType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLASSIFICATION_MATCH_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Texto ou padrão reconhecido</Label>
            <Input
              value={matchValue}
              onChange={(e) => setMatchValue(e.target.value)}
              placeholder="COELBA"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Origem do lançamento</Label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as TransactionOrigin)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRANSACTION_ORIGIN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Prioridade (menor vence)</Label>
            <Input
              type="number"
              min={1}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 100)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categoria aplicada</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Centro de custo aplicado</Label>
            <Select value={costCenterId} onValueChange={setCostCenterId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(costCenters ?? []).map((costCenter) => (
                  <SelectItem key={costCenter.id} value={costCenter.id}>
                    {costCenter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !matchValue.trim() || isSubmitting}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SimulateDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [result, setResult] = React.useState<SimulationResult | null>(null);
  const simulate = useSimulateClassification();

  async function handleSimulate() {
    const response = await simulate.mutateAsync({
      companyId,
      description,
      amount: amount ? Number(amount) : undefined,
    });
    setResult(response);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simular classificação</DialogTitle>
          <DialogDescription>
            Informe um lançamento hipotético para conferir qual regra seria aplicada. Nada é criado
            nem classificado de verdade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Descrição do lançamento</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="COELBA FATURA 09/2026"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Valor (opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {result && (
            <Alert variant={result.appliedRule ? "default" : "destructive"}>
              <AlertTitle>
                {result.appliedRule
                  ? `Regra aplicada: ${result.appliedRule.name}`
                  : "Nenhuma regra reconheceu este lançamento."}
              </AlertTitle>
              {result.classification && (
                <AlertDescription className="flex flex-col gap-0.5">
                  <span>Categoria: {result.classification.category?.name ?? "—"}</span>
                  <span>Centro de custo: {result.classification.costCenter?.name ?? "—"}</span>
                  <span>Natureza: {result.classification.financialNature?.name ?? "—"}</span>
                  {result.otherMatches.length > 0 && (
                    <span className="text-xs">
                      Outras {result.otherMatches.length} regra(s) também casaram, mas têm
                      prioridade menor.
                    </span>
                  )}
                </AlertDescription>
              )}
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleSimulate} disabled={!description.trim() || simulate.isPending}>
            {simulate.isPending && <Loader2 className="animate-spin" />}
            Simular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
