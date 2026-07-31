"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { useCompanies } from "@/lib/api/companies";
import { useDuplicateSupplierLink } from "@/lib/api/suppliers";
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
import { DUPLICATE_LINK_ASPECTS, DUPLICATE_LINK_ASPECT_LABELS, type DuplicateLinkAspect } from "@/types/supplier";

interface DuplicateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkId: string;
  organizationId: string;
  currentCompanyId: string;
}

/** Duplicar vínculo para outra empresa (seção 52 do prompt de fornecedores) — nunca
 * duplica o cadastro global, apenas cria um novo vínculo com os itens selecionados. */
export function DuplicateLinkDialog({ open, onOpenChange, linkId, organizationId, currentCompanyId }: DuplicateLinkDialogProps) {
  const [targetCompanyId, setTargetCompanyId] = React.useState("");
  const [aspects, setAspects] = React.useState<DuplicateLinkAspect[]>([]);
  const { data: companies } = useCompanies({ organizationId, perPage: 100 });
  const mutation = useDuplicateSupplierLink(linkId);

  const targets = companies?.items.filter((c) => c.id !== currentCompanyId) ?? [];

  function toggleAspect(aspect: DuplicateLinkAspect) {
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
          <DialogTitle>Duplicar vínculo</DialogTitle>
          <DialogDescription>
            Selecione a empresa de destino e os itens que deseja copiar. O cadastro global do fornecedor não é
            duplicado — apenas um novo vínculo é criado para a empresa selecionada.
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
            <Label>Itens a copiar</Label>
            {DUPLICATE_LINK_ASPECTS.map((aspect) => (
              <label key={aspect} className="flex items-center gap-2 text-sm">
                <Checkbox checked={aspects.includes(aspect)} onCheckedChange={() => toggleAspect(aspect)} />
                {DUPLICATE_LINK_ASPECT_LABELS[aspect]}
              </label>
            ))}
          </div>

          {mutation.isSuccess && mutation.data && (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertDescription className="flex flex-col gap-2">
                Vínculo duplicado com sucesso.
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href={`/cadastros/fornecedores/${mutation.data.supplierId}/empresas/${mutation.data.id}`}>
                    Ver novo vínculo
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>Não foi possível duplicar o vínculo.</AlertDescription>
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
