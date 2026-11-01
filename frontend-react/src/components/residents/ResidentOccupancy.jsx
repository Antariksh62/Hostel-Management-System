import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
  Info,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  ShieldAlert,
  User,
  Users,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HOSTEL_FLOORS,
  MAX_STUDENTS_PER_ROOM,
  getRoomsForFloor
} from "@/lib/hostelRoomsData";
import { cn } from "@/lib/utils";
import api from "@/services/api";

/**
 * ResidentOccupancy
 * Interactive room occupancy floor map for PICT Boys' Hostel (77 rooms across 5 floors).
 * Renders a spacious, responsive 2-column floor map grid on desktop (matching Image 2)
 * with room numbers and occupancy counts (e.g. 0/2, 1/2, 2/2, >2/2).
 *
 * When a room is clicked, details open in a slide-in overlay drawer from the right
 * without compressing or resizing the underlying 2-column floor map grid.
 */
export default function ResidentOccupancy({ onSelectResident }) {
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(null);
  const [focusedFloor, setFocusedFloor] = useState(null); // null = all floors

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedRoomNumber) {
        setSelectedRoomNumber(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRoomNumber]);

  // Fetch all 5 floors at once for instantaneous exploration
  const { data, isLoading } = useQuery({
    queryKey: ["residents-occupancy-all"],
    queryFn: () => api.get("/residents/occupancy").then((r) => r.data),
    refetchInterval: 15000,
  });

  const totalAssigned = data?.totalAssigned || 0;
  const unassignedCount = data?.unassignedCount || 0;
  const unassignedStudents = data?.unassignedStudents || [];
  const overCapacityCount = data?.overCapacityCount || 0;
  const overCapacityRooms = data?.overCapacityRooms || [];

  // Build a lookup map of roomNumber -> room data
  const roomDataMap = useMemo(() => {
    const map = {};
    if (data?.floors) {
      data.floors.forEach((fl) => {
        fl.rooms.forEach((r) => {
          map[r.roomNumber] = r;
        });
      });
    }
    return map;
  }, [data]);

  // Selected room details
  const selectedRoomData = selectedRoomNumber ? roomDataMap[selectedRoomNumber] : null;

  const displayedFloors = focusedFloor
    ? HOSTEL_FLOORS.filter((f) => f.floor === focusedFloor)
    : HOSTEL_FLOORS;

  const handleSelectRoom = (roomNum) => {
    setSelectedRoomNumber((prev) => (prev === roomNum ? null : roomNum));
  };

  const handleCloseDetail = () => {
    setSelectedRoomNumber(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. High-Level Occupancy Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Building className="size-4 text-primary" />
              Boys' Hostel Interactive Room Occupancy Map
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              Max {MAX_STUDENTS_PER_ROOM} students/room
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Authoritative 77-room architectural floor geometry. Click any room tile to inspect assigned residents.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs shrink-0">
          <div className="text-right">
            <p className="font-semibold text-foreground text-sm">{totalAssigned}</p>
            <p className="text-muted-foreground text-[11px]">Assigned Residents</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <p className="font-semibold text-amber-500 text-sm">{unassignedCount}</p>
            <p className="text-muted-foreground text-[11px]">Unassigned</p>
          </div>
          {overCapacityCount > 0 && (
            <>
              <div className="h-8 w-px bg-border" />
              <div className="text-right">
                <p className="font-semibold text-rose-500 text-sm">{overCapacityCount}</p>
                <p className="text-rose-500/80 text-[11px]">Over Capacity</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Legacy Over-Capacity Alert Notice Banner */}
      {overCapacityCount > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 space-y-2">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                Administrative Review Notice: {overCapacityCount} {overCapacityCount === 1 ? "room has" : "rooms have"} more than {MAX_STUDENTS_PER_ROOM} assigned residents from legacy records
              </p>
              <p className="text-[11px] text-rose-600/85 dark:text-rose-400/85 mt-0.5">
                Existing student assignments are preserved without automatic modification. Further assignments to these rooms are strictly blocked by the system until resolved through authorized room transfers.
              </p>
            </div>
          </div>

          {/* Quick jump to over-capacity rooms */}
          <div className="flex items-center gap-2 flex-wrap pt-1 pl-7">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
              Inspect over-capacity rooms:
            </span>
            {overCapacityRooms.map((r) => (
              <button
                key={r.roomNumber}
                type="button"
                onClick={() => setSelectedRoomNumber(r.roomNumber)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold transition-colors cursor-pointer border ${
                  selectedRoomNumber === r.roomNumber
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                }`}
              >
                Room {r.roomNumber} ({r.occupantCount}/{MAX_STUDENTS_PER_ROOM})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Unassigned Students Alert Notice */}
      {unassignedCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0" />
            <div>
              <span className="font-semibold">{unassignedCount} registered students</span> currently have no valid room allotment.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs shrink-0 cursor-pointer h-7 px-3"
            onClick={() => {
              if (unassignedStudents[0]) onSelectResident(unassignedStudents[0].id);
            }}
          >
            Inspect Unassigned
          </Button>
        </div>
      )}

      {/* 4. Floor Controls & Accessible Legend Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Floor Selection Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setFocusedFloor(null)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              focusedFloor === null
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5 shrink-0" />
            <span>All 5 Floors</span>
            <span className={`rounded px-1.5 py-0.2 text-[10px] ${focusedFloor === null ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground"}`}>
              77 rooms
            </span>
          </button>

          {HOSTEL_FLOORS.map((fl) => (
            <button
              key={fl.floor}
              type="button"
              onClick={() => setFocusedFloor(fl.floor === focusedFloor ? null : fl.floor)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                focusedFloor === fl.floor
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>F{fl.floor}</span>
              <span>{fl.label}</span>
              <span className={`rounded px-1.5 py-0.2 text-[10px] ${focusedFloor === fl.floor ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {fl.totalRooms}
              </span>
            </button>
          ))}
        </div>

        {/* Accessible Visual Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-card/60 border border-border/70 rounded-lg px-3 py-1.5 self-start xl:self-center">
          <span className="text-[11px] font-medium text-muted-foreground">Legend:</span>
          
          <div className="flex items-center gap-1.5" title="0 occupants, 2 beds available">
            <span className="size-3 rounded border border-border/80 bg-card" />
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">0/2 Vacant</span>
          </div>

          <div className="flex items-center gap-1.5" title="1 occupant, 1 bed available">
            <span className="size-3 rounded border border-sky-500/50 bg-sky-500/20" />
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">1/2 Single</span>
          </div>

          <div className="flex items-center gap-1.5" title="2 occupants, maximum capacity reached">
            <span className="size-3 rounded border border-emerald-500/50 bg-emerald-500/20" />
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">2/2 Full</span>
          </div>

          <div className="flex items-center gap-1.5" title="3+ occupants from legacy records, requires review">
            <span className="size-3 rounded border border-rose-500/60 bg-rose-500/20" />
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">&gt;2 Over Capacity</span>
          </div>
        </div>
      </div>

      {/* 5. Main Floor Maps Grid: Full-Width 2-Column Responsive Layout (Matching Image 2) */}
      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-6",
            focusedFloor
              ? "grid-cols-1"
              : "grid-cols-1 md:grid-cols-2"
          )}
        >
          {displayedFloors.map((floorMeta) => (
            <FloorOccupancyCard
              key={floorMeta.floor}
              floorMeta={floorMeta}
              roomDataMap={roomDataMap}
              selectedRoomNumber={selectedRoomNumber}
              onSelectRoom={handleSelectRoom}
              isFocused={focusedFloor === floorMeta.floor}
              onToggleFocus={() =>
                setFocusedFloor(focusedFloor === floorMeta.floor ? null : floorMeta.floor)
              }
            />
          ))}
        </div>
      )}

      {/* 6. Selected-Room Detail Overlay Drawer (Slide-in from right without squeezing floor maps) */}
      {selectedRoomData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
          {/* Backdrop click to close */}
          <div
            className="absolute inset-0"
            onClick={handleCloseDetail}
            aria-label="Close drawer backdrop"
          />

          {/* Drawer Body */}
          <div className="relative z-10 flex h-full w-full max-w-full sm:max-w-lg flex-col border-l border-border bg-card p-4 sm:p-6 shadow-2xl transition-transform animate-in slide-in-from-right">
            <RoomOccupancyDetailPanel
              room={selectedRoomData}
              onClose={handleCloseDetail}
              onSelectResident={onSelectResident}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FloorOccupancyCard
 * Renders the authoritative floor plan matching PICT Boys' Hostel architectural geometry.
 * Spacing, typography, and proportions match Image 2 reference.
 */
function FloorOccupancyCard({
  floorMeta,
  roomDataMap,
  selectedRoomNumber,
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

  // Lower rooms for Floors 1–4 matching authoritative layout
  const lowerLeftUpper1 = rooms.find((r) => r.id === pad(16));
  const lowerLeftUpper2 = rooms.find((r) => r.id === pad(17));
  const lowerLeftBottom1 = rooms.find((r) => r.id === pad(15));
  const lowerLeftBottom2 = rooms.find((r) => r.id === pad(14));

  const lowerRightUpper1 = rooms.find((r) => r.id === pad(10));
  const lowerRightUpper2 = rooms.find((r) => r.id === pad(11));
  const lowerRightBottom1 = rooms.find((r) => r.id === pad(13));
  const lowerRightBottom2 = rooms.find((r) => r.id === pad(12));

  // Compute floor occupancy summary
  let assignedCount = 0;
  let overCapacityOnFloor = 0;
  rooms.forEach((r) => {
    const rd = roomDataMap[r.id];
    const c = rd?.occupantCount || 0;
    assignedCount += c;
    if (c > MAX_STUDENTS_PER_ROOM) {
      overCapacityOnFloor++;
    }
  });

  const totalCapacity = rooms.length * MAX_STUDENTS_PER_ROOM;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all",
        isFocused ? "ring-2 ring-primary/40" : "hover:border-border-strong"
      )}
    >
      {/* Floor Card Header — Clean responsive wrap layout preventing text overflow */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 border-b border-border/60 pb-3">
        {/* Left: Floor badge, floor title, and room count */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-foreground">
            F{floorMeta.floor}
          </div>
          <div className="flex items-baseline gap-1.5 min-w-0 whitespace-nowrap">
            <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
              {floorMeta.label}
            </h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              ({rooms.length} rooms)
            </span>
          </div>
        </div>

        {/* Right: Over-capacity badge, bed metrics, and enlarge toggle */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {overCapacityOnFloor > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
              <ShieldAlert className="size-3 shrink-0" />
              <span>{overCapacityOnFloor} over capacity</span>
            </span>
          )}

          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {assignedCount}/{totalCapacity} beds
          </span>

          <button
            type="button"
            onClick={onToggleFocus}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer whitespace-nowrap ml-1 shrink-0"
            title={isFocused ? "Return to all floors" : "Enlarge this floor"}
          >
            {isFocused ? (
              <>
                <Minimize2 className="size-3 shrink-0" />
                <span>View All</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3 shrink-0" />
                <span>Enlarge</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floor Architectural Diagram matching original sketches and Image 2 proportions */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="relative mx-auto w-full min-w-[280px] max-w-lg rounded-lg border border-dashed border-border/80 bg-background/50 p-2 sm:p-4">
        {/* TOP ROW: 5 Columns: [X]03, [X]04, [X]05, [X]06, [X]07 */}
        <div className="mb-2 grid grid-cols-5 gap-1.5 sm:gap-2">
          {topRooms.map((room) => (
            <RoomOccupancyTile
              key={room.id}
              room={room}
              roomData={roomDataMap[room.id]}
              isSelected={selectedRoomNumber === room.id}
              onSelect={() => onSelectRoom(room.id)}
            />
          ))}
        </div>

        {/* MIDDLE SECTION: Left Column (02, 01), Central Open Space, Right Column (08, 09) */}
        <div className="mb-2 grid grid-cols-5 items-stretch gap-1.5 sm:gap-2">
          {/* Left stack (02 top, 01 bottom) */}
          <div className="col-span-1 flex flex-col gap-1.5 sm:gap-2">
            {leftRooms.map((room) => (
              <RoomOccupancyTile
                key={room.id}
                room={room}
                roomData={roomDataMap[room.id]}
                isSelected={selectedRoomNumber === room.id}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </div>

          {/* Central Open Corridor / Passageway (clean dashed area without obstructing text) */}
          <div className="col-span-3 flex h-full min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface/40 p-2 text-center" />

          {/* Right stack (08 top, 09 bottom) */}
          <div className="col-span-1 flex flex-col gap-1.5 sm:gap-2">
            {rightRooms.map((room) => (
              <RoomOccupancyTile
                key={room.id}
                room={room}
                roomData={roomDataMap[room.id]}
                isSelected={selectedRoomNumber === room.id}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </div>
        </div>

        {/* LOWER ROOM SECTIONS (Floors 1–4 only; Floor 5 has open terrace) */}
        {floorMeta.floor < 5 ? (
          <div className="space-y-1.5 sm:space-y-2 border-t border-border/60 pt-2">
            {/* Upper Lower Row: [X]16 (col 1), [X]17 (col 2), Center, [X]10 (col 4), [X]11 (col 5) */}
            <div className="grid grid-cols-5 items-center gap-1.5 sm:gap-2">
              {lowerLeftUpper1 && (
                <RoomOccupancyTile
                  room={lowerLeftUpper1}
                  roomData={roomDataMap[lowerLeftUpper1.id]}
                  isSelected={selectedRoomNumber === lowerLeftUpper1.id}
                  onSelect={() => onSelectRoom(lowerLeftUpper1.id)}
                />
              )}
              {lowerLeftUpper2 && (
                <RoomOccupancyTile
                  room={lowerLeftUpper2}
                  roomData={roomDataMap[lowerLeftUpper2.id]}
                  isSelected={selectedRoomNumber === lowerLeftUpper2.id}
                  onSelect={() => onSelectRoom(lowerLeftUpper2.id)}
                />
              )}
              <div className="flex h-full items-center justify-center border-x border-dashed border-border/40 py-1" />
              {lowerRightUpper1 && (
                <RoomOccupancyTile
                  room={lowerRightUpper1}
                  roomData={roomDataMap[lowerRightUpper1.id]}
                  isSelected={selectedRoomNumber === lowerRightUpper1.id}
                  onSelect={() => onSelectRoom(lowerRightUpper1.id)}
                />
              )}
              {lowerRightUpper2 && (
                <RoomOccupancyTile
                  room={lowerRightUpper2}
                  roomData={roomDataMap[lowerRightUpper2.id]}
                  isSelected={selectedRoomNumber === lowerRightUpper2.id}
                  onSelect={() => onSelectRoom(lowerRightUpper2.id)}
                />
              )}
            </div>

            {/* Bottom Lower Row: [X]15 (col 1), [X]14 (col 2), Center, [X]13 (col 4), [X]12 (col 5) */}
            <div className="grid grid-cols-5 items-center gap-1.5 sm:gap-2">
              {lowerLeftBottom1 && (
                <RoomOccupancyTile
                  room={lowerLeftBottom1}
                  roomData={roomDataMap[lowerLeftBottom1.id]}
                  isSelected={selectedRoomNumber === lowerLeftBottom1.id}
                  onSelect={() => onSelectRoom(lowerLeftBottom1.id)}
                />
              )}
              {lowerLeftBottom2 && (
                <RoomOccupancyTile
                  room={lowerLeftBottom2}
                  roomData={roomDataMap[lowerLeftBottom2.id]}
                  isSelected={selectedRoomNumber === lowerLeftBottom2.id}
                  onSelect={() => onSelectRoom(lowerLeftBottom2.id)}
                />
              )}
              <div className="flex h-full items-center justify-center border-x border-dashed border-border/40 py-1" />
              {lowerRightBottom1 && (
                <RoomOccupancyTile
                  room={lowerRightBottom1}
                  roomData={roomDataMap[lowerRightBottom1.id]}
                  isSelected={selectedRoomNumber === lowerRightBottom1.id}
                  onSelect={() => onSelectRoom(lowerRightBottom1.id)}
                />
              )}
              {lowerRightBottom2 && (
                <RoomOccupancyTile
                  room={lowerRightBottom2}
                  roomData={roomDataMap[lowerRightBottom2.id]}
                  isSelected={selectedRoomNumber === lowerRightBottom2.id}
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

/**
 * RoomOccupancyTile
 * Compact, clickable architectural tile displaying:
 * - Room number
 * - Actual registered resident count out of 2 (e.g. 101 — 0/2, 1/2, 2/2, 4/2)
 * - Subtle accessible status indicator
 */
function RoomOccupancyTile({
  room,
  roomData,
  isSelected,
  onSelect,
}) {
  const count = roomData?.occupantCount || 0;
  const maxCapacity = roomData?.maxCapacity || MAX_STUDENTS_PER_ROOM;
  const isOverCapacity = roomData?.isOverCapacity || count > maxCapacity;
  const isFull = roomData?.isFull || count === maxCapacity;

  let containerStyle = "border-border/60 bg-card/60 hover:border-border-strong hover:bg-muted/30 text-muted-foreground";
  let countColor = "text-muted-foreground";
  let statusAccessible = "Vacant";

  if (isOverCapacity) {
    containerStyle = "border-rose-500/70 bg-rose-500/10 hover:border-rose-600 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold shadow-xs";
    countColor = "text-rose-600 dark:text-rose-400 font-bold";
    statusAccessible = `Over capacity (${count}/${maxCapacity} assigned, requires administrative review)`;
  } else if (isFull) {
    containerStyle = "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70 hover:bg-emerald-500/10 text-foreground shadow-xs";
    countColor = "text-emerald-700 dark:text-emerald-400 font-semibold";
    statusAccessible = `Full (${count}/${maxCapacity} assigned)`;
  } else if (count === 1) {
    containerStyle = "border-sky-500/40 bg-sky-500/5 hover:border-sky-500/70 hover:bg-sky-500/10 text-foreground shadow-xs";
    countColor = "text-sky-600 dark:text-sky-400 font-semibold";
    statusAccessible = `1 resident assigned (1 place available)`;
  }

  if (isSelected) {
    containerStyle = cn(
      containerStyle,
      "ring-2 ring-primary ring-offset-2 ring-offset-background font-bold"
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Room ${room.id} — ${count} of ${maxCapacity} residents assigned. ${statusAccessible}`}
      className={cn(
        "relative flex h-11 w-full sm:h-12 flex-col items-center justify-center rounded-lg border text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        containerStyle
      )}
    >
      {/* Room Number */}
      <span className="text-[11px] font-bold tracking-tight text-foreground leading-tight">
        {room.id}
      </span>

      {/* Actual Occupancy Count out of 2 */}
      <span className={cn("text-[10px] font-mono leading-tight mt-0.5", countColor)}>
        {count}/{maxCapacity}
      </span>

      {/* Over-capacity alert indicator icon */}
      {isOverCapacity && (
        <span
          title="Over capacity (Requires review)"
          className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs"
        >
          <ShieldAlert className="size-2.5" />
        </span>
      )}
    </button>
  );
}

/**
 * RoomOccupancyDetailPanel
 * Drawer content displaying complete room details upon selection:
 * - Room number and floor
 * - Assigned resident count & capacity
 * - Available places
 * - All currently assigned student names, PRNs, Branch, Year, Division
 * - Profile links opening the complete Student Detail drawer
 * (No phone numbers or emergency contacts shown automatically in overview)
 */
function RoomOccupancyDetailPanel({
  room,
  onClose,
  onSelectResident,
}) {
  const count = room.occupantCount || 0;
  const maxCapacity = room.maxCapacity || MAX_STUDENTS_PER_ROOM;
  const isOverCapacity = room.isOverCapacity || count > maxCapacity;
  const isFull = room.isFull || count === maxCapacity;
  const availablePlaces = Math.max(0, maxCapacity - count);
  const occupants = room.occupants || [];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="flex items-start justify-between border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
              {room.roomNumber}
            </span>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Room {room.roomNumber} Details
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Floor {room.floor} · PICT Boys' Hostel Inventory
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close room details drawer"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-1">
        {/* Occupancy Status Summary Badge */}
        <div className="rounded-lg border border-border/80 bg-surface/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Capacity Status</span>
            {isOverCapacity ? (
              <Badge variant="destructive" className="bg-rose-500/15 text-rose-600 border border-rose-500/30 text-xs font-semibold">
                {count}/{maxCapacity} • Over Capacity
              </Badge>
            ) : isFull ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                {count}/{maxCapacity} • Full
              </Badge>
            ) : count === 1 ? (
              <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 text-xs font-semibold">
                1/{maxCapacity} • 1 Place Available
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                0/{maxCapacity} • Vacant (2 Places Available)
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
            <div>
              <p className="text-muted-foreground text-[10px]">Registered Residents</p>
              <p className="font-semibold text-foreground font-mono">{count} student{count === 1 ? "" : "s"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">Available Capacity</p>
              <p className="font-semibold text-foreground font-mono">
                {availablePlaces} bed{availablePlaces === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        {/* Legacy Over-Capacity Alert Box */}
        {isOverCapacity && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Over-Capacity Violation</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This room contains {count} students, exceeding the hostel limit of {maxCapacity}.
              Further allotments into this room are rejected. Use the profile links below to schedule room transfers.
            </p>
          </div>
        )}

        {/* Resident Records List */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5" />
              Current Residents ({occupants.length})
            </h4>
            <span className="text-[10px] text-muted-foreground">Max {maxCapacity}</span>
          </div>

          {occupants.length > 0 ? (
            <div className="space-y-2.5">
              {occupants.map((student) => (
                <div
                  key={student.id}
                  className="rounded-lg border border-border bg-card p-3.5 space-y-2.5 hover:border-primary/50 transition-colors shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-primary shrink-0" />
                        <h5 className="font-semibold text-xs text-foreground truncate">
                          {student.name}
                        </h5>
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        PRN: {student.prn || "—"}
                      </p>
                    </div>

                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                      Roll {student.rollNumber || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/50">
                    <span>
                      {student.branch || "—"} · {student.year || "—"}
                      {student.classDiv ? ` · Div ${student.classDiv}` : ""}
                    </span>

                    <button
                      type="button"
                      onClick={() => onSelectResident(student.id)}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Full Profile</span>
                      <ChevronRight className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground space-y-1">
              <DoorOpen className="size-6 text-muted-foreground/60 mx-auto" />
              <p className="font-medium text-foreground">No Residents Assigned</p>
              <p className="text-[11px]">This room is vacant with {maxCapacity} bed spaces available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
