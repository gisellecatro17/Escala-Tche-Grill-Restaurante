-- CreateEnum
CREATE TYPE "IntakeDocumentType" AS ENUM ('BOLETO', 'INVOICE', 'SERVICE_INVOICE', 'PRODUCT_INVOICE', 'NFSE', 'NFE', 'CTE', 'UTILITY_BILL', 'TAX_GUIDE', 'RECEIPT', 'PAYMENT_RECEIPT', 'CONTRACT', 'PURCHASE_ORDER', 'EXPENSE_REPORT', 'REIMBURSEMENT', 'ADVANCE', 'PAYROLL_DOCUMENT', 'BANK_DOCUMENT', 'BANK_STATEMENT', 'SPREADSHEET', 'XML_DOCUMENT', 'REVENUE_DOCUMENT', 'EXPENSE_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeDocumentDirection" AS ENUM ('PAYABLE', 'RECEIVABLE', 'NEUTRAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IntakeSourceChannel" AS ENUM ('MANUAL_UPLOAD', 'DRAG_AND_DROP', 'CAMERA_CAPTURE', 'BATCH_IMPORT', 'MANUAL_ENTRY', 'EMAIL', 'API', 'EXTERNAL_INTEGRATION', 'WATCHED_FOLDER', 'MOBILE_APP');

-- CreateEnum
CREATE TYPE "IntakeProcessingStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'STORED', 'QUEUED', 'EXTRACTING', 'CLASSIFYING', 'MATCHING', 'VALIDATING_DATA', 'PENDING_REVIEW', 'READY_FOR_PROCESSING', 'PROCESSED', 'ERROR', 'REJECTED', 'DUPLICATE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IntakeReviewStatus" AS ENUM ('NOT_REVIEWED', 'IN_REVIEW', 'REVIEWED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IntakeDuplicateStatus" AS ENUM ('NOT_CHECKED', 'NO_DUPLICATE', 'POSSIBLE_DUPLICATE', 'HIGH_PROBABILITY', 'EXACT_DUPLICATE', 'CONFIRMED_DUPLICATE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IntakePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IntakeFileRole" AS ENUM ('ORIGINAL', 'REPLACEMENT', 'SUPPORTING', 'GENERATED_PREVIEW', 'EXTRACTED_XML', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeExtractionMethod" AS ENUM ('XML_PARSE', 'PDF_TEXT', 'OCR', 'BARCODE', 'DIGITABLE_LINE', 'SPREADSHEET_PARSE', 'FILE_NAME', 'MANUAL_ENTRY', 'RULE_ENGINE', 'REGISTRY_MATCH', 'MANUAL_CORRECTION');

-- CreateEnum
CREATE TYPE "IntakeFieldValidationStatus" AS ENUM ('NOT_VALIDATED', 'VALID', 'INVALID', 'DIVERGENT', 'MANUALLY_CONFIRMED');

-- CreateEnum
CREATE TYPE "IntakeJobType" AS ENUM ('VALIDATE_FILE', 'EXTRACT_DATA', 'CLASSIFY_DOCUMENT', 'IDENTIFY_PARTIES', 'VALIDATE_DATA', 'DETECT_DUPLICATES', 'SUGGEST_CLASSIFICATION', 'FULL_PIPELINE');

-- CreateEnum
CREATE TYPE "IntakeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "IntakeIssueType" AS ENUM ('COMPANY_NOT_IDENTIFIED', 'SUPPLIER_NOT_IDENTIFIED', 'CUSTOMER_NOT_IDENTIFIED', 'UNREADABLE_DOCUMENT', 'AMOUNT_NOT_IDENTIFIED', 'DUE_DATE_NOT_IDENTIFIED', 'DUPLICATE_DOCUMENT', 'INVALID_CODE', 'AMOUNT_DIVERGENCE', 'DUE_DATE_DIVERGENCE', 'HOLDER_DIVERGENCE', 'CATEGORY_MISSING', 'COST_CENTER_REQUIRED', 'PROJECT_REQUIRED', 'WITHHOLDING_PENDING', 'PROTECTED_DOCUMENT', 'CORRUPTED_FILE', 'APPROVAL_REQUIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeIssueSeverity" AS ENUM ('BLOCKING', 'WARNING', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "IntakeIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IntakeDuplicateMatchType" AS ENUM ('FILE_HASH', 'BARCODE', 'DIGITABLE_LINE', 'ACCESS_KEY', 'DOCUMENT_NUMBER', 'AMOUNT_AND_DUE_DATE', 'BENEFICIARY_AND_AMOUNT', 'FILE_NAME', 'CONTENT_SIMILARITY', 'RELATED_DOCUMENT');

-- CreateEnum
CREATE TYPE "IntakeDuplicateDecision" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED', 'REPLACED', 'KEEP_BOTH', 'RELATED');

-- CreateEnum
CREATE TYPE "IntakeRelationType" AS ENUM ('RELATED', 'SUPPORTS', 'REPLACES', 'INSTALLMENT_OF', 'PAYMENT_RECEIPT_OF', 'INVOICE_OF', 'CONTRACT_OF', 'ADDITIONAL_DOCUMENT_OF', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeBatchStatus" AS ENUM ('DRAFT', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntakeBatchItemStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'PROCESSING', 'PROCESSED', 'ERROR', 'SKIPPED');

-- CreateEnum
CREATE TYPE "IntakeAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntakeRejectionReason" AS ENUM ('INVALID_DOCUMENT', 'UNREADABLE_DOCUMENT', 'DUPLICATE_DOCUMENT', 'WRONG_COMPANY', 'CANCELLED_DOCUMENT', 'AMOUNT_DIVERGENCE', 'UNKNOWN_SUPPLIER', 'NOT_FINANCIAL', 'MALICIOUS_FILE', 'OTHER');

-- CreateTable
CREATE TABLE "intake_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "parent_document_id" UUID,
    "supplier_id" UUID,
    "supplier_company_link_id" UUID,
    "customer_id" UUID,
    "customer_company_link_id" UUID,
    "contract_id" UUID,
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "receipt_method_id" UUID,
    "category_id" UUID,
    "subcategory_id" UUID,
    "account_plan_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "financial_nature_id" UUID,
    "document_type" "IntakeDocumentType" NOT NULL DEFAULT 'OTHER',
    "document_direction" "IntakeDocumentDirection" NOT NULL DEFAULT 'UNKNOWN',
    "source_channel" "IntakeSourceChannel" NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "original_file_name" TEXT,
    "display_name" TEXT,
    "storage_path" TEXT,
    "mime_type" TEXT,
    "file_extension" TEXT,
    "file_size" INTEGER,
    "file_hash" TEXT,
    "page_count" INTEGER,
    "language" TEXT,
    "document_number" TEXT,
    "document_series" TEXT,
    "access_key" TEXT,
    "issue_date" TIMESTAMP(3),
    "competence_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "payment_date" TIMESTAMP(3),
    "gross_amount" DECIMAL(18,2),
    "discount_amount" DECIMAL(18,2),
    "interest_amount" DECIMAL(18,2),
    "penalty_amount" DECIMAL(18,2),
    "withholding_amount" DECIMAL(18,2),
    "net_amount" DECIMAL(18,2),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "barcode" TEXT,
    "normalized_barcode" TEXT,
    "digitable_line" TEXT,
    "normalized_digitable_line" TEXT,
    "pix_key" TEXT,
    "issuer_document" TEXT,
    "issuer_name" TEXT,
    "recipient_document" TEXT,
    "recipient_name" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "priority" "IntakePriority" NOT NULL DEFAULT 'NORMAL',
    "processing_status" "IntakeProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "review_status" "IntakeReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "duplicate_status" "IntakeDuplicateStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "confidence" DECIMAL(5,2),
    "company_confidence" DECIMAL(5,2),
    "supplier_confidence" DECIMAL(5,2),
    "customer_confidence" DECIMAL(5,2),
    "type_confidence" DECIMAL(5,2),
    "extracted_text" TEXT,
    "extraction_method" "IntakeExtractionMethod",
    "assigned_user_id" UUID,
    "assigned_team_id" UUID,
    "review_due_at" TIMESTAMP(3),
    "rejection_reason" "IntakeRejectionReason",
    "rejection_notes" TEXT,
    "batch_import_id" UUID,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "forwarded_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "intake_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_files" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "attachment_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "file_role" "IntakeFileRole" NOT NULL DEFAULT 'ORIGINAL',
    "is_original" BOOLEAN NOT NULL DEFAULT true,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "file_name" TEXT,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "file_hash" TEXT,
    "page_count" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_extracted_fields" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "original_value" TEXT,
    "normalized_value" TEXT,
    "data_type" TEXT NOT NULL DEFAULT 'string',
    "source_method" "IntakeExtractionMethod" NOT NULL,
    "confidence" DECIMAL(5,2),
    "validation_status" "IntakeFieldValidationStatus" NOT NULL DEFAULT 'NOT_VALIDATED',
    "is_manually_changed" BOOLEAN NOT NULL DEFAULT false,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3),
    "bounding_box" JSONB,
    "page_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_document_extracted_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_processing_jobs" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "job_type" "IntakeJobType" NOT NULL,
    "queue_name" TEXT NOT NULL DEFAULT 'document-intake',
    "provider" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 0,
    "maximum_attempts" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "IntakeJobStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "worker" TEXT,
    "processing_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_document_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_issues" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "issue_type" "IntakeIssueType" NOT NULL,
    "severity" "IntakeIssueSeverity" NOT NULL DEFAULT 'WARNING',
    "field_name" TEXT,
    "description" TEXT NOT NULL,
    "status" "IntakeIssueStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_user_id" UUID,
    "resolution" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_document_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_duplicate_matches" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "matched_document_id" UUID,
    "matched_entity_type" TEXT,
    "matched_entity_id" UUID,
    "match_type" "IntakeDuplicateMatchType" NOT NULL,
    "similarity_score" DECIMAL(5,2) NOT NULL,
    "matching_fields" JSONB,
    "status" "IntakeDuplicateStatus" NOT NULL DEFAULT 'POSSIBLE_DUPLICATE',
    "decision" "IntakeDuplicateDecision" NOT NULL DEFAULT 'PENDING',
    "decision_reason" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_document_duplicate_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_relations" (
    "id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "target_document_id" UUID NOT NULL,
    "relation_type" "IntakeRelationType" NOT NULL DEFAULT 'RELATED',
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_document_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_batch_imports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "source_channel" "IntakeSourceChannel" NOT NULL DEFAULT 'BATCH_IMPORT',
    "batch_name" TEXT,
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "valid_files" INTEGER NOT NULL DEFAULT 0,
    "invalid_files" INTEGER NOT NULL DEFAULT 0,
    "processed_files" INTEGER NOT NULL DEFAULT 0,
    "error_files" INTEGER NOT NULL DEFAULT 0,
    "status" "IntakeBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "started_by" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_batch_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_batch_import_items" (
    "id" UUID NOT NULL,
    "batch_import_id" UUID NOT NULL,
    "document_id" UUID,
    "original_file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "status" "IntakeBatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_batch_import_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_assignments" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "assigned_team_id" UUID,
    "due_at" TIMESTAMP(3),
    "reason" TEXT,
    "assigned_by" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "IntakeAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_document_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_document_status_history" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "previous_processing_status" "IntakeProcessingStatus",
    "new_processing_status" "IntakeProcessingStatus",
    "previous_review_status" "IntakeReviewStatus",
    "new_review_status" "IntakeReviewStatus",
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_document_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_intake_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "maximum_file_size" INTEGER NOT NULL DEFAULT 20971520,
    "maximum_files_per_upload" INTEGER NOT NULL DEFAULT 20,
    "allowed_extensions" TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png', 'xml', 'xlsx', 'xls', 'csv']::TEXT[],
    "ocr_enabled" BOOLEAN NOT NULL DEFAULT true,
    "barcode_reading_enabled" BOOLEAN NOT NULL DEFAULT true,
    "duplicate_validation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "minimum_confidence" DECIMAL(5,2) NOT NULL DEFAULT 75,
    "high_confidence_threshold" DECIMAL(5,2) NOT NULL DEFAULT 95,
    "mandatory_review" BOOLEAN NOT NULL DEFAULT true,
    "auto_forward_high_confidence" BOOLEAN NOT NULL DEFAULT false,
    "quick_supplier_creation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quick_customer_creation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "require_category" BOOLEAN NOT NULL DEFAULT false,
    "require_cost_center" BOOLEAN NOT NULL DEFAULT false,
    "require_project" BOOLEAN NOT NULL DEFAULT false,
    "block_duplicates" BOOLEAN NOT NULL DEFAULT true,
    "block_invalid_barcode" BOOLEAN NOT NULL DEFAULT true,
    "review_deadline_hours" INTEGER NOT NULL DEFAULT 24,
    "retention_days" INTEGER NOT NULL DEFAULT 1825,
    "allow_file_replacement" BOOLEAN NOT NULL DEFAULT true,
    "allow_draft_deletion" BOOLEAN NOT NULL DEFAULT true,
    "default_assigned_user_id" UUID,
    "default_assigned_team_id" UUID,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_intake_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intake_documents_organization_id_company_id_idx" ON "intake_documents"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "intake_documents_company_id_processing_status_idx" ON "intake_documents"("company_id", "processing_status");

-- CreateIndex
CREATE INDEX "intake_documents_file_hash_idx" ON "intake_documents"("file_hash");

-- CreateIndex
CREATE INDEX "intake_documents_normalized_barcode_idx" ON "intake_documents"("normalized_barcode");

-- CreateIndex
CREATE INDEX "intake_documents_normalized_digitable_line_idx" ON "intake_documents"("normalized_digitable_line");

-- CreateIndex
CREATE INDEX "intake_documents_access_key_idx" ON "intake_documents"("access_key");

-- CreateIndex
CREATE INDEX "intake_documents_supplier_id_idx" ON "intake_documents"("supplier_id");

-- CreateIndex
CREATE INDEX "intake_documents_customer_id_idx" ON "intake_documents"("customer_id");

-- CreateIndex
CREATE INDEX "intake_documents_due_date_idx" ON "intake_documents"("due_date");

-- CreateIndex
CREATE INDEX "intake_documents_assigned_user_id_idx" ON "intake_documents"("assigned_user_id");

-- CreateIndex
CREATE INDEX "intake_documents_parent_document_id_idx" ON "intake_documents"("parent_document_id");

-- CreateIndex
CREATE INDEX "intake_document_files_document_id_idx" ON "intake_document_files"("document_id");

-- CreateIndex
CREATE INDEX "intake_document_files_file_hash_idx" ON "intake_document_files"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "intake_document_files_document_id_version_number_file_role_key" ON "intake_document_files"("document_id", "version_number", "file_role");

-- CreateIndex
CREATE INDEX "intake_document_extracted_fields_document_id_idx" ON "intake_document_extracted_fields"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "intake_document_extracted_fields_document_id_field_name_key" ON "intake_document_extracted_fields"("document_id", "field_name");

-- CreateIndex
CREATE INDEX "intake_document_processing_jobs_status_available_at_idx" ON "intake_document_processing_jobs"("status", "available_at");

-- CreateIndex
CREATE INDEX "intake_document_processing_jobs_document_id_idx" ON "intake_document_processing_jobs"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "intake_document_processing_jobs_idempotency_key_key" ON "intake_document_processing_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "intake_document_issues_document_id_status_idx" ON "intake_document_issues"("document_id", "status");

-- CreateIndex
CREATE INDEX "intake_document_duplicate_matches_document_id_idx" ON "intake_document_duplicate_matches"("document_id");

-- CreateIndex
CREATE INDEX "intake_document_duplicate_matches_matched_document_id_idx" ON "intake_document_duplicate_matches"("matched_document_id");

-- CreateIndex
CREATE INDEX "intake_document_relations_source_document_id_idx" ON "intake_document_relations"("source_document_id");

-- CreateIndex
CREATE INDEX "intake_document_relations_target_document_id_idx" ON "intake_document_relations"("target_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "intake_document_relations_source_document_id_target_documen_key" ON "intake_document_relations"("source_document_id", "target_document_id", "relation_type");

-- CreateIndex
CREATE INDEX "intake_batch_imports_organization_id_company_id_idx" ON "intake_batch_imports"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "intake_batch_import_items_batch_import_id_idx" ON "intake_batch_import_items"("batch_import_id");

-- CreateIndex
CREATE INDEX "intake_document_assignments_document_id_idx" ON "intake_document_assignments"("document_id");

-- CreateIndex
CREATE INDEX "intake_document_assignments_assigned_user_id_idx" ON "intake_document_assignments"("assigned_user_id");

-- CreateIndex
CREATE INDEX "intake_document_status_history_document_id_idx" ON "intake_document_status_history"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_intake_settings_company_id_key" ON "document_intake_settings"("company_id");

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_batch_import_id_fkey" FOREIGN KEY ("batch_import_id") REFERENCES "intake_batch_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_files" ADD CONSTRAINT "intake_document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_files" ADD CONSTRAINT "intake_document_files_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_extracted_fields" ADD CONSTRAINT "intake_document_extracted_fields_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_processing_jobs" ADD CONSTRAINT "intake_document_processing_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_issues" ADD CONSTRAINT "intake_document_issues_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_duplicate_matches" ADD CONSTRAINT "intake_document_duplicate_matches_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_duplicate_matches" ADD CONSTRAINT "intake_document_duplicate_matches_matched_document_id_fkey" FOREIGN KEY ("matched_document_id") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_relations" ADD CONSTRAINT "intake_document_relations_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_relations" ADD CONSTRAINT "intake_document_relations_target_document_id_fkey" FOREIGN KEY ("target_document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_batch_imports" ADD CONSTRAINT "intake_batch_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_batch_imports" ADD CONSTRAINT "intake_batch_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_batch_import_items" ADD CONSTRAINT "intake_batch_import_items_batch_import_id_fkey" FOREIGN KEY ("batch_import_id") REFERENCES "intake_batch_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_batch_import_items" ADD CONSTRAINT "intake_batch_import_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_assignments" ADD CONSTRAINT "intake_document_assignments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_document_status_history" ADD CONSTRAINT "intake_document_status_history_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "intake_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_intake_settings" ADD CONSTRAINT "document_intake_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_intake_settings" ADD CONSTRAINT "document_intake_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

