"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  AccountsPayableDashboard,
  AccountsPayableDetail,
  AccountsPayableListItem,
  AccountsPayableSettings,
  LateChargePreview,
  PayableComment,
  PayableHistoryEntry,
  SupplierAdvance,
} from "@/types/accounts-payable";

type Payload = Record<string, unknown>;

/** Filtros de consulta: só o que cabe numa query string. */
type QueryFilters = Record<string, string | number | boolean | undefined | null>;

/**
 * Um movimento no título mexe no painel, na lista e no detalhe ao mesmo tempo.
 * Invalidar a árvore inteira é mais barato do que descobrir, a cada ação, qual pedaço do
 * cache ficou velho — e evita a tela mostrar saldo antigo depois de uma baixa.
 */
const KEYS = ["accounts-payable", "document-processing", "approvals"];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ── Painel e parâmetros ──────────────────────────────────────────────────────

export function useAccountsPayableDashboard(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["accounts-payable", "dashboard", organizationId, companyId],
    queryFn: () =>
      api.get<AccountsPayableDashboard>(
        `/accounts-payable/dashboard${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
  });
}

export function useAccountsPayableSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["accounts-payable", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<AccountsPayableSettings>(
        `/accounts-payable/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateAccountsPayableSettings() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      companyId: string;
      payload: Payload;
    }) =>
      api.patch<AccountsPayableSettings>(
        `/accounts-payable/settings${buildQueryString({
          organizationId: input.organizationId,
          companyId: input.companyId,
        })}`,
        input.payload,
      ),
    onSuccess: invalidate,
  });
}

// ── Títulos ──────────────────────────────────────────────────────────────────

export function useAccountsPayable(filters: QueryFilters) {
  return useQuery({
    queryKey: ["accounts-payable", "list", filters],
    queryFn: () =>
      api.get<PaginatedResult<AccountsPayableListItem>>(
        `/accounts-payable${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.companyId ?? filters.organizationId),
  });
}

export function useAccountsPayableDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["accounts-payable", "detail", id],
    queryFn: () => api.get<AccountsPayableDetail>(`/accounts-payable/${id}`),
    enabled: Boolean(id),
  });
}

export function usePayableHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["accounts-payable", "history", id],
    queryFn: () =>
      api.get<PayableHistoryEntry[]>(`/accounts-payable/${id}/history`),
    enabled: Boolean(id),
  });
}

export function usePayableComments(id: string | undefined) {
  return useQuery({
    queryKey: ["accounts-payable", "comments", id],
    queryFn: () => api.get<PayableComment[]>(`/accounts-payable/${id}/comments`),
    enabled: Boolean(id),
  });
}

export function useLateCharges(id: string | undefined, enabled = false) {
  return useQuery({
    queryKey: ["accounts-payable", "late-charges", id],
    queryFn: () =>
      api.get<LateChargePreview>(`/accounts-payable/${id}/late-charges`),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateAccountsPayable() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<AccountsPayableDetail>("/accounts-payable", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateAccountsPayable() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: { id: string; payload: Payload }) =>
      api.patch<AccountsPayableDetail>(
        `/accounts-payable/${input.id}`,
        input.payload,
      ),
    onSuccess: invalidate,
  });
}

/**
 * As ações do título, todas com a mesma forma.
 *
 * Um único hook em vez de quinze: a tela de detalhe usa quase todas, e espalhá-las em
 * hooks separados obrigaria cada componente a declarar dez chamadas antes de renderizar
 * qualquer coisa.
 */
export function usePayableActions(id: string | undefined) {
  const invalidate = useInvalidate();

  // Uma mutação por ação, declaradas em linha. Gerar as chamadas dentro de um laço ou de
  // uma função auxiliar quebraria a regra dos hooks — a ordem precisa ser a mesma em todo
  // render, e o React não tem como garantir isso se a chamada estiver escondida.
  const post = <T,>(path: string) => (payload: Payload) =>
    api.post<T>(`/accounts-payable/${id}${path}`, payload);

  return {
    block: useMutation({ mutationFn: post<AccountsPayableDetail>("/block"), onSuccess: invalidate }),
    unblock: useMutation({ mutationFn: post<AccountsPayableDetail>("/unblock"), onSuccess: invalidate }),
    schedule: useMutation({ mutationFn: post<AccountsPayableDetail>("/schedule"), onSuccess: invalidate }),
    partialPayment: useMutation({
      mutationFn: post<AccountsPayableDetail>("/partial-payment"),
      onSuccess: invalidate,
    }),
    adjust: useMutation({ mutationFn: post<AccountsPayableDetail>("/adjustments"), onSuccess: invalidate }),
    renegotiate: useMutation({
      mutationFn: post<AccountsPayableDetail>("/renegotiate"),
      onSuccess: invalidate,
    }),
    reinstall: useMutation({ mutationFn: post<AccountsPayableDetail>("/reinstall"), onSuccess: invalidate }),
    applyAdvance: useMutation({
      mutationFn: post<AccountsPayableDetail>("/apply-advance"),
      onSuccess: invalidate,
    }),
    cancel: useMutation({ mutationFn: post<AccountsPayableDetail>("/cancel"), onSuccess: invalidate }),
    reopen: useMutation({ mutationFn: post<AccountsPayableDetail>("/reopen"), onSuccess: invalidate }),
    reviseWithholding: useMutation({
      mutationFn: post<AccountsPayableDetail>("/withholdings"),
      onSuccess: invalidate,
    }),
    comment: useMutation({ mutationFn: post<PayableComment>("/comments"), onSuccess: invalidate }),
  };
}

export function usePayableInstallmentActions() {
  const invalidate = useInvalidate();

  return {
    update: useMutation({
      mutationFn: (input: { installmentId: string; payload: Payload }) =>
        api.patch<AccountsPayableDetail>(
          `/accounts-payable/installments/${input.installmentId}`,
          input.payload,
        ),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (input: { installmentId: string; reason: string }) =>
        api.post<AccountsPayableDetail>(
          `/accounts-payable/installments/${input.installmentId}/cancel`,
          { reason: input.reason },
        ),
      onSuccess: invalidate,
    }),
  };
}

export function useReversePayment() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) =>
      api.post<AccountsPayableDetail>(
        `/accounts-payable/payments/${input.paymentId}/reverse`,
        { reason: input.reason },
      ),
    onSuccess: invalidate,
  });
}

export function useReverseAdjustment() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: { adjustmentId: string; reason: string }) =>
      api.post<AccountsPayableDetail>(
        `/accounts-payable/adjustments/${input.adjustmentId}/reverse`,
        { reason: input.reason },
      ),
    onSuccess: invalidate,
  });
}

// ── Adiantamentos ────────────────────────────────────────────────────────────

export function useSupplierAdvances(filters: QueryFilters) {
  return useQuery({
    queryKey: ["accounts-payable", "advances", filters],
    queryFn: () =>
      api.get<PaginatedResult<SupplierAdvance>>(
        `/supplier-advances${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.companyId),
  });
}

export function useCreateSupplierAdvance() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<SupplierAdvance>("/supplier-advances", payload),
    onSuccess: invalidate,
  });
}
