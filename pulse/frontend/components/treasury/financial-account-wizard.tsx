"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Save } from "lucide-react";

import { ApiRequestError } from "@/lib/api/client";
import { useFinancialInstitutions } from "@/lib/api/financial-institutions";
import {
  useCreateFinancialAccount,
  useSaveDraftFinancialAccount,
  useUpdateFinancialAccount,
} from "@/lib/api/treasury";
import { useAccountPlans, useFinancialNatures } from "@/lib/api/financial-structure";
import { useCategories, useCostCenters } from "@/lib/api/taxonomy";
import { useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
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
  ACCOUNT_PURPOSE_LABELS,
  ACCOUNT_TYPE_LABELS,
  BANK_ACCOUNT_TYPES,
  RECONCILIATION_MODE_LABELS,
  type FinancialAccount,
  type FinancialAccountPurpose,
  type FinancialAccountType,
  type ReconciliationMode,
} from "@/types/treasury";

const STEPS = [
  "Identificação",
  "Dados bancários",
  "Configuração financeira",
  "Saldos e limites",
  "Chaves PIX",
  "Responsáveis",
  "Integrações",
  "Revisão",
] as const;

interface WizardValues {
  internalCode: string;
  name: string;
  displayName: string;
  accountType: FinancialAccountType;
  purpose: FinancialAccountPurpose;
  businessUnitId?: string;
  costCenterId?: string;
  isPrimary: boolean;
  isDefaultForPayments: boolean;
  isDefaultForReceipts: boolean;
  isDefaultForTaxes: boolean;
  isDefaultForPayroll: boolean;
  currencyCode: string;
  startDate: string;
  notes: string;

  financialInstitutionId?: string;
  branchNumber: string;
  branchDigit: string;
  accountNumber: string;
  accountDigit: string;
  holderName: string;
  holderDocument: string;
  isThirdParty: boolean;
  thirdPartyReason: string;
  agreementNumber: string;

  physicalLocation: string;
  requiresDailyClosing: boolean;
  checkFrequencyDays: string;

  accountPlanId?: string;
  financialNatureId?: string;
  feeCategoryId?: string;
  reconciliationMode: ReconciliationMode;
  allowsNegativeBalance: boolean;
  allowsManualEntries: boolean;
  allowsImports: boolean;
  requiresAttachment: boolean;
  requiresCategory: boolean;

  openingBalanceDate: string;
  openingBalanceAmount: string;
  minimumRecommendedBalance: string;
}

const EMPTY: WizardValues = {
  internalCode: "",
  name: "",
  displayName: "",
  accountType: "CHECKING_ACCOUNT",
  purpose: "MULTIPLE",
  isPrimary: false,
  isDefaultForPayments: false,
  isDefaultForReceipts: false,
  isDefaultForTaxes: false,
  isDefaultForPayroll: false,
  currencyCode: "BRL",
  startDate: "",
  notes: "",
  branchNumber: "",
  branchDigit: "",
  accountNumber: "",
  accountDigit: "",
  holderName: "",
  holderDocument: "",
  isThirdParty: false,
  thirdPartyReason: "",
  agreementNumber: "",
  physicalLocation: "",
  requiresDailyClosing: false,
  checkFrequencyDays: "",
  reconciliationMode: "MANUAL",
  allowsNegativeBalance: false,
  allowsManualEntries: true,
  allowsImports: true,
  requiresAttachment: false,
  requiresCategory: true,
  openingBalanceDate: "",
  openingBalanceAmount: "",
  minimumRecommendedBalance: "",
};

interface FinancialAccountWizardProps {
  /** Conta existente, para edição. */
  account?: FinancialAccount;
}

/**
 * Cadastro de conta financeira em 8 etapas (seção 10).
 *
 * As etapas bancárias somem para caixa, fundo fixo e carteira: pedir agência de um
 * caixa não faria sentido e travaria o cadastro previsto na seção 15.
 */
export function FinancialAccountWizard({ account }: FinancialAccountWizardProps) {
  const router = useRouter();
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [step, setStep] = React.useState(0);
  const [values, setValues] = React.useState<WizardValues>(() =>
    account ? accountToValues(account) : EMPTY,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);

  const institutions = useFinancialInstitutions();
  const accountPlans = useAccountPlans(organizationId, companyId);
  const natures = useFinancialNatures(organizationId, companyId);
  const categories = useCategories(companyId);
  const costCenters = useCostCenters(companyId);

  const create = useCreateFinancialAccount();
  const saveDraft = useSaveDraftFinancialAccount();
  const update = useUpdateFinancialAccount();

  const isBankAccount = BANK_ACCOUNT_TYPES.includes(values.accountType);
  const isCashLike = ["CASH", "PETTY_CASH", "DIGITAL_WALLET"].includes(
    values.accountType,
  );

  function set<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /** Valida a etapa atual antes de deixar avançar. */
  function validateStep(): string[] {
    const problems: string[] = [];

    if (step === 0) {
      if (!values.name.trim()) problems.push("Informe o nome da conta.");
      if (!companyId) problems.push("Selecione a empresa no topo da tela.");
    }

    if (step === 1 && isBankAccount) {
      if (!values.financialInstitutionId) {
        problems.push("Informe a instituição financeira.");
      }
      if (!values.branchNumber.trim()) problems.push("Informe a agência.");
      if (!values.accountNumber.trim()) problems.push("Informe o número da conta.");
      if (values.isThirdParty && !values.thirdPartyReason.trim()) {
        problems.push("Informe o motivo da utilização de uma conta de terceiro.");
      }
    }

    return problems;
  }

  function goNext() {
    const problems = validateStep();
    setFieldErrors(problems);
    if (problems.length > 0) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function buildPayload() {
    return {
      organizationId,
      companyId,
      internalCode: values.internalCode || undefined,
      name: values.name.trim(),
      displayName: values.displayName || undefined,
      accountType: values.accountType,
      purpose: values.purpose,
      businessUnitId: values.businessUnitId,
      costCenterId: values.costCenterId,
      isPrimary: values.isPrimary,
      isDefaultForPayments: values.isDefaultForPayments,
      isDefaultForReceipts: values.isDefaultForReceipts,
      isDefaultForTaxes: values.isDefaultForTaxes,
      isDefaultForPayroll: values.isDefaultForPayroll,
      currencyCode: values.currencyCode,
      startDate: values.startDate || undefined,
      notes: values.notes || undefined,

      ...(isBankAccount
        ? {
            financialInstitutionId: values.financialInstitutionId,
            branchNumber: values.branchNumber || undefined,
            branchDigit: values.branchDigit || undefined,
            accountNumber: values.accountNumber || undefined,
            accountDigit: values.accountDigit || undefined,
            holderName: values.holderName || undefined,
            holderDocument: values.holderDocument || undefined,
            isThirdParty: values.isThirdParty,
            thirdPartyReason: values.thirdPartyReason || undefined,
            agreementNumber: values.agreementNumber || undefined,
          }
        : {}),

      ...(isCashLike
        ? {
            physicalLocation: values.physicalLocation || undefined,
            requiresDailyClosing: values.requiresDailyClosing,
            checkFrequencyDays: values.checkFrequencyDays
              ? Number(values.checkFrequencyDays)
              : undefined,
          }
        : {}),

      accountPlanId: values.accountPlanId,
      financialNatureId: values.financialNatureId,
      feeCategoryId: values.feeCategoryId,
      reconciliationMode: values.reconciliationMode,
      allowsNegativeBalance: values.allowsNegativeBalance,
      allowsManualEntries: values.allowsManualEntries,
      allowsImports: values.allowsImports,
      requiresAttachment: values.requiresAttachment,
      requiresCategory: values.requiresCategory,
      minimumRecommendedBalance: values.minimumRecommendedBalance
        ? Number(values.minimumRecommendedBalance)
        : undefined,
    };
  }

  async function run(action: () => Promise<{ id: string }>) {
    setError(null);
    try {
      const result = await action();
      router.push(`/cadastros/contas-financeiras/${result.id}`);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError([caught.message, ...caught.errors].filter(Boolean).join(" "));
      } else {
        setError(caught instanceof Error ? caught.message : "Falha inesperada.");
      }
    }
  }

  const busy = create.isPending || saveDraft.isPending || update.isPending;

  if (!hasPermission("financial_account.create") && !account) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>
          Você não tem permissão para incluir contas financeiras.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {account ? "Editar conta financeira" : "Incluir nova conta financeira"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Você pode salvar como rascunho a qualquer momento e retomar depois.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              index === step
                ? "border-primary bg-primary/10 font-medium text-primary"
                : index < step
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-500"
                  : "text-muted-foreground",
            )}
          >
            {index < step ? <Check className="size-3" /> : <span>{index + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {fieldErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Complete esta etapa</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {fieldErrors.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {step + 1}. {STEPS[step]}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* 1. Identificação */}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código interno">
                <Input
                  value={values.internalCode}
                  onChange={(e) => set("internalCode", e.target.value)}
                  placeholder="CC-BB-001"
                />
              </Field>
              <Field label="Nome da conta" required>
                <Input
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Conta Operacional"
                />
              </Field>
              <Field
                label="Nome de exibição"
                hint="Usado em seletores e relatórios. Vazio, é montado com a instituição."
              >
                <Input
                  value={values.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder="Banco do Brasil — Conta Operacional"
                />
              </Field>
              <Field label="Tipo de conta" required>
                <Select
                  value={values.accountType}
                  onValueChange={(v) => set("accountType", v as FinancialAccountType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Finalidade">
                <Select
                  value={values.purpose}
                  onValueChange={(v) => set("purpose", v as FinancialAccountPurpose)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_PURPOSE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Moeda">
                <Input
                  value={values.currencyCode}
                  onChange={(e) => set("currencyCode", e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </Field>
              <Field label="Centro de custo responsável">
                <Select
                  value={values.costCenterId ?? ""}
                  onValueChange={(v) => set("costCenterId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(costCenters.data ?? []).map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data de início">
                <Input
                  type="date"
                  value={values.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </Field>

              <div className="sm:col-span-2 flex flex-col gap-2">
                <Label>Contas padrão</Label>
                {[
                  ["isPrimary", "Conta principal da empresa"],
                  ["isDefaultForPayments", "Conta padrão para pagamentos"],
                  ["isDefaultForReceipts", "Conta padrão para recebimentos"],
                  ["isDefaultForTaxes", "Conta padrão para tributos"],
                  ["isDefaultForPayroll", "Conta padrão para folha"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values[key as keyof WizardValues] as boolean}
                      onCheckedChange={(checked) =>
                        set(key as keyof WizardValues, (checked === true) as never)
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="sm:col-span-2">
                <Field label="Observações">
                  <Textarea
                    rows={3}
                    value={values.notes}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* 2. Dados bancários (ou dados do caixa) */}
          {step === 1 && isBankAccount && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Instituição financeira" required>
                  <Select
                    value={values.financialInstitutionId ?? ""}
                    onValueChange={(v) => set("financialInstitutionId", v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {(institutions.data ?? []).map((institution) => (
                        <SelectItem key={institution.id} value={institution.id}>
                          {institution.compeCode ? `${institution.compeCode} — ` : ""}
                          {institution.shortName ?? institution.legalName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Agência" required>
                <Input
                  value={values.branchNumber}
                  onChange={(e) => set("branchNumber", e.target.value)}
                  placeholder="1234"
                />
              </Field>
              <Field label="Dígito da agência">
                <Input
                  value={values.branchDigit}
                  onChange={(e) => set("branchDigit", e.target.value)}
                  maxLength={2}
                />
              </Field>
              <Field label="Conta" required>
                <Input
                  value={values.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  placeholder="12345"
                />
              </Field>
              <Field label="Dígito da conta">
                <Input
                  value={values.accountDigit}
                  onChange={(e) => set("accountDigit", e.target.value)}
                  maxLength={2}
                />
              </Field>
              <Field label="Titular">
                <Input
                  value={values.holderName}
                  onChange={(e) => set("holderName", e.target.value)}
                />
              </Field>
              <Field label="CPF/CNPJ do titular">
                <Input
                  value={values.holderDocument}
                  onChange={(e) => set("holderDocument", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </Field>
              <Field label="Número do convênio">
                <Input
                  value={values.agreementNumber}
                  onChange={(e) => set("agreementNumber", e.target.value)}
                />
              </Field>

              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={values.isThirdParty}
                    onCheckedChange={(checked) =>
                      set("isThirdParty", checked === true)
                    }
                  />
                  <span>
                    O titular da conta é diferente da empresa
                    <span className="block text-xs text-muted-foreground">
                      Conta de terceiro exige justificativa, permissão específica e fica
                      registrada na auditoria.
                    </span>
                  </span>
                </label>

                {values.isThirdParty && (
                  <Field label="Motivo da conta de terceiro" required>
                    <Textarea
                      rows={2}
                      value={values.thirdPartyReason}
                      onChange={(e) => set("thirdPartyReason", e.target.value)}
                      placeholder="Conta do sócio utilizada para o aluguel do imóvel."
                    />
                  </Field>
                )}
              </div>
            </div>
          )}

          {step === 1 && !isBankAccount && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Alert className="sm:col-span-2">
                <AlertTriangle />
                <AlertTitle>Sem dados bancários</AlertTitle>
                <AlertDescription>
                  {ACCOUNT_TYPE_LABELS[values.accountType]} não tem instituição, agência
                  nem conta. Informe apenas os dados de controle abaixo.
                </AlertDescription>
              </Alert>

              <Field label="Local físico">
                <Input
                  value={values.physicalLocation}
                  onChange={(e) => set("physicalLocation", e.target.value)}
                  placeholder="Frente de caixa do salão"
                />
              </Field>
              <Field label="Frequência de conferência (dias)">
                <Input
                  type="number"
                  min={1}
                  value={values.checkFrequencyDays}
                  onChange={(e) => set("checkFrequencyDays", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.requiresDailyClosing}
                    onCheckedChange={(checked) =>
                      set("requiresDailyClosing", checked === true)
                    }
                  />
                  Exigir fechamento diário
                </label>
              </div>
            </div>
          )}

          {/* 3. Configuração financeira */}
          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conta do plano de contas">
                <Select
                  value={values.accountPlanId ?? ""}
                  onValueChange={(v) => set("accountPlanId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(accountPlans.data ?? []).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.code} {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Natureza financeira padrão">
                <Select
                  value={values.financialNatureId ?? ""}
                  onValueChange={(v) => set("financialNatureId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(natures.data ?? []).map((nature) => (
                      <SelectItem key={nature.id} value={nature.id}>
                        {nature.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Categoria padrão de tarifas"
                hint="Sugerida nos lançamentos de tarifa bancária."
              >
                <Select
                  value={values.feeCategoryId ?? ""}
                  onValueChange={(v) => set("feeCategoryId", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Regime de conciliação">
                <Select
                  value={values.reconciliationMode}
                  onValueChange={(v) =>
                    set("reconciliationMode", v as ReconciliationMode)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECONCILIATION_MODE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <div className="sm:col-span-2 flex flex-col gap-2">
                <Label>Regras de movimentação</Label>
                {[
                  ["allowsNegativeBalance", "Permitir saldo negativo"],
                  ["allowsManualEntries", "Permitir movimentação manual"],
                  ["allowsImports", "Permitir importação de extrato"],
                  ["requiresAttachment", "Exigir comprovante"],
                  ["requiresCategory", "Exigir categoria"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={values[key as keyof WizardValues] as boolean}
                      onCheckedChange={(checked) =>
                        set(key as keyof WizardValues, (checked === true) as never)
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 4. Saldos e limites */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertTriangle />
                <AlertTitle>O saldo inicial serve à implantação</AlertTitle>
                <AlertDescription>
                  Depois que a conta tiver movimentação, alterá-lo exigirá justificativa
                  e ficará registrado na auditoria. O saldo é registrado na tela da conta,
                  após salvar.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Saldo mínimo recomendado">
                  <Input
                    type="number"
                    step="0.01"
                    value={values.minimumRecommendedBalance}
                    onChange={(e) =>
                      set("minimumRecommendedBalance", e.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          )}

          {/* 5 a 7: etapas que dependem da conta já existir */}
          {step >= 4 && step <= 6 && (
            <Alert>
              <AlertTriangle />
              <AlertTitle>Disponível após salvar a conta</AlertTitle>
              <AlertDescription>
                {step === 4 &&
                  "As chaves PIX são cadastradas na aba Chaves PIX da conta, porque cada chave precisa apontar para uma conta já existente."}
                {step === 5 &&
                  "Os responsáveis e suas alçadas são definidos na aba Responsáveis da conta."}
                {step === 6 &&
                  "As integrações bancárias são configuradas na aba Integrações da conta. Nenhuma credencial é enviada por este formulário."}
              </AlertDescription>
            </Alert>
          )}

          {/* 8. Revisão */}
          {step === 7 && (
            <div className="flex flex-col gap-4">
              <ReviewSection title="Identificação" onEdit={() => setStep(0)}>
                <ReviewRow label="Nome" value={values.name} />
                <ReviewRow
                  label="Tipo"
                  value={ACCOUNT_TYPE_LABELS[values.accountType]}
                />
                <ReviewRow
                  label="Finalidade"
                  value={ACCOUNT_PURPOSE_LABELS[values.purpose]}
                />
                <ReviewRow label="Moeda" value={values.currencyCode} />
              </ReviewSection>

              {isBankAccount && (
                <ReviewSection title="Dados bancários" onEdit={() => setStep(1)}>
                  <ReviewRow
                    label="Banco"
                    value={
                      institutions.data?.find(
                        (i) => i.id === values.financialInstitutionId,
                      )?.shortName ?? "—"
                    }
                  />
                  <ReviewRow
                    label="Agência"
                    value={[values.branchNumber, values.branchDigit]
                      .filter(Boolean)
                      .join("-")}
                  />
                  <ReviewRow
                    label="Conta"
                    value={[values.accountNumber, values.accountDigit]
                      .filter(Boolean)
                      .join("-")}
                  />
                  {values.isThirdParty && (
                    <ReviewRow label="Conta de terceiro" value="Sim" />
                  )}
                </ReviewSection>
              )}

              <ReviewSection title="Configuração financeira" onEdit={() => setStep(2)}>
                <ReviewRow
                  label="Regime de conciliação"
                  value={RECONCILIATION_MODE_LABELS[values.reconciliationMode]}
                />
              </ReviewSection>

              <Alert>
                <AlertTriangle />
                <AlertTitle>A conta nascerá pendente de validação</AlertTitle>
                <AlertDescription>
                  Depois de salvar, confira as pendências na tela da conta e ative-a.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              <ArrowLeft /> Voltar
            </Button>

            <div className="flex flex-wrap gap-2">
              {!account && (
                <Button
                  variant="outline"
                  disabled={busy || !values.name.trim() || !companyId}
                  onClick={() => void run(() => saveDraft.mutateAsync(buildPayload()))}
                >
                  <Save /> Salvar como rascunho
                </Button>
              )}

              {step < STEPS.length - 1 ? (
                <Button onClick={goNext}>
                  Continuar <ArrowRight />
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      account
                        ? update.mutateAsync({
                            id: account.id,
                            payload: buildPayload(),
                          })
                        : create.mutateAsync(buildPayload()),
                    )
                  }
                >
                  <Check /> {account ? "Salvar alterações" : "Concluir cadastro"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function accountToValues(account: FinancialAccount): WizardValues {
  return {
    ...EMPTY,
    internalCode: account.internalCode ?? "",
    name: account.name,
    displayName: account.displayName ?? "",
    accountType: account.accountType,
    purpose: account.purpose,
    businessUnitId: account.businessUnitId ?? undefined,
    costCenterId: account.costCenterId ?? undefined,
    isPrimary: account.isPrimary,
    isDefaultForPayments: account.isDefaultForPayments,
    isDefaultForReceipts: account.isDefaultForReceipts,
    isDefaultForTaxes: account.isDefaultForTaxes,
    isDefaultForPayroll: account.isDefaultForPayroll,
    currencyCode: account.currencyCode,
    startDate: account.startDate?.slice(0, 10) ?? "",
    notes: account.notes ?? "",
    financialInstitutionId: account.financialInstitutionId ?? undefined,
    branchNumber: account.branchNumber ?? "",
    branchDigit: account.branchDigit ?? "",
    accountNumber: account.accountNumber ?? "",
    accountDigit: account.accountDigit ?? "",
    holderName: account.holderName ?? "",
    holderDocument: account.holderDocument ?? "",
    isThirdParty: account.isThirdParty,
    thirdPartyReason: account.thirdPartyReason ?? "",
    agreementNumber: account.agreementNumber ?? "",
    physicalLocation: account.physicalLocation ?? "",
    requiresDailyClosing: account.requiresDailyClosing,
    checkFrequencyDays: account.checkFrequencyDays
      ? String(account.checkFrequencyDays)
      : "",
    accountPlanId: account.accountPlanId ?? undefined,
    financialNatureId: account.financialNatureId ?? undefined,
    reconciliationMode: account.reconciliationMode,
    allowsNegativeBalance: account.allowsNegativeBalance,
    allowsManualEntries: account.allowsManualEntries,
    allowsImports: account.allowsImports,
    requiresAttachment: account.requiresAttachment,
    requiresCategory: account.requiresCategory,
  };
}
