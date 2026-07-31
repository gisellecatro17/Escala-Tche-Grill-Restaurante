"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";

import { api, ApiRequestError } from "@/lib/api/client";
import { useCreateSupplier, useSaveDraftSupplier, useSupplier, useUpdateSupplier } from "@/lib/api/suppliers";
import type { Supplier, SupplierCompanyLink } from "@/types/supplier";
import { buildSupplierSubmissionPayload, defaultSupplierFormValues, supplierToFormValues } from "@/lib/mappers/supplier";
import { useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { SUPPLIER_FORM_STEP_FIELDS, supplierFormSchema, type SupplierFormSchema } from "@/lib/validation/supplier";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepAddressesContacts } from "./steps/step-addresses-contacts";
import { StepAutomationRules } from "./steps/step-automation-rules";
import { StepBankPix } from "./steps/step-bank-pix";
import { StepClassification } from "./steps/step-classification";
import { StepCommercialTerms } from "./steps/step-commercial-terms";
import { StepContractsDocuments } from "./steps/step-contracts-documents";
import { StepIdentification } from "./steps/step-identification";
import { StepRegistrationData } from "./steps/step-registration-data";
import { StepReview } from "./steps/step-review";
import { StepWithholdingsAllocations } from "./steps/step-withholdings-allocations";

const STEP_LABELS = [
  "Identificação",
  "Dados cadastrais",
  "Endereços e contatos",
  "Dados bancários e PIX",
  "Classificação financeira",
  "Condições comerciais",
  "Retenções e rateios",
  "Regras automáticas",
  "Contratos e documentos",
  "Revisão",
];

interface SupplierWizardProps {
  draftId?: string;
  preferredCompanyId?: string;
}

export function SupplierWizard({ draftId, preferredCompanyId }: SupplierWizardProps) {
  const router = useRouter();
  const { user } = useSession();
  const [step, setStep] = React.useState(0);
  const [supplierId, setSupplierId] = React.useState<string | undefined>(draftId);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const hasHydrated = React.useRef(false);

  const preferredOrganizationId = user?.organizationMemberships[0]?.organizationId;
  const { data: draftSupplier } = useSupplier(draftId);

  const form = useForm<SupplierFormSchema>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: defaultSupplierFormValues(preferredOrganizationId, preferredCompanyId),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (draftSupplier && !hasHydrated.current) {
      const link = draftSupplier.companyLinks.find((l) => l.companyId === preferredCompanyId) ?? draftSupplier.companyLinks[0];
      form.reset(supplierToFormValues(draftSupplier, link, draftSupplier.organizationId));
      hasHydrated.current = true;
    }
  }, [draftSupplier, form, preferredCompanyId]);

  React.useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (form.formState.isDirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty]);

  const createSupplier = useCreateSupplier();
  const saveDraft = useSaveDraftSupplier();
  const updateSupplier = useUpdateSupplier(supplierId ?? "");

  const isLastStep = step === STEP_LABELS.length - 1;

  async function handleSaveDraft() {
    setSubmitError(null);
    try {
      const { supplierPayload } = buildSupplierSubmissionPayload({ ...form.getValues(), id: supplierId });
      const supplier = await saveDraft.mutateAsync(supplierPayload);
      setSupplierId(supplier.id);
      router.replace(`/cadastros/fornecedores/novo?draftId=${supplier.id}`, { scroll: false });
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível salvar o rascunho.");
    }
  }

  async function handleNext() {
    const fields = SUPPLIER_FORM_STEP_FIELDS[step];
    const valid = fields.length === 0 || (await form.trigger(fields as (keyof SupplierFormSchema)[]));
    if (valid) setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleCancel() {
    if (form.formState.isDirty) setCancelDialogOpen(true);
    else router.push("/cadastros/fornecedores");
  }

  async function handleComplete() {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) {
      setStep(0);
      return;
    }

    const values = form.getValues();
    const { supplierPayload, allocations, taxWithholdings, contracts, preferredBankAccountIndex, preferredPixKeyIndex } =
      buildSupplierSubmissionPayload({ ...values, id: supplierId });

    try {
      let resultSupplierId = supplierId;
      let linkId: string | undefined;
      let bankAccounts: Supplier["bankAccounts"] = [];
      let pixKeys: Supplier["pixKeys"] = [];

      if (!resultSupplierId) {
        const supplier = await createSupplier.mutateAsync(supplierPayload);
        resultSupplierId = supplier.id;
        linkId = supplier.companyLinks[0]?.id;
        bankAccounts = supplier.bankAccounts;
        pixKeys = supplier.pixKeys;
      } else {
        const { organizationId: _org, companyLink, ...globalPayload } = supplierPayload;
        void _org;
        const supplier = await updateSupplier.mutateAsync(globalPayload);
        bankAccounts = supplier.bankAccounts;
        pixKeys = supplier.pixKeys;

        const existingLink = supplier.companyLinks.find((l: SupplierCompanyLink) => l.companyId === values.companyId);
        if (existingLink) {
          await api.patch(`/supplier-company-links/${existingLink.id}`, companyLink);
          linkId = existingLink.id;
        } else {
          const link = await api.post<SupplierCompanyLink>(`/suppliers/${resultSupplierId}/company-links`, companyLink);
          linkId = link.id;
        }
      }

      if (linkId) {
        const preferredPatch: Record<string, unknown> = {};
        if (preferredBankAccountIndex !== undefined && bankAccounts[preferredBankAccountIndex]) {
          preferredPatch.preferredBankAccountId = bankAccounts[preferredBankAccountIndex].id;
        }
        if (preferredPixKeyIndex !== undefined && pixKeys[preferredPixKeyIndex]) {
          preferredPatch.preferredPixKeyId = pixKeys[preferredPixKeyIndex].id;
        }
        if (Object.keys(preferredPatch).length > 0) {
          await api.patch(`/supplier-company-links/${linkId}`, preferredPatch);
        }

        for (const allocation of allocations.filter((a) => !a.id)) {
          await api.post(`/supplier-company-links/${linkId}/allocations`, allocation);
        }
        for (const withholding of taxWithholdings.filter((w) => !w.id)) {
          await api.post(`/supplier-company-links/${linkId}/tax-withholdings`, withholding);
        }
        for (const contract of contracts.filter((c) => !c.id)) {
          await api.post(`/supplier-company-links/${linkId}/contracts`, contract);
        }
      }

      setSupplierId(resultSupplierId);
      setCompleted(true);
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível concluir o cadastro.");
    }
  }

  const isSaving = createSupplier.isPending || updateSupplier.isPending || saveDraft.isPending;

  if (completed && supplierId) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="text-xl font-semibold">Fornecedor incluído com sucesso.</h1>
        <p className="text-sm text-muted-foreground">O fornecedor foi vinculado à empresa selecionada e já pode ser utilizado nas próximas etapas do sistema.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/cadastros/fornecedores")}>
            Ir para a listagem
          </Button>
          <Button onClick={() => router.push(`/cadastros/fornecedores/${supplierId}`)}>Ver fornecedor</Button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incluir novo fornecedor</h1>
          <p className="text-sm text-muted-foreground">Preencha as etapas abaixo. Você pode salvar como rascunho e retomar depois.</p>
        </div>

        <ol className="flex flex-wrap gap-2">
          {STEP_LABELS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  index === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : index < step
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-black/10 text-[10px]">{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        {submitError && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível concluir a operação.</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <div>
          {step === 0 && <StepIdentification />}
          {step === 1 && <StepRegistrationData />}
          {step === 2 && <StepAddressesContacts />}
          {step === 3 && <StepBankPix />}
          {step === 4 && <StepClassification />}
          {step === 5 && <StepCommercialTerms />}
          {step === 6 && <StepWithholdingsAllocations />}
          {step === 7 && <StepAutomationRules />}
          {step === 8 && (
            <StepContractsDocuments supplierId={supplierId} onRequestSaveDraft={handleSaveDraft} isSavingDraft={saveDraft.isPending} />
          )}
          {step === 9 && <StepReview onEditStep={setStep} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
              {saveDraft.isPending && <Loader2 className="animate-spin" />}
              Salvar como rascunho
            </Button>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                Voltar
              </Button>
            )}
            {!isLastStep ? (
              <Button type="button" onClick={handleNext}>
                Continuar
              </Button>
            ) : (
              <Button type="button" onClick={handleComplete} disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />}
                Concluir cadastro
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Existem alterações não salvas.</DialogTitle>
            <DialogDescription>Deseja realmente sair?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Continuar editando
            </Button>
            <Button variant="destructive" onClick={() => router.push("/cadastros/fornecedores")}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
