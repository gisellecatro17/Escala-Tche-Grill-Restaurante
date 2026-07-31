"use client";

import { DocumentInbox } from "@/components/document-intake/document-inbox";

export default function Page() {
  return (
    <DocumentInbox
      title="Duplicidades"
      description="Documentos com suspeita de duplicidade aguardando decisão."
      fixedFilters={{ duplicateStatus: "POSSIBLE_DUPLICATE" }}
    />
  );
}
