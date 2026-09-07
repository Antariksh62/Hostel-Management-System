import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import api from "@/services/api";

export default function WardenStaff() {
  const { data: staffList = [], isLoading: sLoading } = useQuery({
    queryKey: ["warden-staff-list"],
    queryFn: () => api.get("/users/staff").then((r) => r.data || []),
  });

  const { data: complaints = [], isLoading: cLoading } = useQuery({
    queryKey: ["warden-complaints"],
    queryFn: () => api.get("/complaints").then((r) => r.data || []),
  });

  const loading = sLoading || cLoading;

  return (
    <>
      <PageHeader
        title="Maintenance Staff"
        description="Current operational workload across the maintenance team."
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members registered"
          description="Registered maintenance staff will appear here."
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {staffList.map((s) => {
            const sid = s._id || s.id;
            const assigned = complaints.filter((c) => {
              const assignedId = c.assignedTo?._id || c.assignedTo;
              return String(assignedId) === String(sid);
            });
            const open = assigned.filter(
              (c) => c.status !== "Resolved" && c.status !== "resolved"
            ).length;
            const done = assigned.length - open;

            return (
              <div
                key={sid}
                className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {open} <span className="font-normal text-muted-foreground">active</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">{done} resolved</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
