-- CreateEnum
CREATE TYPE "person_type" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');

-- CreateEnum
CREATE TYPE "establishment_type" AS ENUM ('HEADQUARTERS', 'BRANCH', 'OPERATING_UNIT');

-- CreateEnum
CREATE TYPE "company_system_status" AS ENUM ('DRAFT', 'IMPLEMENTATION', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "tax_regime" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'IMUNE', 'ISENTA', 'OUTRO');

-- CreateEnum
CREATE TYPE "accounting_criterion" AS ENUM ('ACCRUAL', 'CASH', 'MIXED', 'NOT_INFORMED');

-- CreateEnum
CREATE TYPE "company_address_type" AS ENUM ('FISCAL', 'OPERATIONAL', 'BILLING', 'CORRESPONDENCE');

-- CreateEnum
CREATE TYPE "company_contact_type" AS ENUM ('PRIMARY', 'FINANCIAL', 'FISCAL', 'ACCOUNTING', 'ADMINISTRATIVE', 'OPERATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "registry_query_status" AS ENUM ('SUCCESS', 'ERROR');

-- DropIndex
DROP INDEX "companies_document_key";

-- AlterTable
-- As colunas renomeadas (document -> document_number/normalized_document_number,
-- name -> legal_name, status -> system_status) são adicionadas primeiro, preenchidas a
-- partir dos dados existentes e só então as antigas são removidas — seguro mesmo em um
-- banco com registros (ex.: a empresa de demonstração do seed).
ALTER TABLE "companies"
ADD COLUMN     "accounting_firm_name" TEXT,
ADD COLUMN     "accounting_responsible_name" TEXT,
ADD COLUMN     "allow_future_entries" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_retroactive_entries" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "automatic_code_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "company_size" TEXT,
ADD COLUMN     "currency_code" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "deactivation_reason" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "document_number" TEXT,
ADD COLUMN     "email_financial" TEXT,
ADD COLUMN     "email_fiscal" TEXT,
ADD COLUMN     "establishment_type" "establishment_type" NOT NULL DEFAULT 'HEADQUARTERS',
ADD COLUMN     "external_registration_status" TEXT,
ADD COLUMN     "external_registration_status_date" TIMESTAMP(3),
ADD COLUMN     "financial_method" "accounting_criterion" NOT NULL DEFAULT 'ACCRUAL',
ADD COLUMN     "financial_month_start_day" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "icms_taxpayer" BOOLEAN,
ADD COLUMN     "implementation_start_date" TIMESTAMP(3),
ADD COLUMN     "internal_code" TEXT,
ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "legal_nature" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "main_cnae" TEXT,
ADD COLUMN     "month_closing_day" INTEGER NOT NULL DEFAULT 31,
ADD COLUMN     "municipal_registration" TEXT,
ADD COLUMN     "normalized_document_number" TEXT,
ADD COLUMN     "opening_date" TIMESTAMP(3),
ADD COLUMN     "parent_company_id" UUID,
ADD COLUMN     "person_type" "person_type" NOT NULL DEFAULT 'LEGAL_ENTITY',
ADD COLUMN     "phone_secondary" TEXT,
ADD COLUMN     "registration_notes" TEXT,
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_category" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requires_cost_center" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_customer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_supplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "share_capital" DECIMAL(18,2),
ADD COLUMN     "simples_nacional_exclusion_date" TIMESTAMP(3),
ADD COLUMN     "simples_nacional_optant" BOOLEAN,
ADD COLUMN     "simples_nacional_option_date" TIMESTAMP(3),
ADD COLUMN     "special_tax_regime" TEXT,
ADD COLUMN     "state_registration" TEXT,
ADD COLUMN     "suspension_reason" TEXT,
ADD COLUMN     "system_status" "company_system_status" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "tax_assessment_method" "accounting_criterion",
ADD COLUMN     "tax_notes" TEXT,
ADD COLUMN     "tax_regime" "tax_regime",
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- Backfill das colunas renomeadas a partir das colunas antigas
UPDATE "companies" SET
  "document_number" = "document",
  "normalized_document_number" = "document",
  "legal_name" = "name",
  "display_name" = COALESCE("trade_name", "name"),
  "system_status" = CASE "status"
    WHEN 'ACTIVE' THEN 'ACTIVE'
    WHEN 'INACTIVE' THEN 'INACTIVE'
    WHEN 'BLOCKED' THEN 'SUSPENDED'
    ELSE 'DRAFT'
  END::"company_system_status";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "document",
DROP COLUMN "name",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "user_company_roles" ADD COLUMN     "approval_limit" DECIMAL(18,2),
ADD COLUMN     "can_import_ofx" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_manage_settings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_reconcile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_view_bank_data" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_view_reports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "start_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "company_addresses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "address_type" "company_address_type" NOT NULL,
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

    CONSTRAINT "company_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contact_type" "company_contact_type" NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_cnaes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "cnae_code" TEXT NOT NULL,
    "description" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_cnaes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_registry_queries" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "company_id" UUID,
    "document_number" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "request_status" "registry_query_status" NOT NULL,
    "response_summary" JSONB,
    "queried_by" UUID,
    "queried_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "company_registry_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_status_history" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "previous_status" "company_system_status",
    "new_status" "company_system_status" NOT NULL,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_addresses_company_id_idx" ON "company_addresses"("company_id");

-- CreateIndex
CREATE INDEX "company_contacts_company_id_idx" ON "company_contacts"("company_id");

-- CreateIndex
CREATE INDEX "company_cnaes_company_id_idx" ON "company_cnaes"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_cnaes_company_id_cnae_code_key" ON "company_cnaes"("company_id", "cnae_code");

-- CreateIndex
CREATE INDEX "company_registry_queries_document_number_idx" ON "company_registry_queries"("document_number");

-- CreateIndex
CREATE INDEX "company_registry_queries_company_id_idx" ON "company_registry_queries"("company_id");

-- CreateIndex
CREATE INDEX "company_status_history_company_id_idx" ON "company_status_history"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_normalized_document_number_key" ON "companies"("normalized_document_number");

-- CreateIndex
CREATE INDEX "companies_parent_company_id_idx" ON "companies"("parent_company_id");

-- CreateIndex
CREATE INDEX "companies_system_status_idx" ON "companies"("system_status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_organization_id_internal_code_key" ON "companies"("organization_id", "internal_code");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_company_id_fkey" FOREIGN KEY ("parent_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_addresses" ADD CONSTRAINT "company_addresses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_addresses" ADD CONSTRAINT "company_addresses_same_as_address_id_fkey" FOREIGN KEY ("same_as_address_id") REFERENCES "company_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_cnaes" ADD CONSTRAINT "company_cnaes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_registry_queries" ADD CONSTRAINT "company_registry_queries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_registry_queries" ADD CONSTRAINT "company_registry_queries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_status_history" ADD CONSTRAINT "company_status_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

