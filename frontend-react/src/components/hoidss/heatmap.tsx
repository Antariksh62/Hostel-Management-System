import { Droplet, Flame, Layers, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import HostelFloorMap from "@/components/hms/HostelFloorMap";
import RoomDetailDrawer from "@/components/hms/RoomDetailDrawer";
import api from "@/services/api";
import { Band } from "./primitives";

export function HeatmapBand() {
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedFloor, setFocusedFloor] = useState<number | null>(null);

  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ["service-heatmap", selectedService],
    queryFn: () => api.get(`/services/heat-map?service=${selectedService}`).then((r) => r.data),
    refetchInterval: 10000,
  });

  const roomStats = heatmapData?.roomStats || {};

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoom(roomId);
    setIsDrawerOpen(true);
  };

  return (
    <Band
      id="heatmap"
      question="Where is it happening?"
      verdict="Boys' Hostel architectural floor heat map across all 77 rooms on 5 floors."
      aside={
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Live Room Spatial Heat Map
        </div>
      }
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7 space-y-6">
        {/* Controls bar: Service Toggles and Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedService("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedService === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              All Services
            </button>
            <button
              type="button"
              onClick={() => setSelectedService("water")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedService === "electricity"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Flame className="size-3.5" />
              Electricity
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
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

        {/* 5-Floor Map */}
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
      </div>
    </Band>
  );
}
