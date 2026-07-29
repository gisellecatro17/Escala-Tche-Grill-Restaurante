"use client";

import { useFormContext } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { CUSTOMER_PAYMENT_METHOD_LABELS, RECURRENCE_PERIODICITY_LABELS } from "@/types/customer";

export function StepPaymentTerms() {
  const form = useFormContext<CustomerFormSchema>();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="billingFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Periodicidade</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(RECURRENCE_PERIODICITY_LABELS).map(([value, label]) => (
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
          name="paymentTermDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo em dias</FormLabel>
              <FormControl>
                <Input type="number" min={0} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultDueDay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia fixo de vencimento</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={31} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="preferredPaymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Forma de recebimento principal</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(CUSTOMER_PAYMENT_METHOD_LABELS).map(([value, label]) => (
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
          name="defaultLateFeePercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Multa por atraso (%)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultMonthlyInterestPercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Juros ao mês (%)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gracePeriodDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carência (dias)</FormLabel>
              <FormControl>
                <Input type="number" min={0} value={field.value ?? 0} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultDiscountPercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Desconto padrão (%)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="earlyPaymentDiscountPercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Desconto por antecipação (%)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="earlyPaymentDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dias antes do vencimento para desconto</FormLabel>
              <FormControl>
                <Input type="number" min={0} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="internalNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Observações financeiras</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value ?? ""} rows={3} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
