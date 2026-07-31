"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useCompanies } from "@/lib/api/companies";
import { useDuplicateCompanySettings } from "@/lib/api/companies";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DUPLICATE_SETTINGS_ASPECTS, DUPLICATE_SETTINGS_ASPECT_LABELS, type DuplicateSettingsAspect } from "@/types/company";

interface DuplicateSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCompanyId: string;
  organizationId: string;
}

export function DuplicateSettingsDialog({
  open,
  onOpenChange,
  sourceCompanyId,
  organizationId,
}: DuplicateSettingsDialogProps) {
  const [targetCompanyId, setTargetCompanyId] = React.useState<string>("");
  const [aspects, setAspects] = React.useState<DuplicateSettingsAspect[]>([]);
  const { data: companies } = useCompanies({ organizationId, perPage: 100 });
  const mutation = useDuplicateCompanySettings(sourceCompanyId);

  const targets = companies?.items.filter((c) => c.id !== sourceCompanyId) ?? [];

  function toggleAspect(aspect: DuplicateSettingsAspect) {
    setAspects((prev) => (prev.includes(aspect) ? prev.filter((a) => a !== aspect) : [...prev, aspect]));
  }

  function handleSubmit() {
    if (!targetCompanyId || aspects.length === 0) return;
    mutation.mutate({ targetCompanyId, aspects });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar configurações</DialogTitle>
          <DialogDescription>
            Selecione a empresa de destino e os itens que deseja duplicar. Lançamentos, extratos,
            conciliações, fornecedores, clientes, contas bancárias e usuários nunca são copiados
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Empresa de destino</Label>
            <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a empresa de destino" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.displayName ?? company.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Itens a duplicar</Label>
            {DUPLICATE_SETTINGS_ASPECTS.map((aspect) => (
              <label key={aspect} className="flex items-center gap-2 text-sm">
                <Checkbox checked={aspects.includes(aspect)} onCheckedChange={() => toggleAspect(aspect)} />
                {DUPLICATE_SETTINGS_ASPECT_LABELS[aspect]}
              </label>
            ))}
          </div>

          {mutation.data && (
            <Alert>
              <AlertDescription className="flex flex-col gap-1">
                {mutation.data.results.map((r) => (
                  <span key={r.aspect}>
                    {DUPLICATE_SETTINGS_ASPECT_LABELS[r.aspect]}: {r.message}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button disabled={!targetCompanyId || aspects.length === 0 || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
