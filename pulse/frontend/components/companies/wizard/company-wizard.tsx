"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";

import { useCompany, useCreateCompany, useSaveDraftCompany, useUpdateCompany } from "@/lib/api/companies";
import { ApiRequestError } from "@/lib/api/client";
import { companyToFormValues, defaultCompanyFormValues, sanitizeCompanyPayload } from "@/lib/mappers/company";
import { cn } from "@/lib/utils";
import { COMPANY_FORM_STEP_FIELDS, companyFormSchema, type CompanyFormSchema } from "@/lib/validation/company";
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
import { StepAddresses } from "./steps/step-addresses";
import { StepContacts } from "./steps/step-contacts";
import { StepFinancialSettings } from "./steps/step-financial-settings";
import { StepIdentification } from "./steps/step-identification";
import { StepRegistrationData } from "./steps/step-registration-data";
import { StepReview } from "./steps/step-review";
import { StepTaxInfo } from "./steps/step-tax-info";
import { StepUsers } from "./steps/step-users";

const STEP_LABELS = [
  "Identificação",
  "Dados cadastrais",
  "Endereços",
  "Contatos",
  "Informações fiscais",
  "Configurações financeiras",
  "Usuários",
  "Revisão",
];

interface CompanyWizardProps {
  draftId?: string;
  preferredOrganizationId?: string;
}

export function CompanyWizard({ draftId, preferredOrganizationId }: CompanyWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [companyId, setCompanyId] = React.useState<string | undefined>(draftId);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const hasHydrated = React.useRef(false);

  const { data: draftCompany } = useCompany(draftId);

  const form = useForm<CompanyFormSchema>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: defaultCompanyFormValues(preferredOrganizationId),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (draftCompany && !hasHydrated.current) {
      form.reset(companyToFormValues(draftCompany));
      hasHydrated.current = true;
    }
  }, [draftCompany, form]);

  React.useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (form.formState.isDirty) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty]);

  const createCompany = useCreateCompany();
  const saveDraft = useSaveDraftCompany();
  const updateCompany = useUpdateCompany(companyId ?? "");

  const isLastStep = step === STEP_LABELS.length - 1;

  async function handleSaveDraft() {
    setSubmitError(null);
    try {
      const values = form.getValues();
      const payload = sanitizeCompanyPayload({ ...values, id: companyId });
      const company = await saveDraft.mutateAsync(payload);
      setCompanyId(company.id);
      router.replace(`/cadastros/empresas/nova?draftId=${company.id}`, { scroll: false });
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível salvar o rascunho.");
    }
  }

  async function handleNext() {
    const fields = COMPANY_FORM_STEP_FIELDS[step];
    const valid = fields.length === 0 || (await form.trigger(fields as (keyof CompanyFormSchema)[]));
    if (valid) setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleCancel() {
    if (form.formState.isDirty) {
      setCancelDialogOpen(true);
    } else {
      router.push("/cadastros/empresas");
    }
  }

  async function handleComplete() {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) {
      setStep(0);
      return;
    }

    const values = form.getValues();
    const payload = sanitizeCompanyPayload(values);

    try {
      const company = companyId
        ? await updateCompany.mutateAsync(payload)
        : await createCompany.mutateAsync(payload);
      setCompanyId(company.id);
      setCompleted(true);
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível concluir o cadastro.");
    }
  }

  const isSaving = createCompany.isPending || updateCompany.isPending || saveDraft.isPending;

  if (completed && companyId) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="text-xl font-semibold">Empresa incluída com sucesso.</h1>
        <p className="text-sm text-muted-foreground">
          O cadastro está em implantação. Para liberar os lançamentos financeiros, ative a empresa na
          tela de detalhes.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/cadastros/empresas")}>
            Ir para a listagem
          </Button>
          <Button onClick={() => router.push(`/cadastros/empresas/${companyId}`)}>Ver empresa</Button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incluir nova empresa</h1>
          <p className="text-sm text-muted-foreground">
            Preencha as etapas abaixo. Você pode salvar como rascunho e retomar depois.
          </p>
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
                <span className="flex size-4 items-center justify-center rounded-full bg-black/10 text-[10px]">
                  {index + 1}
                </span>
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
          {step === 2 && <StepAddresses />}
          {step === 3 && <StepContacts />}
          {step === 4 && <StepTaxInfo />}
          {step === 5 && <StepFinancialSettings />}
          {step === 6 && (
            <StepUsers companyId={companyId} onRequestSaveDraft={handleSaveDraft} isSavingDraft={saveDraft.isPending} />
          )}
          {step === 7 && <StepReview companyId={companyId} onEditStep={setStep} />}
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
            <Button variant="destructive" onClick={() => router.push("/cadastros/empresas")}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
