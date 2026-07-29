"use client";

import { Loader2, Search } from "lucide-react";

import { useQueryPostalCode } from "@/lib/api/companies";
import { Button } from "@/components/ui/button";
import type { PostalCodeResult } from "@/types/company";

interface PostalCodeQueryButtonProps {
  postalCode: string;
  onResult: (result: PostalCodeResult) => void;
}

/** Botão de busca de CEP (seção 23 do prompt mestre). Nunca sobrescreve campos sem confirmação do chamador. */
export function PostalCodeQueryButton({ postalCode, onResult }: PostalCodeQueryButtonProps) {
  const mutation = useQueryPostalCode();
  const digits = postalCode.replace(/\D/g, "");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={digits.length !== 8 || mutation.isPending}
      onClick={() => mutation.mutate(digits, { onSuccess: onResult })}
    >
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Search />}
      Buscar CEP
    </Button>
  );
}
