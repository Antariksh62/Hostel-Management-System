import { Check, Clock, AlertCircle } from "lucide-react";
import { formatDateTime } from "@/components/hms/status";
import { cn } from "@/lib/utils";

interface StatusEvent {
  status: string;
  timestamp?: string | Date;
  note?: string;
}

export interface TimelineComplaint {
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  assignedTo?: { name?: string; email?: string } | null;
  assignedAt?: string | Date;
  resolvedAt?: string | Date;
  statusHistory?: StatusEvent[];
  timeline?: { status: string; at: string; note?: string }[];
}

const STAGES = [
  { key: "Pending", label: "Complaint submitted", hint: "Awaiting review" },
  { key: "Assigned", label: "Assigned to maintenance", hint: "Assigned to technician" },
  { key: "In Progress", label: "Work in progress", hint: "Technician on site" },
  { key: "Resolved", label: "Resolved", hint: "Issue fixed" },
];

export function ComplaintTimeline({
  complaint,
  variant = "student",
  className,
}: {
  complaint: TimelineComplaint;
  variant?: "student" | "staff";
  className?: string;
}) {
  if (!complaint) return null;

  // Build unified event map from statusHistory or synthesize
  const events: StatusEvent[] = [];

  if (complaint.statusHistory && complaint.statusHistory.length > 0) {
    events.push(...complaint.statusHistory);
  } else if (complaint.timeline && complaint.timeline.length > 0) {
    events.push(
      ...complaint.timeline.map((t) => ({
        status: t.status === "submitted" ? "Pending" : t.status === "in_progress" ? "In Progress" : t.status === "assigned" ? "Assigned" : "Resolved",
        timestamp: t.at,
        note: t.note,
      }))
    );
  } else {
    // Synthesize from fields
    if (complaint.createdAt) {
      events.push({ status: "Pending", timestamp: complaint.createdAt, note: "Complaint raised" });
    }
    if (complaint.assignedTo || complaint.assignedAt) {
      events.push({
        status: "Assigned",
        timestamp: complaint.assignedAt || complaint.updatedAt,
        note: complaint.assignedTo ? `Assigned to ${complaint.assignedTo.name || "staff"}` : undefined,
      });
    }
    if (complaint.status === "In Progress" || complaint.status === "in_progress") {
      events.push({ status: "In Progress", timestamp: complaint.updatedAt, note: "Work started" });
    }
    if (complaint.status === "Resolved" || complaint.status === "resolved" || complaint.resolvedAt) {
      events.push({ status: "Resolved", timestamp: complaint.resolvedAt || complaint.updatedAt, note: "Work completed" });
    }
  }

  // Determine stage states
  const normStatus = complaint.status.toLowerCase();
  const isResolved = normStatus === "resolved";
  const isReopened = normStatus === "reopened";
  const isInProgress = normStatus === "in progress" || normStatus === "in_progress";
  const isAssigned = Boolean(complaint.assignedTo || complaint.assignedAt || events.some((e) => e.status.toLowerCase() === "assigned"));

  return (
    <div className={cn("relative pl-2", className)}>
      <ol className="relative space-y-4 border-l border-border pl-6">
        {STAGES.map((stage, i) => {
          let isDone = false;
          let isCurrent = false;
          let eventTimestamp: string | Date | undefined;
          let eventNote: string | undefined;

          const match = events.find((e) => e.status.toLowerCase() === stage.key.toLowerCase());
          if (match) {
            eventTimestamp = match.timestamp;
            eventNote = match.note;
          }

          if (stage.key === "Pending") {
            isDone = true;
            if (normStatus === "pending" && !isAssigned) isCurrent = true;
            if (!eventTimestamp) eventTimestamp = complaint.createdAt;
          } else if (stage.key === "Assigned") {
            isDone = isAssigned || isInProgress || isResolved;
            isCurrent = isAssigned && !isInProgress && !isResolved;
            if (!eventTimestamp) eventTimestamp = complaint.assignedAt;
            if (!eventNote && complaint.assignedTo?.name) {
              eventNote = `Assigned to ${complaint.assignedTo.name}`;
            }
          } else if (stage.key === "In Progress") {
            isDone = isInProgress || isResolved;
            isCurrent = isInProgress && !isResolved;
          } else if (stage.key === "Resolved") {
            isDone = isResolved;
            isCurrent = isResolved;
            if (!eventTimestamp) eventTimestamp = complaint.resolvedAt;
          }

          return (
            <li key={stage.key} className="relative">
              {/* Circle Marker */}
              <span
                className={cn(
                  "absolute -left-[31px] top-0.5 flex size-5 items-center justify-center rounded-full border text-[10px]",
                  isDone
                    ? "border-[var(--hms-success)] bg-[var(--hms-success)] text-white"
                    : isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                )}
              >
                {isDone ? <Check className="size-3 stroke-[3]" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("text-sm font-medium", isDone || isCurrent ? "text-foreground" : "text-muted-foreground")}>
                    {stage.label}
                  </p>
                  {eventTimestamp && (
                    <time className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(eventTimestamp)}
                    </time>
                  )}
                </div>

                {eventNote && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{eventNote}</p>
                )}
              </div>
            </li>
          );
        })}

        {isReopened && (
          <li className="relative">
            <span className="absolute -left-[31px] top-0.5 flex size-5 items-center justify-center rounded-full border border-amber-600 bg-amber-600 text-white text-[10px]">
              <AlertCircle className="size-3 stroke-[2.5]" />
            </span>
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Complaint Reopened
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Student reported the issue was not resolved.
              </p>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
