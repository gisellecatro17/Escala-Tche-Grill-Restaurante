"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Landmark,
  Lock,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import { usePaymentMethodActions, usePaymentMethods } from "@/lib/api/treasury";
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
  PAYMENT_METHOD_TYPE_LABELS,
  type PaymentMethod,
  type PaymentMethodType,
} from "@/types/treasury";

/**
 * As exigências mínimas de cada tipo (PIX exige favorecido, boleto exige linha
 * digitável, transferência exige dados bancários…) são aplicadas como **piso** pelo
 * back-end: desmarcar aqui não desliga a exigência.
 */
const REQUIREMENT_FIELDS = [
  { key: "requiresFinancialAccount", label: "Exige conta financeira" },
  { key: "requiresBeneficiary", label: "Exige favorecido" },
  { key: "requiresBankData", label: "Exige dados bancários" },
  { key: "requiresPixKey", label: "Exige chave PIX" },
  { key: "requiresBarcode", label: "Exige código de barras" },
  { key: "requiresDigitableLine", label: "Exige linha digitável" },
  { key: "requiresAttachment", label: "Exige anexo" },
  { key: "requiresApproval", label: "Exige aprovação" },
] as const;

const PERMISSION_FIELDS = [
  { key: "allowsScheduling", label: "Permite agendamento" },
  { key: "allowsInstallments", label: "Permite parcelamento" },
  { key: "allowsRecurrence", label: "Permite recorrência" },
  { key: "allowsIntegration", label: "Permite integração bancária" },
  { key: "allowsBatchPayment", label: "Permite pagamento em lote" },
] as const;

type FlagKey =
  | (typeof REQUIREMENT_FIELDS)[number]["key"]
  | (typeof PERMISSION_FIELDS)[number]["key"];

interface MethodValues {
  code: string;
  name: string;
  description: string;
  methodType: PaymentMethodType;
  settlementDays: string;
  confirmationThreshold: string;
  sortOrder: string;
  flags: Record<FlagKey, boolean>;
}

const EMPTY_FLAGS = Object.fromEntries(
  [...REQUIREMENT_FIELDS, ...PERMISSION_FIELDS].map((field) => [field.key, false]),
) as Record<FlagKey, boolean>;

const EMPTY: MethodValues = {
  code: "",
  name: "",
  description: "",
  methodType: "PIX",
  settlementDays: "0",
  confirmationThreshold: "",
  sortOrder: "0",
  flags: EMPTY_FLAGS,
};

function methodToValues(method: PaymentMethod): MethodValues {
  const flags = { ...EMPTY_FLAGS };
  for (const key of Object.keys(EMPTY_FLAGS) as FlagKey[]) {
    flags[key] = method[key];
  }

  return {
    code: method.code,
    name: method.name,
    description: method.description ?? "",
    methodType: method.methodType,
    settlementDays: String(method.settlementDays),
    confirmationThreshold:
      method.confirmationThreshold != null
        ? String(method.confirmationThreshold)
        : "",
    sortOrder: String(method.sortOrder),
    flags,
  };
}

export default function FormasDePagamentoPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [search, setSearch] = React.useState("");
  const { data: methods, isLoading } = usePaymentMethods(organizationId, {
    companyId,
    search: search || undefined,
  });
  const { create, update, activate, deactivate } = usePaymentMethodActions();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PaymentMethod | null>(null);
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

  function startEdit(method: PaymentMethod) {
    setEditing(method);
    setValues(methodToValues(method));
    setError(null);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    if (!values.code.trim() || !values.name.trim()) {
      setError("Informe o código e o nome da forma de pagamento.");
      return;
    }

    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      methodType: values.methodType,
      settlementDays: Number(values.settlementDays || 0),
      confirmationThreshold:
        values.confirmationThreshold === ""
          ? undefined
          : Number(values.confirmationThreshold),
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
            Formas de Pagamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Como a empresa paga. Cada forma define o que o lançamento vai exigir quando
            o módulo de contas a pagar entrar em operação.
          </p>
        </div>
        {hasPermission("payment_method.create") && (
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
            Nenhuma forma de pagamento cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-44">Tipo</TableHead>
                <TableHead>Exigências</TableHead>
                <TableHead className="w-24">Liquidação</TableHead>
                <TableHead className="w-24">Situação</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => {
                const requirements = REQUIREMENT_FIELDS.filter(
                  (field) => method[field.key],
                );

                return (
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
                      {method.description && (
                        <span className="block text-xs text-muted-foreground">
                          {method.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {PAYMENT_METHOD_TYPE_LABELS[method.methodType]}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {requirements.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          requirements.map((field) => (
                            <span
                              key={field.key}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px]"
                            >
                              {field.label.replace("Exige ", "")}
                            </span>
                          ))
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      D+{method.settlementDays}
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
                        {hasPermission("payment_method.update") && (
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
                          ? hasPermission("payment_method.deactivate") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Inativar"
                                onClick={() => deactivate.mutate(method.id)}
                              >
                                <Ban className="size-4" />
                              </Button>
                            )
                          : hasPermission("payment_method.activate") && (
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Alert>
        <ArrowUpCircle />
        <AlertTitle>O que ainda não existe</AlertTitle>
        <AlertDescription>
          As formas ficam prontas para uso, mas o pagamento em si — agendamento, envio
          ao banco, baixa financeira — pertence ao módulo de contas a pagar.
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar forma de pagamento" : "Incluir nova forma de pagamento"}
            </DialogTitle>
            <DialogDescription>
              As exigências mínimas do tipo escolhido são aplicadas pelo back-end mesmo
              que fiquem desmarcadas aqui.
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
                  placeholder="PIX"
                />
              </Field>
              <Field label="Tipo" required>
                <Select
                  value={values.methodType}
                  onValueChange={(value) =>
                    set("methodType", value as PaymentMethodType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
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
              <Field
                label="Valor a partir do qual exigir confirmação"
                hint="Vazio, não exige confirmação por valor."
              >
                <Input
                  value={values.confirmationThreshold}
                  inputMode="decimal"
                  onChange={(event) =>
                    set("confirmationThreshold", event.target.value)
                  }
                  placeholder="5000.00"
                />
              </Field>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Exigências</Label>
                {REQUIREMENT_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values.flags[field.key]}
                      onCheckedChange={(checked) =>
                        setFlag(field.key, checked === true)
                      }
                    />
                    {field.label}
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Permissões</Label>
                {PERMISSION_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values.flags[field.key]}
                      onCheckedChange={(checked) =>
                        setFlag(field.key, checked === true)
                      }
                    />
                    {field.label}
                  </label>
                ))}
              </div>
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
