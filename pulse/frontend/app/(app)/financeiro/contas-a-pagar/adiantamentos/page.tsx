"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, HandCoins, Loader2, Plus } from "lucide-react";

import {
  useCreateSupplierAdvance,
  useSupplierAdvances,
} from "@/lib/api/accounts-payable";
import { useSuppliers } from "@/lib/api/suppliers";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  ADVANCE_STATUS_LABELS,
  ADVANCE_TYPE_LABELS,
  displayNameOf,
  type AdvanceType,
} from "@/types/accounts-payable";

/**
 * Adiantamentos a fornecedores (seção 10).
 *
 * O adiantamento vive fora do título porque nasce antes dele: adianta-se ao fornecedor e só
 * depois chega a nota. O abatimento é feito no próprio título, e o saldo restante fica
 * visível aqui — sem isso, "sobrou adiantamento?" vira planilha paralela.
 */
export default function AdiantamentosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useSupplierAdvances({ companyId, perPage: 50 });
  const { data: suppliersPage } = useSuppliers({ companyId, perPage: 100 });
  const suppliers = React.useMemo(
    () => suppliersPage?.items ?? [],
    [suppliersPage],
  );
  const create = useCreateSupplierAdvance();

  const [creating, setCreating] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState("");
  const [type, setType] = React.useState<AdvanceType>("SUPPLIER");
  const [amount, setAmount] = React.useState("");
  const [grantedAt, setGrantedAt] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = React.useState("");
  const [failure, setFailure] = React.useState<string | null>(null);

  const canCreate = hasPermission("accounts_payable.create");
  const advances = data?.items ?? [];

  function submit() {
    if (!organizationId || !companyId) return;
    setFailure(null);

    create.mutate(
      {
        organizationId,
        companyId,
        supplierId,
        type,
        amount: Number(amount),
        grantedAt,
        ...(reference ? { reference } : {}),
      },
      {
        onSuccess: () => {
          setCreating(false);
          setSupplierId("");
          setAmount("");
          setReference("");
        },
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error
              ? caught.message
              : "Não foi possível registrar o adiantamento.",
          ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/contas-a-pagar">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <HandCoins className="size-5" />
            Adiantamentos a fornecedores
          </h1>
          <p className="text-xs text-muted-foreground">
            O saldo é abatido no título definitivo, quando ele chegar.
          </p>
        </div>
        {canCreate && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo adiantamento
          </Button>
        )}
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Adiantamento não registrado</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo adiantamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Fornecedor" required>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((link) => (
                    <SelectItem key={link.supplierId} value={link.supplierId}>
                      {link.supplier.tradeName ?? link.supplier.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Natureza">
              <Select value={type} onValueChange={(value) => setType(value as AdvanceType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ADVANCE_TYPE_LABELS) as AdvanceType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {ADVANCE_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Valor (R$)" required>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>

            <Field label="Data" required>
              <Input
                type="date"
                value={grantedAt}
                onChange={(event) => setGrantedAt(event.target.value)}
              />
            </Field>

            <Field label="Referência" hint="Número do comprovante ou do contrato.">
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button
                disabled={!supplierId || !amount || create.isPending}
                onClick={submit}
              >
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Registrar adiantamento
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : advances.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum adiantamento registrado.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Abatido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Títulos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advances.map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell className="text-sm">
                    {displayNameOf(advance.supplier)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ADVANCE_TYPE_LABELS[advance.type]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateBR(advance.grantedAt)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrencyBRL(Number(advance.amount))}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrencyBRL(Number(advance.appliedAmount))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatCurrencyBRL(Number(advance.remainingAmount))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={advance.status === "APPLIED" ? "secondary" : "default"}
                    >
                      {ADVANCE_STATUS_LABELS[advance.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {advance.applications.length === 0
                      ? "—"
                      : advance.applications.map((application) => (
                          <Link
                            key={application.id}
                            href={`/financeiro/contas-a-pagar/${application.payable.id}`}
                            className="mr-2 hover:underline"
                          >
                            {application.payable.code}
                          </Link>
                        ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Alert>
        <AlertTitle>O abatimento é feito no título</AlertTitle>
        <AlertDescription>
          Abra o título a pagar do fornecedor e use &ldquo;Abater adiantamento&rdquo;. Um
          adiantamento só abate título da mesma empresa e do mesmo fornecedor — senão o
          acerto de contas de cada um deixaria de fechar.
        </AlertDescription>
      </Alert>
    </div>
  );
}
