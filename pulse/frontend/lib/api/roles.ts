"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Role } from "@/types";

export function useRoles() {
  return useQuery({
    queryKey: ["roles", "list"],
    queryFn: () => api.get<Role[]>("/roles"),
    staleTime: 5 * 60_000,
  });
}
