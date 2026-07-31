"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SupplierFormSchema } from "@/lib/validation/supplier";

export function StepRegistrationData() {
  const form = useFormContext<SupplierFormSchema>();
  const cnaes = useFieldArray({ control: form.control, name: "cnaes" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="stateRegistration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inscrição estadual</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="municipalRegistration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inscrição municipal</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="openingDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de abertura</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="legalNature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Natureza jurídica</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companySize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Porte</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="shareCapital"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Capital social</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="segment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Segmento</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-3">
        <FormLabel>CNAEs</FormLabel>
        {cnaes.fields.map((cnaeField, index) => (
          <Card key={cnaeField.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0">
              <span className="text-sm font-medium">CNAE {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => cnaes.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`cnaes.${index}.cnaeCode`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="56.11-2-01" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`cnaes.${index}.description`}
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.watch(`cnaes.${index}.isMain`) ?? false}
                  onCheckedChange={(checked) => {
                    cnaes.fields.forEach((_, i) => form.setValue(`cnaes.${i}.isMain`, i === index && Boolean(checked)));
                  }}
                />
                CNAE principal
              </label>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => cnaes.append({ cnaeCode: "", isMain: cnaes.fields.length === 0 })}>
          <Plus /> Incluir novo CNAE
        </Button>
      </div>
    </div>
  );
}
