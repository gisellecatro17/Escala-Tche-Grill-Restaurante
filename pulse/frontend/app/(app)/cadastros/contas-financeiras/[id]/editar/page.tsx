"use client";

import { useParams } from "next/navigation";

import { useFinancialAccount } from "@/lib/api/treasury";
import { FinancialAccountWizard } from "@/components/treasury/financial-account-wizard";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditarContaFinanceiraPage() {
  const { id } = useParams<{ id: string }>();
  const { data: account, isLoading } = useFinancialAccount(id);

  if (isLoading || !account) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <FinancialAccountWizard account={account} />;
}
