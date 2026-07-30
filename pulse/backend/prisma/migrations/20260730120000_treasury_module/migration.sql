-- CreateEnum
CREATE TYPE "financial_account_type" AS ENUM ('CHECKING_ACCOUNT', 'SAVINGS_ACCOUNT', 'PAYMENT_ACCOUNT', 'DIGITAL_ACCOUNT', 'INVESTMENT_ACCOUNT', 'GUARANTEED_ACCOUNT', 'CASH', 'PETTY_CASH', 'DIGITAL_WALLET', 'RECEIVING_ACCOUNT', 'TRANSIT_ACCOUNT', 'COMPENSATION_ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "financial_account_purpose" AS ENUM ('PAYMENTS', 'RECEIPTS', 'PAYROLL', 'TAXES', 'INVESTMENTS', 'OPERATING_CASH', 'CORPORATE_EXPENSES', 'TRANSFERS', 'GUARANTEES', 'INTERNAL_MOVEMENTS', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "financial_account_status" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'INACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "reconciliation_mode" AS ENUM ('MANUAL', 'SEMI_AUTOMATIC', 'AUTOMATIC_WITH_CONFIRMATION', 'AUTOMATIC_BY_RULE', 'NOT_RECONCILABLE');

-- CreateEnum
CREATE TYPE "balance_type" AS ENUM ('CREDIT', 'DEBIT', 'ZERO');

-- CreateEnum
CREATE TYPE "opening_balance_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "bank_limit_type" AS ENUM ('OVERDRAFT', 'GUARANTEED_ACCOUNT', 'WORKING_CAPITAL', 'RECEIVABLES_ANTICIPATION', 'REVOLVING', 'OTHER');

-- CreateEnum
CREATE TYPE "pix_key_purpose" AS ENUM ('GENERAL', 'BILLING', 'SUPPLIERS', 'CUSTOMERS', 'PAYROLL', 'REFUNDS');

-- CreateEnum
CREATE TYPE "bank_integration_type" AS ENUM ('OFX_MANUAL', 'CNAB', 'OPEN_FINANCE', 'BANK_API', 'SFTP', 'WEBHOOK', 'ERP', 'CSV_FILE', 'XLSX_FILE', 'MANUAL');

-- CreateEnum
CREATE TYPE "bank_integration_status" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'ACTIVE', 'ERROR', 'SUSPENDED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "integration_environment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "corporate_card_type" AS ENUM ('CREDIT', 'DEBIT', 'PREPAID', 'MULTIPLE', 'VIRTUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "corporate_card_status" AS ENUM ('DRAFT', 'ACTIVE', 'BLOCKED', 'EXPIRED', 'CANCELLED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "payment_method_type" AS ENUM ('PIX', 'BOLETO', 'BANK_TRANSFER', 'TED', 'DOC', 'DIRECT_DEBIT', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHECK', 'UTILITY_BILL', 'COMPENSATION', 'ACCOUNT_CREDIT', 'BATCH_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "receipt_method_type" AS ENUM ('PIX', 'BOLETO', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'CHECK', 'PAYMENT_LINK', 'DIRECT_DEBIT', 'ACCOUNT_CREDIT', 'DEPOSIT', 'GATEWAY', 'MARKETPLACE', 'OTHER');

-- CreateEnum
CREATE TYPE "beneficiary_entity_type" AS ENUM ('SUPPLIER', 'EMPLOYEE', 'PARTNER', 'CUSTOMER', 'GOVERNMENT', 'FINANCIAL_INSTITUTION', 'OTHER');

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_institution_id" UUID,
    "business_unit_id" UUID,
    "cost_center_id" UUID,
    "account_plan_id" UUID,
    "financial_nature_id" UUID,
    "internal_code" VARCHAR(50),
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "account_type" "financial_account_type" NOT NULL,
    "purpose" "financial_account_purpose" NOT NULL DEFAULT 'MULTIPLE',
    "branch_number" VARCHAR(20),
    "branch_digit" VARCHAR(5),
    "account_number" VARCHAR(30),
    "account_digit" VARCHAR(5),
    "normalized_account_identifier" TEXT,
    "holder_name" TEXT,
    "holder_document" TEXT,
    "normalized_holder_document" TEXT,
    "is_third_party" BOOLEAN NOT NULL DEFAULT false,
    "third_party_reason" TEXT,
    "third_party_approved_by" UUID,
    "third_party_approved_at" TIMESTAMP(3),
    "country" VARCHAR(2),
    "swift_code" VARCHAR(20),
    "iban" VARCHAR(40),
    "agreement_number" VARCHAR(30),
    "bank_client_code" VARCHAR(30),
    "wallet_number" VARCHAR(20),
    "wallet_variation" VARCHAR(20),
    "assignor_code" VARCHAR(30),
    "bank_notes" TEXT,
    "physical_location" TEXT,
    "responsible_user_id" UUID,
    "requires_daily_closing" BOOLEAN NOT NULL DEFAULT false,
    "check_frequency_days" INTEGER,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_default_for_payments" BOOLEAN NOT NULL DEFAULT false,
    "is_default_for_receipts" BOOLEAN NOT NULL DEFAULT false,
    "is_default_for_taxes" BOOLEAN NOT NULL DEFAULT false,
    "is_default_for_payroll" BOOLEAN NOT NULL DEFAULT false,
    "is_default_for_transfers" BOOLEAN NOT NULL DEFAULT false,
    "allows_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "allows_manual_entries" BOOLEAN NOT NULL DEFAULT true,
    "allows_imports" BOOLEAN NOT NULL DEFAULT true,
    "allows_integrations" BOOLEAN NOT NULL DEFAULT false,
    "allows_retroactive_entries" BOOLEAN NOT NULL DEFAULT false,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "requires_history" BOOLEAN NOT NULL DEFAULT false,
    "requires_category" BOOLEAN NOT NULL DEFAULT true,
    "reconciliation_mode" "reconciliation_mode" NOT NULL DEFAULT 'MANUAL',
    "fee_category_id" UUID,
    "interest_paid_category_id" UUID,
    "interest_earned_category_id" UUID,
    "iof_category_id" UUID,
    "yield_category_id" UUID,
    "transfer_category_id" UUID,
    "investment_category_id" UUID,
    "redemption_category_id" UUID,
    "reversal_category_id" UUID,
    "minimum_recommended_balance" DECIMAL(18,2),
    "maximum_recommended_balance" DECIMAL(18,2),
    "blocked_balance" DECIMAL(18,2),
    "start_date" DATE,
    "closing_date" DATE,
    "closing_balance" DECIMAL(18,2),
    "closing_reason" TEXT,
    "closing_document_id" UUID,
    "status" "financial_account_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account_opening_balances" (
    "id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "balance_date" DATE NOT NULL,
    "balance_amount" DECIMAL(18,2) NOT NULL,
    "balance_type" "balance_type" NOT NULL DEFAULT 'CREDIT',
    "source" TEXT,
    "document_attachment_id" UUID,
    "reason" TEXT,
    "status" "opening_balance_status" NOT NULL DEFAULT 'APPROVED',
    "created_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_account_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account_limits" (
    "id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "limit_type" "bank_limit_type" NOT NULL,
    "contracted_amount" DECIMAL(18,2) NOT NULL,
    "interest_rate" DECIMAL(9,6),
    "start_date" DATE,
    "end_date" DATE,
    "document_attachment_id" UUID,
    "responsible_user_id" UUID,
    "notes" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "financial_account_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_pix_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID,
    "financial_institution_id" UUID,
    "pix_type" "pix_key_type" NOT NULL,
    "pix_key" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "holder_name" TEXT,
    "holder_document" TEXT,
    "normalized_holder_document" TEXT,
    "purpose" "pix_key_purpose" NOT NULL DEFAULT 'GENERAL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_for_billing" BOOLEAN NOT NULL DEFAULT false,
    "is_for_suppliers" BOOLEAN NOT NULL DEFAULT false,
    "is_for_customers" BOOLEAN NOT NULL DEFAULT false,
    "validation_status" "bank_data_verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "validated_at" TIMESTAMP(3),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "proof_document_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "company_pix_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account_users" (
    "id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "view_limit" DECIMAL(18,2),
    "transaction_limit" DECIMAL(18,2),
    "approval_limit" DECIMAL(18,2),
    "can_view_balance" BOOLEAN NOT NULL DEFAULT true,
    "can_view_bank_data" BOOLEAN NOT NULL DEFAULT false,
    "can_create_entry" BOOLEAN NOT NULL DEFAULT false,
    "can_import_statement" BOOLEAN NOT NULL DEFAULT false,
    "can_reconcile" BOOLEAN NOT NULL DEFAULT false,
    "can_schedule_payment" BOOLEAN NOT NULL DEFAULT false,
    "can_authorize_payment" BOOLEAN NOT NULL DEFAULT false,
    "can_update_opening_balance" BOOLEAN NOT NULL DEFAULT false,
    "can_update_limits" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_integration" BOOLEAN NOT NULL DEFAULT false,
    "can_export" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,

    CONSTRAINT "financial_account_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account_integrations" (
    "id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "integration_type" "bank_integration_type" NOT NULL,
    "provider" TEXT,
    "external_account_id" TEXT,
    "environment" "integration_environment" NOT NULL DEFAULT 'SANDBOX',
    "status" "bank_integration_status" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "supports_balance" BOOLEAN NOT NULL DEFAULT false,
    "supports_statements" BOOLEAN NOT NULL DEFAULT false,
    "supports_payments" BOOLEAN NOT NULL DEFAULT false,
    "supports_billing" BOOLEAN NOT NULL DEFAULT false,
    "supports_reconciliation" BOOLEAN NOT NULL DEFAULT false,
    "credentials_reference" TEXT,
    "credentials_updated_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "next_sync_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "notes" TEXT,
    "configured_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "financial_account_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_cards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "financial_account_id" UUID,
    "financial_institution_id" UUID,
    "business_unit_id" UUID,
    "cost_center_id" UUID,
    "default_category_id" UUID,
    "default_project_id" UUID,
    "account_plan_id" UUID,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "card_type" "corporate_card_type" NOT NULL,
    "brand" VARCHAR(40),
    "last_four_digits" VARCHAR(4) NOT NULL,
    "holder_name" TEXT,
    "responsible_user_id" UUID,
    "is_physical" BOOLEAN NOT NULL DEFAULT true,
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "total_limit" DECIMAL(18,2),
    "transaction_limit" DECIMAL(18,2),
    "closing_day" INTEGER,
    "due_day" INTEGER,
    "allows_installments" BOOLEAN NOT NULL DEFAULT true,
    "maximum_installments" INTEGER,
    "issue_date" DATE,
    "expiration_date" DATE,
    "status" "corporate_card_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "corporate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_card_users" (
    "id" UUID NOT NULL,
    "corporate_card_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "individual_limit" DECIMAL(18,2),
    "transaction_limit" DECIMAL(18,2),
    "cost_center_id" UUID,
    "business_unit_id" UUID,
    "project_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,

    CONSTRAINT "corporate_card_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method_type" "payment_method_type" NOT NULL,
    "requires_financial_account" BOOLEAN NOT NULL DEFAULT true,
    "requires_beneficiary" BOOLEAN NOT NULL DEFAULT false,
    "requires_bank_data" BOOLEAN NOT NULL DEFAULT false,
    "requires_pix_key" BOOLEAN NOT NULL DEFAULT false,
    "requires_barcode" BOOLEAN NOT NULL DEFAULT false,
    "requires_digitable_line" BOOLEAN NOT NULL DEFAULT false,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "allows_scheduling" BOOLEAN NOT NULL DEFAULT true,
    "allows_installments" BOOLEAN NOT NULL DEFAULT false,
    "allows_recurrence" BOOLEAN NOT NULL DEFAULT false,
    "allows_integration" BOOLEAN NOT NULL DEFAULT false,
    "allows_batch_payment" BOOLEAN NOT NULL DEFAULT false,
    "confirmation_threshold" DECIMAL(18,2),
    "settlement_days" INTEGER NOT NULL DEFAULT 0,
    "default_fee_category_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_methods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method_type" "receipt_method_type" NOT NULL,
    "default_financial_account_id" UUID,
    "requires_customer" BOOLEAN NOT NULL DEFAULT false,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "requires_identifier" BOOLEAN NOT NULL DEFAULT false,
    "allows_recurrence" BOOLEAN NOT NULL DEFAULT false,
    "allows_installments" BOOLEAN NOT NULL DEFAULT false,
    "maximum_installments" INTEGER,
    "settlement_days" INTEGER NOT NULL DEFAULT 0,
    "fixed_fee" DECIMAL(18,2),
    "percentage_fee" DECIMAL(9,4),
    "anticipation_allowed" BOOLEAN NOT NULL DEFAULT false,
    "anticipation_fee_percentage" DECIMAL(9,4),
    "default_fee_category_id" UUID,
    "default_interest_category_id" UUID,
    "acquirer_supplier_id" UUID,
    "integration_provider" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "receipt_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "primary_financial_account_id" UUID,
    "default_payment_account_id" UUID,
    "default_receipt_account_id" UUID,
    "default_tax_account_id" UUID,
    "default_payroll_account_id" UUID,
    "default_cash_account_id" UUID,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "minimum_safety_balance" DECIMAL(18,2),
    "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "allow_inactive_account_operations" BOOLEAN NOT NULL DEFAULT false,
    "require_available_balance" BOOLEAN NOT NULL DEFAULT true,
    "require_attachment" BOOLEAN NOT NULL DEFAULT false,
    "require_registered_beneficiary" BOOLEAN NOT NULL DEFAULT true,
    "require_holder_validation" BOOLEAN NOT NULL DEFAULT true,
    "require_dual_approval" BOOLEAN NOT NULL DEFAULT false,
    "dual_approval_amount" DECIMAL(18,2),
    "allow_third_party_accounts" BOOLEAN NOT NULL DEFAULT false,
    "allow_opening_balance_change" BOOLEAN NOT NULL DEFAULT true,
    "allow_manual_entries" BOOLEAN NOT NULL DEFAULT true,
    "require_segregation_of_duties" BOOLEAN NOT NULL DEFAULT false,
    "segregate_entry_from_approval" BOOLEAN NOT NULL DEFAULT false,
    "segregate_approval_from_reconciliation" BOOLEAN NOT NULL DEFAULT false,
    "allow_self_approval" BOOLEAN NOT NULL DEFAULT true,
    "card_expiration_alert_days" INTEGER NOT NULL DEFAULT 30,
    "account_closing_alert_days" INTEGER NOT NULL DEFAULT 30,
    "default_reconciliation_mode" "reconciliation_mode" NOT NULL DEFAULT 'MANUAL',
    "amount_tolerance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "date_tolerance_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "treasury_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account_status_history" (
    "id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "previous_status" "financial_account_status",
    "new_status" "financial_account_status" NOT NULL,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_account_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_accounts_organization_id_idx" ON "financial_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "financial_accounts_company_id_status_idx" ON "financial_accounts"("company_id", "status");

-- CreateIndex
CREATE INDEX "financial_accounts_normalized_account_identifier_idx" ON "financial_accounts"("normalized_account_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_company_id_internal_code_key" ON "financial_accounts"("company_id", "internal_code");

-- CreateIndex
CREATE INDEX "financial_account_opening_balances_financial_account_id_sta_idx" ON "financial_account_opening_balances"("financial_account_id", "status");

-- CreateIndex
CREATE INDEX "financial_account_limits_financial_account_id_idx" ON "financial_account_limits"("financial_account_id");

-- CreateIndex
CREATE INDEX "company_pix_keys_organization_id_idx" ON "company_pix_keys"("organization_id");

-- CreateIndex
CREATE INDEX "company_pix_keys_financial_account_id_idx" ON "company_pix_keys"("financial_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_pix_keys_company_id_normalized_key_key" ON "company_pix_keys"("company_id", "normalized_key");

-- CreateIndex
CREATE INDEX "financial_account_users_user_id_idx" ON "financial_account_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_account_users_financial_account_id_user_id_key" ON "financial_account_users"("financial_account_id", "user_id");

-- CreateIndex
CREATE INDEX "financial_account_integrations_financial_account_id_idx" ON "financial_account_integrations"("financial_account_id");

-- CreateIndex
CREATE INDEX "corporate_cards_organization_id_idx" ON "corporate_cards"("organization_id");

-- CreateIndex
CREATE INDEX "corporate_cards_company_id_status_idx" ON "corporate_cards"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_cards_company_id_financial_institution_id_last_fo_key" ON "corporate_cards"("company_id", "financial_institution_id", "last_four_digits", "expiration_date");

-- CreateIndex
CREATE INDEX "corporate_card_users_user_id_idx" ON "corporate_card_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_card_users_corporate_card_id_user_id_key" ON "corporate_card_users"("corporate_card_id", "user_id");

-- CreateIndex
CREATE INDEX "payment_methods_organization_id_idx" ON "payment_methods"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_organization_id_company_id_code_key" ON "payment_methods"("organization_id", "company_id", "code");

-- CreateIndex
CREATE INDEX "receipt_methods_organization_id_idx" ON "receipt_methods"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_methods_organization_id_company_id_code_key" ON "receipt_methods"("organization_id", "company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_settings_company_id_key" ON "treasury_settings"("company_id");

-- CreateIndex
CREATE INDEX "treasury_settings_organization_id_idx" ON "treasury_settings"("organization_id");

-- CreateIndex
CREATE INDEX "financial_account_status_history_financial_account_id_idx" ON "financial_account_status_history"("financial_account_id");

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "financial_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_financial_nature_id_fkey" FOREIGN KEY ("financial_nature_id") REFERENCES "financial_natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_opening_balances" ADD CONSTRAINT "financial_account_opening_balances_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_limits" ADD CONSTRAINT "financial_account_limits_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pix_keys" ADD CONSTRAINT "company_pix_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pix_keys" ADD CONSTRAINT "company_pix_keys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pix_keys" ADD CONSTRAINT "company_pix_keys_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_pix_keys" ADD CONSTRAINT "company_pix_keys_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "financial_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_users" ADD CONSTRAINT "financial_account_users_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_users" ADD CONSTRAINT "financial_account_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_users" ADD CONSTRAINT "financial_account_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_integrations" ADD CONSTRAINT "financial_account_integrations_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "financial_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_default_project_id_fkey" FOREIGN KEY ("default_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_cards" ADD CONSTRAINT "corporate_cards_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_card_users" ADD CONSTRAINT "corporate_card_users_corporate_card_id_fkey" FOREIGN KEY ("corporate_card_id") REFERENCES "corporate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_card_users" ADD CONSTRAINT "corporate_card_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_card_users" ADD CONSTRAINT "corporate_card_users_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_card_users" ADD CONSTRAINT "corporate_card_users_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_card_users" ADD CONSTRAINT "corporate_card_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_default_fee_category_id_fkey" FOREIGN KEY ("default_fee_category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_default_financial_account_id_fkey" FOREIGN KEY ("default_financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_default_fee_category_id_fkey" FOREIGN KEY ("default_fee_category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_default_interest_category_id_fkey" FOREIGN KEY ("default_interest_category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_methods" ADD CONSTRAINT "receipt_methods_acquirer_supplier_id_fkey" FOREIGN KEY ("acquirer_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_primary_financial_account_id_fkey" FOREIGN KEY ("primary_financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_default_payment_account_id_fkey" FOREIGN KEY ("default_payment_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_default_receipt_account_id_fkey" FOREIGN KEY ("default_receipt_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_default_tax_account_id_fkey" FOREIGN KEY ("default_tax_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_default_payroll_account_id_fkey" FOREIGN KEY ("default_payroll_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_settings" ADD CONSTRAINT "treasury_settings_default_cash_account_id_fkey" FOREIGN KEY ("default_cash_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_status_history" ADD CONSTRAINT "financial_account_status_history_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

