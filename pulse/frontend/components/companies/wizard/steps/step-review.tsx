"use client";

import { Pencil } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { useCompanyUsers } from "@/lib/api/companies";
import { useOrganizations } from "@/lib/api/organizations";
import { formatCurrencyBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyFormSchema } from "@/lib/validation/company";
import {
  ACCOUNTING_CRITERION_LABELS,
  ADDRESS_TYPE_LABELS,
  ESTABLISHMENT_TYPE_LABELS,
  TAX_REGIME_LABELS,
} from "@/types/company";

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

export function StepReview({ companyId, onEditStep }: { companyId?: string; onEditStep: (step: number) => void }) {
  const form = useFormContext<CompanyFormSchema>();
  const values = form.getValues();
  const { data: organizations } = useOrganizations();
  const { data: memberships } = useCompanyUsers(companyId);

  const organizationName = organizations?.items.find((o) => o.id === values.organizationId)?.name;
  const addresses = values.addresses ?? [];
  const primaryAddress = addresses.find((a) => a.isPrimary) ?? addresses[0];

  return (
    <div className="flex flex-col gap-4">
      <ReviewSection title="Identificação" stepIndex={0} onEditStep={onEditStep}>
        <p className="font-medium">{values.displayName}</p>
        <p className="text-muted-foreground">{values.legalName}</p>
        <p className="text-muted-foreground">Documento: {values.documentNumber}</p>
        <p className="text-muted-foreground">Organização: {organizationName ?? "—"}</p>
        <p className="text-muted-foreground">Tipo: {ESTABLISHMENT_TYPE_LABELS[values.establishmentType]}</p>
      </ReviewSection>

      <ReviewSection title="Endereço" stepIndex={2} onEditStep={onEditStep}>
        {primaryAddress ? (
          <>
            <p>
              {primaryAddress.street}
              {primaryAddress.number ? `, ${primaryAddress.number}` : ""}
            </p>
            <p className="text-muted-foreground">
              {ADDRESS_TYPE_LABELS[primaryAddress.addressType]} — {primaryAddress.city} / {primaryAddress.state}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Nenhum endereço informado.</p>
        )}
      </ReviewSection>

      <ReviewSection title="Informações fiscais" stepIndex={4} onEditStep={onEditStep}>
        <p>Regime: {values.taxRegime ? TAX_REGIME_LABELS[values.taxRegime] : "Não informado"}</p>
        <p className="text-muted-foreground">
          Apuração: {values.taxAssessmentMethod ? ACCOUNTING_CRITERION_LABELS[values.taxAssessmentMethod] : "—"}
        </p>
      </ReviewSection>

      <ReviewSection title="Configurações financeiras" stepIndex={5} onEditStep={onEditStep}>
        <p>Critério: {ACCOUNTING_CRITERION_LABELS[values.financialMethod ?? "ACCRUAL"]}</p>
        <p className="text-muted-foreground">Categoria obrigatória: {values.requiresCategory ? "Sim" : "Não"}</p>
        <p className="text-muted-foreground">Dia de fechamento: {values.monthClosingDay ?? 31}</p>
        {values.shareCapital !== undefined && (
          <p className="text-muted-foreground">Capital social: {formatCurrencyBRL(values.shareCapital)}</p>
        )}
      </ReviewSection>

      <ReviewSection title="Usuários" stepIndex={6} onEditStep={onEditStep}>
        <p>
          {memberships?.items.length
            ? `${memberships.items.length} usuário(s) vinculado(s)`
            : "Nenhum usuário vinculado ainda."}
        </p>
      </ReviewSection>
    </div>
  );
}
