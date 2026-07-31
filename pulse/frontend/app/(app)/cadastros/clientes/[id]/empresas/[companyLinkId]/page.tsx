"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  useAddBillingRule,
  useAddCollectionHistory,
  useAddContract,
  useAddRecurringReceivable,
  useConvertProspect,
  useCustomerLink,
  useCustomerLinkAuditLog,
  useUpdateCustomerCredit,
  useUpdateCustomerLink,
} from "@/lib/api/customers";
import { useSession } from "@/lib/auth/session-context";
import { CategorySelect } from "@/components/suppliers/category-select";
import { CostCenterSelect } from "@/components/suppliers/cost-center-select";
import { CustomerFinancialStatusBadge } from "@/components/customers/customer-financial-status-badge";
import { CustomerLinkStatusBadge } from "@/components/customers/customer-link-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyBRL, formatDateTimeBR } from "@/lib/format";
import { ApiRequestError } from "@/lib/api/client";
import {
  ABC_CLASSIFICATION_LABELS,
  COLLECTION_CHANNEL_LABELS,
  CUSTOMER_PAYMENT_METHOD_LABELS,
  RECURRENCE_PERIODICITY_LABELS,
  REVENUE_POTENTIAL_LABELS,
  RISK_LEVEL_LABELS,
  type CustomerCompanyLink,
} from "@/types/customer";

function ClassificationTab({ linkId, companyId }: { linkId: string; companyId: string }) {
  const { data: link } = useCustomerLink(linkId);
  if (!link) return null;
  return <ClassificationForm key={link.id} linkId={linkId} companyId={companyId} link={link} />;
}

function ClassificationForm({ linkId, companyId, link }: { linkId: string; companyId: string; link: CustomerCompanyLink }) {
  const update = useUpdateCustomerLink(linkId);
  const [categoryId, setCategoryId] = React.useState<string | undefined>(link.defaultRevenueCategoryId ?? undefined);
  const [subcategoryId, setSubcategoryId] = React.useState<string | undefined>(link.defaultSubcategoryId ?? undefined);
  const [resultCenterId, setResultCenterId] = React.useState<string | undefined>(link.defaultResultCenterId ?? undefined);
  const [abcClassification, setAbcClassification] = React.useState(link.abcClassification ?? "NOT_CLASSIFIED");
  const [revenuePotentialLevel, setRevenuePotentialLevel] = React.useState(link.revenuePotentialLevel ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Classificação comercial</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategorySelect companyId={companyId} value={categoryId} onChange={setCategoryId} label="Categoria de receita padrão" />
        <CategorySelect
          companyId={companyId}
          value={subcategoryId}
          onChange={setSubcategoryId}
          parentCategoryId={categoryId}
          label="Subcategoria de receita"
        />
        <CostCenterSelect companyId={companyId} value={resultCenterId} onChange={setResultCenterId} label="Centro de resultado" />
        <div className="flex flex-col gap-1.5">
          <Label>Classificação ABC</Label>
          <Select value={abcClassification} onValueChange={(v) => setAbcClassification(v as never)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ABC_CLASSIFICATION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Potencial de receita</Label>
          <Select value={revenuePotentialLevel} onValueChange={(v) => setRevenuePotentialLevel(v as never)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REVENUE_POTENTIAL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Button
            onClick={() =>
              update.mutate({
                defaultRevenueCategoryId: categoryId,
                defaultSubcategoryId: subcategoryId,
                defaultResultCenterId: resultCenterId,
                abcClassification,
                revenuePotentialLevel,
              })
            }
            disabled={update.isPending}
          >
            {update.isPending && <Loader2 className="animate-spin" />}
            Salvar classificação
          </Button>
          {update.isSuccess && <p className="mt-2 text-sm text-success">Classificação comercial atualizada com sucesso.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentTermsTab({ linkId }: { linkId: string }) {
  const { data: link } = useCustomerLink(linkId);
  if (!link) return null;
  return <PaymentTermsForm key={link.id} linkId={linkId} link={link} />;
}

function PaymentTermsForm({ linkId, link }: { linkId: string; link: CustomerCompanyLink }) {
  const update = useUpdateCustomerLink(linkId);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = React.useState(link.preferredPaymentMethod ?? undefined);
  const [billingFrequency, setBillingFrequency] = React.useState(link.billingFrequency ?? undefined);
  const [paymentTermDays, setPaymentTermDays] = React.useState<number | undefined>(link.paymentTermDays ?? undefined);
  const [defaultDueDay, setDefaultDueDay] = React.useState<number | undefined>(link.defaultDueDay ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Condições de recebimento</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Forma de recebimento preferencial</Label>
          <Select value={preferredPaymentMethod} onValueChange={(v) => setPreferredPaymentMethod(v as never)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CUSTOMER_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Periodicidade</Label>
          <Select value={billingFrequency} onValueChange={(v) => setBillingFrequency(v as never)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RECURRENCE_PERIODICITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Prazo (dias)</Label>
          <Input type="number" min={0} value={paymentTermDays ?? ""} onChange={(e) => setPaymentTermDays(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Dia fixo de vencimento</Label>
          <Input type="number" min={1} max={31} value={defaultDueDay ?? ""} onChange={(e) => setDefaultDueDay(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="sm:col-span-2">
          <Button
            onClick={() => update.mutate({ preferredPaymentMethod, billingFrequency, paymentTermDays, defaultDueDay })}
            disabled={update.isPending}
          >
            {update.isPending && <Loader2 className="animate-spin" />}
            Salvar condições de recebimento
          </Button>
          {update.isSuccess && <p className="mt-2 text-sm text-success">Condições de recebimento atualizadas com sucesso.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CreditTab({ linkId, companyId }: { linkId: string; companyId: string }) {
  const { data: link } = useCustomerLink(linkId);
  const { hasPermissionForCompany } = useSession();
  const canUpdateCredit = hasPermissionForCompany(companyId, "customer.update_credit_limit");
  const canViewCredit = hasPermissionForCompany(companyId, "customer.view_credit_information");

  if (!link) return null;

  if (!canViewCredit) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Você não tem permissão para visualizar as informações de crédito deste cliente.
        </CardContent>
      </Card>
    );
  }

  return <CreditForm key={link.id} linkId={linkId} link={link} canUpdateCredit={canUpdateCredit} />;
}

function CreditForm({ linkId, link, canUpdateCredit }: { linkId: string; link: CustomerCompanyLink; canUpdateCredit: boolean }) {
  const update = useUpdateCustomerCredit(linkId);
  const [creditLimit, setCreditLimit] = React.useState<number | undefined>(link.creditLimit ?? undefined);
  const [riskLevel, setRiskLevel] = React.useState(link.riskLevel ?? "NOT_ASSESSED");
  const [allowOverCreditLimit, setAllowOverCreditLimit] = React.useState(link.allowOverCreditLimit ?? false);
  const [automaticBlockEnabled, setAutomaticBlockEnabled] = React.useState(link.automaticBlockEnabled ?? false);
  const [automaticBlockDays, setAutomaticBlockDays] = React.useState<number | undefined>(link.automaticBlockDays ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crédito e situação financeira</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!canUpdateCredit && (
          <Alert>
            <AlertDescription>
              Você tem permissão apenas para visualizar estas informações. A alteração do limite de crédito exige a
              permissão dedicada de atualização de crédito.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Limite de crédito</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={creditLimit ?? ""}
              disabled={!canUpdateCredit}
              onChange={(e) => setCreditLimit(e.target.value ? Number(e.target.value) : undefined)}
            />
            {creditLimit !== undefined && <p className="text-xs text-muted-foreground">{formatCurrencyBRL(creditLimit)}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nível de risco</Label>
            <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v as never)} disabled={!canUpdateCredit}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_LEVEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowOverCreditLimit} disabled={!canUpdateCredit} onChange={(e) => setAllowOverCreditLimit(e.target.checked)} />
          Permitir lançamentos acima do limite
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={automaticBlockEnabled} disabled={!canUpdateCredit} onChange={(e) => setAutomaticBlockEnabled(e.target.checked)} />
          Bloquear automaticamente por atraso
        </label>
        {automaticBlockEnabled && (
          <div className="w-48">
            <Label>Dias de atraso</Label>
            <Input
              type="number"
              min={1}
              value={automaticBlockDays ?? ""}
              disabled={!canUpdateCredit}
              onChange={(e) => setAutomaticBlockDays(e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        )}
        {canUpdateCredit && (
          <div>
            <Button
              onClick={() => update.mutate({ creditLimit, riskLevel, allowOverCreditLimit, automaticBlockEnabled, automaticBlockDays })}
              disabled={update.isPending}
            >
              {update.isPending && <Loader2 className="animate-spin" />}
              Salvar informações de crédito
            </Button>
            {update.isSuccess && <p className="mt-2 text-sm text-success">Informações de crédito atualizadas com sucesso.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BillingRulesTab({ linkId }: { linkId: string }) {
  const { data: link } = useCustomerLink(linkId);
  const addRule = useAddBillingRule(linkId);
  const addHistory = useAddCollectionHistory(linkId);
  const [referenceEvent, setReferenceEvent] = React.useState("due_date");
  const [daysOffset, setDaysOffset] = React.useState<number>(-5);
  const [channel, setChannel] = React.useState<string>("EMAIL");
  const [historyChannel, setHistoryChannel] = React.useState<string>("EMAIL");
  const [historyNotes, setHistoryNotes] = React.useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras de cobrança</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(link?.billingRules ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra de cobrança cadastrada.</p>}
          <ul className="flex flex-col gap-1 text-sm">
            {(link?.billingRules ?? []).map((rule) => (
              <li key={rule.id}>
                {rule.referenceEvent} ({rule.daysOffset >= 0 ? "+" : ""}
                {rule.daysOffset} dia(s)) — {COLLECTION_CHANNEL_LABELS[rule.channel]}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Evento de referência</Label>
              <Input value={referenceEvent} onChange={(e) => setReferenceEvent(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Deslocamento (dias)</Label>
              <Input type="number" value={daysOffset} onChange={(e) => setDaysOffset(Number(e.target.value))} className="w-32" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COLLECTION_CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addRule.mutate({ referenceEvent, daysOffset, channel })} disabled={addRule.isPending}>
              Incluir nova regra
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de cobrança</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Alert>
            <AlertDescription>Nenhuma mensagem real é enviada — este é apenas um registro manual do histórico de cobrança.</AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Canal</Label>
              <Select value={historyChannel} onValueChange={setHistoryChannel}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COLLECTION_CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Observações</Label>
              <Input value={historyNotes} onChange={(e) => setHistoryNotes(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                addHistory.mutate({ channel: historyChannel, notes: historyNotes });
                setHistoryNotes("");
              }}
              disabled={addHistory.isPending}
            >
              Registrar contato
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContractsRecurringTab({ linkId }: { linkId: string }) {
  const { data: link } = useCustomerLink(linkId);
  const addContract = useAddContract(linkId);
  const addRecurring = useAddRecurringReceivable(linkId);
  const [contractDescription, setContractDescription] = React.useState("");
  const [receivableDescription, setReceivableDescription] = React.useState("");
  const [receivableAmount, setReceivableAmount] = React.useState<number | undefined>();
  const [receivableFrequency, setReceivableFrequency] = React.useState("MONTHLY");
  const [receivableStartDate, setReceivableStartDate] = React.useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contratos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(link?.contracts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>}
          <ul className="flex flex-col gap-1 text-sm">
            {(link?.contracts ?? []).map((c) => (
              <li key={c.id}>
                {c.contractNumber ?? "Sem número"} — {c.description ?? "Sem descrição"}
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Descrição do novo contrato</Label>
              <Input value={contractDescription} onChange={(e) => setContractDescription(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                addContract.mutate({ description: contractDescription });
                setContractDescription("");
              }}
              disabled={!contractDescription.trim() || addContract.isPending}
            >
              Incluir novo contrato
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recorrências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Alert>
            <AlertDescription>
              Enquanto o módulo de contas a receber não existir, apenas a configuração da recorrência é criada — nenhum
              lançamento financeiro definitivo é gerado.
            </AlertDescription>
          </Alert>
          {(link?.recurringReceivables ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma recorrência cadastrada.</p>}
          <ul className="flex flex-col gap-1 text-sm">
            {(link?.recurringReceivables ?? []).map((r) => (
              <li key={r.id}>
                {r.description ?? "Sem descrição"} — {formatCurrencyBRL(r.amount)} · {RECURRENCE_PERIODICITY_LABELS[r.frequency]}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Descrição</Label>
              <Input value={receivableDescription} onChange={(e) => setReceivableDescription(e.target.value)} className="w-48" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Valor</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={receivableAmount ?? ""}
                onChange={(e) => setReceivableAmount(e.target.value ? Number(e.target.value) : undefined)}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Periodicidade</Label>
              <Select value={receivableFrequency} onValueChange={setReceivableFrequency}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_PERIODICITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data inicial</Label>
              <Input type="date" value={receivableStartDate} onChange={(e) => setReceivableStartDate(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                if (!receivableAmount || !receivableStartDate) return;
                addRecurring.mutate({
                  description: receivableDescription,
                  amount: receivableAmount,
                  frequency: receivableFrequency,
                  startDate: receivableStartDate,
                });
                setReceivableDescription("");
                setReceivableAmount(undefined);
                setReceivableStartDate("");
              }}
              disabled={!receivableAmount || !receivableStartDate || addRecurring.isPending}
            >
              Incluir nova recorrência
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab({ linkId }: { linkId: string }) {
  const [page, setPage] = React.useState(1);
  const { data: auditLog } = useCustomerLinkAuditLog(linkId, page);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico e auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        {!auditLog || auditLog.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2 text-sm">
              {auditLog.items.map((entry) => (
                <li key={entry.id} className="border-b pb-2 last:border-0">
                  <span className="font-medium">{entry.action}</span> <span className="text-muted-foreground">— {entry.entity}</span>
                  <p className="text-xs text-muted-foreground">{formatDateTimeBR(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= auditLog.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConvertProspectAlert({ linkId }: { linkId: string }) {
  const convert = useConvertProspect(linkId);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Alert>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          Este cliente é um Prospect. Complete a categoria de receita, a condição de recebimento e um contato financeiro
          para convertê-lo em cliente ativo.
        </span>
        <Button
          size="sm"
          onClick={() => {
            setError(null);
            convert.mutate(undefined, {
              onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Não foi possível converter o prospect."),
            });
          }}
          disabled={convert.isPending}
        >
          {convert.isPending && <Loader2 className="animate-spin" />}
          Converter em cliente
        </Button>
      </AlertDescription>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </Alert>
  );
}

export default function CustomerCompanyLinkPage() {
  const params = useParams<{ id: string; companyLinkId: string }>();
  const { data: link, isLoading } = useCustomerLink(params.companyLinkId);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!link) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vínculo com {link.company?.displayName ?? link.company?.legalName}</h1>
          <p className="text-sm text-muted-foreground">Configurações específicas deste cliente para esta empresa.</p>
        </div>
        <div className="flex gap-2">
          <CustomerLinkStatusBadge status={link.status} />
          <CustomerFinancialStatusBadge status={link.financialStatus} />
        </div>
      </div>

      {link.status === "PROSPECT" && <ConvertProspectAlert linkId={link.id} />}

      {link.status === "BLOCKED" && (
        <Alert variant="destructive">
          <AlertDescription>Cliente bloqueado{link.blockReason ? `: ${link.blockReason}` : "."}</AlertDescription>
        </Alert>
      )}
      {link.status === "SUSPENDED" && (
        <Alert variant="destructive">
          <AlertDescription>Cliente suspenso{link.suspensionReason ? `: ${link.suspensionReason}` : "."}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="classificacao">
        <TabsList className="flex-wrap">
          <TabsTrigger value="classificacao">Classificação</TabsTrigger>
          <TabsTrigger value="recebimento">Condições de recebimento</TabsTrigger>
          <TabsTrigger value="credito">Crédito</TabsTrigger>
          <TabsTrigger value="cobranca">Regras de cobrança</TabsTrigger>
          <TabsTrigger value="contratos">Contratos e recorrências</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="classificacao">
          <ClassificationTab linkId={link.id} companyId={link.companyId} />
        </TabsContent>
        <TabsContent value="recebimento">
          <PaymentTermsTab linkId={link.id} />
        </TabsContent>
        <TabsContent value="credito">
          <CreditTab linkId={link.id} companyId={link.companyId} />
        </TabsContent>
        <TabsContent value="cobranca">
          <BillingRulesTab linkId={link.id} />
        </TabsContent>
        <TabsContent value="contratos">
          <ContractsRecurringTab linkId={link.id} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoryTab linkId={link.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
