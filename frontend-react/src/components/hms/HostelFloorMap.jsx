import React from "react";
import { HOSTEL_FLOORS, getRoomsForFloor } from "@/lib/hostelRoomsData";
import { cn } from "@/lib/utils";
import { Flame, ShieldAlert, Wifi } from "lucide-react";

/**
 * HostelFloorMap
 * Renders the authoritative 77-room boys' hostel floor plan.
 * 
 * Props:
 * - selectedService: "all" | "water" | "electricity" | "wifi"
 * - roomStats: Record<string, { water: number, electricity: number, wifi: number, total: number, incidents: any[] }>
 * - selectedRoom: string | null
 * - onSelectRoom: (roomId: string) => void
 * - focusedFloor: number | null (if set, zooms into a single floor)
 * - onFocusFloor: (floorNum: number | null) => void
 */
export default function HostelFloorMap({
  selectedService = "all",
  roomStats = {},
  selectedRoom = null,
  onSelectRoom = () => {},
  focusedFloor = null,
  onFocusFloor = () => {},
}) {
  const displayedFloors = focusedFloor
    ? HOSTEL_FLOORS.filter((f) => f.floor === focusedFloor)
    : HOSTEL_FLOORS;

  return (
    <div className="space-y-6">
      {focusedFloor ? (
        <div className="flex items-center justify-between bg-surface px-4 py-2.5 rounded-lg border border-border">
          <div className="text-sm font-medium">
            Viewing Focused Floor: <span className="font-semibold text-primary">Floor {focusedFloor}</span>
          </div>
          <button
            type="button"
            onClick={() => onFocusFloor(null)}
            className="text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            ← Return to All 5 Floors
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-6",
          focusedFloor
            ? "grid-cols-1"
            : "grid-cols-1 md:grid-cols-2 xl:grid-cols-2"
        )}
      >
        {displayedFloors.map((floorMeta) => (
          <FloorPanel
            key={floorMeta.floor}
            floorMeta={floorMeta}
            selectedService={selectedService}
            roomStats={roomStats}
            selectedRoom={selectedRoom}
            onSelectRoom={onSelectRoom}
            isFocused={focusedFloor === floorMeta.floor}
            onToggleFocus={() =>
              onFocusFloor(focusedFloor === floorMeta.floor ? null : floorMeta.floor)
            }
          />
        ))}
      </div>
    </div>
  );
}

function FloorPanel({
  floorMeta,
  selectedService,
  roomStats,
  selectedRoom,
  onSelectRoom,
  isFocused,
  onToggleFocus,
}) {
  const rooms = getRoomsForFloor(floorMeta.floor);
  const prefix = String(floorMeta.floor);
  const pad = (n) => `${prefix}${String(n).padStart(2, "0")}`;

  // Group rooms by section
  const topRooms = rooms.filter((r) => r.section === "top");
  const leftRooms = rooms.filter((r) => r.section === "left");
  const rightRooms = rooms.filter((r) => r.section === "right");

  // Lower rooms for Floors 1–4 matching authoritative handwritten sketches
  const lowerLeftUpper1 = rooms.find((r) => r.id === pad(16));
  const lowerLeftUpper2 = rooms.find((r) => r.id === pad(17));
  const lowerLeftBottom1 = rooms.find((r) => r.id === pad(15));
  const lowerLeftBottom2 = rooms.find((r) => r.id === pad(14));

  const lowerRightUpper1 = rooms.find((r) => r.id === pad(10));
  const lowerRightUpper2 = rooms.find((r) => r.id === pad(11));
  const lowerRightBottom1 = rooms.find((r) => r.id === pad(13));
  const lowerRightBottom2 = rooms.find((r) => r.id === pad(12));

  // Calculate active report counts for this floor
  let floorReportCount = 0;
  let floorIncidentCount = 0;
  rooms.forEach((r) => {
    const stats = roomStats[r.id];
    if (stats) {
      if (selectedService === "water") floorReportCount += stats.water || 0;
      else if (selectedService === "electricity") floorReportCount += stats.electricity || 0;
      else if (selectedService === "wifi") floorReportCount += stats.wifi || 0;
      else floorReportCount += (stats.water || 0) + (stats.electricity || 0);

      if (stats.incidents && stats.incidents.length > 0) {
        floorIncidentCount += stats.incidents.length;
      }
    }
  });

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all",
        isFocused ? "ring-2 ring-primary/40" : "hover:border-border-strong"
      )}
    >
      {/* Floor Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-secondary text-xs font-bold text-foreground">
            F{floorMeta.floor}
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              {floorMeta.label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({rooms.length} rooms)
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {floorIncidentCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
              <ShieldAlert className="size-3" />
              {floorIncidentCount} incident{floorIncidentCount > 1 ? "s" : ""}
            </span>
          ) : null}

          {floorReportCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
              {floorReportCount} report{floorReportCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No reports</span>
          )}

          <button
            type="button"
            onClick={onToggleFocus}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            {isFocused ? "View All" : "Enlarge"}
          </button>
        </div>
      </div>

      {/* Floor Visual Architectural Diagram based on user sketches */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="relative mx-auto w-full min-w-[280px] max-w-lg rounded-lg border border-dashed border-border/80 bg-background/50 p-2 sm:p-4">
        {/* TOP ROW: 5 Columns: [X]03, [X]04, [X]05, [X]06, [X]07 */}
        <div className="mb-2 grid grid-cols-5 gap-1.5 sm:gap-2">
          {topRooms.map((room) => (
            <RoomCell
              key={room.id}
              room={room}
              selectedService={selectedService}
              stats={roomStats[room.id]}
              isSelected={selectedRoom === room.id}
              onSelect={() => onSelectRoom(room.id)}
            />
          ))}
        </div>

        {/* MIDDLE SECTION: Left Column (02, 01), Central Open Corridor, Right Column (08, 09) */}
        <div className="mb-2 grid grid-cols-5 items-stretch gap-1.5 sm:gap-2">
          {/* Left stack (02 top, 01 bottom) — aligns directly underneath top-left room [X]03 */}
          <div className="col-span-1 flex flex-col gap-1.5 sm:gap-2">
            {leftRooms.map((room) => (
              <RoomCell
                key={room.id}
                room={room}
                selectedService={selectedService}
                stats={roomStats[room.id]}
                isSelected={selectedRoom === room.id}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </div>

          {/* Central Open Space */}
          <div className="col-span-3 flex h-full min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface/40 p-2 text-center" />

          {/* Right stack (08 top, 09 bottom) — aligns directly underneath top-right room [X]07 */}
          <div className="col-span-1 flex flex-col gap-1.5 sm:gap-2">
            {rightRooms.map((room) => (
              <RoomCell
                key={room.id}
                room={room}
                selectedService={selectedService}
                stats={roomStats[room.id]}
                isSelected={selectedRoom === room.id}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </div>
        </div>

        {/* LOWER ROOM SECTIONS (Floors 1–4 only; Floor 5 has open terrace) */}
        {floorMeta.floor < 5 ? (
          <div className="space-y-1.5 sm:space-y-2 border-t border-border/60 pt-2">
            {/* Upper Lower Row: [X]16 (col 1), [X]17 (col 2), Passage (col 3), [X]10 (col 4), [X]11 (col 5) */}
            <div className="grid grid-cols-5 items-center gap-1.5 sm:gap-2">
              {lowerLeftUpper1 && (
                <RoomCell
                  room={lowerLeftUpper1}
                  selectedService={selectedService}
                  stats={roomStats[lowerLeftUpper1.id]}
                  isSelected={selectedRoom === lowerLeftUpper1.id}
                  onSelect={() => onSelectRoom(lowerLeftUpper1.id)}
                />
              )}
              {lowerLeftUpper2 && (
                <RoomCell
                  room={lowerLeftUpper2}
                  selectedService={selectedService}
                  stats={roomStats[lowerLeftUpper2.id]}
                  isSelected={selectedRoom === lowerLeftUpper2.id}
                  onSelect={() => onSelectRoom(lowerLeftUpper2.id)}
                />
              )}
              <div className="flex h-full items-center justify-center border-x border-dashed border-border/40 py-1" />
              {lowerRightUpper1 && (
                <RoomCell
                  room={lowerRightUpper1}
                  selectedService={selectedService}
                  stats={roomStats[lowerRightUpper1.id]}
                  isSelected={selectedRoom === lowerRightUpper1.id}
                  onSelect={() => onSelectRoom(lowerRightUpper1.id)}
                />
              )}
              {lowerRightUpper2 && (
                <RoomCell
                  room={lowerRightUpper2}
                  selectedService={selectedService}
                  stats={roomStats[lowerRightUpper2.id]}
                  isSelected={selectedRoom === lowerRightUpper2.id}
                  onSelect={() => onSelectRoom(lowerRightUpper2.id)}
                />
              )}
            </div>

            {/* Bottom Lower Row: [X]15 (col 1), [X]14 (col 2), Passage (col 3), [X]13 (col 4), [X]12 (col 5) */}
            <div className="grid grid-cols-5 items-center gap-1.5 sm:gap-2">
              {lowerLeftBottom1 && (
                <RoomCell
                  room={lowerLeftBottom1}
                  selectedService={selectedService}
                  stats={roomStats[lowerLeftBottom1.id]}
                  isSelected={selectedRoom === lowerLeftBottom1.id}
                  onSelect={() => onSelectRoom(lowerLeftBottom1.id)}
                />
              )}
              {lowerLeftBottom2 && (
                <RoomCell
                  room={lowerLeftBottom2}
                  selectedService={selectedService}
                  stats={roomStats[lowerLeftBottom2.id]}
                  isSelected={selectedRoom === lowerLeftBottom2.id}
                  onSelect={() => onSelectRoom(lowerLeftBottom2.id)}
                />
              )}
              <div className="flex h-full items-center justify-center border-x border-dashed border-border/40 py-1" />
              {lowerRightBottom1 && (
                <RoomCell
                  room={lowerRightBottom1}
                  selectedService={selectedService}
                  stats={roomStats[lowerRightBottom1.id]}
                  isSelected={selectedRoom === lowerRightBottom1.id}
                  onSelect={() => onSelectRoom(lowerRightBottom1.id)}
                />
              )}
              {lowerRightBottom2 && (
                <RoomCell
                  room={lowerRightBottom2}
                  selectedService={selectedService}
                  stats={roomStats[lowerRightBottom2.id]}
                  isSelected={selectedRoom === lowerRightBottom2.id}
                  onSelect={() => onSelectRoom(lowerRightBottom2.id)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-dashed border-border/60 bg-surface/30 p-4 text-center">
            <span className="text-xs font-semibold text-foreground/80">Open Courtyard & Terrace</span>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Architectural open lower elevation</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function RoomCell({
  room,
  selectedService,
  stats = {},
  isSelected,
  onSelect,
}) {
  // Determine service-specific complaint count
  let count = 0;
  if (selectedService === "water") {
    count = stats?.water || 0;
  } else if (selectedService === "electricity") {
    count = stats?.electricity || 0;
  } else if (selectedService === "wifi") {
    count = stats?.wifi || 0;
  } else {
    count = (stats?.water || 0) + (stats?.electricity || 0);
  }

  const hasIncidents = Boolean(stats?.incidents && stats.incidents.length > 0);

  // Status styling using existing design system tokens
  let borderStyle = "border-border/70 hover:border-primary/60 bg-surface/70";
  let countBadge = null;

  if (count === 0) {
    // 0 reports: subtle neutral, explicitly NOT labeled as guaranteed normal
    borderStyle = "border-border/60 hover:border-border-strong bg-card/60 text-muted-foreground";
  } else if (count === 1) {
    // 1 report: Amber / Warn
    borderStyle = "border-warn/70 bg-warn/10 text-foreground font-semibold shadow-xs";
    countBadge = (
      <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-warn text-[9px] font-bold text-white shadow-xs">
        1
      </span>
    );
  } else if (count > 1) {
    // Multiple reports: Red / Critical
    borderStyle = "border-crit/80 bg-crit/15 text-foreground font-bold shadow-xs";
    countBadge = (
      <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-crit text-[10px] font-bold text-white shadow-xs">
        {count}
      </span>
    );
  }

  if (hasIncidents) {
    borderStyle = cn(borderStyle, "ring-2 ring-warn ring-offset-1 ring-offset-background");
  }

  if (isSelected) {
    borderStyle = cn(borderStyle, "ring-2 ring-primary ring-offset-2 ring-offset-background");
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Room ${room.id}, ${count} active report${count === 1 ? "" : "s"}${
        hasIncidents ? ", shared incident active" : ""
      }`}
      className={cn(
        "relative flex h-11 w-full sm:h-12 flex-col items-center justify-center rounded-lg border text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        borderStyle
      )}
    >
      <span className="text-[11px] font-bold tracking-tight text-foreground">{room.id}</span>

      {/* Visual Report count indicator (accessible for color-blind users) */}
      {countBadge}

      {/* Incident icon indicator */}
      {hasIncidents ? (
        <span
          title="Active Shared Incident"
          className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-white"
        >
          <ShieldAlert className="size-2.5" />
        </span>
      ) : null}
    </button>
  );
}
