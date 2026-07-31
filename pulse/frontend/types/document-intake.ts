import type { RecordStatus } from "./financial-structure";

export type IntakeDocumentType =
  | "BOLETO"
  | "INVOICE"
  | "SERVICE_INVOICE"
  | "PRODUCT_INVOICE"
  | "NFSE"
  | "NFE"
  | "CTE"
  | "UTILITY_BILL"
  | "TAX_GUIDE"
  | "RECEIPT"
  | "PAYMENT_RECEIPT"
  | "CONTRACT"
  | "PURCHASE_ORDER"
  | "EXPENSE_REPORT"
  | "REIMBURSEMENT"
  | "ADVANCE"
  | "PAYROLL_DOCUMENT"
  | "BANK_DOCUMENT"
  | "BANK_STATEMENT"
  | "SPREADSHEET"
  | "XML_DOCUMENT"
  | "REVENUE_DOCUMENT"
  | "EXPENSE_DOCUMENT"
  | "OTHER";

export type IntakeDocumentDirection = "PAYABLE" | "RECEIVABLE" | "NEUTRAL" | "UNKNOWN";

export type IntakeSourceChannel =
  | "MANUAL_UPLOAD"
  | "DRAG_AND_DROP"
  | "CAMERA_CAPTURE"
  | "BATCH_IMPORT"
  | "MANUAL_ENTRY"
  | "EMAIL"
  | "API"
  | "EXTERNAL_INTEGRATION"
  | "WATCHED_FOLDER"
  | "MOBILE_APP";

export type IntakeProcessingStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "STORED"
  | "QUEUED"
  | "EXTRACTING"
  | "CLASSIFYING"
  | "MATCHING"
  | "VALIDATING_DATA"
  | "PENDING_REVIEW"
  | "READY_FOR_PROCESSING"
  | "PROCESSED"
  | "ERROR"
  | "REJECTED"
  | "DUPLICATE"
  | "ARCHIVED";

export type IntakeReviewStatus =
  | "NOT_REVIEWED"
  | "IN_REVIEW"
  | "REVIEWED"
  | "CHANGES_REQUESTED"
  | "REJECTED";

export type IntakeDuplicateStatus =
  | "NOT_CHECKED"
  | "NO_DUPLICATE"
  | "POSSIBLE_DUPLICATE"
  | "HIGH_PROBABILITY"
  | "EXACT_DUPLICATE"
  | "CONFIRMED_DUPLICATE"
  | "DISMISSED";

export type IntakePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type IntakeExtractionMethod =
  | "XML_PARSE"
  | "PDF_TEXT"
  | "OCR"
  | "BARCODE"
  | "DIGITABLE_LINE"
  | "SPREADSHEET_PARSE"
  | "FILE_NAME"
  | "MANUAL_ENTRY"
  | "RULE_ENGINE"
  | "REGISTRY_MATCH"
  | "MANUAL_CORRECTION";

export type IntakeFieldValidationStatus =
  | "NOT_VALIDATED"
  | "VALID"
  | "INVALID"
  | "DIVERGENT"
  | "MANUALLY_CONFIRMED";

export type IntakeIssueType =
  | "COMPANY_NOT_IDENTIFIED"
  | "SUPPLIER_NOT_IDENTIFIED"
  | "CUSTOMER_NOT_IDENTIFIED"
  | "UNREADABLE_DOCUMENT"
  | "AMOUNT_NOT_IDENTIFIED"
  | "DUE_DATE_NOT_IDENTIFIED"
  | "DUPLICATE_DOCUMENT"
  | "INVALID_CODE"
  | "AMOUNT_DIVERGENCE"
  | "DUE_DATE_DIVERGENCE"
  | "HOLDER_DIVERGENCE"
  | "CATEGORY_MISSING"
  | "COST_CENTER_REQUIRED"
  | "PROJECT_REQUIRED"
  | "WITHHOLDING_PENDING"
  | "PROTECTED_DOCUMENT"
  | "CORRUPTED_FILE"
  | "APPROVAL_REQUIRED"
  | "OTHER";

export type IntakeIssueSeverity = "BLOCKING" | "WARNING" | "INFORMATIONAL";
export type IntakeIssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export type IntakeDuplicateMatchType =
  | "FILE_HASH"
  | "BARCODE"
  | "DIGITABLE_LINE"
  | "ACCESS_KEY"
  | "DOCUMENT_NUMBER"
  | "AMOUNT_AND_DUE_DATE"
  | "BENEFICIARY_AND_AMOUNT"
  | "FILE_NAME"
  | "CONTENT_SIMILARITY"
  | "RELATED_DOCUMENT";

export type IntakeDuplicateDecision =
  | "PENDING"
  | "CONFIRMED"
  | "DISMISSED"
  | "REPLACED"
  | "KEEP_BOTH"
  | "RELATED";

export type IntakeRelationType =
  | "RELATED"
  | "SUPPORTS"
  | "REPLACES"
  | "INSTALLMENT_OF"
  | "PAYMENT_RECEIPT_OF"
  | "INVOICE_OF"
  | "CONTRACT_OF"
  | "ADDITIONAL_DOCUMENT_OF"
  | "OTHER";

export type IntakeRejectionReason =
  | "INVALID_DOCUMENT"
  | "UNREADABLE_DOCUMENT"
  | "DUPLICATE_DOCUMENT"
  | "WRONG_COMPANY"
  | "CANCELLED_DOCUMENT"
  | "AMOUNT_DIVERGENCE"
  | "UNKNOWN_SUPPLIER"
  | "NOT_FINANCIAL"
  | "MALICIOUS_FILE"
  | "OTHER";

export type IntakeJobType =
  | "VALIDATE_FILE"
  | "EXTRACT_DATA"
  | "CLASSIFY_DOCUMENT"
  | "IDENTIFY_PARTIES"
  | "VALIDATE_DATA"
  | "DETECT_DUPLICATES"
  | "SUGGEST_CLASSIFICATION"
  | "FULL_PIPELINE";

export type IntakeJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "DEAD_LETTER";

// ── Rótulos em português ─────────────────────────────────────────────────────

export const DOCUMENT_TYPE_LABELS: Record<IntakeDocumentType, string> = {
  BOLETO: "Boleto",
  INVOICE: "Fatura",
  SERVICE_INVOICE: "Nota fiscal de serviço",
  PRODUCT_INVOICE: "Nota fiscal de produto",
  NFSE: "NFS-e",
  NFE: "NF-e",
  CTE: "CT-e",
  UTILITY_BILL: "Conta de consumo",
  TAX_GUIDE: "Guia tributária",
  RECEIPT: "Recibo",
  PAYMENT_RECEIPT: "Comprovante de pagamento",
  CONTRACT: "Contrato",
  PURCHASE_ORDER: "Ordem de compra",
  EXPENSE_REPORT: "Relatório de despesa",
  REIMBURSEMENT: "Reembolso",
  ADVANCE: "Adiantamento",
  PAYROLL_DOCUMENT: "Documento de folha",
  BANK_DOCUMENT: "Documento bancário",
  BANK_STATEMENT: "Extrato bancário",
  SPREADSHEET: "Planilha",
  XML_DOCUMENT: "Documento XML",
  REVENUE_DOCUMENT: "Documento de receita",
  EXPENSE_DOCUMENT: "Documento de despesa",
  OTHER: "Outro",
};

export const DOCUMENT_DIRECTION_LABELS: Record<IntakeDocumentDirection, string> = {
  PAYABLE: "A pagar",
  RECEIVABLE: "A receber",
  NEUTRAL: "Sem efeito financeiro",
  UNKNOWN: "Não definido",
};

export const SOURCE_CHANNEL_LABELS: Record<IntakeSourceChannel, string> = {
  MANUAL_UPLOAD: "Upload manual",
  DRAG_AND_DROP: "Arrastar e soltar",
  CAMERA_CAPTURE: "Captura por câmera",
  BATCH_IMPORT: "Importação em lote",
  MANUAL_ENTRY: "Digitação manual",
  EMAIL: "E-mail",
  API: "API",
  EXTERNAL_INTEGRATION: "Integração externa",
  WATCHED_FOLDER: "Pasta monitorada",
  MOBILE_APP: "Aplicativo móvel",
};

/** Canais que ainda não têm implementação — a estrutura existe, a conexão não. */
export const UNCONFIGURED_CHANNELS: IntakeSourceChannel[] = [
  "EMAIL",
  "API",
  "EXTERNAL_INTEGRATION",
  "WATCHED_FOLDER",
  "MOBILE_APP",
];

export const PROCESSING_STATUS_LABELS: Record<IntakeProcessingStatus, string> = {
  UPLOADED: "Enviado",
  VALIDATING: "Validando",
  STORED: "Armazenado",
  QUEUED: "Na fila",
  EXTRACTING: "Extraindo dados",
  CLASSIFYING: "Classificando",
  MATCHING: "Identificando vínculos",
  VALIDATING_DATA: "Validando informações",
  PENDING_REVIEW: "Aguardando revisão",
  READY_FOR_PROCESSING: "Pronto para processamento",
  PROCESSED: "Processado",
  ERROR: "Com erro",
  REJECTED: "Rejeitado",
  DUPLICATE: "Duplicado",
  ARCHIVED: "Arquivado",
};

export const REVIEW_STATUS_LABELS: Record<IntakeReviewStatus, string> = {
  NOT_REVIEWED: "Não revisado",
  IN_REVIEW: "Em revisão",
  REVIEWED: "Revisado",
  CHANGES_REQUESTED: "Ajustes solicitados",
  REJECTED: "Rejeitado",
};

export const DUPLICATE_STATUS_LABELS: Record<IntakeDuplicateStatus, string> = {
  NOT_CHECKED: "Não verificado",
  NO_DUPLICATE: "Sem duplicidade",
  POSSIBLE_DUPLICATE: "Possível duplicidade",
  HIGH_PROBABILITY: "Alta probabilidade",
  EXACT_DUPLICATE: "Duplicidade exata",
  CONFIRMED_DUPLICATE: "Duplicidade confirmada",
  DISMISSED: "Liberado",
};

export const PRIORITY_LABELS: Record<IntakePriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const EXTRACTION_METHOD_LABELS: Record<IntakeExtractionMethod, string> = {
  XML_PARSE: "Leitura de XML",
  PDF_TEXT: "Texto do PDF",
  OCR: "OCR",
  BARCODE: "Código de barras",
  DIGITABLE_LINE: "Linha digitável",
  SPREADSHEET_PARSE: "Leitura de planilha",
  FILE_NAME: "Nome do arquivo",
  MANUAL_ENTRY: "Digitação manual",
  RULE_ENGINE: "Regra de classificação",
  REGISTRY_MATCH: "Cadastro",
  MANUAL_CORRECTION: "Correção manual",
};

export const ISSUE_TYPE_LABELS: Record<IntakeIssueType, string> = {
  COMPANY_NOT_IDENTIFIED: "Empresa não identificada",
  SUPPLIER_NOT_IDENTIFIED: "Fornecedor não identificado",
  CUSTOMER_NOT_IDENTIFIED: "Cliente não identificado",
  UNREADABLE_DOCUMENT: "Documento ilegível",
  AMOUNT_NOT_IDENTIFIED: "Valor não identificado",
  DUE_DATE_NOT_IDENTIFIED: "Vencimento não identificado",
  DUPLICATE_DOCUMENT: "Documento duplicado",
  INVALID_CODE: "Código inválido",
  AMOUNT_DIVERGENCE: "Divergência de valor",
  DUE_DATE_DIVERGENCE: "Divergência de vencimento",
  HOLDER_DIVERGENCE: "Titularidade divergente",
  CATEGORY_MISSING: "Categoria ausente",
  COST_CENTER_REQUIRED: "Centro de custo obrigatório",
  PROJECT_REQUIRED: "Projeto obrigatório",
  WITHHOLDING_PENDING: "Retenção pendente",
  PROTECTED_DOCUMENT: "Documento protegido",
  CORRUPTED_FILE: "Arquivo corrompido",
  APPROVAL_REQUIRED: "Aprovação necessária",
  OTHER: "Outro",
};

export const ISSUE_SEVERITY_LABELS: Record<IntakeIssueSeverity, string> = {
  BLOCKING: "Bloqueante",
  WARNING: "Atenção",
  INFORMATIONAL: "Informativa",
};

export const DUPLICATE_MATCH_TYPE_LABELS: Record<IntakeDuplicateMatchType, string> = {
  FILE_HASH: "Arquivo idêntico",
  BARCODE: "Código de barras igual",
  DIGITABLE_LINE: "Linha digitável igual",
  ACCESS_KEY: "Chave fiscal igual",
  DOCUMENT_NUMBER: "Número e emitente iguais",
  AMOUNT_AND_DUE_DATE: "Valor e vencimento iguais",
  BENEFICIARY_AND_AMOUNT: "Beneficiário, valor e vencimento iguais",
  FILE_NAME: "Nome do arquivo igual",
  CONTENT_SIMILARITY: "Conteúdo semelhante",
  RELATED_DOCUMENT: "Documento relacionado",
};

export const RELATION_TYPE_LABELS: Record<IntakeRelationType, string> = {
  RELATED: "Relacionado",
  SUPPORTS: "Documento de apoio",
  REPLACES: "Substitui",
  INSTALLMENT_OF: "Parcela de",
  PAYMENT_RECEIPT_OF: "Comprovante de",
  INVOICE_OF: "Nota fiscal de",
  CONTRACT_OF: "Contrato de",
  ADDITIONAL_DOCUMENT_OF: "Documento adicional de",
  OTHER: "Outro",
};

export const REJECTION_REASON_LABELS: Record<IntakeRejectionReason, string> = {
  INVALID_DOCUMENT: "Documento inválido",
  UNREADABLE_DOCUMENT: "Documento ilegível",
  DUPLICATE_DOCUMENT: "Documento duplicado",
  WRONG_COMPANY: "Empresa incorreta",
  CANCELLED_DOCUMENT: "Documento cancelado",
  AMOUNT_DIVERGENCE: "Valor divergente",
  UNKNOWN_SUPPLIER: "Fornecedor desconhecido",
  NOT_FINANCIAL: "Não pertence ao financeiro",
  MALICIOUS_FILE: "Arquivo malicioso",
  OTHER: "Outro",
};

export const JOB_TYPE_LABELS: Record<IntakeJobType, string> = {
  VALIDATE_FILE: "Validação do arquivo",
  EXTRACT_DATA: "Extração de dados",
  CLASSIFY_DOCUMENT: "Classificação",
  IDENTIFY_PARTIES: "Identificação de vínculos",
  VALIDATE_DATA: "Validação dos dados",
  DETECT_DUPLICATES: "Detecção de duplicidade",
  SUGGEST_CLASSIFICATION: "Classificação financeira",
  FULL_PIPELINE: "Pipeline completo",
};

export const JOB_STATUS_LABELS: Record<IntakeJobStatus, string> = {
  PENDING: "Pendente",
  RUNNING: "Em execução",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  DEAD_LETTER: "Na fila de erro",
};

/** Rótulos dos campos extraídos, para a tela de revisão. */
export const EXTRACTED_FIELD_LABELS: Record<string, string> = {
  documentNumber: "Número do documento",
  documentSeries: "Série",
  accessKey: "Chave de acesso",
  issuerDocument: "Documento do emitente",
  issuerName: "Emitente",
  recipientDocument: "Documento do destinatário",
  recipientName: "Destinatário",
  issueDate: "Emissão",
  competenceDate: "Competência",
  dueDate: "Vencimento",
  grossAmount: "Valor bruto",
  discountAmount: "Desconto",
  withholdingAmount: "Retenções",
  netAmount: "Valor líquido",
  barcode: "Código de barras",
  digitableLine: "Linha digitável",
  pixKey: "Chave PIX",
  description: "Descrição",
};

// ── Faixas de confiança (seção 32) ───────────────────────────────────────────

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "NONE";

/** As faixas do prompt: alta 95-100, média 75-94,99, baixa abaixo de 75. */
export function confidenceBand(confidence: number | string | null | undefined): ConfidenceBand {
  if (confidence === null || confidence === undefined) return "NONE";
  const value = Number(confidence);
  if (!Number.isFinite(value) || value <= 0) return "NONE";
  if (value >= 95) return "HIGH";
  if (value >= 75) return "MEDIUM";
  return "LOW";
}

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  HIGH: "Alta confiança",
  MEDIUM: "Média confiança",
  LOW: "Baixa confiança",
  NONE: "Não extraído",
};

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface IntakeDocumentSummary {
  id: string;
  legalName?: string | null;
  tradeName?: string | null;
  documentNumber?: string | null;
}

export interface IntakeDocument {
  id: string;
  organizationId: string;
  companyId: string | null;
  company?: { id: string; legalName: string | null; tradeName: string | null } | null;
  parentDocumentId: string | null;
  parentDocument?: { id: string; originalFileName: string | null } | null;

  supplierId: string | null;
  supplier?: IntakeDocumentSummary | null;
  customerId: string | null;
  customer?: IntakeDocumentSummary | null;

  documentType: IntakeDocumentType;
  documentDirection: IntakeDocumentDirection;
  sourceChannel: IntakeSourceChannel;

  originalFileName: string | null;
  displayName: string | null;
  mimeType: string | null;
  fileExtension: string | null;
  fileSize: number | null;
  fileHash: string | null;
  pageCount: number | null;

  documentNumber: string | null;
  documentSeries: string | null;
  accessKey: string | null;
  issueDate: string | null;
  competenceDate: string | null;
  dueDate: string | null;
  paymentDate: string | null;

  grossAmount: string | number | null;
  discountAmount: string | number | null;
  interestAmount: string | number | null;
  penaltyAmount: string | number | null;
  withholdingAmount: string | number | null;
  netAmount: string | number | null;
  currencyCode: string;

  /** Chega mascarado quando falta `document_intake.view_sensitive_data`. */
  barcode: string | null;
  digitableLine: string | null;
  pixKey: string | null;
  issuerDocument: string | null;
  issuerName: string | null;
  recipientDocument: string | null;
  recipientName: string | null;

  description: string | null;
  notes: string | null;

  priority: IntakePriority;
  processingStatus: IntakeProcessingStatus;
  reviewStatus: IntakeReviewStatus;
  duplicateStatus: IntakeDuplicateStatus;

  confidence: string | number | null;
  companyConfidence: string | number | null;
  supplierConfidence: string | number | null;
  customerConfidence: string | number | null;
  typeConfidence: string | number | null;

  extractedText: string | null;
  extractionMethod: IntakeExtractionMethod | null;

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

  assignedUserId: string | null;
  reviewDueAt: string | null;
  rejectionReason: IntakeRejectionReason | null;
  rejectionNotes: string | null;

  receivedAt: string;
  processedAt: string | null;
  forwardedAt: string | null;
  rejectedAt: string | null;
  archivedAt: string | null;

  _count?: {
    issues: number;
    duplicateMatches: number;
    files: number;
    extractedFields: number;
  };

  files?: IntakeDocumentFile[];
  extractedFields?: IntakeExtractedField[];
  issues?: IntakeIssue[];
  statusHistory?: IntakeStatusHistoryEntry[];
  installments?: {
    id: string;
    documentNumber: string | null;
    dueDate: string | null;
    grossAmount: string | number | null;
  }[];
}

export interface IntakeDocumentFile {
  id: string;
  documentId: string;
  versionNumber: number;
  fileRole: string;
  isOriginal: boolean;
  isCurrent: boolean;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  fileHash: string | null;
  pageCount: number | null;
  createdAt: string;
}

export interface IntakeExtractedField {
  id: string;
  documentId: string;
  fieldName: string;
  originalValue: string | null;
  normalizedValue: string | null;
  dataType: string;
  sourceMethod: IntakeExtractionMethod;
  confidence: string | number | null;
  validationStatus: IntakeFieldValidationStatus;
  isManuallyChanged: boolean;
  changedBy: string | null;
  changedAt: string | null;
  pageNumber: number | null;
}

export interface IntakeIssue {
  id: string;
  documentId: string;
  issueType: IntakeIssueType;
  severity: IntakeIssueSeverity;
  fieldName: string | null;
  description: string;
  status: IntakeIssueStatus;
  assignedUserId: string | null;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface IntakeDuplicateMatch {
  id: string;
  documentId: string;
  matchedDocumentId: string | null;
  matchType: IntakeDuplicateMatchType;
  similarityScore: string | number;
  matchingFields: string[] | null;
  status: IntakeDuplicateStatus;
  decision: IntakeDuplicateDecision;
  decisionReason: string | null;
  decidedAt: string | null;
  matchedDocument?: {
    id: string;
    originalFileName: string | null;
    documentType: IntakeDocumentType;
    documentNumber: string | null;
    issuerName: string | null;
    issuerDocument: string | null;
    grossAmount: string | number | null;
    netAmount: string | number | null;
    dueDate: string | null;
    issueDate: string | null;
    processingStatus: IntakeProcessingStatus;
    receivedAt: string;
  } | null;
}

export interface IntakeDuplicateComparison {
  matchId: string;
  matchType: IntakeDuplicateMatchType;
  similarityScore: number;
  requiresJustificationToDismiss: boolean;
  fields: {
    label: string;
    current: string | null;
    existing: string | null;
    equal: boolean;
  }[];
}

export interface IntakeRelation {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationType: IntakeRelationType;
  notes: string | null;
  createdAt: string;
  sourceDocument?: {
    id: string;
    originalFileName: string | null;
    documentType: IntakeDocumentType;
  };
  targetDocument?: {
    id: string;
    originalFileName: string | null;
    documentType: IntakeDocumentType;
  };
}

export interface IntakeStatusHistoryEntry {
  id: string;
  documentId: string;
  previousProcessingStatus: IntakeProcessingStatus | null;
  newProcessingStatus: IntakeProcessingStatus | null;
  previousReviewStatus: IntakeReviewStatus | null;
  newReviewStatus: IntakeReviewStatus | null;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface IntakeProcessingJob {
  id: string;
  documentId: string;
  jobType: IntakeJobType;
  queueName: string;
  attemptNumber: number;
  maximumAttempts: number;
  priority: number;
  status: IntakeJobStatus;
  availableAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  worker: string | null;
  createdAt: string;
}

export interface IntakeBatchImport {
  id: string;
  organizationId: string;
  companyId: string | null;
  batchName: string | null;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  processedFiles: number;
  errorFiles: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface DocumentIntakeSettings {
  id: string;
  organizationId: string;
  companyId: string;
  maximumFileSize: number;
  maximumFilesPerUpload: number;
  allowedExtensions: string[];
  ocrEnabled: boolean;
  barcodeReadingEnabled: boolean;
  duplicateValidationEnabled: boolean;
  minimumConfidence: string | number;
  highConfidenceThreshold: string | number;
  mandatoryReview: boolean;
  autoForwardHighConfidence: boolean;
  quickSupplierCreationEnabled: boolean;
  quickCustomerCreationEnabled: boolean;
  requireCategory: boolean;
  requireCostCenter: boolean;
  requireProject: boolean;
  blockDuplicates: boolean;
  blockInvalidBarcode: boolean;
  reviewDeadlineHours: number;
  retentionDays: number;
  allowFileReplacement: boolean;
  allowDraftDeletion: boolean;
  defaultAssignedUserId: string | null;
  defaultAssignedTeamId: string | null;
  notificationsEnabled: boolean;
}

export interface DocumentIntakeOverview {
  cards: {
    awaitingProcessing: number;
    processing: number;
    pendingReview: number;
    possibleDuplicates: number;
    processedToday: number;
    withError: number;
    unassignedCompany: number;
  };
  issues: Record<IntakeIssueSeverity, number>;
  queue: {
    pending: number;
    running: number;
    deadLetter: number;
    cancelled: number;
    oldestPending: { availableAt: string; jobType: IntakeJobType; documentId: string } | null;
  };
  indicators: {
    averageProcessingSeconds: number | null;
    recognizedPercentage: number | null;
    supplierIdentifiedPercentage: number | null;
    divergencePercentage: number | null;
  };
  byChannel: { channel: IntakeSourceChannel; count: number }[];
  byStatus: { status: IntakeProcessingStatus; count: number }[];
  recentErrors: { id: string; originalFileName: string | null; receivedAt: string }[];
  lastBatches: IntakeBatchImport[];
  note: string;
}

export interface BoletoValidationResult {
  valid: boolean;
  segment: "BANK" | "UTILITY" | null;
  barcode: string | null;
  digitableLine: string | null;
  bankCode: string | null;
  currencyCode: string | null;
  amount: number | null;
  dueDate: string | null;
  dueDateFactor: number | null;
  ambiguousDueDate: boolean;
  ambiguousCandidates: string[];
  errors: string[];
  warnings: string[];
  rulesApplied: string[];
}

export interface UploadResult {
  document: IntakeDocument;
  warnings: string[];
  detectedKind: string;
  antivirus: { verdict: string; scanned: boolean; provider: string };
}

export interface BatchUploadResult {
  batch: IntakeBatchImport;
  accepted: number;
  rejected: { fileName: string; reason: string }[];
}

export interface BatchActionResult {
  total: number;
  succeeded: number;
  failed: { documentId: string; reason: string }[];
  note?: string;
}

export type { RecordStatus };
