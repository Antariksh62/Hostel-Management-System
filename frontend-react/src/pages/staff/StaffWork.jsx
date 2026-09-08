import React, { useContext, useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { ComplaintHeader, ComplaintMeta, DetailSection } from "@/components/hms/complaint-detail";
import { ComplaintTimeline } from "@/components/hms/complaint-timeline";
import { MediaGallery } from "@/components/hms/media-gallery";
import { formatDateTime } from "@/components/hms/status";
import { StatCard } from "@/components/hms/stat-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

export default function StaffWork() {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [detailComplaint, setDetailComplaint] = useState(null);
  const [resolvingComplaint, setResolvingComplaint] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolvingBusy, setResolvingBusy] = useState(false);

  const fetchAssignedComplaints = useCallback(async () => {
    try {
      const res = await api.get("/complaints/all");
      const myId = user?.id || user?._id;
      const assigned = (res.data || []).filter((c) => {
        if (!c.assignedTo) return false;
        const assignedId = c.assignedTo._id || c.assignedTo;
        return String(assignedId) === String(myId);
      });
      setComplaints(assigned);
    } catch (err) {
      console.error("Failed to load staff complaints:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssignedComplaints();
  }, [fetchAssignedComplaints]);

  // Real-time socket updates (ONLY tasks assigned to this staff member)
  useEffect(() => {
    if (!socket) return;
    const myId = String(user?.id || user?._id || "");

    const handleAssigned = (payload) => {
      const complaint = payload?.complaint || payload;
      if (!complaint || !complaint.assignedTo) return;
      const assignedId = String(complaint.assignedTo._id || complaint.assignedTo || "");
      if (assignedId === myId) {
        setComplaints((prev) => {
          const exists = prev.some((c) => String(c._id || c.id) === String(complaint._id || complaint.id));
          if (exists) {
            return prev.map((c) => (String(c._id || c.id) === String(complaint._id || complaint.id) ? complaint : c));
          }
          return [complaint, ...prev];
        });
        toast.info(`New task assigned: ${complaint.title}`);
      }
    };

    const handleStatusUpdated = (payload) => {
      const targetId = String(payload?.complaintId || payload?.complaint?._id || payload?.complaint?.id || "");
      const updatedComplaint = payload?.complaint;

      setComplaints((prev) =>
        prev.map((c) => {
          const currentId = String(c._id || c.id || "");
          if (currentId === targetId) {
            return updatedComplaint ? { ...c, ...updatedComplaint } : { ...c, status: payload.status || c.status };
          }
          return c;
        })
      );

      setDetailComplaint((prev) => {
        if (prev && String(prev._id || prev.id) === targetId) {
          return updatedComplaint ? { ...prev, ...updatedComplaint } : { ...prev, status: payload.status || prev.status };
        }
        return prev;
      });
    };

    const handleDeleted = (payload) => {
      const targetId = String(payload?.complaintId || "");
      setComplaints((prev) => prev.filter((c) => String(c._id || c.id) !== targetId));
      setDetailComplaint((prev) => (prev && String(prev._id || prev.id) === targetId ? null : prev));
    };

    socket.on("complaint:assigned", handleAssigned);
    socket.on("complaint:status-updated", handleStatusUpdated);
    socket.on("complaint:deleted", handleDeleted);

    return () => {
      socket.off("complaint:assigned", handleAssigned);
      socket.off("complaint:status-updated", handleStatusUpdated);
      socket.off("complaint:deleted", handleDeleted);
    };
  }, [socket, user]);

  // Update status (e.g. Start Work)
  async function handleUpdateStatus(id, newStatus) {
    try {
      await api.put(`/complaints/${id}/status`, { status: newStatus });
      toast.success(`Task marked as ${newStatus}`);
      fetchAssignedComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status.");
    }
  }

  // Resolve with resolution note
  async function handleResolveSubmit(e) {
    e.preventDefault();
    if (!resolvingComplaint) return;

    setResolvingBusy(true);
    try {
      await api.put(`/complaints/${resolvingComplaint._id}/status`, {
        status: "Resolved",
        resolutionNote: resolutionNote.trim() || undefined,
      });

      toast.success("Task resolved successfully!");
      setResolvingComplaint(null);
      setResolutionNote("");
      fetchAssignedComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resolve complaint.");
    } finally {
      setResolvingBusy(false);
    }
  }

  const active = complaints.filter((c) => c.status !== "Resolved" && c.status !== "resolved");
  const inProgress = active.filter((c) => c.status === "In Progress" || c.status === "in_progress");
  const overdue = active.filter((c) => c.overdue);

  return (
    <>
      <PageHeader
        title="My work"
        description="Your assigned maintenance tasks, sorted by priority."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Open jobs"
          value={active.length}
          tone={active.length > 0 ? "warning" : "neutral"}
          hint="Assigned to you"
        />
        <StatCard
          label="In progress"
          value={inProgress.length}
          tone="info"
          hint="Currently active"
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "critical" : "neutral"}
          hint="Needs immediate action"
          icon={AlertTriangle}
        />
      </div>

      <div className="mt-9 mb-3">
        <h2 className="text-base font-semibold">Assigned tasks</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Jobs that require attention.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All clear"
          description="You have no open maintenance tasks assigned to you right now."
        />
      ) : (
        <div className="space-y-3">
          {active.map((c) => {
            const studentObj = typeof c.studentId === "object" ? c.studentId : null;
            const studentName = studentObj?.fullName || studentObj?.name || c.studentName || "Student";
            const prn = studentObj?.prn || studentObj?.rollNumber || c.prn || c.rollNumber || "—";
            const isInProg = c.status === "In Progress" || c.status === "in_progress";

            return (
              <ComplaintCard
                key={c._id || c.id}
                complaint={c}
                meta={
                  <span>
                    Reported by <strong className="font-semibold text-foreground">{studentName}</strong> (PRN: <span className="font-mono">{prn}</span>)
                  </span>
                }
                footer={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-10 text-xs"
                      onClick={() => setDetailComplaint(c)}
                    >
                      View details
                    </Button>

                    {!isInProg && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 text-xs"
                        onClick={() => handleUpdateStatus(c._id, "In Progress")}
                      >
                        Start work
                      </Button>
                    )}

                    <Button
                      size="sm"
                      className="min-h-10 text-xs"
                      onClick={() => {
                        setResolvingComplaint(c);
                        setResolutionNote("");
                      }}
                    >
                      Mark resolved
                    </Button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Task Details Dialog */}
      <Dialog open={Boolean(detailComplaint)} onOpenChange={(open) => !open && setDetailComplaint(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {detailComplaint && (
            <div className="space-y-6">
              <DialogHeader>
                <ComplaintHeader complaint={detailComplaint} />
              </DialogHeader>

              <ComplaintMeta
                items={[
                  { label: "Room", value: `Room ${detailComplaint.doorNumber || detailComplaint.room || detailComplaint.studentId?.doorNumber || "—"}` },
                  { label: "Category", value: detailComplaint.category },
                  { label: "Reported", value: formatDateTime(detailComplaint.createdAt) },
                  {
                    label: "Student Name",
                    value: detailComplaint.studentId?.fullName || detailComplaint.studentId?.name || "Resident",
                  },
                  {
                    label: "Student PRN",
                    value: (
                      <span className="font-mono font-medium">
                        {detailComplaint.studentId?.prn || detailComplaint.studentId?.rollNumber || "—"}
                      </span>
                    ),
                  },
                  {
                    label: "Student Email",
                    value: detailComplaint.studentId?.email || "—",
                  },
                ]}
              />

              <DetailSection title="Description">
                <p className="text-sm leading-relaxed text-foreground">{detailComplaint.description}</p>
              </DetailSection>

              {(detailComplaint.media?.length > 0 || detailComplaint.attachments?.length > 0 || detailComplaint.image) && (
                <DetailSection title="Evidence Photos / Video">
                  <MediaGallery
                    media={detailComplaint.media}
                    image={detailComplaint.image}
                    attachments={detailComplaint.attachments}
                  />
                </DetailSection>
              )}

              <DetailSection title="Timeline">
                <ComplaintTimeline complaint={detailComplaint} variant="staff" />
              </DetailSection>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDetailComplaint(null)}>
                  Close
                </Button>
                {detailComplaint.status !== "In Progress" && detailComplaint.status !== "in_progress" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleUpdateStatus(detailComplaint._id, "In Progress");
                      setDetailComplaint(null);
                    }}
                  >
                    Start work
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const target = detailComplaint;
                    setDetailComplaint(null);
                    setResolvingComplaint(target);
                    setResolutionNote("");
                  }}
                >
                  Mark resolved
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={Boolean(resolvingComplaint)} onOpenChange={(open) => !open && setResolvingComplaint(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete maintenance</DialogTitle>
            <DialogDescription>
              Record how you fixed this issue in room{" "}
              {resolvingComplaint?.doorNumber || resolvingComplaint?.room || "—"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResolveSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-note">Resolution Note</Label>
              <Textarea
                id="res-note"
                rows={3}
                required
                maxLength={400}
                placeholder="e.g. Replaced faulty washer, tested water pressure, leak resolved."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setResolvingComplaint(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resolvingBusy}>
                {resolvingBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Confirm resolved
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
