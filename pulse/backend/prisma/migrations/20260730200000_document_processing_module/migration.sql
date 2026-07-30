-- CreateEnum
CREATE TYPE "financial_entry_direction" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "financial_entry_origin" AS ENUM ('DOCUMENT_INTAKE', 'MANUAL', 'RECURRENCE', 'CONTRACT');

-- CreateEnum
CREATE TYPE "financial_entry_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "financial_entry_installment_status" AS ENUM ('OPEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "financial_entry_dimension_source" AS ENUM ('CLASSIFICATION_RULE', 'SUPPLIER_DEFAULT', 'CUSTOMER_DEFAULT', 'CATEGORY_DEFAULT', 'DOCUMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "financial_entry_withholding_status" AS ENUM ('SUGGESTED', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_intake_document_id" UUID,
    "direction" "financial_entry_direction" NOT NULL,
    "origin" "financial_entry_origin" NOT NULL DEFAULT 'DOCUMENT_INTAKE',
    "status" "financial_entry_status" NOT NULL DEFAULT 'DRAFT',
    "supplier_id" UUID,
    "supplier_company_link_id" UUID,
    "customer_id" UUID,
    "customer_company_link_id" UUID,
    "document_number" TEXT,
    "document_series" TEXT,
    "access_key" TEXT,
    "issue_date" TIMESTAMP(3),
    "competence_date" TIMESTAMP(3),
    "description" TEXT,
    "history" TEXT,
    "notes" TEXT,
    "gross_amount" DECIMAL(18,2) NOT NULL,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interest_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholding_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "category_id" UUID,
    "subcategory_id" UUID,
    "account_plan_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "financial_nature_id" UUID,
    "applied_classification_rule_id" UUID,
    "applied_allocation_rule_id" UUID,
    "classification_sources" JSONB,
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "receipt_method_id" UUID,
    "barcode" TEXT,
    "digitable_line" TEXT,
    "pix_key" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entry_installments" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(18,2) NOT NULL,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL,
    "barcode" TEXT,
    "digitable_line" TEXT,
    "status" "financial_entry_installment_status" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_entry_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entry_allocations" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "target_type" "allocation_target_type" NOT NULL,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "category_id" UUID,
    "account_plan_id" UUID,
    "percentage" DECIMAL(7,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_entry_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entry_withholdings" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "supplier_tax_withholding_id" UUID,
    "tax_type" "tax_withholding_type" NOT NULL,
    "calculation_base" DECIMAL(18,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "minimum_amount" DECIMAL(18,2),
    "status" "financial_entry_withholding_status" NOT NULL DEFAULT 'SUGGESTED',
    "decision_reason" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_entry_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entry_status_history" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "previousStatus" "financial_entry_status",
    "newStatus" "financial_entry_status" NOT NULL,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_entry_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_processing_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "auto_classification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_allocation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_withholding_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_open_when_complete" BOOLEAN NOT NULL DEFAULT false,
    "approval_threshold_amount" DECIMAL(18,2),
    "require_category" BOOLEAN NOT NULL DEFAULT true,
    "require_cost_center" BOOLEAN NOT NULL DEFAULT false,
    "require_project" BOOLEAN NOT NULL DEFAULT false,
    "block_installment_mismatch" BOOLEAN NOT NULL DEFAULT true,
    "default_payment_term_days" INTEGER NOT NULL DEFAULT 30,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_processing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_source_intake_document_id_key" ON "financial_entries"("source_intake_document_id");

-- CreateIndex
CREATE INDEX "financial_entries_organization_id_company_id_status_idx" ON "financial_entries"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "financial_entries_company_id_direction_status_idx" ON "financial_entries"("company_id", "direction", "status");

-- CreateIndex
CREATE INDEX "financial_entries_supplier_id_idx" ON "financial_entries"("supplier_id");

-- CreateIndex
CREATE INDEX "financial_entries_customer_id_idx" ON "financial_entries"("customer_id");

-- CreateIndex
CREATE INDEX "financial_entry_installments_entry_id_idx" ON "financial_entry_installments"("entry_id");

-- CreateIndex
CREATE INDEX "financial_entry_installments_due_date_idx" ON "financial_entry_installments"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entry_installments_entry_id_installment_number_key" ON "financial_entry_installments"("entry_id", "installment_number");

-- CreateIndex
CREATE INDEX "financial_entry_allocations_entry_id_idx" ON "financial_entry_allocations"("entry_id");

-- CreateIndex
CREATE INDEX "financial_entry_withholdings_entry_id_idx" ON "financial_entry_withholdings"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entry_withholdings_entry_id_tax_type_key" ON "financial_entry_withholdings"("entry_id", "tax_type");

-- CreateIndex
CREATE INDEX "financial_entry_status_history_entry_id_idx" ON "financial_entry_status_history"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_processing_settings_company_id_key" ON "document_processing_settings"("company_id");

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_source_intake_document_id_fkey" FOREIGN KEY ("source_intake_document_id") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entry_installments" ADD CONSTRAINT "financial_entry_installments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entry_allocations" ADD CONSTRAINT "financial_entry_allocations_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entry_withholdings" ADD CONSTRAINT "financial_entry_withholdings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entry_status_history" ADD CONSTRAINT "financial_entry_status_history_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing_settings" ADD CONSTRAINT "document_processing_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing_settings" ADD CONSTRAINT "document_processing_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

