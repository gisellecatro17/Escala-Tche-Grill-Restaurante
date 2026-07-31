"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  Ban,
  CheckCircle2,
  Landmark,
  Lock,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import {
  useFinancialAccounts,
  useReceiptMethodActions,
  useReceiptMethods,
} from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import {
  RECEIPT_METHOD_TYPE_LABELS,
  type ReceiptMethod,
  type ReceiptMethodType,
} from "@/types/treasury";

const NONE = "none";

const FLAG_FIELDS = [
  { key: "requiresCustomer", label: "Exige cliente" },
  { key: "requiresDocument", label: "Exige documento" },
  { key: "requiresIdentifier", label: "Exige identificador (NSU, TID…)" },
  { key: "allowsRecurrence", label: "Permite recorrência" },
  { key: "allowsInstallments", label: "Permite parcelamento" },
  { key: "anticipationAllowed", label: "Permite antecipação" },
] as const;

type FlagKey = (typeof FLAG_FIELDS)[number]["key"];

interface MethodValues {
  code: string;
  name: string;
  description: string;
  methodType: ReceiptMethodType;
  defaultFinancialAccountId: string;
  maximumInstallments: string;
  settlementDays: string;
  fixedFee: string;
  percentageFee: string;
  anticipationFeePercentage: string;
  integrationProvider: string;
  sortOrder: string;
  flags: Record<FlagKey, boolean>;
}

const EMPTY_FLAGS = Object.fromEntries(
  FLAG_FIELDS.map((field) => [field.key, false]),
) as Record<FlagKey, boolean>;

const EMPTY: MethodValues = {
  code: "",
  name: "",
  description: "",
  methodType: "PIX",
  defaultFinancialAccountId: NONE,
  maximumInstallments: "",
  settlementDays: "0",
  fixedFee: "",
  percentageFee: "",
  anticipationFeePercentage: "",
  integrationProvider: "",
  sortOrder: "0",
  flags: EMPTY_FLAGS,
};

function methodToValues(method: ReceiptMethod): MethodValues {
  const flags = { ...EMPTY_FLAGS };
  for (const key of Object.keys(EMPTY_FLAGS) as FlagKey[]) {
    flags[key] = method[key];
  }

  const text = (value: string | number | null) =>
    value != null ? String(value) : "";

  return {
    code: method.code,
    name: method.name,
    description: method.description ?? "",
    methodType: method.methodType,
    defaultFinancialAccountId: method.defaultFinancialAccountId ?? NONE,
    maximumInstallments: text(method.maximumInstallments),
    settlementDays: String(method.settlementDays),
    fixedFee: text(method.fixedFee),
    percentageFee: text(method.percentageFee),
    anticipationFeePercentage: text(method.anticipationFeePercentage),
    integrationProvider: method.integrationProvider ?? "",
    sortOrder: String(method.sortOrder),
    flags,
  };
}

/** Percentuais e taxas ficam aqui para que o valor líquido possa ser calculado depois. */
function formatFees(method: ReceiptMethod) {
  const parts: string[] = [];
  if (method.percentageFee != null && Number(method.percentageFee) > 0)
    parts.push(`${Number(method.percentageFee)}%`);
  if (method.fixedFee != null && Number(method.fixedFee) > 0)
    parts.push(
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(method.fixedFee)),
    );
  return parts.length > 0 ? parts.join(" + ") : "—";
}

export default function FormasDeRecebimentoPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [search, setSearch] = React.useState("");
  const { data: methods, isLoading } = useReceiptMethods(organizationId, {
    companyId,
    search: search || undefined,
  });
  const { data: accounts } = useFinancialAccounts({
    organizationId,
    companyId,
    status: "ACTIVE",
    perPage: 100,
  });
  const { create, update, activate, deactivate } = useReceiptMethodActions();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ReceiptMethod | null>(null);
  const [values, setValues] = React.useState<MethodValues>(EMPTY);
  const [error, setError] = React.useState<string | null>(null);

  function set<K extends keyof MethodValues>(key: K, value: MethodValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setFlag(key: FlagKey, value: boolean) {
    setValues((current) => ({ ...current, flags: { ...current.flags, [key]: value } }));
  }

  function startCreate() {
    setEditing(null);
    setValues(EMPTY);
    setError(null);
    setOpen(true);
  }

  function startEdit(method: ReceiptMethod) {
    setEditing(method);
    setValues(methodToValues(method));
    setError(null);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    if (!values.code.trim() || !values.name.trim()) {
      setError("Informe o código e o nome da forma de recebimento.");
      return;
    }
    if (values.flags.allowsInstallments && values.maximumInstallments === "") {
      setError("Informe o número máximo de parcelas ou desmarque o parcelamento.");
      return;
    }

    const optionalNumber = (value: string) =>
      value === "" ? undefined : Number(value);

    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      methodType: values.methodType,
      defaultFinancialAccountId:
        values.defaultFinancialAccountId === NONE
          ? undefined
          : values.defaultFinancialAccountId,
      maximumInstallments: optionalNumber(values.maximumInstallments),
      settlementDays: Number(values.settlementDays || 0),
      fixedFee: optionalNumber(values.fixedFee),
      percentageFee: optionalNumber(values.percentageFee),
      anticipationFeePercentage: optionalNumber(values.anticipationFeePercentage),
      integrationProvider: values.integrationProvider.trim() || undefined,
      sortOrder: Number(values.sortOrder || 0),
      ...values.flags,
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload });
      } else {
        await create.mutateAsync({ ...payload, organizationId, companyId });
      }
      setOpen(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError([caught.message, ...caught.errors].filter(Boolean).join(" "));
      } else {
        setError(caught instanceof Error ? caught.message : "Falha inesperada.");
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/cadastros/tesouraria">
              <Landmark /> Tesouraria
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Formas de Recebimento
          </h1>
          <p className="text-sm text-muted-foreground">
            Como a empresa recebe. Prazo de liquidação e taxas ficam registrados aqui
            para o cálculo do valor líquido no módulo de contas a receber.
          </p>
        </div>
        {hasPermission("receipt_method.create") && (
          <Button onClick={startCreate}>
            <Plus /> Incluir nova forma
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por código ou nome"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : !methods || methods.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma forma de recebimento cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-40">Tipo</TableHead>
                <TableHead>Conta de crédito</TableHead>
                <TableHead className="w-24">Liquidação</TableHead>
                <TableHead className="w-32">Taxas</TableHead>
                <TableHead className="w-24">Situação</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {method.code}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium">
                      {method.name}
                      {method.isSystem && (
                        <span title="Forma padrão do sistema">
                          <Lock className="size-3 text-muted-foreground" />
                        </span>
                      )}
                      {method.companyId === null && (
                        <Badge variant="outline" className="text-[10px]">
                          Organização
                        </Badge>
                      )}
                    </span>
                    {method.allowsInstallments && (
                      <span className="block text-xs text-muted-foreground">
                        até {method.maximumInstallments ?? "—"}x
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {RECEIPT_METHOD_TYPE_LABELS[method.methodType]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {method.defaultFinancialAccount ? (
                      <Link
                        href={`/cadastros/contas-financeiras/${method.defaultFinancialAccount.id}`}
                        className="underline"
                      >
                        {method.defaultFinancialAccount.displayName ??
                          method.defaultFinancialAccount.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    D+{method.settlementDays}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatFees(method)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={method.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {method.status === "ACTIVE" ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {hasPermission("receipt_method.update") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => startEdit(method)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {method.status === "ACTIVE"
                        ? hasPermission("receipt_method.deactivate") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Inativar"
                              onClick={() => deactivate.mutate(method.id)}
                            >
                              <Ban className="size-4" />
                            </Button>
                          )
                        : hasPermission("receipt_method.activate") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ativar"
                              onClick={() => activate.mutate(method.id)}
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                          )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Alert>
        <ArrowDownCircle />
        <AlertTitle>O que ainda não existe</AlertTitle>
        <AlertDescription>
          Emissão de boleto, cobrança PIX e integração com adquirentes pertencem aos
          módulos de contas a receber e de cobrança. Aqui fica apenas o cadastro.
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Editar forma de recebimento"
                : "Incluir nova forma de recebimento"}
            </DialogTitle>
            <DialogDescription>
              A conta de crédito indica onde o valor recebido cai por padrão.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Não foi possível salvar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código" required>
                <Input
                  value={values.code}
                  onChange={(event) => set("code", event.target.value)}
                  placeholder="PIX"
                  disabled={editing?.isSystem}
                />
              </Field>
              <Field label="Nome" required>
                <Input
                  value={values.name}
                  onChange={(event) => set("name", event.target.value)}
                />
              </Field>
              <Field label="Tipo" required>
                <Select
                  value={values.methodType}
                  onValueChange={(value) =>
                    set("methodType", value as ReceiptMethodType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECEIPT_METHOD_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Conta de crédito padrão">
                <Select
                  value={values.defaultFinancialAccountId}
                  onValueChange={(value) => set("defaultFinancialAccountId", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhuma</SelectItem>
                    {(accounts?.items ?? []).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.displayName ?? account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prazo de liquidação (dias)">
                <Input
                  value={values.settlementDays}
                  inputMode="numeric"
                  onChange={(event) => set("settlementDays", event.target.value)}
                />
              </Field>
              <Field label="Provedor da integração">
                <Input
                  value={values.integrationProvider}
                  onChange={(event) => set("integrationProvider", event.target.value)}
                  placeholder="Cielo, Stone, Mercado Pago…"
                />
              </Field>
              <Field label="Taxa fixa por transação">
                <Input
                  value={values.fixedFee}
                  inputMode="decimal"
                  onChange={(event) => set("fixedFee", event.target.value)}
                  placeholder="0.49"
                />
              </Field>
              <Field label="Taxa percentual (%)">
                <Input
                  value={values.percentageFee}
                  inputMode="decimal"
                  onChange={(event) => set("percentageFee", event.target.value)}
                  placeholder="2.99"
                />
              </Field>
              {values.flags.anticipationAllowed && (
                <Field label="Taxa de antecipação (% ao mês)">
                  <Input
                    value={values.anticipationFeePercentage}
                    inputMode="decimal"
                    onChange={(event) =>
                      set("anticipationFeePercentage", event.target.value)
                    }
                    placeholder="1.99"
                  />
                </Field>
              )}
              {values.flags.allowsInstallments && (
                <Field label="Máximo de parcelas" required>
                  <Input
                    value={values.maximumInstallments}
                    inputMode="numeric"
                    onChange={(event) => set("maximumInstallments", event.target.value)}
                    placeholder="12"
                  />
                </Field>
              )}
              <Field label="Ordem de exibição">
                <Input
                  value={values.sortOrder}
                  inputMode="numeric"
                  onChange={(event) => set("sortOrder", event.target.value)}
                />
              </Field>
            </div>

            <Field label="Descrição">
              <Textarea
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
                rows={2}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <Label>Regras</Label>
              {FLAG_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.flags[field.key]}
                    onCheckedChange={(checked) => setFlag(field.key, checked === true)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              Salvar forma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
