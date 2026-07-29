"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { maskCep } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { PostalCodeQueryButton } from "@/components/companies/postal-code-query-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CompanyFormSchema } from "@/lib/validation/company";
import { ADDRESS_TYPE_LABELS } from "@/types/company";

export function StepAddresses() {
  const form = useFormContext<CompanyFormSchema>();
  const addresses = useFieldArray({ control: form.control, name: "addresses" });

  const fiscalIndex = addresses.fields.findIndex((_, i) => form.watch(`addresses.${i}.addressType`) === "FISCAL");
  const sameAsFiscal = form.watch("addresses")?.some((a) => a.addressType === "OPERATIONAL" && a.sameAsAddressId);

  function addAddress(type: NonNullable<CompanyFormSchema["addresses"]>[number]["addressType"] = "FISCAL") {
    addresses.append({
      addressType: type,
      postalCode: "",
      street: "",
      city: "",
      state: "",
      country: "BR",
      isPrimary: addresses.fields.length === 0,
    });
  }

  function toggleOperationalSameAsFiscal(checked: boolean) {
    if (checked && fiscalIndex >= 0) {
      const fiscal = form.getValues(`addresses.${fiscalIndex}`);
      if (!fiscal) return;

      const operationalIndex = addresses.fields.findIndex(
        (_, i) => form.getValues(`addresses.${i}.addressType`) === "OPERATIONAL",
      );

      const operationalValue = {
        ...fiscal,
        postalCode: fiscal.postalCode ?? "",
        street: fiscal.street ?? "",
        city: fiscal.city ?? "",
        state: fiscal.state ?? "",
        addressType: "OPERATIONAL" as const,
        isPrimary: false,
        id: undefined,
      };

      if (operationalIndex >= 0) {
        form.setValue(`addresses.${operationalIndex}`, operationalValue);
      } else {
        addresses.append(operationalValue);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={sameAsFiscal} onCheckedChange={(checked) => toggleOperationalSameAsFiscal(Boolean(checked))} />
        O endereço operacional é igual ao endereço fiscal
      </label>

      {addresses.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado ainda.</p>
      )}

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
                      {Object.entries(ADDRESS_TYPE_LABELS).map(([value, label]) => (
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
                        if (!form.getValues(`addresses.${index}.street`)) {
                          form.setValue(`addresses.${index}.street`, result.data.street ?? "");
                        }
                        if (!form.getValues(`addresses.${index}.district`)) {
                          form.setValue(`addresses.${index}.district`, result.data.district ?? "");
                        }
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
            <FormField
              control={form.control}
              name={`addresses.${index}.reference`}
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>Referência</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
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

      <Button type="button" variant="outline" onClick={() => addAddress()} className="w-fit">
        <Plus />
        Incluir novo endereço
      </Button>
    </div>
  );
}
