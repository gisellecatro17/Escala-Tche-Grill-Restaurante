"use client";

import { useQuery } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { Organization, PaginatedResult } from "@/types";

export function useOrganizations(search?: string) {
  return useQuery({
    queryKey: ["organizations", "list", search ?? ""],
    queryFn: () =>
      api.get<PaginatedResult<Organization>>(`/organizations${buildQueryString({ perPage: 100, search })}`),
  });
}
