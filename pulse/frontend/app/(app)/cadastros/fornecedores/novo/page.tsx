"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { useSession } from "@/lib/auth/session-context";
import { SupplierWizard } from "@/components/suppliers/wizard/supplier-wizard";

function NewSupplierContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") ?? undefined;
  const { selectedCompanyId } = useSession();

  return <SupplierWizard draftId={draftId} preferredCompanyId={selectedCompanyId ?? undefined} />;
}

export default function NewSupplierPage() {
  return (
    <Suspense fallback={null}>
      <NewSupplierContent />
    </Suspense>
  );
}
