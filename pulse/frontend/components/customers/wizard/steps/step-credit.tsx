"use client";

import { useFormContext } from "react-hook-form";

import { formatCurrencyBRL } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { RISK_LEVEL_LABELS } from "@/types/customer";

export function StepCredit() {
  const form = useFormContext<CustomerFormSchema>();
  const creditLimit = form.watch("creditLimit");
  const automaticBlockEnabled = form.watch("automaticBlockEnabled");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="creditLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Limite de crédito</FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
              {creditLimit !== undefined && <p className="text-xs text-muted-foreground">{formatCurrencyBRL(creditLimit)}</p>}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="riskLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nível de risco</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(RISK_LEVEL_LABELS).map(([value, label]) => (
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

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch("allowOverCreditLimit") ?? false}
            onCheckedChange={(checked) => form.setValue("allowOverCreditLimit", Boolean(checked))}
          />
          Permitir lançamentos acima do limite
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch("requiresOverLimitApproval") ?? true}
            onCheckedChange={(checked) => form.setValue("requiresOverLimitApproval", Boolean(checked))}
          />
          Exigir aprovação acima do limite
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={automaticBlockEnabled ?? false}
            onCheckedChange={(checked) => form.setValue("automaticBlockEnabled", Boolean(checked))}
          />
          Bloquear automaticamente por atraso
        </label>
        {automaticBlockEnabled && (
          <FormField
            control={form.control}
            name="automaticBlockDays"
            render={({ field }) => (
              <FormItem className="w-48">
                <FormLabel>Dias de atraso</FormLabel>
                <FormControl>
                  <Input type="number" min={1} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                </FormControl>
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );
}
