-- CreateEnum
CREATE TYPE "approval_request_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'WAITING_INFORMATION', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "approval_step_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'WAITING_INFORMATION', 'SKIPPED');

-- CreateEnum
CREATE TYPE "approval_approver_type" AS ENUM ('SPECIFIC_USER', 'ROLE', 'ANY_WITH_PERMISSION');

-- CreateEnum
CREATE TYPE "approval_action_type" AS ENUM ('CREATED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'DOCUMENTS_REQUESTED', 'DELEGATED', 'FORWARDED', 'COMMENTED', 'CANCELLED', 'RESTARTED', 'EXPIRED', 'FLOW_CHANGED', 'APPROVERS_CHANGED', 'THRESHOLD_CHANGED', 'PRIORITY_CHANGED');

-- CreateEnum
CREATE TYPE "approval_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "approval_delegation_reason" AS ENUM ('VACATION', 'LEAVE', 'TRAVEL', 'ABSENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "approval_notification_channel" AS ENUM ('EMAIL', 'PUSH', 'WHATSAPP', 'TEAMS', 'SLACK');

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID,
    "cost_center_id" UUID,
    "project_id" UUID,
    "business_unit_id" UUID,
    "financial_nature_id" UUID,
    "contract_id" UUID,
    "supplier_id" UUID,
    "payment_method_id" UUID,
    "document_type" "IntakeDocumentType",
    "direction" "financial_entry_direction",
    "minimum_amount" DECIMAL(18,2),
    "maximum_amount" DECIMAL(18,2),
    "minimum_priority" "approval_priority",
    "priority" INTEGER NOT NULL DEFAULT 100,
    "default_deadline_hours" INTEGER NOT NULL DEFAULT 48,
    "notification_channels" "approval_notification_channel"[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_steps" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approver_type" "approval_approver_type" NOT NULL DEFAULT 'ROLE',
    "approver_user_id" UUID,
    "approver_role_id" UUID,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "minimum_amount" DECIMAL(18,2),
    "maximum_amount" DECIMAL(18,2),
    "deadline_hours" INTEGER,
    "block_self_approval" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "approval_request_status" NOT NULL DEFAULT 'PENDING',
    "priority" "approval_priority" NOT NULL DEFAULT 'NORMAL',
    "amount" DECIMAL(18,2) NOT NULL,
    "current_step_order" INTEGER,
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "decision_seconds" INTEGER,
    "requested_by" UUID,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request_steps" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "flow_step_id" UUID,
    "step_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approver_type" "approval_approver_type" NOT NULL,
    "approver_user_id" UUID,
    "approver_role_id" UUID,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,
    "approvals_given" INTEGER NOT NULL DEFAULT 0,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "block_self_approval" BOOLEAN NOT NULL DEFAULT true,
    "status" "approval_step_status" NOT NULL DEFAULT 'PENDING',
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_comment" TEXT,
    "acted_on_behalf_of" UUID,
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_request_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_step_approvals" (
    "id" UUID NOT NULL,
    "request_step_id" UUID NOT NULL,
    "approved_by" UUID NOT NULL,
    "on_behalf_of" UUID,
    "delegation_id" UUID,
    "comment" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_step_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_comments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "step_order" INTEGER,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "attachment_ids" UUID[],
    "is_document_request" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "delegator_id" UUID NOT NULL,
    "delegate_id" UUID NOT NULL,
    "reason" "approval_delegation_reason" NOT NULL DEFAULT 'ABSENCE',
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "maximum_amount" DECIMAL(18,2),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "revoked_by" UUID,
    "revoked_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_history" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "action" "approval_action_type" NOT NULL,
    "step_order" INTEGER,
    "actor_id" UUID,
    "on_behalf_of" UUID,
    "previous_status" "approval_request_status",
    "new_status" "approval_request_status",
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "require_approval_for_all" BOOLEAN NOT NULL DEFAULT false,
    "mandatory_above_amount" DECIMAL(18,2),
    "block_self_approval_globally" BOOLEAN NOT NULL DEFAULT true,
    "enforce_individual_limit" BOOLEAN NOT NULL DEFAULT true,
    "expire_overdue_requests" BOOLEAN NOT NULL DEFAULT true,
    "default_deadline_hours" INTEGER NOT NULL DEFAULT 48,
    "notification_channels" "approval_notification_channel"[],
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_flows_organization_id_company_id_status_idx" ON "approval_flows"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "approval_flows_company_id_priority_idx" ON "approval_flows"("company_id", "priority");

-- CreateIndex
CREATE INDEX "approval_flow_steps_flow_id_idx" ON "approval_flow_steps"("flow_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_steps_flow_id_step_order_key" ON "approval_flow_steps"("flow_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_company_id_status_idx" ON "approval_requests"("organization_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_company_id_status_due_at_idx" ON "approval_requests"("company_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "approval_requests_entry_id_idx" ON "approval_requests"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_entry_id_attempt_key" ON "approval_requests"("entry_id", "attempt");

-- CreateIndex
CREATE INDEX "approval_request_steps_request_id_idx" ON "approval_request_steps"("request_id");

-- CreateIndex
CREATE INDEX "approval_request_steps_status_due_at_idx" ON "approval_request_steps"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_request_steps_request_id_step_order_key" ON "approval_request_steps"("request_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_step_approvals_request_step_id_idx" ON "approval_step_approvals"("request_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_step_approvals_request_step_id_approved_by_key" ON "approval_step_approvals"("request_step_id", "approved_by");

-- CreateIndex
CREATE INDEX "approval_comments_request_id_idx" ON "approval_comments"("request_id");

-- CreateIndex
CREATE INDEX "approval_delegations_company_id_delegate_id_status_idx" ON "approval_delegations"("company_id", "delegate_id", "status");

-- CreateIndex
CREATE INDEX "approval_delegations_company_id_delegator_id_status_idx" ON "approval_delegations"("company_id", "delegator_id", "status");

-- CreateIndex
CREATE INDEX "approval_history_request_id_created_at_idx" ON "approval_history"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_settings_company_id_key" ON "approval_settings"("company_id");

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request_steps" ADD CONSTRAINT "approval_request_steps_flow_step_id_fkey" FOREIGN KEY ("flow_step_id") REFERENCES "approval_flow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_step_approvals" ADD CONSTRAINT "approval_step_approvals_request_step_id_fkey" FOREIGN KEY ("request_step_id") REFERENCES "approval_request_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_settings" ADD CONSTRAINT "approval_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_settings" ADD CONSTRAINT "approval_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

