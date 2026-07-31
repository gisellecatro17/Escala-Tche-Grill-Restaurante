"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { cnpj } from "cpf-cnpj-validator";

import { useCreateCompany } from "@/lib/api/companies";
import { maskCnpj } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CompanySummary } from "@/types/company";

const quickCreateSchema = z.object({
  documentNumber: z.string().refine((v) => cnpj.isValid(v), { message: "Informe um CNPJ válido." }),
  legalName: z.string().min(2, "Informe a razão social."),
  displayName: z.string().min(2, "Informe o nome de exibição."),
});

type QuickCreateValues = z.infer<typeof quickCreateSchema>;

interface QuickCreateParentCompanyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: (company: CompanySummary) => void;
}

/** "+ Incluir nova empresa matriz" — cadastro rápido sem sair do formulário atual (seção 14). */
export function QuickCreateParentCompanyDrawer({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: QuickCreateParentCompanyDrawerProps) {
  const createCompany = useCreateCompany();
  const form = useForm<QuickCreateValues>({
    resolver: zodResolver(quickCreateSchema),
    defaultValues: { documentNumber: "", legalName: "", displayName: "" },
  });

  async function onSubmit(values: QuickCreateValues) {
    const company = await createCompany.mutateAsync({
      organizationId,
      personType: "LEGAL_ENTITY",
      establishmentType: "HEADQUARTERS",
      documentNumber: values.documentNumber.replace(/\D/g, ""),
      legalName: values.legalName,
      displayName: values.displayName,
    });

    onCreated(company as unknown as CompanySummary);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Incluir nova empresa matriz</SheetTitle>
          <SheetDescription>
            Cadastro rápido — você poderá completar os demais dados desta empresa depois.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <MaskedInput value={field.value} onChange={field.onChange} mask={maskCnpj} placeholder="00.000.000/0000-00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão social</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
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

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Incluir nova empresa
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
