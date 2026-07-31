"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyFormSchema } from "@/lib/validation/company";

export function StepRegistrationData() {
  const form = useFormContext<CompanyFormSchema>();
  const cnaes = useFieldArray({ control: form.control, name: "cnaes" });

  function addCnae() {
    cnaes.append({ cnaeCode: "", description: "", isMain: cnaes.fields.length === 0 });
  }

  function setMainCnae(index: number) {
    cnaes.fields.forEach((_, i) => form.setValue(`cnaes.${i}.isMain`, i === index));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="openingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de abertura</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
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
                  <Input {...field} placeholder="Sociedade Empresária Limitada" />
                </FormControl>
                <FormMessage />
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
                  <Input {...field} placeholder="ME, EPP..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shareCapital"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capital social (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="stateRegistration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inscrição estadual</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="registrationNotes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Observações cadastrais</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">CNAEs</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addCnae}>
            <Plus />
            Incluir novo CNAE secundário
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {cnaes.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum CNAE informado ainda.</p>
          )}
          {cnaes.fields.map((cnaeField, index) => (
            <div key={cnaeField.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
              <FormField
                control={form.control}
                name={`cnaes.${index}.cnaeCode`}
                render={({ field }) => (
                  <FormItem className="sm:w-40">
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="56.11-2-01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`cnaes.${index}.description`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Restaurantes e similares" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={form.watch(`cnaes.${index}.isMain`) ?? false}
                  onCheckedChange={() => setMainCnae(index)}
                />
                Principal
              </label>
              <Button type="button" variant="ghost" size="icon" onClick={() => cnaes.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
