"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  AccountIntegration,
  AccountLimit,
  AccountStatusHistoryEntry,
  AccountUsage,
  AccountUser,
  Beneficiary,
  CardAlerts,
  CardUser,
  CompanyPixKey,
  CorporateCard,
  FinancialAccount,
  OpeningBalance,
  PaymentMethod,
  ReceiptMethod,
  TreasuryOverview,
  TreasurySettings,
} from "@/types/treasury";

type Payload = Record<string, unknown>;

function useInvalidate(keys: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ── Visão geral, parâmetros e favorecidos ────────────────────────────────────

export function useTreasuryOverview(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["treasury", "overview", organizationId, companyId],
    queryFn: () =>
      api.get<TreasuryOverview>(
        `/treasury/overview${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useTreasurySettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["treasury", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<TreasurySettings>(
        `/treasury/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateTreasurySettings() {
  const invalidate = useInvalidate(["treasury"]);
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
      api.patch<TreasurySettings>(
        `/treasury/settings${buildQueryString({ organizationId, companyId })}`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

export function useTreasuryStatusHistory(
  organizationId: string | undefined,
  filters: {
    companyId?: string;
    financialAccountId?: string;
    page?: number;
    perPage?: number;
  } = {},
) {
  return useQuery({
    queryKey: ["treasury", "status-history", organizationId, filters],
    queryFn: () =>
      api.get<PaginatedResult<AccountStatusHistoryEntry>>(
        `/treasury/status-history${buildQueryString({ organizationId, ...filters })}`,
      ),
    enabled: Boolean(organizationId),
    placeholderData: (previous) => previous,
  });
}

export function useBeneficiaries(
  organizationId: string | undefined,
  filters: { companyId?: string; search?: string } = {},
) {
  return useQuery({
    queryKey: ["treasury", "beneficiaries", organizationId, filters],
    queryFn: () =>
      api.get<{ items: Beneficiary[]; total: number; sources: string[] }>(
        `/treasury/beneficiaries${buildQueryString({ organizationId, ...filters })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

// ── Contas financeiras ───────────────────────────────────────────────────────

export interface FinancialAccountFilters {
  organizationId?: string;
  companyId?: string;
  accountType?: string;
  status?: string;
  financialInstitutionId?: string;
  search?: string;
  page?: number;
  perPage?: number;
  isPrimary?: boolean;
  hasPix?: boolean;
  hasIntegration?: boolean;
  hasOpeningBalance?: boolean;
}

export function useFinancialAccounts(filters: FinancialAccountFilters) {
  return useQuery({
    queryKey: ["financial-accounts", "list", filters],
    queryFn: () =>
      api.get<PaginatedResult<FinancialAccount>>(
        `/financial-accounts${buildQueryString({ ...filters })}`,
      ),
    enabled: Boolean(filters.organizationId),
    placeholderData: (previous) => previous,
  });
}

export function useFinancialAccount(id: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "detail", id],
    queryFn: () => api.get<FinancialAccount>(`/financial-accounts/${id}`),
    enabled: Boolean(id),
  });
}

export function useAccountUsage(id: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "usage", id],
    queryFn: () => api.get<AccountUsage>(`/financial-accounts/${id}/usage`),
    enabled: Boolean(id),
  });
}

export function useAccountActivationPendencies(id: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "pendencies", id],
    queryFn: () =>
      api.get<{ pendencies: string[] }>(
        `/financial-accounts/${id}/activation-pendencies`,
      ),
    enabled: Boolean(id),
  });
}

export function useAccountAudit(id: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "audit", id],
    queryFn: () =>
      api.get<{
        accountId: string;
        statusHistory: {
          id: string;
          previousStatus: string | null;
          newStatus: string;
          reason: string | null;
          changedAt: string;
        }[];
        auditLogs: {
          id: string;
          action: string;
          entity: string;
          field: string | null;
          reason: string | null;
          createdAt: string;
        }[];
      }>(`/financial-accounts/${id}/audit`),
    enabled: Boolean(id),
  });
}

export function useCreateFinancialAccount() {
  const invalidate = useInvalidate(["financial-accounts", "treasury"]);
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<FinancialAccount>("/financial-accounts", payload),
    onSuccess: invalidate,
  });
}

export function useSaveDraftFinancialAccount() {
  const invalidate = useInvalidate(["financial-accounts", "treasury"]);
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<FinancialAccount>("/financial-accounts/drafts", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFinancialAccount() {
  const invalidate = useInvalidate(["financial-accounts", "treasury"]);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<FinancialAccount>(`/financial-accounts/${id}`, payload),
    onSuccess: invalidate,
  });
}

/** Ações de ciclo de vida da conta. Todas exigem motivo, exceto ativar. */
export function useAccountLifecycle() {
  const invalidate = useInvalidate(["financial-accounts", "treasury"]);

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/financial-accounts/${id}/activate`, {}),
    onSuccess: invalidate,
  });

  const block = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/financial-accounts/${id}/block`, { reason }),
    onSuccess: invalidate,
  });

  const unblock = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/financial-accounts/${id}/unblock`, { reason }),
    onSuccess: invalidate,
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/financial-accounts/${id}/suspend`, { reason }),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/financial-accounts/${id}/deactivate`, { reason }),
    onSuccess: invalidate,
  });

  const close = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Payload) =>
      api.post(`/financial-accounts/${id}/close`, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/financial-accounts/${id}`),
    onSuccess: invalidate,
  });

  return { activate, block, unblock, suspend, deactivate, close, remove };
}

// ── Saldos e limites ─────────────────────────────────────────────────────────

export function useOpeningBalances(accountId: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "opening-balance", accountId],
    queryFn: () =>
      api.get<OpeningBalance[]>(`/financial-accounts/${accountId}/opening-balance`),
    enabled: Boolean(accountId),
  });
}

export function useCreateOpeningBalance() {
  const invalidate = useInvalidate(["financial-accounts"]);
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: Payload }) =>
      api.post<OpeningBalance>(
        `/financial-accounts/${accountId}/opening-balance`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

export function useAccountLimits(accountId: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "limits", accountId],
    queryFn: () => api.get<AccountLimit[]>(`/financial-accounts/${accountId}/limits`),
    enabled: Boolean(accountId),
  });
}

export function useCreateAccountLimit() {
  const invalidate = useInvalidate(["financial-accounts"]);
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: Payload }) =>
      api.post<AccountLimit>(`/financial-accounts/${accountId}/limits`, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateAccountLimit() {
  const invalidate = useInvalidate(["financial-accounts"]);
  return useMutation({
    mutationFn: ({
      accountId,
      limitId,
      payload,
    }: {
      accountId: string;
      limitId: string;
      payload: Payload;
    }) =>
      api.patch<AccountLimit>(
        `/financial-accounts/${accountId}/limits/${limitId}`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

// ── Usuários da conta ────────────────────────────────────────────────────────

export function useAccountUsers(accountId: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "users", accountId],
    queryFn: () => api.get<AccountUser[]>(`/financial-accounts/${accountId}/users`),
    enabled: Boolean(accountId),
  });
}

export function useUpsertAccountUser() {
  const invalidate = useInvalidate(["financial-accounts"]);
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: Payload }) =>
      api.post<AccountUser>(`/financial-accounts/${accountId}/users`, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveAccountUser() {
  const invalidate = useInvalidate(["financial-accounts"]);
  return useMutation({
    mutationFn: ({ accountId, userId }: { accountId: string; userId: string }) =>
      api.delete(`/financial-accounts/${accountId}/users/${userId}`),
    onSuccess: invalidate,
  });
}

// ── Integrações ──────────────────────────────────────────────────────────────

export function useAccountIntegrations(accountId: string | undefined) {
  return useQuery({
    queryKey: ["financial-accounts", "integrations", accountId],
    queryFn: () =>
      api.get<AccountIntegration[]>(`/financial-accounts/${accountId}/integrations`),
    enabled: Boolean(accountId),
  });
}

export function useAccountIntegrationActions() {
  const invalidate = useInvalidate(["financial-accounts"]);

  const create = useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: Payload }) =>
      api.post<AccountIntegration>(
        `/financial-accounts/${accountId}/integrations`,
        payload,
      ),
    onSuccess: invalidate,
  });

  const test = useMutation({
    mutationFn: ({
      accountId,
      integrationId,
    }: {
      accountId: string;
      integrationId: string;
    }) =>
      api.post<{
        success: boolean;
        simulated: boolean;
        message: string;
        problems: string[];
      }>(`/financial-accounts/${accountId}/integrations/${integrationId}/test`, {}),
  });

  const activate = useMutation({
    mutationFn: ({
      accountId,
      integrationId,
    }: {
      accountId: string;
      integrationId: string;
    }) =>
      api.post(
        `/financial-accounts/${accountId}/integrations/${integrationId}/activate`,
        {},
      ),
    onSuccess: invalidate,
  });

  const disconnect = useMutation({
    mutationFn: ({
      accountId,
      integrationId,
    }: {
      accountId: string;
      integrationId: string;
    }) =>
      api.post(
        `/financial-accounts/${accountId}/integrations/${integrationId}/disconnect`,
        {},
      ),
    onSuccess: invalidate,
  });

  return { create, test, activate, disconnect };
}

// ── Chaves PIX da empresa ────────────────────────────────────────────────────

export function useCompanyPixKeys(
  organizationId: string | undefined,
  filters: { companyId?: string; financialAccountId?: string } = {},
) {
  return useQuery({
    queryKey: ["company-pix-keys", organizationId, filters],
    queryFn: () =>
      api.get<CompanyPixKey[]>(
        `/company-pix-keys${buildQueryString({ organizationId, ...filters })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useCompanyPixKeyActions() {
  const invalidate = useInvalidate(["company-pix-keys", "financial-accounts", "treasury"]);

  const create = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<CompanyPixKey>("/company-pix-keys", payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<CompanyPixKey>(`/company-pix-keys/${id}`, payload),
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/company-pix-keys/${id}/activate`, {}),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/company-pix-keys/${id}/deactivate`, {}),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/company-pix-keys/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, activate, deactivate, remove };
}

// ── Cartões corporativos ─────────────────────────────────────────────────────

export interface CardFilters {
  organizationId?: string;
  companyId?: string;
  cardType?: string;
  status?: string;
  financialAccountId?: string;
  lastFourDigits?: string;
  search?: string;
  page?: number;
  perPage?: number;
  expiringSoon?: boolean;
}

export function useCorporateCards(filters: CardFilters) {
  return useQuery({
    queryKey: ["corporate-cards", "list", filters],
    queryFn: () =>
      api.get<PaginatedResult<CorporateCard>>(
        `/corporate-cards${buildQueryString({ ...filters })}`,
      ),
    enabled: Boolean(filters.organizationId),
    placeholderData: (previous) => previous,
  });
}

export function useCorporateCard(id: string | undefined) {
  return useQuery({
    queryKey: ["corporate-cards", "detail", id],
    queryFn: () => api.get<CorporateCard>(`/corporate-cards/${id}`),
    enabled: Boolean(id),
  });
}

export function useCardAlerts(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["corporate-cards", "alerts", organizationId, companyId],
    queryFn: () =>
      api.get<CardAlerts>(
        `/corporate-cards/alerts${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useCorporateCardActions() {
  const invalidate = useInvalidate(["corporate-cards", "treasury"]);

  const create = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<CorporateCard>("/corporate-cards", payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<CorporateCard>(`/corporate-cards/${id}`, payload),
    onSuccess: invalidate,
  });

  const block = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/corporate-cards/${id}/block`, { reason }),
    onSuccess: invalidate,
  });

  const unblock = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/corporate-cards/${id}/unblock`, { reason }),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/corporate-cards/${id}/deactivate`, { reason }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/corporate-cards/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, block, unblock, deactivate, remove };
}

export function useCardUsers(cardId: string | undefined) {
  return useQuery({
    queryKey: ["corporate-cards", "users", cardId],
    queryFn: () => api.get<CardUser[]>(`/corporate-cards/${cardId}/users`),
    enabled: Boolean(cardId),
  });
}

export function useUpsertCardUser() {
  const invalidate = useInvalidate(["corporate-cards"]);
  return useMutation({
    mutationFn: ({ cardId, payload }: { cardId: string; payload: Payload }) =>
      api.post<CardUser>(`/corporate-cards/${cardId}/users`, payload),
    onSuccess: invalidate,
  });
}

// ── Formas de pagamento e recebimento ────────────────────────────────────────

export function usePaymentMethods(
  organizationId: string | undefined,
  filters: { companyId?: string; status?: string; search?: string } = {},
) {
  return useQuery({
    queryKey: ["payment-methods", organizationId, filters],
    queryFn: () =>
      api.get<PaymentMethod[]>(
        `/payment-methods${buildQueryString({ organizationId, ...filters })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function usePaymentMethodActions() {
  const invalidate = useInvalidate(["payment-methods", "treasury"]);

  const create = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<PaymentMethod>("/payment-methods", payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<PaymentMethod>(`/payment-methods/${id}`, payload),
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/payment-methods/${id}/activate`, {}),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/payment-methods/${id}/deactivate`, {}),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/payment-methods/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, activate, deactivate, remove };
}

export function useReceiptMethods(
  organizationId: string | undefined,
  filters: { companyId?: string; status?: string; search?: string } = {},
) {
  return useQuery({
    queryKey: ["receipt-methods", organizationId, filters],
    queryFn: () =>
      api.get<ReceiptMethod[]>(
        `/receipt-methods${buildQueryString({ organizationId, ...filters })}`,
      ),
    enabled: Boolean(organizationId),
  });
}

export function useReceiptMethodActions() {
  const invalidate = useInvalidate(["receipt-methods", "treasury"]);

  const create = useMutation({
    mutationFn: (payload: Payload) =>
      api.post<ReceiptMethod>("/receipt-methods", payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<ReceiptMethod>(`/receipt-methods/${id}`, payload),
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/receipt-methods/${id}/activate`, {}),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/receipt-methods/${id}/deactivate`, {}),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/receipt-methods/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, activate, deactivate, remove };
}
