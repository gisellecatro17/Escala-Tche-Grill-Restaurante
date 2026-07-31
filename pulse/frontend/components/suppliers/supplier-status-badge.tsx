import { Badge } from "@/components/ui/badge";
import { SUPPLIER_SYSTEM_STATUS_LABELS, type SupplierSystemStatus } from "@/types/supplier";

const VARIANT_BY_STATUS: Record<SupplierSystemStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  DRAFT: "outline",
  PENDING_VALIDATION: "secondary",
  ACTIVE: "default",
  SUSPENDED: "warning",
  INACTIVE: "destructive",
};

export function SupplierStatusBadge({ status }: { status: SupplierSystemStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{SUPPLIER_SYSTEM_STATUS_LABELS[status]}</Badge>;
}
