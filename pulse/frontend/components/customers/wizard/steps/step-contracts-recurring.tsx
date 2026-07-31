"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerFormSchema } from "@/lib/validation/customer";
import { RECURRENCE_PERIODICITY_LABELS } from "@/types/customer";

export function StepContractsRecurring() {
  const form = useFormContext<CustomerFormSchema>();
  const contracts = useFieldArray({ control: form.control, name: "contracts" });
  const recurring = useFieldArray({ control: form.control, name: "recurringReceivables" });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FormLabel>Contratos</FormLabel>
        {contracts.fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <span className="text-sm font-medium">Contrato {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => contracts.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`contracts.${index}.contractNumber`}
                render={({ field: numberField }) => (
                  <FormItem>
                    <FormLabel>Número do contrato</FormLabel>
                    <FormControl>
                      <Input {...numberField} value={numberField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.description`}
                render={({ field: descField }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...descField} value={descField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.initialValue`}
                render={({ field: valueField }) => (
                  <FormItem>
                    <FormLabel>Valor inicial</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={valueField.value ?? ""}
                        onChange={(e) => valueField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contracts.${index}.startDate`}
                render={({ field: startField }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input type="date" {...startField} value={startField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {!form.watch(`contracts.${index}.isIndefiniteTerm`) && (
                <FormField
                  control={form.control}
                  name={`contracts.${index}.endDate`}
                  render={({ field: endField }) => (
                    <FormItem>
                      <FormLabel>Data de término</FormLabel>
                      <FormControl>
                        <Input type="date" {...endField} value={endField.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="flex flex-col gap-2 sm:col-span-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch(`contracts.${index}.isIndefiniteTerm`) ?? false}
                    onCheckedChange={(checked) => form.setValue(`contracts.${index}.isIndefiniteTerm`, Boolean(checked))}
                  />
                  Contrato por prazo indeterminado
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch(`contracts.${index}.automaticRenewal`) ?? false}
                    onCheckedChange={(checked) => form.setValue(`contracts.${index}.automaticRenewal`, Boolean(checked))}
                  />
                  Renovação automática
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => contracts.append({})}>
          <Plus /> Incluir novo contrato
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <FormLabel>Recorrências</FormLabel>
        <p className="text-sm text-muted-foreground">
          Enquanto o módulo de contas a receber não existir, nenhum lançamento financeiro definitivo é gerado —
          apenas a configuração da recorrência é criada.
        </p>
        {recurring.fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <span className="text-sm font-medium">Recorrência {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => recurring.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`recurringReceivables.${index}.description`}
                render={({ field: descField }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...descField} value={descField.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`recurringReceivables.${index}.amount`}
                render={({ field: amountField }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amountField.value ?? ""}
                        onChange={(e) => amountField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`recurringReceivables.${index}.frequency`}
                render={({ field: freqField }) => (
                  <FormItem>
                    <FormLabel>Periodicidade</FormLabel>
                    <Select value={freqField.value} onValueChange={freqField.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
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
                name={`recurringReceivables.${index}.startDate`}
                render={({ field: startField }) => (
                  <FormItem>
                    <FormLabel>Data inicial</FormLabel>
                    <FormControl>
                      <Input type="date" {...startField} value={startField.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`recurringReceivables.${index}.fixedDueDay`}
                render={({ field: dueDayField }) => (
                  <FormItem>
                    <FormLabel>Dia fixo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={dueDayField.value ?? ""}
                        onChange={(e) => dueDayField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => recurring.append({ amount: 0, frequency: "MONTHLY", startDate: "" })}>
          <Plus /> Incluir nova recorrência
        </Button>
      </div>
    </div>
  );
}
