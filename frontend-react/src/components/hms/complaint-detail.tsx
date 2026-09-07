import type { ReactNode } from "react";
import { OverdueBadge, StatusBadge, formatDateTime } from "@/components/hms/status";
import { cn } from "@/lib/utils";

/** Title block shared by every role's complaint detail view. */
export function ComplaintHeader({
  complaint,
  heading,
}: {
  complaint: {
    _id?: string;
    id?: string;
    title: string;
    status: string;
    overdue?: boolean;
  };
  heading?: ReactNode;
}) {
  const displayId = complaint.id || (complaint._id ? `CMP-${complaint._id.slice(-6).toUpperCase()}` : "");

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={complaint.status} withIcon />
        {complaint.overdue && complaint.status !== "Resolved" && complaint.status !== "resolved" ? (
          <OverdueBadge />
        ) : null}
        {displayId && <span className="text-xs text-muted-foreground tabular-nums">{displayId}</span>}
      </div>
      {heading ?? <h2 className="text-lg leading-6 font-semibold tracking-tight text-balance">{complaint.title}</h2>}
    </div>
  );
}

/** Compact label/value grid — metadata, not cards. */
export function ComplaintMeta({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </dt>
          <dd className="mt-0.5 truncate text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Quiet section wrapper: a rule and a small heading instead of nested cards. */
export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border pt-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ResolutionSummary({
  complaint,
}: {
  complaint: {
    status: string;
    resolvedAt?: string | Date;
    resolutionNote?: string;
    statusHistory?: { status: string; timestamp?: string | Date; note?: string }[];
  };
}) {
  if (!complaint || (complaint.status !== "Resolved" && complaint.status !== "resolved")) return null;

  const resolvedEvent = complaint.statusHistory
    ?.slice()
    .reverse()
    .find((h) => h.status === "Resolved" || h.status === "resolved");

  const resolvedAt = complaint.resolvedAt || resolvedEvent?.timestamp;
  const note = complaint.resolutionNote || resolvedEvent?.note;

  return (
    <DetailSection title="Resolution">
      <p className="text-sm">
        {note || "Marked resolved. No resolution note was recorded."}
      </p>
      {resolvedAt ? (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          Resolved {formatDateTime(resolvedAt)}
        </p>
      ) : null}
    </DetailSection>
  );
}
