"use client";

import * as React from "react";
import { FileText, Upload } from "lucide-react";

import { useCustomerDocuments, useUploadCustomerDocument } from "@/lib/api/customers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormLabel } from "@/components/ui/form";

interface StepDocumentsProps {
  customerId?: string;
  onRequestSaveDraft: () => void;
  isSavingDraft: boolean;
}

export function StepDocuments({ customerId, onRequestSaveDraft, isSavingDraft }: StepDocumentsProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { data: documents } = useCustomerDocuments(customerId);
  const uploadDocument = useUploadCustomerDocument(customerId ?? "");

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadDocument.mutate({ file });
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <FormLabel>Documentos</FormLabel>
      {!customerId ? (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Salve o cadastro como rascunho para anexar documentos (contrato social, comprovante de endereço, cartão CNPJ, contratos assinados).
          </p>
          <Button type="button" variant="outline" onClick={onRequestSaveDraft} disabled={isSavingDraft}>
            Salvar como rascunho
          </Button>
        </Card>
      ) : (
        <>
          {(documents ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>}
          <ul className="flex flex-col gap-2">
            {(documents ?? []).map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                {doc.fileName}
              </li>
            ))}
          </ul>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" className="w-fit" onClick={() => fileInputRef.current?.click()} disabled={uploadDocument.isPending}>
            <Upload /> Incluir novo documento
          </Button>
        </>
      )}
    </div>
  );
}
