import React, { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, CheckCircle2, Loader2, Wrench, Building2,
  Users, UserCheck, Clock, ShieldCheck, ChevronRight, Inbox, RefreshCw
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { ComplaintHeader, ComplaintMeta, DetailSection } from "@/components/hms/complaint-detail";
import { ComplaintTimeline } from "@/components/hms/complaint-timeline";
import { MediaGallery } from "@/components/hms/media-gallery";
import { formatDateTime } from "@/components/hms/status";
import { StatCard } from "@/components/hms/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { translateComplaintText } from "@/utils/complaintTranslator";
import api from "@/services/api";

export default function StaffWork() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("my_jobs");
  const [detailComplaint, setDetailComplaint] = useState(null);
  const [resolvingComplaint, setResolvingComplaint] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolvingBusy, setResolvingBusy] = useState(false);

  // Supervisor assignment state
  const [assigningComplaint, setAssigningComplaint] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assigningBusy, setAssigningBusy] = useState(false);

  // 1. Department Info Query
  const { data: deptInfo } = useQuery({
    queryKey: ["staff-department-info"],
    queryFn: () => api.get("/staff/department-info").then((r) => r.data).catch(() => null),
  });

  const department = deptInfo?.department || {};
  const isSupervisor = Boolean(deptInfo?.isSupervisor || user?.isSupervisor);

  // 2. Department Complaints Query
  const {
    data: complaintsData,
    isLoading: loading,
    refetch: refetchComplaints
  } = useQuery({
    queryKey: ["staff-department-complaints"],
    queryFn: () => api.get("/staff/department-complaints").then((r) => r.data?.complaints || []),
  });

  const complaints = complaintsData || [];

  // 3. Department Colleagues Query (for supervisor assignment)
  const { data: colleaguesData } = useQuery({
    queryKey: ["staff-department-colleagues"],
    queryFn: () => api.get("/staff/department-colleagues").then((r) => r.data?.colleagues || []),
    enabled: isSupervisor,
  });

  const colleagues = colleaguesData || [];

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = (payload) => {
      queryClient.invalidateQueries({ queryKey: ["staff-department-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["staff-department-info"] });

      if (payload?.complaint) {
        const assignedId = String(payload.complaint.assignedTo?._id || payload.complaint.assignedTo || "");
        const myId = String(user?.id || user?._id || "");
        if (assignedId === myId) {
          toast.info(`Task notification: ${payload.complaint.title}`);
        }
      }
    };

    socket.on("complaint:created", handleRealtimeUpdate);
    socket.on("complaint:assigned", handleRealtimeUpdate);
    socket.on("complaint:status-updated", handleRealtimeUpdate);
    socket.on("complaint:deleted", handleRealtimeUpdate);

    return () => {
      socket.off("complaint:created", handleRealtimeUpdate);
      socket.off("complaint:assigned", handleRealtimeUpdate);
      socket.off("complaint:status-updated", handleRealtimeUpdate);
      socket.off("complaint:deleted", handleRealtimeUpdate);
    };
  }, [socket, user, queryClient]);

  const myId = String(user?.id || user?._id || "");

  // Categorize complaints
  const myAssignedJobs = useMemo(() => {
    return complaints.filter((c) => {
      const assignedId = String(c.assignedTo?.id || c.assignedTo?._id || c.assignedTo || "");
      return assignedId === myId && c.status !== "Resolved";
    });
  }, [complaints, myId]);

  const unassignedJobs = useMemo(() => {
    return complaints.filter((c) => !c.assignedTo && c.status !== "Resolved");
  }, [complaints]);

  const inProgressJobs = useMemo(() => {
    return complaints.filter((c) => {
      const isMine = String(c.assignedTo?.id || c.assignedTo?._id || c.assignedTo || "") === myId;
      return isMine && (c.status === "In Progress" || c.status === "in_progress");
    });
  }, [complaints, myId]);

  const resolvedJobs = useMemo(() => {
    return complaints.filter((c) => c.status === "Resolved");
  }, [complaints]);

  // Actions: Claim Task
  async function handleClaimTask(complaintId) {
    try {
      await api.post(`/staff/complaint/${complaintId}/claim`);
      toast.success("Task claimed! Assigned to you and marked in progress.");
      refetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to claim task.");
    }
  }

  // Actions: Supervisor Assign
  async function handleSupervisorAssign(e) {
    e.preventDefault();
    if (!assigningComplaint || !selectedStaffId) return;

    setAssigningBusy(true);
    try {
      await api.post(`/staff/complaint/${assigningComplaint._id || assigningComplaint.id}/assign`, {
        staffId: selectedStaffId,
        reason: assignReason.trim() || undefined,
      });
      toast.success("Task assigned successfully to staff member.");
      setAssigningComplaint(null);
      setSelectedStaffId("");
      setAssignReason("");
      refetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign task.");
    } finally {
      setAssigningBusy(false);
    }
  }

  // Actions: Update status / Start work
  async function handleUpdateStatus(id, newStatus) {
    try {
      if (newStatus === "In Progress") {
        await api.post(`/staff/complaint/${id}/start`);
      } else {
        await api.put(`/complaints/${id}/status`, { status: newStatus });
      }
      toast.success(`Task status updated to ${newStatus}`);
      refetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status.");
    }
  }

  // Actions: Mark Resolved
  async function handleResolveSubmit(e) {
    e.preventDefault();
    if (!resolvingComplaint) return;

    setResolvingBusy(true);
    try {
      await api.post(`/staff/complaint/${resolvingComplaint._id || resolvingComplaint.id}/complete`, {
        resolutionNote: resolutionNote.trim(),
      });
      toast.success("Task marked as completed! Awaiting student verification.");
      setResolvingComplaint(null);
      setResolutionNote("");
      refetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resolve complaint.");
    } finally {
      setResolvingBusy(false);
    }
  }

  // Display list based on active tab
  const displayedComplaints = useMemo(() => {
    if (activeTab === "my_jobs") return myAssignedJobs;
    if (activeTab === "dept_queue") return unassignedJobs;
    if (activeTab === "in_progress") return inProgressJobs;
    if (activeTab === "resolved") return resolvedJobs;
    return complaints;
  }, [activeTab, myAssignedJobs, unassignedJobs, inProgressJobs, resolvedJobs, complaints]);

  return (
    <>
      <div className="space-y-6">
        {/* Department Banner */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {department.name || "Maintenance"} Department
              </span>
              {department.code && (
                <Badge variant="outline" className="font-mono text-xs uppercase">
                  {department.code}
                </Badge>
              )}
              {isSupervisor && (
                <Badge variant="default" className="text-xs bg-blue-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Supervisor Access
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              {department.description || "Operational workspace for maintenance requests, assignments, and repairs."}
            </p>
            {deptInfo?.supervisor && !isSupervisor && (
              <p className="text-[11px] text-slate-400">
                Department Supervisor: <strong className="text-slate-700 dark:text-slate-300">{deptInfo.supervisor.name}</strong> ({deptInfo.supervisor.email})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchComplaints()}
              className="text-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Global Metric Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="My Assigned Jobs"
            value={myAssignedJobs.length}
            tone={myAssignedJobs.length > 0 ? "warning" : "neutral"}
            hint="Assigned to you"
          />
          <StatCard
            label="Department Queue"
            value={unassignedJobs.length}
            tone={unassignedJobs.length > 0 ? "critical" : "neutral"}
            hint="Unassigned tasks"
          />
          <StatCard
            label="In Progress"
            value={inProgressJobs.length}
            tone="info"
            hint="Active work"
          />
          <StatCard
            label="Resolved History"
            value={resolvedJobs.length}
            tone="neutral"
            hint="Completed work"
          />
        </div>

        {/* Tabs Filter */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex flex-wrap h-auto gap-1">
            <TabsTrigger value="my_jobs" className="rounded-lg text-xs font-semibold cursor-pointer">
              My Assigned Work ({myAssignedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="dept_queue" className="rounded-lg text-xs font-semibold cursor-pointer">
              Department Queue ({unassignedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="rounded-lg text-xs font-semibold cursor-pointer">
              In Progress ({inProgressJobs.length})
            </TabsTrigger>
            <TabsTrigger value="all_dept" className="rounded-lg text-xs font-semibold cursor-pointer">
              All Department Work ({complaints.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="rounded-lg text-xs font-semibold cursor-pointer">
              Resolved ({resolvedJobs.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : displayedComplaints.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All clear"
                description={
                  activeTab === "dept_queue"
                    ? "No unassigned complaints in the department queue."
                    : activeTab === "my_jobs"
                    ? "You have no open tasks assigned right now."
                    : "No complaints found in this category."
                }
              />
            ) : (
              <div className="space-y-3">
                {displayedComplaints.map((c) => {
                  const studentObj = typeof c.studentId === "object" ? c.studentId : null;
                  const studentName = studentObj?.fullName || studentObj?.name || c.studentName || "Resident";
                  const door = c.doorNumber || (studentObj ? studentObj.doorNumber : "General");
                  const assignedPerson = c.assignedTo;
                  const isAssignedToMe = String(assignedPerson?.id || assignedPerson?._id || assignedPerson || "") === myId;
                  const isInProg = c.status === "In Progress" || c.status === "in_progress";
                  const isResolved = c.status === "Resolved";

                  return (
                    <ComplaintCard
                      key={c._id || c.id}
                      complaint={c}
                      meta={
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                          <span>
                            Room <strong className="font-semibold text-foreground">{door}</strong>
                          </span>
                          <span>•</span>
                          <span>Reported by {studentName}</span>
                          <span>•</span>
                          {assignedPerson ? (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Assigned to: <strong>{assignedPerson.name || "Staff"}</strong>
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold italic">Unassigned (Queue)</span>
                          )}
                        </div>
                      }
                      footer={
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-9 text-xs cursor-pointer"
                            onClick={() => setDetailComplaint(c)}
                          >
                            View details
                          </Button>

                          {/* Claim task if unassigned */}
                          {!assignedPerson && !isResolved && (
                            <Button
                              size="sm"
                              variant="default"
                              className="min-h-9 text-xs bg-blue-600 hover:bg-blue-700 cursor-pointer"
                              onClick={() => handleClaimTask(c._id || c.id)}
                            >
                              Claim & Start Work
                            </Button>
                          )}

                          {/* Supervisor Assign Button */}
                          {isSupervisor && !isResolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-9 text-xs cursor-pointer"
                              onClick={() => {
                                setAssigningComplaint(c);
                                setSelectedStaffId(c.assignedTo?._id || c.assignedTo?.id || "");
                                setAssignReason("");
                              }}
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" />
                              {assignedPerson ? "Reassign" : "Assign to Staff"}
                            </Button>
                          )}

                          {/* Staff work actions */}
                          {isAssignedToMe && !isInProg && !isResolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-9 text-xs cursor-pointer"
                              onClick={() => handleUpdateStatus(c._id || c.id, "In Progress")}
                            >
                              Start work
                            </Button>
                          )}

                          {isAssignedToMe && !isResolved && (
                            <Button
                              size="sm"
                              className="min-h-9 text-xs cursor-pointer"
                              onClick={() => {
                                setResolvingComplaint(c);
                                setResolutionNote("");
                              }}
                            >
                              Mark resolved
                            </Button>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </Tabs>
      </div>

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
                  { label: "Room", value: `Room ${detailComplaint.doorNumber || detailComplaint.studentId?.doorNumber || "General"}` },
                  { label: "Category", value: detailComplaint.category },
                  { label: "Department", value: detailComplaint.department || detailComplaint.departmentId?.name || "Maintenance" },
                  { label: "Reported", value: formatDateTime(detailComplaint.createdAt) },
                  {
                    label: "Student",
                    value: detailComplaint.studentId?.fullName || detailComplaint.studentId?.name || detailComplaint.studentName || "Resident",
                  },
                  {
                    label: "Contact",
                    value: detailComplaint.studentId?.mobileNumber || detailComplaint.studentPhone || "—",
                  },
                  {
                    label: "Assigned To",
                    value: detailComplaint.assignedTo?.name || "Unassigned",
                  }
                ]}
              />

              <DetailSection title="Description">
                <p className="text-sm leading-relaxed text-foreground">
                  {translateComplaintText(detailComplaint.description, (t.language || undefined))}
                </p>
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

              <DetailSection title="Lifecycle Timeline">
                <ComplaintTimeline complaint={detailComplaint} variant="staff" />
              </DetailSection>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDetailComplaint(null)}>
                  Close
                </Button>
                {!detailComplaint.assignedTo && (
                  <Button
                    onClick={() => {
                      handleClaimTask(detailComplaint._id || detailComplaint.id);
                      setDetailComplaint(null);
                    }}
                  >
                    Claim This Task
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={Boolean(resolvingComplaint)} onOpenChange={(open) => !open && setResolvingComplaint(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Maintenance Work</DialogTitle>
            <DialogDescription>
              Record the resolution details and fix summary for Room {resolvingComplaint?.doorNumber || "General"}.
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
                placeholder="e.g. Replaced leaking valve, tested water pressure, issue resolved."
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
                Confirm Resolved
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supervisor Assign Dialog */}
      <Dialog open={Boolean(assigningComplaint)} onOpenChange={(open) => !open && setAssigningComplaint(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Department Complaint</DialogTitle>
            <DialogDescription>
              Assign complaint &quot;{assigningComplaint?.title}&quot; to an authorized department staff member.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSupervisorAssign} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-select">Select Department Staff</Label>
              <select
                id="staff-select"
                required
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
              >
                <option value="">Choose Staff Member</option>
                {colleagues.map((col) => (
                  <option key={col.id || col._id} value={col.id || col._id}>
                    {col.name} ({col.designation}) {col.isAvailable ? "• Available" : "• Off-Duty"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assign-reason">Assignment Instructions / Note</Label>
              <Input
                id="assign-reason"
                placeholder="e.g. Routine maintenance or priority fix"
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setAssigningComplaint(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={assigningBusy || !selectedStaffId}>
                {assigningBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Assign Job
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
