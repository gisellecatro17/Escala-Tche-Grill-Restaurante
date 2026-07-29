-- CreateEnum
CREATE TYPE "account_plan_type" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'EXPENSE', 'RESULT', 'COMPENSATION', 'OTHER');

-- CreateEnum
CREATE TYPE "account_kind" AS ENUM ('SYNTHETIC', 'ANALYTICAL');

-- CreateEnum
CREATE TYPE "financial_nature_kind" AS ENUM ('REVENUE', 'EXPENSE', 'COST', 'INVESTMENT', 'TAX', 'TRANSFER', 'REIMBURSEMENT', 'LOAN', 'FINANCIAL_APPLICATION', 'PARTNER_WITHDRAWAL', 'CAPITAL_CONTRIBUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('PLANNING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "allocation_criterion" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'QUANTITY', 'HOURS', 'WEIGHT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "allocation_target_type" AS ENUM ('COST_CENTER', 'RESULT_CENTER', 'PROJECT', 'BUSINESS_UNIT', 'CATEGORY', 'ACCOUNT_PLAN');

-- CreateEnum
CREATE TYPE "classification_match_type" AS ENUM ('CONTAINS', 'EQUALS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'AMOUNT_RANGE', 'DOCUMENT_NUMBER');

-- CreateEnum
CREATE TYPE "classification_match_field" AS ENUM ('DESCRIPTION', 'COUNTERPARTY_NAME', 'COUNTERPARTY_DOCUMENT', 'BANK_HISTORY', 'AMOUNT', 'DOCUMENT_NUMBER');

-- CreateEnum
CREATE TYPE "transaction_origin" AS ENUM ('ANY', 'OFX', 'PIX', 'TED', 'DOC', 'BOLETO', 'CARD', 'CASH', 'MANUAL');

-- CreateEnum
CREATE TYPE "classification_rule_source" AS ENUM ('MANUAL', 'IMPORTED', 'LEARNED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "hierarchy_entity" AS ENUM ('ACCOUNT_PLAN', 'CATEGORY', 'COST_CENTER', 'RESULT_CENTER', 'BUSINESS_UNIT', 'PROJECT');

-- CreateEnum
CREATE TYPE "structure_import_format" AS ENUM ('EXCEL', 'CSV', 'CONTA_AZUL', 'OMIE', 'SAP', 'TOTVS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "structure_import_status" AS ENUM ('PENDING', 'VALIDATED', 'APPLIED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "account_plan_id" UUID,
ADD COLUMN     "auto_classification_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code" VARCHAR(50),
ADD COLUMN     "color" VARCHAR(20),
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "default_allocation_rule_id" UUID,
ADD COLUMN     "default_bank_account_id" UUID,
ADD COLUMN     "default_business_unit_id" UUID,
ADD COLUMN     "default_cost_center_id" UUID,
ADD COLUMN     "default_customer_id" UUID,
ADD COLUMN     "default_description" TEXT,
ADD COLUMN     "default_history" TEXT,
ADD COLUMN     "default_payment_method" "payment_method",
ADD COLUMN     "default_project_id" UUID,
ADD COLUMN     "default_result_center_id" UUID,
ADD COLUMN     "default_supplier_id" UUID,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "financial_nature_id" UUID,
ADD COLUMN     "icon" VARCHAR(50),
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "management_account" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "cost_centers" ADD COLUMN     "accepts_entries" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code" VARCHAR(50),
ADD COLUMN     "color" VARCHAR(20),
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" VARCHAR(50),
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parent_cost_center_id" UUID,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "responsible_user_id" UUID,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by" UUID;

-- CreateTable
CREATE TABLE "financial_account_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "parent_account_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "account_type" "account_plan_type" NOT NULL DEFAULT 'EXPENSE',
    "account_kind" "account_kind" NOT NULL DEFAULT 'ANALYTICAL',
    "financial_nature_id" UUID,
    "accepts_entries" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "notes" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "financial_account_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_centers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_result_center_id" UUID,
    "code" VARCHAR(50),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "notes" TEXT,
    "accepts_entries" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "responsible_user_id" UUID,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "result_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customer_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "business_unit_id" UUID,
    "responsible_user_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "status" "project_status" NOT NULL DEFAULT 'PLANNING',
    "budget_amount" DECIMAL(18,2),
    "realized_amount" DECIMAL(18,2),
    "margin_percentage" DECIMAL(7,4),
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "notes" TEXT,
    "record_status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "parent_business_unit_id" UUID,
    "code" VARCHAR(50),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "notes" TEXT,
    "responsible_user_id" UUID,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_natures" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "code" VARCHAR(50),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "financial_nature_kind" NOT NULL DEFAULT 'EXPENSE',
    "affects_result" BOOLEAN NOT NULL DEFAULT true,
    "affects_cash_flow" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "financial_natures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "group" VARCHAR(80),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "financial_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_tag_links" (
    "id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "category_id" UUID,
    "account_plan_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "financial_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_rules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "match_field" "classification_match_field" NOT NULL DEFAULT 'DESCRIPTION',
    "match_type" "classification_match_type" NOT NULL DEFAULT 'CONTAINS',
    "match_value" TEXT NOT NULL,
    "case_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "min_amount" DECIMAL(18,2),
    "max_amount" DECIMAL(18,2),
    "origin" "transaction_origin" NOT NULL DEFAULT 'ANY',
    "category_id" UUID,
    "subcategory_id" UUID,
    "account_plan_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "financial_nature_id" UUID,
    "allocation_rule_id" UUID,
    "supplier_id" UUID,
    "customer_id" UUID,
    "applied_description" TEXT,
    "applied_history" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "confidence_threshold" INTEGER NOT NULL DEFAULT 95,
    "auto_apply" BOOLEAN NOT NULL DEFAULT false,
    "source" "classification_rule_source" NOT NULL DEFAULT 'MANUAL',
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "last_matched_at" TIMESTAMP(3),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_rules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criterion" "allocation_criterion" NOT NULL DEFAULT 'PERCENTAGE',
    "category_id" UUID,
    "custom_criterion_label" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_rule_lines" (
    "id" UUID NOT NULL,
    "allocation_rule_id" UUID NOT NULL,
    "target_type" "allocation_target_type" NOT NULL,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "category_id" UUID,
    "account_plan_id" UUID,
    "percentage" DECIMAL(7,4),
    "fixed_amount" DECIMAL(18,2),
    "weight" DECIMAL(18,4),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_rule_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_hierarchy_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "entity" "hierarchy_entity" NOT NULL,
    "version_number" INTEGER NOT NULL,
    "label" TEXT,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "financial_hierarchy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_structure_imports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "entity" "hierarchy_entity" NOT NULL,
    "format" "structure_import_format" NOT NULL DEFAULT 'CSV',
    "status" "structure_import_status" NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "created_rows" INTEGER NOT NULL DEFAULT 0,
    "updated_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "preview" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_by" UUID,

    CONSTRAINT "financial_structure_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_account_plans_organization_id_idx" ON "financial_account_plans"("organization_id");

-- CreateIndex
CREATE INDEX "financial_account_plans_company_id_idx" ON "financial_account_plans"("company_id");

-- CreateIndex
CREATE INDEX "financial_account_plans_parent_account_id_idx" ON "financial_account_plans"("parent_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_account_plans_organization_id_company_id_code_key" ON "financial_account_plans"("organization_id", "company_id", "code");

-- CreateIndex
CREATE INDEX "result_centers_company_id_idx" ON "result_centers"("company_id");

-- CreateIndex
CREATE INDEX "result_centers_company_id_parent_result_center_id_idx" ON "result_centers"("company_id", "parent_result_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "result_centers_company_id_code_key" ON "result_centers"("company_id", "code");

-- CreateIndex
CREATE INDEX "projects_company_id_idx" ON "projects"("company_id");

-- CreateIndex
CREATE INDEX "projects_customer_id_idx" ON "projects"("customer_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_company_id_code_key" ON "projects"("company_id", "code");

-- CreateIndex
CREATE INDEX "business_units_organization_id_idx" ON "business_units"("organization_id");

-- CreateIndex
CREATE INDEX "business_units_company_id_idx" ON "business_units"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_organization_id_company_id_code_key" ON "business_units"("organization_id", "company_id", "code");

-- CreateIndex
CREATE INDEX "financial_natures_organization_id_idx" ON "financial_natures"("organization_id");

-- CreateIndex
CREATE INDEX "financial_natures_company_id_idx" ON "financial_natures"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_natures_organization_id_company_id_code_key" ON "financial_natures"("organization_id", "company_id", "code");

-- CreateIndex
CREATE INDEX "financial_tags_organization_id_idx" ON "financial_tags"("organization_id");

-- CreateIndex
CREATE INDEX "financial_tags_company_id_idx" ON "financial_tags"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_tags_organization_id_company_id_slug_key" ON "financial_tags"("organization_id", "company_id", "slug");

-- CreateIndex
CREATE INDEX "financial_tag_links_entity_type_entity_id_idx" ON "financial_tag_links"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "financial_tag_links_tag_id_idx" ON "financial_tag_links"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_tag_links_tag_id_entity_type_entity_id_key" ON "financial_tag_links"("tag_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "classification_rules_company_id_idx" ON "classification_rules"("company_id");

-- CreateIndex
CREATE INDEX "classification_rules_company_id_priority_idx" ON "classification_rules"("company_id", "priority");

-- CreateIndex
CREATE INDEX "classification_rules_category_id_idx" ON "classification_rules"("category_id");

-- CreateIndex
CREATE INDEX "allocation_rules_company_id_idx" ON "allocation_rules"("company_id");

-- CreateIndex
CREATE INDEX "allocation_rules_category_id_idx" ON "allocation_rules"("category_id");

-- CreateIndex
CREATE INDEX "allocation_rule_lines_allocation_rule_id_idx" ON "allocation_rule_lines"("allocation_rule_id");

-- CreateIndex
CREATE INDEX "financial_hierarchy_versions_organization_id_idx" ON "financial_hierarchy_versions"("organization_id");

-- CreateIndex
CREATE INDEX "financial_hierarchy_versions_company_id_entity_idx" ON "financial_hierarchy_versions"("company_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "financial_hierarchy_versions_organization_id_company_id_ent_key" ON "financial_hierarchy_versions"("organization_id", "company_id", "entity", "version_number");

-- CreateIndex
CREATE INDEX "financial_structure_imports_organization_id_idx" ON "financial_structure_imports"("organization_id");

-- CreateIndex
CREATE INDEX "financial_structure_imports_company_id_entity_idx" ON "financial_structure_imports"("company_id", "entity");

-- CreateIndex
CREATE INDEX "categories_company_id_parent_category_id_idx" ON "categories"("company_id", "parent_category_id");

-- CreateIndex
CREATE INDEX "categories_account_plan_id_idx" ON "categories"("account_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_company_id_code_key" ON "categories"("company_id", "code");

-- CreateIndex
CREATE INDEX "cost_centers_company_id_parent_cost_center_id_idx" ON "cost_centers"("company_id", "parent_cost_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_company_id_code_key" ON "cost_centers"("company_id", "code");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_financial_nature_id_fkey" FOREIGN KEY ("financial_nature_id") REFERENCES "financial_natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_cost_center_id_fkey" FOREIGN KEY ("default_cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_result_center_id_fkey" FOREIGN KEY ("default_result_center_id") REFERENCES "result_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_project_id_fkey" FOREIGN KEY ("default_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_business_unit_id_fkey" FOREIGN KEY ("default_business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_allocation_rule_id_fkey" FOREIGN KEY ("default_allocation_rule_id") REFERENCES "allocation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parent_cost_center_id_fkey" FOREIGN KEY ("parent_cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_financial_nature_id_fkey" FOREIGN KEY ("financial_nature_id") REFERENCES "financial_natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_centers" ADD CONSTRAINT "result_centers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_centers" ADD CONSTRAINT "result_centers_parent_result_center_id_fkey" FOREIGN KEY ("parent_result_center_id") REFERENCES "result_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_result_center_id_fkey" FOREIGN KEY ("result_center_id") REFERENCES "result_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_parent_business_unit_id_fkey" FOREIGN KEY ("parent_business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_natures" ADD CONSTRAINT "financial_natures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_natures" ADD CONSTRAINT "financial_natures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tags" ADD CONSTRAINT "financial_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tags" ADD CONSTRAINT "financial_tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "financial_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_result_center_id_fkey" FOREIGN KEY ("result_center_id") REFERENCES "result_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tag_links" ADD CONSTRAINT "financial_tag_links_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_result_center_id_fkey" FOREIGN KEY ("result_center_id") REFERENCES "result_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_financial_nature_id_fkey" FOREIGN KEY ("financial_nature_id") REFERENCES "financial_natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_allocation_rule_id_fkey" FOREIGN KEY ("allocation_rule_id") REFERENCES "allocation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_allocation_rule_id_fkey" FOREIGN KEY ("allocation_rule_id") REFERENCES "allocation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_result_center_id_fkey" FOREIGN KEY ("result_center_id") REFERENCES "result_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_hierarchy_versions" ADD CONSTRAINT "financial_hierarchy_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_hierarchy_versions" ADD CONSTRAINT "financial_hierarchy_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_structure_imports" ADD CONSTRAINT "financial_structure_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_structure_imports" ADD CONSTRAINT "financial_structure_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

