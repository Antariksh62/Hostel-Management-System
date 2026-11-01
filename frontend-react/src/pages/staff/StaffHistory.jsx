import React, { useContext, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { History, Loader2 } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { ComplaintHeader, ComplaintMeta, DetailSection, ResolutionSummary } from "@/components/hms/complaint-detail";
import { ComplaintTimeline } from "@/components/hms/complaint-timeline";
import { MediaGallery } from "@/components/hms/media-gallery";
import { formatDateTime } from "@/components/hms/status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { translateComplaintText } from "@/utils/complaintTranslator";
import api from "@/services/api";

export default function StaffHistory() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailComplaint, setDetailComplaint] = useState(null);

  const fetchDone = useCallback(async () => {
    try {
      const res = await api.get("/complaints/all");
      const myId = String(user?.id || user?._id || "");
      const resolved = (res.data || []).filter((c) => {
        if (!c.assignedTo) return false;
        const assignedId = String(c.assignedTo._id || c.assignedTo || "");
        const isMine = assignedId === myId;
        const isDone = c.status === "Resolved" || c.status === "resolved";
        return isMine && isDone;
      });
      setComplaints(resolved);
    } catch (err) {
      console.error("Failed to load completed jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDone();
  }, [fetchDone]);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    const myId = String(user?.id || user?._id || "");

    const handleUpdated = (payload) => {
      const updatedComplaint = payload?.complaint;
      const status = payload?.status || updatedComplaint?.status;
      const targetId = String(payload?.complaintId || updatedComplaint?._id || updatedComplaint?.id || "");
      const isResolved = status === "Resolved" || status === "resolved";

      const assignedId = String(updatedComplaint?.assignedTo?._id || updatedComplaint?.assignedTo || "");
      const isMine = assignedId === myId;

      if (isResolved && isMine) {
        setComplaints((prev) => {
          const exists = prev.some((c) => String(c._id || c.id) === targetId);
          if (exists) {
            return prev.map((c) => (String(c._id || c.id) === targetId ? (updatedComplaint || { ...c, status }) : c));
          }
          return updatedComplaint ? [updatedComplaint, ...prev] : prev;
        });

        setDetailComplaint((prev) => {
          if (prev && String(prev._id || prev.id) === targetId) {
            return updatedComplaint || { ...prev, status };
          }
          return prev;
        });
      } else {
        // If no longer resolved or reassigned, remove from history
        setComplaints((prev) => prev.filter((c) => String(c._id || c.id) !== targetId));
        setDetailComplaint((prev) => (prev && String(prev._id || prev.id) === targetId ? null : prev));
      }
    };

    socket.on("complaint:status-updated", handleUpdated);
    socket.on("complaint:assigned", handleUpdated);
    socket.on("complaint:deleted", (payload) => {
      const targetId = String(payload?.complaintId || "");
      setComplaints((prev) => prev.filter((c) => String(c._id || c.id) !== targetId));
      setDetailComplaint((prev) => (prev && String(prev._id || prev.id) === targetId ? null : prev));
    });

    return () => {
      socket.off("complaint:status-updated", handleUpdated);
      socket.off("complaint:assigned", handleUpdated);
      socket.off("complaint:deleted");
    };
  }, [socket, user]);

  return (
    <>
      <PageHeader
        title={t("staff.work_history", "Work History")}
        description={t("staff.completed_jobs", { count: complaints.length, defaultValue: `${complaints.length} completed jobs.` })}
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("staff.nothing_completed_yet", "Nothing completed yet")}
          description={t("staff.resolved_jobs_hint", "Resolved maintenance jobs with notes will be listed here.")}
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const studentObj = typeof c.studentId === "object" ? c.studentId : null;
            const studentName = studentObj?.fullName || studentObj?.name || c.studentName || t("auth.student_tab", "Student");
            const prn = studentObj?.prn || studentObj?.rollNumber || c.prn || c.rollNumber || "—";

            return (
              <ComplaintCard
                key={c._id || c.id}
                complaint={c}
                onClick={() => setDetailComplaint(c)}
                meta={
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      {t("complaints.reported_by", "Reported by")} <strong className="font-semibold text-foreground">{studentName}</strong> (PRN: <span className="font-mono">{prn}</span>)
                    </span>
                    {c.resolutionNote ? (
                      <span className="text-foreground/80">
                        <strong>{t("staff.note", "Note")}:</strong> {c.resolutionNote}
                      </span>
                    ) : null}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={Boolean(detailComplaint)} onOpenChange={(open) => !open && setDetailComplaint(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {detailComplaint && (
            <div className="space-y-6">
              <DialogHeader>
                <ComplaintHeader complaint={detailComplaint} />
              </DialogHeader>

              <ComplaintMeta
                items={[
                  {
                    label: t("common.room", "Room"),
                    value: `${t("common.room", "Room")} ${detailComplaint.doorNumber || detailComplaint.room || detailComplaint.studentId?.doorNumber || "—"}`,
                  },
                  { label: t("complaints.category", "Category"), value: t(`categories.${detailComplaint.category}`, detailComplaint.category) },
                  { label: t("complaints.reported_on", "Reported"), value: formatDateTime(detailComplaint.createdAt) },
                  {
                    label: t("auth.student_tab", "Student"),
                    value: detailComplaint.studentId?.fullName || detailComplaint.studentId?.name || t("auth.student_tab", "Student"),
                  },
                  {
                    label: "PRN",
                    value: (
                      <span className="font-mono font-medium">
                        {detailComplaint.studentId?.prn || detailComplaint.studentId?.rollNumber || "—"}
                      </span>
                    ),
                  },
                  {
                    label: t("staff.email_address", "Email"),
                    value: detailComplaint.studentId?.email || "—",
                  },
                ]}
              />

              <DetailSection title={t("complaints.description", "Description")}>
                <p className="text-sm leading-relaxed text-foreground">
                  {translateComplaintText(detailComplaint.description, currentLang)}
                </p>
              </DetailSection>

              {(detailComplaint.media?.length > 0 || detailComplaint.attachments?.length > 0 || detailComplaint.image) && (
                <DetailSection title={t("complaints.upload_media", "Evidence Photos / Video")}>
                  <MediaGallery
                    media={detailComplaint.media}
                    image={detailComplaint.image}
                    attachments={detailComplaint.attachments}
                  />
                </DetailSection>
              )}

              <DetailSection title={t("dashboard.live_lifecycle", "Timeline")}>
                <ComplaintTimeline complaint={detailComplaint} />
              </DetailSection>

              <ResolutionSummary complaint={detailComplaint} />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDetailComplaint(null)}>
                  {t("common.close", "Close")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
