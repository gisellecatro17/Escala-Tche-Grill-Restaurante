"use client";

import * as React from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";

import {
  useCreateFinancialNature,
  useDeleteFinancialNature,
  useFinancialNatures,
  useUpdateFinancialNature,
} from "@/lib/api/financial-structure";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FINANCIAL_NATURE_KIND_LABELS,
  type FinancialNature,
  type FinancialNatureKind,
} from "@/types/financial-structure";

export default function FinancialNaturesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FinancialNature | null>(null);

  const { data: natures, isLoading } = useFinancialNatures(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const createNature = useCreateFinancialNature();
  const updateNature = useUpdateFinancialNature();
  const deleteNature = useDeleteFinancialNature();

  const canManage = hasPermission("financial-natures.manage");
  const canDelete = hasPermission("financial-natures.delete");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Naturezas financeiras</h1>
          <p className="text-sm text-muted-foreground">
            Define se o valor impacta o resultado (DRE) e o caixa (fluxo de caixa). Transferências e
            aportes, por exemplo, movimentam o caixa sem alterar o resultado.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            + Incluir nova natureza
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (natures ?? []).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma natureza financeira cadastrada.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Impacta resultado</TableHead>
                <TableHead>Impacta caixa</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(natures ?? []).map((nature) => (
                <TableRow key={nature.id}>
                  <TableCell className="font-medium">
                    {nature.name}
                    {nature.isSystem && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Sistema
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {FINANCIAL_NATURE_KIND_LABELS[nature.kind]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={nature.affectsResult ? "default" : "outline"}>
                      {nature.affectsResult ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={nature.affectsCashFlow ? "default" : "outline"}>
                      {nature.affectsCashFlow ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(nature);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {canDelete && !nature.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`Excluir a natureza "${nature.name}"?`)) {
                              deleteNature.mutate(nature.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {dialogOpen && (
        <NatureDialog
          key={editing?.id ?? "nova"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          nature={editing}
          isSubmitting={createNature.isPending || updateNature.isPending}
          onSubmit={async (payload) => {
            if (editing) await updateNature.mutateAsync({ id: editing.id, payload });
            else
              await createNature.mutateAsync({
                ...payload,
                organizationId,
                companyId: selectedCompanyId ?? undefined,
              });
          }}
        />
      )}
    </div>
  );
}

interface NatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nature: FinancialNature | null;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

function NatureDialog({ open, onOpenChange, nature, isSubmitting, onSubmit }: NatureDialogProps) {
  const [name, setName] = React.useState(nature?.name ?? "");
  const [kind, setKind] = React.useState<FinancialNatureKind>(nature?.kind ?? "EXPENSE");
  const [affectsResult, setAffectsResult] = React.useState(nature?.affectsResult ?? true);
  const [affectsCashFlow, setAffectsCashFlow] = React.useState(nature?.affectsCashFlow ?? true);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({ name: name.trim(), kind, affectsResult, affectsCashFlow });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Não foi possível salvar a natureza financeira.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{nature ? "Editar natureza" : "+ Incluir nova natureza"}</DialogTitle>
          <DialogDescription>
            A natureza é herdada pelas categorias e contas vinculadas a ela.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FinancialNatureKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FINANCIAL_NATURE_KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={affectsResult}
              onChange={(e) => setAffectsResult(e.target.checked)}
            />
            Impacta o resultado (DRE gerencial)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={affectsCashFlow}
              onChange={(e) => setAffectsCashFlow(e.target.checked)}
            />
            Impacta o caixa (fluxo de caixa)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
