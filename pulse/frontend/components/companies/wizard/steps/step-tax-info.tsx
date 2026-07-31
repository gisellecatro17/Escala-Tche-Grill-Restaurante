"use client";

import { useFormContext } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyFormSchema } from "@/lib/validation/company";
import { ACCOUNTING_CRITERION_LABELS, TAX_REGIME_LABELS } from "@/types/company";

export function StepTaxInfo() {
  const form = useFormContext<CompanyFormSchema>();
  const simplesNacionalOptant = form.watch("simplesNacionalOptant");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regime tributário</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="taxRegime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regime tributário</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TAX_REGIME_LABELS).map(([value, label]) => (
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
          <FormField
            control={form.control}
            name="taxAssessmentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regime de apuração</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(ACCOUNTING_CRITERION_LABELS).map(([value, label]) => (
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
          <FormField
            control={form.control}
            name="specialTaxRegime"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Regime especial</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="icmsTaxpayer"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4 rounded-md border p-3">
                <FormLabel className="font-normal">Contribuinte do ICMS</FormLabel>
                <FormControl>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="simplesNacionalOptant"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4 rounded-md border p-3">
                <FormLabel className="font-normal">Optante pelo Simples Nacional</FormLabel>
                <FormControl>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {simplesNacionalOptant && (
            <>
              <FormField
                control={form.control}
                name="simplesNacionalOptionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de opção</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="simplesNacionalExclusionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de exclusão</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escritório contábil</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="accountingFirmName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Escritório contábil</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accountingResponsibleName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável contábil</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taxNotes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Observações fiscais</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
