export type PaymentScheduleStatus =
  | "PENDING_SCHEDULING"
  | "SCHEDULED"
  | "IN_BATCH"
  | "READY_TO_SEND"
  | "CANCELLED"
  | "SENT"
  | "EXECUTED";

/**
 * As nove situações da seção 4.
 *
 * `RESCHEDULED` e `BLOCKED` não são colunas: chegam calculadas pelo back-end. Bloqueado
 * convive com a etapa da fila, e reprogramado é um fato sobre a história da data.
 */
export type ScheduleSituation =
  | PaymentScheduleStatus
  | "RESCHEDULED"
  | "BLOCKED";

export type PaymentBatchStatus =
  | "OPEN"
  | "READY_TO_SEND"
  | "CANCELLED"
  | "SENT"
  | "EXECUTED";

export type SchedulePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";

export type BankPaymentType =
  | "PIX"
  | "TED"
  | "INTERNAL_TRANSFER"
  | "BOLETO"
  | "DIRECT_DEBIT"
  | "TAX"
  | "PAYROLL"
  | "CORPORATE_CARD";

export type ScheduleBlockReason =
  | "INSUFFICIENT_BALANCE"
  | "ACCOUNT_UNAVAILABLE"
  | "PENDING_DOCUMENT"
  | "MANAGEMENT_DECISION"
  | "SUPPLIER_DATA_MISSING"
  | "AUDIT"
  | "OTHER";

export type ScheduleHistoryAction =
  | "CREATED"
  | "UPDATED"
  | "SCHEDULED"
  | "RESCHEDULED"
  | "BLOCKED"
  | "UNBLOCKED"
  | "CANCELLED"
  | "ACCOUNT_CHANGED"
  | "PRIORITY_CHANGED"
  | "PAYMENT_TYPE_CHANGED"
  | "RESPONSIBLE_CHANGED"
  | "ADDED_TO_BATCH"
  | "REMOVED_FROM_BATCH"
  | "BATCH_CREATED"
  | "BATCH_UPDATED"
  | "BATCH_CANCELLED"
  | "READY_TO_SEND";

// ── Rótulos ──────────────────────────────────────────────────────────────────

export const SITUATION_LABELS: Record<ScheduleSituation, string> = {
  PENDING_SCHEDULING: "Aguardando programação",
  SCHEDULED: "Programado",
  RESCHEDULED: "Reprogramado",
  IN_BATCH: "Em lote",
  READY_TO_SEND: "Pronto para envio",
  BLOCKED: "Bloqueado",
  CANCELLED: "Cancelado",
  SENT: "Enviado",
  EXECUTED: "Executado",
};

export const SITUATION_TONES: Record<
  ScheduleSituation,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_SCHEDULING: "outline",
  SCHEDULED: "secondary",
  RESCHEDULED: "secondary",
  IN_BATCH: "secondary",
  READY_TO_SEND: "default",
  BLOCKED: "destructive",
  CANCELLED: "outline",
  SENT: "default",
  EXECUTED: "default",
};

export const SITUATION_HINTS: Record<ScheduleSituation, string> = {
  PENDING_SCHEDULING: "O título está elegível, mas ninguém definiu a data.",
  SCHEDULED: "Data, conta e forma definidas dentro do Pulse.",
  RESCHEDULED: "Programado, com a data já alterada ao menos uma vez.",
  IN_BATCH: "Dentro de um lote em montagem.",
  READY_TO_SEND: "Lote fechado. É o que a execução bancária vai consumir.",
  BLOCKED: "Não segue para pagamento enquanto o bloqueio não for liberado.",
  CANCELLED: "Programação cancelada. O título continua devido.",
  SENT: "Enviado ao banco — escrito pela execução bancária.",
  EXECUTED: "Confirmado pelo banco — escrito pela execução bancária.",
};

export const BATCH_STATUS_LABELS: Record<PaymentBatchStatus, string> = {
  OPEN: "Em montagem",
  READY_TO_SEND: "Pronto para envio",
  CANCELLED: "Cancelado",
  SENT: "Enviado",
  EXECUTED: "Executado",
};

export const PRIORITY_LABELS: Record<SchedulePriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
  CRITICAL: "Crítica",
};

export const PAYMENT_TYPE_LABELS: Record<BankPaymentType, string> = {
  PIX: "PIX",
  TED: "TED",
  INTERNAL_TRANSFER: "Transferência interna",
  BOLETO: "Boleto",
  DIRECT_DEBIT: "Débito em conta",
  TAX: "Tributos",
  PAYROLL: "Folha de pagamento",
  CORPORATE_CARD: "Cartão corporativo",
};

/** Tipos declarados mas sem tratamento próprio nesta etapa. */
export const FUTURE_PAYMENT_TYPES: BankPaymentType[] = ["CORPORATE_CARD"];

export const BLOCK_REASON_LABELS: Record<ScheduleBlockReason, string> = {
  INSUFFICIENT_BALANCE: "Saldo insuficiente",
  ACCOUNT_UNAVAILABLE: "Conta indisponível",
  PENDING_DOCUMENT: "Pendência documental",
  MANAGEMENT_DECISION: "Decisão gerencial",
  SUPPLIER_DATA_MISSING: "Dados bancários do fornecedor",
  AUDIT: "Auditoria",
  OTHER: "Outro",
};

export const HISTORY_ACTION_LABELS: Record<ScheduleHistoryAction, string> = {
  CREATED: "Criação",
  UPDATED: "Alteração",
  SCHEDULED: "Programação",
  RESCHEDULED: "Reprogramação",
  BLOCKED: "Bloqueio",
  UNBLOCKED: "Liberação",
  CANCELLED: "Cancelamento",
  ACCOUNT_CHANGED: "Alteração de conta",
  PRIORITY_CHANGED: "Alteração de prioridade",
  PAYMENT_TYPE_CHANGED: "Alteração de forma",
  RESPONSIBLE_CHANGED: "Alteração de responsável",
  ADDED_TO_BATCH: "Incluído em lote",
  REMOVED_FROM_BATCH: "Removido do lote",
  BATCH_CREATED: "Lote criado",
  BATCH_UPDATED: "Lote alterado",
  BATCH_CANCELLED: "Lote cancelado",
  READY_TO_SEND: "Lote fechado",
};

// ── Registros ────────────────────────────────────────────────────────────────

interface NamedRecord {
  id: string;
  legalName: string;
  tradeName: string | null;
}

export interface ScheduleItem {
  id: string;
  installmentId: string;
  amount: string;
  sortOrder: number;
  notes: string | null;
}

export interface AccountPosition {
  accountId: string;
  accountName: string;
  status: string;
  openingBalance: number;
  blockedBalance: number;
  creditLimit: number;
  availableBalance: number;
  spendingPower: number;
  committedAmount: number;
  projectedBalance: number;
  minimumRecommendedBalance: number | null;
  unavailable: boolean;
  unavailableReason: string | null;
}

export interface BalanceCheck {
  position: AccountPosition;
  amount: number;
  projectedAfter: number;
  insufficient: boolean;
  shortfall: number;
  belowRecommended: boolean;
  accountUnavailable: boolean;
  accountUnavailableReason: string | null;
}

export interface ScheduleHistoryEntry {
  id: string;
  action: ScheduleHistoryAction;
  previousStatus: PaymentScheduleStatus | null;
  newStatus: PaymentScheduleStatus | null;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  actorId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ScheduleComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface PaymentScheduleListItem {
  id: string;
  code: string;
  companyId: string;
  payableId: string;
  status: PaymentScheduleStatus;
  situation: ScheduleSituation;
  priority: SchedulePriority;
  financialAccountId: string | null;
  paymentMethodId: string | null;
  bankPaymentType: BankPaymentType | null;
  scheduledDate: string | null;
  originalDate: string | null;
  rescheduleCount: number;
  totalAmount: string;
  responsibleUserId: string | null;
  queuePosition: number;
  batchId: string | null;
  blockedAt: string | null;
  blockReason: ScheduleBlockReason | null;
  blockNotes: string | null;
  notes: string | null;
  updatedAt: string;
  company: NamedRecord | null;
  batch: {
    id: string;
    code: string;
    name: string | null;
    status: PaymentBatchStatus;
  } | null;
  payable: {
    id: string;
    code: string;
    documentNumber: string | null;
    description: string | null;
    dueDate: string;
    categoryId: string | null;
    costCenterId: string | null;
    projectId: string | null;
    supplier: NamedRecord | null;
  };
  items: ScheduleItem[];
}

export interface PaymentScheduleDetail extends PaymentScheduleListItem {
  cancellationReason: string | null;
  releaseReason: string | null;
  history: ScheduleHistoryEntry[];
  comments: ScheduleComment[];
  balance: BalanceCheck | null;
}

export interface PaymentBatchListItem {
  id: string;
  code: string;
  name: string | null;
  companyId: string;
  financialAccountId: string;
  scheduledDate: string;
  status: PaymentBatchStatus;
  bankPaymentType: BankPaymentType | null;
  itemCount: number;
  totalAmount: string;
  responsibleUserId: string | null;
  notes: string | null;
  company: NamedRecord | null;
  financialAccount: {
    id: string;
    name: string;
    displayName: string | null;
    status: string;
    financialInstitution: {
      id: string;
      shortName: string | null;
      legalName: string;
    } | null;
  } | null;
}

export interface PaymentBatchDetail extends PaymentBatchListItem {
  balance: BalanceCheck;
  blockedCount: number;
  readyToClose: boolean;
  items: {
    id: string;
    sequence: number;
    amount: string;
    schedule: PaymentScheduleListItem & {
      payable: PaymentScheduleListItem["payable"];
    };
  }[];
  history: ScheduleHistoryEntry[];
}

/** Título do Contas a Pagar ainda sem programação. */
export interface SchedulablePayable {
  id: string;
  code: string;
  documentNumber: string | null;
  description: string | null;
  dueDate: string;
  balanceAmount: string;
  priority: string;
  financialAccountId: string | null;
  supplier: NamedRecord | null;
  installments: {
    id: string;
    installmentNumber: number;
    dueDate: string;
    balanceAmount: string;
  }[];
}

export interface SimulationDay {
  date: string;
  outflow: number;
  scheduleCount: number;
  projectedBalance: number;
  deficit: number;
}

export interface SimulationAccount {
  accountId: string;
  accountName: string;
  openingBalance: number;
  creditLimit: number;
  spendingPower: number;
  totalOutflow: number;
  lowestBalance: number;
  lowestBalanceDate: string | null;
  deficit: number;
  surplus: number;
  days: SimulationDay[];
}

export interface SimulationResult {
  from: string;
  to: string;
  considerCreditLimits: boolean;
  simulated: number;
  scheduleCount: number;
  totalOutflow: number;
  totalSpendingPower: number;
  totalDeficit: number;
  totalSurplus: number;
  hasDeficit: boolean;
  accounts: SimulationAccount[];
  unassigned: number;
}

export interface DashboardGroup {
  key: string | null;
  label: string;
  total: number;
  count: number;
}

/** Os onze indicadores da seção 3. */
export interface SchedulingDashboard {
  generatedAt: string;
  dueTodayTotal: number;
  dueTodayCount: number;
  dueThisWeekTotal: number;
  dueThisMonthTotal: number;
  pendingSchedulingTotal: number;
  pendingSchedulingCount: number;
  blockedTotal: number;
  blockedCount: number;
  urgentTotal: number;
  urgentCount: number;
  rescheduledTotal: number;
  rescheduledCount: number;
  batchesAwaitingCount: number;
  batchesAwaitingTotal: number;
  batchesBlockedCount: number;
  byCompany: DashboardGroup[];
  byFinancialAccount: DashboardGroup[];
  byPaymentType: DashboardGroup[];
  accountPositions: AccountPosition[];
}

export interface PaymentScheduleSettings {
  id: string;
  companyId: string;
  schedulePrefix: string;
  batchPrefix: string;
  blockOnInsufficientBalance: boolean;
  considerCreditLimits: boolean;
  blockRetroactiveDates: boolean;
  minimumLeadTimeDays: number;
  requireReasonOnReschedule: boolean;
  defaultFinancialAccountId: string | null;
  defaultBankPaymentType: BankPaymentType | null;
  defaultPriority: SchedulePriority;
}

export interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  results: { scheduleId: string; ok: boolean; code?: string; error?: string }[];
}

export function displayNameOf(record: NamedRecord | null): string {
  if (!record) return "—";
  return record.tradeName ?? record.legalName;
}
