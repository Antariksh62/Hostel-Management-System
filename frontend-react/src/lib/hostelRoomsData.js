/**
 * hostelRoomsData.js
 * Authoritative 77-room inventory and geometry for PICT Boys' Hostel across 5 floors.
 *
 * Inventory:
 * Floor 1: 101–117 (17 rooms)
 * Floor 2: 201–217 (17 rooms)
 * Floor 3: 301–317 (17 rooms)
 * Floor 4: 401–417 (17 rooms)
 * Floor 5: 501–509 (9 rooms)
 * Total: 77 rooms
 */

// Central room occupancy limit across all hostel rooms
export const MAX_STUDENTS_PER_ROOM = 2;

export const HOSTEL_FLOORS = [
  { floor: 1, label: "Floor 1", totalRooms: 17 },
  { floor: 2, label: "Floor 2", totalRooms: 17 },
  { floor: 3, label: "Floor 3", totalRooms: 17 },
  { floor: 4, label: "Floor 4", totalRooms: 17 },
  { floor: 5, label: "Floor 5", totalRooms: 9, hasOpenCourtyard: true },
];

/**
 * Grid layout coordinate specs:
 * Each floor is mapped onto an 8-column x 7-row coordinate space (0-indexed or 1-indexed).
 * 
 * Top row: 5 rooms (col 2, 3, 4, 5, 6; row 1)
 * Left side: 2 rooms (col 1, rows 2, 3)
 * Right side: 2 rooms (col 7, rows 2, 3)
 * Central region: open corridor/courtyard
 * 
 * For Floors 1–4:
 * Upper lower row: 2 rooms on left (col 1, 2; row 5), 2 rooms on right (col 6, 7; row 5) with central opening in col 3, 4, 5.
 * Bottom row: 4 rooms (col 2, 3, 5, 6; row 6)
 *
 * For Floor 5:
 * Large open terrace / interior (no lower room sections).
 */

function generateFloorRooms(floorNum) {
  const prefix = String(floorNum);
  const pad = (n) => `${prefix}${String(n).padStart(2, "0")}`;

  if (floorNum === 5) {
    return [
      // Top row (cols 1 to 5): 503, 504, 505, 506, 507
      { id: pad(3), floor: 5, row: 1, col: 1, section: "top" },
      { id: pad(4), floor: 5, row: 1, col: 2, section: "top" },
      { id: pad(5), floor: 5, row: 1, col: 3, section: "top" },
      { id: pad(6), floor: 5, row: 1, col: 4, section: "top" },
      { id: pad(7), floor: 5, row: 1, col: 5, section: "top" },
      // Left side, top to bottom: 502, 501
      { id: pad(2), floor: 5, row: 2, col: 1, section: "left" },
      { id: pad(1), floor: 5, row: 3, col: 1, section: "left" },
      // Right side, top to bottom: 508, 509
      { id: pad(8), floor: 5, row: 2, col: 5, section: "right" },
      { id: pad(9), floor: 5, row: 3, col: 5, section: "right" },
    ];
  }

  // Floors 1 to 4: 17 rooms
  return [
    // Top row (cols 1 to 5): [X]03, [X]04, [X]05, [X]06, [X]07
    { id: pad(3), floor: floorNum, row: 1, col: 1, section: "top" },
    { id: pad(4), floor: floorNum, row: 1, col: 2, section: "top" },
    { id: pad(5), floor: floorNum, row: 1, col: 3, section: "top" },
    { id: pad(6), floor: floorNum, row: 1, col: 4, section: "top" },
    { id: pad(7), floor: floorNum, row: 1, col: 5, section: "top" },

    // Left side (top to bottom): [X]02, [X]01
    { id: pad(2), floor: floorNum, row: 2, col: 1, section: "left" },
    { id: pad(1), floor: floorNum, row: 3, col: 1, section: "left" },

    // Right side (top to bottom): [X]08, [X]09
    { id: pad(8), floor: floorNum, row: 2, col: 5, section: "right" },
    { id: pad(9), floor: floorNum, row: 3, col: 5, section: "right" },

    // Lower-left block: [X]16, [X]17 (upper) over [X]15, [X]14 (bottom)
    { id: pad(16), floor: floorNum, row: 5, col: 1, section: "lower-left" },
    { id: pad(17), floor: floorNum, row: 5, col: 2, section: "lower-left" },
    { id: pad(15), floor: floorNum, row: 6, col: 1, section: "lower-left" },
    { id: pad(14), floor: floorNum, row: 6, col: 2, section: "lower-left" },

    // Lower-right block: [X]10, [X]11 (upper) over [X]13, [X]12 (bottom)
    { id: pad(10), floor: floorNum, row: 5, col: 4, section: "lower-right" },
    { id: pad(11), floor: floorNum, row: 5, col: 5, section: "lower-right" },
    { id: pad(13), floor: floorNum, row: 6, col: 4, section: "lower-right" },
    { id: pad(12), floor: floorNum, row: 6, col: 5, section: "lower-right" },
  ];
}

export const HOSTEL_ROOMS = [
  ...generateFloorRooms(1),
  ...generateFloorRooms(2),
  ...generateFloorRooms(3),
  ...generateFloorRooms(4),
  ...generateFloorRooms(5),
];

export const HOSTEL_ROOMS_MAP = new Map(
  HOSTEL_ROOMS.map((r) => [r.id, r])
);

export function getAllRoomIds() {
  return HOSTEL_ROOMS.map((r) => r.id);
}

export function getRoomsForFloor(floorNum) {
  return HOSTEL_ROOMS.filter((r) => r.floor === Number(floorNum));
}

export function isValidRoomId(roomId) {
  return HOSTEL_ROOMS_MAP.has(String(roomId));
}
