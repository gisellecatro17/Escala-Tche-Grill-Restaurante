"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

interface MaskedInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string | null;
  onChange: (value: string) => void;
  mask: (value: string) => string;
}

/** Input controlado que aplica uma máscara (CNPJ/CPF/CEP/telefone) a cada digitação. */
export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, mask, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        value={value ?? ""}
        onChange={(event) => onChange(mask(event.target.value))}
      />
    );
  },
);

MaskedInput.displayName = "MaskedInput";
