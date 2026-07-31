"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";

import { useCompany, useUpdateCompany } from "@/lib/api/companies";
import { ApiRequestError } from "@/lib/api/client";
import { companyToFormValues, sanitizeCompanyPayload } from "@/lib/mappers/company";
import { companyFormSchema, type CompanyFormSchema } from "@/lib/validation/company";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepAddresses } from "@/components/companies/wizard/steps/step-addresses";
import { StepContacts } from "@/components/companies/wizard/steps/step-contacts";
import { StepFinancialSettings } from "@/components/companies/wizard/steps/step-financial-settings";
import { StepIdentification } from "@/components/companies/wizard/steps/step-identification";
import { StepRegistrationData } from "@/components/companies/wizard/steps/step-registration-data";
import { StepTaxInfo } from "@/components/companies/wizard/steps/step-tax-info";
import { StepUsers } from "@/components/companies/wizard/steps/step-users";

export default function EditCompanyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const hasHydrated = React.useRef(false);

  const { data: company, isLoading } = useCompany(params.id);
  const updateCompany = useUpdateCompany(params.id);

  const form = useForm<CompanyFormSchema>({
    resolver: zodResolver(companyFormSchema),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (company && !hasHydrated.current) {
      form.reset(companyToFormValues(company));
      hasHydrated.current = true;
    }
  }, [company, form]);

  async function onSubmit(values: CompanyFormSchema) {
    setSubmitError(null);
    try {
      await updateCompany.mutateAsync(sanitizeCompanyPayload(values));
      router.push(`/cadastros/empresas/${params.id}`);
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível salvar as alterações.");
    }
  }

  function handleCancel() {
    if (form.formState.isDirty) {
      setCancelDialogOpen(true);
    } else {
      router.push(`/cadastros/empresas/${params.id}`);
    }
  }

  if (isLoading || !company) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editar empresa</h1>
          <p className="text-sm text-muted-foreground">{company.displayName ?? company.legalName}</p>
        </div>

        {submitError && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível salvar as alterações.</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="identificacao">
          <TabsList className="flex-wrap">
            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
            <TabsTrigger value="cadastrais">Dados cadastrais</TabsTrigger>
            <TabsTrigger value="enderecos">Endereços</TabsTrigger>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>
          <TabsContent value="identificacao">
            <StepIdentification />
          </TabsContent>
          <TabsContent value="cadastrais">
            <StepRegistrationData />
          </TabsContent>
          <TabsContent value="enderecos">
            <StepAddresses />
          </TabsContent>
          <TabsContent value="contatos">
            <StepContacts />
          </TabsContent>
          <TabsContent value="fiscal">
            <StepTaxInfo />
          </TabsContent>
          <TabsContent value="financeiro">
            <StepFinancialSettings />
          </TabsContent>
          <TabsContent value="usuarios">
            <StepUsers companyId={company.id} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={updateCompany.isPending}>
            {updateCompany.isPending && <Loader2 className="animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </form>

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
            <Button variant="destructive" onClick={() => router.push(`/cadastros/empresas/${params.id}`)}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
