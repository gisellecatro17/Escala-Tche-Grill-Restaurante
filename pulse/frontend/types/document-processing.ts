import type { IntakeDocument } from "@/types/document-intake";

export type FinancialEntryDirection = "PAYABLE" | "RECEIVABLE";

export type FinancialEntryOrigin =
  | "DOCUMENT_INTAKE"
  | "MANUAL"
  | "RECURRENCE"
  | "CONTRACT";

export type FinancialEntryStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "OPEN"
  | "CANCELLED";

export type FinancialEntryInstallmentStatus = "OPEN" | "CANCELLED";

export type FinancialEntryDimensionSource =
  | "CLASSIFICATION_RULE"
  | "SUPPLIER_DEFAULT"
  | "CUSTOMER_DEFAULT"
  | "CATEGORY_DEFAULT"
  | "DOCUMENT"
  | "MANUAL";

export type FinancialEntryWithholdingStatus =
  | "SUGGESTED"
  | "CONFIRMED"
  | "DISMISSED";

export type TaxWithholdingType =
  | "INSS"
  | "IRRF"
  | "ISS"
  | "PIS"
  | "COFINS"
  | "CSLL"
  | "OTHER";

export type AllocationTargetType =
  | "COST_CENTER"
  | "RESULT_CENTER"
  | "PROJECT"
  | "BUSINESS_UNIT"
  | "CATEGORY"
  | "ACCOUNT_PLAN";

export const ENTRY_DIRECTION_LABELS: Record<FinancialEntryDirection, string> = {
  PAYABLE: "A pagar",
  RECEIVABLE: "A receber",
};

export const ENTRY_ORIGIN_LABELS: Record<FinancialEntryOrigin, string> = {
  DOCUMENT_INTAKE: "Documento recebido",
  MANUAL: "Lançamento manual",
  RECURRENCE: "Recorrência",
  CONTRACT: "Contrato",
};

export const ENTRY_STATUS_LABELS: Record<FinancialEntryStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Aguardando conferência",
  OPEN: "Em aberto",
  CANCELLED: "Cancelado",
};

/**
 * Explicação de cada situação.
 *
 * Vale a pena escrever por extenso: "rascunho" e "em aberto" parecem sinônimos para quem
 * não conhece o fluxo, e a diferença é justamente a que decide se o título já é dívida.
 */
export const ENTRY_STATUS_HINTS: Record<FinancialEntryStatus, string> = {
  DRAFT: "Ainda editável. Não conta como obrigação em nenhum relatório.",
  PENDING_APPROVAL:
    "Ficou acima do limite e aguarda conferência dos dados. Não é autorização de pagamento.",
  OPEN: "É a obrigação financeira. Nada foi pago: liquidação é de outro módulo.",
  CANCELLED: "Cancelado com motivo. O registro permanece e o documento voltou para a fila.",
};

export const DIMENSION_SOURCE_LABELS: Record<
  FinancialEntryDimensionSource,
  string
> = {
  CLASSIFICATION_RULE: "Regra automática",
  SUPPLIER_DEFAULT: "Padrão do fornecedor",
  CUSTOMER_DEFAULT: "Padrão do cliente",
  CATEGORY_DEFAULT: "Padrão da categoria",
  DOCUMENT: "Definido no documento",
  MANUAL: "Escolhido na tela",
};

export const WITHHOLDING_STATUS_LABELS: Record<
  FinancialEntryWithholdingStatus,
  string
> = {
  SUGGESTED: "Sugerida",
  CONFIRMED: "Confirmada",
  DISMISSED: "Descartada",
};

export const TAX_TYPE_LABELS: Record<TaxWithholdingType, string> = {
  INSS: "INSS",
  IRRF: "IRRF",
  ISS: "ISS",
  PIS: "PIS",
  COFINS: "COFINS",
  CSLL: "CSLL",
  OTHER: "Outra",
};

export const ALLOCATION_TARGET_LABELS: Record<AllocationTargetType, string> = {
  COST_CENTER: "Centro de custo",
  RESULT_CENTER: "Centro de resultado",
  PROJECT: "Projeto",
  BUSINESS_UNIT: "Unidade de negócio",
  CATEGORY: "Categoria",
  ACCOUNT_PLAN: "Plano de contas",
};

export const DIMENSION_LABELS: Record<string, string> = {
  categoryId: "Categoria",
  subcategoryId: "Subcategoria",
  accountPlanId: "Plano de contas",
  costCenterId: "Centro de custo",
  resultCenterId: "Centro de resultado",
  projectId: "Projeto",
  businessUnitId: "Unidade de negócio",
  financialNatureId: "Natureza financeira",
};

interface PartySummary {
  id: string;
  legalName: string | null;
  tradeName: string | null;
}

export interface FinancialEntryInstallment {
  id: string;
  entryId: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  grossAmount: string | number;
  discountAmount: string | number;
  netAmount: string | number;
  barcode: string | null;
  digitableLine: string | null;
  status: FinancialEntryInstallmentStatus;
  notes: string | null;
}

export interface FinancialEntryAllocation {
  id: string;
  entryId: string;
  targetType: AllocationTargetType;
  costCenterId: string | null;
  resultCenterId: string | null;
  projectId: string | null;
  businessUnitId: string | null;
  categoryId: string | null;
  accountPlanId: string | null;
  percentage: string | number;
  amount: string | number;
  sortOrder: number;
  notes: string | null;
}

export interface FinancialEntryWithholding {
  id: string;
  entryId: string;
  supplierTaxWithholdingId: string | null;
  taxType: TaxWithholdingType;
  calculationBase: string | number;
  rate: string | number;
  amount: string | number;
  minimumAmount: string | number | null;
  status: FinancialEntryWithholdingStatus;
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface FinancialEntryStatusHistoryEntry {
  id: string;
  entryId: string;
  previousStatus: FinancialEntryStatus | null;
  newStatus: FinancialEntryStatus;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface FinancialEntry {
  id: string;
  organizationId: string;
  companyId: string;
  company?: PartySummary | null;

  sourceIntakeDocumentId: string | null;
  sourceIntakeDocument?: {
    id: string;
    originalFileName: string | null;
    displayName: string | null;
  } | null;

  direction: FinancialEntryDirection;
  origin: FinancialEntryOrigin;
  status: FinancialEntryStatus;

  supplierId: string | null;
  supplier?: PartySummary | null;
  customerId: string | null;
  customer?: PartySummary | null;

  documentNumber: string | null;
  documentSeries: string | null;
  accessKey: string | null;
  issueDate: string | null;
  competenceDate: string | null;

  description: string | null;
  history: string | null;
  notes: string | null;

  grossAmount: string | number;
  discountAmount: string | number;
  interestAmount: string | number;
  penaltyAmount: string | number;
  withholdingAmount: string | number;
  netAmount: string | number;
  currencyCode: string;

  categoryId: string | null;
  subcategoryId: string | null;
  accountPlanId: string | null;
  costCenterId: string | null;
  resultCenterId: string | null;
  projectId: string | null;
  businessUnitId: string | null;
  financialNatureId: string | null;

  appliedClassificationRuleId: string | null;
  appliedAllocationRuleId: string | null;
  classificationSources: Record<string, FinancialEntryDimensionSource> | null;

  financialAccountId: string | null;
  paymentMethodId: string | null;
  receiptMethodId: string | null;

  /** Chega mascarado quando falta `document_intake.view_sensitive_data`. */
  barcode: string | null;
  digitableLine: string | null;
  pixKey: string | null;

  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;

  cancellationReason: string | null;
  cancelledAt: string | null;
  openedAt: string | null;
  createdAt: string;
  updatedAt: string;

  installments?: FinancialEntryInstallment[];
  allocations?: FinancialEntryAllocation[];
  withholdings?: FinancialEntryWithholding[];
  statusHistory?: FinancialEntryStatusHistoryEntry[];
}

/** O que o processamento faria, sem gravar nada. */
export interface ProcessingPreview {
  document: {
    id: string;
    documentNumber: string | null;
    displayName: string | null;
    grossAmount: number | null;
    dueDate: string | null;
  };
  direction: FinancialEntryDirection;
  supplierCompanyLinkId: string | null;
  customerCompanyLinkId: string | null;
  classification: {
    values: Record<string, string | null>;
    sources: Record<string, FinancialEntryDimensionSource>;
    appliedClassificationRuleId: string | null;
    appliedAllocationRuleId: string | null;
    description: string | null;
    history: string | null;
  };
  description: string | null;
  history: string | null;
  amounts: {
    gross: number;
    discount: number;
    interest: number;
    penalty: number;
    withholding: number;
    net: number;
  };
  suggestedWithholdingTotal: number;
  withholdings: {
    supplierTaxWithholdingId: string;
    taxType: TaxWithholdingType;
    calculationBase: number;
    rate: number;
    amount: number;
    minimumAmount: number | null;
  }[];
  installments: {
    installmentNumber: number;
    totalInstallments: number;
    dueDate: string;
    grossAmount: number;
    netAmount: number;
    barcode: string | null;
    digitableLine: string | null;
  }[];
  allocations: {
    targetType: AllocationTargetType;
    costCenterId: string | null;
    resultCenterId: string | null;
    projectId: string | null;
    businessUnitId: string | null;
    categoryId: string | null;
    accountPlanId: string | null;
    percentage: number;
    amount: number;
    sortOrder: number;
  }[];
  requiresApproval: boolean;
}

export interface FinancialEntrySummary {
  payable: { count: number; total: number };
  receivable: { count: number; total: number };
  pendingEntries: number;
  withholdingsToConfirm: number;
  note: string;
}

export interface DocumentProcessingSettings {
  id: string;
  organizationId: string;
  companyId: string;
  autoClassificationEnabled: boolean;
  autoAllocationEnabled: boolean;
  autoWithholdingEnabled: boolean;
  autoOpenWhenComplete: boolean;
  approvalThresholdAmount: string | number | null;
  requireCategory: boolean;
  requireCostCenter: boolean;
  requireProject: boolean;
  blockInstallmentMismatch: boolean;
  defaultPaymentTermDays: number;
}

/** Item da fila do processamento — é um documento da entrada, não um lançamento. */
export type ProcessingQueueItem = IntakeDocument;
