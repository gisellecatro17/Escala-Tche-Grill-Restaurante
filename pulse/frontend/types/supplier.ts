export type SupplierPersonType = "INDIVIDUAL" | "LEGAL_ENTITY" | "FOREIGN";
export type SupplierSystemStatus = "DRAFT" | "PENDING_VALIDATION" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type SupplierLinkStatus = "DRAFT" | "ACTIVE" | "BLOCKED" | "SUSPENDED" | "INACTIVE";
export type SupplierAddressType = "FISCAL" | "COMMERCIAL" | "BILLING" | "CORRESPONDENCE" | "OPERATIONAL";
export type SupplierBankAccountType = "CHECKING" | "SAVINGS" | "PAYMENT" | "DIGITAL" | "THIRD_PARTY" | "OTHER";
export type PixKeyType = "CPF" | "CNPJ" | "PHONE" | "EMAIL" | "RANDOM" | "BANK_DATA";
export type PaymentMethod = "PIX" | "BOLETO" | "BANK_TRANSFER" | "DIRECT_DEBIT" | "CARD" | "CASH" | "CHECK" | "OTHER";
export type FinancialNature =
  | "COST"
  | "EXPENSE"
  | "INVESTMENT"
  | "TAX"
  | "LOAN"
  | "DISTRIBUTION"
  | "REIMBURSEMENT"
  | "ADVANCE"
  | "TRANSFER"
  | "OTHER";
export type TaxWithholdingPolicy = "YES" | "NO" | "EVALUATE_PER_ENTRY";
export type TaxWithholdingType = "INSS" | "IRRF" | "ISS" | "PIS" | "COFINS" | "CSLL" | "OTHER";
export type AllocationType = "PERCENTAGE" | "FIXED_AMOUNT";
export type SupplierContractStatus = "DRAFT" | "UNDER_REVIEW" | "ACTIVE" | "SUSPENDED" | "CLOSED" | "CANCELLED" | "EXPIRED";
export type SupplierType =
  | "MERCHANDISE"
  | "SERVICE"
  | "SERVICE_PROVIDER"
  | "UTILITY_COMPANY"
  | "TAX"
  | "EMPLOYEE"
  | "PARTNER"
  | "FINANCIAL_INSTITUTION"
  | "LANDLORD"
  | "CARRIER"
  | "GOVERNMENT_AGENCY"
  | "FREELANCER"
  | "OCCASIONAL_SUPPLIER"
  | "OTHER";

export const SUPPLIER_SYSTEM_STATUS_LABELS: Record<SupplierSystemStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_VALIDATION: "Pendente de validação",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  INACTIVE: "Inativo",
};

export const SUPPLIER_LINK_STATUS_LABELS: Record<SupplierLinkStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  SUSPENDED: "Suspenso",
  INACTIVE: "Inativo",
};

export const SUPPLIER_ADDRESS_TYPE_LABELS: Record<SupplierAddressType, string> = {
  FISCAL: "Fiscal",
  COMMERCIAL: "Comercial",
  BILLING: "Cobrança",
  CORRESPONDENCE: "Correspondência",
  OPERATIONAL: "Operacional",
};

export const BANK_ACCOUNT_TYPE_LABELS: Record<SupplierBankAccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Conta poupança",
  PAYMENT: "Conta pagamento",
  DIGITAL: "Conta digital",
  THIRD_PARTY: "Conta de terceiros",
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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferência bancária",
  DIRECT_DEBIT: "Débito automático",
  CARD: "Cartão",
  CASH: "Dinheiro",
  CHECK: "Cheque",
  OTHER: "Outro",
};

export const FINANCIAL_NATURE_LABELS: Record<FinancialNature, string> = {
  COST: "Custo",
  EXPENSE: "Despesa",
  INVESTMENT: "Investimento",
  TAX: "Tributo",
  LOAN: "Empréstimo",
  DISTRIBUTION: "Distribuição",
  REIMBURSEMENT: "Reembolso",
  ADVANCE: "Adiantamento",
  TRANSFER: "Transferência",
  OTHER: "Outro",
};

export const TAX_WITHHOLDING_POLICY_LABELS: Record<TaxWithholdingPolicy, string> = {
  YES: "Sim",
  NO: "Não",
  EVALUATE_PER_ENTRY: "Avaliar por lançamento",
};

export const TAX_WITHHOLDING_TYPE_LABELS: Record<TaxWithholdingType, string> = {
  INSS: "INSS",
  IRRF: "IRRF",
  ISS: "ISS",
  PIS: "PIS",
  COFINS: "Cofins",
  CSLL: "CSLL",
  OTHER: "Outra",
};

export const SUPPLIER_CONTRACT_STATUS_LABELS: Record<SupplierContractStatus, string> = {
  DRAFT: "Rascunho",
  UNDER_REVIEW: "Em análise",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  MERCHANDISE: "Mercadoria",
  SERVICE: "Serviço",
  SERVICE_PROVIDER: "Prestador de serviço",
  UTILITY_COMPANY: "Concessionária",
  TAX: "Tributo",
  EMPLOYEE: "Funcionário",
  PARTNER: "Sócio",
  FINANCIAL_INSTITUTION: "Instituição financeira",
  LANDLORD: "Locador",
  CARRIER: "Transportadora",
  GOVERNMENT_AGENCY: "Órgão público",
  FREELANCER: "Profissional autônomo",
  OCCASIONAL_SUPPLIER: "Fornecedor eventual",
  OTHER: "Outro",
};

export interface SupplierAddress {
  id?: string;
  addressType: SupplierAddressType;
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

export interface SupplierContact {
  id?: string;
  name: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isPrimary?: boolean;
  isFinancialContact?: boolean;
  isCommercialContact?: boolean;
  isInvoiceResponsible?: boolean;
  isBillingResponsible?: boolean;
  receivesPaymentReceipts?: boolean;
}

export interface SupplierCnae {
  id?: string;
  cnaeCode: string;
  description?: string | null;
  isMain?: boolean;
}

export interface SupplierBankAccount {
  id?: string;
  financialInstitutionId?: string | null;
  financialInstitution?: { id: string; legalName: string; shortName: string | null } | null;
  branchNumber: string;
  branchDigit?: string | null;
  accountNumber: string;
  accountDigit?: string | null;
  accountType: SupplierBankAccountType;
  holderName: string;
  holderDocument: string;
  isPrimary?: boolean;
  isThirdParty?: boolean;
  thirdPartyReason?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "BLOCKED";
}

export interface SupplierPixKey {
  id?: string;
  pixType: PixKeyType;
  pixKey: string;
  holderName: string;
  holderDocument: string;
  bankAccountId?: string | null;
  isPrimary?: boolean;
  isThirdParty?: boolean;
  thirdPartyReason?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "BLOCKED";
}

export interface SupplierClassificationRule {
  id?: string;
  ruleType?: string | null;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  costCenterId?: string | null;
  priority?: number;
  confidence?: number | null;
  automatic?: boolean;
  requiresConfirmation?: boolean;
}

export interface SupplierAllocation {
  id?: string;
  categoryId?: string | null;
  costCenterId?: string | null;
  allocationType: AllocationType;
  percentage?: number | null;
  fixedAmount?: number | null;
  priority?: number;
}

export interface SupplierTaxWithholding {
  id?: string;
  taxType: TaxWithholdingType;
  rate?: number | null;
  minimumAmount?: number | null;
  calculationBase?: string | null;
  serviceCode?: string | null;
  cityCode?: string | null;
  revenueCode?: string | null;
  automatic?: boolean;
  requiresConfirmation?: boolean;
  notes?: string | null;
}

export interface SupplierContract {
  id?: string;
  contractNumber?: string | null;
  description?: string | null;
  object?: string | null;
  contractValue?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  automaticRenewal?: boolean;
  billingFrequency?: string | null;
  adjustmentIndex?: string | null;
  adjustmentDate?: string | null;
  internalResponsibleId?: string | null;
  supplierContactId?: string | null;
  status?: SupplierContractStatus;
  notes?: string | null;
}

export interface SupplierCompanyLink {
  id: string;
  supplierId: string;
  companyId: string;
  company?: { id: string; displayName: string | null; legalName: string | null };
  internalCode?: string | null;
  supplierTypes: SupplierType[];
  defaultCategoryId?: string | null;
  defaultCategory?: { id: string; name: string } | null;
  defaultSubcategoryId?: string | null;
  defaultSubcategory?: { id: string; name: string } | null;
  defaultCostCenterId?: string | null;
  defaultCostCenter?: { id: string; name: string } | null;
  defaultAccountingAccount?: string | null;
  defaultDescription?: string | null;
  defaultHistory?: string | null;
  financialNature?: FinancialNature | null;
  categoryRequired?: boolean;
  costCenterRequired?: boolean;
  preferredPaymentMethod?: PaymentMethod | null;
  paymentTermDays?: number | null;
  paymentTermFixedDueDay?: number | null;
  paymentTermPeriodicity?: string | null;
  preferredBankAccountId?: string | null;
  preferredPixKeyId?: string | null;
  minimumAmount?: number | null;
  maximumAmountWithoutApproval?: number | null;
  hasContract?: boolean;
  requiresMatchingBeneficiary?: boolean;
  allowsThirdPartyPayment?: boolean;
  taxWithholdingPolicy?: TaxWithholdingPolicy | null;
  allocationEnabled?: boolean;
  autoIdentificationEnabled?: boolean;
  autoClassificationEnabled?: boolean;
  autoCostCenterEnabled?: boolean;
  autoAllocationEnabled?: boolean;
  reconciliationSuggestionEnabled?: boolean;
  autoEntryCreationEnabled?: boolean;
  autoReconciliationEnabled?: boolean;
  confirmationThreshold?: number;
  status: SupplierLinkStatus;
  blockReason?: string | null;
  suspensionReason?: string | null;
  internalNotes?: string | null;
  classificationRules?: SupplierClassificationRule[];
  allocations?: SupplierAllocation[];
  taxWithholdings?: SupplierTaxWithholding[];
  contracts?: SupplierContract[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierSummary {
  id: string;
  organizationId: string;
  personType: SupplierPersonType;
  documentNumber: string | null;
  normalizedDocumentNumber: string | null;
  legalName: string | null;
  tradeName: string | null;
  displayName: string | null;
  externalRegistrationStatus: string | null;
  systemStatus: SupplierSystemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier extends SupplierSummary {
  stateRegistration: string | null;
  municipalRegistration: string | null;
  openingDate: string | null;
  legalNature: string | null;
  companySize: string | null;
  shareCapital: string | null;
  mainCnae: string | null;
  countryCode: string;
  segment: string | null;
  foreignTaxId: string | null;
  foreignCountry: string | null;
  foreignCurrency: string | null;
  generalNotes: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  emailFinancial: string | null;
  emailPaymentReceipts: string | null;
  website: string | null;
  addresses: SupplierAddress[];
  contacts: SupplierContact[];
  cnaes: SupplierCnae[];
  alternativeNames: { id: string; name: string }[];
  bankAccounts: SupplierBankAccount[];
  pixKeys: SupplierPixKey[];
  companyLinks: SupplierCompanyLink[];
}

/** Item de listagem: um vínculo de fornecedor com uma empresa (a listagem é sempre por empresa). */
export interface SupplierLinkListItem {
  id: string;
  supplierId: string;
  companyId: string;
  internalCode: string | null;
  status: SupplierLinkStatus;
  defaultCategory: { id: string; name: string } | null;
  defaultCostCenter: { id: string; name: string } | null;
  autoIdentificationEnabled: boolean;
  updatedAt: string;
  supplier: SupplierSummary & { addresses?: SupplierAddress[] };
}

export interface SupplierRegistryData {
  legalName?: string;
  tradeName?: string;
  registrationStatus?: string;
  address?: { postalCode?: string; street?: string; number?: string; district?: string; city?: string; state?: string };
}

export type DocumentQuerySupplierResult =
  | { duplicate: true; supplier: { id: string; displayName: string | null; legalName: string | null; systemStatus: SupplierSystemStatus } }
  | { duplicate: false; success: true; provider: string; data: SupplierRegistryData }
  | { duplicate: false; success: false; provider: string; errorCode?: string; errorMessage?: string };

export const DUPLICATE_LINK_ASPECTS = [
  "DEFAULT_CATEGORY",
  "DEFAULT_SUBCATEGORY",
  "DEFAULT_COST_CENTER",
  "ACCOUNTING_ACCOUNT",
  "PAYMENT_TERMS",
  "PAYMENT_METHOD",
  "BANK_DATA",
  "PIX_KEYS",
  "TAX_WITHHOLDINGS",
  "ALLOCATIONS",
  "AUTOMATION_RULES",
  "CONTRACTS",
] as const;
export type DuplicateLinkAspect = (typeof DUPLICATE_LINK_ASPECTS)[number];

export const DUPLICATE_LINK_ASPECT_LABELS: Record<DuplicateLinkAspect, string> = {
  DEFAULT_CATEGORY: "Categoria padrão",
  DEFAULT_SUBCATEGORY: "Subcategoria",
  DEFAULT_COST_CENTER: "Centro de custo padrão",
  ACCOUNTING_ACCOUNT: "Conta contábil gerencial",
  PAYMENT_TERMS: "Condição de pagamento",
  PAYMENT_METHOD: "Forma de pagamento",
  BANK_DATA: "Dados bancários",
  PIX_KEYS: "Chaves PIX",
  TAX_WITHHOLDINGS: "Retenções",
  ALLOCATIONS: "Rateios",
  AUTOMATION_RULES: "Regras automáticas",
  CONTRACTS: "Contratos",
};

export interface Category {
  id: string;
  companyId: string;
  parentCategoryId: string | null;
  name: string;
}

export interface CostCenter {
  id: string;
  companyId: string;
  name: string;
}

export interface FinancialInstitution {
  id: string;
  compeCode: string | null;
  ispb: string | null;
  legalName: string;
  shortName: string | null;
}
