import type { RecordStatus } from "./financial-structure";

export type FinancialAccountType =
  | "CHECKING_ACCOUNT"
  | "SAVINGS_ACCOUNT"
  | "PAYMENT_ACCOUNT"
  | "DIGITAL_ACCOUNT"
  | "INVESTMENT_ACCOUNT"
  | "GUARANTEED_ACCOUNT"
  | "CASH"
  | "PETTY_CASH"
  | "DIGITAL_WALLET"
  | "RECEIVING_ACCOUNT"
  | "TRANSIT_ACCOUNT"
  | "COMPENSATION_ACCOUNT"
  | "OTHER";

export type FinancialAccountPurpose =
  | "PAYMENTS"
  | "RECEIPTS"
  | "PAYROLL"
  | "TAXES"
  | "INVESTMENTS"
  | "OPERATING_CASH"
  | "CORPORATE_EXPENSES"
  | "TRANSFERS"
  | "GUARANTEES"
  | "INTERNAL_MOVEMENTS"
  | "MULTIPLE";

export type FinancialAccountStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "ACTIVE"
  | "BLOCKED"
  | "SUSPENDED"
  | "INACTIVE"
  | "CLOSED";

export type ReconciliationMode =
  | "MANUAL"
  | "SEMI_AUTOMATIC"
  | "AUTOMATIC_WITH_CONFIRMATION"
  | "AUTOMATIC_BY_RULE"
  | "NOT_RECONCILABLE";

export type BalanceType = "CREDIT" | "DEBIT" | "ZERO";

export type OpeningBalanceStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

export type BankLimitType =
  | "OVERDRAFT"
  | "GUARANTEED_ACCOUNT"
  | "WORKING_CAPITAL"
  | "RECEIVABLES_ANTICIPATION"
  | "REVOLVING"
  | "OTHER";

export type PixKeyType = "CPF" | "CNPJ" | "PHONE" | "EMAIL" | "RANDOM" | "BANK_DATA";

export type PixKeyPurpose =
  | "GENERAL"
  | "BILLING"
  | "SUPPLIERS"
  | "CUSTOMERS"
  | "PAYROLL"
  | "REFUNDS";

export type BankIntegrationType =
  | "OFX_MANUAL"
  | "CNAB"
  | "OPEN_FINANCE"
  | "BANK_API"
  | "SFTP"
  | "WEBHOOK"
  | "ERP"
  | "CSV_FILE"
  | "XLSX_FILE"
  | "MANUAL";

export type BankIntegrationStatus =
  | "NOT_CONFIGURED"
  | "PENDING"
  | "ACTIVE"
  | "ERROR"
  | "SUSPENDED"
  | "DISCONNECTED";

export type IntegrationEnvironment = "SANDBOX" | "PRODUCTION";

export type CorporateCardType =
  | "CREDIT"
  | "DEBIT"
  | "PREPAID"
  | "MULTIPLE"
  | "VIRTUAL"
  | "OTHER";

export type CorporateCardStatus =
  | "DRAFT"
  | "ACTIVE"
  | "BLOCKED"
  | "EXPIRED"
  | "CANCELLED"
  | "INACTIVE";

export type PaymentMethodType =
  | "PIX"
  | "BOLETO"
  | "BANK_TRANSFER"
  | "TED"
  | "DOC"
  | "DIRECT_DEBIT"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CASH"
  | "CHECK"
  | "UTILITY_BILL"
  | "COMPENSATION"
  | "ACCOUNT_CREDIT"
  | "BATCH_PAYMENT"
  | "OTHER";

export type ReceiptMethodType =
  | "PIX"
  | "BOLETO"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CASH"
  | "CHECK"
  | "PAYMENT_LINK"
  | "DIRECT_DEBIT"
  | "ACCOUNT_CREDIT"
  | "DEPOSIT"
  | "GATEWAY"
  | "MARKETPLACE"
  | "OTHER";

// ── Rótulos em português ─────────────────────────────────────────────────────

export const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  CHECKING_ACCOUNT: "Conta corrente",
  SAVINGS_ACCOUNT: "Conta poupança",
  PAYMENT_ACCOUNT: "Conta de pagamento",
  DIGITAL_ACCOUNT: "Conta digital",
  INVESTMENT_ACCOUNT: "Conta de investimento",
  GUARANTEED_ACCOUNT: "Conta garantida",
  CASH: "Caixa",
  PETTY_CASH: "Fundo fixo",
  DIGITAL_WALLET: "Carteira digital",
  RECEIVING_ACCOUNT: "Conta de recebimento",
  TRANSIT_ACCOUNT: "Conta de trânsito",
  COMPENSATION_ACCOUNT: "Conta de compensação",
  OTHER: "Outra",
};

/** Tipos que exigem instituição, agência e conta. */
export const BANK_ACCOUNT_TYPES: FinancialAccountType[] = [
  "CHECKING_ACCOUNT",
  "SAVINGS_ACCOUNT",
  "PAYMENT_ACCOUNT",
  "DIGITAL_ACCOUNT",
  "INVESTMENT_ACCOUNT",
  "GUARANTEED_ACCOUNT",
  "RECEIVING_ACCOUNT",
];

export const ACCOUNT_PURPOSE_LABELS: Record<FinancialAccountPurpose, string> = {
  PAYMENTS: "Pagamentos",
  RECEIPTS: "Recebimentos",
  PAYROLL: "Folha de pagamento",
  TAXES: "Tributos",
  INVESTMENTS: "Investimentos",
  OPERATING_CASH: "Caixa operacional",
  CORPORATE_EXPENSES: "Despesas corporativas",
  TRANSFERS: "Transferências",
  GUARANTEES: "Garantias",
  INTERNAL_MOVEMENTS: "Movimentações internas",
  MULTIPLE: "Múltiplas finalidades",
};

export const ACCOUNT_STATUS_LABELS: Record<FinancialAccountStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_VALIDATION: "Pendente de validação",
  ACTIVE: "Ativa",
  BLOCKED: "Bloqueada",
  SUSPENDED: "Suspensa",
  INACTIVE: "Inativa",
  CLOSED: "Encerrada",
};

export const RECONCILIATION_MODE_LABELS: Record<ReconciliationMode, string> = {
  MANUAL: "Manual",
  SEMI_AUTOMATIC: "Semiautomático",
  AUTOMATIC_WITH_CONFIRMATION: "Automático com confirmação",
  AUTOMATIC_BY_RULE: "Automático por regra",
  NOT_RECONCILABLE: "Não conciliável",
};

export const BALANCE_TYPE_LABELS: Record<BalanceType, string> = {
  CREDIT: "Credor",
  DEBIT: "Devedor",
  ZERO: "Zero",
};

export const BANK_LIMIT_TYPE_LABELS: Record<BankLimitType, string> = {
  OVERDRAFT: "Cheque especial",
  GUARANTEED_ACCOUNT: "Conta garantida",
  WORKING_CAPITAL: "Capital de giro",
  RECEIVABLES_ANTICIPATION: "Antecipação de recebíveis",
  REVOLVING: "Limite rotativo",
  OTHER: "Outro",
};

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  PHONE: "Telefone",
  EMAIL: "E-mail",
  RANDOM: "Chave aleatória",
  BANK_DATA: "Dados bancários",
};

export const PIX_KEY_PURPOSE_LABELS: Record<PixKeyPurpose, string> = {
  GENERAL: "Geral",
  BILLING: "Cobrança",
  SUPPLIERS: "Fornecedores",
  CUSTOMERS: "Clientes",
  PAYROLL: "Folha de pagamento",
  REFUNDS: "Reembolsos",
};

export const INTEGRATION_TYPE_LABELS: Record<BankIntegrationType, string> = {
  OFX_MANUAL: "OFX manual",
  CNAB: "CNAB",
  OPEN_FINANCE: "Open Finance",
  BANK_API: "API bancária",
  SFTP: "SFTP",
  WEBHOOK: "Webhook",
  ERP: "Integração com ERP",
  CSV_FILE: "Arquivo CSV",
  XLSX_FILE: "Arquivo XLSX",
  MANUAL: "Integração manual",
};

export const INTEGRATION_STATUS_LABELS: Record<BankIntegrationStatus, string> = {
  NOT_CONFIGURED: "Não configurada",
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  ERROR: "Com erro",
  SUSPENDED: "Suspensa",
  DISCONNECTED: "Desconectada",
};

export const CARD_TYPE_LABELS: Record<CorporateCardType, string> = {
  CREDIT: "Cartão de crédito",
  DEBIT: "Cartão de débito",
  PREPAID: "Cartão pré-pago",
  MULTIPLE: "Cartão múltiplo",
  VIRTUAL: "Cartão virtual",
  OTHER: "Outro",
};

export const CARD_STATUS_LABELS: Record<CorporateCardStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
  INACTIVE: "Inativo",
};

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferência bancária",
  TED: "TED",
  DOC: "DOC",
  DIRECT_DEBIT: "Débito automático",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  CHECK: "Cheque",
  UTILITY_BILL: "Conta de consumo",
  COMPENSATION: "Compensação",
  ACCOUNT_CREDIT: "Crédito em conta",
  BATCH_PAYMENT: "Pagamento em lote",
  OTHER: "Outro",
};

export const RECEIPT_METHOD_TYPE_LABELS: Record<ReceiptMethodType, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferência bancária",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  CHECK: "Cheque",
  PAYMENT_LINK: "Link de pagamento",
  DIRECT_DEBIT: "Débito automático",
  ACCOUNT_CREDIT: "Crédito em conta",
  DEPOSIT: "Depósito",
  GATEWAY: "Gateway",
  MARKETPLACE: "Marketplace",
  OTHER: "Outro",
};

// ── Entidades ────────────────────────────────────────────────────────────────

export interface FinancialInstitutionSummary {
  id: string;
  legalName: string;
  shortName: string | null;
  compeCode: string | null;
}

export interface FinancialAccount {
  id: string;
  organizationId: string;
  companyId: string;
  internalCode: string | null;
  name: string;
  displayName: string | null;
  accountType: FinancialAccountType;
  purpose: FinancialAccountPurpose;
  financialInstitutionId: string | null;
  financialInstitution?: FinancialInstitutionSummary | null;
  businessUnitId: string | null;
  businessUnit?: { id: string; name: string } | null;
  costCenterId: string | null;
  costCenter?: { id: string; name: string } | null;
  accountPlanId: string | null;
  accountPlan?: { id: string; code: string; name: string } | null;
  financialNatureId: string | null;
  /** Mascarados quando falta a permissão `financial_account.view_bank_data`. */
  branchNumber: string | null;
  branchDigit: string | null;
  accountNumber: string | null;
  accountDigit: string | null;
  holderName: string | null;
  holderDocument: string | null;
  isThirdParty: boolean;
  thirdPartyReason: string | null;
  country: string | null;
  swiftCode: string | null;
  iban: string | null;
  agreementNumber: string | null;
  physicalLocation: string | null;
  responsibleUserId: string | null;
  requiresDailyClosing: boolean;
  checkFrequencyDays: number | null;
  currencyCode: string;
  isPrimary: boolean;
  isDefaultForPayments: boolean;
  isDefaultForReceipts: boolean;
  isDefaultForTaxes: boolean;
  isDefaultForPayroll: boolean;
  isDefaultForTransfers: boolean;
  allowsNegativeBalance: boolean;
  allowsManualEntries: boolean;
  allowsImports: boolean;
  allowsIntegrations: boolean;
  requiresAttachment: boolean;
  requiresCategory: boolean;
  reconciliationMode: ReconciliationMode;
  /** Mascarados quando falta `financial_account.view_balance`. */
  minimumRecommendedBalance: string | number | null;
  blockedBalance: string | number | null;
  closingBalance: string | number | null;
  startDate: string | null;
  closingDate: string | null;
  closingReason: string | null;
  status: FinancialAccountStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    pixKeys: number;
    cards: number;
    users: number;
    integrations: number;
  };
  openingBalances?: OpeningBalance[];
  limits?: AccountLimit[];
  pixKeys?: CompanyPixKey[];
}

export interface OpeningBalance {
  id: string;
  financialAccountId: string;
  balanceDate: string;
  balanceAmount: string | number;
  balanceType: BalanceType;
  source: string | null;
  reason: string | null;
  status: OpeningBalanceStatus;
  approvedAt: string | null;
  createdAt: string;
}

export interface AccountLimit {
  id: string;
  financialAccountId: string;
  limitType: BankLimitType;
  contractedAmount: string | number;
  interestRate: string | number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  status: RecordStatus;
}

export interface CompanyPixKey {
  id: string;
  organizationId: string;
  companyId: string;
  financialAccountId: string | null;
  financialAccount?: { id: string; displayName: string | null; name: string } | null;
  pixType: PixKeyType;
  pixKey: string;
  holderName: string | null;
  holderDocument: string | null;
  purpose: PixKeyPurpose;
  isPrimary: boolean;
  isForBilling: boolean;
  isForSuppliers: boolean;
  isForCustomers: boolean;
  validationStatus: "UNVERIFIED" | "VERIFIED" | "FAILED";
  validatedAt: string | null;
  status: RecordStatus;
  createdAt: string;
}

export interface AccountUser {
  id: string;
  financialAccountId: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  role?: { id: string; name: string } | null;
  viewLimit: string | number | null;
  transactionLimit: string | number | null;
  approvalLimit: string | number | null;
  canViewBalance: boolean;
  canViewBankData: boolean;
  canCreateEntry: boolean;
  canImportStatement: boolean;
  canReconcile: boolean;
  canSchedulePayment: boolean;
  canAuthorizePayment: boolean;
  canUpdateOpeningBalance: boolean;
  canUpdateLimits: boolean;
  canManageIntegration: boolean;
  canExport: boolean;
  status: RecordStatus;
}

/** A referência da credencial nunca vem na API — apenas se existe. */
export interface AccountIntegration {
  id: string;
  financialAccountId: string;
  integrationType: BankIntegrationType;
  provider: string | null;
  externalAccountId: string | null;
  environment: IntegrationEnvironment;
  status: BankIntegrationStatus;
  supportsBalance: boolean;
  supportsStatements: boolean;
  supportsPayments: boolean;
  supportsBilling: boolean;
  supportsReconciliation: boolean;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastErrorMessage: string | null;
}

export interface CorporateCard {
  id: string;
  organizationId: string;
  companyId: string;
  financialAccountId: string | null;
  financialAccount?: { id: string; displayName: string | null; name: string } | null;
  financialInstitution?: FinancialInstitutionSummary | null;
  costCenter?: { id: string; name: string } | null;
  businessUnit?: { id: string; name: string } | null;
  name: string;
  displayName: string | null;
  cardType: CorporateCardType;
  brand: string | null;
  /** O sistema guarda apenas isto do número do cartão. */
  lastFourDigits: string;
  holderName: string | null;
  responsibleUserId: string | null;
  isPhysical: boolean;
  isVirtual: boolean;
  totalLimit: string | number | null;
  transactionLimit: string | number | null;
  closingDay: number | null;
  dueDay: number | null;
  allowsInstallments: boolean;
  maximumInstallments: number | null;
  issueDate: string | null;
  expirationDate: string | null;
  status: CorporateCardStatus;
  notes: string | null;
  updatedAt: string;
  _count?: { users: number };
  users?: CardUser[];
}

export interface CardUser {
  id: string;
  corporateCardId: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  isPrimary: boolean;
  individualLimit: string | number | null;
  transactionLimit: string | number | null;
  status: RecordStatus;
}

export interface PaymentMethod {
  id: string;
  organizationId: string;
  companyId: string | null;
  code: string;
  name: string;
  description: string | null;
  methodType: PaymentMethodType;
  requiresFinancialAccount: boolean;
  requiresBeneficiary: boolean;
  requiresBankData: boolean;
  requiresPixKey: boolean;
  requiresBarcode: boolean;
  requiresDigitableLine: boolean;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  allowsScheduling: boolean;
  allowsInstallments: boolean;
  allowsRecurrence: boolean;
  allowsIntegration: boolean;
  allowsBatchPayment: boolean;
  confirmationThreshold: string | number | null;
  settlementDays: number;
  sortOrder: number;
  status: RecordStatus;
  isSystem: boolean;
}

export interface ReceiptMethod {
  id: string;
  organizationId: string;
  companyId: string | null;
  code: string;
  name: string;
  description: string | null;
  methodType: ReceiptMethodType;
  defaultFinancialAccountId: string | null;
  defaultFinancialAccount?: {
    id: string;
    displayName: string | null;
    name: string;
  } | null;
  requiresCustomer: boolean;
  requiresDocument: boolean;
  requiresIdentifier: boolean;
  allowsRecurrence: boolean;
  allowsInstallments: boolean;
  maximumInstallments: number | null;
  settlementDays: number;
  fixedFee: string | number | null;
  percentageFee: string | number | null;
  anticipationAllowed: boolean;
  anticipationFeePercentage: string | number | null;
  integrationProvider: string | null;
  sortOrder: number;
  status: RecordStatus;
  isSystem: boolean;
}

export interface TreasurySettings {
  id: string;
  organizationId: string;
  companyId: string;
  primaryFinancialAccountId: string | null;
  defaultPaymentAccountId: string | null;
  defaultReceiptAccountId: string | null;
  defaultTaxAccountId: string | null;
  defaultPayrollAccountId: string | null;
  defaultCashAccountId: string | null;
  currencyCode: string;
  minimumSafetyBalance: string | number | null;
  allowNegativeBalance: boolean;
  allowInactiveAccountOperations: boolean;
  requireAvailableBalance: boolean;
  requireAttachment: boolean;
  requireRegisteredBeneficiary: boolean;
  requireHolderValidation: boolean;
  requireDualApproval: boolean;
  dualApprovalAmount: string | number | null;
  allowThirdPartyAccounts: boolean;
  allowOpeningBalanceChange: boolean;
  allowManualEntries: boolean;
  requireSegregationOfDuties: boolean;
  segregateEntryFromApproval: boolean;
  segregateApprovalFromReconciliation: boolean;
  allowSelfApproval: boolean;
  cardExpirationAlertDays: number;
  accountClosingAlertDays: number;
  defaultReconciliationMode: ReconciliationMode;
  amountTolerance: string | number;
  dateToleranceDays: number;
}

export interface TreasuryOverview {
  accounts: { active: number; draft: number; inactive: number; blocked: number };
  cards: { active: number; expiringSoon: number };
  pixKeys: { total: number; pendingValidation: number };
  methods: { payment: number; receipt: number };
  structure: { openingBalances: number; limits: number };
  pendencies: {
    code: string;
    label: string;
    items: { id: string; name: string; displayName: string | null }[];
  }[];
  pendenciesTotal: number;
  recentChanges: {
    id: string;
    previousStatus: FinancialAccountStatus | null;
    newStatus: FinancialAccountStatus;
    reason: string | null;
    changedAt: string;
    financialAccount: { id: string; name: string; displayName: string | null };
  }[];
  note: string;
}

export interface CardAlerts {
  alertDays: number;
  expiringSoon: { id: string; name: string; lastFourDigits: string; expirationDate: string }[];
  expired: { id: string; name: string; lastFourDigits: string; expirationDate: string }[];
  withoutResponsible: { id: string; name: string; lastFourDigits: string }[];
  inactiveAccount: { id: string; name: string; lastFourDigits: string }[];
  total: number;
}

export interface AccountUsage {
  id: string;
  status: FinancialAccountStatus;
  inUse: boolean;
  canDelete: boolean;
  total: number;
  relations: { label: string; count: number }[];
}

export interface Beneficiary {
  entityType: string;
  entityId: string;
  entityName: string;
  entityDocument: string | null;
  bankAccountId: string;
  institution: string | null;
  branch: string | null;
  account: string | null;
  holderName: string | null;
  holderDocument: string | null;
  isPrimary: boolean;
  isThirdParty: boolean;
  verificationStatus: string;
  status: RecordStatus;
  pixKeys: {
    id: string;
    pixType: PixKeyType;
    pixKey: string | null;
    isPrimary: boolean;
    verificationStatus: string;
  }[];
  updatedAt: string;
}

/** Uma linha do histórico de situação de uma conta financeira. */
export interface AccountStatusHistoryEntry {
  id: string;
  financialAccountId: string;
  financialAccount: { id: string; name: string; displayName: string | null };
  previousStatus: FinancialAccountStatus | null;
  newStatus: FinancialAccountStatus;
  reason: string | null;
  changedAt: string;
  changedBy: string | null;
  changedByUser: { id: string; name: string; email: string } | null;
}
