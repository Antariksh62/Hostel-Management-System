import { ArrowUpRight, MapPin, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { OverdueBadge, StatusBadge, relativeTime } from "@/components/hms/status";
import { cn } from "@/lib/utils";

export interface ComplaintCardData {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  category: string;
  status: string;
  doorNumber?: string;
  room?: string;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  overdue?: boolean;
  media?: any[];
  attachments?: any[];
}

export function ComplaintCard({
  complaint,
  meta,
  footer,
  onClick,
  className,
}: {
  complaint: ComplaintCardData;
  meta?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const room = complaint.doorNumber || complaint.room || "—";
  const updatedTime = complaint.updatedAt || complaint.createdAt;
  const attachmentCount = (complaint.attachments?.length || 0) + (complaint.media?.length || 0);

  const isResolved = complaint.status === "Resolved" || complaint.status === "resolved";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium leading-5">{complaint.title}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              Room {room}
            </span>
            <span aria-hidden>·</span>
            <span>{complaint.category}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(updatedTime)}</span>
            {attachmentCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" aria-hidden />
                  {attachmentCount} attachment{attachmentCount > 1 ? "s" : ""}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{complaint.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={complaint.status} withIcon />
          {complaint.overdue && !isResolved ? <OverdueBadge /> : null}
        </div>
      </div>
      {meta ? <div className="mt-3 text-xs text-muted-foreground">{meta}</div> : null}
      {footer ? <div className="mt-4 border-t border-border pt-3">{footer}</div> : null}
      {onClick ? (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View details <ArrowUpRight className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </>
  );

  const base = cn(
    "rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-colors sm:p-5",
    onClick && "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer",
    className
  );

  if (onClick) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick()} className={cn(base, "w-full")}>
        {body}
      </div>
    );
  }
  return <div className={base}>{body}</div>;
}
