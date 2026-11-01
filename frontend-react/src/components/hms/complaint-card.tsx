import { ArrowUpRight, MapPin, Paperclip, User } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OverdueBadge, StatusBadge, relativeTime } from "@/components/hms/status";
import { ComplaintTimeline } from "@/components/hms/complaint-timeline";
import { translateComplaintText } from "@/utils/complaintTranslator";
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
  studentId?: any;
  studentName?: string;
  studentPRN?: string;
  prn?: string;
  rollNumber?: string;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  assignedTo?: any;
  assignedAt?: string | Date;
  resolvedAt?: string | Date;
  statusHistory?: any[];
  timeline?: any[];
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
  showTimeline = true,
}: {
  complaint: ComplaintCardData;
  meta?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
  showTimeline?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const student = typeof complaint.studentId === "object" && complaint.studentId !== null ? complaint.studentId : null;
  const studentName = complaint.studentName || student?.fullName || student?.name;
  const studentPRN = complaint.studentPRN || complaint.prn || complaint.rollNumber || student?.prn || student?.rollNumber;
  const room = complaint.doorNumber || complaint.room || student?.doorNumber || "—";
  const updatedTime = complaint.updatedAt || complaint.createdAt;
  const attachmentCount = (complaint.attachments?.length || 0) + (complaint.media?.length || 0);

  const isResolved = complaint.status === "Resolved" || complaint.status === "resolved";
  const localizedCategory = t(`categories.${complaint.category}`, complaint.category);
  const localizedTitle = translateComplaintText(complaint.title, currentLang);
  const localizedDescription = translateComplaintText(complaint.description, currentLang);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-5">{localizedTitle}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <MapPin className="size-3 text-muted-foreground" aria-hidden />
              {t("common.room", "Room")} {room}
            </span>
            {studentName || studentPRN ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <User className="size-3 text-muted-foreground" aria-hidden />
                  <span className="font-medium text-foreground">{studentName || t("auth.student_tab", "Student")}</span>
                  {studentPRN ? (
                    <span className="rounded bg-muted/80 px-1 py-0.5 text-[10.5px] font-mono font-medium text-muted-foreground">
                      PRN: {studentPRN}
                    </span>
                  ) : null}
                </span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>{localizedCategory}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(updatedTime)}</span>
            {attachmentCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" aria-hidden />
                  {attachmentCount}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{localizedDescription}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={complaint.status} withIcon />
          {complaint.overdue && !isResolved ? <OverdueBadge /> : null}
        </div>
      </div>

      {/* Live Timeline below the complaint */}
      {showTimeline && (
        <div className="mt-3.5 border-t border-border/70 pt-3">
          <ComplaintTimeline complaint={complaint} compact />
        </div>
      )}

      {meta ? <div className="mt-3 text-xs text-muted-foreground">{meta}</div> : null}
      {footer ? <div className="mt-3.5 border-t border-border pt-3">{footer}</div> : null}
      {onClick ? (
        <div className="mt-3 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {t("common.view", "View details")} <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </div>
      ) : null}
    </>
  );

  const containerClasses = cn(
    "relative rounded-xl border border-border bg-card p-4 transition-all duration-150 shadow-xs",
    onClick && "cursor-pointer hover:border-border/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
    className
  );

  return onClick ? (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={containerClasses}
    >
      {body}
    </div>
  ) : (
    <div className={containerClasses}>{body}</div>
  );
}
