"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  ApprovalComment,
  ApprovalDashboard,
  ApprovalDelegation,
  ApprovalFlow,
  ApprovalHistoryEntry,
  ApprovalRequest,
  ApprovalSettings,
  BatchApprovalResult,
} from "@/types/approvals";

type Payload = Record<string, unknown>;

/** Aprovar muda o lançamento também: as duas árvores de cache precisam cair juntas. */
const KEYS = ["approvals", "document-processing"];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ── Painel e parâmetros ──────────────────────────────────────────────────────

export function useApprovalDashboard(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["approvals", "dashboard", organizationId, companyId],
    queryFn: () =>
      api.get<ApprovalDashboard>(
        `/approvals/dashboard${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
    // A fila muda enquanto a tela está aberta: outra pessoa pode aprovar agora.
    refetchInterval: 30_000,
  });
}

export function useApprovalSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["approvals", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<ApprovalSettings>(
        `/approvals/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateApprovalSettings() {
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
      api.patch<ApprovalSettings>(
        `/approvals/settings${buildQueryString({ organizationId, companyId })}`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

// ── Fila ─────────────────────────────────────────────────────────────────────

export interface ApprovalFilters {
  organizationId?: string;
  companyId?: string;
  status?: string;
  priority?: string;
  flowId?: string;
  entryId?: string;
  supplierId?: string;
  categoryId?: string;
  costCenterId?: string;
  assignedToUserId?: string;
  overdue?: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
  search?: string;
  page?: number;
  perPage?: number;
}

export function useApprovals(filters: ApprovalFilters) {
  return useQuery({
    queryKey: ["approvals", "list", filters],
    queryFn: () =>
      api.get<PaginatedResult<ApprovalRequest>>(
        `/approvals${buildQueryString({ ...filters })}`,
      ),
    enabled: Boolean(filters.organizationId),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
}

export function useApproval(id: string | undefined) {
  return useQuery({
    queryKey: ["approvals", "detail", id],
    queryFn: () => api.get<ApprovalRequest>(`/approvals/${id}`),
    enabled: Boolean(id),
  });
}

export function useApprovalComments(id: string | undefined) {
  return useQuery({
    queryKey: ["approvals", "comments", id],
    queryFn: () => api.get<ApprovalComment[]>(`/approvals/${id}/comments`),
    enabled: Boolean(id),
  });
}

export function useApprovalHistory(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["approvals", "history", id],
    queryFn: () => api.get<ApprovalHistoryEntry[]>(`/approvals/${id}/history`),
    enabled: Boolean(id) && enabled,
  });
}

// ── Ações ────────────────────────────────────────────────────────────────────

export function useApprovalActions() {
  const invalidate = useInvalidate();

  const approve = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.post<ApprovalRequest>(`/approvals/${id}/approve`, { comment }),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ApprovalRequest>(`/approvals/${id}/reject`, { reason }),
    onSuccess: invalidate,
  });

  const requestChanges = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ApprovalRequest>(`/approvals/${id}/request-changes`, { reason }),
    onSuccess: invalidate,
  });

  const requestDocuments = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ApprovalRequest>(`/approvals/${id}/request-documents`, { reason }),
    onSuccess: invalidate,
  });

  const resume = useMutation({
    mutationFn: ({ id, text }: { id: string; text?: string }) =>
      api.post<ApprovalRequest>(`/approvals/${id}/resume`, { text }),
    onSuccess: invalidate,
  });

  const comment = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<ApprovalComment>(`/approvals/${id}/comment`, payload),
    onSuccess: invalidate,
  });

  const delegate = useMutation({
    mutationFn: ({
      id,
      delegateId,
      reason,
    }: {
      id: string;
      delegateId: string;
      reason?: string;
    }) => api.post(`/approvals/${id}/delegate`, { delegateId, reason }),
    onSuccess: invalidate,
  });

  const forward = useMutation({
    mutationFn: ({ id, userId, note }: { id: string; userId: string; note?: string }) =>
      api.post(`/approvals/${id}/forward`, { userId, note }),
    onSuccess: invalidate,
  });

  const changePriority = useMutation({
    mutationFn: ({
      id,
      priority,
      reason,
    }: {
      id: string;
      priority: string;
      reason?: string;
    }) => api.post(`/approvals/${id}/priority`, { priority, reason }),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/approvals/${id}/cancel`, { reason }),
    onSuccess: invalidate,
  });

  const restart = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/approvals/${id}/restart`, { reason }),
    onSuccess: invalidate,
  });

  const batch = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<BatchApprovalResult>("/approvals/batch", payload),
    onSuccess: invalidate,
  });

  return {
    approve,
    reject,
    requestChanges,
    requestDocuments,
    resume,
    comment,
    delegate,
    forward,
    changePriority,
    cancel,
    restart,
    batch,
  };
}

// ── Fluxos ───────────────────────────────────────────────────────────────────

export function useApprovalFlows(
  companyId: string | undefined,
  includeInactive = false,
) {
  return useQuery({
    queryKey: ["approvals", "flows", companyId, includeInactive],
    queryFn: () =>
      api.get<ApprovalFlow[]>(
        `/approval-flows${buildQueryString({ companyId, includeInactive })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useApprovalFlow(id: string | undefined) {
  return useQuery({
    queryKey: ["approvals", "flow", id],
    queryFn: () => api.get<ApprovalFlow>(`/approval-flows/${id}`),
    enabled: Boolean(id),
  });
}

export function useApprovalFlowActions() {
  const invalidate = useInvalidate();

  const create = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<ApprovalFlow>("/approval-flows", payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<ApprovalFlow>(`/approval-flows/${id}`, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/approval-flows/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// ── Delegações ───────────────────────────────────────────────────────────────

export function useApprovalDelegations(
  companyId: string | undefined,
  activeOnly = false,
) {
  return useQuery({
    queryKey: ["approvals", "delegations", companyId, activeOnly],
    queryFn: () =>
      api.get<ApprovalDelegation[]>(
        `/approval-delegations${buildQueryString({ companyId, activeOnly })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useDelegationActions() {
  const invalidate = useInvalidate();

  const create = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<ApprovalDelegation>("/approval-delegations", payload),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api.post(`/approval-delegations/${id}/revoke`, {}),
    onSuccess: invalidate,
  });

  return { create, revoke };
}
