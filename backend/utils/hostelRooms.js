/**
 * Authoritative 77-room inventory and validation helper for PICT Boys' Hostel.
 * Floor 1: 101–117 (17 rooms)
 * Floor 2: 201–217 (17 rooms)
 * Floor 3: 301–317 (17 rooms)
 * Floor 4: 401–417 (17 rooms)
 * Floor 5: 501–509 (9 rooms)
 * Total: 77 rooms
 */

// Central room occupancy limit across all hostel rooms
const MAX_STUDENTS_PER_ROOM = 2;

const ROOMS_BY_FLOOR = {
    1: Array.from({ length: 17 }, (_, i) => String(101 + i)),
    2: Array.from({ length: 17 }, (_, i) => String(201 + i)),
    3: Array.from({ length: 17 }, (_, i) => String(301 + i)),
    4: Array.from({ length: 17 }, (_, i) => String(401 + i)),
    5: Array.from({ length: 9 }, (_, i) => String(501 + i))
};

const ALL_ROOMS = [
    ...ROOMS_BY_FLOOR[1],
    ...ROOMS_BY_FLOOR[2],
    ...ROOMS_BY_FLOOR[3],
    ...ROOMS_BY_FLOOR[4],
    ...ROOMS_BY_FLOOR[5]
];

const ROOM_SET = new Set(ALL_ROOMS);

function isValidRoom(roomNumber) {
    if (!roomNumber) return false;
    return ROOM_SET.has(String(roomNumber).trim());
}

function getFloorFromRoom(roomNumber) {
    if (!isValidRoom(roomNumber)) return null;
    const str = String(roomNumber).trim();
    return parseInt(str[0], 10);
}

function getAllRooms() {
    return ALL_ROOMS.slice();
}

function getRoomsByFloor(floor) {
    return (ROOMS_BY_FLOOR[floor] || []).slice();
}

module.exports = {
    MAX_STUDENTS_PER_ROOM,
    ROOMS_BY_FLOOR,
    ALL_ROOMS,
    isValidRoom,
    getFloorFromRoom,
    getAllRooms,
    getRoomsByFloor
};
