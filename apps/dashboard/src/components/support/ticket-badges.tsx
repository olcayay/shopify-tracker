"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  awaiting_reply: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  awaiting_reply: "Awaiting Reply",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-muted-foreground/30 text-muted-foreground",
  normal: "border-blue-500/30 text-blue-600",
  high: "border-orange-500/30 text-orange-600",
  urgent: "border-red-500/30 text-red-600",
};

const TYPE_LABELS: Record<string, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  general_inquiry: "General Inquiry",
  billing_payments: "Billing & Payments",
  account_access: "Account Access",
  data_integration: "Data Integration",
  partnership: "Partnership",
  security_concern: "Security Concern",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("text-[11px] hover:bg-current/10", STATUS_STYLES[status] || STATUS_STYLES.open)}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "normal") return null;
  return (
    <Badge variant="outline" className={cn("text-[10px]", PRIORITY_STYLES[priority])}>
      {priority}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs text-muted-foreground">
      {TYPE_LABELS[type] || type}
    </span>
  );
}

export { STATUS_LABELS, TYPE_LABELS };
