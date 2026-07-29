"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  Company,
  CompanyStatusHistoryEntry,
  CompanySummary,
  CompanyUserMembership,
  DocumentQueryResult,
  DuplicateSettingsAspect,
  PostalCodeResult,
} from "@/types/company";

export interface CompaniesFilters {
  page?: number;
  perPage?: number;
  search?: string;
  organizationId?: string;
  systemStatus?: string;
  externalRegistrationStatus?: string;
  establishmentType?: string;
  city?: string;
  state?: string;
  createdFrom?: string;
  createdTo?: string;
  orderBy?: string;
  order?: "asc" | "desc";
}

const companiesKeys = {
  all: ["companies"] as const,
  list: (filters: CompaniesFilters) => [...companiesKeys.all, "list", filters] as const,
  detail: (id: string) => [...companiesKeys.all, "detail", id] as const,
  pendencies: (id: string) => [...companiesKeys.all, "pendencies", id] as const,
  audit: (id: string) => [...companiesKeys.all, "audit", id] as const,
  users: (id: string) => [...companiesKeys.all, "users", id] as const,
};

export function useCompanies(filters: CompaniesFilters) {
  return useQuery({
    queryKey: companiesKeys.list(filters),
    queryFn: () =>
      api.get<PaginatedResult<CompanySummary>>(`/companies${buildQueryString({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: companiesKeys.detail(id ?? ""),
    queryFn: () => api.get<Company>(`/companies/${id}`),
    enabled: Boolean(id),
  });
}

export function useCompanyActivationPendencies(id: string | undefined) {
  return useQuery({
    queryKey: companiesKeys.pendencies(id ?? ""),
    queryFn: () => api.get<string[]>(`/companies/${id}/activation-pendencies`),
    enabled: Boolean(id),
  });
}

export function useCompanyAuditLog(id: string | undefined, page: number) {
  return useQuery({
    queryKey: [...companiesKeys.audit(id ?? ""), page],
    queryFn: () =>
      api.get<
        PaginatedResult<{
          id: string;
          action: string;
          entity: string;
          field: string | null;
          oldValue: unknown;
          newValue: unknown;
          reason: string | null;
          createdAt: string;
        }>
      >(`/companies/${id}/audit${buildQueryString({ page })}`),
    enabled: Boolean(id),
  });
}

export function useCompanyUsers(id: string | undefined) {
  return useQuery({
    queryKey: companiesKeys.users(id ?? ""),
    queryFn: () => api.get<PaginatedResult<CompanyUserMembership>>(`/companies/${id}/users`),
    enabled: Boolean(id),
  });
}

function useInvalidateCompanies() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: companiesKeys.pendencies(id) });
    }
  };
}

export function useCreateCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Company>("/companies", payload),
    onSuccess: () => invalidate(),
  });
}

export function useSaveDraftCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) =>
      api.post<Company>("/companies/drafts", payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCompany(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch<Company>(`/companies/${id}`, payload),
    onSuccess: () => invalidate(id),
  });
}

export function useActivateCompany(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: () => api.post<Company>(`/companies/${id}/activate`),
    onSuccess: () => invalidate(id),
  });
}

export function useReactivateCompany(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: () => api.post<Company>(`/companies/${id}/reactivate`),
    onSuccess: () => invalidate(id),
  });
}

export function useDeactivateCompany(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (reason: string) => api.post<Company>(`/companies/${id}/deactivate`, { reason }),
    onSuccess: () => invalidate(id),
  });
}

export function useSuspendCompany(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (reason: string) => api.post<Company>(`/companies/${id}/suspend`, { reason }),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteCompany() {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/companies/${id}`),
    onSuccess: () => invalidate(),
  });
}

export function useQueryDocument() {
  return useMutation({
    mutationFn: (payload: { documentNumber: string; organizationId?: string }) =>
      api.post<DocumentQueryResult>("/companies/document-query", payload),
  });
}

export function useQueryPostalCode() {
  return useMutation({
    mutationFn: (postalCode: string) => api.post<PostalCodeResult>("/companies/postal-code-query", { postalCode }),
  });
}

export function useUploadCompanyLogo(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<Company>(`/companies/${id}/logo`, formData);
    },
    onSuccess: () => invalidate(id),
  });
}

export function useRemoveCompanyLogo(id: string) {
  const invalidate = useInvalidateCompanies();
  return useMutation({
    mutationFn: () => api.delete<Company>(`/companies/${id}/logo`),
    onSuccess: () => invalidate(id),
  });
}

export function useDuplicateCompanySettings(id: string) {
  return useMutation({
    mutationFn: (payload: { targetCompanyId: string; aspects: DuplicateSettingsAspect[] }) =>
      api.post<{
        sourceCompanyId: string;
        targetCompanyId: string;
        results: { aspect: DuplicateSettingsAspect; status: string; message: string }[];
      }>(`/companies/${id}/duplicate-settings`, payload),
  });
}

export function useAddCompanyUser(companyId: string) {
  const invalidate = useInvalidateCompanies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; name: string; roleId: string }) =>
      api.post<CompanyUserMembership>(`/companies/${companyId}/users`, payload),
    onSuccess: () => {
      invalidate(companyId);
      void queryClient.invalidateQueries({ queryKey: companiesKeys.users(companyId) });
    },
  });
}

export function useRemoveCompanyUser(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/companies/${companyId}/users/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companiesKeys.users(companyId) });
    },
  });
}

export type { CompanyStatusHistoryEntry };
