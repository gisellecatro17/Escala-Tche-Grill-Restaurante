"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { useSession } from "@/lib/auth/session-context";
import { CompanyWizard } from "@/components/companies/wizard/company-wizard";

function NewCompanyContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") ?? undefined;
  const { user } = useSession();

  const eligibleOrganizations = Array.from(
    new Set(user?.organizationMemberships.map((m) => m.organizationId) ?? []),
  );
  const preferredOrganizationId = eligibleOrganizations.length === 1 ? eligibleOrganizations[0] : undefined;

  return <CompanyWizard draftId={draftId} preferredOrganizationId={preferredOrganizationId} />;
}

export default function NewCompanyPage() {
  return (
    <Suspense fallback={null}>
      <NewCompanyContent />
    </Suspense>
  );
}
