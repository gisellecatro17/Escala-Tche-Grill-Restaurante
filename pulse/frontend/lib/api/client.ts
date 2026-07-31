import { createClient } from "@/lib/supabase/client";
import type { ApiResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export class ApiRequestError extends Error {
  errors: string[];
  status: number;

  constructor(message: string, errors: string[], status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.errors = errors;
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  companyId?: string;
}

/**
 * Cliente HTTP para a API do Pulse. Anexa o token de sessão do Supabase
 * e a empresa selecionada (X-Company-Id) em toda requisição.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  if (options.companyId) {
    headers.set("X-Company-Id", options.companyId);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    throw new ApiRequestError(payload.message, payload.errors, response.status);
  }

  return payload.data;
}

/** Monta a query string a partir de um objeto de filtros, ignorando valores vazios. */
export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
