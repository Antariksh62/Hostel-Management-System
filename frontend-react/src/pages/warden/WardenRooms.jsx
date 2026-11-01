import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/hms/app-shell";
import HostelFloorMap from "@/components/hms/HostelFloorMap";
import RoomDetailDrawer from "@/components/hms/RoomDetailDrawer";
import api from "@/services/api";

export default function WardenRooms() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedFloor, setFocusedFloor] = useState(null);

  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ["service-heatmap", "all"],
    queryFn: () => api.get("/services/heat-map?service=all").then((r) => r.data),
    refetchInterval: 10000,
  });

  const roomStats = heatmapData?.roomStats || {};

  const handleSelectRoom = (roomId) => {
    setSelectedRoom(roomId);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Rooms & Floor Heat Map"
          description="Boys' Hostel architectural floor map across all 77 rooms with live maintenance indicators."
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

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : (
        <HostelFloorMap
          selectedService="all"
          roomStats={roomStats}
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          focusedFloor={focusedFloor}
          onFocusFloor={setFocusedFloor}
        />
      )}

      {/* Room Detail Drawer */}
      <RoomDetailDrawer
        roomNumber={selectedRoom}
        selectedService="all"
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedRoom(null);
        }}
        canRevealContact={true}
      />
    </div>
  );
}
