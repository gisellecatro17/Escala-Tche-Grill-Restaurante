"use client";

import { useFormContext } from "react-hook-form";

import { CategorySelect } from "@/components/suppliers/category-select";
import { CostCenterSelect } from "@/components/suppliers/cost-center-select";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierFormSchema } from "@/lib/validation/supplier";
import { FINANCIAL_NATURE_LABELS } from "@/types/supplier";

export function StepClassification() {
  const form = useFormContext<SupplierFormSchema>();
  const companyId = form.watch("companyId");
  const defaultCategoryId = form.watch("defaultCategoryId");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Esta etapa é específica para o vínculo com a empresa selecionada — outra empresa poderá utilizar este
        mesmo fornecedor com uma classificação diferente.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategorySelect
          companyId={companyId}
          value={defaultCategoryId}
          onChange={(id) => form.setValue("defaultCategoryId", id)}
          label="Categoria financeira padrão"
        />
        <CategorySelect
          companyId={companyId}
          value={form.watch("defaultSubcategoryId")}
          onChange={(id) => form.setValue("defaultSubcategoryId", id)}
          parentCategoryId={defaultCategoryId}
          label="Subcategoria"
          placeholder={defaultCategoryId ? "Selecione" : "Selecione a categoria primeiro"}
        />
        <CostCenterSelect companyId={companyId} value={form.watch("defaultCostCenterId")} onChange={(id) => form.setValue("defaultCostCenterId", id)} />

        <FormField
          control={form.control}
          name="financialNature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Natureza financeira</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(FINANCIAL_NATURE_LABELS).map(([value, label]) => (
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
      </div>

      <FormField
        control={form.control}
        name="defaultDescription"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição padrão</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} placeholder="Ex.: Conta de energia elétrica" />
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

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch("categoryRequired") ?? false}
            onCheckedChange={(checked) => form.setValue("categoryRequired", Boolean(checked))}
          />
          Categoria obrigatória
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch("costCenterRequired") ?? false}
            onCheckedChange={(checked) => form.setValue("costCenterRequired", Boolean(checked))}
          />
          Centro de custo obrigatório
        </label>
      </div>
    </div>
  );
}
