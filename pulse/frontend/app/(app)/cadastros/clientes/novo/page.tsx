"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { useSession } from "@/lib/auth/session-context";
import { CustomerWizard } from "@/components/customers/wizard/customer-wizard";

function NewCustomerContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") ?? undefined;
  const { selectedCompanyId } = useSession();

  return <CustomerWizard draftId={draftId} preferredCompanyId={selectedCompanyId ?? undefined} />;
}

export default function NewCustomerPage() {
  return (
    <Suspense fallback={null}>
      <NewCustomerContent />
    </Suspense>
  );
}
