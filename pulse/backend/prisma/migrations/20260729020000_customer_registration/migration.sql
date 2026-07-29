-- CreateEnum
CREATE TYPE "customer_person_type" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY', 'FOREIGN');

-- CreateEnum
CREATE TYPE "customer_system_status" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "customer_link_status" AS ENUM ('PROSPECT', 'DRAFT', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "customer_financial_status" AS ENUM ('ON_TIME', 'ATTENTION', 'OVERDUE', 'DELINQUENT', 'NEGOTIATING', 'BLOCKED', 'SUSPENDED', 'NO_ACTIVITY');

-- CreateEnum
CREATE TYPE "customer_address_type" AS ENUM ('FISCAL', 'BILLING', 'DELIVERY', 'OPERATIONAL', 'CORRESPONDENCE');

-- CreateEnum
CREATE TYPE "abc_classification" AS ENUM ('A', 'B', 'C', 'NOT_CLASSIFIED');

-- CreateEnum
CREATE TYPE "revenue_potential_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'STRATEGIC');

-- CreateEnum
CREATE TYPE "customer_risk_level" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "recurrence_periodicity" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "customer_payment_method" AS ENUM ('PIX', 'BOLETO', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'DIRECT_DEBIT', 'PAYMENT_LINK', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "customer_origin" AS ENUM ('REFERRAL', 'ACTIVE_PROSPECTING', 'WEBSITE', 'SOCIAL_MEDIA', 'EVENT', 'PARTNER', 'CAMPAIGN', 'OLD_CUSTOMER', 'SYSTEM_MIGRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('INDIVIDUAL', 'PRIVATE_COMPANY', 'GOVERNMENT_AGENCY', 'AUTARCHY', 'FOUNDATION', 'ASSOCIATION', 'CONDOMINIUM', 'COOPERATIVE', 'INDUSTRY', 'COMMERCE', 'SERVICE_PROVIDER', 'ECONOMIC_GROUP', 'INTERNAL_CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "adjustment_type" AS ENUM ('ECONOMIC_INDEX', 'FIXED_PERCENTAGE', 'FIXED_AMOUNT', 'MANUAL_NEGOTIATION', 'NONE');

-- CreateEnum
CREATE TYPE "customer_contract_status" AS ENUM ('DRAFT', 'NEGOTIATING', 'PENDING_SIGNATURE', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_promise_status" AS ENUM ('OPEN', 'FULFILLED', 'PARTIALLY_FULFILLED', 'NOT_FULFILLED', 'CANCELLED', 'RENEGOTIATED');

-- CreateEnum
CREATE TYPE "collection_channel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'INTERNAL_NOTIFICATION', 'MANUAL_CALL', 'LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "recurrence_processing_status" AS ENUM ('PENDING_FINANCIAL_MODULE', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "person_type" "customer_person_type" NOT NULL DEFAULT 'LEGAL_ENTITY',
    "document_number" TEXT,
    "normalized_document_number" TEXT,
    "legal_name" TEXT,
    "trade_name" TEXT,
    "display_name" TEXT,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "opening_date" TIMESTAMP(3),
    "birth_date" TIMESTAMP(3),
    "legal_nature" TEXT,
    "company_size" TEXT,
    "share_capital" DECIMAL(18,2),
    "external_registration_status" TEXT,
    "external_registration_status_date" TIMESTAMP(3),
    "main_cnae" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'BR',
    "preferred_language" TEXT,
    "segment" TEXT,
    "foreign_document" TEXT,
    "billing_currency" TEXT,
    "system_status" "customer_system_status" NOT NULL DEFAULT 'DRAFT',
    "general_notes" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "email_financial" TEXT,
    "email_billing" TEXT,
    "email_fiscal" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "address_type" "customer_address_type" NOT NULL,
    "postal_code" TEXT NOT NULL,
    "normalized_postal_code" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "city_code" TEXT,
    "reference" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "same_as_address_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_financial_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_billing_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_contract_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_tax_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_operational_contact" BOOLEAN NOT NULL DEFAULT false,
    "receives_invoices" BOOLEAN NOT NULL DEFAULT false,
    "receives_billing" BOOLEAN NOT NULL DEFAULT false,
    "receives_tax_documents" BOOLEAN NOT NULL DEFAULT false,
    "receives_contracts" BOOLEAN NOT NULL DEFAULT false,
    "receives_reports" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_cnaes" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "cnae_code" TEXT NOT NULL,
    "description" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_cnaes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_bank_identifiers" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "company_id" UUID,
    "identifierType" TEXT NOT NULL,
    "identifier_value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "source" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "confidence" DECIMAL(5,2),
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "last_confirmed_at" TIMESTAMP(3),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_bank_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_company_links" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "internal_code" TEXT,
    "relationship_type" TEXT,
    "customer_types" "customer_type"[],
    "source" "customer_origin",
    "segment" TEXT,
    "commercial_responsible_id" UUID,
    "relationship_responsible_id" UUID,
    "default_revenue_category_id" UUID,
    "default_subcategory_id" UUID,
    "default_result_center_id" UUID,
    "default_accounting_account" TEXT,
    "default_product_service" TEXT,
    "default_description" TEXT,
    "default_history" TEXT,
    "abc_classification" "abc_classification" NOT NULL DEFAULT 'NOT_CLASSIFIED',
    "revenue_potential_level" "revenue_potential_level",
    "estimated_monthly_revenue" DECIMAL(18,2),
    "estimated_annual_revenue" DECIMAL(18,2),
    "estimated_average_ticket" DECIMAL(18,2),
    "estimated_margin_percentage" DECIMAL(5,2),
    "payment_term_days" INTEGER,
    "default_due_day" INTEGER,
    "billing_frequency" "recurrence_periodicity",
    "preferred_payment_method" "customer_payment_method",
    "preferred_company_bank_account_id" UUID,
    "preferred_company_pix_key_id" UUID,
    "default_late_fee_percentage" DECIMAL(5,2),
    "default_monthly_interest_percentage" DECIMAL(5,2),
    "default_discount_percentage" DECIMAL(5,2),
    "early_payment_discount_percentage" DECIMAL(5,2),
    "early_payment_days" INTEGER,
    "grace_period_days" INTEGER DEFAULT 0,
    "credit_limit" DECIMAL(18,2),
    "risk_level" "customer_risk_level" NOT NULL DEFAULT 'NOT_ASSESSED',
    "allow_over_credit_limit" BOOLEAN NOT NULL DEFAULT false,
    "requires_over_limit_approval" BOOLEAN NOT NULL DEFAULT true,
    "maximum_payment_term_days" INTEGER,
    "automatic_block_enabled" BOOLEAN NOT NULL DEFAULT false,
    "automatic_block_days" INTEGER,
    "billing_rules_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_identification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_revenue_classification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_result_center_enabled" BOOLEAN NOT NULL DEFAULT true,
    "receivable_suggestion_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_receivable_creation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_receipt_matching_enabled" BOOLEAN NOT NULL DEFAULT false,
    "confirmation_threshold" DECIMAL(5,2) NOT NULL DEFAULT 95,
    "status" "customer_link_status" NOT NULL DEFAULT 'PROSPECT',
    "financial_status" "customer_financial_status" NOT NULL DEFAULT 'NO_ACTIVITY',
    "block_reason" TEXT,
    "suspension_reason" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_company_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_billing_rules" (
    "id" UUID NOT NULL,
    "customer_company_link_id" UUID NOT NULL,
    "ruleType" TEXT,
    "reference_event" TEXT NOT NULL,
    "days_offset" INTEGER NOT NULL,
    "channel" "collection_channel" NOT NULL,
    "message_template_id" UUID,
    "preferred_hour" INTEGER,
    "allowed_weekdays" INTEGER[],
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "responsible_user_id" UUID,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_billing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_collection_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "company_id" UUID,
    "customer_company_link_id" UUID NOT NULL,
    "financial_entry_id" UUID,
    "contract_id" UUID,
    "channel" "collection_channel" NOT NULL,
    "recipient_name" TEXT,
    "recipient_address" TEXT,
    "subject" TEXT,
    "message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivery_status" TEXT,
    "response" TEXT,
    "responsible_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_collection_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_promises" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "company_id" UUID,
    "customer_company_link_id" UUID NOT NULL,
    "financial_entry_id" UUID,
    "collection_history_id" UUID,
    "promised_amount" DECIMAL(18,2) NOT NULL,
    "promised_date" TIMESTAMP(3) NOT NULL,
    "fulfilled_amount" DECIMAL(18,2),
    "fulfilled_at" TIMESTAMP(3),
    "status" "payment_promise_status" NOT NULL DEFAULT 'OPEN',
    "customer_contact_id" UUID,
    "responsible_user_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_promises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contracts" (
    "id" UUID NOT NULL,
    "customer_company_link_id" UUID NOT NULL,
    "contractNumber" TEXT,
    "description" TEXT,
    "object" TEXT,
    "product_service" TEXT,
    "plan_name" TEXT,
    "initial_value" DECIMAL(18,2),
    "current_value" DECIMAL(18,2),
    "signature_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_indefinite_term" BOOLEAN NOT NULL DEFAULT false,
    "automatic_renewal" BOOLEAN NOT NULL DEFAULT false,
    "renewal_notice_days" INTEGER,
    "billing_frequency" "recurrence_periodicity",
    "due_day" INTEGER,
    "adjustment_type" "adjustment_type",
    "adjustment_index" TEXT,
    "adjustment_percentage" DECIMAL(5,2),
    "adjustment_base_date" TIMESTAMP(3),
    "next_adjustment_date" TIMESTAMP(3),
    "preferred_payment_method" "customer_payment_method",
    "company_bank_account_id" UUID,
    "revenue_category_id" UUID,
    "result_center_id" UUID,
    "internal_responsible_id" UUID,
    "customer_contact_id" UUID,
    "status" "customer_contract_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contract_amendments" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "amendment_number" TEXT,
    "description" TEXT,
    "effective_date" TIMESTAMP(3),
    "previous_value" DECIMAL(18,2),
    "new_value" DECIMAL(18,2),
    "previous_end_date" TIMESTAMP(3),
    "new_end_date" TIMESTAMP(3),
    "scope_changed" BOOLEAN NOT NULL DEFAULT false,
    "document_attachment_id" UUID,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_recurring_receivables" (
    "id" UUID NOT NULL,
    "customer_company_link_id" UUID NOT NULL,
    "contract_id" UUID,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "frequency" "recurrence_periodicity" NOT NULL,
    "first_due_date" TIMESTAMP(3),
    "fixed_due_day" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "installment_count" INTEGER,
    "revenue_category_id" UUID,
    "subcategory_id" UUID,
    "result_center_id" UUID,
    "company_bank_account_id" UUID,
    "payment_method" "customer_payment_method",
    "late_fee_percentage" DECIMAL(5,2),
    "monthly_interest_percentage" DECIMAL(5,2),
    "discount_percentage" DECIMAL(5,2),
    "early_payment_discount_percentage" DECIMAL(5,2),
    "generation_advance_days" INTEGER,
    "automatic_generation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "processing_status" "recurrence_processing_status" NOT NULL DEFAULT 'PENDING_FINANCIAL_MODULE',
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "customer_recurring_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_registry_queries" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "customer_id" UUID,
    "document_number" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "request_status" "registry_query_status" NOT NULL,
    "response_summary" JSONB,
    "queried_by" UUID,
    "queried_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "customer_registry_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_status_history" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "customer_company_link_id" UUID,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "previous_financial_status" TEXT,
    "new_financial_status" TEXT,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_normalized_document_number_key" ON "customers"("normalized_document_number");

-- CreateIndex
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE INDEX "customers_system_status_idx" ON "customers"("system_status");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE INDEX "customer_contacts_customer_id_idx" ON "customer_contacts"("customer_id");

-- CreateIndex
CREATE INDEX "customer_cnaes_customer_id_idx" ON "customer_cnaes"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_cnaes_customer_id_cnae_code_key" ON "customer_cnaes"("customer_id", "cnae_code");

-- CreateIndex
CREATE INDEX "customer_bank_identifiers_customer_id_idx" ON "customer_bank_identifiers"("customer_id");

-- CreateIndex
CREATE INDEX "customer_bank_identifiers_normalized_value_idx" ON "customer_bank_identifiers"("normalized_value");

-- CreateIndex
CREATE INDEX "customer_company_links_company_id_idx" ON "customer_company_links"("company_id");

-- CreateIndex
CREATE INDEX "customer_company_links_customer_id_idx" ON "customer_company_links"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_company_links_customer_id_company_id_key" ON "customer_company_links"("customer_id", "company_id");

-- CreateIndex
CREATE INDEX "customer_billing_rules_customer_company_link_id_idx" ON "customer_billing_rules"("customer_company_link_id");

-- CreateIndex
CREATE INDEX "customer_collection_history_customer_company_link_id_idx" ON "customer_collection_history"("customer_company_link_id");

-- CreateIndex
CREATE INDEX "payment_promises_customer_company_link_id_idx" ON "payment_promises"("customer_company_link_id");

-- CreateIndex
CREATE INDEX "customer_contracts_customer_company_link_id_idx" ON "customer_contracts"("customer_company_link_id");

-- CreateIndex
CREATE INDEX "customer_contract_amendments_contract_id_idx" ON "customer_contract_amendments"("contract_id");

-- CreateIndex
CREATE INDEX "customer_recurring_receivables_customer_company_link_id_idx" ON "customer_recurring_receivables"("customer_company_link_id");

-- CreateIndex
CREATE INDEX "customer_registry_queries_document_number_idx" ON "customer_registry_queries"("document_number");

-- CreateIndex
CREATE INDEX "customer_registry_queries_customer_id_idx" ON "customer_registry_queries"("customer_id");

-- CreateIndex
CREATE INDEX "customer_status_history_customer_id_idx" ON "customer_status_history"("customer_id");

-- CreateIndex
CREATE INDEX "customer_status_history_customer_company_link_id_idx" ON "customer_status_history"("customer_company_link_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_same_as_address_id_fkey" FOREIGN KEY ("same_as_address_id") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cnaes" ADD CONSTRAINT "customer_cnaes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_bank_identifiers" ADD CONSTRAINT "customer_bank_identifiers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_company_links" ADD CONSTRAINT "customer_company_links_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_company_links" ADD CONSTRAINT "customer_company_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_company_links" ADD CONSTRAINT "customer_company_links_default_revenue_category_id_fkey" FOREIGN KEY ("default_revenue_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_company_links" ADD CONSTRAINT "customer_company_links_default_subcategory_id_fkey" FOREIGN KEY ("default_subcategory_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_company_links" ADD CONSTRAINT "customer_company_links_default_result_center_id_fkey" FOREIGN KEY ("default_result_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_billing_rules" ADD CONSTRAINT "customer_billing_rules_customer_company_link_id_fkey" FOREIGN KEY ("customer_company_link_id") REFERENCES "customer_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_collection_history" ADD CONSTRAINT "customer_collection_history_customer_company_link_id_fkey" FOREIGN KEY ("customer_company_link_id") REFERENCES "customer_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_collection_history" ADD CONSTRAINT "customer_collection_history_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "customer_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_customer_company_link_id_fkey" FOREIGN KEY ("customer_company_link_id") REFERENCES "customer_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_collection_history_id_fkey" FOREIGN KEY ("collection_history_id") REFERENCES "customer_collection_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_customer_contact_id_fkey" FOREIGN KEY ("customer_contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_customer_company_link_id_fkey" FOREIGN KEY ("customer_company_link_id") REFERENCES "customer_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_revenue_category_id_fkey" FOREIGN KEY ("revenue_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_result_center_id_fkey" FOREIGN KEY ("result_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_customer_contact_id_fkey" FOREIGN KEY ("customer_contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contract_amendments" ADD CONSTRAINT "customer_contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "customer_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_recurring_receivables" ADD CONSTRAINT "customer_recurring_receivables_customer_company_link_id_fkey" FOREIGN KEY ("customer_company_link_id") REFERENCES "customer_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_recurring_receivables" ADD CONSTRAINT "customer_recurring_receivables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "customer_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_registry_queries" ADD CONSTRAINT "customer_registry_queries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_registry_queries" ADD CONSTRAINT "customer_registry_queries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_status_history" ADD CONSTRAINT "customer_status_history_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_status_history" ADD CONSTRAINT "customer_status_history_customer_company_link_id_fkey" FOREIGN KEY ("customer_company_link_id") REFERENCES "customer_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

