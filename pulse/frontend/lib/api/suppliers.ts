"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  DocumentQuerySupplierResult,
  DuplicateLinkAspect,
  Supplier,
  SupplierAllocation,
  SupplierBankAccount,
  SupplierClassificationRule,
  SupplierCompanyLink,
  SupplierContract,
  SupplierLinkListItem,
  SupplierPixKey,
  SupplierTaxWithholding,
} from "@/types/supplier";

export interface SuppliersFilters {
  page?: number;
  perPage?: number;
  search?: string;
  companyId?: string;
  status?: string;
  defaultCategoryId?: string;
  defaultCostCenterId?: string;
  documentNumber?: string;
  city?: string;
  state?: string;
  orderBy?: string;
  order?: "asc" | "desc";
}

const suppliersKeys = {
  all: ["suppliers"] as const,
  list: (filters: SuppliersFilters) => [...suppliersKeys.all, "list", filters] as const,
  detail: (id: string) => [...suppliersKeys.all, "detail", id] as const,
  documents: (id: string) => [...suppliersKeys.all, "documents", id] as const,
};

const linksKeys = {
  all: ["supplier-company-links"] as const,
  detail: (id: string) => [...linksKeys.all, "detail", id] as const,
  audit: (id: string) => [...linksKeys.all, "audit", id] as const,
};

export function useSuppliers(filters: SuppliersFilters) {
  return useQuery({
    queryKey: suppliersKeys.list(filters),
    queryFn: () => api.get<PaginatedResult<SupplierLinkListItem>>(`/suppliers${buildQueryString({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: suppliersKeys.detail(id ?? ""),
    queryFn: () => api.get<Supplier>(`/suppliers/${id}`),
    enabled: Boolean(id),
  });
}

export function useSupplierDocuments(id: string | undefined) {
  return useQuery({
    queryKey: suppliersKeys.documents(id ?? ""),
    queryFn: () => api.get<{ id: string; fileName: string; documentType: string | null; createdAt: string }[]>(`/suppliers/${id}/documents`),
    enabled: Boolean(id),
  });
}

function useInvalidateSuppliers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: suppliersKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: suppliersKeys.detail(id) });
  };
}

export function useCreateSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Supplier>("/suppliers", payload),
    onSuccess: () => invalidate(),
  });
}

export function useSaveDraftSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => api.post<Supplier>("/suppliers/drafts", payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateSupplier(id: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch<Supplier>(`/suppliers/${id}`, payload),
    onSuccess: () => invalidate(id),
  });
}

export function useActivateSupplier(id: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: () => api.post<Supplier>(`/suppliers/${id}/activate`),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/suppliers/${id}`),
    onSuccess: () => invalidate(),
  });
}

export function useQuerySupplierDocument() {
  return useMutation({
    mutationFn: (payload: { documentNumber: string; organizationId?: string }) =>
      api.post<DocumentQuerySupplierResult>("/suppliers/document-query", payload),
  });
}

export function useCreateSupplierLink(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierCompanyLink>(`/suppliers/${supplierId}/company-links`, payload),
    onSuccess: () => invalidate(supplierId),
  });
}

export function useAddBankAccount(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierBankAccount>(`/suppliers/${supplierId}/bank-accounts`, payload),
    onSuccess: () => invalidate(supplierId),
  });
}

export function useUpdateBankAccount(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: ({ bankAccountId, payload }: { bankAccountId: string; payload: Record<string, unknown> }) =>
      api.patch<SupplierBankAccount>(`/suppliers/${supplierId}/bank-accounts/${bankAccountId}`, payload),
    onSuccess: () => invalidate(supplierId),
  });
}

export function useDeactivateBankAccount(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (bankAccountId: string) => api.post(`/suppliers/${supplierId}/bank-accounts/${bankAccountId}/deactivate`),
    onSuccess: () => invalidate(supplierId),
  });
}

export function useAddPixKey(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierPixKey>(`/suppliers/${supplierId}/pix-keys`, payload),
    onSuccess: () => invalidate(supplierId),
  });
}

export function useDeactivatePixKey(supplierId: string) {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (pixKeyId: string) => api.post(`/suppliers/${supplierId}/pix-keys/${pixKeyId}/deactivate`),
    onSuccess: () => invalidate(supplierId),
  });
}

export function useUploadSupplierDocument(supplierId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (documentType) formData.append("documentType", documentType);
      return api.post(`/suppliers/${supplierId}/documents`, formData);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: suppliersKeys.documents(supplierId) }),
  });
}

// ── Vínculo com a empresa ───────────────────────────────────────────────────

export function useSupplierLink(id: string | undefined) {
  return useQuery({
    queryKey: linksKeys.detail(id ?? ""),
    queryFn: () => api.get<SupplierCompanyLink>(`/supplier-company-links/${id}`),
    enabled: Boolean(id),
  });
}

export function useSupplierLinkAuditLog(id: string | undefined, page: number) {
  return useQuery({
    queryKey: [...linksKeys.audit(id ?? ""), page],
    queryFn: () =>
      api.get<PaginatedResult<{ id: string; action: string; entity: string; oldValue: unknown; newValue: unknown; reason: string | null; createdAt: string }>>(
        `/supplier-company-links/${id}/audit${buildQueryString({ page })}`,
      ),
    enabled: Boolean(id),
  });
}

function useInvalidateLink(id: string) {
  const queryClient = useQueryClient();
  const invalidateSuppliers = useInvalidateSuppliers();
  return () => {
    void queryClient.invalidateQueries({ queryKey: linksKeys.detail(id) });
    invalidateSuppliers();
  };
}

export function useUpdateSupplierLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch<SupplierCompanyLink>(`/supplier-company-links/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useActivateSupplierLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({ mutationFn: () => api.post<SupplierCompanyLink>(`/supplier-company-links/${id}/activate`), onSuccess: invalidate });
}

export function useDeactivateSupplierLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (reason: string) => api.post<SupplierCompanyLink>(`/supplier-company-links/${id}/deactivate`, { reason }),
    onSuccess: invalidate,
  });
}

export function useSuspendSupplierLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (reason: string) => api.post<SupplierCompanyLink>(`/supplier-company-links/${id}/suspend`, { reason }),
    onSuccess: invalidate,
  });
}

export function useBlockSupplierLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (reason: string) => api.post<SupplierCompanyLink>(`/supplier-company-links/${id}/block`, { reason }),
    onSuccess: invalidate,
  });
}

export function useUnblockSupplierLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({ mutationFn: () => api.post<SupplierCompanyLink>(`/supplier-company-links/${id}/unblock`), onSuccess: invalidate });
}

export function useDeleteSupplierLink() {
  const invalidateSuppliers = useInvalidateSuppliers();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/supplier-company-links/${id}`),
    onSuccess: () => invalidateSuppliers(),
  });
}

export function useDuplicateSupplierLink(id: string) {
  return useMutation({
    mutationFn: (payload: { targetCompanyId: string; aspects: DuplicateLinkAspect[] }) =>
      api.post<SupplierCompanyLink>(`/supplier-company-links/${id}/duplicate`, payload),
  });
}

export function useAddClassificationRule(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierClassificationRule>(`/supplier-company-links/${linkId}/classification-rules`, payload),
    onSuccess: invalidate,
  });
}

export function useAddAllocation(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierAllocation>(`/supplier-company-links/${linkId}/allocations`, payload),
    onSuccess: invalidate,
  });
}

export function useAddTaxWithholding(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierTaxWithholding>(`/supplier-company-links/${linkId}/tax-withholdings`, payload),
    onSuccess: invalidate,
  });
}

export function useAddContract(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<SupplierContract>(`/supplier-company-links/${linkId}/contracts`, payload),
    onSuccess: invalidate,
  });
}
