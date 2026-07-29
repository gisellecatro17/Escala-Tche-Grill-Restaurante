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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROOT_VALUE = "__root__";

interface MoveNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeName: string;
  options: { id: string; label: string; depth: number }[];
  isSubmitting: boolean;
  onSubmit: (parentId: string | null, reason: string | undefined) => Promise<unknown>;
}

/**
 * Move um nó para outro pai. A validação de ciclo (mover para dentro de um descendente)
 * é feita no back-end, que também versiona a árvore antes de aplicar.
 */
export function MoveNodeDialog({
  open,
  onOpenChange,
  nodeName,
  options,
  isSubmitting,
  onSubmit,
}: MoveNodeDialogProps) {
  const [parentId, setParentId] = React.useState<string>(ROOT_VALUE);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await onSubmit(parentId === ROOT_VALUE ? null : parentId, reason || undefined);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.message
          : "Não foi possível mover o registro.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover &quot;{nodeName}&quot;</DialogTitle>
          <DialogDescription>
            A estrutura atual é versionada automaticamente antes da movimentação, permitindo
            restaurá-la depois.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Novo item pai</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_VALUE}>Raiz da árvore</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {" ".repeat(option.depth * 3)}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Motivo (opcional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
