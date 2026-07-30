"use client";

import { DocumentInbox } from "@/components/document-intake/document-inbox";

export default function Page() {
  return (
    <DocumentInbox
      title="Processados"
      description="Documentos prontos para o módulo financeiro."
      fixedFilters={{ processingStatus: "READY_FOR_PROCESSING" }}
    />
  );
}
