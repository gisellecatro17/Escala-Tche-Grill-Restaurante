"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";

import { useCompanies } from "@/lib/api/companies";
import { useSession } from "@/lib/auth/session-context";
import { maskCpfCnpj } from "@/lib/format";
import { DocumentQueryCustomerButton } from "@/components/customers/document-query-customer-button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { CUSTOMER_ORIGIN_LABELS, CUSTOMER_TYPE_LABELS, type CustomerRegistryData } from "@/types/customer";

export function StepIdentification() {
  const form = useFormContext<CustomerFormSchema>();
  const { user } = useSession();
  const personType = form.watch("personType");
  const documentNumber = form.watch("documentNumber") ?? "";
  const { data: companiesData } = useCompanies({ perPage: 100 });
  const companies = companiesData?.items ?? [];
  const customerTypes = form.watch("customerTypes") ?? [];

  function handleCompanyChange(companyId: string) {
    form.setValue("companyId", companyId);
    const company = companies.find((c) => c.id === companyId);
    if (company) form.setValue("organizationId", company.organizationId);
  }

  function toggleCustomerType(type: string) {
    const current = form.getValues("customerTypes") ?? [];
    form.setValue("customerTypes", current.includes(type) ? current.filter((t) => t !== type) : [...current, type]);
  }

  function applyRegistryData(data: CustomerRegistryData) {
    if (data.legalName) form.setValue("legalName", data.legalName);
    if (data.tradeName) form.setValue("tradeName", data.tradeName);
    if (!form.getValues("displayName") && data.tradeName) form.setValue("displayName", data.tradeName);
    if (data.address) {
      form.setValue("addresses", [
        {
          addressType: "FISCAL",
          postalCode: data.address.postalCode ?? "",
          street: data.address.street ?? "",
          number: data.address.number,
          district: data.address.district,
          city: data.address.city ?? "",
          state: data.address.state ?? "",
          isPrimary: true,
        },
      ]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FormField
        control={form.control}
        name="companyId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Empresa vinculada *</FormLabel>
            <Select value={field.value} onValueChange={handleCompanyChange} disabled={!user}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName ?? c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

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
                <SelectItem value="FOREIGN">Estrangeiro</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      {personType !== "FOREIGN" && (
        <FormField
          control={form.control}
          name="documentNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{personType === "INDIVIDUAL" ? "CPF *" : "CNPJ *"}</FormLabel>
              <div className="flex flex-wrap gap-2">
                <FormControl>
                  <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskCpfCnpj} className="w-56" />
                </FormControl>
                <DocumentQueryCustomerButton
                  documentNumber={documentNumber}
                  organizationId={form.watch("organizationId")}
                  personType={personType}
                  onApplyData={applyRegistryData}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {personType === "FOREIGN" && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="foreignDocument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento/identificação fiscal *</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moeda de cobrança</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="USD" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferredLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Idioma preferencial</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Português" />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="internalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código interno</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="Gerado automaticamente se deixado em branco" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="legalName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razão social ou nome completo *</FormLabel>
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
              <FormLabel>Nome de exibição *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Origem do cliente</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(CUSTOMER_ORIGIN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FormLabel>Tipo de cliente</FormLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={customerTypes.includes(value)} onCheckedChange={() => toggleCustomerType(value)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <FormField
        control={form.control}
        name="generalNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Observações iniciais</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value ?? ""} rows={3} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
