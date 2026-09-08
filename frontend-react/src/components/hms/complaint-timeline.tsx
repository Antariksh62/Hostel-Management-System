import React from "react";
import { Check, AlertCircle, Wrench, CheckCircle2, UserCheck, FileText, MessageSquare, ArrowRightCircle } from "lucide-react";
import { formatDateTime, relativeTime } from "@/components/hms/status";
import { cn } from "@/lib/utils";

export interface StatusEvent {
  status: string;
  timestamp?: string | Date;
  note?: string;
  actor?: string;
}

export interface TimelineComplaint {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  assignedTo?: { name?: string; email?: string } | string | null;
  assignedAt?: string | Date;
  resolvedAt?: string | Date;
  resolutionNote?: string;
  feedback?: {
    isSatisfied?: boolean | null;
    text?: string;
    submittedAt?: string | Date | null;
  };
  statusHistory?: StatusEvent[];
  timeline?: { status: string; at: string; note?: string }[];
}

const STAGES = [
  { key: "Pending", label: "Submitted", icon: FileText, hint: "Awaiting review" },
  { key: "Assigned", label: "Assigned", icon: UserCheck, hint: "Staff assigned" },
  { key: "In Progress", label: "In Progress", icon: Wrench, hint: "Work ongoing" },
  { key: "Resolved", label: "Resolved", icon: CheckCircle2, hint: "Issue fixed" },
];

function getEventIcon(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("reopen")) return { icon: AlertCircle, color: "text-amber-600 bg-amber-500/10 border-amber-500/40" };
  if (s.includes("feedback")) return { icon: MessageSquare, color: "text-purple-600 bg-purple-500/10 border-purple-500/40" };
  if (s.includes("resolv")) return { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/40" };
  if (s.includes("progress")) return { icon: Wrench, color: "text-blue-600 bg-blue-500/10 border-blue-500/40" };
  if (s.includes("assign")) return { icon: UserCheck, color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/40" };
  return { icon: FileText, color: "text-primary bg-primary/10 border-primary/40" };
}

function getEventTitle(status: string, note?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "pending" || s === "submitted") return "Complaint submitted";
  if (s === "assigned") return "Assigned to staff";
  if (s === "in progress" || s === "in_progress") return "Work started";
  if (s === "resolved") return "Complaint resolved";
  if (s === "reopened") return "Complaint reopened";
  if (s === "feedback") return "Student feedback submitted";
  return status;
}

export function ComplaintTimeline({
  complaint,
  compact = false,
  className,
}: {
  complaint: TimelineComplaint;
  compact?: boolean;
  className?: string;
}) {
  if (!complaint) return null;

  // Extract or synthesize truthful activity events
  const rawEvents: StatusEvent[] = [];

  if (complaint.statusHistory && complaint.statusHistory.length > 0) {
    rawEvents.push(...complaint.statusHistory);
  } else if (complaint.timeline && complaint.timeline.length > 0) {
    rawEvents.push(
      ...complaint.timeline.map((t) => ({
        status: t.status === "submitted" ? "Pending" : t.status === "in_progress" ? "In Progress" : t.status === "assigned" ? "Assigned" : "Resolved",
        timestamp: t.at,
        note: t.note,
      }))
    );
  } else {
    // Synthesize strictly from persisted fields without inventing fake dates
    if (complaint.createdAt) {
      rawEvents.push({ status: "Pending", timestamp: complaint.createdAt, note: "Complaint raised by student" });
    }
    if (complaint.assignedTo || complaint.assignedAt) {
      const staffName = typeof complaint.assignedTo === "object" ? complaint.assignedTo?.name : undefined;
      rawEvents.push({
        status: "Assigned",
        timestamp: complaint.assignedAt || complaint.updatedAt,
        note: staffName ? `Assigned to ${staffName}` : "Assigned to maintenance technician",
      });
    }
    if (complaint.status === "In Progress" || complaint.status === "in_progress") {
      rawEvents.push({ status: "In Progress", timestamp: complaint.updatedAt, note: "Work started by maintenance staff" });
    }
    if (complaint.status === "Resolved" || complaint.status === "resolved" || complaint.resolvedAt) {
      rawEvents.push({
        status: "Resolved",
        timestamp: complaint.resolvedAt || complaint.updatedAt,
        note: complaint.resolutionNote || "Issue resolved and checked by staff",
      });
    }
    if (complaint.feedback?.submittedAt) {
      rawEvents.push({
        status: complaint.feedback.isSatisfied ? "Feedback" : "Reopened",
        timestamp: complaint.feedback.submittedAt,
        note: complaint.feedback.text || (complaint.feedback.isSatisfied ? "Student confirmed issue resolved" : "Student marked issue as not resolved"),
      });
    }
  }

  // Deduplicate events by status + timestamp to prevent double-rendering
  const seen = new Set<string>();
  const events: StatusEvent[] = [];
  for (const ev of rawEvents) {
    const key = `${ev.status}_${ev.timestamp ? new Date(ev.timestamp).getTime() : ''}_${ev.note || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      events.push(ev);
    }
  }

  // Status indicators
  const normStatus = (complaint.status || "pending").toLowerCase();
  const isResolved = normStatus === "resolved";
  const isReopened = normStatus === "reopened";
  const isInProgress = normStatus === "in progress" || normStatus === "in_progress";
  const isAssigned = Boolean(complaint.assignedTo || complaint.assignedAt || events.some((e) => e.status?.toLowerCase() === "assigned"));
  const assignedStaffName = typeof complaint.assignedTo === "object" ? complaint.assignedTo?.name : null;

  // ─── COMPACT INLINE TRACKER (Rendered below complaint cards) ────────────────
  if (compact) {
    return (
      <div className={cn("w-full space-y-2", className)}>
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span>Live Lifecycle</span>
          <span className="font-normal normal-case text-xs text-foreground/80">
            {isReopened
              ? "Reopened by student"
              : isResolved
              ? "Resolved"
              : isInProgress
              ? "In Progress"
              : isAssigned
              ? `Assigned${assignedStaffName ? ` to ${assignedStaffName}` : ""}`
              : "Awaiting review"}
          </span>
        </div>

        {/* 4-Step Stepper Bar */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {STAGES.map((stage) => {
            let isDone = false;
            let isCurrent = false;
            let timeStr = "";

            const match = events.find((e) => e.status?.toLowerCase() === stage.key.toLowerCase());
            if (match?.timestamp) timeStr = relativeTime(match.timestamp);

            if (stage.key === "Pending") {
              isDone = isAssigned || isInProgress || isResolved;
              isCurrent = normStatus === "pending" && !isAssigned;
              if (!timeStr && complaint.createdAt) timeStr = relativeTime(complaint.createdAt);
            } else if (stage.key === "Assigned") {
              isDone = isInProgress || isResolved;
              isCurrent = isAssigned && !isInProgress && !isResolved;
              if (!timeStr && complaint.assignedAt) timeStr = relativeTime(complaint.assignedAt);
            } else if (stage.key === "In Progress") {
              isDone = isResolved;
              isCurrent = isInProgress && !isResolved;
            } else if (stage.key === "Resolved") {
              isDone = isResolved;
              isCurrent = isResolved;
              if (!timeStr && complaint.resolvedAt) timeStr = relativeTime(complaint.resolvedAt);
            }

            const Icon = stage.icon;

            return (
              <div
                key={stage.key}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all",
                  isDone
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : isCurrent
                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
                    : "border-border/60 bg-muted/30 text-muted-foreground opacity-60"
                )}
              >
                <div className="flex items-center gap-1">
                  {isDone ? (
                    <Check className="size-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                  <span className="text-[11px] font-medium leading-none">{stage.label}</span>
                </div>
                {timeStr ? (
                  <span className="mt-1 block text-[10px] text-muted-foreground truncate max-w-full">
                    {timeStr}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Reopened Banner if applicable */}
        {isReopened && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Complaint was reopened by the student for re-inspection.</span>
          </div>
        )}
      </div>
    );
  }

  // ─── FULL CANONICAL ACTIVITY TIMELINE (Detail dialogs & drawers) ───────────
  return (
    <div className={cn("relative py-1", className)}>
      <ol className="relative space-y-6 border-l-2 border-border/80 ml-3 pl-6">
        {events.map((ev, index) => {
          const { icon: Icon, color } = getEventIcon(ev.status);
          const title = getEventTitle(ev.status, ev.note);
          const isLatest = index === events.length - 1;

          return (
            <li key={`${ev.status}_${index}`} className="relative group">
              {/* Circle Marker */}
              <span
                className={cn(
                  "absolute -left-[35px] top-0 flex size-6 items-center justify-center rounded-full border bg-card shadow-xs transition-transform",
                  color,
                  isLatest && "ring-2 ring-primary/30 scale-105"
                )}
              >
                <Icon className="size-3.5 stroke-[2.5]" />
              </span>

              {/* Event Content */}
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold tracking-tight text-foreground">
                    {title}
                  </p>
                  {ev.timestamp && (
                    <time className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(ev.timestamp)}
                    </time>
                  )}
                </div>

                {ev.note && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {ev.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ComplaintTimeline;
