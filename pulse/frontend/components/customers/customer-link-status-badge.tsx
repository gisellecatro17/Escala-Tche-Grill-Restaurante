import { Badge } from "@/components/ui/badge";
import { CUSTOMER_LINK_STATUS_LABELS, type CustomerLinkStatus } from "@/types/customer";

const VARIANT_BY_STATUS: Record<CustomerLinkStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  PROSPECT: "secondary",
  DRAFT: "outline",
  ACTIVE: "default",
  BLOCKED: "destructive",
  SUSPENDED: "warning",
  INACTIVE: "secondary",
};

export function CustomerLinkStatusBadge({ status }: { status: CustomerLinkStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{CUSTOMER_LINK_STATUS_LABELS[status]}</Badge>;
}
