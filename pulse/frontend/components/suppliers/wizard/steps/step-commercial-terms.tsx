"use client";

import { useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierFormSchema } from "@/lib/validation/supplier";
import { PAYMENT_METHOD_LABELS } from "@/types/supplier";

export function StepCommercialTerms() {
  const form = useFormContext<SupplierFormSchema>();
  const bankAccounts = form.watch("bankAccounts") ?? [];
  const pixKeys = form.watch("pixKeys") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="preferredPaymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Forma de pagamento preferencial</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
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
          name="paymentTermFixedDueDay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia fixo de vencimento</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentTermPeriodicity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Periodicidade</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="Ex.: Mensal" />
              </FormControl>
            </FormItem>
          )}
        />

        {bankAccounts.length > 0 && (
          <FormField
            control={form.control}
            name="preferredBankAccountIndex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conta bancária preferencial</FormLabel>
                <Select
                  value={field.value !== undefined ? String(field.value) : undefined}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bankAccounts.map((account, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {account.branchNumber}/{account.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        )}
        {pixKeys.length > 0 && (
          <FormField
            control={form.control}
            name="preferredPixKeyIndex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chave PIX preferencial</FormLabel>
                <Select
                  value={field.value !== undefined ? String(field.value) : undefined}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pixKeys.map((key, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {key.pixKey}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="minimumAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor mínimo</FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="maximumAmountWithoutApproval"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor máximo sem aprovação</FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.01" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.watch("hasContract") ?? false} onCheckedChange={(checked) => form.setValue("hasContract", Boolean(checked))} />
          Possui contrato
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch("requiresMatchingBeneficiary") ?? true}
            onCheckedChange={(checked) => form.setValue("requiresMatchingBeneficiary", Boolean(checked))}
          />
          Exigir que o favorecido do pagamento corresponda ao fornecedor
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch("allowsThirdPartyPayment") ?? false}
            onCheckedChange={(checked) => form.setValue("allowsThirdPartyPayment", Boolean(checked))}
          />
          Permitir pagamento para conta de terceiro
        </label>
      </div>

      <FormField
        control={form.control}
        name="internalNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Observações comerciais</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value ?? ""} rows={3} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
