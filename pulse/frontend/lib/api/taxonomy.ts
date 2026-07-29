"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { Category, CostCenter } from "@/types/supplier";

export function useCategories(companyId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["categories", companyId, search],
    queryFn: () => api.get<Category[]>(`/categories${buildQueryString({ companyId, search })}`),
    enabled: Boolean(companyId),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { companyId: string; name: string; parentCategoryId?: string }) =>
      api.post<Category>("/categories", payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useCostCenters(companyId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["cost-centers", companyId, search],
    queryFn: () => api.get<CostCenter[]>(`/cost-centers${buildQueryString({ companyId, search })}`),
    enabled: Boolean(companyId),
  });
}

export function useCreateCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { companyId: string; name: string }) => api.post<CostCenter>("/cost-centers", payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cost-centers"] }),
  });
}
