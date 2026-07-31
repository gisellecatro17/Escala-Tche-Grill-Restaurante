"use client";

import { useQuery } from "@tanstack/react-query";

import { api, buildQueryString } from "@/lib/api/client";
import type { FinancialInstitution } from "@/types/supplier";

export function useFinancialInstitutions(search?: string) {
  return useQuery({
    queryKey: ["financial-institutions", search],
    queryFn: () => api.get<FinancialInstitution[]>(`/financial-institutions${buildQueryString({ search })}`),
    placeholderData: (previous) => previous,
  });
}
