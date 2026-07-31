"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";

import { api, ApiRequestError } from "@/lib/api/client";
import { useCreateCustomer, useSaveDraftCustomer, useCustomer, useUpdateCustomer } from "@/lib/api/customers";
import type { CustomerCompanyLink } from "@/types/customer";
import { buildCustomerSubmissionPayload, customerToFormValues, defaultCustomerFormValues } from "@/lib/mappers/customer";
import { useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { CUSTOMER_FORM_STEP_FIELDS, customerFormSchema, type CustomerFormSchema } from "@/lib/validation/customer";
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
import { StepBillingRules } from "./steps/step-billing-rules";
import { StepClassification } from "./steps/step-classification";
import { StepContractsRecurring } from "./steps/step-contracts-recurring";
import { StepCredit } from "./steps/step-credit";
import { StepDocuments } from "./steps/step-documents";
import { StepIdentification } from "./steps/step-identification";
import { StepPaymentTerms } from "./steps/step-payment-terms";
import { StepRegistrationData } from "./steps/step-registration-data";
import { StepReview } from "./steps/step-review";

const STEP_LABELS = [
  "Identificação",
  "Dados cadastrais",
  "Endereços e contatos",
  "Classificação comercial",
  "Condições de recebimento",
  "Crédito e situação financeira",
  "Regras de cobrança",
  "Contratos e recorrências",
  "Documentos",
  "Revisão",
];

interface CustomerWizardProps {
  draftId?: string;
  preferredCompanyId?: string;
}

export function CustomerWizard({ draftId, preferredCompanyId }: CustomerWizardProps) {
  const router = useRouter();
  const { user } = useSession();
  const [step, setStep] = React.useState(0);
  const [customerId, setCustomerId] = React.useState<string | undefined>(draftId);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const hasHydrated = React.useRef(false);

  const preferredOrganizationId = user?.organizationMemberships[0]?.organizationId;
  const { data: draftCustomer } = useCustomer(draftId);

  const form = useForm<CustomerFormSchema>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultCustomerFormValues(preferredOrganizationId, preferredCompanyId),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (draftCustomer && !hasHydrated.current) {
      const link = draftCustomer.companyLinks.find((l) => l.companyId === preferredCompanyId) ?? draftCustomer.companyLinks[0];
      form.reset(customerToFormValues(draftCustomer, link, draftCustomer.organizationId));
      hasHydrated.current = true;
    }
  }, [draftCustomer, form, preferredCompanyId]);

  React.useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (form.formState.isDirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty]);

  const createCustomer = useCreateCustomer();
  const saveDraft = useSaveDraftCustomer();
  const updateCustomer = useUpdateCustomer(customerId ?? "");

  const isLastStep = step === STEP_LABELS.length - 1;

  async function handleSaveDraft() {
    setSubmitError(null);
    try {
      const { customerPayload } = buildCustomerSubmissionPayload({ ...form.getValues(), id: customerId });
      const customer = await saveDraft.mutateAsync(customerPayload);
      setCustomerId(customer.id);
      router.replace(`/cadastros/clientes/novo?draftId=${customer.id}`, { scroll: false });
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível salvar o rascunho.");
    }
  }

  async function handleNext() {
    const fields = CUSTOMER_FORM_STEP_FIELDS[step];
    const valid = fields.length === 0 || (await form.trigger(fields as (keyof CustomerFormSchema)[]));
    if (valid) setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleCancel() {
    if (form.formState.isDirty) setCancelDialogOpen(true);
    else router.push("/cadastros/clientes");
  }

  async function handleComplete() {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) {
      setStep(0);
      return;
    }

    const values = form.getValues();
    const { customerPayload, creditPayload, contracts, recurringReceivables } = buildCustomerSubmissionPayload({
      ...values,
      id: customerId,
    });

    try {
      let resultCustomerId = customerId;
      let linkId: string | undefined;

      if (!resultCustomerId) {
        const customer = await createCustomer.mutateAsync(customerPayload);
        resultCustomerId = customer.id;
        linkId = customer.companyLinks[0]?.id;
      } else {
        const { organizationId: _org, companyLink, ...globalPayload } = customerPayload as Record<string, unknown> & {
          organizationId?: string;
          companyLink: Record<string, unknown>;
        };
        void _org;
        const customer = await updateCustomer.mutateAsync(globalPayload);

        const existingLink = customer.companyLinks.find((l: CustomerCompanyLink) => l.companyId === values.companyId);
        if (existingLink) {
          await api.patch(`/customer-company-links/${existingLink.id}`, companyLink);
          linkId = existingLink.id;
        } else {
          const link = await api.post<CustomerCompanyLink>(`/customers/${resultCustomerId}/company-links`, companyLink);
          linkId = link.id;
        }
      }

      if (linkId) {
        if (Object.keys(creditPayload).length > 0) {
          await api.patch(`/customer-company-links/${linkId}/credit`, creditPayload);
        }
        for (const contract of contracts.filter((c) => !c.id)) {
          await api.post(`/customer-company-links/${linkId}/contracts`, contract);
        }
        for (const receivable of recurringReceivables.filter((r) => !r.id)) {
          await api.post(`/customer-company-links/${linkId}/recurring-receivables`, receivable);
        }
      }

      setCustomerId(resultCustomerId);
      setCompleted(true);
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível concluir o cadastro.");
    }
  }

  const isSaving = createCustomer.isPending || updateCustomer.isPending || saveDraft.isPending;

  if (completed && customerId) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="text-xl font-semibold">Cliente incluído com sucesso.</h1>
        <p className="text-sm text-muted-foreground">
          O cliente foi vinculado à empresa selecionada como Prospect e já pode ser convertido em cliente ativo quando as
          pendências forem resolvidas.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/cadastros/clientes")}>
            Ir para a listagem
          </Button>
          <Button onClick={() => router.push(`/cadastros/clientes/${customerId}`)}>Ver cliente</Button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incluir novo cliente</h1>
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
          {step === 3 && <StepClassification />}
          {step === 4 && <StepPaymentTerms />}
          {step === 5 && <StepCredit />}
          {step === 6 && <StepBillingRules />}
          {step === 7 && <StepContractsRecurring />}
          {step === 8 && (
            <StepDocuments customerId={customerId} onRequestSaveDraft={handleSaveDraft} isSavingDraft={saveDraft.isPending} />
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
            <Button variant="destructive" onClick={() => router.push("/cadastros/clientes")}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
