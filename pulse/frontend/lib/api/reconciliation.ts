"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  AccountBalanceRow,
  BankTransactionDetail,
  BankTransactionListItem,
  EligibleAccount,
  HistoryEntry,
  ImportPreview,
  ImportTemplate,
  MatchSuggestion,
  ReconciliationComment,
  ReconciliationDashboard,
  ReconciliationDetail,
  ReconciliationListItem,
  SettingsBundle,
  StatementImportDetail,
  StatementImportListItem,
  TimelinePoint,
  TransferCandidate,
  UnidentifiedRow,
  WithoutStatementResult,
} from "@/types/reconciliation";

type Payload = Record<string, unknown>;
type QueryFilters = Record<string, string | number | boolean | undefined | null>;

/**
 * Conciliar mexe na movimentação, na conciliação e no painel ao mesmo tempo — e o título
 * conciliado muda de leitura no Contas a Pagar. Derrubar as árvores inteiras é mais barato
 * do que rastrear a cada ação qual pedaço do cache envelheceu, e evita a tela mostrar uma
 * transação "a conciliar" que acabou de ser fechada.
 */
const KEYS = ["reconciliation", "accounts-payable", "payment-scheduling"];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

interface Scope {
  organizationId?: string;
  companyId?: string;
  financialAccountId?: string;
  from?: string;
  to?: string;
}

// ── Painel ───────────────────────────────────────────────────────────────────

export function useReconciliationDashboard(scope: Scope) {
  return useQuery({
    queryKey: ["reconciliation", "dashboard", scope],
    queryFn: () =>
      api.get<ReconciliationDashboard>(
        `/reconciliation/dashboard${buildQueryString(scope as QueryFilters)}`,
      ),
    enabled: Boolean(scope.organizationId),
    refetchInterval: 60_000,
  });
}

export function useReconciliationBalances(scope: Scope) {
  return useQuery({
    queryKey: ["reconciliation", "balances", scope],
    queryFn: () =>
      api.get<AccountBalanceRow[]>(
        `/reconciliation/balances${buildQueryString(scope as QueryFilters)}`,
      ),
    enabled: Boolean(scope.organizationId),
  });
}

export function useReconciliationTimeline(scope: Scope) {
  return useQuery({
    queryKey: ["reconciliation", "timeline", scope],
    queryFn: () =>
      api.get<TimelinePoint[]>(
        `/reconciliation/timeline${buildQueryString(scope as QueryFilters)}`,
      ),
    enabled: Boolean(scope.organizationId),
  });
}

export function useUnidentifiedTransactions(scope: Scope) {
  return useQuery({
    queryKey: ["reconciliation", "unidentified", scope],
    queryFn: () =>
      api.get<UnidentifiedRow[]>(
        `/reconciliation/unidentified${buildQueryString(scope as QueryFilters)}`,
      ),
    enabled: Boolean(scope.organizationId),
  });
}

export function useEntriesWithoutStatement(scope: Scope) {
  return useQuery({
    queryKey: ["reconciliation", "without-statement", scope],
    queryFn: () =>
      api.get<WithoutStatementResult>(
        `/reconciliation/without-statement${buildQueryString(scope as QueryFilters)}`,
      ),
    enabled: Boolean(scope.organizationId),
  });
}

export function useTransferCandidates(scope: Scope) {
  return useQuery({
    queryKey: ["reconciliation", "transfer-candidates", scope],
    queryFn: () =>
      api.get<TransferCandidate[]>(
        `/reconciliation/transfer-candidates${buildQueryString(scope as QueryFilters)}`,
      ),
    enabled: Boolean(scope.organizationId),
  });
}

// ── Parâmetros ───────────────────────────────────────────────────────────────

export function useReconciliationSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["reconciliation", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<SettingsBundle>(
        `/reconciliation/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateReconciliationSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (body: Payload) =>
      api.patch(
        `/reconciliation/settings${buildQueryString({ organizationId, companyId })}`,
        body,
      ),
    onSuccess: invalidate,
  });
}

export function useEligibleAccounts(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["reconciliation", "eligible-accounts", organizationId, companyId],
    queryFn: () =>
      api.get<EligibleAccount[]>(
        `/reconciliation/eligible-accounts${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

// ── Modelos de importação ────────────────────────────────────────────────────

export function useImportTemplates(filters: QueryFilters) {
  return useQuery({
    queryKey: ["reconciliation", "templates", filters],
    queryFn: () =>
      api.get<PaginatedResult<ImportTemplate>>(
        `/reconciliation/import-templates${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.organizationId),
  });
}

export function useTemplateActions() {
  const invalidate = useInvalidate();

  const create = useMutation({
    mutationFn: (body: Payload) =>
      api.post<ImportTemplate>("/reconciliation/import-templates", body),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: Payload & { id: string }) =>
      api.patch<ImportTemplate>(`/reconciliation/import-templates/${id}`, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/reconciliation/import-templates/${id}`),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// ── Importação ───────────────────────────────────────────────────────────────

export interface UploadStatementParams {
  organizationId: string;
  companyId: string;
  financialAccountId: string;
  file: File;
  importTemplateId?: string;
  statementStartDate?: string;
  statementEndDate?: string;
  openingBalance?: number;
  closingBalance?: number;
  notes?: string;
}

/**
 * Envia o extrato e devolve a prévia. **Nada é importado aqui**: o back-end lê, valida e
 * guarda o arquivo, mas as movimentações só nascem na confirmação.
 */
export function useUploadStatement() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ file, ...fields }: UploadStatementParams) => {
      const form = new FormData();
      form.append("file", file);

      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined || value === null || value === "") continue;
        form.append(key, String(value));
      }

      return api.post<ImportPreview>("/reconciliation/imports", form);
    },
    onSuccess: invalidate,
  });
}

export function useConfirmImport() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ id, ...body }: Payload & { id: string }) =>
      api.post(`/reconciliation/imports/${id}/confirm`, body),
    onSuccess: invalidate,
  });
}

export function useStatementImports(filters: QueryFilters) {
  return useQuery({
    queryKey: ["reconciliation", "imports", filters],
    queryFn: () =>
      api.get<PaginatedResult<StatementImportListItem>>(
        `/reconciliation/imports${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.organizationId ?? filters.companyId),
  });
}

export function useStatementImport(id: string | undefined) {
  return useQuery({
    queryKey: ["reconciliation", "import", id],
    queryFn: () => api.get<StatementImportDetail>(`/reconciliation/imports/${id}`),
    enabled: Boolean(id),
  });
}

export function useImportActions() {
  const invalidate = useInvalidate();

  /** A URL é assinada e temporária: o arquivo nunca fica público. */
  const download = useMutation({
    mutationFn: (id: string) =>
      api.get<{ url: string; expiresIn: number }>(
        `/reconciliation/imports/${id}/download`,
      ),
  });

  const reprocess = useMutation({
    mutationFn: (id: string) =>
      api.post(`/reconciliation/imports/${id}/reprocess`, {}),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/reconciliation/imports/${id}/cancel`, { reason }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api.post(`/reconciliation/imports/${id}/archive`, {}),
    onSuccess: invalidate,
  });

  return { download, reprocess, cancel, archive };
}

// ── Movimentações ────────────────────────────────────────────────────────────

export function useBankTransactions(filters: QueryFilters) {
  return useQuery({
    queryKey: ["reconciliation", "transactions", filters],
    queryFn: () =>
      api.get<PaginatedResult<BankTransactionListItem>>(
        `/reconciliation/transactions${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.organizationId ?? filters.companyId),
  });
}

export function useBankTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ["reconciliation", "transaction", id],
    queryFn: () =>
      api.get<BankTransactionDetail>(`/reconciliation/transactions/${id}`),
    enabled: Boolean(id),
  });
}

export function useTransactionHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["reconciliation", "transaction-history", id],
    queryFn: () =>
      api.get<HistoryEntry[]>(`/reconciliation/transactions/${id}/history`),
    enabled: Boolean(id),
  });
}

export function useTransactionSuggestions(id: string | undefined) {
  return useQuery({
    queryKey: ["reconciliation", "suggestions", id],
    queryFn: () =>
      api.get<MatchSuggestion[]>(`/reconciliation/transactions/${id}/suggestions`),
    enabled: Boolean(id),
  });
}

export function useTransactionActions() {
  const invalidate = useInvalidate();

  const createManual = useMutation({
    mutationFn: (body: Payload) =>
      api.post<BankTransactionListItem>("/reconciliation/transactions", body),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: Payload & { id: string }) =>
      api.patch(`/reconciliation/transactions/${id}`, body),
    onSuccess: invalidate,
  });

  const ignore = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/reconciliation/transactions/${id}/ignore`, { reason }),
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: ({ id, ...body }: Payload & { id: string }) =>
      api.post(`/reconciliation/transactions/${id}/assign`, body),
    onSuccess: invalidate,
  });

  return { createManual, update, ignore, assign };
}

// ── Sugestões ────────────────────────────────────────────────────────────────

export function useSuggestionActions() {
  const invalidate = useInvalidate();

  /** Gera sugestões. Nada é conciliado: o status vira "sugestão encontrada". */
  const generate = useMutation({
    mutationFn: (transactionId: string) =>
      api.post(`/reconciliation/transactions/${transactionId}/suggestions`, {}),
    onSuccess: invalidate,
  });

  const generateBatch = useMutation({
    mutationFn: (body: Payload) =>
      api.post("/reconciliation/suggestions/generate", body),
    onSuccess: invalidate,
  });

  const accept = useMutation({
    mutationFn: ({ id, ...body }: Payload & { id: string }) =>
      api.post<ReconciliationDetail>(
        `/reconciliation/suggestions/${id}/accept`,
        body,
      ),
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/reconciliation/suggestions/${id}/dismiss`, { reason }),
    onSuccess: invalidate,
  });

  return { generate, generateBatch, accept, dismiss };
}

// ── Conciliações ─────────────────────────────────────────────────────────────

export function useReconciliations(filters: QueryFilters) {
  return useQuery({
    queryKey: ["reconciliation", "list", filters],
    queryFn: () =>
      api.get<PaginatedResult<ReconciliationListItem>>(
        `/reconciliation/reconciliations${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.organizationId ?? filters.companyId),
  });
}

export function useReconciliation(id: string | undefined) {
  return useQuery({
    queryKey: ["reconciliation", "detail", id],
    queryFn: () =>
      api.get<ReconciliationDetail>(`/reconciliation/reconciliations/${id}`),
    enabled: Boolean(id),
  });
}

export function useReconciliationActions() {
  const invalidate = useInvalidate();

  const create = useMutation({
    mutationFn: (body: Payload) =>
      api.post<ReconciliationDetail>("/reconciliation/reconciliations", body),
    onSuccess: invalidate,
  });

  const unmatch = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ReconciliationDetail>(
        `/reconciliation/reconciliations/${id}/unmatch`,
        { reason },
      ),
    onSuccess: invalidate,
  });

  const linkTransfer = useMutation({
    mutationFn: (body: Payload) =>
      api.post<ReconciliationDetail>("/reconciliation/transfers", body),
    onSuccess: invalidate,
  });

  return { create, unmatch, linkTransfer };
}

// ── Comentários ──────────────────────────────────────────────────────────────

export function useReconciliationComments(filters: QueryFilters) {
  return useQuery({
    queryKey: ["reconciliation", "comments", filters],
    queryFn: () =>
      api.get<ReconciliationComment[]>(
        `/reconciliation/comments${buildQueryString(filters)}`,
      ),
    enabled: Boolean(filters.organizationId && filters.companyId),
  });
}

export function useAddReconciliationComment() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (body: Payload) => api.post("/reconciliation/comments", body),
    onSuccess: invalidate,
  });
}
