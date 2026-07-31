import { Badge } from "@/components/ui/badge";
import { SUPPLIER_LINK_STATUS_LABELS, type SupplierLinkStatus } from "@/types/supplier";

const VARIANT_BY_STATUS: Record<SupplierLinkStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  DRAFT: "outline",
  ACTIVE: "default",
  BLOCKED: "destructive",
  SUSPENDED: "warning",
  INACTIVE: "secondary",
};

export function SupplierLinkStatusBadge({ status }: { status: SupplierLinkStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{SUPPLIER_LINK_STATUS_LABELS[status]}</Badge>;
}
