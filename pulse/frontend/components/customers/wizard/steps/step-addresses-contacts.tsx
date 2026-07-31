"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { maskCep, maskPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { PostalCodeQueryButton } from "@/components/companies/postal-code-query-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { CUSTOMER_ADDRESS_TYPE_LABELS } from "@/types/customer";

export function StepAddressesContacts() {
  const form = useFormContext<CustomerFormSchema>();
  const addresses = useFieldArray({ control: form.control, name: "addresses" });
  const contacts = useFieldArray({ control: form.control, name: "contacts" });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FormLabel>Endereços</FormLabel>
        {addresses.fields.length === 0 && <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado ainda.</p>}
        {addresses.fields.map((addressField, index) => (
          <Card key={addressField.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <FormField
                control={form.control}
                name={`addresses.${index}.addressType`}
                render={({ field }) => (
                  <FormItem className="w-56">
                    <FormLabel>Tipo de endereço</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(CUSTOMER_ADDRESS_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => addresses.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`addresses.${index}.postalCode`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <MaskedInput value={field.value} onChange={field.onChange} mask={maskCep} placeholder="00000-000" />
                      </FormControl>
                      <PostalCodeQueryButton
                        postalCode={field.value ?? ""}
                        onResult={(result) => {
                          if (!result.success || !result.data) return;
                          form.setValue(`addresses.${index}.street`, result.data.street ?? "");
                          form.setValue(`addresses.${index}.district`, result.data.district ?? "");
                          form.setValue(`addresses.${index}.city`, result.data.city ?? "");
                          form.setValue(`addresses.${index}.state`, result.data.state ?? "");
                          form.setValue(`addresses.${index}.cityCode`, result.data.cityCode ?? "");
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`addresses.${index}.street`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`addresses.${index}.number`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`addresses.${index}.complement`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`addresses.${index}.district`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`addresses.${index}.city`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Município</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`addresses.${index}.state`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF)</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={2} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.watch(`addresses.${index}.isPrimary`) ?? false}
                  onCheckedChange={(checked) => {
                    addresses.fields.forEach((_, i) => form.setValue(`addresses.${i}.isPrimary`, i === index && Boolean(checked)));
                  }}
                />
                Endereço principal
              </label>
            </CardContent>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => addresses.append({ addressType: "FISCAL", postalCode: "", street: "", city: "", state: "", isPrimary: addresses.fields.length === 0 })}
        >
          <Plus /> Incluir novo endereço
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone principal</FormLabel>
              <FormControl>
                <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskPhone} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp principal</FormLabel>
              <FormControl>
                <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskPhone} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail geral</FormLabel>
              <FormControl>
                <Input type="email" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emailFinancial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail financeiro</FormLabel>
              <FormControl>
                <Input type="email" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emailBilling"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail de cobrança</FormLabel>
              <FormControl>
                <Input type="email" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emailFiscal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail fiscal</FormLabel>
              <FormControl>
                <Input type="email" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-4">
        <FormLabel>Contatos</FormLabel>
        {contacts.fields.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato cadastrado ainda.</p>}
        {contacts.fields.map((contactField, index) => (
          <Card key={contactField.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <span className="text-sm font-medium">Contato {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => contacts.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`contacts.${index}.name`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.position`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.phone`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskPhone} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.email`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col gap-2 sm:col-span-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch(`contacts.${index}.isPrimary`) ?? false}
                    onCheckedChange={(checked) => form.setValue(`contacts.${index}.isPrimary`, Boolean(checked))}
                  />
                  Contato principal
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch(`contacts.${index}.isFinancialContact`) ?? false}
                      onCheckedChange={(checked) => form.setValue(`contacts.${index}.isFinancialContact`, Boolean(checked))}
                    />
                    Responsável financeiro
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch(`contacts.${index}.isBillingContact`) ?? false}
                      onCheckedChange={(checked) => form.setValue(`contacts.${index}.isBillingContact`, Boolean(checked))}
                    />
                    Responsável por cobrança
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch(`contacts.${index}.isContractContact`) ?? false}
                      onCheckedChange={(checked) => form.setValue(`contacts.${index}.isContractContact`, Boolean(checked))}
                    />
                    Responsável por contratos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch(`contacts.${index}.receivesInvoices`) ?? false}
                      onCheckedChange={(checked) => form.setValue(`contacts.${index}.receivesInvoices`, Boolean(checked))}
                    />
                    Recebe boletos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch(`contacts.${index}.receivesTaxDocuments`) ?? false}
                      onCheckedChange={(checked) => form.setValue(`contacts.${index}.receivesTaxDocuments`, Boolean(checked))}
                    />
                    Recebe notas fiscais
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => contacts.append({ name: "" })}>
          <Plus /> Incluir novo contato
        </Button>
      </div>
    </div>
  );
}
