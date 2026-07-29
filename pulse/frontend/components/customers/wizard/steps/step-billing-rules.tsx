"use client";

import { useFormContext } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import type { CustomerFormSchema } from "@/lib/validation/customer";

export function StepBillingRules() {
  const form = useFormContext<CustomerFormSchema>();

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.watch("billingRulesEnabled") ?? false}
          onCheckedChange={(checked) => form.setValue("billingRulesEnabled", Boolean(checked))}
        />
        Ativar regras de cobrança automatizadas para este cliente
      </label>

      <Alert>
        <AlertDescription>
          As regras individuais (lembretes antes do vencimento, avisos no vencimento e após, canal, responsável e
          escalonamento) são configuradas na tela de detalhes do vínculo depois que o cadastro for concluído.
          Nenhuma mensagem real é enviada nesta etapa — apenas a configuração e o histórico são criados.
        </AlertDescription>
      </Alert>
    </div>
  );
}
