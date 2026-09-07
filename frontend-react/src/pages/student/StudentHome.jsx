import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, Plus, Loader2 } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { StatCard } from "@/components/hms/stat-card";
import { Button } from "@/components/ui/button";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

export default function StudentHome() {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyComplaints = useCallback(async () => {
    try {
      const res = await api.get("/complaints/my-complaints");
      setComplaints(res.data || []);
    } catch (err) {
      console.error("Failed to fetch student complaints:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyComplaints();
  }, [fetchMyComplaints]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (newComplaint) => {
      const isMine =
        newComplaint.studentId === (user?.id || user?._id) ||
        newComplaint.studentId?._id === (user?.id || user?._id);
      if (isMine) {
        setComplaints((prev) => [newComplaint, ...prev]);
      }
    };

    const handleStatusUpdated = ({ complaintId, complaint, status }) => {
      setComplaints((prev) =>
        prev.map((c) => {
          if (c._id === complaintId) {
            return complaint ? { ...c, ...complaint } : { ...c, status: status || c.status };
          }
          return c;
        })
      );
    };

    const handleDeleted = ({ complaintId }) => {
      setComplaints((prev) => prev.filter((c) => c._id !== complaintId));
    };

    socket.on("complaint:created", handleCreated);
    socket.on("complaint:status-updated", handleStatusUpdated);
    socket.on("complaint:deleted", handleDeleted);

    return () => {
      socket.off("complaint:created", handleCreated);
      socket.off("complaint:status-updated", handleStatusUpdated);
      socket.off("complaint:deleted", handleDeleted);
    };
  }, [socket, user]);

  const open = complaints.filter(
    (c) => c.status !== "Resolved" && c.status !== "resolved"
  );
  const resolved = complaints.filter(
    (c) => c.status === "Resolved" || c.status === "resolved"
  );

  const firstName = (user?.fullName || user?.name || "").split(" ")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Here's what's happening with your maintenance requests."
        action={
          <Button asChild className="min-h-11">
            <Link to="/student-dashboard/complaints">
              <Plus className="mr-1 size-4" aria-hidden />
              Report a problem
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Open requests"
          value={open.length}
          tone={open.length > 0 ? "warning" : "neutral"}
          hint="Need attention"
        />
        <StatCard
          label="Resolved"
          value={resolved.length}
          tone="success"
          hint="Completed"
        />
        <StatCard
          label="Your room"
          value={user?.doorNumber || "—"}
          hint="Current allotment"
        />
      </div>

      <div className="mt-9 mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Active requests</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The latest status of problems you reported.
          </p>
        </div>
        <Link
          to="/student-dashboard/complaints"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : open.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing open"
          description="When you report a problem it will appear here with live updates."
          action={
            <Button asChild variant="outline">
              <Link to="/student-dashboard/complaints">File a complaint</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {open.map((c) => (
            <ComplaintCard key={c._id || c.id} complaint={c} />
          ))}
        </div>
      )}
    </>
  );
}
