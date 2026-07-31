"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";

import { useCompanies } from "@/lib/api/companies";
import { useOrganizations } from "@/lib/api/organizations";
import { maskCpfCnpj } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentQueryButton } from "@/components/companies/document-query-dialog";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { QuickCreateParentCompanyDrawer } from "@/components/companies/quick-create-parent-company-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyFormSchema } from "@/lib/validation/company";
import { ESTABLISHMENT_TYPE_LABELS } from "@/types/company";
import type { CompanyRegistryData } from "@/types/company";

export function StepIdentification() {
  const form = useFormContext<CompanyFormSchema>();
  const { data: organizations } = useOrganizations();
  const organizationId = form.watch("organizationId");
  const establishmentType = form.watch("establishmentType");
  const personType = form.watch("personType");
  const documentNumber = form.watch("documentNumber");
  const parentCompanyId = form.watch("parentCompanyId");

  const { data: headquarters } = useCompanies({
    organizationId,
    establishmentType: "HEADQUARTERS",
    perPage: 100,
  });
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);

  function applyRegistryData(data: CompanyRegistryData) {
    if (data.legalName) form.setValue("legalName", data.legalName, { shouldValidate: true });
    if (data.tradeName) form.setValue("tradeName", data.tradeName);
    if (!form.getValues("displayName") && (data.tradeName ?? data.legalName)) {
      form.setValue("displayName", data.tradeName ?? data.legalName ?? "", { shouldValidate: true });
    }
    if (data.openingDate) form.setValue("openingDate", data.openingDate);
    if (data.legalNature) form.setValue("legalNature", data.legalNature);
    if (data.companySize) form.setValue("companySize", data.companySize);
    if (data.shareCapital !== undefined) form.setValue("shareCapital", data.shareCapital);
    if (data.establishmentType) {
      form.setValue("establishmentType", data.establishmentType === "HEADQUARTERS" ? "HEADQUARTERS" : "BRANCH");
    }
    if (data.mainCnae || data.secondaryCnaes) {
      const cnaes = [
        ...(data.mainCnae ? [{ cnaeCode: data.mainCnae.code, description: data.mainCnae.description, isMain: true }] : []),
        ...(data.secondaryCnaes ?? []).map((c) => ({ cnaeCode: c.code, description: c.description, isMain: false })),
      ];
      form.setValue("cnaes", cnaes);
    }
    if (data.address) {
      form.setValue("addresses", [
        {
          addressType: "FISCAL",
          postalCode: data.address.postalCode ?? "",
          street: data.address.street ?? "",
          number: data.address.number,
          complement: data.address.complement,
          district: data.address.district,
          city: data.address.city ?? "",
          state: data.address.state ?? "",
          cityCode: data.address.cityCode,
          isPrimary: true,
        },
      ]);
    }
    if (data.phone) form.setValue("phone", data.phone);
    if (data.email) form.setValue("email", data.email);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organização</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="organizationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organização *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a organização" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {organizations?.items.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de pessoa e documento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="personType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de pessoa *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LEGAL_ENTITY">Pessoa jurídica</SelectItem>
                    <SelectItem value="INDIVIDUAL">Pessoa física</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>{personType === "INDIVIDUAL" ? "CPF *" : "CNPJ *"}</FormLabel>
                  <FormControl>
                    <MaskedInput
                      value={field.value}
                      onChange={field.onChange}
                      mask={maskCpfCnpj}
                      placeholder={personType === "INDIVIDUAL" ? "000.000.000-00" : "00.000.000/0000-00"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {personType === "LEGAL_ENTITY" && (
              <DocumentQueryButton
                documentNumber={documentNumber}
                organizationId={organizationId}
                personType={personType}
                onApplyData={applyRegistryData}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="legalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razão social ou nome completo *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="TCHÊ GRILL RESTAURANTE LTDA." />
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
                  <Input {...field} placeholder="TCHÊ GRILL" />
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
                <FormLabel>Nome de exibição *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Tchê Grill — Governador Mangabeira" />
                </FormControl>
                <FormDescription>
                  Usado no seletor de empresa, cabeçalhos, relatórios e listagens.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="internalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código interno</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Gerado automaticamente, se deixado em branco" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de estabelecimento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="establishmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de estabelecimento *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(ESTABLISHMENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {establishmentType !== "HEADQUARTERS" && (
            <FormField
              control={form.control}
              name="parentCompanyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa matriz *</FormLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full sm:flex-1">
                          <SelectValue placeholder="Selecione a empresa matriz" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {headquarters?.items.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.displayName ?? company.legalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!organizationId}
                      onClick={() => setQuickCreateOpen(true)}
                    >
                      + Incluir nova empresa matriz
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {parentCompanyId && establishmentType === "HEADQUARTERS" && (
            <p className="text-sm text-muted-foreground">
              Empresas do tipo matriz não possuem empresa matriz associada.
            </p>
          )}
        </CardContent>
      </Card>

      {organizationId && (
        <QuickCreateParentCompanyDrawer
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          organizationId={organizationId}
          onCreated={(company) => form.setValue("parentCompanyId", company.id, { shouldValidate: true })}
        />
      )}
    </div>
  );
}
