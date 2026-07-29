"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { AuthenticatedUser, UserCompanyMembership } from "@/types";

const SELECTED_COMPANY_STORAGE_KEY = "pulse:selected-company-id";

interface SessionContextValue {
  user: AuthenticatedUser | undefined;
  isLoading: boolean;
  isError: boolean;
  currentMembership: UserCompanyMembership | undefined;
  selectedCompanyId: string | null;
  selectCompany: (companyId: string) => void;
  /** Permissão na empresa atualmente selecionada. */
  hasPermission: (permissionSlug: string) => boolean;
  /** Permissão em qualquer organização/empresa vinculada — usado para ações que ainda
   * não têm uma empresa em contexto (ex.: botão "Incluir nova empresa"). */
  hasPermissionAnywhere: (permissionSlug: string) => boolean;
  /** Permissão em uma empresa específica — usado em listagens que exibem várias empresas
   * ao mesmo tempo (não depende da empresa selecionada no cabeçalho). */
  hasPermissionForCompany: (companyId: string, permissionSlug: string) => boolean;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Preferência do usuário (definida explicitamente via selectCompany). A empresa
  // efetivamente ativa é derivada abaixo, validando essa preferência contra os
  // vínculos retornados pela API — sem sincronizar estado dentro de um efeito.
  const [preferredCompanyId, setPreferredCompanyId] = React.useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY),
  );

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<AuthenticatedUser>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });

  const selectedCompanyId = React.useMemo(() => {
    if (!user || user.memberships.length === 0) return null;

    const isPreferredValid =
      preferredCompanyId && user.memberships.some((m) => m.companyId === preferredCompanyId);

    return isPreferredValid ? preferredCompanyId : user.memberships[0].companyId;
  }, [user, preferredCompanyId]);

  const selectCompany = React.useCallback((companyId: string) => {
    setPreferredCompanyId(companyId);
    window.localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, companyId);
  }, []);

  const currentMembership = React.useMemo(
    () => user?.memberships.find((m) => m.companyId === selectedCompanyId),
    [user, selectedCompanyId],
  );

  const hasPermission = React.useCallback(
    (permissionSlug: string) => {
      if (user?.isPlatformAdmin) return true;
      if (!currentMembership) return false;
      return currentMembership.permissions.includes(permissionSlug);
    },
    [user, currentMembership],
  );

  const hasPermissionAnywhere = React.useCallback(
    (permissionSlug: string) => {
      if (!user) return false;
      if (user.isPlatformAdmin) return true;
      return (
        user.organizationMemberships.some((m) => m.permissions.includes(permissionSlug)) ||
        user.memberships.some((m) => m.permissions.includes(permissionSlug))
      );
    },
    [user],
  );

  const hasPermissionForCompany = React.useCallback(
    (companyId: string, permissionSlug: string) => {
      if (user?.isPlatformAdmin) return true;
      const membership = user?.memberships.find((m) => m.companyId === companyId);
      return membership?.permissions.includes(permissionSlug) ?? false;
    },
    [user],
  );

  const value = React.useMemo<SessionContextValue>(
    () => ({
      user,
      isLoading,
      isError,
      currentMembership,
      selectedCompanyId,
      selectCompany,
      hasPermission,
      hasPermissionAnywhere,
      hasPermissionForCompany,
    }),
    [
      user,
      isLoading,
      isError,
      currentMembership,
      selectedCompanyId,
      selectCompany,
      hasPermission,
      hasPermissionAnywhere,
      hasPermissionForCompany,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = React.useContext(SessionContext);

  if (!context) {
    throw new Error("useSession deve ser usado dentro de <SessionProvider>");
  }

  return context;
}
