"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { CategorySelect } from "@/components/suppliers/category-select";
import { CostCenterSelect } from "@/components/suppliers/cost-center-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupplierFormSchema } from "@/lib/validation/supplier";
import { TAX_WITHHOLDING_POLICY_LABELS, TAX_WITHHOLDING_TYPE_LABELS } from "@/types/supplier";

export function StepWithholdingsAllocations() {
  const form = useFormContext<SupplierFormSchema>();
  const withholdings = useFieldArray({ control: form.control, name: "taxWithholdings" });
  const allocations = useFieldArray({ control: form.control, name: "allocations" });
  const companyId = form.watch("companyId");
  const allocationValues = form.watch("allocations") ?? [];

  const percentageTotal = allocationValues
    .filter((a) => a.allocationType === "PERCENTAGE")
    .reduce((sum, a) => sum + (a.percentage ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="taxWithholdingPolicy"
          render={({ field }) => (
            <FormItem className="w-72">
              <FormLabel>Possui retenções tributárias?</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(TAX_WITHHOLDING_POLICY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {withholdings.fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <span className="text-sm font-medium">Retenção {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => withholdings.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name={`taxWithholdings.${index}.taxType`}
                render={({ field: taxField }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={taxField.value} onValueChange={taxField.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TAX_WITHHOLDING_TYPE_LABELS).map(([value, label]) => (
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
                name={`taxWithholdings.${index}.rate`}
                render={({ field: rateField }) => (
                  <FormItem>
                    <FormLabel>Alíquota padrão (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={rateField.value ?? ""}
                        onChange={(e) => rateField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`taxWithholdings.${index}.minimumAmount`}
                render={({ field: minField }) => (
                  <FormItem>
                    <FormLabel>Valor mínimo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={minField.value ?? ""}
                        onChange={(e) => minField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.watch(`taxWithholdings.${index}.automatic`) ?? false}
                  onCheckedChange={(checked) => form.setValue(`taxWithholdings.${index}.automatic`, Boolean(checked))}
                />
                Aplicação automática
              </label>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-fit" onClick={() => withholdings.append({ taxType: "IRRF" })}>
          <Plus /> Incluir nova retenção
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <FormLabel>Rateio padrão</FormLabel>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.watch("allocationEnabled") ?? false}
              onCheckedChange={(checked) => form.setValue("allocationEnabled", Boolean(checked))}
            />
            Ativar rateio automático
          </label>
        </div>

        {allocations.fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <span className="text-sm font-medium">Item {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => allocations.remove(index)}>
                <Trash2 className="text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CategorySelect
                companyId={companyId}
                value={form.watch(`allocations.${index}.categoryId`)}
                onChange={(id) => form.setValue(`allocations.${index}.categoryId`, id)}
                label="Categoria"
              />
              <CostCenterSelect companyId={companyId} value={form.watch(`allocations.${index}.costCenterId`)} onChange={(id) => form.setValue(`allocations.${index}.costCenterId`, id)} label="Centro de custo" />
              <FormField
                control={form.control}
                name={`allocations.${index}.allocationType`}
                render={({ field: typeField }) => (
                  <FormItem>
                    <FormLabel>Tipo de rateio</FormLabel>
                    <Select value={typeField.value} onValueChange={typeField.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percentual</SelectItem>
                        <SelectItem value="FIXED_AMOUNT">Valor fixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {form.watch(`allocations.${index}.allocationType`) === "PERCENTAGE" ? (
                <FormField
                  control={form.control}
                  name={`allocations.${index}.percentage`}
                  render={({ field: pctField }) => (
                    <FormItem>
                      <FormLabel>Percentual (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={pctField.value ?? ""}
                          onChange={(e) => pctField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name={`allocations.${index}.fixedAmount`}
                  render={({ field: amountField }) => (
                    <FormItem>
                      <FormLabel>Valor fixo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={amountField.value ?? ""}
                          onChange={(e) => amountField.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        ))}

        {allocations.fields.length > 0 && percentageTotal > 100 && (
          <Alert variant="destructive">
            <AlertDescription>A soma dos rateios deve ser igual a 100% (atualmente {percentageTotal.toFixed(2)}%).</AlertDescription>
          </Alert>
        )}

        <Button type="button" variant="outline" className="w-fit" onClick={() => allocations.append({ allocationType: "PERCENTAGE" })}>
          <Plus /> Incluir novo item de rateio
        </Button>
      </div>
    </div>
  );
}
