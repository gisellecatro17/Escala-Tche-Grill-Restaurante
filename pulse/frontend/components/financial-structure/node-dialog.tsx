"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";

export interface NodeFormValues {
  code: string;
  name: string;
  description: string;
  notes: string;
}

interface NodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Valores iniciais — a chave `key` do diálogo controla a reinicialização. */
  initialValues?: Partial<NodeFormValues>;
  requireCode?: boolean;
  isSubmitting: boolean;
  onSubmit: (values: NodeFormValues) => Promise<unknown>;
  /** Campos extras específicos de cada cadastro (tipo da conta, natureza, ...). */
  children?: React.ReactNode;
}

/**
 * Diálogo de inclusão/edição usado por todos os cadastros em árvore da estrutura
 * financeira. Campos específicos entram via `children`.
 */
export function NodeDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValues,
  requireCode = false,
  isSubmitting,
  onSubmit,
  children,
}: NodeDialogProps) {
  const [code, setCode] = React.useState(initialValues?.code ?? "");
  const [name, setName] = React.useState(initialValues?.name ?? "");
  const [descriptionValue, setDescriptionValue] = React.useState(
    initialValues?.description ?? "",
  );
  const [notes, setNotes] = React.useState(initialValues?.notes ?? "");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit({ code, name, description: descriptionValue, notes });
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Não foi possível salvar o registro.",
      );
    }
  }

  const canSubmit = name.trim().length > 0 && (!requireCode || code.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Código{requireCode ? "" : " (opcional)"}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1.1.01" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          {children}

          <div className="flex flex-col gap-1.5">
            <Label>Detalhamento</Label>
            <Input
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
