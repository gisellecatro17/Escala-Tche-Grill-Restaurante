"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { PaginatedResult } from "@/types";
import type {
  BatchActionResult,
  BatchUploadResult,
  BoletoValidationResult,
  DocumentIntakeOverview,
  DocumentIntakeSettings,
  IntakeDocument,
  IntakeDuplicateComparison,
  IntakeDuplicateMatch,
  IntakeExtractedField,
  IntakeIssue,
  IntakeProcessingJob,
  IntakeRelation,
  UploadResult,
} from "@/types/document-intake";

type Payload = Record<string, unknown>;

function useInvalidate(keys: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

const INTAKE_KEYS = ["document-intake"];

// ── Visão geral e parâmetros ─────────────────────────────────────────────────

export function useDocumentIntakeOverview(
  organizationId: string | undefined,
  companyId?: string,
) {
  return useQuery({
    queryKey: ["document-intake", "overview", organizationId, companyId],
    queryFn: () =>
      api.get<DocumentIntakeOverview>(
        `/document-intake/overview${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId),
    // A visão geral mostra fila e processamento em andamento: precisa se atualizar sozinha.
    refetchInterval: 15_000,
  });
}

export function useDocumentIntakeSettings(
  organizationId: string | undefined,
  companyId: string | undefined,
) {
  return useQuery({
    queryKey: ["document-intake", "settings", organizationId, companyId],
    queryFn: () =>
      api.get<DocumentIntakeSettings>(
        `/document-intake/settings${buildQueryString({ organizationId, companyId })}`,
      ),
    enabled: Boolean(organizationId && companyId),
  });
}

export function useUpdateDocumentIntakeSettings() {
  const invalidate = useInvalidate(INTAKE_KEYS);
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
      api.patch<DocumentIntakeSettings>(
        `/document-intake/settings${buildQueryString({ organizationId, companyId })}`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

// ── Envio ────────────────────────────────────────────────────────────────────

export interface UploadParams {
  organizationId: string;
  companyId: string;
  file: File;
  sourceChannel?: string;
  documentType?: string;
  notes?: string;
  priority?: string;
}

/** Monta o `FormData` do envio. Campos vazios não vão: o back-end trata como ausentes. */
function buildUploadForm(params: Omit<UploadParams, "file"> & { file?: File }): FormData {
  const form = new FormData();
  if (params.file) form.append("file", params.file);
  form.append("organizationId", params.organizationId);
  form.append("companyId", params.companyId);
  if (params.sourceChannel) form.append("sourceChannel", params.sourceChannel);
  if (params.documentType) form.append("documentType", params.documentType);
  if (params.notes) form.append("notes", params.notes);
  if (params.priority) form.append("priority", params.priority);
  return form;
}

export function useUploadDocument() {
  const invalidate = useInvalidate(INTAKE_KEYS);
  return useMutation({
    mutationFn: (params: UploadParams) =>
      api.post<UploadResult>("/document-intake/uploads", buildUploadForm(params)),
    onSuccess: invalidate,
  });
}

export function useUploadBatch() {
  const invalidate = useInvalidate(INTAKE_KEYS);
  return useMutation({
    mutationFn: (params: Omit<UploadParams, "file"> & { files: File[] }) => {
      const form = buildUploadForm({ ...params, file: undefined });
      for (const file of params.files) form.append("files", file);
      return api.post<BatchUploadResult>("/document-intake/uploads/batch", form);
    },
    onSuccess: invalidate,
  });
}

export function useCaptureDocument() {
  const invalidate = useInvalidate(INTAKE_KEYS);
  return useMutation({
    mutationFn: (params: UploadParams) =>
      api.post<UploadResult>("/document-intake/capture", buildUploadForm(params)),
    onSuccess: invalidate,
  });
}

export function useCreateManualEntry() {
  const invalidate = useInvalidate(INTAKE_KEYS);
  return useMutation({
    mutationFn: (payload: Payload) =>
      api.post<IntakeDocument>("/document-intake/manual", payload),
    onSuccess: invalidate,
  });
}

// ── Caixa de entrada ─────────────────────────────────────────────────────────

export interface IntakeDocumentFilters {
  organizationId?: string;
  companyId?: string;
  unassignedCompany?: boolean;
  processingStatus?: string;
  reviewStatus?: string;
  documentType?: string;
  documentDirection?: string;
  sourceChannel?: string;
  duplicateStatus?: string;
  priority?: string;
  supplierId?: string;
  customerId?: string;
  assignedUserId?: string;
  batchImportId?: string;
  hasIssues?: boolean;
  hasBlockingIssues?: boolean;
  minimumConfidence?: number;
  maximumConfidence?: number;
  receivedFrom?: string;
  receivedTo?: string;
  dueFrom?: string;
  dueTo?: string;
  minimumAmount?: number;
  maximumAmount?: number;
  search?: string;
  page?: number;
  perPage?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

export function useIntakeDocuments(filters: IntakeDocumentFilters) {
  return useQuery({
    queryKey: ["document-intake", "documents", filters],
    queryFn: () =>
      api.get<PaginatedResult<IntakeDocument>>(
        `/document-intake/documents${buildQueryString({ ...filters })}`,
      ),
    enabled: Boolean(filters.organizationId),
    placeholderData: (previous) => previous,
    // Documentos em processamento mudam de estado sozinhos: a lista acompanha.
    refetchInterval: 20_000,
  });
}

export function useIntakeDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["document-intake", "document", id],
    queryFn: () => api.get<IntakeDocument>(`/document-intake/documents/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * URL assinada do documento.
 *
 * Não fica em cache por tempo indeterminado: a URL expira em cinco minutos, então
 * `staleTime` curto evita entregar um link morto ao visualizador.
 */
export function useDocumentAccessUrl(
  id: string | undefined,
  intent: "VIEW" | "DOWNLOAD" = "VIEW",
  enabled = true,
) {
  return useQuery({
    queryKey: ["document-intake", "access-url", id, intent],
    queryFn: () =>
      api.get<{ url: string; expiresAt: string; fileName: string | null }>(
        `/document-intake/documents/${id}/access-url${buildQueryString({ intent })}`,
      ),
    enabled: Boolean(id) && enabled,
    staleTime: 120_000,
    gcTime: 120_000,
  });
}

export function useIntakeExtractedFields(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-intake", "extracted-fields", documentId],
    queryFn: () =>
      api.get<IntakeExtractedField[]>(
        `/document-intake/documents/${documentId}/extracted-fields`,
      ),
    enabled: Boolean(documentId),
  });
}

export function useIntakeIssues(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-intake", "issues", documentId],
    queryFn: () =>
      api.get<IntakeIssue[]>(`/document-intake/documents/${documentId}/issues`),
    enabled: Boolean(documentId),
  });
}

export function useIntakeDuplicates(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-intake", "duplicates", documentId],
    queryFn: () =>
      api.get<IntakeDuplicateMatch[]>(
        `/document-intake/documents/${documentId}/duplicates`,
      ),
    enabled: Boolean(documentId),
  });
}

export function useDuplicateComparison(
  documentId: string | undefined,
  matchId: string | undefined,
) {
  return useQuery({
    queryKey: ["document-intake", "duplicate-comparison", documentId, matchId],
    queryFn: () =>
      api.get<IntakeDuplicateComparison>(
        `/document-intake/documents/${documentId}/duplicates/${matchId}/compare`,
      ),
    enabled: Boolean(documentId && matchId),
  });
}

export function useIntakeRelations(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-intake", "relations", documentId],
    queryFn: () =>
      api.get<IntakeRelation[]>(`/document-intake/documents/${documentId}/relations`),
    enabled: Boolean(documentId),
  });
}

export function useIntakeProcessingJobs(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-intake", "jobs", documentId],
    queryFn: () =>
      api.get<IntakeProcessingJob[]>(
        `/document-intake/documents/${documentId}/processing-jobs`,
      ),
    enabled: Boolean(documentId),
    refetchInterval: 10_000,
  });
}

// ── Ações sobre o documento ──────────────────────────────────────────────────

export function useIntakeDocumentActions() {
  const invalidate = useInvalidate(INTAKE_KEYS);

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.patch<IntakeDocument>(`/document-intake/documents/${id}`, payload),
    onSuccess: invalidate,
  });

  const review = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<IntakeDocument>(`/document-intake/documents/${id}/review`, payload),
    onSuccess: invalidate,
  });

  const forward = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post<IntakeDocument>(`/document-intake/documents/${id}/forward`, { notes }),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({
      id,
      rejectionReason,
      notes,
    }: {
      id: string;
      rejectionReason: string;
      notes?: string;
    }) =>
      api.post<IntakeDocument>(`/document-intake/documents/${id}/reject`, {
        rejectionReason,
        notes,
      }),
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<IntakeDocument>(`/document-intake/documents/${id}/reopen`, { reason }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<IntakeDocument>(`/document-intake/documents/${id}/archive`, { reason }),
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post(`/document-intake/documents/${id}/assign`, payload),
    onSuccess: invalidate,
  });

  const changeCompany = useMutation({
    mutationFn: ({
      id,
      companyId,
      reason,
    }: {
      id: string;
      companyId: string;
      reason: string;
    }) =>
      api.post(`/document-intake/documents/${id}/change-company`, { companyId, reason }),
    onSuccess: invalidate,
  });

  const reprocess = useMutation({
    mutationFn: (id: string) =>
      api.post(`/document-intake/documents/${id}/reprocess`, {}),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/document-intake/documents/${id}`),
    onSuccess: invalidate,
  });

  const split = useMutation({
    mutationFn: ({
      id,
      installments,
    }: {
      id: string;
      installments: { amount: number; dueDate: string; description?: string }[];
    }) => api.post(`/document-intake/documents/${id}/split`, { installments }),
    onSuccess: invalidate,
  });

  const relate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post(`/document-intake/documents/${id}/relations`, payload),
    onSuccess: invalidate,
  });

  const unrelate = useMutation({
    mutationFn: ({ id, relationId }: { id: string; relationId: string }) =>
      api.delete(`/document-intake/documents/${id}/relations/${relationId}`),
    onSuccess: invalidate,
  });

  const updateExtractedField = useMutation({
    mutationFn: ({
      id,
      fieldId,
      normalizedValue,
    }: {
      id: string;
      fieldId: string;
      normalizedValue: string;
    }) =>
      api.patch(`/document-intake/documents/${id}/extracted-fields/${fieldId}`, {
        normalizedValue,
      }),
    onSuccess: invalidate,
  });

  return {
    update,
    review,
    forward,
    reject,
    reopen,
    archive,
    assign,
    changeCompany,
    reprocess,
    remove,
    split,
    relate,
    unrelate,
    updateExtractedField,
  };
}

// ── Duplicidade e pendências ─────────────────────────────────────────────────

export function useDuplicateActions() {
  const invalidate = useInvalidate(INTAKE_KEYS);

  const check = useMutation({
    mutationFn: (id: string) =>
      api.post(`/document-intake/documents/${id}/duplicates/check`, {}),
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: ({ id, matchId, reason }: { id: string; matchId: string; reason?: string }) =>
      api.post(`/document-intake/documents/${id}/duplicates/${matchId}/confirm`, { reason }),
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: ({ id, matchId, reason }: { id: string; matchId: string; reason?: string }) =>
      api.post(`/document-intake/documents/${id}/duplicates/${matchId}/dismiss`, { reason }),
    onSuccess: invalidate,
  });

  const replace = useMutation({
    mutationFn: ({ id, matchId, reason }: { id: string; matchId: string; reason?: string }) =>
      api.post(`/document-intake/documents/${id}/duplicates/${matchId}/replace`, { reason }),
    onSuccess: invalidate,
  });

  return { check, confirm, dismiss, replace };
}

export function useIssueActions() {
  const invalidate = useInvalidate(INTAKE_KEYS);

  const create = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Payload }) =>
      api.post<IntakeIssue>(`/document-intake/documents/${id}/issues`, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      issueId,
      payload,
    }: {
      id: string;
      issueId: string;
      payload: Payload;
    }) => api.patch<IntakeIssue>(`/document-intake/documents/${id}/issues/${issueId}`, payload),
    onSuccess: invalidate,
  });

  const resolve = useMutation({
    mutationFn: ({
      id,
      issueId,
      resolution,
    }: {
      id: string;
      issueId: string;
      resolution: string;
    }) =>
      api.post(`/document-intake/documents/${id}/issues/${issueId}/resolve`, { resolution }),
    onSuccess: invalidate,
  });

  return { create, update, resolve };
}

// ── Ações em lote ────────────────────────────────────────────────────────────

/**
 * Ações em lote (seção 76).
 *
 * Cada mutação é declarada explicitamente em vez de gerada em laço: `useMutation` é um
 * hook, e um helper que o chama quebraria a regra de ordem estável dos hooks.
 */
export function useBatchActions() {
  const invalidate = useInvalidate(INTAKE_KEYS);

  const batch = (action: string) => ({
    mutationFn: (payload: Payload) =>
      api.post<BatchActionResult>(`/document-intake/documents/batch/${action}`, payload),
    onSuccess: invalidate,
  });

  const assign = useMutation(batch("assign"));
  const classify = useMutation(batch("classify"));
  const forward = useMutation(batch("forward"));
  const reprocess = useMutation(batch("reprocess"));
  const archive = useMutation(batch("archive"));
  const reject = useMutation(batch("reject"));

  return { assign, classify, forward, reprocess, archive, reject };
}

/**
 * URL de download sob demanda.
 *
 * Diferente de `useDocumentAccessUrl`, esta versão é imperativa de propósito: o download
 * exige a permissão `document_intake.download` e é registrado na auditoria, então a URL só
 * deve ser pedida quando o usuário realmente clicar — nunca ao renderizar a tela.
 */
export function requestDocumentDownloadUrl(id: string) {
  return api.get<{ url: string; expiresAt: string; fileName: string | null }>(
    `/document-intake/documents/${id}/access-url${buildQueryString({ intent: "DOWNLOAD" })}`,
  );
}

// ── Boleto ───────────────────────────────────────────────────────────────────

export function useValidateBoleto() {
  return useMutation({
    mutationFn: (code: string) =>
      api.post<BoletoValidationResult>("/document-intake/boleto/validate", { code }),
  });
}
