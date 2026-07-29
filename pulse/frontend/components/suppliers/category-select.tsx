"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useCategories, useCreateCategory } from "@/lib/api/taxonomy";
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

interface CategorySelectProps {
  companyId: string | undefined;
  value: string | undefined;
  onChange: (categoryId: string | undefined) => void;
  parentCategoryId?: string;
  label: string;
  placeholder?: string;
}

/** Seleção de categoria/subcategoria com cadastro rápido (seção 29 do prompt de fornecedores) —
 * abre um diálogo sem sair do cadastro e seleciona automaticamente o item criado. */
export function CategorySelect({ companyId, value, onChange, parentCategoryId, label, placeholder }: CategorySelectProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const { data: categories } = useCategories(companyId);
  const createCategory = useCreateCategory();

  const filtered = parentCategoryId
    ? (categories ?? []).filter((c) => c.parentCategoryId === parentCategoryId)
    : (categories ?? []).filter((c) => !c.parentCategoryId);

  async function handleCreate() {
    if (!companyId || !newName.trim()) return;
    const created = await createCategory.mutateAsync({ companyId, name: newName.trim(), parentCategoryId });
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
            <SelectValue placeholder={placeholder ?? "Selecione"} />
          </SelectTrigger>
          <SelectContent>
            {filtered.map((c) => (
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
            <DialogTitle>+ Incluir nova categoria</DialogTitle>
            <DialogDescription>A categoria fica disponível imediatamente para este e outros fornecedores.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Nome da categoria" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createCategory.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
