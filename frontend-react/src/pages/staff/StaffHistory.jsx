import React, { useContext, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

export default function StaffHistory() {
  const { user } = useContext(AuthContext);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDone() {
      try {
        const res = await api.get("/complaints/all");
        const myId = user?.id || user?._id;
        const resolved = (res.data || []).filter((c) => {
          if (!c.assignedTo) return false;
          const assignedId = c.assignedTo._id || c.assignedTo;
          const isMine = String(assignedId) === String(myId);
          const isDone = c.status === "Resolved" || c.status === "resolved";
          return isMine && isDone;
        });
        setComplaints(resolved);
      } catch (err) {
        console.error("Failed to load completed jobs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDone();
  }, [user]);

  return (
    <>
      <PageHeader
        title="Work History"
        description={`${complaints.length} completed ${complaints.length === 1 ? "job" : "jobs"}.`}
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing completed yet"
          description="Resolved maintenance jobs with notes will be listed here."
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <ComplaintCard
              key={c._id || c.id}
              complaint={c}
              meta={
                c.resolutionNote ? (
                  <span className="text-foreground/80">
                    <strong>Note:</strong> {c.resolutionNote}
                  </span>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
