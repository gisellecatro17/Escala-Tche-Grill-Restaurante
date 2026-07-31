-- CreateEnum
CREATE TYPE "supplier_person_type" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY', 'FOREIGN');

-- CreateEnum
CREATE TYPE "supplier_system_status" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "supplier_link_status" AS ENUM ('DRAFT', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "supplier_address_type" AS ENUM ('FISCAL', 'COMMERCIAL', 'BILLING', 'CORRESPONDENCE', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "supplier_type" AS ENUM ('MERCHANDISE', 'SERVICE', 'SERVICE_PROVIDER', 'UTILITY_COMPANY', 'TAX', 'EMPLOYEE', 'PARTNER', 'FINANCIAL_INSTITUTION', 'LANDLORD', 'CARRIER', 'GOVERNMENT_AGENCY', 'FREELANCER', 'OCCASIONAL_SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "supplier_bank_account_type" AS ENUM ('CHECKING', 'SAVINGS', 'PAYMENT', 'DIGITAL', 'THIRD_PARTY', 'OTHER');

-- CreateEnum
CREATE TYPE "pix_key_type" AS ENUM ('CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM', 'BANK_DATA');

-- CreateEnum
CREATE TYPE "bank_data_verification_status" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "bank_data_change_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('PIX', 'BOLETO', 'BANK_TRANSFER', 'DIRECT_DEBIT', 'CARD', 'CASH', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "financial_nature" AS ENUM ('COST', 'EXPENSE', 'INVESTMENT', 'TAX', 'LOAN', 'DISTRIBUTION', 'REIMBURSEMENT', 'ADVANCE', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "tax_withholding_policy" AS ENUM ('YES', 'NO', 'EVALUATE_PER_ENTRY');

-- CreateEnum
CREATE TYPE "tax_withholding_type" AS ENUM ('INSS', 'IRRF', 'ISS', 'PIS', 'COFINS', 'CSLL', 'OTHER');

-- CreateEnum
CREATE TYPE "allocation_type" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "supplier_contract_status" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_category_id" UUID,
    "name" TEXT NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_institutions" (
    "id" UUID NOT NULL,
    "compe_code" TEXT,
    "ispb" TEXT,
    "legal_name" TEXT NOT NULL,
    "short_name" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "person_type" "supplier_person_type" NOT NULL DEFAULT 'LEGAL_ENTITY',
    "document_number" TEXT,
    "normalized_document_number" TEXT,
    "legal_name" TEXT,
    "trade_name" TEXT,
    "display_name" TEXT,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "opening_date" TIMESTAMP(3),
    "legal_nature" TEXT,
    "company_size" TEXT,
    "share_capital" DECIMAL(18,2),
    "external_registration_status" TEXT,
    "external_registration_status_date" TIMESTAMP(3),
    "main_cnae" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'BR',
    "segment" TEXT,
    "foreign_tax_id" TEXT,
    "foreign_country" TEXT,
    "foreign_currency" TEXT,
    "system_status" "supplier_system_status" NOT NULL DEFAULT 'DRAFT',
    "general_notes" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "email_financial" TEXT,
    "email_payment_receipts" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_addresses" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "address_type" "supplier_address_type" NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_financial_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_commercial_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_invoice_responsible" BOOLEAN NOT NULL DEFAULT false,
    "is_billing_responsible" BOOLEAN NOT NULL DEFAULT false,
    "receives_payment_receipts" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_cnaes" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "cnae_code" TEXT NOT NULL,
    "description" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_cnaes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_alternative_names" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_alternative_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bank_accounts" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "financial_institution_id" UUID,
    "branch_number" TEXT NOT NULL,
    "branch_digit" TEXT,
    "account_number" TEXT NOT NULL,
    "account_digit" TEXT,
    "normalized_account_identifier" TEXT,
    "account_type" "supplier_bank_account_type" NOT NULL,
    "holder_name" TEXT NOT NULL,
    "holder_document" TEXT NOT NULL,
    "normalized_holder_document" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_third_party" BOOLEAN NOT NULL DEFAULT false,
    "third_party_reason" TEXT,
    "third_party_approved_by" UUID,
    "third_party_approved_at" TIMESTAMP(3),
    "verification_status" "bank_data_verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "change_status" "bank_data_change_status" NOT NULL DEFAULT 'NOT_REQUIRED',
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "proof_document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_pix_keys" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "bank_account_id" UUID,
    "pix_type" "pix_key_type" NOT NULL,
    "pix_key" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "holder_document" TEXT NOT NULL,
    "normalized_holder_document" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_third_party" BOOLEAN NOT NULL DEFAULT false,
    "third_party_reason" TEXT,
    "verification_status" "bank_data_verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "change_status" "bank_data_change_status" NOT NULL DEFAULT 'NOT_REQUIRED',
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "proof_document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_pix_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bank_identifiers" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
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

    CONSTRAINT "supplier_bank_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_company_links" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "internal_code" TEXT,
    "supplier_types" "supplier_type"[],
    "default_category_id" UUID,
    "default_subcategory_id" UUID,
    "default_cost_center_id" UUID,
    "default_accounting_account" TEXT,
    "default_description" TEXT,
    "default_history" TEXT,
    "financial_nature" "financial_nature",
    "category_required" BOOLEAN NOT NULL DEFAULT false,
    "cost_center_required" BOOLEAN NOT NULL DEFAULT false,
    "preferred_payment_method" "payment_method",
    "payment_term_days" INTEGER,
    "payment_term_fixed_due_day" INTEGER,
    "payment_term_periodicity" TEXT,
    "preferred_bank_account_id" UUID,
    "preferred_pix_key_id" UUID,
    "minimum_amount" DECIMAL(18,2),
    "maximum_amount_without_approval" DECIMAL(18,2),
    "has_contract" BOOLEAN NOT NULL DEFAULT false,
    "requires_matching_beneficiary" BOOLEAN NOT NULL DEFAULT true,
    "allows_third_party_payment" BOOLEAN NOT NULL DEFAULT false,
    "tax_withholding_policy" "tax_withholding_policy",
    "allocation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_identification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_classification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_cost_center_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_allocation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reconciliation_suggestion_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_entry_creation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_reconciliation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "confirmation_threshold" DECIMAL(5,2) NOT NULL DEFAULT 95,
    "status" "supplier_link_status" NOT NULL DEFAULT 'DRAFT',
    "block_reason" TEXT,
    "suspension_reason" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_company_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_classification_rules" (
    "id" UUID NOT NULL,
    "supplier_company_link_id" UUID NOT NULL,
    "ruleType" TEXT,
    "condition_field" TEXT NOT NULL,
    "condition_operator" TEXT NOT NULL,
    "condition_value" TEXT NOT NULL,
    "normalized_value" TEXT,
    "category_id" UUID,
    "subcategory_id" UUID,
    "cost_center_id" UUID,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "confidence" DECIMAL(5,2),
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_default_allocations" (
    "id" UUID NOT NULL,
    "supplier_company_link_id" UUID NOT NULL,
    "category_id" UUID,
    "cost_center_id" UUID,
    "allocation_type" "allocation_type" NOT NULL,
    "percentage" DECIMAL(5,2),
    "fixed_amount" DECIMAL(18,2),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_default_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_tax_withholdings" (
    "id" UUID NOT NULL,
    "supplier_company_link_id" UUID NOT NULL,
    "tax_type" "tax_withholding_type" NOT NULL,
    "rate" DECIMAL(5,2),
    "minimum_amount" DECIMAL(18,2),
    "calculation_base" TEXT,
    "service_code" TEXT,
    "city_code" TEXT,
    "revenue_code" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_tax_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contracts" (
    "id" UUID NOT NULL,
    "supplier_company_link_id" UUID NOT NULL,
    "contract_number" TEXT,
    "description" TEXT,
    "object" TEXT,
    "contract_value" DECIMAL(18,2),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "automatic_renewal" BOOLEAN NOT NULL DEFAULT false,
    "billing_frequency" TEXT,
    "adjustment_index" TEXT,
    "adjustment_date" TIMESTAMP(3),
    "internal_responsible_id" UUID,
    "supplier_contact_id" UUID,
    "status" "supplier_contract_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "supplier_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_registry_queries" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "supplier_id" UUID,
    "document_number" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "request_status" "registry_query_status" NOT NULL,
    "response_summary" JSONB,
    "queried_by" UUID,
    "queried_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "supplier_registry_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_status_history" (
    "id" UUID NOT NULL,
    "supplier_id" UUID,
    "supplier_company_link_id" UUID,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_recognition_learning" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "company_id" UUID,
    "supplier_id" UUID,
    "supplier_company_link_id" UUID,
    "original_text" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "source_type" TEXT,
    "category_id" UUID,
    "cost_center_id" UUID,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "confidence" DECIMAL(5,2),
    "last_confirmed_by" UUID,
    "last_confirmed_at" TIMESTAMP(3),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_recognition_learning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "company_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "document_type" TEXT,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_company_id_idx" ON "categories"("company_id");

-- CreateIndex
CREATE INDEX "cost_centers_company_id_idx" ON "cost_centers"("company_id");

-- CreateIndex
CREATE INDEX "financial_institutions_ispb_idx" ON "financial_institutions"("ispb");

-- CreateIndex
CREATE INDEX "financial_institutions_legal_name_idx" ON "financial_institutions"("legal_name");

-- CreateIndex
CREATE UNIQUE INDEX "financial_institutions_compe_code_key" ON "financial_institutions"("compe_code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_normalized_document_number_key" ON "suppliers"("normalized_document_number");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "suppliers_system_status_idx" ON "suppliers"("system_status");

-- CreateIndex
CREATE INDEX "supplier_addresses_supplier_id_idx" ON "supplier_addresses"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_cnaes_supplier_id_idx" ON "supplier_cnaes"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_cnaes_supplier_id_cnae_code_key" ON "supplier_cnaes"("supplier_id", "cnae_code");

-- CreateIndex
CREATE INDEX "supplier_alternative_names_supplier_id_idx" ON "supplier_alternative_names"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_bank_accounts_supplier_id_idx" ON "supplier_bank_accounts"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_pix_keys_normalized_key_key" ON "supplier_pix_keys"("normalized_key");

-- CreateIndex
CREATE INDEX "supplier_pix_keys_supplier_id_idx" ON "supplier_pix_keys"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_bank_identifiers_supplier_id_idx" ON "supplier_bank_identifiers"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_bank_identifiers_normalized_value_idx" ON "supplier_bank_identifiers"("normalized_value");

-- CreateIndex
CREATE INDEX "supplier_company_links_company_id_idx" ON "supplier_company_links"("company_id");

-- CreateIndex
CREATE INDEX "supplier_company_links_supplier_id_idx" ON "supplier_company_links"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_company_links_supplier_id_company_id_key" ON "supplier_company_links"("supplier_id", "company_id");

-- CreateIndex
CREATE INDEX "supplier_classification_rules_supplier_company_link_id_idx" ON "supplier_classification_rules"("supplier_company_link_id");

-- CreateIndex
CREATE INDEX "supplier_default_allocations_supplier_company_link_id_idx" ON "supplier_default_allocations"("supplier_company_link_id");

-- CreateIndex
CREATE INDEX "supplier_tax_withholdings_supplier_company_link_id_idx" ON "supplier_tax_withholdings"("supplier_company_link_id");

-- CreateIndex
CREATE INDEX "supplier_contracts_supplier_company_link_id_idx" ON "supplier_contracts"("supplier_company_link_id");

-- CreateIndex
CREATE INDEX "supplier_registry_queries_document_number_idx" ON "supplier_registry_queries"("document_number");

-- CreateIndex
CREATE INDEX "supplier_registry_queries_supplier_id_idx" ON "supplier_registry_queries"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_status_history_supplier_id_idx" ON "supplier_status_history"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_status_history_supplier_company_link_id_idx" ON "supplier_status_history"("supplier_company_link_id");

-- CreateIndex
CREATE INDEX "supplier_recognition_learning_supplier_id_idx" ON "supplier_recognition_learning"("supplier_id");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_cnaes" ADD CONSTRAINT "supplier_cnaes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_alternative_names" ADD CONSTRAINT "supplier_alternative_names_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bank_accounts" ADD CONSTRAINT "supplier_bank_accounts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bank_accounts" ADD CONSTRAINT "supplier_bank_accounts_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "financial_institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_pix_keys" ADD CONSTRAINT "supplier_pix_keys_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_pix_keys" ADD CONSTRAINT "supplier_pix_keys_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "supplier_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bank_identifiers" ADD CONSTRAINT "supplier_bank_identifiers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_company_links" ADD CONSTRAINT "supplier_company_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_company_links" ADD CONSTRAINT "supplier_company_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_company_links" ADD CONSTRAINT "supplier_company_links_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_company_links" ADD CONSTRAINT "supplier_company_links_default_subcategory_id_fkey" FOREIGN KEY ("default_subcategory_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_company_links" ADD CONSTRAINT "supplier_company_links_default_cost_center_id_fkey" FOREIGN KEY ("default_cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_classification_rules" ADD CONSTRAINT "supplier_classification_rules_supplier_company_link_id_fkey" FOREIGN KEY ("supplier_company_link_id") REFERENCES "supplier_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_default_allocations" ADD CONSTRAINT "supplier_default_allocations_supplier_company_link_id_fkey" FOREIGN KEY ("supplier_company_link_id") REFERENCES "supplier_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_tax_withholdings" ADD CONSTRAINT "supplier_tax_withholdings_supplier_company_link_id_fkey" FOREIGN KEY ("supplier_company_link_id") REFERENCES "supplier_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_supplier_company_link_id_fkey" FOREIGN KEY ("supplier_company_link_id") REFERENCES "supplier_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_supplier_contact_id_fkey" FOREIGN KEY ("supplier_contact_id") REFERENCES "supplier_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_registry_queries" ADD CONSTRAINT "supplier_registry_queries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_registry_queries" ADD CONSTRAINT "supplier_registry_queries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_status_history" ADD CONSTRAINT "supplier_status_history_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_status_history" ADD CONSTRAINT "supplier_status_history_supplier_company_link_id_fkey" FOREIGN KEY ("supplier_company_link_id") REFERENCES "supplier_company_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

