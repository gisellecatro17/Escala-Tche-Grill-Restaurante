"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plus, Table2, Trash2 } from "lucide-react";

import {
  useEligibleAccounts,
  useImportTemplates,
  useTemplateActions,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
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
import { EmptyState } from "@/components/reconciliation/shared";
import { SOURCE_TYPE_LABELS } from "@/types/reconciliation";

/** Como o sinal da movimentação é determinado. Nunca é assumido (seção 21). */
const SIGN_RULES = [
  {
    kind: "CREDIT_DEBIT_COLUMNS",
    label: "Colunas separadas de crédito e débito",
  },
  { kind: "SIGNED_AMOUNT", label: "Coluna única, sinal no próprio número" },
  { kind: "TYPE_COLUMN", label: "Coluna única de valor + coluna de tipo" },
] as const;

/**
 * Modelos de leitura de extrato (seção 13).
 *
 * Cada banco exporta a planilha do seu jeito, e reconfigurar o mapeamento a cada importação
 * é onde o erro entra: alguém troca a coluna de crédito pela de débito e o extrato inteiro
 * inverte. O modelo salva a configuração validada uma vez e a reaplica.
 */
export default function ModelosImportacaoPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useImportTemplates({ organizationId, companyId });
  const { data: accounts } = useEligibleAccounts(organizationId, companyId);
  const { remove } = useTemplateActions();

  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canManage = hasPermission("reconciliation.manage_templates");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
            <Link href="/financeiro/conciliacao">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Table2 className="size-5" />
              Modelos de importação
            </h1>
            <p className="text-xs text-muted-foreground">
              Como ler o CSV ou a planilha de cada banco: quais colunas são o
              quê e como o sinal é decidido.
            </p>
          </div>
        </div>

        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Novo modelo
          </Button>
        )}
      </div>

      <Alert>
        <AlertTriangle className="size-4" />
        <AlertTitle>OFX não precisa de modelo</AlertTitle>
        <AlertDescription>
          O arquivo OFX declara a própria estrutura. Modelos existem para CSV e
          planilha, que não dizem qual coluna é a data, qual é o valor nem se um
          número positivo é entrada ou saída.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Table2}
          title="Nenhum modelo cadastrado"
          description="Cadastre um modelo por banco e por layout. Ele fica validado e é reaplicado a cada importação, sem alguém ter que remapear as colunas de novo."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Importações</TableHead>
                  <TableHead>Último uso</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.isDefault && (
                          <Badge variant="secondary">Padrão</Badge>
                        )}
                        {!item.isActive && (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SOURCE_TYPE_LABELS[item.fileType]}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.bankCode ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {item.financialAccount?.displayName ??
                        item.financialAccount?.name ??
                        "Qualquer conta"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item._count?.imports ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.lastUsedAt ? formatDateBR(item.lastUsedAt) : "Nunca"}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Arquivar modelo"
                          onClick={() => {
                            setError(null);
                            remove.mutate(item.id, {
                              onError: (caught: unknown) =>
                                setError(
                                  caught instanceof Error
                                    ? caught.message
                                    : "Não foi possível arquivar.",
                                ),
                            });
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <TemplateDialog
        open={open}
        onOpenChange={setOpen}
        organizationId={organizationId}
        companyId={companyId}
        accounts={(accounts ?? []).map((item) => ({
          id: item.account.id,
          label: item.account.displayName ?? item.account.name,
        }))}
      />
    </div>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  organizationId,
  companyId,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | undefined;
  companyId: string | undefined;
  accounts: { id: string; label: string }[];
}) {
  const { create } = useTemplateActions();

  const [name, setName] = React.useState("");
  const [bankCode, setBankCode] = React.useState("");
  const [fileType, setFileType] = React.useState("CSV");
  const [accountId, setAccountId] = React.useState("");
  const [delimiter, setDelimiter] = React.useState(";");
  const [dateFormat, setDateFormat] = React.useState("DD/MM/YYYY");
  const [headerRow, setHeaderRow] = React.useState("1");
  const [signKind, setSignKind] =
    React.useState<(typeof SIGN_RULES)[number]["kind"]>("CREDIT_DEBIT_COLUMNS");

  const [columns, setColumns] = React.useState({
    transactionDate: "Data",
    description: "Historico",
    documentNumber: "Documento",
    credit: "Credito",
    debit: "Debito",
    amount: "Valor",
    type: "Tipo",
  });

  const [creditValues, setCreditValues] = React.useState("C, CREDITO");
  const [debitValues, setDebitValues] = React.useState("D, DEBITO");
  const [error, setError] = React.useState<string | null>(null);

  function column(key: keyof typeof columns, value: string) {
    setColumns((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (!organizationId || !name) return;

    const mapping: Record<string, string> = {
      transactionDate: columns.transactionDate,
      description: columns.description,
    };

    if (columns.documentNumber) mapping.documentNumber = columns.documentNumber;

    if (signKind === "CREDIT_DEBIT_COLUMNS") {
      mapping.credit = columns.credit;
      mapping.debit = columns.debit;
    } else {
      mapping.amount = columns.amount;
      if (signKind === "TYPE_COLUMN") mapping.type = columns.type;
    }

    const signRule =
      signKind === "TYPE_COLUMN"
        ? {
            kind: signKind,
            creditValues: creditValues
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            debitValues: debitValues
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : { kind: signKind };

    setError(null);
    create.mutate(
      {
        organizationId,
        companyId,
        financialAccountId: accountId || undefined,
        name,
        bankCode: bankCode || undefined,
        fileType,
        columnMapping: mapping,
        signRule,
        delimiter: fileType === "CSV" ? delimiter : undefined,
        dateFormat,
        decimalSeparator: ",",
        thousandSeparator: ".",
        headerRow: Number(headerRow),
        dataStartRow: Number(headerRow) + 1,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName("");
        },
        onError: (caught: unknown) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível criar o modelo.",
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo modelo de importação</DialogTitle>
          <DialogDescription>
            Diga onde estão as colunas e como o sinal é determinado. O Pulse
            nunca adivinha se um valor é entrada ou saída.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível criar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Extrato Banco do Brasil — conta corrente"
            />
          </Field>

          <Field label="Código do banco">
            <Input
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value)}
              placeholder="001"
            />
          </Field>

          <Field label="Formato" required>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="XLSX">Planilha</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Conta" hint="Em branco: vale para qualquer conta.">
            <Select
              value={accountId || "any"}
              onValueChange={(value) =>
                setAccountId(value === "any" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer conta</SelectItem>
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {fileType === "CSV" && (
            <Field label="Separador">
              <Input
                value={delimiter}
                onChange={(event) => setDelimiter(event.target.value)}
                maxLength={2}
              />
            </Field>
          )}

          <Field label="Formato da data">
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                <SelectItem value="DD-MM-YYYY">DD-MM-AAAA</SelectItem>
                <SelectItem value="YYYYMMDD">AAAAMMDD</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Linha do cabeçalho">
            <Input
              type="number"
              min="1"
              value={headerRow}
              onChange={(event) => setHeaderRow(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Como o sinal é determinado"
              required
              hint="Errar aqui inverte o extrato inteiro."
            >
              <Select
                value={signKind}
                onValueChange={(value) =>
                  setSignKind(value as typeof signKind)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGN_RULES.map((rule) => (
                    <SelectItem key={rule.kind} value={rule.kind}>
                      {rule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Coluna da data" required>
            <Input
              value={columns.transactionDate}
              onChange={(event) => column("transactionDate", event.target.value)}
            />
          </Field>

          <Field label="Coluna do histórico" required>
            <Input
              value={columns.description}
              onChange={(event) => column("description", event.target.value)}
            />
          </Field>

          <Field label="Coluna do documento">
            <Input
              value={columns.documentNumber}
              onChange={(event) => column("documentNumber", event.target.value)}
            />
          </Field>

          {signKind === "CREDIT_DEBIT_COLUMNS" ? (
            <>
              <Field label="Coluna de crédito" required>
                <Input
                  value={columns.credit}
                  onChange={(event) => column("credit", event.target.value)}
                />
              </Field>
              <Field label="Coluna de débito" required>
                <Input
                  value={columns.debit}
                  onChange={(event) => column("debit", event.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label="Coluna do valor" required>
              <Input
                value={columns.amount}
                onChange={(event) => column("amount", event.target.value)}
              />
            </Field>
          )}

          {signKind === "TYPE_COLUMN" && (
            <>
              <Field label="Coluna do tipo" required>
                <Input
                  value={columns.type}
                  onChange={(event) => column("type", event.target.value)}
                />
              </Field>
              <div />
              <Field label="Textos que significam crédito" required>
                <Input
                  value={creditValues}
                  onChange={(event) => setCreditValues(event.target.value)}
                />
              </Field>
              <Field label="Textos que significam débito" required>
                <Input
                  value={debitValues}
                  onChange={(event) => setDebitValues(event.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name || create.isPending}>
            Criar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
