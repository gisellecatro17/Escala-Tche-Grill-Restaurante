"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  Customer,
  CustomerBillingRule,
  CustomerCompanyLink,
  CustomerContract,
  CustomerLinkListItem,
  CustomerRecurringReceivable,
  DocumentQueryCustomerResult,
  DuplicateLinkAspect,
} from "@/types/customer";

export interface CustomersFilters {
  page?: number;
  perPage?: number;
  search?: string;
  companyId?: string;
  status?: string;
  financialStatus?: string;
  defaultRevenueCategoryId?: string;
  defaultResultCenterId?: string;
  documentNumber?: string;
  city?: string;
  state?: string;
  orderBy?: string;
  order?: "asc" | "desc";
}

const customersKeys = {
  all: ["customers"] as const,
  list: (filters: CustomersFilters) => [...customersKeys.all, "list", filters] as const,
  detail: (id: string) => [...customersKeys.all, "detail", id] as const,
  documents: (id: string) => [...customersKeys.all, "documents", id] as const,
};

const linksKeys = {
  all: ["customer-company-links"] as const,
  detail: (id: string) => [...linksKeys.all, "detail", id] as const,
  audit: (id: string) => [...linksKeys.all, "audit", id] as const,
};

export function useCustomers(filters: CustomersFilters) {
  return useQuery({
    queryKey: customersKeys.list(filters),
    queryFn: () => api.get<PaginatedResult<CustomerLinkListItem>>(`/customers${buildQueryString({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customersKeys.detail(id ?? ""),
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCustomerDocuments(id: string | undefined) {
  return useQuery({
    queryKey: customersKeys.documents(id ?? ""),
    queryFn: () => api.get<{ id: string; fileName: string; documentType: string | null; createdAt: string }[]>(`/customers/${id}/documents`),
    enabled: Boolean(id),
  });
}

function useInvalidateCustomers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: customersKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: customersKeys.detail(id) });
  };
}

export function useCreateCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Customer>("/customers", payload),
    onSuccess: () => invalidate(),
  });
}

export function useSaveDraftCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => api.post<Customer>("/customers/drafts", payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCustomer(id: string) {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch<Customer>(`/customers/${id}`, payload),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/customers/${id}`),
    onSuccess: () => invalidate(),
  });
}

export function useQueryCustomerDocument() {
  return useMutation({
    mutationFn: (payload: { documentNumber: string; organizationId?: string }) =>
      api.post<DocumentQueryCustomerResult>("/customers/document-query", payload),
  });
}

export function useCreateCustomerLink(customerId: string) {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<CustomerCompanyLink>(`/customers/${customerId}/company-links`, payload),
    onSuccess: () => invalidate(customerId),
  });
}

export function useUploadCustomerDocument(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (documentType) formData.append("documentType", documentType);
      return api.post(`/customers/${customerId}/documents`, formData);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: customersKeys.documents(customerId) }),
  });
}

export function useAddBankIdentifier(customerId: string) {
  return useMutation({
    mutationFn: ({ companyId, payload }: { companyId?: string; payload: Record<string, unknown> }) =>
      api.post(`/customers/${customerId}/bank-identifiers${buildQueryString({ companyId })}`, payload),
  });
}

// ── Vínculo com a empresa ───────────────────────────────────────────────────

export function useCustomerLink(id: string | undefined) {
  return useQuery({
    queryKey: linksKeys.detail(id ?? ""),
    queryFn: () => api.get<CustomerCompanyLink>(`/customer-company-links/${id}`),
    enabled: Boolean(id),
  });
}

export function useCustomerLinkAuditLog(id: string | undefined, page: number) {
  return useQuery({
    queryKey: [...linksKeys.audit(id ?? ""), page],
    queryFn: () =>
      api.get<PaginatedResult<{ id: string; action: string; entity: string; oldValue: unknown; newValue: unknown; reason: string | null; createdAt: string }>>(
        `/customer-company-links/${id}/audit${buildQueryString({ page })}`,
      ),
    enabled: Boolean(id),
  });
}

function useInvalidateLink(id: string) {
  const queryClient = useQueryClient();
  const invalidateCustomers = useInvalidateCustomers();
  return () => {
    void queryClient.invalidateQueries({ queryKey: linksKeys.detail(id) });
    invalidateCustomers();
  };
}

export function useUpdateCustomerLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch<CustomerCompanyLink>(`/customer-company-links/${id}`, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomerCredit(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch<CustomerCompanyLink>(`/customer-company-links/${id}/credit`, payload),
    onSuccess: invalidate,
  });
}

export function useConvertProspect(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: () => api.post<CustomerCompanyLink>(`/customer-company-links/${id}/convert-prospect`),
    onSuccess: invalidate,
  });
}

export function useActivateCustomerLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({ mutationFn: () => api.post<CustomerCompanyLink>(`/customer-company-links/${id}/activate`), onSuccess: invalidate });
}

export function useDeactivateCustomerLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (reason: string) => api.post<CustomerCompanyLink>(`/customer-company-links/${id}/deactivate`, { reason }),
    onSuccess: invalidate,
  });
}

export function useSuspendCustomerLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (reason: string) => api.post<CustomerCompanyLink>(`/customer-company-links/${id}/suspend`, { reason }),
    onSuccess: invalidate,
  });
}

export function useBlockCustomerLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({
    mutationFn: (reason: string) => api.post<CustomerCompanyLink>(`/customer-company-links/${id}/block`, { reason }),
    onSuccess: invalidate,
  });
}

export function useUnblockCustomerLink(id: string) {
  const invalidate = useInvalidateLink(id);
  return useMutation({ mutationFn: () => api.post<CustomerCompanyLink>(`/customer-company-links/${id}/unblock`), onSuccess: invalidate });
}

export function useDeleteCustomerLink() {
  const invalidateCustomers = useInvalidateCustomers();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/customer-company-links/${id}`),
    onSuccess: () => invalidateCustomers(),
  });
}

export function useDuplicateCustomerLink(id: string) {
  return useMutation({
    mutationFn: (payload: { targetCompanyId: string; aspects: DuplicateLinkAspect[] }) =>
      api.post<CustomerCompanyLink>(`/customer-company-links/${id}/duplicate`, payload),
  });
}

export function useAddBillingRule(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<CustomerBillingRule>(`/customer-company-links/${linkId}/billing-rules`, payload),
    onSuccess: invalidate,
  });
}

export function useAddCollectionHistory(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post(`/customer-company-links/${linkId}/collection-history`, payload),
    onSuccess: invalidate,
  });
}

export function useAddPaymentPromise(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post(`/customer-company-links/${linkId}/payment-promises`, payload),
    onSuccess: invalidate,
  });
}

export function useUpdatePaymentPromise(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: ({ promiseId, payload }: { promiseId: string; payload: Record<string, unknown> }) =>
      api.patch(`/customer-company-links/${linkId}/payment-promises/${promiseId}`, payload),
    onSuccess: invalidate,
  });
}

export function useAddContract(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<CustomerContract>(`/customer-company-links/${linkId}/contracts`, payload),
    onSuccess: invalidate,
  });
}

export function useAddContractAmendment(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: ({ contractId, payload }: { contractId: string; payload: Record<string, unknown> }) =>
      api.post(`/customer-company-links/${linkId}/contracts/${contractId}/amendments`, payload),
    onSuccess: invalidate,
  });
}

export function useAddRecurringReceivable(linkId: string) {
  const invalidate = useInvalidateLink(linkId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<CustomerRecurringReceivable>(`/customer-company-links/${linkId}/recurring-receivables`, payload),
    onSuccess: invalidate,
  });
}
