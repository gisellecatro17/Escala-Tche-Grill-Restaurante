"use client";

import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { useCompany } from "@/lib/api/companies";
import type { SupplierFormSchema } from "@/lib/validation/supplier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS } from "@/types/supplier";

interface ReviewSectionProps {
  title: string;
  stepIndex: number;
  onEditStep: (step: number) => void;
  children: React.ReactNode;
}

function ReviewSection({ title, stepIndex, onEditStep, children }: ReviewSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase">{title}</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(stepIndex)}>
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export function StepReview({ onEditStep }: { onEditStep: (step: number) => void }) {
  const form = useFormContext<SupplierFormSchema>();
  const values = form.getValues();
  const { data: company } = useCompany(values.companyId);

  return (
    <div className="flex flex-col gap-4">
      <ReviewSection title="Identificação" stepIndex={0} onEditStep={onEditStep}>
        <p className="font-medium">{values.displayName}</p>
        <p className="text-muted-foreground">{values.legalName}</p>
        <p className="text-muted-foreground">Documento: {values.documentNumber || values.foreignTaxId || "—"}</p>
      </ReviewSection>

      <ReviewSection title="Empresa vinculada" stepIndex={0} onEditStep={onEditStep}>
        <p>{company?.displayName ?? company?.legalName ?? "—"}</p>
      </ReviewSection>

      <ReviewSection title="Classificação" stepIndex={4} onEditStep={onEditStep}>
        <p className="text-muted-foreground">Categoria: {values.defaultCategoryId ? "Selecionada" : "Não informada"}</p>
        <p className="text-muted-foreground">Centro de custo: {values.defaultCostCenterId ? "Selecionado" : "Não informado"}</p>
      </ReviewSection>

      <ReviewSection title="Pagamento" stepIndex={5} onEditStep={onEditStep}>
        <p>Forma: {values.preferredPaymentMethod ? PAYMENT_METHOD_LABELS[values.preferredPaymentMethod] : "Não informada"}</p>
        <p className="text-muted-foreground">
          {values.bankAccounts?.length ?? 0} conta(s) bancária(s) · {values.pixKeys?.length ?? 0} chave(s) PIX
        </p>
      </ReviewSection>

      <ReviewSection title="Automações" stepIndex={7} onEditStep={onEditStep}>
        <p className="text-muted-foreground">Identificação bancária: {values.autoIdentificationEnabled ? "Ativada" : "Desativada"}</p>
        <p className="text-muted-foreground">Classificação automática: {values.autoClassificationEnabled ? "Ativada" : "Desativada"}</p>
        <p className="text-muted-foreground">Conciliação automática: {values.autoReconciliationEnabled ? "Ativada" : "Desativada"}</p>
      </ReviewSection>

      <ReviewSection title="Documentos" stepIndex={8} onEditStep={onEditStep}>
        <p className="text-muted-foreground">{values.contracts?.length ?? 0} contrato(s) informado(s)</p>
      </ReviewSection>
    </div>
  );
}
