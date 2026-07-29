"use client";

import { useFormContext } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SupplierFormSchema } from "@/lib/validation/supplier";

const TOGGLES: { name: keyof SupplierFormSchema; label: string }[] = [
  { name: "autoIdentificationEnabled", label: "Identificar fornecedor na importação bancária" },
  { name: "autoClassificationEnabled", label: "Aplicar categoria automaticamente" },
  { name: "autoCostCenterEnabled", label: "Aplicar centro de custo automaticamente" },
  { name: "autoAllocationEnabled", label: "Aplicar rateio automaticamente" },
  { name: "reconciliationSuggestionEnabled", label: "Sugerir conciliação" },
  { name: "autoEntryCreationEnabled", label: "Criar despesa automaticamente" },
  { name: "autoReconciliationEnabled", label: "Conciliar automaticamente" },
];

export function StepAutomationRules() {
  const form = useFormContext<SupplierFormSchema>();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Estas preferências preparam o fornecedor para o reconhecimento automático em importações futuras (OFX,
        extratos, comprovantes, boletos e notas fiscais). A simples identificação do fornecedor nunca gera uma
        conciliação automática sozinha — o motor completo de conciliação será construído em etapa futura.
      </p>

      <div className="flex flex-col gap-4">
        {TOGGLES.map(({ name, label }) => (
          <label key={name} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
            {label}
            <Switch
              checked={Boolean(form.watch(name))}
              onCheckedChange={(checked) => form.setValue(name, checked as never)}
            />
          </label>
        ))}
      </div>

      <FormField
        control={form.control}
        name="confirmationThreshold"
        render={({ field }) => (
          <FormItem className="w-64">
            <FormLabel>Limite mínimo de confiança (%)</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                max={100}
                value={field.value ?? 95}
                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <Alert>
        <AlertDescription>
          Abaixo do limite de confiança configurado, o sistema sempre exigirá confirmação manual antes de aplicar
          qualquer classificação ou conciliação automática.
        </AlertDescription>
      </Alert>
    </div>
  );
}
