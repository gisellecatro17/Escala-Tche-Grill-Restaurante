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
  hasPermission: (permissionSlug: string) => boolean;
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
      if (!currentMembership) return false;
      if (currentMembership.role.slug === "platform_admin") return true;
      return currentMembership.permissions.includes(permissionSlug);
    },
    [currentMembership],
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
    }),
    [user, isLoading, isError, currentMembership, selectedCompanyId, selectCompany, hasPermission],
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
