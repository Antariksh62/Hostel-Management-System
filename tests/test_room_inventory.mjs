// test_room_inventory.mjs
import { HOSTEL_FLOORS, HOSTEL_ROOMS, HOSTEL_ROOMS_MAP, getRoomsForFloor } from '../frontend-react/src/lib/hostelRoomsData.js';

console.log("=== CHECKING 77-ROOM INVENTORY & GEOMETRY ===");

// 1. Total count
if (HOSTEL_ROOMS.length !== 77) {
  throw new Error(`Expected 77 rooms, got ${HOSTEL_ROOMS.length}`);
}
console.log("✓ Total room count is exactly 77");

// 2. Uniqueness
const ids = HOSTEL_ROOMS.map(r => r.id);
const uniqueIds = new Set(ids);
if (uniqueIds.size !== 77) {
  throw new Error(`Expected 77 unique room IDs, got ${uniqueIds.size}`);
}
console.log("✓ All 77 room IDs are unique");

// 3. Per-floor counts & ranges
const expectedCounts = { 1: 17, 2: 17, 3: 17, 4: 17, 5: 9 };
for (const [floorStr, expectedCount] of Object.entries(expectedCounts)) {
  const floor = Number(floorStr);
  const rooms = getRoomsForFloor(floor);
  if (rooms.length !== expectedCount) {
    throw new Error(`Floor ${floor}: expected ${expectedCount} rooms, got ${rooms.length}`);
  }
  console.log(`✓ Floor ${floor}: exactly ${rooms.length} rooms`);
}

// 4. Verify lower rooms on floors 1-4
for (let f = 1; f <= 4; f++) {
  const prefix = String(f);
  const lowerRooms = [
    `${prefix}16`, `${prefix}17`, `${prefix}10`, `${prefix}11`,
    `${prefix}15`, `${prefix}14`, `${prefix}13`, `${prefix}12`
  ];
  for (const rm of lowerRooms) {
    if (!HOSTEL_ROOMS_MAP.has(rm)) {
      throw new Error(`Floor ${f} missing lower room ${rm}`);
    }
  }
  console.log(`✓ Floor ${f}: all lower rooms ([${prefix}16, ${prefix}17, ${prefix}10, ${prefix}11, ${prefix}15, ${prefix}14, ${prefix}13, ${prefix}12]) are present`);
}

// 5. Verify floor 5 distinct arrangement (501–509, no lower rooms)
const floor5Rooms = getRoomsForFloor(5).map(r => r.id);
const expectedFloor5 = ["503", "504", "505", "506", "507", "502", "501", "508", "509"].sort();
if (JSON.stringify([...floor5Rooms].sort()) !== JSON.stringify(expectedFloor5)) {
  throw new Error(`Floor 5 rooms mismatch: got ${floor5Rooms.join(",")}`);
}
console.log("✓ Floor 5: exactly 9 rooms (501–509) with open lower terrace geometry");

console.log("ALL 77-ROOM GEOMETRY CHECKS PASSED SUCCESSFULLY!");
