import { CheckCircle2, CircleDot, Clock, RefreshCw, UserRoundCheck, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const norm = normalizeStatus(status);
  const Icon =
    norm === "Pending"
      ? Clock
      : norm === "In Progress"
        ? Wrench
        : norm === "Resolved"
          ? CheckCircle2
          : RefreshCw;

  const translatedLabel = t(`status.${norm}`, STATUS_LABEL[status] || norm);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status] || STATUS_STYLE[norm],
        className
      )}
    >
      {withIcon ? <Icon className="mr-1 size-3 shrink-0" aria-hidden /> : null}
      {translatedLabel}
    </span>
  );
}

export function OverdueBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--hms-critical-soft)] px-2.5 py-1 text-xs font-medium text-[var(--hms-critical-foreground)] ring-1 ring-inset ring-[var(--hms-critical)]/25",
        className
      )}
    >
      {t("dashboard.needs_attention", "Overdue")}
    </span>
  );
}

import i18n from "@/i18n";

export function relativeTime(iso: string | Date | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "—";
  const mins = Math.round(diff / 60000);
  if (mins < 1) return i18n.t("common.just_now", "just now");
  if (mins < 60) return i18n.t("common.minutes_ago", { count: mins, defaultValue: `${mins} min ago` });
  const hours = Math.round(mins / 60);
  if (hours < 24) return i18n.t("common.hours_ago", { count: hours, defaultValue: `${hours} hr ago` });
  const days = Math.round(hours / 24);
  if (days === 1) return i18n.t("common.yesterday", "yesterday");
  return i18n.t("common.days_ago", { count: days, defaultValue: `${days} days ago` });
}

export function formatDateTime(iso: string | Date | undefined, locale = "en-IN") {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
