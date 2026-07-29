"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";

import { useSupplier, useUpdateSupplier } from "@/lib/api/suppliers";
import { ApiRequestError } from "@/lib/api/client";
import { supplierToFormValues } from "@/lib/mappers/supplier";
import { supplierFormSchema, type SupplierFormSchema } from "@/lib/validation/supplier";
import { maskCpfCnpj } from "@/lib/format";
import { StepAddressesContacts } from "@/components/suppliers/wizard/steps/step-addresses-contacts";
import { StepBankPix } from "@/components/suppliers/wizard/steps/step-bank-pix";
import { StepRegistrationData } from "@/components/suppliers/wizard/steps/step-registration-data";
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
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditSupplierPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const hasHydrated = React.useRef(false);

  const { data: supplier, isLoading } = useSupplier(params.id);
  const updateSupplier = useUpdateSupplier(params.id);

  const form = useForm<SupplierFormSchema>({
    resolver: zodResolver(supplierFormSchema),
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (supplier && !hasHydrated.current) {
      const link = supplier.companyLinks[0];
      form.reset(supplierToFormValues(supplier, link, supplier.organizationId));
      hasHydrated.current = true;
    }
  }, [supplier, form]);

  async function onSubmit(values: SupplierFormSchema) {
    setSubmitError(null);
    try {
      const { companyId: _companyId, organizationId: _org, ...rest } = values;
      void _companyId;
      void _org;
      await updateSupplier.mutateAsync(rest as Record<string, unknown>);
      router.push(`/cadastros/fornecedores/${params.id}`);
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "Não foi possível salvar as alterações.");
    }
  }

  function handleCancel() {
    if (form.formState.isDirty) setCancelDialogOpen(true);
    else router.push(`/cadastros/fornecedores/${params.id}`);
  }

  if (isLoading || !supplier) {
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
          <h1 className="text-2xl font-semibold tracking-tight">Editar dados cadastrais</h1>
          <p className="text-sm text-muted-foreground">{supplier.displayName ?? supplier.legalName}</p>
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
            <TabsTrigger value="enderecos">Endereços e contatos</TabsTrigger>
            <TabsTrigger value="bancario">Dados bancários e PIX</TabsTrigger>
          </TabsList>
          <TabsContent value="identificacao" className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem className="w-64">
                  <FormLabel>CPF/CNPJ</FormLabel>
                  <FormControl>
                    <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskCpfCnpj} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razão social ou nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tradeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome fantasia</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de exibição</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
          <TabsContent value="cadastrais">
            <StepRegistrationData />
          </TabsContent>
          <TabsContent value="enderecos">
            <StepAddressesContacts />
          </TabsContent>
          <TabsContent value="bancario">
            <StepBankPix />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={updateSupplier.isPending}>
            {updateSupplier.isPending && <Loader2 className="animate-spin" />}
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
            <Button variant="destructive" onClick={() => router.push(`/cadastros/fornecedores/${params.id}`)}>
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
