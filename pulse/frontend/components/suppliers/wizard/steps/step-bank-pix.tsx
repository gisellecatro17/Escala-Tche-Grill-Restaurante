"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { useFinancialInstitutions } from "@/lib/api/financial-institutions";
import { maskCpfCnpj } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupplierFormSchema } from "@/lib/validation/supplier";
import { BANK_ACCOUNT_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from "@/types/supplier";

export function StepBankPix() {
  const form = useFormContext<SupplierFormSchema>();
  const bankAccounts = useFieldArray({ control: form.control, name: "bankAccounts" });
  const pixKeys = useFieldArray({ control: form.control, name: "pixKeys" });
  const { data: institutions } = useFinancialInstitutions();
  const supplierDocument = (form.watch("documentNumber") ?? "").replace(/\D/g, "");

  function titularityMismatch(holderDocument: string | undefined) {
    const digits = (holderDocument ?? "").replace(/\D/g, "");
    return Boolean(supplierDocument && digits && digits !== supplierDocument);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FormLabel>Contas bancárias</FormLabel>
        {bankAccounts.fields.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta bancária cadastrada ainda.</p>}
        {bankAccounts.fields.map((accountField, index) => {
          const isThirdParty = form.watch(`bankAccounts.${index}.isThirdParty`);
          const holderDocument = form.watch(`bankAccounts.${index}.holderDocument`);

          return (
            <Card key={accountField.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <span className="text-sm font-medium">Conta {index + 1}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => bankAccounts.remove(index)}>
                  <Trash2 className="text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.financialInstitutionId`}
                  render={({ field }) => (
                    <FormItem className="sm:col-span-3">
                      <FormLabel>Banco</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a instituição financeira" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(institutions ?? []).map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.compeCode} — {i.shortName ?? i.legalName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.accountType`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de conta</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(BANK_ACCOUNT_TYPE_LABELS).map(([value, label]) => (
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
                  name={`bankAccounts.${index}.branchNumber`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.branchDigit`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dígito da agência</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.accountNumber`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.accountDigit`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dígito da conta</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.holderName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do titular</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`bankAccounts.${index}.holderDocument`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ do titular</FormLabel>
                      <FormControl>
                        <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskCpfCnpj} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch(`bankAccounts.${index}.isPrimary`) ?? false}
                    onCheckedChange={(checked) => {
                      bankAccounts.fields.forEach((_, i) => form.setValue(`bankAccounts.${i}.isPrimary`, i === index && Boolean(checked)));
                    }}
                  />
                  Conta principal
                </label>

                {titularityMismatch(holderDocument) && (
                  <Alert variant="warning" className="sm:col-span-3">
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        <strong>Atenção.</strong> O titular da conta bancária é diferente do fornecedor cadastrado.
                        Informe o motivo da utilização de conta de terceiro.
                      </span>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={isThirdParty ?? false}
                          onCheckedChange={(checked) => form.setValue(`bankAccounts.${index}.isThirdParty`, Boolean(checked))}
                        />
                        Confirmar conta de terceiro
                      </label>
                      {isThirdParty && (
                        <FormField
                          control={form.control}
                          name={`bankAccounts.${index}.thirdPartyReason`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} value={field.value ?? ""} placeholder="Motivo da conta de terceiro" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            bankAccounts.append({
              branchNumber: "",
              accountNumber: "",
              accountType: "CHECKING",
              holderName: "",
              holderDocument: "",
              isPrimary: bankAccounts.fields.length === 0,
            })
          }
        >
          <Plus /> Incluir nova conta bancária
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <FormLabel>Chaves PIX</FormLabel>
        {pixKeys.fields.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma chave PIX cadastrada ainda.</p>}
        {pixKeys.fields.map((pixField, index) => {
          const isThirdParty = form.watch(`pixKeys.${index}.isThirdParty`);
          const holderDocument = form.watch(`pixKeys.${index}.holderDocument`);

          return (
            <Card key={pixField.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <span className="text-sm font-medium">Chave PIX {index + 1}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => pixKeys.remove(index)}>
                  <Trash2 className="text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name={`pixKeys.${index}.pixType`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
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
                  name={`pixKeys.${index}.pixKey`}
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Chave</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`pixKeys.${index}.holderName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do titular</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`pixKeys.${index}.holderDocument`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ do titular</FormLabel>
                      <FormControl>
                        <MaskedInput value={field.value ?? ""} onChange={field.onChange} mask={maskCpfCnpj} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch(`pixKeys.${index}.isPrimary`) ?? false}
                    onCheckedChange={(checked) => {
                      pixKeys.fields.forEach((_, i) => form.setValue(`pixKeys.${i}.isPrimary`, i === index && Boolean(checked)));
                    }}
                  />
                  Chave principal
                </label>

                {titularityMismatch(holderDocument) && (
                  <Alert variant="warning" className="sm:col-span-3">
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        <strong>Atenção.</strong> O titular da chave PIX é diferente do fornecedor cadastrado.
                      </span>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={isThirdParty ?? false}
                          onCheckedChange={(checked) => form.setValue(`pixKeys.${index}.isThirdParty`, Boolean(checked))}
                        />
                        Confirmar chave de terceiro
                      </label>
                      {isThirdParty && (
                        <FormField
                          control={form.control}
                          name={`pixKeys.${index}.thirdPartyReason`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} value={field.value ?? ""} placeholder="Motivo da chave de terceiro" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => pixKeys.append({ pixType: "CNPJ", pixKey: "", holderName: "", holderDocument: "", isPrimary: pixKeys.fields.length === 0 })}
        >
          <Plus /> Incluir nova chave PIX
        </Button>
      </div>
    </div>
  );
}
