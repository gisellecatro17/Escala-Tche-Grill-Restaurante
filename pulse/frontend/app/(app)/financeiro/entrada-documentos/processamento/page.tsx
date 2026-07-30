"use client";

import { DocumentInbox } from "@/components/document-intake/document-inbox";

export default function Page() {
  return (
    <DocumentInbox
      title="Em Processamento"
      description="Documentos que o sistema está lendo e identificando neste momento."
      fixedFilters={{ processingStatus: "EXTRACTING" }}
    />
  );
}
