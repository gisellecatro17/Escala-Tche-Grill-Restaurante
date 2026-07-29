"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useCostCenters, useCreateCostCenter } from "@/lib/api/taxonomy";
import { Button } from "@/components/ui/button";
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

interface CostCenterSelectProps {
  companyId: string | undefined;
  value: string | undefined;
  onChange: (costCenterId: string | undefined) => void;
  label?: string;
}

/** Seleção de centro de custo com cadastro rápido (seção 29 do prompt de fornecedores). */
export function CostCenterSelect({ companyId, value, onChange, label = "Centro de custo padrão" }: CostCenterSelectProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const { data: costCenters } = useCostCenters(companyId);
  const createCostCenter = useCreateCostCenter();

  async function handleCreate() {
    if (!companyId || !newName.trim()) return;
    const created = await createCostCenter.mutateAsync({ companyId, name: newName.trim() });
    onChange(created.id);
    setNewName("");
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange} disabled={!companyId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {(costCenters ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" disabled={!companyId} onClick={() => setDialogOpen(true)}>
          <Plus />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>+ Incluir novo centro de custo</DialogTitle>
            <DialogDescription>O centro de custo fica disponível imediatamente para este e outros fornecedores.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Nome do centro de custo" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createCostCenter.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
