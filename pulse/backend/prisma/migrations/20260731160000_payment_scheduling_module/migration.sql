-- CreateEnum
CREATE TYPE "payment_schedule_status" AS ENUM ('PENDING_SCHEDULING', 'SCHEDULED', 'IN_BATCH', 'READY_TO_SEND', 'CANCELLED', 'SENT', 'EXECUTED');

-- CreateEnum
CREATE TYPE "payment_batch_status" AS ENUM ('OPEN', 'READY_TO_SEND', 'CANCELLED', 'SENT', 'EXECUTED');

-- CreateEnum
CREATE TYPE "payment_schedule_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "bank_payment_type" AS ENUM ('PIX', 'TED', 'INTERNAL_TRANSFER', 'BOLETO', 'DIRECT_DEBIT', 'TAX', 'PAYROLL', 'CORPORATE_CARD');

-- CreateEnum
CREATE TYPE "payment_schedule_block_reason" AS ENUM ('INSUFFICIENT_BALANCE', 'ACCOUNT_UNAVAILABLE', 'PENDING_DOCUMENT', 'MANAGEMENT_DECISION', 'SUPPLIER_DATA_MISSING', 'AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_schedule_history_action" AS ENUM ('CREATED', 'UPDATED', 'SCHEDULED', 'RESCHEDULED', 'BLOCKED', 'UNBLOCKED', 'CANCELLED', 'ACCOUNT_CHANGED', 'PRIORITY_CHANGED', 'PAYMENT_TYPE_CHANGED', 'RESPONSIBLE_CHANGED', 'ADDED_TO_BATCH', 'REMOVED_FROM_BATCH', 'BATCH_CREATED', 'BATCH_UPDATED', 'BATCH_CANCELLED', 'READY_TO_SEND');

-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "payable_id" UUID NOT NULL,
    "status" "payment_schedule_status" NOT NULL DEFAULT 'PENDING_SCHEDULING',
    "priority" "payment_schedule_priority" NOT NULL DEFAULT 'NORMAL',
    "financial_account_id" UUID,
    "payment_method_id" UUID,
    "bank_payment_type" "bank_payment_type",
    "scheduled_date" TIMESTAMP(3),
    "original_date" TIMESTAMP(3),
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "responsible_user_id" UUID,
    "queue_position" INTEGER NOT NULL DEFAULT 0,
    "batch_id" UUID,
    "blocked_at" TIMESTAMP(3),
    "block_reason" "payment_schedule_block_reason",
    "block_notes" TEXT,
    "blocked_by" UUID,
    "released_by" UUID,
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_items" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "financial_account_id" UUID NOT NULL,
    "financial_institution_id" UUID,
    "bank_payment_type" "bank_payment_type",
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "status" "payment_batch_status" NOT NULL DEFAULT 'OPEN',
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "responsible_user_id" UUID,
    "remittance_number" INTEGER,
    "remittance_file_path" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_by" UUID,
    "closed_by" UUID,
    "closed_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bank_status_code" TEXT,
    "bank_message" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_history" (
    "id" UUID NOT NULL,
    "schedule_id" UUID,
    "batch_id" UUID,
    "action" "payment_schedule_history_action" NOT NULL,
    "previous_status" "payment_schedule_status",
    "new_status" "payment_schedule_status",
    "field" TEXT,
    "previous_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "actor_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_schedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_comments" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_schedule_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "schedule_prefix" TEXT NOT NULL DEFAULT 'AG',
    "batch_prefix" TEXT NOT NULL DEFAULT 'LOTE',
    "block_on_insufficient_balance" BOOLEAN NOT NULL DEFAULT false,
    "consider_credit_limits" BOOLEAN NOT NULL DEFAULT true,
    "block_retroactive_dates" BOOLEAN NOT NULL DEFAULT true,
    "minimum_lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "require_reason_on_reschedule" BOOLEAN NOT NULL DEFAULT true,
    "default_financial_account_id" UUID,
    "default_bank_payment_type" "bank_payment_type",
    "default_priority" "payment_schedule_priority" NOT NULL DEFAULT 'NORMAL',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedule_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_schedules_organization_id_company_id_status_idx" ON "payment_schedules"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "payment_schedules_company_id_scheduled_date_status_idx" ON "payment_schedules"("company_id", "scheduled_date", "status");

-- CreateIndex
CREATE INDEX "payment_schedules_financial_account_id_scheduled_date_idx" ON "payment_schedules"("financial_account_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "payment_schedules_payable_id_idx" ON "payment_schedules"("payable_id");

-- CreateIndex
CREATE INDEX "payment_schedules_batch_id_idx" ON "payment_schedules"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedules_company_id_code_key" ON "payment_schedules"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedule_items_installment_id_key" ON "payment_schedule_items"("installment_id");

-- CreateIndex
CREATE INDEX "payment_schedule_items_schedule_id_idx" ON "payment_schedule_items"("schedule_id");

-- CreateIndex
CREATE INDEX "payment_batches_organization_id_company_id_status_idx" ON "payment_batches"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "payment_batches_company_id_scheduled_date_status_idx" ON "payment_batches"("company_id", "scheduled_date", "status");

-- CreateIndex
CREATE INDEX "payment_batches_financial_account_id_idx" ON "payment_batches"("financial_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_batches_company_id_code_key" ON "payment_batches"("company_id", "code");

-- CreateIndex
CREATE INDEX "payment_batch_items_batch_id_idx" ON "payment_batch_items"("batch_id");

-- CreateIndex
CREATE INDEX "payment_batch_items_schedule_id_idx" ON "payment_batch_items"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_batch_items_batch_id_schedule_id_key" ON "payment_batch_items"("batch_id", "schedule_id");

-- CreateIndex
CREATE INDEX "payment_schedule_history_schedule_id_created_at_idx" ON "payment_schedule_history"("schedule_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_schedule_history_batch_id_created_at_idx" ON "payment_schedule_history"("batch_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_schedule_comments_schedule_id_idx" ON "payment_schedule_comments"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_schedule_settings_company_id_key" ON "payment_schedule_settings"("company_id");

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "accounts_payable_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "financial_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_history" ADD CONSTRAINT "payment_schedule_history_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_history" ADD CONSTRAINT "payment_schedule_history_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_comments" ADD CONSTRAINT "payment_schedule_comments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "payment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_settings" ADD CONSTRAINT "payment_schedule_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_settings" ADD CONSTRAINT "payment_schedule_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

