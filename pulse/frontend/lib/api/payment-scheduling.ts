"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  AccountPosition,
  BulkResult,
  PaymentBatchDetail,
  PaymentBatchListItem,
  PaymentScheduleDetail,
  PaymentScheduleListItem,
  PaymentScheduleSettings,
  SchedulablePayable,
  ScheduleComment,
  ScheduleHistoryEntry,
  SchedulingDashboard,
  SimulationResult,
} from "@/types/payment-scheduling";

type Payload = Record<string, unknown>;
type QueryFilters = Record<string, string | number | boolean | undefined | null>;

/**
 * Programar mexe no título e no lote ao mesmo tempo. Derrubar as três árvores é mais
 * barato do que descobrir a cada ação qual pedaço do cache ficou velho — e evita a tela
 * mostrar um lote com o total antigo depois de uma inclusão.
 */
const KEYS = ["payment-scheduling", "accounts-payable"];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ── Painel, parâmetros e saldos ──────────────────────────────────────────────

export function useSchedulingDashboard(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["payment-scheduling", "dashboard", organizationId, companyId],
    queryFn: () =>
      api.get<SchedulingDashboard>(
        `/payment-schedules/dashboard${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
  });
}

export function useAccountPositions(
  companyId: string | undefined,
  referenceDate?: string,
) {
  return useQuery({
    queryKey: ["payment-scheduling", "positions", companyId, referenceDate],
    queryFn: () =>
      api.get<AccountPosition[]>(
        `/payment-schedules/account-positions${buildQueryString({
          companyId,
          referenceDate,
        })}`,
      ),
    enabled: Boolean(companyId),
  });
}

export function useSchedulingSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["payment-scheduling", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<PaymentScheduleSettings>(
        `/payment-schedules/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateSchedulingSettings() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      companyId: string;
      payload: Payload;
    }) =>
      api.patch<PaymentScheduleSettings>(
        `/payment-schedules/settings${buildQueryString({
          organizationId: input.organizationId,
          companyId: input.companyId,
        })}`,
        input.payload,
      ),
    onSuccess: invalidate,
  });
}

/** A simulação é POST porque leva as alterações hipotéticas no corpo. Não grava nada. */
export function useSimulation() {
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<SimulationResult>("/payment-schedules/simulate", payload),
  });
}

// ── Programações ─────────────────────────────────────────────────────────────

export function usePaymentSchedules(filters: QueryFilters) {
  return useQuery({
    queryKey: ["payment-scheduling", "list", filters],
    queryFn: () =>
      api.get<PaginatedResult<PaymentScheduleListItem>>(
        `/payment-schedules${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.companyId ?? filters.organizationId),
  });
}

export function useSchedulablePayables(filters: QueryFilters) {
  return useQuery({
    queryKey: ["payment-scheduling", "schedulable", filters],
    queryFn: () =>
      api.get<PaginatedResult<SchedulablePayable>>(
        `/payment-schedules/schedulable${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.companyId),
  });
}

export function usePaymentSchedule(id: string | undefined) {
  return useQuery({
    queryKey: ["payment-scheduling", "detail", id],
    queryFn: () => api.get<PaymentScheduleDetail>(`/payment-schedules/${id}`),
    enabled: Boolean(id),
  });
}

export function useScheduleHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["payment-scheduling", "history", id],
    queryFn: () =>
      api.get<ScheduleHistoryEntry[]>(`/payment-schedules/${id}/history`),
    enabled: Boolean(id),
  });
}

export function useCreateSchedule() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<PaymentScheduleDetail>("/payment-schedules", payload),
    onSuccess: invalidate,
  });
}

export function useScheduleActions(id: string | undefined) {
  const invalidate = useInvalidate();

  const post = <T,>(path: string) => (payload: Payload) =>
    api.post<T>(`/payment-schedules/${id}${path}`, payload);

  return {
    update: useMutation({
      mutationFn: (payload: Payload) =>
        api.patch<PaymentScheduleDetail>(`/payment-schedules/${id}`, payload),
      onSuccess: invalidate,
    }),
    reschedule: useMutation({
      mutationFn: post<PaymentScheduleDetail>("/reschedule"),
      onSuccess: invalidate,
    }),
    block: useMutation({
      mutationFn: post<PaymentScheduleDetail>("/block"),
      onSuccess: invalidate,
    }),
    unblock: useMutation({
      mutationFn: post<PaymentScheduleDetail>("/unblock"),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: post<PaymentScheduleDetail>("/cancel"),
      onSuccess: invalidate,
    }),
    comment: useMutation({
      mutationFn: post<ScheduleComment>("/comments"),
      onSuccess: invalidate,
    }),
  };
}

export function useBulkScheduleActions() {
  const invalidate = useInvalidate();

  return {
    update: useMutation({
      mutationFn: (payload: Payload) =>
        api.post<BulkResult>("/payment-schedules/bulk", payload),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (payload: Payload) =>
        api.post<BulkResult>("/payment-schedules/bulk-cancel", payload),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (payload: Payload) =>
        api.post<{ reordered: number }>("/payment-schedules/reorder", payload),
      onSuccess: invalidate,
    }),
  };
}

// ── Lotes ────────────────────────────────────────────────────────────────────

export function usePaymentBatches(filters: QueryFilters) {
  return useQuery({
    queryKey: ["payment-scheduling", "batches", filters],
    queryFn: () =>
      api.get<PaginatedResult<PaymentBatchListItem>>(
        `/payment-batches${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.companyId ?? filters.organizationId),
  });
}

export function usePaymentBatch(id: string | undefined) {
  return useQuery({
    queryKey: ["payment-scheduling", "batch", id],
    queryFn: () => api.get<PaymentBatchDetail>(`/payment-batches/${id}`),
    enabled: Boolean(id),
  });
}

export function useBatchActions(id?: string) {
  const invalidate = useInvalidate();

  return {
    create: useMutation({
      mutationFn: (payload: Payload) =>
        api.post<PaymentBatchDetail>("/payment-batches", payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (payload: Payload) =>
        api.patch<PaymentBatchDetail>(`/payment-batches/${id}`, payload),
      onSuccess: invalidate,
    }),
    addSchedules: useMutation({
      mutationFn: (payload: Payload) =>
        api.post<{ added: number; rejected: { scheduleId: string; reason: string }[] }>(
          `/payment-batches/${id}/schedules`,
          payload,
        ),
      onSuccess: invalidate,
    }),
    removeSchedules: useMutation({
      mutationFn: (payload: Payload) =>
        api.post<PaymentBatchDetail>(
          `/payment-batches/${id}/remove-schedules`,
          payload,
        ),
      onSuccess: invalidate,
    }),
  };
}
