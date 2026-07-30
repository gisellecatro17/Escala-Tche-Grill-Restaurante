"use client";

import { DocumentInbox } from "@/components/document-intake/document-inbox";

export default function Page() {
  return (
    <DocumentInbox
      title="Com Pendências"
      description="Documentos que precisam de uma decisão sua antes de seguir."
      fixedFilters={{ hasIssues: true }}
    />
  );
}
