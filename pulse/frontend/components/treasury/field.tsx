import * as React from "react";

import { Label } from "@/components/ui/label";

/**
 * Rótulo + controle + dica, no mesmo espaçamento em todas as telas da tesouraria.
 * Nasceu dentro do wizard de contas e foi extraído quando as telas de cartões,
 * chaves PIX e formas de pagamento passaram a precisar do mesmo arranjo.
 */
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
