"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  DocumentProcessingSettings,
  FinancialEntry,
  FinancialEntrySummary,
  ProcessingPreview,
  ProcessingQueueItem,
} from "@/types/document-processing";

type Payload = Record<string, unknown>;

const KEYS = ["document-processing", "document-intake"];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ── Parâmetros ───────────────────────────────────────────────────────────────

export function useProcessingSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["document-processing", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<DocumentProcessingSettings>(
        `/document-processing/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateProcessingSettings() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      organizationId,
      companyId,
      payload,
    }: {
      organizationId: string;
      companyId: string;
      payload: Payload;
    }) =>
      api.patch<DocumentProcessingSettings>(
        `/document-processing/settings${buildQueryString({ organizationId, companyId })}`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

// ── Fila e processamento ─────────────────────────────────────────────────────

export function useProcessingQueue(
  organizationId: string | undefined,
  companyId: string | undefined,
  page = 1,
) {
  return useQuery({
    queryKey: ["document-processing", "queue", organizationId, companyId, page],
    queryFn: () =>
      api.get<PaginatedResult<ProcessingQueueItem>>(
        `/document-processing/queue${buildQueryString({ organizationId, companyId, page, perPage: 25 })}`,
      ),
    enabled: Boolean(organizationId),
    placeholderData: (previous) => previous,
  });
}

/**
 * Prévia do processamento.
 *
 * Não fica em cache longo: a prévia reflete regras de classificação, rateios e retenções
 * que podem ser alterados nos cadastros a qualquer momento.
 */
export function useProcessingPreview(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-processing", "preview", documentId],
    queryFn: () =>
      api.get<ProcessingPreview>(
        `/document-processing/documents/${documentId}/preview`,
      ),
    enabled: Boolean(documentId),
    staleTime: 0,
  });
}

export function useProcessDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<FinancialEntry>(
        `/document-processing/documents/${id}/process`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

// ── Lançamentos ──────────────────────────────────────────────────────────────

export interface FinancialEntryFilters {
  organizationId?: string;
  companyId?: string;
  direction?: string;
  status?: string;
  supplierId?: string;
  customerId?: string;
  categoryId?: string;
  costCenterId?: string;
  dueFrom?: string;
  dueTo?: string;
  minimumAmount?: number;
  maximumAmount?: number;
  pendingWithholdings?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}

export function useFinancialEntries(filters: FinancialEntryFilters) {
  return useQuery({
    queryKey: ["document-processing", "entries", filters],
    queryFn: () =>
      api.get<PaginatedResult<FinancialEntry>>(
        `/document-processing/entries${buildQueryString({ ...filters })}`,
      ),
    enabled: Boolean(filters.organizationId),
    placeholderData: (previous) => previous,
  });
}

export function useFinancialEntry(id: string | undefined) {
  return useQuery({
    queryKey: ["document-processing", "entry", id],
    queryFn: () => api.get<FinancialEntry>(`/document-processing/entries/${id}`),
    enabled: Boolean(id),
  });
}

export function useFinancialEntrySummary(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["document-processing", "summary", organizationId, companyId],
    queryFn: () =>
      api.get<FinancialEntrySummary>(
        `/document-processing/entries/summary${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useFinancialEntryActions() {
  const invalidate = useInvalidate();

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<FinancialEntry>(`/document-processing/entries/${id}`, payload),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.post<FinancialEntry>(`/document-processing/entries/${id}/approve`, {}),
    onSuccess: invalidate,
  });

  const open = useMutation({
    mutationFn: (id: string) =>
      api.post<FinancialEntry>(`/document-processing/entries/${id}/open`, {}),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<FinancialEntry>(`/document-processing/entries/${id}/cancel`, {
        reason,
      }),
    onSuccess: invalidate,
  });

  const updateInstallment = useMutation({
    mutationFn: ({
      id,
      installmentId,
      payload,
    }: {
      id: string;
      installmentId: string;
      payload: Payload;
    }) =>
      api.patch(
        `/document-processing/entries/${id}/installments/${installmentId}`,
        payload,
      ),
    onSuccess: invalidate,
  });

  return { update, approve, open, cancel, updateInstallment };
}

export function useWithholdingActions() {
  const invalidate = useInvalidate();

  const add = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post(`/document-processing/entries/${id}/withholdings`, payload),
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: ({
      id,
      withholdingId,
      reason,
    }: {
      id: string;
      withholdingId: string;
      reason?: string;
    }) =>
      api.post(
        `/document-processing/entries/${id}/withholdings/${withholdingId}/confirm`,
        { reason },
      ),
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: ({
      id,
      withholdingId,
      reason,
    }: {
      id: string;
      withholdingId: string;
      reason: string;
    }) =>
      api.post(
        `/document-processing/entries/${id}/withholdings/${withholdingId}/dismiss`,
        { reason },
      ),
    onSuccess: invalidate,
  });

  return { add, confirm, dismiss };
}
