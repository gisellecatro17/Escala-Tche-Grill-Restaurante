"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";

import {
  useIntakeDocument,
  useIntakeDocumentActions,
  useIntakeIssues,
  useValidateBoleto,
} from "@/lib/api/document-intake";
import { useCompanies } from "@/lib/api/companies";
import { useCustomers } from "@/lib/api/customers";
import { useSuppliers } from "@/lib/api/suppliers";
import { useCategories, useCostCenters } from "@/lib/api/taxonomy";
import {
  useAccountPlans,
  useBusinessUnits,
  useFinancialNatures,
  useProjects,
  useResultCenters,
} from "@/lib/api/financial-structure";
import {
  useFinancialAccounts,
  usePaymentMethods,
  useReceiptMethods,
} from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/treasury/field";
import { DocumentViewer } from "@/components/document-intake/document-viewer";
import {
  DOCUMENT_DIRECTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  EXTRACTION_METHOD_LABELS,
  PRIORITY_LABELS,
  REJECTION_REASON_LABELS,
  SOURCE_CHANNEL_LABELS,
  confidenceBand,
} from "@/types/document-intake";
import type {
  BoletoValidationResult,
  IntakeDocument,
  IntakeDocumentDirection,
  IntakeDocumentType,
  IntakePriority,
  IntakeRejectionReason,
} from "@/types/document-intake";

/** Valor do `SelectItem` que representa "nenhum" — Radix não aceita string vazia. */
const NONE = "__none__";

/** Campos que o revisor pode alterar (seção 37). */
interface ReviewDraft {
  documentType: IntakeDocumentType;
  documentDirection: IntakeDocumentDirection;
  priority: IntakePriority;
  supplierId: string | null;
  customerId: string | null;
  documentNumber: string | null;
  documentSeries: string | null;
  accessKey: string | null;
  issueDate: string | null;
  competenceDate: string | null;
  dueDate: string | null;
  grossAmount: string;
  discountAmount: string;
  interestAmount: string;
  penaltyAmount: string;
  withholdingAmount: string;
  netAmount: string;
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  accountPlanId: string | null;
  costCenterId: string | null;
  resultCenterId: string | null;
  projectId: string | null;
  businessUnitId: string | null;
  financialNatureId: string | null;
  financialAccountId: string | null;
  paymentMethodId: string | null;
  receiptMethodId: string | null;
}

/**
 * Tela de revisão do documento (seções 36 e 37).
 *
 * O que o usuário edita aqui **não** vira obrigação financeira: a revisão só arruma os dados
 * e libera o encaminhamento. Quem cria o título é o módulo de processamento, depois.
 *
 * As alterações ficam em um rascunho local sobreposto ao documento vindo do servidor, no
 * mesmo desenho usado nos parâmetros da tesouraria: nada é copiado para estado em efeito,
 * então uma revalidação do documento não descarta o que o usuário digitou nem o sobrescreve.
 */
export default function ReviewDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const { data: document, isLoading } = useIntakeDocument(id);
  const { data: issues } = useIntakeIssues(id);
  const actions = useIntakeDocumentActions();
  const boleto = useValidateBoleto();

  const [edits, setEdits] = React.useState<Partial<ReviewDraft>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [confirmSupplier, setConfirmSupplier] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectionReason, setRejectionReason] =
    React.useState<IntakeRejectionReason>("INVALID_DOCUMENT");
  const [rejectionNotes, setRejectionNotes] = React.useState("");

  const canReview = hasPermission("document_intake.review");
  const canForward = hasPermission("document_intake.forward");
  const canReject = hasPermission("document_intake.reject");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Documento não encontrado</AlertTitle>
          <AlertDescription>
            Ele pode ter sido excluído ou pertencer a uma empresa à qual você não tem acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const draft = { ...toDraft(document), ...edits };
  const blocking = (issues ?? []).filter(
    (issue) => issue.severity === "BLOCKING" && issue.status !== "RESOLVED" && issue.status !== "DISMISSED",
  );
  const dirty = Object.keys(edits).length > 0;
  const saving =
    actions.update.isPending || actions.review.isPending || actions.forward.isPending;

  function set<Key extends keyof ReviewDraft>(key: Key, value: ReviewDraft[Key]) {
    setEdits((current) => ({ ...current, [key]: value }));
  }

  /** Só vai para a API o que mudou: campos intocados não são reenviados. */
  function payloadOf(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const key of Object.keys(edits) as (keyof ReviewDraft)[]) {
      const value = draft[key];

      if (AMOUNT_FIELDS.includes(key)) {
        const parsed = Number(String(value).replace(",", "."));
        if (!Number.isNaN(parsed)) payload[key] = parsed;
        continue;
      }

      payload[key] = value === "" ? null : value;
    }

    return payload;
  }

  async function run(work: () => Promise<unknown>, redirect?: string) {
    setError(null);
    try {
      await work();
      setEdits({});
      if (redirect) router.push(redirect);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a ação.");
    }
  }

  async function save() {
    if (!dirty) return;
    await actions.update.mutateAsync({ id: document!.id, payload: payloadOf() });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao documento">
          <Link href={`/financeiro/entrada-documentos/${document.id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">
            Revisar documento
            {document.documentNumber ? ` nº ${document.documentNumber}` : ""}
          </h1>
          <p className="text-xs text-muted-foreground">
            Recebido em {formatDateTimeBR(document.receivedAt)} ·{" "}
            {SOURCE_CHANNEL_LABELS[document.sourceChannel]}
          </p>
        </div>
      </div>

      {!canReview && (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Somente leitura</AlertTitle>
          <AlertDescription>
            Seu perfil não tem a permissão de revisão. Os campos ficam visíveis, mas não podem
            ser alterados.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Ação não concluída</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {blocking.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {blocking.length === 1
              ? "Há uma pendência bloqueante"
              : `Há ${blocking.length} pendências bloqueantes`}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {blocking.map((issue) => (
                <li key={issue.id}>{issue.description}</li>
              ))}
            </ul>
            Enquanto existirem, o documento não pode ser encaminhado para processamento.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          <DocumentViewer documentId={document.id} document={document} />
        </div>

        <div className="flex flex-col gap-4">
          {/* 1 — Origem e leitura */}
          <Section title="Origem e leitura">
            <ReadOnly label="Canal" value={SOURCE_CHANNEL_LABELS[document.sourceChannel]} />
            <ReadOnly label="Arquivo" value={document.originalFileName} />
            <ReadOnly
              label="Método de leitura"
              value={
                document.extractionMethod
                  ? EXTRACTION_METHOD_LABELS[document.extractionMethod]
                  : "Não lido"
              }
            />
            <ReadOnly
              label="Confiança da extração"
              value={
                document.confidence === null
                  ? "—"
                  : `${Math.round(Number(document.confidence))}% · ${confidenceBand(document.confidence) === "HIGH" ? "alta" : confidenceBand(document.confidence) === "MEDIUM" ? "média" : "baixa"}`
              }
            />
          </Section>

          {/* 2 — Empresa de destino */}
          <CompanySection document={document} organizationId={organizationId} />

          {/* 3 — Tipo e prioridade */}
          <Section title="Tipo do documento">
            <Field label="Tipo">
              <Select
                value={draft.documentType}
                disabled={!canReview}
                onValueChange={(value) => set("documentType", value as IntakeDocumentType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Direção"
              hint="Define se o documento vira uma obrigação a pagar ou a receber no processamento."
            >
              <Select
                value={draft.documentDirection}
                disabled={!canReview}
                onValueChange={(value) =>
                  set("documentDirection", value as IntakeDocumentDirection)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_DIRECTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Prioridade">
              <Select
                value={draft.priority}
                disabled={!canReview}
                onValueChange={(value) => set("priority", value as IntakePriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          {/* 4 — Fornecedor e cliente */}
          <PartiesSection
            document={document}
            draft={draft}
            disabled={!canReview}
            onChange={set}
            confirmSupplier={confirmSupplier}
            onConfirmSupplierChange={setConfirmSupplier}
          />

          {/* 5 — Identificação */}
          <Section title="Identificação">
            <Field label="Número">
              <Input
                value={draft.documentNumber ?? ""}
                disabled={!canReview}
                onChange={(event) => set("documentNumber", event.target.value)}
              />
            </Field>
            <Field label="Série">
              <Input
                value={draft.documentSeries ?? ""}
                disabled={!canReview}
                onChange={(event) => set("documentSeries", event.target.value)}
              />
            </Field>
            <Field label="Chave de acesso" hint="44 dígitos, para NF-e e CT-e.">
              <Input
                value={draft.accessKey ?? ""}
                disabled={!canReview}
                onChange={(event) => set("accessKey", event.target.value)}
              />
            </Field>
          </Section>

          {/* 6 — Datas */}
          <Section title="Datas">
            <Field label="Emissão">
              <Input
                type="date"
                value={toInputDate(draft.issueDate)}
                disabled={!canReview}
                onChange={(event) => set("issueDate", event.target.value || null)}
              />
            </Field>
            <Field label="Competência">
              <Input
                type="date"
                value={toInputDate(draft.competenceDate)}
                disabled={!canReview}
                onChange={(event) => set("competenceDate", event.target.value || null)}
              />
            </Field>
            <Field label="Vencimento">
              <Input
                type="date"
                value={toInputDate(draft.dueDate)}
                disabled={!canReview}
                onChange={(event) => set("dueDate", event.target.value || null)}
              />
            </Field>
          </Section>

          {/* 7 — Valores */}
          <AmountsSection draft={draft} disabled={!canReview} onChange={set} />

          {/* 8 — Cobrança */}
          <ChargeSection
            document={document}
            disabled={!canReview}
            validation={boleto.data ?? null}
            validating={boleto.isPending}
            onValidate={(code) => boleto.mutate(code)}
          />

          {/* 9 — Classificação financeira */}
          <ClassificationSection
            draft={draft}
            document={document}
            organizationId={organizationId}
            disabled={!canReview}
            onChange={set}
          />

          {/* 10 — Observações */}
          <Section title="Observações">
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <Input
                  value={draft.description ?? ""}
                  disabled={!canReview}
                  onChange={(event) => set("description", event.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Anotações da revisão"
                hint="Fica registrado no histórico do documento."
              >
                <Textarea
                  rows={3}
                  value={draft.notes ?? ""}
                  disabled={!canReview}
                  onChange={(event) => set("notes", event.target.value)}
                />
              </Field>
            </div>
          </Section>

          {rejecting && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rejeitar documento</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  O documento rejeitado mantém o histórico e o arquivo, não segue para
                  processamento e pode ser reaberto por quem tiver permissão.
                </p>
                <Field label="Motivo" required>
                  <Select
                    value={rejectionReason}
                    onValueChange={(value) =>
                      setRejectionReason(value as IntakeRejectionReason)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REJECTION_REASON_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Detalhamento">
                  <Textarea
                    rows={3}
                    value={rejectionNotes}
                    onChange={(event) => setRejectionNotes(event.target.value)}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    disabled={actions.reject.isPending}
                    onClick={() =>
                      void run(
                        () =>
                          actions.reject.mutateAsync({
                            id: document.id,
                            rejectionReason,
                            notes: rejectionNotes || undefined,
                          }),
                        `/financeiro/entrada-documentos/${document.id}`,
                      )
                    }
                  >
                    {actions.reject.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Ban className="size-4" />
                    )}
                    Confirmar rejeição
                  </Button>
                  <Button variant="outline" onClick={() => setRejecting(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Os quatro comandos da revisão (seção 36). */}
          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background/95 py-3 backdrop-blur">
            <Button disabled={!canReview || !dirty || saving} onClick={() => void run(save)}>
              {actions.update.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar alterações
            </Button>

            <Button
              variant="outline"
              disabled={!canReview || saving}
              onClick={() =>
                void run(async () => {
                  await save();
                  await actions.review.mutateAsync({
                    id: document.id,
                    payload: {
                      reviewStatus: "REVIEWED",
                      notes: draft.notes ?? undefined,
                      confirmSupplierRecognition: confirmSupplier,
                    },
                  });
                })
              }
            >
              {actions.review.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Concluir revisão
            </Button>

            <Button
              variant="outline"
              disabled={
                !canForward || saving || blocking.length > 0 || !document.companyId
              }
              title={
                blocking.length > 0
                  ? "Resolva as pendências bloqueantes antes de encaminhar."
                  : !document.companyId
                    ? "Defina a empresa de destino antes de encaminhar."
                    : undefined
              }
              onClick={() =>
                void run(
                  async () => {
                    await save();
                    await actions.forward.mutateAsync({
                      id: document.id,
                      notes: draft.notes ?? undefined,
                    });
                  },
                  `/financeiro/entrada-documentos/${document.id}`,
                )
              }
            >
              {actions.forward.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Encaminhar para processamento
            </Button>

            {canReject && (
              <Button variant="ghost" onClick={() => setRejecting(true)}>
                <Ban className="size-4" />
                Rejeitar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Blocos da revisão ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm">{value ?? "—"}</span>
    </div>
  );
}

/**
 * Empresa de destino (seções 3 e 36).
 *
 * Trocar a empresa não é uma edição comum: é uma mudança de escopo, exige motivo e passa por
 * um endpoint próprio que verifica a permissão nas duas empresas — a de origem e a de destino.
 */
function CompanySection({
  document,
  organizationId,
}: {
  document: IntakeDocument;
  organizationId: string | undefined;
}) {
  const { hasPermission } = useSession();
  const actions = useIntakeDocumentActions();
  const { data: companies } = useCompanies({ organizationId, perPage: 100 });

  const [companyId, setCompanyId] = React.useState<string>(document.companyId ?? "");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const canChange = hasPermission("document_intake.change_company");
  const changed = companyId !== "" && companyId !== document.companyId;

  return (
    <Card className={document.companyId ? undefined : "border-destructive/50"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Empresa de destino
          {document.companyConfidence !== null && (
            <Badge variant="secondary">
              identificação {Math.round(Number(document.companyConfidence))}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field
          label="Empresa"
          required
          hint="Só aparecem as empresas às quais o seu usuário tem acesso."
        >
          <Select
            value={companyId || NONE}
            disabled={!canChange}
            onValueChange={(value) => setCompanyId(value === NONE ? "" : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Não identificada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Não identificada</SelectItem>
              {(companies?.items ?? []).map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.tradeName ?? company.legalName ?? company.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {changed && (
          <>
            <Field label="Motivo da mudança de empresa" required>
              <Input
                value={reason}
                placeholder="Ex.: o documento pertence à filial informada no CNPJ do destinatário."
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <div>
              <Button
                disabled={reason.trim().length === 0 || actions.changeCompany.isPending}
                onClick={() => {
                  setError(null);
                  actions.changeCompany.mutate(
                    { id: document.id, companyId, reason: reason.trim() },
                    {
                      onSuccess: () => setReason(""),
                      onError: (caught: unknown) =>
                        setError(
                          caught instanceof Error
                            ? caught.message
                            : "Não foi possível alterar a empresa.",
                        ),
                    },
                  );
                }}
              >
                {actions.changeCompany.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Confirmar mudança de empresa
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PartiesSection({
  document,
  draft,
  disabled,
  onChange,
  confirmSupplier,
  onConfirmSupplierChange,
}: {
  document: IntakeDocument;
  draft: ReviewDraft;
  disabled: boolean;
  onChange: <Key extends keyof ReviewDraft>(key: Key, value: ReviewDraft[Key]) => void;
  confirmSupplier: boolean;
  onConfirmSupplierChange: (value: boolean) => void;
}) {
  const companyId = document.companyId ?? undefined;
  const { data: suppliers } = useSuppliers({ companyId, perPage: 100 });
  const { data: customers } = useCustomers({ companyId, perPage: 100 });

  return (
    <Section title="Fornecedor e cliente">
      <ReadOnly label="Emitente no documento" value={document.issuerName} />
      <ReadOnly label="CNPJ/CPF do emitente" value={document.issuerDocument} />
      <ReadOnly label="Destinatário no documento" value={document.recipientName} />
      <ReadOnly label="CNPJ/CPF do destinatário" value={document.recipientDocument} />

      <Field
        label="Fornecedor"
        hint={
          document.supplierConfidence === null
            ? undefined
            : `Identificado com ${Math.round(Number(document.supplierConfidence))}% de confiança.`
        }
      >
        <Select
          value={draft.supplierId ?? NONE}
          disabled={disabled || !companyId}
          onValueChange={(value) => onChange("supplierId", value === NONE ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhum</SelectItem>
            {(suppliers?.items ?? []).map((link) => (
              <SelectItem key={link.supplierId} value={link.supplierId}>
                {link.supplier.tradeName ?? link.supplier.legalName ?? link.supplierId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Cliente">
        <Select
          value={draft.customerId ?? NONE}
          disabled={disabled || !companyId}
          onValueChange={(value) => onChange("customerId", value === NONE ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhum</SelectItem>
            {(customers?.items ?? []).map((link) => (
              <SelectItem key={link.customerId} value={link.customerId}>
                {link.customer.tradeName ?? link.customer.legalName ?? link.customerId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="sm:col-span-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmSupplier}
            disabled={disabled || !draft.supplierId}
            onChange={(event) => onConfirmSupplierChange(event.target.checked)}
          />
          <span>
            Confirmar o fornecedor ao concluir a revisão.
            <span className="block text-xs text-muted-foreground">
              O sistema passa a reconhecer este emitente automaticamente nos próximos
              documentos com o mesmo texto. Nada é aprendido sem esta confirmação.
            </span>
          </span>
        </label>
      </div>
    </Section>
  );
}

const AMOUNT_FIELDS: (keyof ReviewDraft)[] = [
  "grossAmount",
  "discountAmount",
  "interestAmount",
  "penaltyAmount",
  "withholdingAmount",
  "netAmount",
];

function AmountsSection({
  draft,
  disabled,
  onChange,
}: {
  draft: ReviewDraft;
  disabled: boolean;
  onChange: <Key extends keyof ReviewDraft>(key: Key, value: ReviewDraft[Key]) => void;
}) {
  const gross = Number(draft.grossAmount || 0);
  const discount = Number(draft.discountAmount || 0);
  const interest = Number(draft.interestAmount || 0);
  const penalty = Number(draft.penaltyAmount || 0);
  const withholding = Number(draft.withholdingAmount || 0);
  const net = Number(draft.netAmount || 0);

  const expected = gross - discount + interest + penalty - withholding;
  // Um centavo de folga: o arredondamento do documento e o da conta raramente batem exato.
  const diverges = Math.abs(expected - net) > 0.01;

  const labels: [keyof ReviewDraft, string][] = [
    ["grossAmount", "Valor bruto"],
    ["discountAmount", "Desconto"],
    ["interestAmount", "Juros"],
    ["penaltyAmount", "Multa"],
    ["withholdingAmount", "Retenções"],
    ["netAmount", "Valor líquido"],
  ];

  return (
    <Section title="Valores">
      {labels.map(([key, label]) => (
        <Field key={key} label={label}>
          <Input
            inputMode="decimal"
            value={String(draft[key] ?? "")}
            disabled={disabled}
            onChange={(event) => onChange(key, event.target.value as ReviewDraft[typeof key])}
          />
        </Field>
      ))}

      {diverges && (
        <div className="sm:col-span-2">
          <Alert>
            <AlertTriangle />
            <AlertTitle>Os valores não fecham</AlertTitle>
            <AlertDescription>
              Bruto − desconto + juros + multa − retenções resulta em{" "}
              {expected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, mas o líquido
              informado é {net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Confira
              antes de encaminhar.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </Section>
  );
}

/**
 * Dados de cobrança (seções 22, 23 e 81).
 *
 * Linha digitável, código de barras e chave PIX chegam mascarados quando o usuário não tem
 * `document_intake.view_sensitive_data` — o mascaramento é feito no back-end, então o valor
 * completo nem trafega. Por isso estes campos não são editáveis aqui: alterá-los mudaria a
 * cobrança, e a validação bancária é do servidor, não da tela.
 */
function ChargeSection({
  document,
  disabled,
  validation,
  validating,
  onValidate,
}: {
  document: IntakeDocument;
  disabled: boolean;
  validation: BoletoValidationResult | null;
  validating: boolean;
  onValidate: (code: string) => void;
}) {
  const [code, setCode] = React.useState("");
  const masked = (document.digitableLine ?? "").includes("*");

  return (
    <Section title="Cobrança">
      <ReadOnly label="Linha digitável" value={document.digitableLine} />
      <ReadOnly label="Código de barras" value={document.barcode} />
      <ReadOnly label="Chave PIX" value={document.pixKey} />
      <ReadOnly
        label="Duplicidade"
        value={document.duplicateStatus === "NOT_CHECKED" ? "Não verificado" : null}
      />

      <div className="sm:col-span-2 flex flex-col gap-2">
        <Field
          label="Conferir uma linha digitável"
          hint={
            masked
              ? "A linha do documento está mascarada para o seu perfil. Você pode conferir um código digitado manualmente."
              : "A conferência apenas valida os dígitos verificadores e o vencimento — nenhum pagamento é executado."
          }
        >
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              placeholder="Digite ou cole a linha digitável"
              value={code}
              disabled={disabled}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={disabled || code.replace(/\D/g, "").length < 44 || validating}
              onClick={() => onValidate(code)}
            >
              {validating ? <Loader2 className="size-4 animate-spin" /> : null}
              Conferir
            </Button>
          </div>
        </Field>

        {validation && (
          <Alert variant={validation.valid ? "default" : "destructive"}>
            <AlertTitle>
              {validation.valid ? "Código válido" : "Código inválido"}
              {validation.bankCode ? ` · banco ${validation.bankCode}` : ""}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {validation.amount !== null && (
                  <li>
                    Valor:{" "}
                    {validation.amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </li>
                )}
                {validation.dueDate && (
                  <li>
                    Vencimento: {validation.dueDate}
                    {validation.ambiguousDueDate &&
                      ` (ambíguo — também pode ser ${validation.ambiguousCandidates.join(" ou ")})`}
                  </li>
                )}
                {validation.errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {validation.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              {validation.rulesApplied.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Regras aplicadas: {validation.rulesApplied.join(", ")}.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Section>
  );
}

/**
 * Classificação financeira.
 *
 * Todas as listas vêm dos cadastros já existentes — nada é recriado aqui. Elas dependem da
 * empresa: sem empresa definida, não há estrutura financeira para escolher.
 */
function ClassificationSection({
  draft,
  document,
  organizationId,
  disabled,
  onChange,
}: {
  draft: ReviewDraft;
  document: IntakeDocument;
  organizationId: string | undefined;
  disabled: boolean;
  onChange: <Key extends keyof ReviewDraft>(key: Key, value: ReviewDraft[Key]) => void;
}) {
  const companyId = document.companyId ?? undefined;

  const { data: categories } = useCategories(companyId);
  const { data: costCenters } = useCostCenters(companyId);
  const { data: resultCenters } = useResultCenters(companyId);
  const { data: projects } = useProjects(companyId);
  const { data: businessUnits } = useBusinessUnits(organizationId, companyId);
  const { data: natures } = useFinancialNatures(organizationId, companyId);
  const { data: accountPlans } = useAccountPlans(organizationId, companyId);
  const { data: accounts } = useFinancialAccounts({ organizationId, companyId, perPage: 100 });
  const { data: paymentMethods } = usePaymentMethods(organizationId, { companyId });
  const { data: receiptMethods } = useReceiptMethods(organizationId, { companyId });

  // Subcategoria é uma categoria filha: a lista sai da mesma consulta.
  const subcategories = (categories ?? []).filter(
    (category) => category.parentCategoryId === draft.categoryId,
  );

  if (!companyId) {
    return (
      <Section title="Classificação financeira">
        <div className="sm:col-span-2">
          <p className="text-sm text-muted-foreground">
            A classificação depende da empresa de destino. Defina a empresa acima para
            escolher categoria, centro de custo e as demais estruturas.
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Classificação financeira">
      <Picker
        label="Categoria"
        value={draft.categoryId}
        disabled={disabled}
        options={(categories ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => {
          onChange("categoryId", value);
          onChange("subcategoryId", null);
        }}
      />
      <Picker
        label="Subcategoria"
        value={draft.subcategoryId}
        disabled={disabled || !draft.categoryId}
        options={subcategories.map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("subcategoryId", value)}
      />
      <Picker
        label="Plano de contas"
        value={draft.accountPlanId}
        disabled={disabled}
        options={(accountPlans ?? []).map((item) => ({
          id: item.id,
          label: `${item.code} · ${item.name}`,
        }))}
        onChange={(value) => onChange("accountPlanId", value)}
      />
      <Picker
        label="Natureza financeira"
        value={draft.financialNatureId}
        disabled={disabled}
        options={(natures ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("financialNatureId", value)}
      />
      <Picker
        label="Centro de custo"
        value={draft.costCenterId}
        disabled={disabled}
        options={(costCenters ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("costCenterId", value)}
      />
      <Picker
        label="Centro de resultado"
        value={draft.resultCenterId}
        disabled={disabled}
        options={(resultCenters ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("resultCenterId", value)}
      />
      <Picker
        label="Projeto"
        value={draft.projectId}
        disabled={disabled}
        options={(projects?.items ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("projectId", value)}
      />
      <Picker
        label="Unidade de negócio"
        value={draft.businessUnitId}
        disabled={disabled}
        options={(businessUnits ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("businessUnitId", value)}
      />
      <Picker
        label="Conta financeira sugerida"
        value={draft.financialAccountId}
        disabled={disabled}
        options={(accounts?.items ?? []).map((item) => ({
          id: item.id,
          label: item.displayName ?? item.name,
        }))}
        onChange={(value) => onChange("financialAccountId", value)}
      />
      <Picker
        label="Forma de pagamento sugerida"
        value={draft.paymentMethodId}
        disabled={disabled || draft.documentDirection === "RECEIVABLE"}
        options={(paymentMethods ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("paymentMethodId", value)}
      />
      <Picker
        label="Forma de recebimento sugerida"
        value={draft.receiptMethodId}
        disabled={disabled || draft.documentDirection === "PAYABLE"}
        options={(receiptMethods ?? []).map((item) => ({ id: item.id, label: item.name }))}
        onChange={(value) => onChange("receiptMethodId", value)}
      />

      <div className="sm:col-span-2">
        <p className="text-xs text-muted-foreground">
          A sugestão de conta e de forma de pagamento acompanha o documento para a próxima
          etapa. Ela não autoriza, agenda nem executa nenhum pagamento.
        </p>
      </div>
    </Section>
  );
}

function Picker({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { id: string; label: string }[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <Field label={label}>
      <Select
        value={value ?? NONE}
        disabled={disabled}
        onValueChange={(next) => onChange(next === NONE ? null : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Não definido" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Não definido</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// ── Conversões ───────────────────────────────────────────────────────────────

function toDraft(document: IntakeDocument): ReviewDraft {
  return {
    documentType: document.documentType,
    documentDirection: document.documentDirection,
    priority: document.priority,
    supplierId: document.supplierId,
    customerId: document.customerId,
    documentNumber: document.documentNumber,
    documentSeries: document.documentSeries,
    accessKey: document.accessKey,
    issueDate: document.issueDate,
    competenceDate: document.competenceDate,
    dueDate: document.dueDate,
    grossAmount: toAmountInput(document.grossAmount),
    discountAmount: toAmountInput(document.discountAmount),
    interestAmount: toAmountInput(document.interestAmount),
    penaltyAmount: toAmountInput(document.penaltyAmount),
    withholdingAmount: toAmountInput(document.withholdingAmount),
    netAmount: toAmountInput(document.netAmount),
    description: document.description,
    notes: document.notes,
    categoryId: document.categoryId,
    subcategoryId: document.subcategoryId,
    accountPlanId: document.accountPlanId,
    costCenterId: document.costCenterId,
    resultCenterId: document.resultCenterId,
    projectId: document.projectId,
    businessUnitId: document.businessUnitId,
    financialNatureId: document.financialNatureId,
    financialAccountId: document.financialAccountId,
    paymentMethodId: document.paymentMethodId,
    receiptMethodId: document.receiptMethodId,
  };
}

function toAmountInput(value: string | number | null): string {
  if (value === null) return "";
  return String(value);
}

/** `<input type="date">` só aceita `yyyy-mm-dd`; a API devolve ISO completo. */
function toInputDate(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}
