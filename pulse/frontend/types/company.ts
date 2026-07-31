export type PersonType = "INDIVIDUAL" | "LEGAL_ENTITY";
export type EstablishmentType = "HEADQUARTERS" | "BRANCH" | "OPERATING_UNIT";
export type CompanySystemStatus = "DRAFT" | "IMPLEMENTATION" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "CLOSED";
export type TaxRegime = "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL" | "MEI" | "IMUNE" | "ISENTA" | "OUTRO";
export type AccountingCriterion = "ACCRUAL" | "CASH" | "MIXED" | "NOT_INFORMED";
export type CompanyAddressType = "FISCAL" | "OPERATIONAL" | "BILLING" | "CORRESPONDENCE";
export type CompanyContactType =
  | "PRIMARY"
  | "FINANCIAL"
  | "FISCAL"
  | "ACCOUNTING"
  | "ADMINISTRATIVE"
  | "OPERATIONAL"
  | "OTHER";

export const COMPANY_SYSTEM_STATUS_LABELS: Record<CompanySystemStatus, string> = {
  DRAFT: "Rascunho",
  IMPLEMENTATION: "Em implantação",
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  INACTIVE: "Inativa",
  CLOSED: "Encerrada",
};

export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  HEADQUARTERS: "Matriz",
  BRANCH: "Filial",
  OPERATING_UNIT: "Unidade operacional",
};

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  MEI: "MEI",
  IMUNE: "Imune",
  ISENTA: "Isenta",
  OUTRO: "Outro",
};

export const ACCOUNTING_CRITERION_LABELS: Record<AccountingCriterion, string> = {
  ACCRUAL: "Regime de competência",
  CASH: "Regime de caixa",
  MIXED: "Misto",
  NOT_INFORMED: "Não informado",
};

export const ADDRESS_TYPE_LABELS: Record<CompanyAddressType, string> = {
  FISCAL: "Fiscal",
  OPERATIONAL: "Operacional",
  BILLING: "Cobrança",
  CORRESPONDENCE: "Correspondência",
};

export const CONTACT_TYPE_LABELS: Record<CompanyContactType, string> = {
  PRIMARY: "Principal",
  FINANCIAL: "Financeiro",
  FISCAL: "Fiscal",
  ACCOUNTING: "Contábil",
  ADMINISTRATIVE: "Administrativo",
  OPERATIONAL: "Operacional",
  OTHER: "Outro",
};

export interface CompanyAddress {
  id?: string;
  addressType: CompanyAddressType;
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
  sameAsAddressId?: string | null;
}

export interface CompanyContact {
  id?: string;
  contactType: CompanyContactType;
  name: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isPrimary?: boolean;
}

export interface CompanyCnae {
  id?: string;
  cnaeCode: string;
  description?: string | null;
  isMain?: boolean;
}

export interface CompanyStatusHistoryEntry {
  id: string;
  previousStatus: CompanySystemStatus | null;
  newStatus: CompanySystemStatus;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface CompanySummary {
  id: string;
  organizationId: string;
  parentCompanyId: string | null;
  internalCode: string | null;
  personType: PersonType;
  documentNumber: string | null;
  normalizedDocumentNumber: string | null;
  legalName: string | null;
  tradeName: string | null;
  displayName: string | null;
  establishmentType: EstablishmentType;
  externalRegistrationStatus: string | null;
  systemStatus: CompanySystemStatus;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  addresses?: CompanyAddress[];
}

export interface Company extends CompanySummary {
  externalRegistrationStatusDate: string | null;
  implementationStartDate: string | null;
  deactivationReason: string | null;
  suspensionReason: string | null;
  registrationNotes: string | null;
  openingDate: string | null;
  legalNature: string | null;
  companySize: string | null;
  shareCapital: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  mainCnae: string | null;
  email: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  whatsapp: string | null;
  emailFinancial: string | null;
  emailFiscal: string | null;
  website: string | null;
  taxRegime: TaxRegime | null;
  taxAssessmentMethod: AccountingCriterion | null;
  icmsTaxpayer: boolean | null;
  simplesNacionalOptant: boolean | null;
  simplesNacionalOptionDate: string | null;
  simplesNacionalExclusionDate: string | null;
  specialTaxRegime: string | null;
  accountingFirmName: string | null;
  accountingResponsibleName: string | null;
  taxNotes: string | null;
  currencyCode: string;
  dateFormat: string;
  timezone: string;
  financialMethod: AccountingCriterion;
  financialMonthStartDay: number;
  monthClosingDay: number;
  allowRetroactiveEntries: boolean;
  allowFutureEntries: boolean;
  requiresCategory: boolean;
  requiresCostCenter: boolean;
  requiresSupplier: boolean;
  requiresCustomer: boolean;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  approvalLevels: number;
  automaticCodeEnabled: boolean;
  addresses: CompanyAddress[];
  contacts: CompanyContact[];
  cnaes: CompanyCnae[];
  parentCompany: { id: string; displayName: string | null; legalName: string | null } | null;
  branches: { id: string; displayName: string | null; legalName: string | null; systemStatus: CompanySystemStatus }[];
  statusHistory: CompanyStatusHistoryEntry[];
}

export interface CompanyFormValues {
  organizationId: string;
  parentCompanyId?: string;
  internalCode?: string;
  personType: PersonType;
  documentNumber: string;
  legalName: string;
  tradeName?: string;
  displayName: string;
  establishmentType: EstablishmentType;
  implementationStartDate?: string;
  registrationNotes?: string;

  openingDate?: string;
  legalNature?: string;
  companySize?: string;
  shareCapital?: number;
  stateRegistration?: string;
  municipalRegistration?: string;
  cnaes: CompanyCnae[];

  addresses: CompanyAddress[];

  phone?: string;
  phoneSecondary?: string;
  whatsapp?: string;
  email?: string;
  emailFinancial?: string;
  emailFiscal?: string;
  website?: string;
  contacts: CompanyContact[];

  taxRegime?: TaxRegime;
  taxAssessmentMethod?: AccountingCriterion;
  icmsTaxpayer?: boolean;
  simplesNacionalOptant?: boolean;
  simplesNacionalOptionDate?: string;
  simplesNacionalExclusionDate?: string;
  specialTaxRegime?: string;
  accountingFirmName?: string;
  accountingResponsibleName?: string;
  taxNotes?: string;

  currencyCode: string;
  dateFormat: string;
  timezone: string;
  financialMethod: AccountingCriterion;
  financialMonthStartDay: number;
  monthClosingDay: number;
  allowRetroactiveEntries: boolean;
  allowFutureEntries: boolean;
  requiresCategory: boolean;
  requiresCostCenter: boolean;
  requiresSupplier: boolean;
  requiresCustomer: boolean;
  requiresAttachment: boolean;
  requiresApproval: boolean;
  approvalLevels: number;
  automaticCodeEnabled: boolean;
}

export interface CompanyRegistryData {
  documentNumber: string;
  legalName?: string;
  tradeName?: string;
  openingDate?: string;
  registrationStatus?: string;
  registrationStatusDate?: string;
  legalNature?: string;
  companySize?: string;
  shareCapital?: number;
  establishmentType?: "HEADQUARTERS" | "BRANCH";
  mainCnae?: { code: string; description: string };
  secondaryCnaes?: { code: string; description: string }[];
  address?: {
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    cityCode?: string;
    state?: string;
  };
  phone?: string;
  email?: string;
}

export type DocumentQueryResult =
  | { duplicate: true; company: { id: string; displayName: string | null; systemStatus: CompanySystemStatus } }
  | { duplicate: false; success: true; provider: string; data: CompanyRegistryData }
  | { duplicate: false; success: false; provider: string; errorCode?: string; errorMessage?: string };

export interface PostalCodeResult {
  success: boolean;
  provider: string;
  data?: {
    postalCode: string;
    street?: string;
    district?: string;
    city?: string;
    cityCode?: string;
    state?: string;
  };
  errorMessage?: string;
}

export interface CompanyUserMembership {
  id: string;
  userId: string;
  companyId: string;
  roleId: string;
  status: RecordStatusForMembership;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string; slug: string };
  createdAt: string;
}

type RecordStatusForMembership = "ACTIVE" | "INACTIVE" | "BLOCKED";

export const DUPLICATE_SETTINGS_ASPECTS = [
  "CATEGORIES",
  "COST_CENTERS",
  "PAYMENT_METHODS",
  "FINANCIAL_PARAMETERS",
  "ACCESS_PROFILES",
  "APPROVAL_RULES",
  "RECONCILIATION_RULES",
] as const;

export type DuplicateSettingsAspect = (typeof DUPLICATE_SETTINGS_ASPECTS)[number];

export const DUPLICATE_SETTINGS_ASPECT_LABELS: Record<DuplicateSettingsAspect, string> = {
  CATEGORIES: "Categorias financeiras",
  COST_CENTERS: "Centros de custo",
  PAYMENT_METHODS: "Formas de pagamento",
  FINANCIAL_PARAMETERS: "Parâmetros financeiros",
  ACCESS_PROFILES: "Perfis de acesso",
  APPROVAL_RULES: "Regras de aprovação",
  RECONCILIATION_RULES: "Regras de conciliação",
};
