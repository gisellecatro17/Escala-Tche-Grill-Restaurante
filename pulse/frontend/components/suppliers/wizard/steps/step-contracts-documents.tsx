"use client";

import * as React from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { useSupplierDocuments, useUploadSupplierDocument } from "@/lib/api/suppliers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SupplierFormSchema } from "@/lib/validation/supplier";

interface StepContractsDocumentsProps {
  supplierId?: string;
  onRequestSaveDraft: () => void;
  isSavingDraft: boolean;
}

export function StepContractsDocuments({ supplierId, onRequestSaveDraft, isSavingDraft }: StepContractsDocumentsProps) {
  const form = useFormContext<SupplierFormSchema>();
  const contracts = useFieldArray({ control: form.control, name: "contracts" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { data: documents } = useSupplierDocuments(supplierId);
  const uploadDocument = useUploadSupplierDocument(supplierId ?? "");

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadDocument.mutate({ file });
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FormLabel>Contratos</FormLabel>
        {contracts.fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <span className="text-sm font-medium">Contrato {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => contracts.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`contracts.${index}.contractNumber`}
                render={({ field: numberField }) => (
                  <FormItem>
                    <FormLabel>Número do contrato</FormLabel>
                    <FormControl>
                      <Input {...numberField} value={numberField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.description`}
                render={({ field: descField }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...descField} value={descField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.startDate`}
                render={({ field: startField }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input type="date" {...startField} value={startField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.endDate`}
                render={({ field: endField }) => (
                  <FormItem>
                    <FormLabel>Data de término</FormLabel>
                    <FormControl>
                      <Input type="date" {...endField} value={endField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.contractValue`}
                render={({ field: valueField }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={valueField.value ?? ""}
                        onChange={(e) => valueField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.watch(`contracts.${index}.automaticRenewal`) ?? false}
                  onCheckedChange={(checked) => form.setValue(`contracts.${index}.automaticRenewal`, Boolean(checked))}
                />
                Renovação automática
              </label>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => contracts.append({})}>
          <Plus /> Incluir novo contrato
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <FormLabel>Documentos</FormLabel>
        {!supplierId ? (
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Salve o cadastro como rascunho para anexar documentos (cartão CNPJ, contrato, certidões, comprovantes).
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
    </div>
  );
}
