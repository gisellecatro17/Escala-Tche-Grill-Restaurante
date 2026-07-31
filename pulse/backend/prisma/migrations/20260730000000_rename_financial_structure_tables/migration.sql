-- Renomeia as tabelas da estrutura financeira para os nomes exigidos pela especificação
-- completa do módulo (seções 53, 56 e 64). Usa ALTER TABLE ... RENAME em vez de
-- drop/create para preservar todos os dados, índices e as chaves estrangeiras já vivas
-- de `supplier_company_links` e `customer_company_links`, que apontam para `categories`.
--
-- Renomear a tabela no PostgreSQL não invalida as FKs de outras tabelas: elas referenciam
-- a relação por OID, não pelo nome. Também renomeamos as constraints e índices para que o
-- nome físico continue coerente com o nome da tabela.

-- ── categories -> financial_categories ──────────────────────────────────────
ALTER TABLE "categories" RENAME TO "financial_categories";

ALTER INDEX "categories_pkey" RENAME TO "financial_categories_pkey";
ALTER INDEX "categories_company_id_code_key" RENAME TO "financial_categories_company_id_code_key";
ALTER INDEX "categories_company_id_idx" RENAME TO "financial_categories_company_id_idx";
ALTER INDEX "categories_company_id_parent_category_id_idx" RENAME TO "financial_categories_company_id_parent_category_id_idx";
ALTER INDEX "categories_account_plan_id_idx" RENAME TO "financial_categories_account_plan_id_idx";

ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_company_id_fkey" TO "financial_categories_company_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_parent_category_id_fkey" TO "financial_categories_parent_category_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_account_plan_id_fkey" TO "financial_categories_account_plan_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_financial_nature_id_fkey" TO "financial_categories_financial_nature_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_default_cost_center_id_fkey" TO "financial_categories_default_cost_center_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_default_result_center_id_fkey" TO "financial_categories_default_result_center_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_default_project_id_fkey" TO "financial_categories_default_project_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_default_business_unit_id_fkey" TO "financial_categories_default_business_unit_id_fkey";
ALTER TABLE "financial_categories" RENAME CONSTRAINT "categories_default_allocation_rule_id_fkey" TO "financial_categories_default_allocation_rule_id_fkey";

-- ── allocation_rule_lines -> allocation_rule_items ──────────────────────────
ALTER TABLE "allocation_rule_lines" RENAME TO "allocation_rule_items";

ALTER INDEX "allocation_rule_lines_pkey" RENAME TO "allocation_rule_items_pkey";
ALTER INDEX "allocation_rule_lines_allocation_rule_id_idx" RENAME TO "allocation_rule_items_allocation_rule_id_idx";

ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_allocation_rule_id_fkey" TO "allocation_rule_items_allocation_rule_id_fkey";
ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_cost_center_id_fkey" TO "allocation_rule_items_cost_center_id_fkey";
ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_result_center_id_fkey" TO "allocation_rule_items_result_center_id_fkey";
ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_project_id_fkey" TO "allocation_rule_items_project_id_fkey";
ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_business_unit_id_fkey" TO "allocation_rule_items_business_unit_id_fkey";
ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_category_id_fkey" TO "allocation_rule_items_category_id_fkey";
ALTER TABLE "allocation_rule_items" RENAME CONSTRAINT "allocation_rule_lines_account_plan_id_fkey" TO "allocation_rule_items_account_plan_id_fkey";
