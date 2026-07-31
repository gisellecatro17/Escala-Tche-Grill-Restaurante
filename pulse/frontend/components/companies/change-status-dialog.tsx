"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => void;
}

/** Diálogo com motivo obrigatório — usado para inativar e suspender empresas. */
export function ChangeStatusDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isSubmitting,
  onConfirm,
}: ChangeStatusDialogProps) {
  const [reason, setReason] = React.useState("");

  // Limpa o campo sempre que o diálogo fecha (por qualquer motivo), em vez de fazer
  // isso em um efeito disparado pela abertura — evita setState síncrono dentro de effect.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setReason("");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="change-status-reason">Motivo</Label>
          <Textarea
            id="change-status-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo desta ação"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isSubmitting}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
