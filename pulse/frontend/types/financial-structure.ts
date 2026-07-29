export type RecordStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type AccountPlanType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "COST"
  | "EXPENSE"
  | "RESULT"
  | "COMPENSATION"
  | "OTHER";

export type AccountKind = "SYNTHETIC" | "ANALYTICAL";

export type FinancialNatureKind =
  | "REVENUE"
  | "EXPENSE"
  | "COST"
  | "INVESTMENT"
  | "TAX"
  | "TRANSFER"
  | "REIMBURSEMENT"
  | "LOAN"
  | "FINANCIAL_APPLICATION"
  | "PARTNER_WITHDRAWAL"
  | "CAPITAL_CONTRIBUTION"
  | "OTHER";

export type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type AllocationCriterion =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "QUANTITY"
  | "HOURS"
  | "WEIGHT"
  | "CUSTOM";

export type AllocationTargetType =
  | "COST_CENTER"
  | "RESULT_CENTER"
  | "PROJECT"
  | "BUSINESS_UNIT"
  | "CATEGORY"
  | "ACCOUNT_PLAN";

export type ClassificationMatchType =
  | "CONTAINS"
  | "EQUALS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "REGEX"
  | "AMOUNT_RANGE"
  | "DOCUMENT_NUMBER";

export type ClassificationMatchField =
  | "DESCRIPTION"
  | "COUNTERPARTY_NAME"
  | "COUNTERPARTY_DOCUMENT"
  | "BANK_HISTORY"
  | "AMOUNT"
  | "DOCUMENT_NUMBER";

export type TransactionOrigin =
  | "ANY"
  | "OFX"
  | "PIX"
  | "TED"
  | "DOC"
  | "BOLETO"
  | "CARD"
  | "CASH"
  | "MANUAL";

export type HierarchyEntity =
  | "ACCOUNT_PLAN"
  | "CATEGORY"
  | "COST_CENTER"
  | "RESULT_CENTER"
  | "BUSINESS_UNIT"
  | "PROJECT";

export type StructureImportStatus =
  | "PENDING"
  | "VALIDATED"
  | "APPLIED"
  | "REJECTED"
  | "FAILED";

// ── Rótulos em português ─────────────────────────────────────────────────────

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
};

export const ACCOUNT_PLAN_TYPE_LABELS: Record<AccountPlanType, string> = {
  ASSET: "Ativo",
  LIABILITY: "Passivo",
  EQUITY: "Patrimônio líquido",
  REVENUE: "Receita",
  COST: "Custo",
  EXPENSE: "Despesa",
  RESULT: "Resultado",
  COMPENSATION: "Compensação",
  OTHER: "Outro",
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  SYNTHETIC: "Sintética (agrupadora)",
  ANALYTICAL: "Analítica (aceita lançamentos)",
};

export const FINANCIAL_NATURE_KIND_LABELS: Record<FinancialNatureKind, string> = {
  REVENUE: "Receita",
  EXPENSE: "Despesa",
  COST: "Custo",
  INVESTMENT: "Investimento",
  TAX: "Tributo",
  TRANSFER: "Transferência",
  REIMBURSEMENT: "Reembolso",
  LOAN: "Empréstimo",
  FINANCIAL_APPLICATION: "Aplicação",
  PARTNER_WITHDRAWAL: "Retirada de sócios",
  CAPITAL_CONTRIBUTION: "Aporte",
  OTHER: "Outros",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

export const ALLOCATION_CRITERION_LABELS: Record<AllocationCriterion, string> = {
  PERCENTAGE: "Percentual",
  FIXED_AMOUNT: "Valor",
  QUANTITY: "Quantidade",
  HOURS: "Horas",
  WEIGHT: "Peso",
  CUSTOM: "Critério personalizado",
};

export const ALLOCATION_TARGET_LABELS: Record<AllocationTargetType, string> = {
  COST_CENTER: "Centro de custo",
  RESULT_CENTER: "Centro de resultado",
  PROJECT: "Projeto",
  BUSINESS_UNIT: "Unidade de negócio",
  CATEGORY: "Categoria",
  ACCOUNT_PLAN: "Conta do plano",
};

export const CLASSIFICATION_MATCH_TYPE_LABELS: Record<ClassificationMatchType, string> = {
  CONTAINS: "Contém",
  EQUALS: "É igual a",
  STARTS_WITH: "Começa com",
  ENDS_WITH: "Termina com",
  REGEX: "Expressão regular",
  AMOUNT_RANGE: "Faixa de valor",
  DOCUMENT_NUMBER: "Número do documento",
};

export const CLASSIFICATION_MATCH_FIELD_LABELS: Record<ClassificationMatchField, string> = {
  DESCRIPTION: "Descrição",
  COUNTERPARTY_NAME: "Nome da contraparte",
  COUNTERPARTY_DOCUMENT: "CPF/CNPJ da contraparte",
  BANK_HISTORY: "Histórico bancário",
  AMOUNT: "Valor",
  DOCUMENT_NUMBER: "Número do documento",
};

export const TRANSACTION_ORIGIN_LABELS: Record<TransactionOrigin, string> = {
  ANY: "Qualquer origem",
  OFX: "OFX",
  PIX: "PIX",
  TED: "TED",
  DOC: "DOC",
  BOLETO: "Boleto",
  CARD: "Cartão",
  CASH: "Dinheiro",
  MANUAL: "Manual",
};

export const HIERARCHY_ENTITY_LABELS: Record<HierarchyEntity, string> = {
  ACCOUNT_PLAN: "Plano de contas",
  CATEGORY: "Categorias",
  COST_CENTER: "Centros de custo",
  RESULT_CENTER: "Centros de resultado",
  BUSINESS_UNIT: "Unidades de negócio",
  PROJECT: "Projetos",
};

// ── Entidades ────────────────────────────────────────────────────────────────

/** Campos comuns a todos os nós de árvore da estrutura financeira. */
export interface StructureNode {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  level: number;
  path: string | null;
  notes: string | null;
  isSystem: boolean;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPlan extends StructureNode {
  organizationId: string;
  companyId: string | null;
  parentAccountId: string | null;
  accountType: AccountPlanType;
  accountKind: AccountKind;
  financialNatureId: string | null;
  acceptsEntries: boolean;
}

export interface ResultCenter extends StructureNode {
  companyId: string;
  parentResultCenterId: string | null;
  acceptsEntries: boolean;
  responsibleUserId: string | null;
}

export interface BusinessUnit extends StructureNode {
  organizationId: string;
  companyId: string | null;
  parentBusinessUnitId: string | null;
  responsibleUserId: string | null;
}

export interface CostCenterNode extends StructureNode {
  companyId: string;
  parentCostCenterId: string | null;
  acceptsEntries: boolean;
  responsibleUserId: string | null;
}

export interface CategoryNode extends StructureNode {
  companyId: string;
  parentCategoryId: string | null;
  accountPlanId: string | null;
  financialNatureId: string | null;
  defaultCostCenterId: string | null;
  defaultResultCenterId: string | null;
  defaultProjectId: string | null;
  defaultBusinessUnitId: string | null;
  defaultAllocationRuleId: string | null;
  managementAccount: string | null;
  defaultDescription: string | null;
  defaultHistory: string | null;
  autoClassificationEnabled: boolean;
}

export interface FinancialNature {
  id: string;
  organizationId: string;
  companyId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  kind: FinancialNatureKind;
  affectsResult: boolean;
  affectsCashFlow: boolean;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  status: RecordStatus;
}

export interface FinancialTag {
  id: string;
  organizationId: string;
  companyId: string | null;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  group: string | null;
  usageCount: number;
  status: RecordStatus;
}

export interface Project {
  id: string;
  companyId: string;
  code: string | null;
  name: string;
  description: string | null;
  customerId: string | null;
  customer?: { id: string; displayName: string | null; legalName: string | null } | null;
  costCenterId: string | null;
  costCenter?: { id: string; name: string } | null;
  resultCenterId: string | null;
  resultCenter?: { id: string; name: string } | null;
  businessUnitId: string | null;
  businessUnit?: { id: string; name: string } | null;
  responsibleUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  budgetAmount: string | number | null;
  realizedAmount: string | number | null;
  marginPercentage: string | number | null;
  color: string | null;
  icon: string | null;
  notes: string | null;
  recordStatus: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AllocationRuleLine {
  id?: string;
  targetType: AllocationTargetType;
  costCenterId?: string | null;
  resultCenterId?: string | null;
  projectId?: string | null;
  businessUnitId?: string | null;
  categoryId?: string | null;
  accountPlanId?: string | null;
  percentage?: string | number | null;
  fixedAmount?: string | number | null;
  weight?: string | number | null;
  sortOrder?: number;
  notes?: string | null;
  costCenter?: { id: string; name: string } | null;
  resultCenter?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  businessUnit?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  accountPlan?: { id: string; code: string; name: string } | null;
}

export interface AllocationRule {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  criterion: AllocationCriterion;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  customCriterionLabel: string | null;
  isDefault: boolean;
  status: RecordStatus;
  lines: AllocationRuleLine[];
}

export interface ClassificationRule {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  matchField: ClassificationMatchField;
  matchType: ClassificationMatchType;
  matchValue: string;
  caseSensitive: boolean;
  minAmount: string | number | null;
  maxAmount: string | number | null;
  origin: TransactionOrigin;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  costCenterId: string | null;
  costCenter?: { id: string; name: string } | null;
  resultCenterId: string | null;
  resultCenter?: { id: string; name: string } | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  businessUnitId: string | null;
  businessUnit?: { id: string; name: string } | null;
  financialNatureId: string | null;
  financialNature?: { id: string; name: string; kind: FinancialNatureKind } | null;
  allocationRuleId: string | null;
  allocationRule?: { id: string; name: string } | null;
  appliedDescription: string | null;
  appliedHistory: string | null;
  priority: number;
  confidenceThreshold: number;
  autoApply: boolean;
  matchCount: number;
  status: RecordStatus;
}

export interface SimulationResult {
  matchedCount: number;
  appliedRule: {
    id: string;
    name: string;
    priority: number;
    autoApply: boolean;
    confidenceThreshold: number;
  } | null;
  classification: {
    category: { id: string; name: string } | null;
    accountPlan: { id: string; code: string; name: string } | null;
    costCenter: { id: string; name: string } | null;
    resultCenter: { id: string; name: string } | null;
    project: { id: string; name: string } | null;
    businessUnit: { id: string; name: string } | null;
    financialNature: { id: string; name: string; kind: FinancialNatureKind } | null;
    allocationRule: { id: string; name: string } | null;
    description: string | null;
    history: string | null;
  } | null;
  otherMatches: { id: string; name: string; priority: number }[];
  persisted: boolean;
  note: string;
}

export interface HierarchyVersion {
  id: string;
  entity: HierarchyEntity;
  versionNumber: number;
  label: string | null;
  reason: string | null;
  itemCount: number;
  createdAt: string;
}

export interface StructureImportBatch {
  id: string;
  entity: HierarchyEntity;
  format: string;
  status: StructureImportStatus;
  fileName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdRows: number;
  updatedRows: number;
  errors: { line: number; message: string }[] | null;
  createdAt: string;
}

/** Nó já aninhado, como retornado pelos endpoints `/tree`. */
export interface TreeNode<T> {
  node: T;
  children: TreeNode<T>[];
}
