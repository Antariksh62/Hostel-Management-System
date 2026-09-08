import React, { useState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

const STATUS_FILTERS = [
  { value: "all", label: "All status" },
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Reopened", label: "Reopened" },
];

const TIME_FILTERS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Specific month..." },
];

export default function WardenComplaints() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [customMonth, setCustomMonth] = useState("");
  const [selected, setSelected] = useState(null);

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

  const filtered = complaints.filter((c) => {
    // 1. Status Filter
    if (statusFilter !== "all") {
      const s = (c.status || "").toLowerCase();
      const f = statusFilter.toLowerCase();
      if (f === "in progress") {
        if (s !== "in progress" && s !== "in_progress" && s !== "assigned") return false;
      } else if (f === "pending") {
        if (s !== "pending" && s !== "submitted") return false;
      } else if (s !== f) {
        return false;
      }
    }

    // 2. Time / Date Filter
    if (timeFilter !== "all") {
      const dateStr = c.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();

      if (timeFilter === "today") {
        const isToday =
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
        if (!isToday) return false;
      } else if (timeFilter === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday =
          d.getFullYear() === yesterday.getFullYear() &&
          d.getMonth() === yesterday.getMonth() &&
          d.getDate() === yesterday.getDate();
        if (!isYesterday) return false;
      } else if (timeFilter === "week") {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        if (d < sevenDaysAgo || d > now) return false;
      } else if (timeFilter === "this_month") {
        const isThisMonth =
          d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        if (!isThisMonth) return false;
      } else if (timeFilter === "last_month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const isLastMonth =
          d.getFullYear() === lastMonth.getFullYear() &&
          d.getMonth() === lastMonth.getMonth();
        if (!isLastMonth) return false;
      } else if (timeFilter === "custom" && customMonth) {
        const [year, month] = customMonth.split("-").map(Number);
        const isCustom = d.getFullYear() === year && d.getMonth() === month - 1;
        if (!isCustom) return false;
      }
    }

    return true;
  });

  return (
    <>
      <PageHeader
        title="Complaints Management"
        description={`${filtered.length} of ${complaints.length} complaints shown`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-10 w-36 sm:w-40 text-xs">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {timeFilter === "custom" && (
              <Input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="h-10 w-36 text-xs"
              />
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-36 sm:w-40 text-xs">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          description="Try changing the status or time filters above."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const studentObj = typeof c.studentId === "object" ? c.studentId : null;
            const studentName = studentObj?.fullName || studentObj?.name || "Student";
            const prn = studentObj?.prn || studentObj?.rollNumber || "—";
            const assignedName = c.assignedTo?.name || "Unassigned";
            const isResolved = c.status === "Resolved" || c.status === "resolved";

            return (
              <ComplaintCard
                key={c._id || c.id}
                complaint={c}
                meta={
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      Student: <strong className="font-semibold text-foreground">{studentName}</strong> (PRN: <span className="font-mono">{prn}</span>)
                    </span>
                    <span>
                      Assigned: <strong className="text-foreground">{assignedName}</strong>
                    </span>
                  </div>
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
                    </div>

                    {!isResolved && (
                      <div className="w-full sm:w-56">
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
                  { label: "Room", value: `Room ${selected.doorNumber || selected.room || selected.studentId?.doorNumber || "—"}` },
                  { label: "Category", value: selected.category },
                  { label: "Reported", value: formatDateTime(selected.createdAt) },
                  {
                    label: "Student Name",
                    value: selected.studentId?.fullName || selected.studentId?.name || "Resident",
                  },
                  {
                    label: "Student PRN",
                    value: (
                      <span className="font-mono font-medium">
                        {selected.studentId?.prn || selected.studentId?.rollNumber || "—"}
                      </span>
                    ),
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
    </>
  );
}
