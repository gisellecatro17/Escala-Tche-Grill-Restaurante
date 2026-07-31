import { Badge } from "@/components/ui/badge";
import { CUSTOMER_FINANCIAL_STATUS_LABELS, type CustomerFinancialStatus } from "@/types/customer";

const VARIANT_BY_STATUS: Record<CustomerFinancialStatus, "default" | "secondary" | "outline" | "warning" | "destructive"> = {
  ON_TIME: "default",
  ATTENTION: "warning",
  OVERDUE: "warning",
  DELINQUENT: "destructive",
  NEGOTIATING: "secondary",
  BLOCKED: "destructive",
  SUSPENDED: "destructive",
  NO_ACTIVITY: "outline",
};

export function CustomerFinancialStatusBadge({ status }: { status: CustomerFinancialStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{CUSTOMER_FINANCIAL_STATUS_LABELS[status]}</Badge>;
}
