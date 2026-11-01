import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Droplets,
  Layers,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Zap
} from "lucide-react";
import { PageHeader } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import HostelFloorMap from "@/components/hms/HostelFloorMap";
import RoomDetailDrawer from "@/components/hms/RoomDetailDrawer";
import SharedIncidentModal from "@/components/hms/SharedIncidentModal";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";
import { cn } from "@/lib/utils";

/**
 * WardenServiceMonitor
 * All-5-floor real-time service monitoring heat map for Boys' Hostel.
 * Covers Water Supply, Electricity, and Wi-Fi, with shared-incident management.
 */
export default function WardenServiceMonitor() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [selectedService, setSelectedService] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [focusedFloor, setFocusedFloor] = useState(null);

  // Fetch real-time service heatmap stats
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["service-heatmap", selectedService],
    queryFn: () =>
      api.get(`/services/heat-map?service=${selectedService}`).then((r) => r.data),
  });

  // Socket.IO real-time synchronization
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["service-heatmap"] });
      queryClient.invalidateQueries({ queryKey: ["all-incidents"] });
      if (selectedRoom) {
        queryClient.invalidateQueries({ queryKey: ["room-complaints", selectedRoom] });
      }
    };

    socket.on("service:heatmap-update", handleUpdate);
    socket.on("complaint:created", handleUpdate);
    socket.on("complaint:status-updated", handleUpdate);
    socket.on("complaint:assigned", handleUpdate);
    socket.on("incident:created", handleUpdate);
    socket.on("incident:updated", handleUpdate);

    return () => {
      socket.off("service:heatmap-update", handleUpdate);
      socket.off("complaint:created", handleUpdate);
      socket.off("complaint:status-updated", handleUpdate);
      socket.off("complaint:assigned", handleUpdate);
      socket.off("incident:created", handleUpdate);
      socket.off("incident:updated", handleUpdate);
    };
  }, [socket, queryClient, selectedRoom]);

  const summary = data?.summary || {
    water: { openCount: 0, distinctRooms: 0, activeIncidents: 0 },
    electricity: { openCount: 0, distinctRooms: 0, activeIncidents: 0 },
  };

  const roomStats = data?.roomStats || {};

  const handleSelectRoom = (roomId) => {
    setSelectedRoom(roomId);
    setIsDrawerOpen(true);
  };

  const totalIncidents = (summary.water?.activeIncidents || 0) + (summary.electricity?.activeIncidents || 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Boys' Hostel Service Monitor"
          description="Real-time operational heat map across all 77 rooms on 5 floors for Water Supply and Electricity Outages."
        />

        <div className="flex items-center gap-3">
          {totalIncidents > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-warn/50 bg-warn/10 text-warn hover:bg-warn/20 cursor-pointer font-semibold animate-pulse"
              onClick={() => setIsIncidentModalOpen(true)}
            >
              <ShieldAlert className="size-4" />
              {totalIncidents} Shared Incident{totalIncidents > 1 ? "s" : ""}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 cursor-pointer text-xs"
              onClick={() => setIsIncidentModalOpen(true)}
            >
              <ShieldAlert className="size-3.5" />
              Incidents Log
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => refetch()}
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Service Filter Tabs & Executive Summaries */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Water Tab */}
        <button
          type="button"
          onClick={() => setSelectedService(selectedService === "water" ? "all" : "water")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition-all cursor-pointer shadow-xs",
            selectedService === "water"
              ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30"
              : "border-border bg-card hover:border-border-strong"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
              <Droplets className="size-4" />
              Water Supply
            </span>
            {summary.water?.activeIncidents > 0 ? (
              <span className="rounded-full bg-warn/20 px-2 py-0.5 text-[10px] font-bold text-warn">
                {summary.water.activeIncidents} Incident
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.water?.openCount || 0}
            </span>
            <span className="text-xs text-muted-foreground">active reports</span>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {summary.water?.distinctRooms || 0} distinct room{summary.water?.distinctRooms !== 1 ? "s" : ""} affected
          </div>
        </button>

        {/* Electricity Tab */}
        <button
          type="button"
          onClick={() => setSelectedService(selectedService === "electricity" ? "all" : "electricity")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition-all cursor-pointer shadow-xs",
            selectedService === "electricity"
              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30"
              : "border-border bg-card hover:border-border-strong"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Zap className="size-4" />
              Electricity Outages
            </span>
            {summary.electricity?.activeIncidents > 0 ? (
              <span className="rounded-full bg-warn/20 px-2 py-0.5 text-[10px] font-bold text-warn">
                {summary.electricity.activeIncidents} Incident
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.electricity?.openCount || 0}
            </span>
            <span className="text-xs text-muted-foreground">active reports</span>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {summary.electricity?.distinctRooms || 0} distinct room{summary.electricity?.distinctRooms !== 1 ? "s" : ""} affected
          </div>
        </button>
      </div>

      {/* Heat Map Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span>Active Filter:</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary uppercase text-[11px]">
            {selectedService}
          </span>
          {selectedService !== "all" ? (
            <button
              type="button"
              onClick={() => setSelectedService("all")}
              className="ml-2 text-primary hover:underline cursor-pointer text-xs"
            >
              (Clear filter)
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-border bg-card" />
            <span className="text-muted-foreground">0 reports</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-warn bg-warn/20" />
            <span className="text-muted-foreground">1 report</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-crit bg-crit/20" />
            <span className="text-muted-foreground">2+ reports</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-warn" />
            <span className="text-muted-foreground">Shared Incident</span>
          </div>
        </div>
      </div>

      {/* Main Floor Maps View: All 5 Floors Together */}
      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : (
        <HostelFloorMap
          selectedService={selectedService}
          roomStats={roomStats}
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          focusedFloor={focusedFloor}
          onFocusFloor={setFocusedFloor}
        />
      )}

      {/* Room Detail Drawer (Warden has authorized contact reveal) */}
      <RoomDetailDrawer
        roomNumber={selectedRoom}
        selectedService={selectedService}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedRoom(null);
        }}
        canRevealContact={true}
      />

      {/* Shared Incident Management Modal */}
      <SharedIncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
      />
    </div>
  );
}
