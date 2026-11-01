import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplet, Flame, Layers, Loader2, Wrench } from "lucide-react";

import { PageHeader } from "@/components/hms/app-shell";
import HostelFloorMap from "@/components/hms/HostelFloorMap";
import RoomDetailDrawer from "@/components/hms/RoomDetailDrawer";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

export default function StaffHeatmap() {
  const [selectedService, setSelectedService] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedFloor, setFocusedFloor] = useState(null);

  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // Fetch real-time service heatmap stats
  const { data: heatmapData = { roomStats: {}, summary: {} }, isLoading } = useQuery({
    queryKey: ["service-heatmap", selectedService],
    queryFn: () => api.get(`/services/heat-map?service=${selectedService}`).then((r) => r.data),
    refetchInterval: 10000,
  });

  const roomStats = heatmapData?.roomStats || {};

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["service-heatmap"] });
    };

    socket.on("complaint:new", handleUpdate);
    socket.on("complaint:updated", handleUpdate);
    socket.on("service:heatmap-update", handleUpdate);

    return () => {
      socket.off("complaint:new", handleUpdate);
      socket.off("complaint:updated", handleUpdate);
      socket.off("service:heatmap-update", handleUpdate);
    };
  }, [socket, queryClient]);

  const handleSelectRoom = (roomId) => {
    setSelectedRoom(roomId);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Hostel Service Heat Map"
          description="Live operational heat map across all 77 rooms on 5 floors for maintenance and repairs."
        />

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs shrink-0 self-start sm:self-center">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-border bg-card" />
            <span className="text-muted-foreground">No reports</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-amber-500/40 bg-amber-500/20" />
            <span className="text-muted-foreground">1 report</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-rose-500/40 bg-rose-500/20" />
            <span className="text-muted-foreground">2+ reports</span>
          </div>
        </div>
      </div>

      {/* Service Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedService("all")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            selectedService === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Layers className="size-3.5" />
          All Maintenance
        </button>

        <button
          type="button"
          onClick={() => setSelectedService("water")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            selectedService === "water"
              ? "bg-sky-600 text-white shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Droplet className="size-3.5" />
          Water Supply
        </button>

        <button
          type="button"
          onClick={() => setSelectedService("electricity")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            selectedService === "electricity"
              ? "bg-amber-600 text-white shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Flame className="size-3.5" />
          Electricity
        </button>
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

      {/* Room Detail Drawer (Staff does not have contact reveal) */}
      <RoomDetailDrawer
        roomNumber={selectedRoom}
        selectedService={selectedService}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedRoom(null);
        }}
        canRevealContact={false}
      />
    </div>
  );
}

