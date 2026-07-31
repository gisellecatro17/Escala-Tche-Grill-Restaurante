export type CustomerPersonType = "INDIVIDUAL" | "LEGAL_ENTITY" | "FOREIGN";
export type CustomerSystemStatus = "DRAFT" | "PENDING_VALIDATION" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type CustomerLinkStatus = "PROSPECT" | "DRAFT" | "ACTIVE" | "BLOCKED" | "SUSPENDED" | "INACTIVE";
export type CustomerFinancialStatus =
  | "ON_TIME"
  | "ATTENTION"
  | "OVERDUE"
  | "DELINQUENT"
  | "NEGOTIATING"
  | "BLOCKED"
  | "SUSPENDED"
  | "NO_ACTIVITY";
export type CustomerAddressType = "FISCAL" | "BILLING" | "DELIVERY" | "OPERATIONAL" | "CORRESPONDENCE";
export type AbcClassification = "A" | "B" | "C" | "NOT_CLASSIFIED";
export type RevenuePotentialLevel = "LOW" | "MEDIUM" | "HIGH" | "STRATEGIC";
export type CustomerRiskLevel = "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" | "NOT_ASSESSED";
export type RecurrencePeriodicity =
  | "ONCE"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "CUSTOM";
export type CustomerPaymentMethod =
  | "PIX"
  | "BOLETO"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CASH"
  | "DIRECT_DEBIT"
  | "PAYMENT_LINK"
  | "CHECK"
  | "OTHER";
export type CustomerOrigin =
  | "REFERRAL"
  | "ACTIVE_PROSPECTING"
  | "WEBSITE"
  | "SOCIAL_MEDIA"
  | "EVENT"
  | "PARTNER"
  | "CAMPAIGN"
  | "OLD_CUSTOMER"
  | "SYSTEM_MIGRATION"
  | "OTHER";
export type CustomerType =
  | "INDIVIDUAL"
  | "PRIVATE_COMPANY"
  | "GOVERNMENT_AGENCY"
  | "AUTARCHY"
  | "FOUNDATION"
  | "ASSOCIATION"
  | "CONDOMINIUM"
  | "COOPERATIVE"
  | "INDUSTRY"
  | "COMMERCE"
  | "SERVICE_PROVIDER"
  | "ECONOMIC_GROUP"
  | "INTERNAL_CUSTOMER"
  | "OTHER";
export type AdjustmentType = "ECONOMIC_INDEX" | "FIXED_PERCENTAGE" | "FIXED_AMOUNT" | "MANUAL_NEGOTIATION" | "NONE";
export type CustomerContractStatus =
  | "DRAFT"
  | "NEGOTIATING"
  | "PENDING_SIGNATURE"
  | "ACTIVE"
  | "SUSPENDED"
  | "CLOSED"
  | "CANCELLED"
  | "EXPIRED";
export type PaymentPromiseStatus = "OPEN" | "FULFILLED" | "PARTIALLY_FULFILLED" | "NOT_FULFILLED" | "CANCELLED" | "RENEGOTIATED";
export type CollectionChannel = "EMAIL" | "WHATSAPP" | "SMS" | "INTERNAL_NOTIFICATION" | "MANUAL_CALL" | "LETTER" | "OTHER";

export const CUSTOMER_SYSTEM_STATUS_LABELS: Record<CustomerSystemStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_VALIDATION: "Pendente de validação",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  INACTIVE: "Inativo",
};

export const CUSTOMER_LINK_STATUS_LABELS: Record<CustomerLinkStatus, string> = {
  PROSPECT: "Prospect",
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  SUSPENDED: "Suspenso",
  INACTIVE: "Inativo",
};

export const CUSTOMER_FINANCIAL_STATUS_LABELS: Record<CustomerFinancialStatus, string> = {
  ON_TIME: "Em dia",
  ATTENTION: "Atenção",
  OVERDUE: "Em atraso",
  DELINQUENT: "Inadimplente",
  NEGOTIATING: "Em negociação",
  BLOCKED: "Bloqueado",
  SUSPENDED: "Suspenso",
  NO_ACTIVITY: "Sem movimentação",
};

export const CUSTOMER_ADDRESS_TYPE_LABELS: Record<CustomerAddressType, string> = {
  FISCAL: "Fiscal",
  BILLING: "Cobrança",
  DELIVERY: "Entrega",
  OPERATIONAL: "Operacional",
  CORRESPONDENCE: "Correspondência",
};

export const ABC_CLASSIFICATION_LABELS: Record<AbcClassification, string> = {
  A: "A — Alta relevância",
  B: "B — Média relevância",
  C: "C — Baixa relevância",
  NOT_CLASSIFIED: "Não classificado",
};

export const REVENUE_POTENTIAL_LABELS: Record<RevenuePotentialLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  STRATEGIC: "Estratégico",
};

export const RISK_LEVEL_LABELS: Record<CustomerRiskLevel, string> = {
  VERY_LOW: "Muito baixo",
  LOW: "Baixo",
  MODERATE: "Moderado",
  HIGH: "Alto",
  VERY_HIGH: "Muito alto",
  NOT_ASSESSED: "Não avaliado",
};

export const RECURRENCE_PERIODICITY_LABELS: Record<RecurrencePeriodicity, string> = {
  ONCE: "Única",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizada",
};

export const CUSTOMER_PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferência bancária",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  DIRECT_DEBIT: "Débito automático",
  PAYMENT_LINK: "Link de pagamento",
  CHECK: "Cheque",
  OTHER: "Outro",
};

export const CUSTOMER_ORIGIN_LABELS: Record<CustomerOrigin, string> = {
  REFERRAL: "Indicação",
  ACTIVE_PROSPECTING: "Prospecção ativa",
  WEBSITE: "Site",
  SOCIAL_MEDIA: "Redes sociais",
  EVENT: "Evento",
  PARTNER: "Parceiro",
  CAMPAIGN: "Campanha",
  OLD_CUSTOMER: "Cliente antigo",
  SYSTEM_MIGRATION: "Migração de sistema",
  OTHER: "Outro",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  INDIVIDUAL: "Pessoa física",
  PRIVATE_COMPANY: "Empresa privada",
  GOVERNMENT_AGENCY: "Órgão público",
  AUTARCHY: "Autarquia",
  FOUNDATION: "Fundação",
  ASSOCIATION: "Associação",
  CONDOMINIUM: "Condomínio",
  COOPERATIVE: "Cooperativa",
  INDUSTRY: "Indústria",
  COMMERCE: "Comércio",
  SERVICE_PROVIDER: "Prestador de serviço",
  ECONOMIC_GROUP: "Grupo econômico",
  INTERNAL_CUSTOMER: "Cliente interno",
  OTHER: "Outro",
};

export const CUSTOMER_CONTRACT_STATUS_LABELS: Record<CustomerContractStatus, string> = {
  DRAFT: "Rascunho",
  NEGOTIATING: "Em negociação",
  PENDING_SIGNATURE: "Pendente de assinatura",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

export const PAYMENT_PROMISE_STATUS_LABELS: Record<PaymentPromiseStatus, string> = {
  OPEN: "Aberta",
  FULFILLED: "Cumprida",
  PARTIALLY_FULFILLED: "Parcialmente cumprida",
  NOT_FULFILLED: "Não cumprida",
  CANCELLED: "Cancelada",
  RENEGOTIATED: "Renegociada",
};

export const COLLECTION_CHANNEL_LABELS: Record<CollectionChannel, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  INTERNAL_NOTIFICATION: "Notificação interna",
  MANUAL_CALL: "Ligação manual",
  LETTER: "Carta",
  OTHER: "Outro",
};

export interface CustomerAddress {
  id?: string;
  addressType: CustomerAddressType;
  postalCode: string;
  street: string;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city: string;
  state: string;
  country?: string;
  cityCode?: string | null;
  reference?: string | null;
  isPrimary?: boolean;
}

export interface CustomerContact {
  id?: string;
  name: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isPrimary?: boolean;
  isFinancialContact?: boolean;
  isBillingContact?: boolean;
  isContractContact?: boolean;
  isTaxContact?: boolean;
  isOperationalContact?: boolean;
  receivesInvoices?: boolean;
  receivesBilling?: boolean;
  receivesTaxDocuments?: boolean;
  receivesContracts?: boolean;
  receivesReports?: boolean;
}

export interface CustomerCnae {
  id?: string;
  cnaeCode: string;
  description?: string | null;
  isMain?: boolean;
}

export interface CustomerContract {
  id?: string;
  contractNumber?: string | null;
  description?: string | null;
  object?: string | null;
  productService?: string | null;
  planName?: string | null;
  initialValue?: number | null;
  currentValue?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isIndefiniteTerm?: boolean;
  automaticRenewal?: boolean;
  billingFrequency?: RecurrencePeriodicity | null;
  dueDay?: number | null;
  status?: CustomerContractStatus;
  notes?: string | null;
  amendments?: unknown[];
}

export interface CustomerRecurringReceivable {
  id?: string;
  contractId?: string | null;
  description?: string | null;
  amount: number;
  frequency: RecurrencePeriodicity;
  startDate: string;
  endDate?: string | null;
  fixedDueDay?: number | null;
}

export interface CustomerBillingRule {
  id?: string;
  ruleType?: string | null;
  referenceEvent: string;
  daysOffset: number;
  channel: CollectionChannel;
  preferredHour?: number | null;
  automatic?: boolean;
  requiresApproval?: boolean;
  priority?: number;
}

export interface CustomerCompanyLink {
  id: string;
  customerId: string;
  companyId: string;
  company?: { id: string; displayName: string | null; legalName: string | null };
  internalCode?: string | null;
  customerTypes: CustomerType[];
  source?: CustomerOrigin | null;
  defaultRevenueCategoryId?: string | null;
  defaultRevenueCategory?: { id: string; name: string } | null;
  defaultSubcategoryId?: string | null;
  defaultSubcategory?: { id: string; name: string } | null;
  defaultResultCenterId?: string | null;
  defaultResultCenter?: { id: string; name: string } | null;
  defaultAccountingAccount?: string | null;
  defaultProductService?: string | null;
  abcClassification?: AbcClassification;
  revenuePotentialLevel?: RevenuePotentialLevel | null;
  estimatedMonthlyRevenue?: number | null;
  estimatedAnnualRevenue?: number | null;
  estimatedAverageTicket?: number | null;
  estimatedMarginPercentage?: number | null;
  paymentTermDays?: number | null;
  defaultDueDay?: number | null;
  billingFrequency?: RecurrencePeriodicity | null;
  preferredPaymentMethod?: CustomerPaymentMethod | null;
  defaultLateFeePercentage?: number | null;
  defaultMonthlyInterestPercentage?: number | null;
  defaultDiscountPercentage?: number | null;
  earlyPaymentDiscountPercentage?: number | null;
  earlyPaymentDays?: number | null;
  gracePeriodDays?: number | null;
  creditLimit?: number | null;
  riskLevel?: CustomerRiskLevel | null;
  allowOverCreditLimit?: boolean;
  requiresOverLimitApproval?: boolean;
  automaticBlockEnabled?: boolean;
  automaticBlockDays?: number | null;
  autoIdentificationEnabled?: boolean;
  autoRevenueClassificationEnabled?: boolean;
  autoResultCenterEnabled?: boolean;
  receivableSuggestionEnabled?: boolean;
  autoReceivableCreationEnabled?: boolean;
  autoReceiptMatchingEnabled?: boolean;
  confirmationThreshold?: number;
  status: CustomerLinkStatus;
  financialStatus: CustomerFinancialStatus;
  blockReason?: string | null;
  suspensionReason?: string | null;
  internalNotes?: string | null;
  billingRules?: CustomerBillingRule[];
  contracts?: CustomerContract[];
  recurringReceivables?: CustomerRecurringReceivable[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary {
  id: string;
  organizationId: string;
  personType: CustomerPersonType;
  documentNumber: string | null;
  normalizedDocumentNumber: string | null;
  legalName: string | null;
  tradeName: string | null;
  displayName: string | null;
  externalRegistrationStatus: string | null;
  systemStatus: CustomerSystemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Customer extends CustomerSummary {
  stateRegistration: string | null;
  municipalRegistration: string | null;
  openingDate: string | null;
  birthDate: string | null;
  legalNature: string | null;
  companySize: string | null;
  shareCapital: string | null;
  mainCnae: string | null;
  countryCode: string;
  preferredLanguage: string | null;
  segment: string | null;
  foreignDocument: string | null;
  billingCurrency: string | null;
  generalNotes: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  emailFinancial: string | null;
  emailBilling: string | null;
  emailFiscal: string | null;
  website: string | null;
  addresses: CustomerAddress[];
  contacts: CustomerContact[];
  cnaes: CustomerCnae[];
  bankIdentifiers: { id: string; identifierType: string; identifierValue: string }[];
  companyLinks: CustomerCompanyLink[];
}

/** Item de listagem: um vínculo de cliente com uma empresa (a listagem é sempre por empresa). */
export interface CustomerLinkListItem {
  id: string;
  customerId: string;
  companyId: string;
  internalCode: string | null;
  status: CustomerLinkStatus;
  financialStatus: CustomerFinancialStatus;
  defaultRevenueCategory: { id: string; name: string } | null;
  defaultResultCenter: { id: string; name: string } | null;
  creditLimit: number | null;
  updatedAt: string;
  customer: CustomerSummary & { addresses?: CustomerAddress[] };
}

export interface CustomerRegistryData {
  legalName?: string;
  tradeName?: string;
  registrationStatus?: string;
  address?: { postalCode?: string; street?: string; number?: string; district?: string; city?: string; state?: string };
}

export type DocumentQueryCustomerResult =
  | { duplicate: true; customer: { id: string; displayName: string | null; legalName: string | null; systemStatus: CustomerSystemStatus } }
  | { duplicate: false; success: true; provider: string; data: CustomerRegistryData }
  | { duplicate: false; success: false; provider: string; errorCode?: string; errorMessage?: string };

export const DUPLICATE_LINK_ASPECTS = [
  "REVENUE_CATEGORY",
  "SUBCATEGORY",
  "RESULT_CENTER",
  "PRODUCT_SERVICE",
  "PAYMENT_TERMS",
  "PAYMENT_METHOD",
  "INTEREST_AND_FEE_RULES",
  "CREDIT_LIMIT",
  "BILLING_RULES",
  "BANK_IDENTIFIERS",
  "CONTRACTS",
  "RECURRING_RECEIVABLES",
] as const;
export type DuplicateLinkAspect = (typeof DUPLICATE_LINK_ASPECTS)[number];

export const DUPLICATE_LINK_ASPECT_LABELS: Record<DuplicateLinkAspect, string> = {
  REVENUE_CATEGORY: "Categoria de receita",
  SUBCATEGORY: "Subcategoria",
  RESULT_CENTER: "Centro de resultado",
  PRODUCT_SERVICE: "Produto ou serviço",
  PAYMENT_TERMS: "Condição de recebimento",
  PAYMENT_METHOD: "Forma de recebimento",
  INTEREST_AND_FEE_RULES: "Regras de juros e multa",
  CREDIT_LIMIT: "Limite de crédito",
  BILLING_RULES: "Regras de cobrança",
  BANK_IDENTIFIERS: "Identificadores bancários",
  CONTRACTS: "Contratos",
  RECURRING_RECEIVABLES: "Recorrências",
};
