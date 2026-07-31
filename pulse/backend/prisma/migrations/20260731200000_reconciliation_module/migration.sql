-- CreateEnum
CREATE TYPE "bank_statement_source_type" AS ENUM ('OFX', 'CSV', 'XLSX', 'MANUAL', 'CNAB_RETURN', 'OPEN_FINANCE', 'BANK_API', 'EXTERNAL_INTEGRATION');

-- CreateEnum
CREATE TYPE "bank_statement_import_status" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'PARSING', 'NORMALIZING', 'CHECKING_DUPLICATES', 'READY_TO_IMPORT', 'IMPORTING', 'IMPORTED', 'PARTIALLY_IMPORTED', 'FAILED', 'CANCELLED', 'REPROCESSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "bank_transaction_type" AS ENUM ('CREDIT', 'DEBIT', 'PIX_IN', 'PIX_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'BOLETO_PAYMENT', 'BOLETO_RECEIPT', 'TED_IN', 'TED_OUT', 'DOC_IN', 'DOC_OUT', 'BANK_FEE', 'TAX_PAYMENT', 'PAYROLL', 'CARD_SETTLEMENT', 'LOAN', 'FINANCIAL_INVESTMENT', 'FINANCIAL_REDEMPTION', 'INTEREST', 'PENALTY', 'REFUND', 'REVERSAL', 'CHARGEBACK', 'CASH_DEPOSIT', 'CHECK', 'INTERNAL_TRANSFER', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "bank_transaction_direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "bank_transaction_reconciliation_status" AS ENUM ('IMPORTED', 'AVAILABLE', 'MATCH_SUGGESTED', 'PARTIALLY_MATCHED', 'MATCHED', 'MANUALLY_MATCHED', 'UNIDENTIFIED', 'IGNORED', 'DUPLICATE', 'REVERSED', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "duplicate_status" AS ENUM ('NOT_DUPLICATE', 'POSSIBLE', 'HIGH_PROBABILITY', 'EXACT');

-- CreateEnum
CREATE TYPE "reconcilable_entity_type" AS ENUM ('ACCOUNTS_PAYABLE', 'ACCOUNTS_PAYABLE_INSTALLMENT', 'PAYMENT_SCHEDULE', 'PAYMENT_BATCH', 'ACCOUNTS_PAYABLE_PAYMENT', 'INTERNAL_TRANSFER', 'MANUAL_ADJUSTMENT', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_RECEIVABLE_INSTALLMENT', 'RECEIPT', 'BANK_FEE', 'FINANCIAL_INVESTMENT', 'SUPPLIER_ADVANCE', 'PAYROLL', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "match_confidence_level" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "match_suggestion_status" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "reconciliation_type" AS ENUM ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'PARTIAL', 'TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "reconciliation_status" AS ENUM ('ACTIVE', 'UNMATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "reconciliation_history_action" AS ENUM ('FILE_UPLOADED', 'FILE_VALIDATED', 'FILE_IMPORTED', 'FILE_REPROCESSED', 'FILE_CANCELLED', 'FILE_ARCHIVED', 'FILE_DOWNLOADED', 'DUPLICATE_DETECTED', 'DUPLICATE_OVERRIDDEN', 'TRANSACTION_IMPORTED', 'TRANSACTION_NORMALIZED', 'TRANSACTION_MANUAL_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_IGNORED', 'TRANSACTION_REPROCESSED', 'SUGGESTIONS_GENERATED', 'SUGGESTION_ACCEPTED', 'SUGGESTION_DISMISSED', 'MATCHED', 'PARTIALLY_MATCHED', 'UNMATCHED', 'ASSIGNED', 'ADJUSTMENT_CREATED', 'SETTINGS_CHANGED');

-- CreateEnum
CREATE TYPE "reconciliation_comment_visibility" AS ENUM ('INTERNAL', 'SHARED');

-- CreateTable
CREATE TABLE "bank_statement_imports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "attachment_id" UUID,
    "import_template_id" UUID,
    "sourceType" "bank_statement_source_type" NOT NULL,
    "original_file_name" TEXT,
    "storage_path" TEXT,
    "mime_type" TEXT,
    "file_extension" TEXT,
    "file_size" INTEGER,
    "file_hash" TEXT,
    "bank_code" TEXT,
    "agency_number" TEXT,
    "account_number" TEXT,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "statement_start_date" TIMESTAMP(3),
    "statement_end_date" TIMESTAMP(3),
    "opening_balance" DECIMAL(18,2),
    "closing_balance" DECIMAL(18,2),
    "calculated_closing_balance" DECIMAL(18,2),
    "total_credits" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_debits" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "valid_transaction_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_transaction_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_transaction_count" INTEGER NOT NULL DEFAULT 0,
    "status" "bank_statement_import_status" NOT NULL DEFAULT 'UPLOADED',
    "error_code" TEXT,
    "error_message" TEXT,
    "import_metadata" JSONB,
    "duplicate_override_reason" TEXT,
    "duplicate_of_import_id" UUID,
    "imported_by" UUID,
    "validated_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3),
    "reprocessed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "statement_import_id" UUID,
    "sourceType" "bank_statement_source_type" NOT NULL,
    "external_transaction_id" TEXT,
    "fit_id" TEXT,
    "transaction_code" TEXT,
    "transaction_type" "bank_transaction_type" NOT NULL DEFAULT 'UNKNOWN',
    "direction" "bank_transaction_direction" NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "posting_date" TIMESTAMP(3),
    "value_date" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "running_balance" DECIMAL(18,2),
    "document_number" TEXT,
    "check_number" TEXT,
    "reference_number" TEXT,
    "original_description" TEXT NOT NULL,
    "normalized_description" TEXT,
    "payer_name" TEXT,
    "payer_document" TEXT,
    "payee_name" TEXT,
    "payee_document" TEXT,
    "bank_code" TEXT,
    "agency_number" TEXT,
    "account_number" TEXT,
    "pix_end_to_end_id" TEXT,
    "barcode" TEXT,
    "digitable_line" TEXT,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "manual_reason" TEXT,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_status" "duplicate_status" NOT NULL DEFAULT 'NOT_DUPLICATE',
    "duplicate_of_transaction_id" UUID,
    "reconciliation_status" "bank_transaction_reconciliation_status" NOT NULL DEFAULT 'IMPORTED',
    "reconciled_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unidentified_reason" TEXT,
    "ignored_reason" TEXT,
    "assigned_user_id" UUID,
    "raw_data" JSONB,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_import_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "financial_account_id" UUID,
    "name" TEXT NOT NULL,
    "bank_code" TEXT,
    "file_type" "bank_statement_source_type" NOT NULL,
    "delimiter" VARCHAR(4),
    "encoding" VARCHAR(20),
    "date_format" VARCHAR(20),
    "decimal_separator" VARCHAR(2),
    "thousand_separator" VARCHAR(2),
    "header_row" INTEGER,
    "data_start_row" INTEGER,
    "footer_rows_to_ignore" INTEGER NOT NULL DEFAULT 0,
    "column_mapping" JSONB NOT NULL,
    "sign_rule" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_statement_import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_match_suggestions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_transaction_id" UUID NOT NULL,
    "candidate_entity_type" "reconcilable_entity_type" NOT NULL,
    "candidate_entity_id" UUID NOT NULL,
    "score" DECIMAL(6,2) NOT NULL,
    "confidence_level" "match_confidence_level" NOT NULL,
    "matching_criteria" JSONB NOT NULL,
    "difference_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "difference_days" INTEGER NOT NULL DEFAULT 0,
    "status" "match_suggestion_status" NOT NULL DEFAULT 'PENDING',
    "generated_by" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "dismissal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_match_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "reconciliation_type" "reconciliation_type" NOT NULL,
    "status" "reconciliation_status" NOT NULL DEFAULT 'ACTIVE',
    "total_bank_amount" DECIMAL(18,2) NOT NULL,
    "total_system_amount" DECIMAL(18,2) NOT NULL,
    "difference_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_partial" BOOLEAN NOT NULL DEFAULT false,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "confidence_score" DECIMAL(6,2),
    "difference_reason" TEXT,
    "notes" TEXT,
    "reconciled_by" UUID,
    "reconciled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unmatched_by" UUID,
    "unmatched_at" TIMESTAMP(3),
    "unmatch_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_items" (
    "id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "bank_transaction_id" UUID NOT NULL,
    "entity_type" "reconcilable_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "bank_amount" DECIMAL(18,2) NOT NULL,
    "allocated_amount" DECIMAL(18,2) NOT NULL,
    "difference_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "relation_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID,
    "bank_transaction_id" UUID,
    "reconciliation_id" UUID,
    "statement_import_id" UUID,
    "action_type" "reconciliation_history_action" NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT,
    "details" JSONB,
    "reason" TEXT,
    "performed_by" UUID,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "device_info" TEXT,

    CONSTRAINT "reconciliation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_transaction_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "assigned_team" TEXT,
    "due_at" TIMESTAMP(3),
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_comments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_transaction_id" UUID,
    "reconciliation_id" UUID,
    "statement_import_id" UUID,
    "comment" TEXT NOT NULL,
    "visibility" "reconciliation_comment_visibility" NOT NULL DEFAULT 'INTERNAL',
    "attachments" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reconciliation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_import_types" "bank_statement_source_type"[],
    "maximum_file_size" INTEGER NOT NULL DEFAULT 15728640,
    "duplicate_check_enabled" BOOLEAN NOT NULL DEFAULT true,
    "block_duplicates" BOOLEAN NOT NULL DEFAULT true,
    "amount_tolerance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "percentage_tolerance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "date_tolerance_days" INTEGER NOT NULL DEFAULT 3,
    "minimum_suggestion_score" DECIMAL(6,2) NOT NULL DEFAULT 60,
    "mandatory_review" BOOLEAN NOT NULL DEFAULT true,
    "automatic_matching_enabled" BOOLEAN NOT NULL DEFAULT false,
    "partial_match_enabled" BOOLEAN NOT NULL DEFAULT true,
    "multiple_match_enabled" BOOLEAN NOT NULL DEFAULT true,
    "manual_adjustment_enabled" BOOLEAN NOT NULL DEFAULT true,
    "manual_transaction_enabled" BOOLEAN NOT NULL DEFAULT true,
    "unmatch_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reconciliation_deadline_days" INTEGER,
    "default_assigned_user_id" UUID,
    "default_assigned_team" TEXT,
    "automatic_reprocessing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "closing_required" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statement_imports_organization_id_company_id_status_idx" ON "bank_statement_imports"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "bank_statement_imports_financial_account_id_statement_start_idx" ON "bank_statement_imports"("financial_account_id", "statement_start_date");

-- CreateIndex
CREATE INDEX "bank_statement_imports_file_hash_idx" ON "bank_statement_imports"("file_hash");

-- CreateIndex
CREATE INDEX "bank_transactions_organization_id_company_id_reconciliation_idx" ON "bank_transactions"("organization_id", "company_id", "reconciliation_status");

-- CreateIndex
CREATE INDEX "bank_transactions_financial_account_id_transaction_date_idx" ON "bank_transactions"("financial_account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "bank_transactions_statement_import_id_idx" ON "bank_transactions"("statement_import_id");

-- CreateIndex
CREATE INDEX "bank_transactions_fit_id_idx" ON "bank_transactions"("fit_id");

-- CreateIndex
CREATE INDEX "bank_transactions_amount_transaction_date_idx" ON "bank_transactions"("amount", "transaction_date");

-- CreateIndex
CREATE INDEX "bank_statement_import_templates_organization_id_company_id_idx" ON "bank_statement_import_templates"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "bank_statement_import_templates_bank_code_idx" ON "bank_statement_import_templates"("bank_code");

-- CreateIndex
CREATE INDEX "reconciliation_match_suggestions_organization_id_company_id_idx" ON "reconciliation_match_suggestions"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "reconciliation_match_suggestions_bank_transaction_id_score_idx" ON "reconciliation_match_suggestions"("bank_transaction_id", "score");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_match_suggestions_bank_transaction_id_candid_key" ON "reconciliation_match_suggestions"("bank_transaction_id", "candidate_entity_type", "candidate_entity_id");

-- CreateIndex
CREATE INDEX "reconciliations_organization_id_company_id_status_idx" ON "reconciliations"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "reconciliations_financial_account_id_reconciled_at_idx" ON "reconciliations"("financial_account_id", "reconciled_at");

-- CreateIndex
CREATE INDEX "reconciliation_items_reconciliation_id_idx" ON "reconciliation_items"("reconciliation_id");

-- CreateIndex
CREATE INDEX "reconciliation_items_bank_transaction_id_idx" ON "reconciliation_items"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "reconciliation_items_entity_type_entity_id_idx" ON "reconciliation_items"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "reconciliation_history_organization_id_company_id_performed_idx" ON "reconciliation_history"("organization_id", "company_id", "performed_at");

-- CreateIndex
CREATE INDEX "reconciliation_history_bank_transaction_id_performed_at_idx" ON "reconciliation_history"("bank_transaction_id", "performed_at");

-- CreateIndex
CREATE INDEX "reconciliation_history_statement_import_id_performed_at_idx" ON "reconciliation_history"("statement_import_id", "performed_at");

-- CreateIndex
CREATE INDEX "reconciliation_assignments_organization_id_company_id_statu_idx" ON "reconciliation_assignments"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "reconciliation_assignments_bank_transaction_id_idx" ON "reconciliation_assignments"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "reconciliation_assignments_assigned_user_id_idx" ON "reconciliation_assignments"("assigned_user_id");

-- CreateIndex
CREATE INDEX "reconciliation_comments_bank_transaction_id_idx" ON "reconciliation_comments"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "reconciliation_comments_reconciliation_id_idx" ON "reconciliation_comments"("reconciliation_id");

-- CreateIndex
CREATE INDEX "reconciliation_comments_statement_import_id_idx" ON "reconciliation_comments"("statement_import_id");

-- CreateIndex
CREATE INDEX "reconciliation_settings_organization_id_company_id_idx" ON "reconciliation_settings"("organization_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_settings_company_id_financial_account_id_key" ON "reconciliation_settings"("company_id", "financial_account_id");

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_import_template_id_fkey" FOREIGN KEY ("import_template_id") REFERENCES "bank_statement_import_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_duplicate_of_import_id_fkey" FOREIGN KEY ("duplicate_of_import_id") REFERENCES "bank_statement_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_statement_import_id_fkey" FOREIGN KEY ("statement_import_id") REFERENCES "bank_statement_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_duplicate_of_transaction_id_fkey" FOREIGN KEY ("duplicate_of_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_import_templates" ADD CONSTRAINT "bank_statement_import_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_import_templates" ADD CONSTRAINT "bank_statement_import_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_import_templates" ADD CONSTRAINT "bank_statement_import_templates_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_match_suggestions" ADD CONSTRAINT "reconciliation_match_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_match_suggestions" ADD CONSTRAINT "reconciliation_match_suggestions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_match_suggestions" ADD CONSTRAINT "reconciliation_match_suggestions_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_history" ADD CONSTRAINT "reconciliation_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_history" ADD CONSTRAINT "reconciliation_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_history" ADD CONSTRAINT "reconciliation_history_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_history" ADD CONSTRAINT "reconciliation_history_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_history" ADD CONSTRAINT "reconciliation_history_statement_import_id_fkey" FOREIGN KEY ("statement_import_id") REFERENCES "bank_statement_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_assignments" ADD CONSTRAINT "reconciliation_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_assignments" ADD CONSTRAINT "reconciliation_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_assignments" ADD CONSTRAINT "reconciliation_assignments_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_comments" ADD CONSTRAINT "reconciliation_comments_statement_import_id_fkey" FOREIGN KEY ("statement_import_id") REFERENCES "bank_statement_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_settings" ADD CONSTRAINT "reconciliation_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_settings" ADD CONSTRAINT "reconciliation_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_settings" ADD CONSTRAINT "reconciliation_settings_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

