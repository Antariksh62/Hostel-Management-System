import React, { useState, useEffect } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

const FILTERS = [
  { value: "all", label: "All complaints" },
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Reopened", label: "Reopened" },
];

export default function WardenComplaints() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Query all complaints
  const { data: complaints = [], isLoading: cLoading } = useQuery({
    queryKey: ["warden-complaints"],
    queryFn: () => api.get("/complaints/all").then((r) => r.data || []),
  });

  // Query staff members for assignment
  const { data: staffList = [] } = useQuery({
    queryKey: ["warden-staff-list"],
    queryFn: () => api.get("/users/staff").then((r) => r.data || []),
  });

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;

    const handleCreated = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    const handleUpdated = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    const handleAssigned = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    const handleDeleted = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });

    socket.on("complaint:created", handleCreated);
    socket.on("complaint:status-updated", handleUpdated);
    socket.on("complaint:assigned", handleAssigned);
    socket.on("complaint:deleted", handleDeleted);

    return () => {
      socket.off("complaint:created", handleCreated);
      socket.off("complaint:status-updated", handleUpdated);
      socket.off("complaint:assigned", handleAssigned);
      socket.off("complaint:deleted", handleDeleted);
    };
  }, [socket, queryClient]);

  // Assign staff handler
  async function handleAssign(complaintId, staffId) {
    try {
      await api.patch(`/complaints/${complaintId}/assign`, { staffId });
      const assignedPerson = staffList.find((s) => (s._id || s.id) === staffId);
      toast.success(`Assigned to ${assignedPerson?.name || "staff"}`);
      queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign staff.");
    }
  }

  // Delete complaint handler
  async function handleDelete(complaintId) {
    try {
      await api.delete(`/complaints/${complaintId}`);
      toast.success("Complaint removed.");
      setDeleteConfirm(null);
      if (selected && (selected._id === complaintId || selected.id === complaintId)) {
        setSelected(null);
      }
      queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete complaint.");
    }
  }

  const filtered = complaints.filter((c) => {
    if (filter === "all") return true;
    const s = (c.status || "").toLowerCase();
    const f = filter.toLowerCase();
    if (f === "in progress") return s === "in progress" || s === "in_progress" || s === "assigned";
    if (f === "pending") return s === "pending" || s === "submitted";
    return s === f;
  });

  return (
    <>
      <PageHeader
        title="Complaints Management"
        description={`${filtered.length} of ${complaints.length} complaints shown`}
        action={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-11 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {cLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No complaints matching filter"
          description="Try changing the status filter above."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const studentName = c.studentId?.name || c.studentId?.fullName || "Student";
            const assignedName = c.assignedTo?.name || "Unassigned";
            const isResolved = c.status === "Resolved" || c.status === "resolved";

            return (
              <ComplaintCard
                key={c._id || c.id}
                complaint={c}
                meta={
                  <span>
                    {studentName} · <strong className="text-foreground">{assignedName}</strong>
                  </span>
                }
                footer={
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-10 text-xs"
                        onClick={() => setSelected(c)}
                      >
                        View details
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-10 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirm(c)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {!isResolved && (
                      <div className="w-full sm:w-64">
                        <Select
                          value={c.assignedTo?._id || c.assignedTo || ""}
                          onValueChange={(staffId) => handleAssign(c._id, staffId)}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Assign maintenance staff" />
                          </SelectTrigger>
                          <SelectContent>
                            {staffList.map((s) => (
                              <SelectItem key={s._id || s.id} value={s._id || s.id}>
                                {s.name} ({s.email?.split("@")[0] || "Staff"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {selected && (
            <div className="space-y-6">
              <DialogHeader>
                <ComplaintHeader complaint={selected} />
              </DialogHeader>

              <ComplaintMeta
                items={[
                  { label: "Room", value: `Room ${selected.doorNumber || selected.room || "—"}` },
                  { label: "Category", value: selected.category },
                  { label: "Reported", value: formatDateTime(selected.createdAt) },
                  {
                    label: "Student",
                    value: selected.studentId?.name || selected.studentId?.fullName || "Resident",
                  },
                  { label: "Assigned Staff", value: selected.assignedTo?.name || "Unassigned" },
                  {
                    label: "Student Email",
                    value: selected.studentId?.email || "—",
                  },
                ]}
              />

              <DetailSection title="Description">
                <p className="text-sm leading-relaxed text-foreground">{selected.description}</p>
              </DetailSection>

              {(selected.media?.length > 0 || selected.attachments?.length > 0 || selected.image) && (
                <DetailSection title="Evidence Photos / Video">
                  <MediaGallery
                    media={selected.media}
                    image={selected.image}
                    attachments={selected.attachments}
                  />
                </DetailSection>
              )}

              <DetailSection title="Timeline & Status Lifecycle">
                <ComplaintTimeline complaint={selected} variant="staff" />
              </DetailSection>

              <ResolutionSummary complaint={selected} />

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirm)} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete complaint?</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this complaint? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm._id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
