"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { Category, CostCenter } from "@/types/supplier";
import type { CategoryNode, CostCenterNode, TreeNode } from "@/types/financial-structure";

type Payload = Record<string, unknown>;

function useInvalidate(key: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [key] });
}

// ── Categorias ───────────────────────────────────────────────────────────────

export function useCategories(companyId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["categories", companyId, search],
    queryFn: () => api.get<Category[]>(`/financial-categories${buildQueryString({ companyId, search })}`),
    enabled: Boolean(companyId),
  });
}

export function useCategoryTree(companyId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: ["categories", "tree", companyId, includeInactive],
    queryFn: () =>
      api.get<TreeNode<CategoryNode>[]>(
        `/financial-categories/tree${buildQueryString({ companyId, includeInactive })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidate("categories");
  return useMutation({
    mutationFn: (payload: Payload & { companyId: string; name: string }) =>
      api.post<Category>("/financial-categories", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate("categories");
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<Category>(`/financial-categories/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useMoveCategory() {
  const invalidate = useInvalidate("categories");
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<Category>(`/financial-categories/${id}/move`, payload),
    onSuccess: invalidate,
  });
}

export function useDuplicateCategory() {
  const invalidate = useInvalidate("categories");
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<Category>(`/financial-categories/${id}/duplicate`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate("categories");
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/financial-categories/${id}`),
    onSuccess: invalidate,
  });
}

// ── Centros de custo ─────────────────────────────────────────────────────────

export function useCostCenters(companyId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["cost-centers", companyId, search],
    queryFn: () => api.get<CostCenter[]>(`/cost-centers${buildQueryString({ companyId, search })}`),
    enabled: Boolean(companyId),
  });
}

export function useCostCenterTree(companyId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: ["cost-centers", "tree", companyId, includeInactive],
    queryFn: () =>
      api.get<TreeNode<CostCenterNode>[]>(
        `/cost-centers/tree${buildQueryString({ companyId, includeInactive })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useCreateCostCenter() {
  const invalidate = useInvalidate("cost-centers");
  return useMutation({
    mutationFn: (payload: Payload & { companyId: string; name: string }) =>
      api.post<CostCenter>("/cost-centers", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCostCenter() {
  const invalidate = useInvalidate("cost-centers");
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<CostCenter>(`/cost-centers/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useMoveCostCenter() {
  const invalidate = useInvalidate("cost-centers");
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<CostCenter>(`/cost-centers/${id}/move`, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCostCenter() {
  const invalidate = useInvalidate("cost-centers");
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/cost-centers/${id}`),
    onSuccess: invalidate,
  });
}
