import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/hms/app-shell";
import { cn } from "@/lib/utils";
import api from "@/services/api";

const FLOORS = [
  { floor: 5, rooms: Array.from({ length: 10 }, (_, i) => String(501 + i)) },
  { floor: 4, rooms: Array.from({ length: 20 }, (_, i) => String(401 + i)) },
  { floor: 3, rooms: Array.from({ length: 20 }, (_, i) => String(301 + i)) },
  { floor: 2, rooms: Array.from({ length: 20 }, (_, i) => String(201 + i)) },
  { floor: 1, rooms: Array.from({ length: 20 }, (_, i) => String(101 + i)) },
];

export default function WardenRooms() {
  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["warden-complaints"],
    queryFn: () => api.get("/complaints/all").then((r) => r.data || []),
  });

  // Calculate active open complaints per room
  const openByRoom = complaints.reduce((acc, c) => {
    if (c.status !== "Resolved" && c.status !== "resolved") {
      const rm = c.doorNumber || c.room;
      if (rm) acc[rm] = (acc[rm] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Rooms Overview"
        description="All 90 rooms across 5 floors with live issue indicators."
      />

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {FLOORS.map(({ floor, rooms }) => (
            <section key={floor} className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">Floor {floor}</h2>
                <span className="text-xs text-muted-foreground">{rooms.length} rooms</span>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-10">
                {rooms.map((roomNum) => {
                  const openCount = openByRoom[roomNum] || 0;
                  const hasIssues = openCount > 0;

                  return (
                    <div
                      key={roomNum}
                      className={cn(
                        "rounded-lg border p-2 text-center transition-colors",
                        hasIssues
                          ? "border-[var(--hms-critical)]/40 bg-[var(--hms-critical-soft)]"
                          : "border-border bg-muted/40 hover:bg-muted/70"
                      )}
                    >
                      <p className="text-sm font-semibold tabular-nums">{roomNum}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px] font-medium",
                          hasIssues
                            ? "text-[var(--hms-critical-foreground)]"
                            : "text-muted-foreground"
                        )}
                      >
                        {hasIssues ? `${openCount} open` : "Clear"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
