export type AccountsPayableStatus =
  | "OPEN"
  | "SCHEDULED"
  | "BANK_SCHEDULED"
  | "AWAITING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "RENEGOTIATED"
  | "CANCELLED"
  | "REVERSED";

/**
 * Situação exibida — as onze da seção 4 do prompt.
 *
 * `OVERDUE` e `BLOCKED` não existem como coluna no banco: chegam calculadas pelo back-end.
 * Vencido é uma data que passou, e bloqueado convive com a etapa de pagamento em que o
 * título está.
 */
export type PayableSituation = AccountsPayableStatus | "OVERDUE" | "BLOCKED";

export type AccountsPayableInstallmentStatus =
  | "OPEN"
  | "SCHEDULED"
  | "BANK_SCHEDULED"
  | "AWAITING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "RENEGOTIATED"
  | "CANCELLED"
  | "REVERSED";

export type AccountsPayablePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type AdjustmentType = "INTEREST" | "PENALTY" | "DISCOUNT" | "CORRECTION";

export type AdjustmentSource = "AUTOMATIC" | "MANUAL" | "RENEGOTIATION";

export type EntryStatus = "ACTIVE" | "REVERSED";

export type BlockReason =
  | "DOCUMENT_PENDING"
  | "FINANCIAL_DIVERGENCE"
  | "CONTRACT_BLOCK"
  | "MANAGEMENT_DECISION"
  | "AUDIT"
  | "OTHER";

export type AdvanceType = "SUPPLIER" | "CONTRACT" | "EXPENSE";

export type AdvanceStatus =
  | "OPEN"
  | "PARTIALLY_APPLIED"
  | "APPLIED"
  | "CANCELLED";

export type HistoryAction =
  | "CREATED"
  | "UPDATED"
  | "RENEGOTIATED"
  | "PARTIAL_PAYMENT"
  | "PAID"
  | "CANCELLED"
  | "REOPENED"
  | "REVERSED"
  | "DUE_DATE_CHANGED"
  | "AMOUNT_CHANGED"
  | "SUPPLIER_CHANGED"
  | "COST_CENTER_CHANGED"
  | "PROJECT_CHANGED"
  | "WITHHOLDING_CHANGED"
  | "INSTALLMENT_CHANGED"
  | "BLOCKED"
  | "UNBLOCKED"
  | "SCHEDULED"
  | "ADVANCE_APPLIED"
  | "ADJUSTMENT_ADDED"
  | "DELETED";

export type WithholdingStatus = "SUGGESTED" | "CONFIRMED" | "DISMISSED";

export type TaxType = "INSS" | "IRRF" | "ISS" | "PIS" | "COFINS" | "CSLL" | "OTHER";

// ── Rótulos ──────────────────────────────────────────────────────────────────

export const SITUATION_LABELS: Record<PayableSituation, string> = {
  OPEN: "Em aberto",
  SCHEDULED: "Programado",
  BANK_SCHEDULED: "Agendado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PARTIALLY_PAID: "Pago parcialmente",
  PAID: "Pago",
  OVERDUE: "Vencido",
  RENEGOTIATED: "Renegociado",
  CANCELLED: "Cancelado",
  REVERSED: "Estornado",
  BLOCKED: "Bloqueado",
};

export const SITUATION_TONES: Record<
  PayableSituation,
  "default" | "secondary" | "destructive" | "outline"
> = {
  OPEN: "outline",
  SCHEDULED: "secondary",
  BANK_SCHEDULED: "secondary",
  AWAITING_PAYMENT: "secondary",
  PARTIALLY_PAID: "secondary",
  PAID: "default",
  OVERDUE: "destructive",
  RENEGOTIATED: "outline",
  CANCELLED: "outline",
  REVERSED: "outline",
  BLOCKED: "destructive",
};

/** O que cada situação significa, para a tela não obrigar ninguém a adivinhar. */
export const SITUATION_HINTS: Record<PayableSituation, string> = {
  OPEN: "A obrigação existe e ninguém programou o pagamento.",
  SCHEDULED: "Data, conta e forma definidas dentro do Pulse. Nada foi enviado ao banco.",
  BANK_SCHEDULED: "Aceito pelo banco. Escrito pelo Agendamento Bancário.",
  AWAITING_PAYMENT: "Remessa enviada, sem retorno do banco.",
  PARTIALLY_PAID: "Houve baixa e sobrou saldo.",
  PAID: "Saldo zerado.",
  OVERDUE: "O vencimento passou e ainda há saldo.",
  RENEGOTIATED: "Substituído por um novo cronograma. O anterior continua no histórico.",
  CANCELLED: "Cancelado com motivo. O registro permanece.",
  REVERSED: "Os pagamentos foram desfeitos e o título voltou a dever.",
  BLOCKED: "Não segue para pagamento enquanto o bloqueio não for liberado.",
};

export const PRIORITY_LABELS: Record<AccountsPayablePriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  INTEREST: "Juros",
  PENALTY: "Multa",
  DISCOUNT: "Desconto",
  CORRECTION: "Correção",
};

export const ADJUSTMENT_SOURCE_LABELS: Record<AdjustmentSource, string> = {
  AUTOMATIC: "Automático",
  MANUAL: "Manual",
  RENEGOTIATION: "Renegociação",
};

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  DOCUMENT_PENDING: "Pendência documental",
  FINANCIAL_DIVERGENCE: "Divergência financeira",
  CONTRACT_BLOCK: "Bloqueio contratual",
  MANAGEMENT_DECISION: "Decisão gerencial",
  AUDIT: "Auditoria",
  OTHER: "Outro",
};

export const ADVANCE_TYPE_LABELS: Record<AdvanceType, string> = {
  SUPPLIER: "Adiantamento a fornecedor",
  CONTRACT: "Adiantamento contratual",
  EXPENSE: "Adiantamento de despesas",
};

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
  OPEN: "Em aberto",
  PARTIALLY_APPLIED: "Parcialmente abatido",
  APPLIED: "Totalmente abatido",
  CANCELLED: "Cancelado",
};

export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  CREATED: "Criação",
  UPDATED: "Alteração",
  RENEGOTIATED: "Renegociação",
  PARTIAL_PAYMENT: "Pagamento parcial",
  PAID: "Pagamento total",
  CANCELLED: "Cancelamento",
  REOPENED: "Reabertura",
  REVERSED: "Estorno",
  DUE_DATE_CHANGED: "Alteração de vencimento",
  AMOUNT_CHANGED: "Alteração de valor",
  SUPPLIER_CHANGED: "Alteração de fornecedor",
  COST_CENTER_CHANGED: "Alteração de centro de custo",
  PROJECT_CHANGED: "Alteração de projeto",
  WITHHOLDING_CHANGED: "Alteração de retenção",
  INSTALLMENT_CHANGED: "Alteração de parcelas",
  BLOCKED: "Bloqueio",
  UNBLOCKED: "Liberação de bloqueio",
  SCHEDULED: "Programação de pagamento",
  ADVANCE_APPLIED: "Abatimento de adiantamento",
  ADJUSTMENT_ADDED: "Ajuste",
  DELETED: "Exclusão",
};

export const TAX_LABELS: Record<TaxType, string> = {
  INSS: "INSS",
  IRRF: "IRRF",
  ISS: "ISS",
  PIS: "PIS",
  COFINS: "COFINS",
  CSLL: "CSLL",
  OTHER: "Outras retenções",
};

/** Situações que o Contas a Pagar não escreve — quem escreve é o Agendamento Bancário. */
export const BANK_STAGE_SITUATIONS: PayableSituation[] = [
  "BANK_SCHEDULED",
  "AWAITING_PAYMENT",
];

// ── Registros ────────────────────────────────────────────────────────────────

interface NamedRecord {
  id: string;
  legalName: string;
  tradeName: string | null;
}

export interface PayableInstallment {
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  originalDueDate: string;
  originalAmount: string;
  interestAmount: string;
  penaltyAmount: string;
  discountAmount: string;
  withholdingAmount: string;
  netAmount: string;
  paidAmount: string;
  advanceAmount: string;
  balanceAmount: string;
  status: AccountsPayableInstallmentStatus;
  scheduledPaymentDate: string | null;
  financialAccountId: string | null;
  paymentMethodId: string | null;
  barcode: string | null;
  digitableLine: string | null;
  paidAt: string | null;
  notes: string | null;
}

export interface PayableAllocation {
  id: string;
  targetType: string;
  costCenterId: string | null;
  resultCenterId: string | null;
  projectId: string | null;
  businessUnitId: string | null;
  categoryId: string | null;
  accountPlanId: string | null;
  percentage: string;
  amount: string;
  sortOrder: number;
  notes: string | null;
}

export interface PayableWithholding {
  id: string;
  taxType: TaxType;
  calculationBase: string;
  rate: string;
  amount: string;
  minimumAmount: string | null;
  status: WithholdingStatus;
  decisionReason: string | null;
  decidedAt: string | null;
}

export interface PayableBlock {
  id: string;
  reason: BlockReason;
  description: string | null;
  blockedBy: string | null;
  blockedAt: string;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
}

export interface PayablePayment {
  id: string;
  installmentId: string | null;
  amount: string;
  interestAmount: string;
  penaltyAmount: string;
  discountAmount: string;
  settledAmount: string;
  paidAt: string;
  financialAccountId: string | null;
  paymentMethodId: string | null;
  receiptNumber: string | null;
  notes: string | null;
  status: EntryStatus;
  reversalReason: string | null;
  reversedAt: string | null;
}

export interface PayableAdjustment {
  id: string;
  installmentId: string | null;
  type: AdjustmentType;
  source: AdjustmentSource;
  amount: string;
  calculationBase: string | null;
  rate: string | null;
  overdueDays: number | null;
  reason: string | null;
  status: EntryStatus;
  reversalReason: string | null;
  appliedAt: string;
}

export interface PayableRenegotiation {
  id: string;
  reason: string;
  previousSchedule: {
    installmentNumber: number;
    dueDate: string;
    originalAmount: number;
    netAmount: number;
    paidAmount: number;
    balanceAmount: number;
    status: string;
  }[];
  previousNetAmount: string;
  newNetAmount: string;
  interestAdded: string;
  penaltyAdded: string;
  discountGranted: string;
  effectiveAt: string;
  createdAt: string;
}

export interface PayableAdvanceApplication {
  id: string;
  advanceId: string;
  installmentId: string | null;
  amount: string;
  notes: string | null;
  status: EntryStatus;
  appliedAt: string;
  advance: {
    id: string;
    reference: string | null;
    amount: string;
    type: AdvanceType;
  };
}

export interface PayableHistoryEntry {
  id: string;
  installmentId: string | null;
  action: HistoryAction;
  previousStatus: AccountsPayableStatus | null;
  newStatus: AccountsPayableStatus | null;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  justification: string | null;
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PayableComment {
  id: string;
  authorId: string;
  body: string;
  attachments: { path: string; fileName: string }[] | null;
  createdAt: string;
}

export interface PayableTag {
  id: string;
  financialTagId: string | null;
  label: string;
}

/** Linha da tela principal (seção 5). */
export interface AccountsPayableListItem {
  id: string;
  code: string;
  companyId: string;
  supplierId: string | null;
  documentType: string | null;
  documentNumber: string | null;
  documentSeries: string | null;
  issueDate: string | null;
  competenceDate: string | null;
  dueDate: string;
  description: string | null;
  status: AccountsPayableStatus;
  situation: PayableSituation;
  isOverdue: boolean;
  priority: AccountsPayablePriority;
  originalAmount: string;
  netAmount: string;
  paidAmount: string;
  balanceAmount: string;
  categoryId: string | null;
  costCenterId: string | null;
  projectId: string | null;
  financialAccountId: string | null;
  paymentMethodId: string | null;
  responsibleUserId: string | null;
  blockedAt: string | null;
  scheduledPaymentDate: string | null;
  updatedAt: string;
  company: NamedRecord | null;
  supplier: NamedRecord | null;
  tags: PayableTag[];
}

export interface AccountsPayableDetail extends AccountsPayableListItem {
  entryId: string | null;
  sourceIntakeDocumentId: string | null;
  approvalRequestId: string | null;
  supplierContractId: string | null;
  purchaseOrderNumber: string | null;
  accessKey: string | null;
  notes: string | null;
  barcode: string | null;
  digitableLine: string | null;
  pixKey: string | null;
  interestAmount: string;
  penaltyAmount: string;
  discountAmount: string;
  withholdingAmount: string;
  advanceAmount: string;
  currencyCode: string;
  subcategoryId: string | null;
  accountPlanId: string | null;
  financialNatureId: string | null;
  resultCenterId: string | null;
  businessUnitId: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  reopenedAt: string | null;
  paidAt: string | null;
  renegotiatedAt: string | null;
  overdueDays: number;
  activeBlock: PayableBlock | null;
  installments: PayableInstallment[];
  allocations: PayableAllocation[];
  withholdings: PayableWithholding[];
  blocks: PayableBlock[];
  payments: PayablePayment[];
  adjustments: PayableAdjustment[];
  advances: PayableAdvanceApplication[];
  renegotiations: PayableRenegotiation[];
  entry: { id: string; status: string; sourceIntakeDocumentId: string | null } | null;
  sourceIntakeDocument: {
    id: string;
    originalFileName: string;
    displayName: string | null;
  } | null;
  supplierContract: { id: string; contractNumber: string | null } | null;
}

export interface SupplierAdvance {
  id: string;
  companyId: string;
  supplierId: string;
  supplierContractId: string | null;
  type: AdvanceType;
  status: AdvanceStatus;
  amount: string;
  appliedAmount: string;
  remainingAmount: string;
  reference: string | null;
  grantedAt: string;
  notes: string | null;
  supplier: NamedRecord | null;
  applications: {
    id: string;
    amount: string;
    appliedAt: string;
    payable: { id: string; code: string };
  }[];
}

export interface LateChargePreview {
  referenceDate: string;
  monthlyRate: number;
  penaltyRate: number;
  gracePeriodDays: number;
  lines: {
    installmentId: string;
    installmentNumber: number;
    overdueDays: number;
    interest: number;
    penalty: number;
  }[];
  totalInterest: number;
  totalPenalty: number;
}

export interface DashboardGroup {
  key: string | null;
  label: string;
  total: number;
  count: number;
}

/** Os dezenove indicadores da seção 3. */
export interface AccountsPayableDashboard {
  generatedAt: string;
  openCount: number;
  openTotal: number;
  overdueTotal: number;
  dueTodayTotal: number;
  dueThisWeekTotal: number;
  dueThisMonthTotal: number;
  scheduledTotal: number;
  blockedTotal: number;
  urgentTotal: number;
  forecastInterest: number;
  forecastPenalty: number;
  forecastDiscount: number;
  byCompany: DashboardGroup[];
  bySupplier: DashboardGroup[];
  byCategory: DashboardGroup[];
  byCostCenter: DashboardGroup[];
  byProject: DashboardGroup[];
  byPaymentMethod: DashboardGroup[];
  byFinancialAccount: DashboardGroup[];
}

export interface AccountsPayableSettings {
  id: string;
  companyId: string;
  autoGenerateOnApproval: boolean;
  codePrefix: string;
  defaultMonthlyInterestRate: string | null;
  defaultPenaltyRate: string | null;
  gracePeriodDays: number;
  allowPartialPayment: boolean;
  requireJustificationOnDueDateChange: boolean;
  requireJustificationOnAmountChange: boolean;
  autoBlockWhenDocumentPending: boolean;
  reopenWindowDays: number | null;
  defaultPriority: AccountsPayablePriority;
}

/** Nome legível do fornecedor ou da empresa, com o cadastro incompleto em mente. */
export function displayNameOf(record: NamedRecord | null): string {
  if (!record) return "—";
  return record.tradeName ?? record.legalName;
}
