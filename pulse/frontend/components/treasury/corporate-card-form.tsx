"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, ShieldCheck } from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import { useFinancialInstitutions } from "@/lib/api/financial-institutions";
import { useCorporateCardActions, useFinancialAccounts } from "@/lib/api/treasury";
import { useCostCenters } from "@/lib/api/taxonomy";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import {
  CARD_TYPE_LABELS,
  type CorporateCard,
  type CorporateCardType,
} from "@/types/treasury";

const NONE = "none";

interface CardValues {
  name: string;
  displayName: string;
  cardType: CorporateCardType;
  brand: string;
  lastFourDigits: string;
  holderName: string;
  financialAccountId: string;
  financialInstitutionId: string;
  costCenterId: string;
  responsibleUserId: string;
  isPhysical: boolean;
  isVirtual: boolean;
  totalLimit: string;
  transactionLimit: string;
  closingDay: string;
  dueDay: string;
  allowsInstallments: boolean;
  maximumInstallments: string;
  issueDate: string;
  expirationDate: string;
  notes: string;
}

const EMPTY: CardValues = {
  name: "",
  displayName: "",
  cardType: "CREDIT",
  brand: "",
  lastFourDigits: "",
  holderName: "",
  financialAccountId: NONE,
  financialInstitutionId: NONE,
  costCenterId: NONE,
  responsibleUserId: NONE,
  isPhysical: true,
  isVirtual: false,
  totalLimit: "",
  transactionLimit: "",
  closingDay: "",
  dueDay: "",
  allowsInstallments: true,
  maximumInstallments: "",
  issueDate: "",
  expirationDate: "",
  notes: "",
};

function cardToValues(card: CorporateCard): CardValues {
  return {
    ...EMPTY,
    name: card.name,
    displayName: card.displayName ?? "",
    cardType: card.cardType,
    brand: card.brand ?? "",
    lastFourDigits: card.lastFourDigits,
    holderName: card.holderName ?? "",
    financialAccountId: card.financialAccountId ?? NONE,
    costCenterId: card.costCenter?.id ?? NONE,
    financialInstitutionId: card.financialInstitution?.id ?? NONE,
    responsibleUserId: card.responsibleUserId ?? NONE,
    isPhysical: card.isPhysical,
    isVirtual: card.isVirtual,
    totalLimit: card.totalLimit != null ? String(card.totalLimit) : "",
    transactionLimit:
      card.transactionLimit != null ? String(card.transactionLimit) : "",
    closingDay: card.closingDay != null ? String(card.closingDay) : "",
    dueDay: card.dueDay != null ? String(card.dueDay) : "",
    allowsInstallments: card.allowsInstallments,
    maximumInstallments:
      card.maximumInstallments != null ? String(card.maximumInstallments) : "",
    issueDate: card.issueDate?.slice(0, 10) ?? "",
    expirationDate: card.expirationDate?.slice(0, 10) ?? "",
    notes: card.notes ?? "",
  };
}

/**
 * Cadastro de cartão corporativo.
 *
 * O formulário **não tem** campo para número completo, CVV ou senha (seções 38 e 39):
 * o que a tela não coleta não trafega, não chega ao back-end e não pode ser gravado.
 */
export function CorporateCardForm({ card }: { card?: CorporateCard }) {
  const router = useRouter();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = card?.companyId ?? selectedCompanyId ?? undefined;

  const [values, setValues] = React.useState<CardValues>(
    card ? cardToValues(card) : EMPTY,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [problems, setProblems] = React.useState<string[]>([]);

  const { create, update } = useCorporateCardActions();
  const { data: institutions } = useFinancialInstitutions();
  const { data: costCenters } = useCostCenters(companyId);
  const { data: accounts } = useFinancialAccounts({
    organizationId,
    companyId,
    status: "ACTIVE",
    perPage: 100,
  });

  function set<K extends keyof CardValues>(key: K, value: CardValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const isCredit = values.cardType === "CREDIT" || values.cardType === "MULTIPLE";

  function validate() {
    const found: string[] = [];
    if (!values.name.trim()) found.push("Informe o nome do cartão.");
    if (!/^\d{4}$/.test(values.lastFourDigits))
      found.push("Informe exatamente os quatro últimos dígitos do cartão.");
    if (!values.isPhysical && !values.isVirtual)
      found.push("O cartão deve ser físico, virtual ou os dois.");
    if (isCredit && (!values.closingDay || !values.dueDay))
      found.push(
        "Cartão de crédito precisa de dia de fechamento e dia de vencimento.",
      );
    if (values.allowsInstallments && values.maximumInstallments === "")
      found.push("Informe o número máximo de parcelas ou desmarque o parcelamento.");
    setProblems(found);
    return found.length === 0;
  }

  function optionalId(value: string) {
    return value === NONE ? undefined : value;
  }

  function optionalNumber(value: string) {
    return value === "" ? undefined : Number(value);
  }

  function buildPayload() {
    return {
      name: values.name.trim(),
      displayName: values.displayName.trim() || undefined,
      cardType: values.cardType,
      brand: values.brand.trim() || undefined,
      lastFourDigits: values.lastFourDigits,
      holderName: values.holderName.trim() || undefined,
      financialAccountId: optionalId(values.financialAccountId),
      financialInstitutionId: optionalId(values.financialInstitutionId),
      costCenterId: optionalId(values.costCenterId),
      responsibleUserId: optionalId(values.responsibleUserId),
      isPhysical: values.isPhysical,
      isVirtual: values.isVirtual,
      totalLimit: optionalNumber(values.totalLimit),
      transactionLimit: optionalNumber(values.transactionLimit),
      closingDay: optionalNumber(values.closingDay),
      dueDay: optionalNumber(values.dueDay),
      allowsInstallments: values.allowsInstallments,
      maximumInstallments: optionalNumber(values.maximumInstallments),
      issueDate: values.issueDate || undefined,
      expirationDate: values.expirationDate || undefined,
      notes: values.notes.trim() || undefined,
    };
  }

  async function submit() {
    if (!validate()) return;
    setError(null);

    try {
      const payload = buildPayload();
      const saved = card
        ? await update.mutateAsync({ id: card.id, payload })
        : await create.mutateAsync({ ...payload, organizationId, companyId });
      router.push(`/cadastros/cartoes/${saved.id}`);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError([caught.message, ...caught.errors].filter(Boolean).join(" "));
      } else {
        setError(caught instanceof Error ? caught.message : "Falha inesperada.");
      }
    }
  }

  if (!card && !hasPermission("card.create")) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para incluir cartões corporativos.
        </AlertDescription>
      </Alert>
    );
  }

  if (!companyId) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Selecione uma empresa</AlertTitle>
        <AlertDescription>
          O cartão pertence a uma empresa. Selecione a empresa antes de cadastrar.
        </AlertDescription>
      </Alert>
    );
  }

  const busy = create.isPending || update.isPending;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {card ? "Editar cartão corporativo" : "Incluir novo cartão corporativo"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Cadastre o cartão para controle interno de despesas e conciliação de fatura.
        </p>
      </div>

      <Alert>
        <ShieldCheck />
        <AlertTitle>O que o sistema não guarda</AlertTitle>
        <AlertDescription>
          Número completo, código de segurança e senha não são solicitados nem
          armazenados. Apenas os quatro últimos dígitos ficam registrados, para
          identificação e conciliação.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Complete o cadastro</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do cartão" required>
            <Input
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Cartão Operacional"
            />
          </Field>
          <Field label="Nome de exibição">
            <Input
              value={values.displayName}
              onChange={(event) => set("displayName", event.target.value)}
              placeholder="Visa •••• 4587"
            />
          </Field>
          <Field label="Tipo" required>
            <Select
              value={values.cardType}
              onValueChange={(value) => set("cardType", value as CorporateCardType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bandeira">
            <Input
              value={values.brand}
              onChange={(event) => set("brand", event.target.value)}
              placeholder="Visa, Mastercard, Elo…"
            />
          </Field>
          <Field
            label="Quatro últimos dígitos"
            required
            hint="Somente estes quatro dígitos são armazenados."
          >
            <Input
              value={values.lastFourDigits}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) =>
                set("lastFourDigits", event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="4587"
            />
          </Field>
          <Field label="Nome impresso no cartão">
            <Input
              value={values.holderName}
              onChange={(event) => set("holderName", event.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Formato</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isPhysical}
                  onCheckedChange={(checked) => set("isPhysical", checked === true)}
                />
                Físico
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isVirtual}
                  onCheckedChange={(checked) => set("isVirtual", checked === true)}
                />
                Virtual
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vínculos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Conta que paga a fatura"
            hint="Somente contas ativas da empresa selecionada."
          >
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
          <Field label="Instituição emissora">
            <Select
              value={values.financialInstitutionId}
              onValueChange={(value) => set("financialInstitutionId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(institutions ?? []).map((institution) => (
                  <SelectItem key={institution.id} value={institution.id}>
                    {institution.shortName ?? institution.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Centro de custo padrão">
            <Select
              value={values.costCenterId}
              onValueChange={(value) => set("costCenterId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {(costCenters ?? []).map((costCenter) => (
                  <SelectItem key={costCenter.id} value={costCenter.id}>
                    {costCenter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limites e ciclo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Limite total">
            <Input
              value={values.totalLimit}
              inputMode="decimal"
              onChange={(event) => set("totalLimit", event.target.value)}
              placeholder="20000.00"
            />
          </Field>
          <Field label="Limite por transação">
            <Input
              value={values.transactionLimit}
              inputMode="decimal"
              onChange={(event) => set("transactionLimit", event.target.value)}
              placeholder="5000.00"
            />
          </Field>
          <Field
            label="Dia de fechamento"
            required={isCredit}
            hint={isCredit ? "Obrigatório para cartão de crédito." : undefined}
          >
            <Input
              value={values.closingDay}
              inputMode="numeric"
              onChange={(event) => set("closingDay", event.target.value)}
              placeholder="25"
            />
          </Field>
          <Field label="Dia de vencimento" required={isCredit}>
            <Input
              value={values.dueDay}
              inputMode="numeric"
              onChange={(event) => set("dueDay", event.target.value)}
              placeholder="5"
            />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.allowsInstallments}
                onCheckedChange={(checked) =>
                  set("allowsInstallments", checked === true)
                }
              />
              Permite parcelamento
            </label>
          </div>
          {values.allowsInstallments && (
            <Field label="Máximo de parcelas" required>
              <Input
                value={values.maximumInstallments}
                inputMode="numeric"
                onChange={(event) => set("maximumInstallments", event.target.value)}
                placeholder="12"
              />
            </Field>
          )}
          <Field label="Data de emissão">
            <Input
              type="date"
              value={values.issueDate}
              onChange={(event) => set("issueDate", event.target.value)}
            />
          </Field>
          <Field
            label="Data de validade"
            hint="Usada para o alerta de cartão próximo do vencimento."
          >
            <Input
              type="date"
              value={values.expirationDate}
              onChange={(event) => set("expirationDate", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <Textarea
                value={values.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={3}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={busy}>
          <Save /> {busy ? "Salvando…" : "Salvar cartão"}
        </Button>
      </div>
    </div>
  );
}
