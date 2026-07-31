-- CreateEnum
CREATE TYPE "accounts_payable_status" AS ENUM ('OPEN', 'SCHEDULED', 'BANK_SCHEDULED', 'AWAITING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'RENEGOTIATED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "accounts_payable_installment_status" AS ENUM ('OPEN', 'SCHEDULED', 'BANK_SCHEDULED', 'AWAITING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'RENEGOTIATED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "accounts_payable_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "accounts_payable_adjustment_type" AS ENUM ('INTEREST', 'PENALTY', 'DISCOUNT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "accounts_payable_adjustment_source" AS ENUM ('AUTOMATIC', 'MANUAL', 'RENEGOTIATION');

-- CreateEnum
CREATE TYPE "accounts_payable_entry_status" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateEnum
CREATE TYPE "accounts_payable_block_reason" AS ENUM ('DOCUMENT_PENDING', 'FINANCIAL_DIVERGENCE', 'CONTRACT_BLOCK', 'MANAGEMENT_DECISION', 'AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "accounts_payable_history_action" AS ENUM ('CREATED', 'UPDATED', 'RENEGOTIATED', 'PARTIAL_PAYMENT', 'PAID', 'CANCELLED', 'REOPENED', 'REVERSED', 'DUE_DATE_CHANGED', 'AMOUNT_CHANGED', 'SUPPLIER_CHANGED', 'COST_CENTER_CHANGED', 'PROJECT_CHANGED', 'WITHHOLDING_CHANGED', 'INSTALLMENT_CHANGED', 'BLOCKED', 'UNBLOCKED', 'SCHEDULED', 'ADVANCE_APPLIED', 'ADJUSTMENT_ADDED', 'DELETED');

-- CreateEnum
CREATE TYPE "supplier_advance_type" AS ENUM ('SUPPLIER', 'CONTRACT', 'EXPENSE');

-- CreateEnum
CREATE TYPE "supplier_advance_status" AS ENUM ('OPEN', 'PARTIALLY_APPLIED', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "entry_id" UUID,
    "source_intake_document_id" UUID,
    "approval_request_id" UUID,
    "supplier_contract_id" UUID,
    "purchase_order_number" TEXT,
    "supplier_id" UUID,
    "supplier_company_link_id" UUID,
    "document_type" TEXT,
    "document_number" TEXT,
    "document_series" TEXT,
    "access_key" TEXT,
    "issue_date" TIMESTAMP(3),
    "competence_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "accounts_payable_status" NOT NULL DEFAULT 'OPEN',
    "priority" "accounts_payable_priority" NOT NULL DEFAULT 'NORMAL',
    "original_amount" DECIMAL(18,2) NOT NULL,
    "interest_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholding_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(18,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "category_id" UUID,
    "subcategory_id" UUID,
    "account_plan_id" UUID,
    "financial_nature_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "scheduled_payment_date" TIMESTAMP(3),
    "scheduled_by" UUID,
    "scheduled_at" TIMESTAMP(3),
    "barcode" TEXT,
    "digitable_line" TEXT,
    "pix_key" TEXT,
    "responsible_user_id" UUID,
    "blocked_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "reopened_by" UUID,
    "reopened_at" TIMESTAMP(3),
    "reversed_by" UUID,
    "reversed_at" TIMESTAMP(3),
    "renegotiated_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_installments" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "original_due_date" TIMESTAMP(3) NOT NULL,
    "original_amount" DECIMAL(18,2) NOT NULL,
    "interest_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholding_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(18,2) NOT NULL,
    "status" "accounts_payable_installment_status" NOT NULL DEFAULT 'OPEN',
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "scheduled_payment_date" TIMESTAMP(3),
    "barcode" TEXT,
    "digitable_line" TEXT,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_partial_payments" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "installment_id" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "interest_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "settled_amount" DECIMAL(18,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "receipt_number" TEXT,
    "notes" TEXT,
    "status" "accounts_payable_entry_status" NOT NULL DEFAULT 'ACTIVE',
    "reversal_reason" TEXT,
    "reversed_by" UUID,
    "reversed_at" TIMESTAMP(3),
    "registered_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_partial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_adjustments" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "installment_id" UUID,
    "type" "accounts_payable_adjustment_type" NOT NULL,
    "source" "accounts_payable_adjustment_source" NOT NULL DEFAULT 'MANUAL',
    "amount" DECIMAL(18,2) NOT NULL,
    "calculation_base" DECIMAL(18,2),
    "rate" DECIMAL(9,4),
    "overdue_days" INTEGER,
    "reason" TEXT,
    "status" "accounts_payable_entry_status" NOT NULL DEFAULT 'ACTIVE',
    "reversal_reason" TEXT,
    "reversed_by" UUID,
    "reversed_at" TIMESTAMP(3),
    "applied_by" UUID,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_allocations" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
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

    CONSTRAINT "accounts_payable_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_withholdings" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "entry_withholding_id" UUID,
    "tax_type" "tax_withholding_type" NOT NULL,
    "calculation_base" DECIMAL(18,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "minimum_amount" DECIMAL(18,2),
    "status" "financial_entry_withholding_status" NOT NULL DEFAULT 'CONFIRMED',
    "decision_reason" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_blocks" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "reason" "accounts_payable_block_reason" NOT NULL,
    "description" TEXT,
    "blocked_by" UUID,
    "blocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_by" UUID,
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_renegotiations" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_schedule" JSONB NOT NULL,
    "previous_net_amount" DECIMAL(18,2) NOT NULL,
    "new_net_amount" DECIMAL(18,2) NOT NULL,
    "interest_added" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty_added" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_granted" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_payable_renegotiations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_advances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_contract_id" UUID,
    "type" "supplier_advance_type" NOT NULL DEFAULT 'SUPPLIER',
    "status" "supplier_advance_status" NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(18,2) NOT NULL,
    "applied_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(18,2) NOT NULL,
    "reference" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_advance_applications" (
    "id" UUID NOT NULL,
    "advance_id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "installment_id" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "status" "accounts_payable_entry_status" NOT NULL DEFAULT 'ACTIVE',
    "reversal_reason" TEXT,
    "reversed_by" UUID,
    "reversed_at" TIMESTAMP(3),
    "applied_by" UUID,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_advance_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_history" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "installment_id" UUID,
    "action" "accounts_payable_history_action" NOT NULL,
    "previous_status" "accounts_payable_status",
    "new_status" "accounts_payable_status",
    "field" TEXT,
    "previous_value" TEXT,
    "new_value" TEXT,
    "justification" TEXT,
    "actor_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_payable_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_comments" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accounts_payable_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_tags" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "financial_tag_id" UUID,
    "label" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_payable_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "auto_generate_on_approval" BOOLEAN NOT NULL DEFAULT true,
    "code_prefix" TEXT NOT NULL DEFAULT 'CP',
    "default_monthly_interest_rate" DECIMAL(9,4),
    "default_penalty_rate" DECIMAL(9,4),
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "allow_partial_payment" BOOLEAN NOT NULL DEFAULT true,
    "require_justification_on_due_date_change" BOOLEAN NOT NULL DEFAULT true,
    "require_justification_on_amount_change" BOOLEAN NOT NULL DEFAULT true,
    "auto_block_when_document_pending" BOOLEAN NOT NULL DEFAULT true,
    "reopen_window_days" INTEGER,
    "default_priority" "accounts_payable_priority" NOT NULL DEFAULT 'NORMAL',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_entry_id_key" ON "accounts_payable"("entry_id");

-- CreateIndex
CREATE INDEX "accounts_payable_organization_id_company_id_status_idx" ON "accounts_payable"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "accounts_payable_company_id_status_due_date_idx" ON "accounts_payable"("company_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "accounts_payable_company_id_due_date_idx" ON "accounts_payable"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "accounts_payable_supplier_id_idx" ON "accounts_payable"("supplier_id");

-- CreateIndex
CREATE INDEX "accounts_payable_entry_id_idx" ON "accounts_payable"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_company_id_code_key" ON "accounts_payable"("company_id", "code");

-- CreateIndex
CREATE INDEX "accounts_payable_installments_payable_id_idx" ON "accounts_payable_installments"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_installments_due_date_status_idx" ON "accounts_payable_installments"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_installments_payable_id_installment_number_key" ON "accounts_payable_installments"("payable_id", "installment_number");

-- CreateIndex
CREATE INDEX "accounts_payable_partial_payments_payable_id_idx" ON "accounts_payable_partial_payments"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_partial_payments_installment_id_idx" ON "accounts_payable_partial_payments"("installment_id");

-- CreateIndex
CREATE INDEX "accounts_payable_partial_payments_paid_at_idx" ON "accounts_payable_partial_payments"("paid_at");

-- CreateIndex
CREATE INDEX "accounts_payable_adjustments_payable_id_idx" ON "accounts_payable_adjustments"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_adjustments_installment_id_idx" ON "accounts_payable_adjustments"("installment_id");

-- CreateIndex
CREATE INDEX "accounts_payable_allocations_payable_id_idx" ON "accounts_payable_allocations"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_withholdings_payable_id_idx" ON "accounts_payable_withholdings"("payable_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_withholdings_payable_id_tax_type_key" ON "accounts_payable_withholdings"("payable_id", "tax_type");

-- CreateIndex
CREATE INDEX "accounts_payable_blocks_payable_id_idx" ON "accounts_payable_blocks"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_blocks_payable_id_released_at_idx" ON "accounts_payable_blocks"("payable_id", "released_at");

-- CreateIndex
CREATE INDEX "accounts_payable_renegotiations_payable_id_idx" ON "accounts_payable_renegotiations"("payable_id");

-- CreateIndex
CREATE INDEX "supplier_advances_organization_id_company_id_status_idx" ON "supplier_advances"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "supplier_advances_supplier_id_idx" ON "supplier_advances"("supplier_id");

-- CreateIndex
CREATE INDEX "accounts_payable_advance_applications_advance_id_idx" ON "accounts_payable_advance_applications"("advance_id");

-- CreateIndex
CREATE INDEX "accounts_payable_advance_applications_payable_id_idx" ON "accounts_payable_advance_applications"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_history_payable_id_created_at_idx" ON "accounts_payable_history"("payable_id", "created_at");

-- CreateIndex
CREATE INDEX "accounts_payable_comments_payable_id_idx" ON "accounts_payable_comments"("payable_id");

-- CreateIndex
CREATE INDEX "accounts_payable_tags_payable_id_idx" ON "accounts_payable_tags"("payable_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_tags_payable_id_label_key" ON "accounts_payable_tags"("payable_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_payable_settings_company_id_key" ON "accounts_payable_settings"("company_id");

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_source_intake_document_id_fkey" FOREIGN KEY ("source_intake_document_id") REFERENCES "intake_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_supplier_contract_id_fkey" FOREIGN KEY ("supplier_contract_id") REFERENCES "supplier_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_installments" ADD CONSTRAINT "accounts_payable_installments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_partial_payments" ADD CONSTRAINT "accounts_payable_partial_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_partial_payments" ADD CONSTRAINT "accounts_payable_partial_payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "accounts_payable_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_adjustments" ADD CONSTRAINT "accounts_payable_adjustments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_adjustments" ADD CONSTRAINT "accounts_payable_adjustments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "accounts_payable_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_allocations" ADD CONSTRAINT "accounts_payable_allocations_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_withholdings" ADD CONSTRAINT "accounts_payable_withholdings_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_blocks" ADD CONSTRAINT "accounts_payable_blocks_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_renegotiations" ADD CONSTRAINT "accounts_payable_renegotiations_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advances" ADD CONSTRAINT "supplier_advances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advances" ADD CONSTRAINT "supplier_advances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advances" ADD CONSTRAINT "supplier_advances_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advances" ADD CONSTRAINT "supplier_advances_supplier_contract_id_fkey" FOREIGN KEY ("supplier_contract_id") REFERENCES "supplier_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_advance_applications" ADD CONSTRAINT "accounts_payable_advance_applications_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "supplier_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_advance_applications" ADD CONSTRAINT "accounts_payable_advance_applications_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_advance_applications" ADD CONSTRAINT "accounts_payable_advance_applications_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "accounts_payable_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_history" ADD CONSTRAINT "accounts_payable_history_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_history" ADD CONSTRAINT "accounts_payable_history_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "accounts_payable_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_comments" ADD CONSTRAINT "accounts_payable_comments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_tags" ADD CONSTRAINT "accounts_payable_tags_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_tags" ADD CONSTRAINT "accounts_payable_tags_financial_tag_id_fkey" FOREIGN KEY ("financial_tag_id") REFERENCES "financial_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_settings" ADD CONSTRAINT "accounts_payable_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable_settings" ADD CONSTRAINT "accounts_payable_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

