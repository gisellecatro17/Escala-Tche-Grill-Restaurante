import { Badge } from "@/components/ui/badge";
import { COMPANY_SYSTEM_STATUS_LABELS, type CompanySystemStatus } from "@/types/company";

const VARIANT_BY_STATUS: Record<CompanySystemStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  DRAFT: "outline",
  IMPLEMENTATION: "secondary",
  ACTIVE: "default",
  SUSPENDED: "warning",
  INACTIVE: "destructive",
  CLOSED: "destructive",
};

export function CompanyStatusBadge({ status }: { status: CompanySystemStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{COMPANY_SYSTEM_STATUS_LABELS[status]}</Badge>;
}
