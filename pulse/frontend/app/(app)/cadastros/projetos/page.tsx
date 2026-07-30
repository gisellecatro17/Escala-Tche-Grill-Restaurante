"use client";

import * as React from "react";
import { FolderKanban, Loader2, Pencil, Trash2 } from "lucide-react";

import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useResultCenters,
  useUpdateProject,
} from "@/lib/api/financial-structure";
import { useCostCenters } from "@/lib/api/taxonomy";
import { ApiRequestError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
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
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from "@/types/financial-structure";

const STATUS_VARIANT: Record<ProjectStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  PLANNING: "outline",
  IN_PROGRESS: "default",
  PAUSED: "warning",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  ARCHIVED: "outline",
};

export default function ProjectsPage() {
  const { selectedCompanyId, hasPermission } = useSession();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);

  const { data, isLoading } = useProjects(selectedCompanyId ?? undefined, search || undefined);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const canManage = hasPermission("project.manage");
  const canDelete = hasPermission("project.delete");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Dimensão adicional de análise. O valor realizado e a margem serão calculados
            automaticamente quando o módulo financeiro existir.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            + Incluir novo projeto
          </Button>
        )}
      </div>

      <Card className="p-4">
        <Input
          placeholder="Pesquisar por nome ou código"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FolderKanban className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="text-muted-foreground">{project.code ?? "—"}</TableCell>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.customer?.displayName ?? project.customer?.legalName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.startDate ? formatDateBR(project.startDate) : "—"}
                    {project.endDate ? ` até ${formatDateBR(project.endDate)}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.budgetAmount != null
                      ? formatCurrencyBRL(Number(project.budgetAmount))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(project);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`Excluir o projeto "${project.name}"?`)) {
                              deleteProject.mutate(project.id);
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

      {dialogOpen && selectedCompanyId && (
        <ProjectDialog
          key={editing?.id ?? "novo"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={selectedCompanyId}
          project={editing}
          isSubmitting={createProject.isPending || updateProject.isPending}
          onSubmit={async (payload) => {
            if (editing) await updateProject.mutateAsync({ id: editing.id, payload });
            else await createProject.mutateAsync({ ...payload, companyId: selectedCompanyId });
          }}
        />
      )}
    </div>
  );
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  project: Project | null;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

function ProjectDialog({
  open,
  onOpenChange,
  companyId,
  project,
  isSubmitting,
  onSubmit,
}: ProjectDialogProps) {
  const [code, setCode] = React.useState(project?.code ?? "");
  const [name, setName] = React.useState(project?.name ?? "");
  const [status, setStatus] = React.useState<ProjectStatus>(project?.status ?? "PLANNING");
  const [startDate, setStartDate] = React.useState(project?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = React.useState(project?.endDate?.slice(0, 10) ?? "");
  const [budgetAmount, setBudgetAmount] = React.useState<string>(
    project?.budgetAmount != null ? String(project.budgetAmount) : "",
  );
  const [costCenterId, setCostCenterId] = React.useState(project?.costCenterId ?? undefined);
  const [resultCenterId, setResultCenterId] = React.useState(project?.resultCenterId ?? undefined);
  const [error, setError] = React.useState<string | null>(null);

  const { data: costCenters } = useCostCenters(companyId);
  const { data: resultCenters } = useResultCenters(companyId);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({
        code: code.trim() || undefined,
        name: name.trim(),
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        budgetAmount: budgetAmount ? Number(budgetAmount) : undefined,
        costCenterId,
        resultCenterId,
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Não foi possível salvar o projeto.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Editar projeto" : "+ Incluir novo projeto"}</DialogTitle>
          <DialogDescription>
            Um lançamento poderá ser vinculado a este projeto quando o módulo financeiro existir.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PRJ-001" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data de término</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Orçamento</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Centro de custo</Label>
            <Select value={costCenterId} onValueChange={setCostCenterId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(costCenters ?? []).map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Centro de resultado</Label>
            <Select value={resultCenterId} onValueChange={setResultCenterId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(resultCenters ?? []).map((rc) => (
                  <SelectItem key={rc.id} value={rc.id}>
                    {rc.name}
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
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
