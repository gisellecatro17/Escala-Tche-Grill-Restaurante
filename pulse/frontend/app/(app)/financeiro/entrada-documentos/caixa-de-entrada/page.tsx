"use client";

import { DocumentInbox } from "@/components/document-intake/document-inbox";

export default function Page() {
  return (
    <DocumentInbox
      title="Caixa de Entrada"
      description="Revise e encaminhe os documentos recebidos."
      fixedFilters={{}}
    />
  );
}
