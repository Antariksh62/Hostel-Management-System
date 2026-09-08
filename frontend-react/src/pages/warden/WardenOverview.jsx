import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, DoorOpen, Inbox, Loader2, TriangleAlert } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { StatCard } from "@/components/hms/stat-card";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

export default function WardenOverview() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // Query all complaints
  const { data: complaints = [], isLoading: cLoading } = useQuery({
    queryKey: ["warden-complaints"],
    queryFn: () => api.get("/complaints/all").then((r) => r.data || []),
  });

  // Query analytics
  const { data: analytics, isLoading: aLoading } = useQuery({
    queryKey: ["warden-analytics", 30],
    queryFn: () => api.get("/complaints/analytics?days=30").then((r) => r.data),
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

  const open = complaints.filter((c) => c.status !== "Resolved" && c.status !== "resolved");
  const unassigned = open.filter((c) => !c.assignedTo);
  const overdue = open.filter((c) => c.overdue);
  const resolvedCount = complaints.length - open.length;

  // Occupancy estimate from door numbers
  const occupiedRooms = new Set(complaints.map((c) => c.doorNumber || c.room).filter(Boolean));
  const totalRooms = 90;

  // Prioritized: overdue + unassigned
  const prioritized = [...new Map([...overdue, ...unassigned].map((c) => [c._id || c.id, c])).values()].slice(0, 8);

  const loading = cLoading || aLoading;

  return (
    <>
      <PageHeader
        title="Overview"
        description="A focused view of what needs attention across the hostel."
        action={
          <Button asChild variant="outline" className="min-h-11 shrink-0">
            <Link to="/admin-dashboard/complaints">
              Open complaints <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Open complaints"
              value={open.length}
              tone={open.length > 0 ? "warning" : "neutral"}
              hint="Across all floors"
              icon={Inbox}
            />
            <StatCard
              label="Unassigned"
              value={unassigned.length}
              tone={unassigned.length > 0 ? "info" : "neutral"}
              hint="Waiting for ownership"
              icon={ClipboardCheck}
            />
            <StatCard
              label="Overdue"
              value={overdue.length}
              tone={overdue.length > 0 ? "critical" : "neutral"}
              hint="Requires priority"
              icon={TriangleAlert}
            />
            <StatCard
              label="Resolved"
              value={resolvedCount}
              tone="success"
              hint="Completed issues"
            />
            <StatCard
              label="Active Rooms"
              value={`${occupiedRooms.size} / ${totalRooms}`}
              hint="Rooms with requests"
              icon={DoorOpen}
            />
            <StatCard
              label="Avg Resolution"
              value={analytics?.avgResolutionHours ? `${analytics.avgResolutionHours}h` : "—"}
              hint="Resolution turnaround"
            />
          </div>

          <div className="mt-9 mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Needs attention</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Prioritized by urgency and assignment status.
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {prioritized.length} shown
            </span>
          </div>

          {prioritized.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing needs immediate attention"
              description="All open complaints are assigned to maintenance and within their response time."
            />
          ) : (
            <div className="space-y-3">
              {prioritized.map((c) => {
                const staffName = c.assignedTo?.name || "Unassigned";
                const studentObj = typeof c.studentId === "object" ? c.studentId : null;
                const studentName = studentObj?.fullName || studentObj?.name || "Student";
                const prn = studentObj?.prn || studentObj?.rollNumber || "—";
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
                          Assigned: <strong className="text-foreground">{staffName}</strong>
                        </span>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
