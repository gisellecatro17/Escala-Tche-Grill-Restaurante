"use client";

import { EntryList } from "@/components/document-processing/entry-list";

export default function Page() {
  return (
    <EntryList
      title="Contas a receber"
      description="Direitos gerados a partir dos documentos processados."
      fixedFilters={{ direction: "RECEIVABLE" }}
    />
  );
}
