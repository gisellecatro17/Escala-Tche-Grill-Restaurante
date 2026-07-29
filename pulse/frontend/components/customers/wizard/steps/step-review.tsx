"use client";

import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { useCompany } from "@/lib/api/companies";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CUSTOMER_PAYMENT_METHOD_LABELS } from "@/types/customer";

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
  const form = useFormContext<CustomerFormSchema>();
  const values = form.getValues();
  const { data: company } = useCompany(values.companyId);

  return (
    <div className="flex flex-col gap-4">
      <ReviewSection title="Identificação" stepIndex={0} onEditStep={onEditStep}>
        <p className="font-medium">{values.displayName}</p>
        <p className="text-muted-foreground">{values.legalName}</p>
        <p className="text-muted-foreground">Documento: {values.documentNumber || values.foreignDocument || "—"}</p>
      </ReviewSection>

      <ReviewSection title="Empresa vinculada" stepIndex={0} onEditStep={onEditStep}>
        <p>{company?.displayName ?? company?.legalName ?? "—"}</p>
        <p className="text-muted-foreground">O cliente será incluído como Prospect nesta empresa.</p>
      </ReviewSection>

      <ReviewSection title="Endereços e contatos" stepIndex={2} onEditStep={onEditStep}>
        <p className="text-muted-foreground">{values.addresses?.length ?? 0} endereço(s) · {values.contacts?.length ?? 0} contato(s)</p>
      </ReviewSection>

      <ReviewSection title="Classificação" stepIndex={3} onEditStep={onEditStep}>
        <p className="text-muted-foreground">Categoria de receita: {values.defaultRevenueCategoryId ? "Selecionada" : "Não informada"}</p>
        <p className="text-muted-foreground">Centro de resultado: {values.defaultResultCenterId ? "Selecionado" : "Não informado"}</p>
      </ReviewSection>

      <ReviewSection title="Condições de recebimento" stepIndex={4} onEditStep={onEditStep}>
        <p>Forma: {values.preferredPaymentMethod ? CUSTOMER_PAYMENT_METHOD_LABELS[values.preferredPaymentMethod] : "Não informada"}</p>
        <p className="text-muted-foreground">Prazo: {values.paymentTermDays ? `${values.paymentTermDays} dias` : "Não informado"}</p>
      </ReviewSection>

      <ReviewSection title="Crédito" stepIndex={5} onEditStep={onEditStep}>
        <p className="text-muted-foreground">Limite: {values.creditLimit !== undefined ? values.creditLimit : "Não informado"}</p>
      </ReviewSection>

      <ReviewSection title="Contratos e recorrências" stepIndex={7} onEditStep={onEditStep}>
        <p className="text-muted-foreground">{values.contracts?.length ?? 0} contrato(s) · {values.recurringReceivables?.length ?? 0} recorrência(s)</p>
      </ReviewSection>
    </div>
  );
}
