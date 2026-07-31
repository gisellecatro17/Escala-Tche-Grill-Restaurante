"use client";

import { EntryList } from "@/components/document-processing/entry-list";

/**
 * Pré-lançamentos a pagar.
 *
 * Não confundir com Contas a Pagar: aqui está o que o processamento produziu e ainda pode
 * ser corrigido ou cancelado. O título — a obrigação de verdade, com saldo e baixa — nasce
 * depois da aprovação e vive em `/financeiro/contas-a-pagar`.
 */
export default function Page() {
  return (
    <EntryList
      title="Lançamentos a pagar"
      description="Pré-lançamentos gerados pelo processamento. Depois de aprovados viram títulos no Contas a Pagar."
      fixedFilters={{ direction: "PAYABLE" }}
    />
  );
}
