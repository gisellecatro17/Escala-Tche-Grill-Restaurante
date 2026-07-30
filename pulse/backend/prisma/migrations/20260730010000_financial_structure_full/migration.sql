-- CreateEnum
CREATE TYPE "structure_status" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "account_plan_kind" AS ENUM ('MANAGEMENT', 'FINANCIAL', 'ACCOUNTING', 'HYBRID');

-- CreateEnum
CREATE TYPE "account_plan_version_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "financial_category_type" AS ENUM ('REVENUE', 'EXPENSE', 'COST', 'INVESTMENT', 'TRANSFER', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "financial_nature_group" AS ENUM ('REVENUE', 'COST', 'EXPENSE', 'INVESTMENT', 'TAX', 'FINANCIAL', 'EQUITY', 'TRANSFER', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "nature_effect" AS ENUM ('INCREASE', 'DECREASE', 'NONE');

-- CreateEnum
CREATE TYPE "flow_direction" AS ENUM ('INFLOW', 'OUTFLOW', 'BOTH', 'NONE');

-- CreateEnum
CREATE TYPE "project_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "business_unit_type" AS ENUM ('OPERATIONAL_UNIT', 'MANAGEMENT_BRANCH', 'BUSINESS_LINE', 'DEPARTMENT', 'CHANNEL', 'PRODUCT', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "tag_scope" AS ENUM ('ORGANIZATION', 'COMPANY', 'SUPPLIER', 'CUSTOMER', 'ENTRY', 'CONTRACT', 'PROJECT', 'RECONCILIATION', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "rule_condition_field" AS ENUM ('DOCUMENT_NUMBER', 'CNPJ', 'CPF', 'SUPPLIER', 'CUSTOMER', 'KEYWORD', 'DESCRIPTION', 'BANK_HISTORY', 'PIX_KEY', 'BANK_ACCOUNT', 'BANK', 'TRANSACTION_TYPE', 'AMOUNT', 'DATE', 'WEEKDAY', 'DAY_OF_MONTH', 'COMPANY_BANK_ACCOUNT', 'CONTRACT', 'PROJECT', 'ORIGIN', 'PREVIOUS_CATEGORY', 'CONFIRMATION_COUNT');

-- CreateEnum
CREATE TYPE "rule_condition_operator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'GREATER_THAN', 'LESS_THAN', 'BETWEEN', 'IN', 'NOT_IN', 'EXISTS', 'NOT_EXISTS');

-- CreateEnum
CREATE TYPE "structure_import_mode" AS ENUM ('INSERT_ONLY', 'UPDATE_ONLY', 'INSERT_AND_UPDATE', 'SIMULATE');

-- CreateEnum
CREATE TYPE "import_row_status" AS ENUM ('VALID', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "diagnostic_severity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- AlterEnum
ALTER TYPE "account_plan_type" ADD VALUE 'TRANSFER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "financial_nature_kind" ADD VALUE 'OPERATING_REVENUE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'NON_OPERATING_REVENUE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'FINANCIAL_REVENUE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'DIRECT_COST';
ALTER TYPE "financial_nature_kind" ADD VALUE 'INDIRECT_COST';
ALTER TYPE "financial_nature_kind" ADD VALUE 'OPERATING_EXPENSE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'ADMINISTRATIVE_EXPENSE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'COMMERCIAL_EXPENSE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'FINANCIAL_EXPENSE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'ADVANCE';
ALTER TYPE "financial_nature_kind" ADD VALUE 'FINANCING';
ALTER TYPE "financial_nature_kind" ADD VALUE 'REDEMPTION';
ALTER TYPE "financial_nature_kind" ADD VALUE 'PROFIT_DISTRIBUTION';
ALTER TYPE "financial_nature_kind" ADD VALUE 'ADJUSTMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "project_status" ADD VALUE 'DRAFT';
ALTER TYPE "project_status" ADD VALUE 'IN_APPROVAL';
ALTER TYPE "project_status" ADD VALUE 'DELAYED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "allocation_criterion" ADD VALUE 'AREA';
ALTER TYPE "allocation_criterion" ADD VALUE 'CONSUMPTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "transaction_origin" ADD VALUE 'PDF_DOCUMENT';
ALTER TYPE "transaction_origin" ADD VALUE 'INVOICE';
ALTER TYPE "transaction_origin" ADD VALUE 'XML';
ALTER TYPE "transaction_origin" ADD VALUE 'SPREADSHEET';
ALTER TYPE "transaction_origin" ADD VALUE 'INTEGRATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "structure_import_format" ADD VALUE 'XLSX';
ALTER TYPE "structure_import_format" ADD VALUE 'JSON';
ALTER TYPE "structure_import_format" ADD VALUE 'SANKHYA';
ALTER TYPE "structure_import_format" ADD VALUE 'BLING';

-- AlterTable
ALTER TABLE "financial_categories" ADD COLUMN     "allows_allocation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allows_budget" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category_type" "financial_category_type" NOT NULL DEFAULT 'EXPENSE',
ADD COLUMN     "default_receipt_method" "payment_method",
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "normalized_code" VARCHAR(50),
ADD COLUMN     "requires_allocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_business_unit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_cost_center" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_customer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_document" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_project" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_result_center" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_subcategory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_supplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "short_name" VARCHAR(60),
ADD COLUMN     "show_in_cash_flow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_in_income_statement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_in_reports" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "cost_centers" ADD COLUMN     "budget_amount" DECIMAL(18,2),
ADD COLUMN     "business_unit_id" UUID,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "manager_user_id" UUID,
ADD COLUMN     "normalized_code" VARCHAR(50),
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "financial_account_plans" ADD COLUMN     "account_group" VARCHAR(80),
ADD COLUMN     "allows_allocations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allows_budget" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "normalized_code" VARCHAR(50),
ADD COLUMN     "plan_type" "account_plan_kind" NOT NULL DEFAULT 'MANAGEMENT',
ADD COLUMN     "short_name" VARCHAR(60),
ADD COLUMN     "show_in_cash_flow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_in_income_statement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_in_management_balance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "show_in_reports" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version_id" UUID;

-- AlterTable
ALTER TABLE "result_centers" ADD COLUMN     "budget_amount" DECIMAL(18,2),
ADD COLUMN     "business_unit_id" UUID,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "margin_target_percentage" DECIMAL(7,4),
ADD COLUMN     "normalized_code" VARCHAR(50),
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "primary_customer_id" UUID,
ADD COLUMN     "primary_product_service" TEXT,
ADD COLUMN     "revenue_target" DECIMAL(18,2),
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "actual_end_date" DATE,
ADD COLUMN     "completion_percentage" DECIMAL(5,2),
ADD COLUMN     "cost_budget" DECIMAL(18,2),
ADD COLUMN     "expense_budget" DECIMAL(18,2),
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "normalized_code" VARCHAR(50),
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "parent_project_id" UUID,
ADD COLUMN     "planned_margin_percentage" DECIMAL(7,4),
ADD COLUMN     "primary_supplier_id" UUID,
ADD COLUMN     "priority" "project_priority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "realized_cost" DECIMAL(18,2),
ADD COLUMN     "realized_expense" DECIMAL(18,2),
ADD COLUMN     "realized_revenue" DECIMAL(18,2),
ADD COLUMN     "revenue_budget" DECIMAL(18,2),
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "business_units" ADD COLUMN     "address_id" UUID,
ADD COLUMN     "budget_amount" DECIMAL(18,2),
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "normalized_code" VARCHAR(50),
ADD COLUMN     "revenue_target" DECIMAL(18,2),
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "unit_type" "business_unit_type" NOT NULL DEFAULT 'OPERATIONAL_UNIT';

-- AlterTable
ALTER TABLE "financial_natures" ADD COLUMN     "cash_effect" "nature_effect" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "equity_effect" "nature_effect" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "flow_direction" "flow_direction" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "nature_group" "financial_nature_group" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "result_effect" "nature_effect" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "show_in_cash_flow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_in_dashboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_in_income_statement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "financial_tags" ADD COLUMN     "normalized_name" TEXT,
ADD COLUMN     "scope" "tag_scope" NOT NULL DEFAULT 'ORGANIZATION',
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "financial_tag_links" ADD COLUMN     "company_id" UUID,
ADD COLUMN     "organization_id" UUID;

-- AlterTable
ALTER TABLE "classification_rules" ADD COLUMN     "automatic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source_type" "transaction_origin" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "allocation_rules" ADD COLUMN     "allocation_type" "allocation_criterion" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "default_customer_id" UUID,
ADD COLUMN     "default_supplier_id" UUID,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "structure_status" "structure_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "allocation_rule_items" ADD COLUMN     "quantity_factor" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "financial_structure_imports" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "import_mode" "structure_import_mode" NOT NULL DEFAULT 'INSERT_ONLY',
ADD COLUMN     "mapping_configuration" JSONB,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "started_by" UUID,
ADD COLUMN     "storage_path" TEXT,
ADD COLUMN     "warning_rows" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "financial_account_plan_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version_number" INTEGER NOT NULL,
    "plan_type" "account_plan_kind" NOT NULL DEFAULT 'MANAGEMENT',
    "start_date" DATE,
    "end_date" DATE,
    "status" "account_plan_version_status" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "previous_version_id" UUID,
    "activated_by" UUID,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "financial_account_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_rule_conditions" (
    "id" UUID NOT NULL,
    "classification_rule_id" UUID NOT NULL,
    "field" "rule_condition_field" NOT NULL,
    "operator" "rule_condition_operator" NOT NULL,
    "value" TEXT NOT NULL,
    "normalized_value" TEXT,
    "secondary_value" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_rule_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_rule_actions" (
    "id" UUID NOT NULL,
    "classification_rule_id" UUID NOT NULL,
    "supplier_id" UUID,
    "customer_id" UUID,
    "category_id" UUID,
    "subcategory_id" UUID,
    "account_plan_id" UUID,
    "cost_center_id" UUID,
    "result_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "financial_nature_id" UUID,
    "allocation_rule_id" UUID,
    "payment_method_id" UUID,
    "bank_account_id" UUID,
    "tag_id" UUID,
    "default_description" TEXT,
    "default_history" TEXT,
    "responsible_user_id" UUID,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "suggest_reconciliation" BOOLEAN NOT NULL DEFAULT false,
    "create_financial_entry" BOOLEAN NOT NULL DEFAULT false,
    "auto_match" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_rule_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_structure_import_rows" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "original_data" JSONB NOT NULL,
    "normalized_data" JSONB,
    "validation_status" "import_row_status" NOT NULL DEFAULT 'VALID',
    "validation_errors" JSONB,
    "created_entity_type" VARCHAR(50),
    "created_entity_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_structure_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_hierarchy_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID,
    "entity_type" "hierarchy_entity" NOT NULL,
    "entity_id" UUID NOT NULL,
    "previous_parent_id" UUID,
    "new_parent_id" UUID,
    "previous_code" VARCHAR(50),
    "new_code" VARCHAR(50),
    "previous_level" INTEGER,
    "new_level" INTEGER,
    "reason" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_hierarchy_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_account_plan_versions_organization_id_idx" ON "financial_account_plan_versions"("organization_id");

-- CreateIndex
CREATE INDEX "financial_account_plan_versions_company_id_status_idx" ON "financial_account_plan_versions"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_account_plan_versions_organization_id_company_id__key" ON "financial_account_plan_versions"("organization_id", "company_id", "plan_type", "version_number");

-- CreateIndex
CREATE INDEX "classification_rule_conditions_classification_rule_id_idx" ON "classification_rule_conditions"("classification_rule_id");

-- CreateIndex
CREATE INDEX "classification_rule_actions_classification_rule_id_idx" ON "classification_rule_actions"("classification_rule_id");

-- CreateIndex
CREATE INDEX "financial_structure_import_rows_import_id_validation_status_idx" ON "financial_structure_import_rows"("import_id", "validation_status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_structure_import_rows_import_id_row_number_key" ON "financial_structure_import_rows"("import_id", "row_number");

-- CreateIndex
CREATE INDEX "financial_hierarchy_history_organization_id_idx" ON "financial_hierarchy_history"("organization_id");

-- CreateIndex
CREATE INDEX "financial_hierarchy_history_entity_type_entity_id_idx" ON "financial_hierarchy_history"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plans" ADD CONSTRAINT "financial_account_plans_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "financial_account_plan_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_centers" ADD CONSTRAINT "result_centers_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_centers" ADD CONSTRAINT "result_centers_primary_customer_id_fkey" FOREIGN KEY ("primary_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_primary_supplier_id_fkey" FOREIGN KEY ("primary_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plan_versions" ADD CONSTRAINT "financial_account_plan_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plan_versions" ADD CONSTRAINT "financial_account_plan_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account_plan_versions" ADD CONSTRAINT "financial_account_plan_versions_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "financial_account_plan_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_conditions" ADD CONSTRAINT "classification_rule_conditions_classification_rule_id_fkey" FOREIGN KEY ("classification_rule_id") REFERENCES "classification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_classification_rule_id_fkey" FOREIGN KEY ("classification_rule_id") REFERENCES "classification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "financial_account_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_result_center_id_fkey" FOREIGN KEY ("result_center_id") REFERENCES "result_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_financial_nature_id_fkey" FOREIGN KEY ("financial_nature_id") REFERENCES "financial_natures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_allocation_rule_id_fkey" FOREIGN KEY ("allocation_rule_id") REFERENCES "allocation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rule_actions" ADD CONSTRAINT "classification_rule_actions_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "financial_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_structure_import_rows" ADD CONSTRAINT "financial_structure_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "financial_structure_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_hierarchy_history" ADD CONSTRAINT "financial_hierarchy_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_hierarchy_history" ADD CONSTRAINT "financial_hierarchy_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

