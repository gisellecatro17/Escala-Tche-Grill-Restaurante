"use client";

import { DocumentInbox } from "@/components/document-intake/document-inbox";

export default function Page() {
  return (
    <DocumentInbox
      title="Com Erro"
      description="Documentos cujo processamento falhou depois de esgotadas as tentativas."
      fixedFilters={{ processingStatus: "ERROR" }}
    />
  );
}
