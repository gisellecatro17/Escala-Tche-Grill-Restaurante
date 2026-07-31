/**
 * Tipos do Centro de Conciliação Financeira.
 *
 * Espelham o que o back-end devolve. Os rótulos moram aqui e não espalhados nas telas:
 * "não identificada" precisa dizer a mesma coisa na fila, no painel e no histórico, senão
 * a pessoa acha que são três situações diferentes.
 */

export type BankStatementSourceType =
  | "OFX"
  | "CSV"
  | "XLSX"
  | "MANUAL"
  | "CNAB_RETURN"
  | "OPEN_FINANCE"
  | "BANK_API"
  | "EXTERNAL_INTEGRATION";

export const SOURCE_TYPE_LABELS: Record<BankStatementSourceType, string> = {
  OFX: "OFX",
  CSV: "CSV",
  XLSX: "Planilha",
  MANUAL: "Digitação manual",
  CNAB_RETURN: "Retorno CNAB",
  OPEN_FINANCE: "Open Finance",
  BANK_API: "API bancária",
  EXTERNAL_INTEGRATION: "Integração externa",
};

/** Os formatos que este módulo lê hoje. Os demais aparecem como "não configurado". */
export const IMPLEMENTED_SOURCES: BankStatementSourceType[] = [
  "OFX",
  "CSV",
  "XLSX",
  "MANUAL",
];

export type BankStatementImportStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "PARSING"
  | "NORMALIZING"
  | "CHECKING_DUPLICATES"
  | "READY_TO_IMPORT"
  | "IMPORTING"
  | "IMPORTED"
  | "PARTIALLY_IMPORTED"
  | "FAILED"
  | "CANCELLED"
  | "REPROCESSED"
  | "ARCHIVED";

export const IMPORT_STATUS_LABELS: Record<BankStatementImportStatus, string> = {
  UPLOADED: "Enviado",
  VALIDATING: "Validando",
  VALIDATED: "Validado",
  PARSING: "Lendo o arquivo",
  NORMALIZING: "Normalizando",
  CHECKING_DUPLICATES: "Verificando duplicidade",
  READY_TO_IMPORT: "Pronto para importar",
  IMPORTING: "Importando",
  IMPORTED: "Importado",
  PARTIALLY_IMPORTED: "Importado com pendências",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  REPROCESSED: "Reprocessado",
  ARCHIVED: "Arquivado",
};

export type BankTransactionDirection = "IN" | "OUT";

export const DIRECTION_LABELS: Record<BankTransactionDirection, string> = {
  IN: "Entrada",
  OUT: "Saída",
};

/**
 * O tipo carrega o sentido no próprio nome (`PIX_IN`, `PIX_OUT`) porque um PIX recebido e
 * um PIX enviado são fatos diferentes na leitura do extrato — e o rótulo curto na tela
 * precisa dizer qual dos dois é sem depender de outra coluna.
 */
export type BankTransactionType =
  | "CREDIT"
  | "DEBIT"
  | "PIX_IN"
  | "PIX_OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "BOLETO_PAYMENT"
  | "BOLETO_RECEIPT"
  | "TED_IN"
  | "TED_OUT"
  | "DOC_IN"
  | "DOC_OUT"
  | "BANK_FEE"
  | "TAX_PAYMENT"
  | "PAYROLL"
  | "CARD_SETTLEMENT"
  | "LOAN"
  | "FINANCIAL_INVESTMENT"
  | "FINANCIAL_REDEMPTION"
  | "INTEREST"
  | "PENALTY"
  | "REFUND"
  | "REVERSAL"
  | "CHARGEBACK"
  | "CASH_DEPOSIT"
  | "CHECK"
  | "INTERNAL_TRANSFER"
  | "OTHER"
  | "UNKNOWN";

export const TRANSACTION_TYPE_LABELS: Record<BankTransactionType, string> = {
  CREDIT: "Crédito",
  DEBIT: "Débito",
  PIX_IN: "PIX recebido",
  PIX_OUT: "PIX enviado",
  TRANSFER_IN: "Transferência recebida",
  TRANSFER_OUT: "Transferência enviada",
  BOLETO_PAYMENT: "Boleto pago",
  BOLETO_RECEIPT: "Boleto recebido",
  TED_IN: "TED recebida",
  TED_OUT: "TED enviada",
  DOC_IN: "DOC recebido",
  DOC_OUT: "DOC enviado",
  BANK_FEE: "Tarifa bancária",
  TAX_PAYMENT: "Tributo",
  PAYROLL: "Folha de pagamento",
  CARD_SETTLEMENT: "Liquidação de cartão",
  LOAN: "Empréstimo",
  FINANCIAL_INVESTMENT: "Aplicação",
  FINANCIAL_REDEMPTION: "Resgate",
  INTEREST: "Juros",
  PENALTY: "Multa",
  REFUND: "Reembolso",
  REVERSAL: "Estorno",
  CHARGEBACK: "Chargeback",
  CASH_DEPOSIT: "Depósito em dinheiro",
  CHECK: "Cheque",
  INTERNAL_TRANSFER: "Transferência interna",
  OTHER: "Outro",
  UNKNOWN: "Não classificado",
};

export type BankTransactionReconciliationStatus =
  | "IMPORTED"
  | "AVAILABLE"
  | "MATCH_SUGGESTED"
  | "PARTIALLY_MATCHED"
  | "MATCHED"
  | "MANUALLY_MATCHED"
  | "UNIDENTIFIED"
  | "IGNORED"
  | "DUPLICATE"
  | "REVERSED"
  | "CANCELLED"
  | "ERROR";

export const TRANSACTION_STATUS_LABELS: Record<
  BankTransactionReconciliationStatus,
  string
> = {
  IMPORTED: "Importada",
  AVAILABLE: "A conciliar",
  MATCH_SUGGESTED: "Sugestão encontrada",
  PARTIALLY_MATCHED: "Conciliada em parte",
  MATCHED: "Conciliada",
  MANUALLY_MATCHED: "Conciliada manualmente",
  UNIDENTIFIED: "Não identificada",
  IGNORED: "Ignorada",
  DUPLICATE: "Duplicada",
  REVERSED: "Estornada",
  CANCELLED: "Cancelada",
  ERROR: "Com erro",
};

export type DuplicateStatus =
  | "NOT_DUPLICATE"
  | "POSSIBLE"
  | "HIGH_PROBABILITY"
  | "EXACT";

export const DUPLICATE_LABELS: Record<DuplicateStatus, string> = {
  NOT_DUPLICATE: "Sem duplicidade",
  POSSIBLE: "Possível duplicidade",
  HIGH_PROBABILITY: "Provável duplicidade",
  EXACT: "Duplicidade exata",
};

export type ReconcilableEntityType =
  | "ACCOUNTS_PAYABLE"
  | "ACCOUNTS_PAYABLE_INSTALLMENT"
  | "PAYMENT_SCHEDULE"
  | "PAYMENT_BATCH"
  | "ACCOUNTS_PAYABLE_PAYMENT"
  | "INTERNAL_TRANSFER"
  | "MANUAL_ADJUSTMENT"
  | "ACCOUNTS_RECEIVABLE"
  | "ACCOUNTS_RECEIVABLE_INSTALLMENT"
  | "RECEIPT"
  | "BANK_FEE"
  | "FINANCIAL_INVESTMENT"
  | "SUPPLIER_ADVANCE"
  | "PAYROLL"
  | "TAX"
  | "OTHER";

export const ENTITY_TYPE_LABELS: Record<ReconcilableEntityType, string> = {
  ACCOUNTS_PAYABLE: "Título a pagar",
  ACCOUNTS_PAYABLE_INSTALLMENT: "Parcela a pagar",
  PAYMENT_SCHEDULE: "Programação de pagamento",
  PAYMENT_BATCH: "Lote de pagamento",
  ACCOUNTS_PAYABLE_PAYMENT: "Baixa de pagamento",
  INTERNAL_TRANSFER: "Transferência interna",
  MANUAL_ADJUSTMENT: "Ajuste manual",
  ACCOUNTS_RECEIVABLE: "Título a receber",
  ACCOUNTS_RECEIVABLE_INSTALLMENT: "Parcela a receber",
  RECEIPT: "Recebimento",
  BANK_FEE: "Tarifa bancária",
  FINANCIAL_INVESTMENT: "Aplicação financeira",
  SUPPLIER_ADVANCE: "Adiantamento a fornecedor",
  PAYROLL: "Folha de pagamento",
  TAX: "Tributo",
  OTHER: "Outro",
};

export type MatchConfidenceLevel = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";

export const CONFIDENCE_LABELS: Record<MatchConfidenceLevel, string> = {
  VERY_HIGH: "Confiança altíssima",
  HIGH: "Confiança alta",
  MEDIUM: "Confiança média",
  LOW: "Confiança baixa",
};

export type MatchSuggestionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DISMISSED"
  | "EXPIRED";

export const SUGGESTION_STATUS_LABELS: Record<MatchSuggestionStatus, string> = {
  PENDING: "Aguardando revisão",
  ACCEPTED: "Aceita",
  DISMISSED: "Descartada",
  EXPIRED: "Caducada",
};

export type ReconciliationType =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_ONE"
  | "PARTIAL"
  | "TRANSFER"
  | "ADJUSTMENT";

export const RECONCILIATION_TYPE_LABELS: Record<ReconciliationType, string> = {
  ONE_TO_ONE: "Um para um",
  ONE_TO_MANY: "Um para muitos",
  MANY_TO_ONE: "Muitos para um",
  PARTIAL: "Parcial",
  TRANSFER: "Transferência interna",
  ADJUSTMENT: "Ajuste",
};

export type ReconciliationStatus = "ACTIVE" | "UNMATCHED" | "CANCELLED";

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  ACTIVE: "Ativa",
  UNMATCHED: "Desfeita",
  CANCELLED: "Cancelada",
};

export type ReconciliationHistoryAction =
  | "FILE_UPLOADED"
  | "FILE_VALIDATED"
  | "FILE_IMPORTED"
  | "FILE_REPROCESSED"
  | "FILE_CANCELLED"
  | "FILE_ARCHIVED"
  | "FILE_DOWNLOADED"
  | "DUPLICATE_DETECTED"
  | "DUPLICATE_OVERRIDDEN"
  | "TRANSACTION_IMPORTED"
  | "TRANSACTION_NORMALIZED"
  | "TRANSACTION_MANUAL_CREATED"
  | "TRANSACTION_UPDATED"
  | "TRANSACTION_IGNORED"
  | "TRANSACTION_REPROCESSED"
  | "SUGGESTIONS_GENERATED"
  | "SUGGESTION_ACCEPTED"
  | "SUGGESTION_DISMISSED"
  | "MATCHED"
  | "PARTIALLY_MATCHED"
  | "UNMATCHED"
  | "ASSIGNED"
  | "ADJUSTMENT_CREATED"
  | "SETTINGS_CHANGED";

export const HISTORY_ACTION_LABELS: Record<ReconciliationHistoryAction, string> = {
  FILE_UPLOADED: "Arquivo enviado",
  FILE_VALIDATED: "Arquivo validado",
  FILE_IMPORTED: "Arquivo importado",
  FILE_REPROCESSED: "Arquivo reprocessado",
  FILE_CANCELLED: "Importação cancelada",
  FILE_ARCHIVED: "Importação arquivada",
  FILE_DOWNLOADED: "Arquivo baixado",
  DUPLICATE_DETECTED: "Duplicidade detectada",
  DUPLICATE_OVERRIDDEN: "Duplicidade liberada",
  TRANSACTION_IMPORTED: "Movimentação importada",
  TRANSACTION_NORMALIZED: "Movimentação normalizada",
  TRANSACTION_MANUAL_CREATED: "Movimentação digitada",
  TRANSACTION_UPDATED: "Movimentação corrigida",
  TRANSACTION_IGNORED: "Movimentação ignorada",
  TRANSACTION_REPROCESSED: "Movimentação reprocessada",
  SUGGESTIONS_GENERATED: "Sugestões geradas",
  SUGGESTION_ACCEPTED: "Sugestão aceita",
  SUGGESTION_DISMISSED: "Sugestão descartada",
  MATCHED: "Conciliada",
  PARTIALLY_MATCHED: "Conciliada em parte",
  UNMATCHED: "Conciliação desfeita",
  ASSIGNED: "Responsável definido",
  ADJUSTMENT_CREATED: "Ajuste registrado",
  SETTINGS_CHANGED: "Parâmetros alterados",
};

// ── Registros ────────────────────────────────────────────────────────────────

export interface AccountSummary {
  id: string;
  name: string;
  displayName: string | null;
  accountType?: string;
}

export interface StatementImportListItem {
  id: string;
  organizationId: string;
  companyId: string;
  financialAccountId: string;
  sourceType: BankStatementSourceType;
  originalFileName: string | null;
  fileSize: number | null;
  status: BankStatementImportStatus;
  statementStartDate: string | null;
  statementEndDate: string | null;
  openingBalance: string | number | null;
  closingBalance: string | number | null;
  calculatedClosingBalance: string | number | null;
  totalCredits: string | number;
  totalDebits: string | number;
  transactionCount: number;
  validTransactionCount: number;
  invalidTransactionCount: number;
  duplicateTransactionCount: number;
  duplicateStatus: DuplicateStatus;
  importedAt: string | null;
  createdAt: string;
  financialAccount?: AccountSummary;
}

export interface StatementImportDetail extends StatementImportListItem {
  errorLog: unknown;
  notes: string | null;
  transactions?: BankTransactionListItem[];
  history?: HistoryEntry[];
}

/** Prévia devolvida pelo envio do arquivo. Nada foi gravado como movimentação ainda. */
export interface ImportPreview {
  importId: string;
  status: BankStatementImportStatus;
  sourceType: BankStatementSourceType;
  fileName: string;
  account: AccountSummary;
  header: {
    bankCode: string | null;
    agencyNumber: string | null;
    accountNumber: string | null;
    startDate: string | null;
    endDate: string | null;
    openingBalance: number | null;
    closingBalance: number | null;
  };
  totals: {
    credits: number;
    debits: number;
    net: number;
    calculatedClosingBalance: number | null;
  };
  counts: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
  duplicate: {
    status: DuplicateStatus;
    reasons: string[];
    previousImportId: string | null;
    previousFileName: string | null;
    previousImportedAt: string | null;
  } | null;
  balanceMatches: boolean | null;
  errors: string[];
  warnings: string[];
  sample: {
    lineNumber: number;
    transactionDate: string | null;
    amount: number | null;
    direction: BankTransactionDirection | null;
    originalDescription: string;
    documentNumber: string | null;
    duplicateStatus: DuplicateStatus;
    errors: string[];
  }[];
}

export interface MatchCriterion {
  criterion: string;
  points: number;
  detail: string;
}

export interface MatchSuggestion {
  id: string;
  bankTransactionId: string;
  candidateEntityType: ReconcilableEntityType;
  candidateEntityId: string;
  score: string | number;
  confidenceLevel: MatchConfidenceLevel;
  matchingCriteria: {
    label?: string;
    description?: string;
    candidateAmount?: number;
    referenceDate?: string | null;
    supplierName?: string | null;
    criteria?: MatchCriterion[];
  };
  differenceAmount: string | number;
  differenceDays: number;
  status: MatchSuggestionStatus;
  dismissalReason: string | null;
  createdAt: string;
}

export interface BankTransactionListItem {
  id: string;
  organizationId: string;
  companyId: string;
  financialAccountId: string;
  statementImportId: string | null;
  sourceType: BankStatementSourceType;
  transactionType: BankTransactionType;
  direction: BankTransactionDirection;
  transactionDate: string;
  amount: string | number;
  reconciledAmount: string | number;
  originalDescription: string;
  normalizedDescription: string | null;
  documentNumber: string | null;
  payerName: string | null;
  payeeName: string | null;
  /** Mascarado pelo back-end quando falta `reconciliation.view_sensitive_data`. */
  accountNumber: string | null;
  payerDocument: string | null;
  payeeDocument: string | null;
  pixEndToEndId: string | null;
  isManual: boolean;
  manualReason: string | null;
  isDuplicate: boolean;
  duplicateStatus: DuplicateStatus;
  reconciliationStatus: BankTransactionReconciliationStatus;
  unidentifiedReason: string | null;
  ignoredReason: string | null;
  assignedUserId: string | null;
  financialAccount?: AccountSummary & { accountNumber?: string | null };
  statementImport?: {
    id: string;
    originalFileName: string | null;
    sourceType: BankStatementSourceType;
  } | null;
  suggestions?: MatchSuggestion[];
}

export interface HistoryEntry {
  id: string;
  actionType: ReconciliationHistoryAction;
  previousStatus: string | null;
  newStatus: string | null;
  details: unknown;
  reason: string | null;
  performedBy: string | null;
  performedAt: string;
  ipAddress: string | null;
  deviceInfo: string | null;
}

export interface BankTransactionDetail extends BankTransactionListItem {
  reconciliationItems?: {
    id: string;
    entityType: ReconcilableEntityType;
    entityId: string;
    bankAmount: string | number;
    allocatedAmount: string | number;
    reconciliation: {
      id: string;
      status: ReconciliationStatus;
      reconciliationType: ReconciliationType;
      reconciledAt: string;
      differenceAmount: string | number;
    };
  }[];
  assignments?: {
    id: string;
    assignedUserId: string | null;
    assignedTeam: string | null;
    dueAt: string | null;
    reason: string | null;
    status: string;
    assignedAt: string;
  }[];
  comments?: ReconciliationComment[];
  history?: HistoryEntry[];
}

export interface ResolvedEntity {
  entityType: ReconcilableEntityType;
  entityId: string;
  label: string;
  description: string;
  amount: number;
  referenceDate: string | null;
}

export interface ReconciliationItem {
  id: string;
  bankTransactionId: string;
  entityType: ReconcilableEntityType;
  entityId: string;
  bankAmount: string | number;
  allocatedAmount: string | number;
  differenceAmount: string | number;
  relationType: string | null;
  entity?: ResolvedEntity | null;
  bankTransaction?: {
    id: string;
    transactionDate: string;
    amount: string | number;
    direction: BankTransactionDirection;
    originalDescription: string;
  };
}

export interface ReconciliationListItem {
  id: string;
  organizationId: string;
  companyId: string;
  financialAccountId: string;
  reconciliationType: ReconciliationType;
  status: ReconciliationStatus;
  totalBankAmount: string | number;
  totalSystemAmount: string | number;
  differenceAmount: string | number;
  isPartial: boolean;
  isManual: boolean;
  confidenceScore: string | number | null;
  differenceReason: string | null;
  notes: string | null;
  reconciledBy: string | null;
  reconciledAt: string;
  unmatchedBy: string | null;
  unmatchedAt: string | null;
  unmatchReason: string | null;
  financialAccount?: AccountSummary;
  items: ReconciliationItem[];
}

export interface ReconciliationDetail extends ReconciliationListItem {
  comments?: ReconciliationComment[];
  history?: HistoryEntry[];
}

export interface ReconciliationComment {
  id: string;
  comment: string;
  visibility: "INTERNAL" | "SHARED";
  createdBy: string | null;
  createdAt: string;
}

// ── Painel ───────────────────────────────────────────────────────────────────

export interface ReconciliationDashboard {
  period: { from: string; to: string };
  cards: {
    totalTransactions: number;
    totalAmount: number;
    reconciledTransactions: number;
    reconciledAmount: number;
    pendingTransactions: number;
    pendingAmount: number;
    unidentifiedTransactions: number;
    partiallyMatchedTransactions: number;
    pendingSuggestions: number;
    openDifferences: number;
  };
  indicators: {
    reconciliationRateByCount: number;
    reconciliationRateByAmount: number;
    averageDaysToReconcile: number;
    duplicateTransactions: number;
    manualTransactions: number;
    openAssignments: number;
    overdueAssignments: number;
    acceptedSuggestions: number;
    dismissedSuggestions: number;
    averageSuggestionScore: number;
    creditAmount: number;
    debitAmount: number;
  };
  byStatus: {
    status: BankTransactionReconciliationStatus;
    count: number;
    amount: number;
  }[];
  byType: {
    transactionType: BankTransactionType;
    count: number;
    amount: number;
  }[];
  byReconciliationType: {
    reconciliationType: ReconciliationType;
    count: number;
    amount: number;
    difference: number;
  }[];
  imports: { status: BankStatementImportStatus; count: number }[];
  balances: AccountBalanceRow[];
}

export interface AccountBalanceRow {
  account: AccountSummary;
  lastImport: {
    id: string;
    statementEndDate: string | null;
    closingBalance: string | number | null;
    calculatedClosingBalance: string | number | null;
    importedAt: string | null;
  } | null;
  statementClosingBalance: number | null;
  periodCredits: number;
  periodDebits: number;
  periodNet: number;
  pendingTransactions: number;
  pendingAmount: number;
}

export interface TimelinePoint {
  date: string;
  credits: number;
  debits: number;
  reconciled: number;
  total: number;
}

export interface UnidentifiedRow {
  id: string;
  transactionDate: string;
  amount: string | number;
  direction: BankTransactionDirection;
  transactionType: BankTransactionType;
  originalDescription: string;
  documentNumber: string | null;
  reconciliationStatus: BankTransactionReconciliationStatus;
  unidentifiedReason: string | null;
  assignedUserId: string | null;
  financialAccount: AccountSummary;
  _count: { suggestions: number };
}

export interface WithoutStatementResult {
  installments: {
    entityType: "ACCOUNTS_PAYABLE_INSTALLMENT";
    entityId: string;
    code: string;
    installmentNumber: number;
    description: string | null;
    supplierName: string | null;
    amount: number;
    referenceDate: string | null;
  }[];
  schedules: {
    entityType: "PAYMENT_SCHEDULE";
    entityId: string;
    code: string;
    payableCode: string;
    description: string | null;
    amount: number;
    referenceDate: string | null;
  }[];
}

export interface TransferCandidate {
  outgoing: BankTransactionListItem;
  incoming: BankTransactionListItem;
  differenceDays: number;
  differenceAmount: number;
}

// ── Parâmetros e modelos ─────────────────────────────────────────────────────

export interface ReconciliationSettings {
  id: string;
  organizationId: string;
  companyId: string;
  financialAccountId: string | null;
  isEnabled: boolean;
  allowedImportTypes: BankStatementSourceType[];
  maximumFileSize: number;
  duplicateCheckEnabled: boolean;
  blockDuplicates: boolean;
  amountTolerance: string | number;
  percentageTolerance: string | number;
  dateToleranceDays: number;
  minimumSuggestionScore: string | number;
  mandatoryReview: boolean;
  automaticMatchingEnabled: boolean;
  partialMatchEnabled: boolean;
  multipleMatchEnabled: boolean;
  manualAdjustmentEnabled: boolean;
  manualTransactionEnabled: boolean;
  unmatchEnabled: boolean;
  reconciliationDeadlineDays: number | null;
  notificationsEnabled: boolean;
  closingRequired: boolean;
  financialAccount?: AccountSummary | null;
}

export interface SettingsBundle {
  company: ReconciliationSettings;
  perAccount: ReconciliationSettings[];
}

export interface EligibleAccount {
  account: AccountSummary & {
    status: string;
    financialInstitution: {
      id: string;
      shortName: string | null;
      legalName: string;
    } | null;
  };
  settingsId: string | null;
  inheritsFromCompany: boolean;
  isEnabled: boolean;
  allowedImportTypes: BankStatementSourceType[];
  maximumFileSize: number;
  amountTolerance: string | number;
  percentageTolerance: string | number;
  dateToleranceDays: number;
  minimumSuggestionScore: string | number;
  manualTransactionEnabled: boolean;
  partialMatchEnabled: boolean;
  multipleMatchEnabled: boolean;
  unmatchEnabled: boolean;
  lastImportedAt: string | null;
}

export interface ImportTemplate {
  id: string;
  organizationId: string;
  companyId: string | null;
  financialAccountId: string | null;
  name: string;
  bankCode: string | null;
  fileType: BankStatementSourceType;
  delimiter: string | null;
  encoding: string | null;
  dateFormat: string | null;
  decimalSeparator: string | null;
  thousandSeparator: string | null;
  headerRow: number | null;
  dataStartRow: number | null;
  footerRowsToIgnore: number;
  columnMapping: Record<string, string | number>;
  signRule: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  lastUsedAt: string | null;
  financialAccount?: AccountSummary | null;
  _count?: { imports: number };
}
