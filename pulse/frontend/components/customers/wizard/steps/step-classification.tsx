"use client";

import { useFormContext } from "react-hook-form";

import { CategorySelect } from "@/components/suppliers/category-select";
import { CostCenterSelect } from "@/components/suppliers/cost-center-select";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { ABC_CLASSIFICATION_LABELS, REVENUE_POTENTIAL_LABELS } from "@/types/customer";

export function StepClassification() {
  const form = useFormContext<CustomerFormSchema>();
  const companyId = form.watch("companyId");
  const defaultRevenueCategoryId = form.watch("defaultRevenueCategoryId");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Esta etapa é específica para o vínculo com a empresa selecionada — outra empresa poderá utilizar este
        mesmo cliente com uma classificação comercial diferente.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategorySelect
          companyId={companyId}
          value={defaultRevenueCategoryId}
          onChange={(id) => form.setValue("defaultRevenueCategoryId", id)}
          label="Categoria de receita padrão"
        />
        <CategorySelect
          companyId={companyId}
          value={form.watch("defaultSubcategoryId")}
          onChange={(id) => form.setValue("defaultSubcategoryId", id)}
          parentCategoryId={defaultRevenueCategoryId}
          label="Subcategoria de receita"
          placeholder={defaultRevenueCategoryId ? "Selecione" : "Selecione a categoria primeiro"}
        />
        <CostCenterSelect companyId={companyId} value={form.watch("defaultResultCenterId")} onChange={(id) => form.setValue("defaultResultCenterId", id)} label="Centro de resultado" />

        <FormField
          control={form.control}
          name="defaultProductService"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produto ou serviço principal</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultAccountingAccount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta contábil gerencial</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="abcClassification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Classificação ABC</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(ABC_CLASSIFICATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="revenuePotentialLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Potencial de receita</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(REVENUE_POTENTIAL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="estimatedMonthlyRevenue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receita mensal estimada</FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="estimatedAnnualRevenue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receita anual estimada</FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="estimatedMarginPercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Margem estimada (%)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="defaultDescription"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição padrão</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} placeholder="Ex.: Mensalidade de gestão financeira" />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="defaultHistory"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Histórico padrão</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value ?? ""} rows={2} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
