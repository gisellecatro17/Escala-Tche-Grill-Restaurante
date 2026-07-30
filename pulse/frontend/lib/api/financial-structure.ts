"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  AccountPlan,
  AllocationRule,
  BusinessUnit,
  ClassificationRule,
  FinancialNature,
  FinancialTag,
  HierarchyEntity,
  HierarchyVersion,
  Project,
  ResultCenter,
  SimulationResult,
  StructureImportBatch,
  TreeNode,
} from "@/types/financial-structure";

type Payload = Record<string, unknown>;

function useInvalidate(keys: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ── Plano de contas ──────────────────────────────────────────────────────────

export function useAccountPlanTree(
  organizationId: string | undefined,
  companyId?: string,
  includeInactive = false,
) {
  return useQuery({
    queryKey: ["account-plans", "tree", organizationId, companyId, includeInactive],
    queryFn: () =>
      api.get<TreeNode<AccountPlan>[]>(
        `/financial-account-plans/tree${buildQueryString({ organizationId, companyId, includeInactive })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useAccountPlans(organizationId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: ["account-plans", "list", organizationId, companyId],
    queryFn: () =>
      api.get<AccountPlan[]>(
        `/financial-account-plans${buildQueryString({ organizationId, companyId, perPage: 100 })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useCreateAccountPlan() {
  const invalidate = useInvalidate(["account-plans"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<AccountPlan>("/financial-account-plans", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateAccountPlan() {
  const invalidate = useInvalidate(["account-plans"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<AccountPlan>(`/financial-account-plans/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useMoveAccountPlan() {
  const invalidate = useInvalidate(["account-plans"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<AccountPlan>(`/financial-account-plans/${id}/move`, payload),
    onSuccess: invalidate,
  });
}

export function useDuplicateAccountPlan() {
  const invalidate = useInvalidate(["account-plans"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<AccountPlan>(`/financial-account-plans/${id}/duplicate`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteAccountPlan() {
  const invalidate = useInvalidate(["account-plans"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/financial-account-plans/${id}`),
    onSuccess: invalidate,
  });
}

// ── Centros de resultado ─────────────────────────────────────────────────────

export function useResultCenterTree(companyId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: ["result-centers", "tree", companyId, includeInactive],
    queryFn: () =>
      api.get<TreeNode<ResultCenter>[]>(
        `/result-centers/tree${buildQueryString({ companyId, includeInactive })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useResultCenters(companyId: string | undefined) {
  return useQuery({
    queryKey: ["result-centers", "list", companyId],
    queryFn: () =>
      api.get<ResultCenter[]>(`/result-centers${buildQueryString({ companyId, perPage: 100 })}`),
    enabled: Boolean(companyId),
  });
}

export function useCreateResultCenter() {
  const invalidate = useInvalidate(["result-centers"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<ResultCenter>("/result-centers", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateResultCenter() {
  const invalidate = useInvalidate(["result-centers"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<ResultCenter>(`/result-centers/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useMoveResultCenter() {
  const invalidate = useInvalidate(["result-centers"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<ResultCenter>(`/result-centers/${id}/move`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteResultCenter() {
  const invalidate = useInvalidate(["result-centers"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/result-centers/${id}`),
    onSuccess: invalidate,
  });
}

// ── Unidades de negócio ──────────────────────────────────────────────────────

export function useBusinessUnitTree(
  organizationId: string | undefined,
  companyId?: string,
  includeInactive = false,
) {
  return useQuery({
    queryKey: ["business-units", "tree", organizationId, companyId, includeInactive],
    queryFn: () =>
      api.get<TreeNode<BusinessUnit>[]>(
        `/business-units/tree${buildQueryString({ organizationId, companyId, includeInactive })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useBusinessUnits(organizationId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: ["business-units", "list", organizationId, companyId],
    queryFn: () =>
      api.get<BusinessUnit[]>(
        `/business-units${buildQueryString({ organizationId, companyId, perPage: 100 })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useCreateBusinessUnit() {
  const invalidate = useInvalidate(["business-units"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<BusinessUnit>("/business-units", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateBusinessUnit() {
  const invalidate = useInvalidate(["business-units"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<BusinessUnit>(`/business-units/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useMoveBusinessUnit() {
  const invalidate = useInvalidate(["business-units"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<BusinessUnit>(`/business-units/${id}/move`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteBusinessUnit() {
  const invalidate = useInvalidate(["business-units"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/business-units/${id}`),
    onSuccess: invalidate,
  });
}

// ── Projetos ─────────────────────────────────────────────────────────────────

export function useProjects(companyId: string | undefined, search?: string, page = 1) {
  return useQuery({
    queryKey: ["projects", companyId, search, page],
    queryFn: () =>
      api.get<PaginatedResult<Project>>(
        `/projects${buildQueryString({ companyId, search, page, perPage: 20 })}`,
      ),
    enabled: Boolean(companyId),
    placeholderData: (previous) => previous,
  });
}

export function useCreateProject() {
  const invalidate = useInvalidate(["projects"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<Project>("/projects", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidate(["projects"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<Project>(`/projects/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate(["projects"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/projects/${id}`),
    onSuccess: invalidate,
  });
}

// ── Naturezas financeiras ────────────────────────────────────────────────────

export function useFinancialNatures(organizationId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: ["financial-natures", organizationId, companyId],
    queryFn: () =>
      api.get<FinancialNature[]>(
        `/financial-natures${buildQueryString({ organizationId, companyId, perPage: 100 })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useCreateFinancialNature() {
  const invalidate = useInvalidate(["financial-natures"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<FinancialNature>("/financial-natures", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFinancialNature() {
  const invalidate = useInvalidate(["financial-natures"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<FinancialNature>(`/financial-natures/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteFinancialNature() {
  const invalidate = useInvalidate(["financial-natures"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/financial-natures/${id}`),
    onSuccess: invalidate,
  });
}

// ── Tags financeiras ─────────────────────────────────────────────────────────

export function useFinancialTags(organizationId: string | undefined, companyId?: string) {
  return useQuery({
    queryKey: ["financial-tags", organizationId, companyId],
    queryFn: () =>
      api.get<FinancialTag[]>(
        `/financial-tags${buildQueryString({ organizationId, companyId, perPage: 100 })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useCreateFinancialTag() {
  const invalidate = useInvalidate(["financial-tags"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<FinancialTag>("/financial-tags", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFinancialTag() {
  const invalidate = useInvalidate(["financial-tags"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<FinancialTag>(`/financial-tags/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteFinancialTag() {
  const invalidate = useInvalidate(["financial-tags"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/financial-tags/${id}`),
    onSuccess: invalidate,
  });
}

export function useLinkTag() {
  const invalidate = useInvalidate(["financial-tags"]);
  return useMutation({
    mutationFn: (payload: { tagId: string; entityType: string; entityId: string }) =>
      api.post("/financial-tags/link", payload),
    onSuccess: invalidate,
  });
}

export function useUnlinkTag() {
  const invalidate = useInvalidate(["financial-tags"]);
  return useMutation({
    mutationFn: (payload: { tagId: string; entityType: string; entityId: string }) =>
      api.post("/financial-tags/unlink", payload),
    onSuccess: invalidate,
  });
}

// ── Rateios ──────────────────────────────────────────────────────────────────

export function useAllocationRules(companyId: string | undefined) {
  return useQuery({
    queryKey: ["allocation-rules", companyId],
    queryFn: () =>
      api.get<AllocationRule[]>(`/allocation-rules${buildQueryString({ companyId, perPage: 100 })}`),
    enabled: Boolean(companyId),
  });
}

export function useCreateAllocationRule() {
  const invalidate = useInvalidate(["allocation-rules"]);
  return useMutation({
    mutationFn: (payload: Payload) => api.post<AllocationRule>("/allocation-rules", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateAllocationRule() {
  const invalidate = useInvalidate(["allocation-rules"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<AllocationRule>(`/allocation-rules/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteAllocationRule() {
  const invalidate = useInvalidate(["allocation-rules"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/allocation-rules/${id}`),
    onSuccess: invalidate,
  });
}

// ── Regras de classificação ──────────────────────────────────────────────────

export function useClassificationRules(companyId: string | undefined) {
  return useQuery({
    queryKey: ["classification-rules", companyId],
    queryFn: () =>
      api.get<ClassificationRule[]>(
        `/classification-rules${buildQueryString({ companyId, perPage: 100 })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useCreateClassificationRule() {
  const invalidate = useInvalidate(["classification-rules"]);
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<ClassificationRule>("/classification-rules", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateClassificationRule() {
  const invalidate = useInvalidate(["classification-rules"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<ClassificationRule>(`/classification-rules/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteClassificationRule() {
  const invalidate = useInvalidate(["classification-rules"]);
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/classification-rules/${id}`),
    onSuccess: invalidate,
  });
}

export function useSimulateClassification() {
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<SimulationResult>("/classification-rules/simulate", payload),
  });
}

// ── Importação, exportação e versionamento ───────────────────────────────────

export function useStructureVersions(
  organizationId: string | undefined,
  entity?: HierarchyEntity,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["financial-structure", "versions", organizationId, entity, companyId],
    queryFn: () =>
      api.get<PaginatedResult<HierarchyVersion>>(
        `/financial-structure/versions${buildQueryString({ organizationId, entity, companyId })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<{ id: string; restored: number }>(
        `/financial-structure/versions/${id}/restore`,
        { reason },
      ),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
}

export function useValidateImport() {
  const invalidate = useInvalidate(["financial-structure"]);
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<StructureImportBatch>("/financial-structure/imports", payload),
    onSuccess: invalidate,
  });
}

export function useApplyImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updateExisting }: { id: string; updateExisting?: boolean }) =>
      api.post<StructureImportBatch>(`/financial-structure/imports/${id}/apply`, {
        updateExisting,
      }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
}

export function useExportStructure() {
  return useMutation({
    mutationFn: (params: {
      organizationId: string;
      companyId?: string;
      entity: HierarchyEntity;
      format?: "csv" | "json";
    }) =>
      api.get<{ format: string; entity: string; content?: string; rows?: unknown[] }>(
        `/financial-structure/export${buildQueryString({ ...params })}`,
      ),
  });
}
