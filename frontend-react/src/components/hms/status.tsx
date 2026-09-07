import { CheckCircle2, CircleDot, Clock, RefreshCw, UserRoundCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComplaintStatus =
  | "Pending"
  | "In Progress"
  | "Resolved"
  | "Reopened"
  | "submitted"
  | "assigned"
  | "in_progress"
  | "resolved";

export const STATUS_LABEL: Record<string, string> = {
  Pending: "Pending",
  "In Progress": "In Progress",
  Resolved: "Resolved",
  Reopened: "Reopened",
  submitted: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export function normalizeStatus(status: string | undefined): "Pending" | "In Progress" | "Resolved" | "Reopened" {
  if (!status) return "Pending";
  const s = status.toLowerCase();
  if (s === "resolved") return "Resolved";
  if (s === "in progress" || s === "in_progress" || s === "assigned") return "In Progress";
  if (s === "reopened") return "Reopened";
  return "Pending";
}

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-[var(--hms-info-soft)] text-[var(--hms-info-foreground)] ring-[var(--hms-info)]/25",
  "In Progress": "bg-[var(--hms-warning-soft)] text-[var(--hms-warning-foreground)] ring-[var(--hms-warning)]/30",
  Resolved: "bg-[var(--hms-success-soft)] text-[var(--hms-success-foreground)] ring-[var(--hms-success)]/25",
  Reopened: "bg-amber-100 text-amber-900 ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300",
  submitted: "bg-[var(--hms-info-soft)] text-[var(--hms-info-foreground)] ring-[var(--hms-info)]/25",
  assigned: "bg-[var(--hms-warning-soft)] text-[var(--hms-warning-foreground)] ring-[var(--hms-warning)]/25",
  in_progress: "bg-[var(--hms-warning-soft)] text-[var(--hms-warning-foreground)] ring-[var(--hms-warning)]/30",
  resolved: "bg-[var(--hms-success-soft)] text-[var(--hms-success-foreground)] ring-[var(--hms-success)]/25",
};

export function StatusBadge({
  status,
  withIcon = false,
  className,
}: {
  status: string;
  withIcon?: boolean;
  className?: string;
}) {
  const norm = normalizeStatus(status);
  const Icon =
    norm === "Pending"
      ? Clock
      : norm === "In Progress"
        ? Wrench
        : norm === "Resolved"
          ? CheckCircle2
          : RefreshCw;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status] || STATUS_STYLE[norm],
        className
      )}
    >
      {withIcon ? <Icon className="mr-1.5 size-3.5" aria-hidden /> : null}
      {STATUS_LABEL[status] || norm}
    </span>
  );
}

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--hms-critical-soft)] px-2.5 py-1 text-xs font-medium text-[var(--hms-critical-foreground)] ring-1 ring-inset ring-[var(--hms-critical)]/25",
        className
      )}
    >
      Overdue
    </span>
  );
}

export function relativeTime(iso: string | Date | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "—";
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatDateTime(iso: string | Date | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
