"use client";

import { EntryList } from "@/components/document-processing/entry-list";

export default function Page() {
  return (
    <EntryList
      title="Contas a pagar"
      description="Obrigações geradas a partir dos documentos processados."
      fixedFilters={{ direction: "PAYABLE" }}
    />
  );
}
