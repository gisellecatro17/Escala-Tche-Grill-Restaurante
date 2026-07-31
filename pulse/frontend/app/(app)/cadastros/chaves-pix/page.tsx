"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Landmark,
  Pencil,
  Plus,
  Star,
} from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import {
  useCompanyPixKeyActions,
  useCompanyPixKeys,
  useFinancialAccounts,
} from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Field } from "@/components/treasury/field";
import {
  PIX_KEY_PURPOSE_LABELS,
  PIX_KEY_TYPE_LABELS,
  type CompanyPixKey,
  type PixKeyPurpose,
  type PixKeyType,
} from "@/types/treasury";

const VALIDATION_LABELS: Record<CompanyPixKey["validationStatus"], string> = {
  UNVERIFIED: "Não verificada",
  VERIFIED: "Verificada",
  FAILED: "Falhou",
};

const NONE = "none";

interface PixValues {
  pixType: PixKeyType;
  pixKey: string;
  purpose: PixKeyPurpose;
  financialAccountId: string;
  holderName: string;
  holderDocument: string;
  isPrimary: boolean;
  isForBilling: boolean;
  isForSuppliers: boolean;
  isForCustomers: boolean;
}

const EMPTY: PixValues = {
  pixType: "CNPJ",
  pixKey: "",
  purpose: "GENERAL",
  financialAccountId: NONE,
  holderName: "",
  holderDocument: "",
  isPrimary: false,
  isForBilling: false,
  isForSuppliers: false,
  isForCustomers: false,
};

/**
 * Chaves PIX da empresa (seções 33 a 36).
 *
 * A chave aparece mascarada para quem não tem `financial_account.view_bank_data` — o
 * mascaramento vem do back-end, a tela só exibe o que recebeu.
 */
export default function ChavesPixPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data: keys, isLoading } = useCompanyPixKeys(organizationId, { companyId });
  const { data: accounts } = useFinancialAccounts({
    organizationId,
    companyId,
    perPage: 100,
  });
  const { create, update, activate, deactivate } = useCompanyPixKeyActions();

  const [editing, setEditing] = React.useState<CompanyPixKey | null>(null);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<PixValues>(EMPTY);
  const [error, setError] = React.useState<string | null>(null);

  const canManage = hasPermission("financial_account.manage_pix");

  function set<K extends keyof PixValues>(key: K, value: PixValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditing(null);
    setValues(EMPTY);
    setError(null);
    setOpen(true);
  }

  function startEdit(pixKey: CompanyPixKey) {
    setEditing(pixKey);
    setValues({
      pixType: pixKey.pixType,
      pixKey: pixKey.pixKey,
      purpose: pixKey.purpose,
      financialAccountId: pixKey.financialAccountId ?? NONE,
      holderName: pixKey.holderName ?? "",
      holderDocument: pixKey.holderDocument ?? "",
      isPrimary: pixKey.isPrimary,
      isForBilling: pixKey.isForBilling,
      isForSuppliers: pixKey.isForSuppliers,
      isForCustomers: pixKey.isForCustomers,
    });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    if (!values.pixKey.trim()) {
      setError("Informe a chave PIX.");
      return;
    }

    const payload = {
      pixType: values.pixType,
      pixKey: values.pixKey.trim(),
      purpose: values.purpose,
      financialAccountId:
        values.financialAccountId === NONE ? undefined : values.financialAccountId,
      holderName: values.holderName.trim() || undefined,
      holderDocument: values.holderDocument.trim() || undefined,
      isPrimary: values.isPrimary,
      isForBilling: values.isForBilling,
      isForSuppliers: values.isForSuppliers,
      isForCustomers: values.isForCustomers,
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
          <h1 className="text-2xl font-semibold tracking-tight">Chaves PIX</h1>
          <p className="text-sm text-muted-foreground">
            Chaves PIX da própria empresa, usadas para receber e para identificar a
            conta em pagamentos.
          </p>
        </div>
        {canManage && companyId && (
          <Button onClick={startCreate}>
            <Plus /> Incluir nova chave
          </Button>
        )}
      </div>

      {!companyId && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Selecione uma empresa</AlertTitle>
          <AlertDescription>
            A chave PIX pertence a uma empresa. Selecione a empresa para cadastrar.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : !keys || keys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma chave PIX cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead className="w-40">Finalidade</TableHead>
                <TableHead>Conta vinculada</TableHead>
                <TableHead className="w-32">Validação</TableHead>
                <TableHead className="w-28">Situação</TableHead>
                {canManage && <TableHead className="w-32">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((pixKey) => (
                <TableRow key={pixKey.id}>
                  <TableCell className="text-sm">
                    {PIX_KEY_TYPE_LABELS[pixKey.pixType]}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="flex items-center gap-1.5">
                      {pixKey.isPrimary && (
                        <Star className="size-3.5 fill-current text-amber-500" />
                      )}
                      {pixKey.pixKey}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {PIX_KEY_PURPOSE_LABELS[pixKey.purpose]}
                    {[
                      pixKey.isForBilling && "cobrança",
                      pixKey.isForSuppliers && "fornecedores",
                      pixKey.isForCustomers && "clientes",
                    ].filter(Boolean).length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {[
                          pixKey.isForBilling && "cobrança",
                          pixKey.isForSuppliers && "fornecedores",
                          pixKey.isForCustomers && "clientes",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {pixKey.financialAccount ? (
                      <Link
                        href={`/cadastros/contas-financeiras/${pixKey.financialAccount.id}`}
                        className="underline"
                      >
                        {pixKey.financialAccount.displayName ??
                          pixKey.financialAccount.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        pixKey.validationStatus === "VERIFIED"
                          ? "default"
                          : pixKey.validationStatus === "FAILED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {VALIDATION_LABELS[pixKey.validationStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={pixKey.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {pixKey.status === "ACTIVE" ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => startEdit(pixKey)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {pixKey.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Inativar"
                            onClick={() => deactivate.mutate(pixKey.id)}
                          >
                            <Ban className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ativar"
                            onClick={() => activate.mutate(pixKey.id)}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar chave PIX" : "Incluir nova chave PIX"}
            </DialogTitle>
            <DialogDescription>
              A chave é normalizada antes de gravar, para que a mesma chave não entre
              duas vezes com formatações diferentes.
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
            <Field label="Tipo da chave" required>
              <Select
                value={values.pixType}
                onValueChange={(value) => set("pixType", value as PixKeyType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Chave" required>
              <Input
                value={values.pixKey}
                onChange={(event) => set("pixKey", event.target.value)}
                placeholder={
                  values.pixType === "EMAIL"
                    ? "financeiro@empresa.com.br"
                    : values.pixType === "PHONE"
                      ? "(51) 99999-8888"
                      : "11.222.333/0001-81"
                }
              />
            </Field>

            <Field label="Finalidade">
              <Select
                value={values.purpose}
                onValueChange={(value) => set("purpose", value as PixKeyPurpose)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PIX_KEY_PURPOSE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Conta vinculada">
              <Select
                value={values.financialAccountId}
                onValueChange={(value) => set("financialAccountId", value)}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do titular">
                <Input
                  value={values.holderName}
                  onChange={(event) => set("holderName", event.target.value)}
                />
              </Field>
              <Field label="Documento do titular">
                <Input
                  value={values.holderDocument}
                  onChange={(event) => set("holderDocument", event.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Usos</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isPrimary}
                  onCheckedChange={(checked) => set("isPrimary", checked === true)}
                />
                Chave principal da empresa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isForBilling}
                  onCheckedChange={(checked) => set("isForBilling", checked === true)}
                />
                Usar em cobranças
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isForSuppliers}
                  onCheckedChange={(checked) =>
                    set("isForSuppliers", checked === true)
                  }
                />
                Divulgar a fornecedores
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isForCustomers}
                  onCheckedChange={(checked) =>
                    set("isForCustomers", checked === true)
                  }
                />
                Divulgar a clientes
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={create.isPending || update.isPending}
            >
              Salvar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
