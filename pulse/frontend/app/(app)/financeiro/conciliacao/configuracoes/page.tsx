"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  SlidersHorizontal,
} from "lucide-react";

import {
  useEligibleAccounts,
  useReconciliationSettings,
  useUpdateReconciliationSettings,
} from "@/lib/api/reconciliation";
import { useSession } from "@/lib/auth/session-context";
import { formatDateBR } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  IMPLEMENTED_SOURCES,
  SOURCE_TYPE_LABELS,
  type ReconciliationSettings,
} from "@/types/reconciliation";

/**
 * Parâmetros da conciliação (seções 47 e 60).
 *
 * A configuração da conta vence a da empresa. Uma conta de investimento e uma conta
 * corrente não têm a mesma tolerância nem aceitam os mesmos formatos, e uma configuração só
 * forçaria a mais restritiva às duas.
 */
export default function ConciliacaoConfiguracoesPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data, isLoading } = useReconciliationSettings(
    organizationId,
    companyId,
  );
  const { data: accounts } = useEligibleAccounts(organizationId, companyId);
  const update = useUpdateReconciliationSettings(organizationId, companyId);

  const [edits, setEdits] = React.useState<Partial<ReconciliationSettings>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const canEdit = hasPermission("reconciliation.manage_settings");
  const draft = data ? { ...data.company, ...edits } : null;
  const dirty = Object.keys(edits).length > 0;

  function set<Key extends keyof ReconciliationSettings>(
    key: Key,
    value: ReconciliationSettings[Key],
  ) {
    setSaved(false);
    setEdits((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (!dirty) return;

    setError(null);
    update.mutate(edits as Record<string, unknown>, {
      onSuccess: () => {
        setEdits({});
        setSaved(true);
      },
      onError: (caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar os parâmetros.",
        ),
    });
  }

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/conciliacao">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <SlidersHorizontal className="size-5" />
            Parâmetros da conciliação
          </h1>
          <p className="text-xs text-muted-foreground">
            Valem para a empresa selecionada. Cada conta pode ter a sua exceção.
          </p>
        </div>
      </div>

      {!canEdit && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Você pode consultar os parâmetros, mas não alterá-los.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Parâmetros atualizados</AlertTitle>
          <AlertDescription>
            As novas tolerâncias valem a partir da próxima geração de sugestões.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertTriangle className="size-4" />
        <AlertTitle>Conciliação automática desligada nesta etapa</AlertTitle>
        <AlertDescription>
          Toda conciliação exige confirmação humana. O sistema apenas sugere,
          registra os critérios que usou e espera. A automação chega quando o
          motor de regras existir — e ainda assim ligada por escolha, não por
          padrão.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tolerâncias e score</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Diferença aceita (R$)"
            hint="Abaixo disto a diferença é absorvida sem justificativa."
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              disabled={!canEdit}
              value={String(draft.amountTolerance)}
              onChange={(event) =>
                set("amountTolerance", Number(event.target.value))
              }
            />
          </Field>

          <Field
            label="Diferença aceita (%)"
            hint="Vale o maior entre o percentual e o valor absoluto."
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              disabled={!canEdit}
              value={String(draft.percentageTolerance)}
              onChange={(event) =>
                set("percentageTolerance", Number(event.target.value))
              }
            />
          </Field>

          <Field
            label="Dias de folga na data"
            hint="Distância aceita entre a data bancária e a do lançamento."
          >
            <Input
              type="number"
              min="0"
              disabled={!canEdit}
              value={draft.dateToleranceDays}
              onChange={(event) =>
                set("dateToleranceDays", Number(event.target.value))
              }
            />
          </Field>

          <Field
            label="Score mínimo da sugestão"
            hint="Abaixo disto o motor nem sugere — sugestão fraca só gera ruído."
          >
            <Input
              type="number"
              min="0"
              max="100"
              disabled={!canEdit}
              value={String(draft.minimumSuggestionScore)}
              onChange={(event) =>
                set("minimumSuggestionScore", Number(event.target.value))
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">O que é permitido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Toggle
            label="Conciliação habilitada"
            hint="Desligar impede importação e conciliação em toda a empresa."
            checked={draft.isEnabled}
            disabled={!canEdit}
            onChange={(value) => set("isEnabled", value)}
          />
          <Toggle
            label="Detectar duplicidade"
            hint="Compara hash, período e identificador bancário."
            checked={draft.duplicateCheckEnabled}
            disabled={!canEdit}
            onChange={(value) => set("duplicateCheckEnabled", value)}
          />
          <Toggle
            label="Bloquear duplicidade exata"
            hint="Arquivo idêntico byte a byte é recusado."
            checked={draft.blockDuplicates}
            disabled={!canEdit}
            onChange={(value) => set("blockDuplicates", value)}
          />
          <Toggle
            label="Conciliação parcial"
            hint="Permite fechar parte do valor e deixar o resto na fila."
            checked={draft.partialMatchEnabled}
            disabled={!canEdit}
            onChange={(value) => set("partialMatchEnabled", value)}
          />
          <Toggle
            label="Conciliação múltipla"
            hint="Um para muitos e muitos para um."
            checked={draft.multipleMatchEnabled}
            disabled={!canEdit}
            onChange={(value) => set("multipleMatchEnabled", value)}
          />
          <Toggle
            label="Movimentação digitada"
            hint="Permite registrar movimentação sem arquivo, sempre marcada como manual."
            checked={draft.manualTransactionEnabled}
            disabled={!canEdit}
            onChange={(value) => set("manualTransactionEnabled", value)}
          />
          <Toggle
            label="Desfazer conciliação"
            hint="Exige permissão específica e justificativa."
            checked={draft.unmatchEnabled}
            disabled={!canEdit}
            onChange={(value) => set("unmatchEnabled", value)}
          />
          <Toggle
            label="Revisão humana obrigatória"
            hint="Nesta etapa é sempre obrigatória e não pode ser desligada."
            checked={draft.mandatoryReview}
            disabled
            onChange={() => undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Formatos aceitos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {IMPLEMENTED_SOURCES.map((source) => (
            <Badge
              key={source}
              variant={
                draft.allowedImportTypes.includes(source) ? "default" : "outline"
              }
            >
              {SOURCE_TYPE_LABELS[source]}
            </Badge>
          ))}
          <p className="w-full text-xs text-muted-foreground">
            Retorno CNAB, Open Finance e API bancária aparecem como não
            configurados: a estrutura existe, mas o módulo de integração ainda
            não foi entregue.
          </p>
        </CardContent>
      </Card>

      {canEdit && (
        <div>
          <Button onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar parâmetros
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contas e suas exceções</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Configuração</TableHead>
                <TableHead className="text-right">Tolerância</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Score mínimo</TableHead>
                <TableHead>Último extrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts ?? []).map((row) => (
                <TableRow key={row.account.id}>
                  <TableCell>
                    {row.account.displayName ?? row.account.name}
                    {!row.isEnabled && (
                      <Badge variant="outline" className="ml-2">
                        Desabilitada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.inheritsFromCompany ? "outline" : "secondary"
                      }
                    >
                      {row.inheritsFromCompany
                        ? "Herda da empresa"
                        : "Exceção própria"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {String(row.amountTolerance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.dateToleranceDays}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {String(row.minimumSuggestionScore)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.lastImportedAt
                      ? formatDateBR(row.lastImportedAt)
                      : "Nunca"}
                  </TableCell>
                </TableRow>
              ))}
              {(accounts ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Nenhuma conta financeira cadastrada nesta empresa.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
