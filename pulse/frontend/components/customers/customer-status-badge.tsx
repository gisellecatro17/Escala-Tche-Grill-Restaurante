import { Badge } from "@/components/ui/badge";
import { CUSTOMER_SYSTEM_STATUS_LABELS, type CustomerSystemStatus } from "@/types/customer";

const VARIANT_BY_STATUS: Record<CustomerSystemStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  DRAFT: "outline",
  PENDING_VALIDATION: "secondary",
  ACTIVE: "default",
  SUSPENDED: "warning",
  INACTIVE: "destructive",
};

export function CustomerStatusBadge({ status }: { status: CustomerSystemStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{CUSTOMER_SYSTEM_STATUS_LABELS[status]}</Badge>;
}
