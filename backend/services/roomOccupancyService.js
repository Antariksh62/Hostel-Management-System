const RoomOccupancy = require("../models/RoomOccupancy");
const { Student } = require("../models/User");
const StudentRoster = require("../models/StudentRoster");
const { ALL_ROOMS, MAX_STUDENTS_PER_ROOM, isValidRoom } = require("../utils/hostelRooms");
const logger = require("../utils/logger");

/**
 * Synchronize the RoomOccupancy collection with actual Student records and approved StudentRoster reservations in MongoDB.
 * Preserves existing student assignments, even if over-capacity, and flags them for administrative review.
 */
async function syncRoomOccupancy() {
    try {
        const [studentAgg, rosterAgg] = await Promise.all([
            Student.aggregate([
                { $match: { role: "STUDENT", doorNumber: { $exists: true, $nin: [null, ""] } } },
                { $group: { _id: "$doorNumber", count: { $sum: 1 }, occupants: { $push: "$_id" } } }
            ]),
            StudentRoster.aggregate([
                {
                    $match: {
                        admissionStatus: "APPROVED",
                        registrationStatus: { $ne: "REGISTERED" },
                        doorNumber: { $exists: true, $nin: [null, ""] }
                    }
                },
                { $group: { _id: "$doorNumber", count: { $sum: 1 }, reservations: { $push: "$_id" } } }
            ])
        ]);

        const occMap = {};
        studentAgg.forEach(item => {
            occMap[item._id] = { occupants: item.occupants, reservations: [] };
        });
        rosterAgg.forEach(item => {
            if (!occMap[item._id]) {
                occMap[item._id] = { occupants: [], reservations: [] };
            }
            occMap[item._id].reservations = item.reservations;
        });

        const ops = ALL_ROOMS.map(roomNum => {
            const data = occMap[roomNum] || { occupants: [], reservations: [] };
            const totalCount = data.occupants.length + data.reservations.length;
            return {
                updateOne: {
                    filter: { roomNumber: roomNum },
                    update: {
                        $set: {
                            occupantCount: totalCount,
                            occupants: data.occupants,
                            rosterReservations: data.reservations,
                            isOverCapacity: totalCount > MAX_STUDENTS_PER_ROOM,
                            updatedAt: new Date()
                        }
                    },
                    upsert: true
                }
            };
        });

        await RoomOccupancy.bulkWrite(ops);
        const overCapacity = Object.entries(occMap)
            .map(([room, d]) => ({ room, count: d.occupants.length + d.reservations.length }))
            .filter(r => r.count > MAX_STUDENTS_PER_ROOM);

        if (overCapacity.length > 0) {
            logger.warn(`[OCCUPANCY] Flagged ${overCapacity.length} over-capacity rooms requiring review: ${overCapacity.map(o => `${o.room} (${o.count}/${MAX_STUDENTS_PER_ROOM})`).join(", ")}`);
        } else {
            logger.info(`[OCCUPANCY] Synchronized 77 rooms. All within capacity limit of ${MAX_STUDENTS_PER_ROOM}.`);
        }
        return { totalSynced: ALL_ROOMS.length, overCapacityRooms: overCapacity };
    } catch (err) {
        logger.error("syncRoomOccupancy error:", err);
        throw err;
    }
}

/**
 * Check if a room can accept an additional student.
 * Excludes studentId if they are already in the room.
 */
async function checkRoomCapacity(roomNumber, excludeStudentId = null) {
    const cleanRoom = String(roomNumber).trim();
    if (!isValidRoom(cleanRoom)) {
        return {
            allowed: false,
            message: `Room ${cleanRoom} is not a valid room in the 77-room inventory (101–509)`
        };
    }

    const filter = { role: "STUDENT", doorNumber: cleanRoom };
    if (excludeStudentId) {
        filter._id = { $ne: excludeStudentId };
    }

    const studentCount = await Student.countDocuments(filter);

    // Also include approved pre-registration roster allocations reserving capacity
    const rosterFilter = {
        doorNumber: cleanRoom,
        admissionStatus: "APPROVED",
        registrationStatus: { $ne: "REGISTERED" }
    };
    if (excludeStudentId) {
        rosterFilter.userId = { $ne: excludeStudentId };
    }
    const rosterCount = await StudentRoster.countDocuments(rosterFilter);
    const count = studentCount + rosterCount;

    if (count >= MAX_STUDENTS_PER_ROOM) {
        return {
            allowed: false,
            currentCount: count,
            maxCapacity: MAX_STUDENTS_PER_ROOM,
            availablePlaces: 0,
            message: `Room ${cleanRoom} has reached its maximum capacity of ${MAX_STUDENTS_PER_ROOM} students (currently ${count}/${MAX_STUDENTS_PER_ROOM}).`
        };
    }

    return {
        allowed: true,
        currentCount: count,
        maxCapacity: MAX_STUDENTS_PER_ROOM,
        availablePlaces: MAX_STUDENTS_PER_ROOM - count
    };
}

/**
 * Atomically reserve a room slot for an approved roster entry.
 * Prevents over-capacity (MAX_STUDENTS_PER_ROOM = 2) under high concurrency.
 * Safe for standalone MongoDB (uses atomic single-document findOneAndUpdate).
 */
async function atomicReserveRoomRoster({ roomNumber, rosterId }) {
    if (!roomNumber) return { success: false, message: "Room number required" };
    const cleanRoom = String(roomNumber).trim();
    if (!isValidRoom(cleanRoom)) {
        return { success: false, message: `Room ${cleanRoom} is not a valid room (101–509)` };
    }

    // Ensure RoomOccupancy tracking document exists
    await RoomOccupancy.updateOne(
        { roomNumber: cleanRoom },
        { $setOnInsert: { roomNumber: cleanRoom, occupantCount: 0, occupants: [], rosterReservations: [], isOverCapacity: false } },
        { upsert: true }
    );

    // If this roster entry already has a reservation in this room, it's idempotent
    const existing = await RoomOccupancy.findOne({ roomNumber: cleanRoom, rosterReservations: rosterId });
    if (existing) {
        return { success: true, alreadyReserved: true, doc: existing };
    }

    // Atomic conditional reservation:
    // Only increment and add rosterId if total occupantCount < MAX_STUDENTS_PER_ROOM
    const reserved = await RoomOccupancy.findOneAndUpdate(
        {
            roomNumber: cleanRoom,
            rosterReservations: { $ne: rosterId },
            occupantCount: { $lt: MAX_STUDENTS_PER_ROOM }
        },
        {
            $addToSet: { rosterReservations: rosterId },
            $inc: { occupantCount: 1 },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!reserved) {
        return {
            success: false,
            message: `Room ${cleanRoom} has reached its maximum capacity of ${MAX_STUDENTS_PER_ROOM} students.`
        };
    }

    return { success: true, doc: reserved };
}

/**
 * Atomically release a room slot previously reserved by an approved roster entry
 * (e.g. on revocation, rejection, or room reassignment).
 */
async function atomicReleaseRoomRoster({ roomNumber, rosterId }) {
    if (!roomNumber || !rosterId) return { success: false };
    const cleanRoom = String(roomNumber).trim();

    const released = await RoomOccupancy.findOneAndUpdate(
        {
            roomNumber: cleanRoom,
            rosterReservations: rosterId
        },
        {
            $pull: { rosterReservations: rosterId },
            $inc: { occupantCount: -1 },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    return { success: !!released, doc: released };
}

/**
 * Atomically convert a roster reservation into a registered student occupant.
 * Pulls from rosterReservations and pushes to occupants in a single atomic update.
 * Crucially: keeps occupantCount identical, preventing double-counting or temporary release races.
 */
async function atomicConvertRosterToRegistered({ roomNumber, rosterId, studentId }) {
    if (!roomNumber || !studentId) return { success: false };
    const cleanRoom = String(roomNumber).trim();

    // Ensure document exists
    await RoomOccupancy.updateOne(
        { roomNumber: cleanRoom },
        { $setOnInsert: { roomNumber: cleanRoom, occupantCount: 0, occupants: [], rosterReservations: [], isOverCapacity: false } },
        { upsert: true }
    );

    // If rosterId was reserved, convert it atomically
    if (rosterId) {
        const converted = await RoomOccupancy.findOneAndUpdate(
            {
                roomNumber: cleanRoom,
                rosterReservations: rosterId
            },
            {
                $pull: { rosterReservations: rosterId },
                $addToSet: { occupants: studentId },
                $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (converted) {
            return { success: true, doc: converted, mode: "CONVERTED" };
        }
    }

    // If not found in rosterReservations (e.g. direct registration), check if already occupant
    const alreadyOccupant = await RoomOccupancy.findOne({ roomNumber: cleanRoom, occupants: studentId });
    if (alreadyOccupant) {
        return { success: true, doc: alreadyOccupant, mode: "EXISTING" };
    }

    // Atomically reserve a fresh slot for this student
    const assigned = await RoomOccupancy.findOneAndUpdate(
        {
            roomNumber: cleanRoom,
            occupants: { $ne: studentId },
            occupantCount: { $lt: MAX_STUDENTS_PER_ROOM }
        },
        {
            $addToSet: { occupants: studentId },
            $inc: { occupantCount: 1 },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!assigned) {
        return {
            success: false,
            message: `Room ${cleanRoom} has reached its maximum capacity of ${MAX_STUDENTS_PER_ROOM} students.`
        };
    }

    return { success: true, doc: assigned, mode: "ASSIGNED" };
}

/**
 * Concurrency-safe atomic room reservation and assignment.
 * Guarantees that at most MAX_STUDENTS_PER_ROOM (2) students can occupy targetRoom.
 *
 * @param {Object} params
 * @param {ObjectId|string} params.studentId
 * @param {string} params.newRoom
 * @param {string} [params.previousRoom]
 * @param {string} [params.adminName]
 * @param {string} [params.reason]
 * @returns {Promise<{ success: boolean, student: Object, roomHistory: Array }>}
 */
async function assignStudentRoomAtomic({ studentId, newRoom, previousRoom, adminName = "System", reason = "Room assignment" }) {
    if (!newRoom) {
        throw new Error("Target room number is required");
    }

    const cleanRoom = String(newRoom).trim();
    if (!isValidRoom(cleanRoom)) {
        throw new Error(`Room ${cleanRoom} is not a valid room in the 77-room inventory (101–509)`);
    }

    const student = await Student.findOne({ _id: studentId, role: "STUDENT" });
    if (!student) {
        throw new Error("Student not found");
    }

    const currentRoom = student.doorNumber ? String(student.doorNumber).trim() : null;
    const fromRoom = previousRoom !== undefined ? (previousRoom ? String(previousRoom).trim() : null) : currentRoom;

    // If student is already assigned to this room, no change needed
    if (currentRoom === cleanRoom) {
        return { success: true, student, roomHistory: student.roomHistory, unchanged: true };
    }

    // Ensure RoomOccupancy tracking document exists
    await RoomOccupancy.updateOne(
        { roomNumber: cleanRoom },
        { $setOnInsert: { roomNumber: cleanRoom, occupantCount: 0, occupants: [], isOverCapacity: false } },
        { upsert: true }
    );

    // ATOMIC RESERVATION STEP:
    // Atomically reserve a slot in cleanRoom ONLY IF occupantCount < MAX_STUDENTS_PER_ROOM (2)
    // and this student is not already listed as an occupant.
    const reservation = await RoomOccupancy.findOneAndUpdate(
        {
            roomNumber: cleanRoom,
            occupants: { $ne: student._id },
            occupantCount: { $lt: MAX_STUDENTS_PER_ROOM }
        },
        {
            $addToSet: { occupants: student._id },
            $inc: { occupantCount: 1 },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!reservation) {
        // Read current count to provide precise diagnostic message
        const currentDoc = await RoomOccupancy.findOne({ roomNumber: cleanRoom });
        const count = currentDoc ? currentDoc.occupantCount : await Student.countDocuments({ doorNumber: cleanRoom, role: "STUDENT" });
        throw new Error(`Room ${cleanRoom} has reached its maximum capacity of ${MAX_STUDENTS_PER_ROOM} students (currently ${count}/${MAX_STUDENTS_PER_ROOM}).`);
    }

    // Step 2: Update student record with roomHistory
    try {
        const prevRoomLabel = fromRoom || "Unassigned";
        student.roomHistory.push({
            previousRoom: prevRoomLabel,
            newRoom: cleanRoom,
            changedBy: adminName,
            reason: reason.trim(),
            changedAt: new Date()
        });
        student.doorNumber = cleanRoom;
        await student.save();
    } catch (saveErr) {
        // Rollback atomic reservation on failure
        await RoomOccupancy.findOneAndUpdate(
            { roomNumber: cleanRoom, occupants: student._id },
            {
                $pull: { occupants: student._id },
                $inc: { occupantCount: -1 }
            }
        );
        throw saveErr;
    }

    // Step 3: Release previous room slot if student moved from a valid room
    if (fromRoom && isValidRoom(fromRoom) && fromRoom !== cleanRoom) {
        await RoomOccupancy.findOneAndUpdate(
            { roomNumber: fromRoom, occupants: student._id },
            {
                $pull: { occupants: student._id },
                $inc: { occupantCount: -1 },
                $set: { updatedAt: new Date() }
            }
        );
    }

    return { success: true, student, roomHistory: student.roomHistory };
}

/**
 * Calculate projected occupancy across all 77 rooms for a proposed batch of CSV records.
 * Accurately tracks additions, removals, and prevents double-counting existing occupants.
 */
function calculateBatchProjections(rows, existingStudents) {
    const studentMapByPRN = new Map();
    const existingRoomOccupants = {}; // room -> Set of PRNs
    ALL_ROOMS.forEach(r => {
        existingRoomOccupants[r] = new Set();
    });

    existingStudents.forEach(s => {
        if (s.prn) studentMapByPRN.set(s.prn.trim().toLowerCase(), s);
        const rm = s.doorNumber ? String(s.doorNumber).trim() : null;
        if (rm && isValidRoom(rm)) {
            existingRoomOccupants[rm].add(s.prn.trim().toLowerCase());
        }
    });

    const projectedRoomOccupants = {};
    const roomAdditions = {};
    const roomRemovals = {};
    ALL_ROOMS.forEach(r => {
        projectedRoomOccupants[r] = new Set(existingRoomOccupants[r]);
        roomAdditions[r] = 0;
        roomRemovals[r] = 0;
    });

    // Track simulated movements
    rows.forEach(row => {
        const rawPRN = String(row.PRN || row.prn || "").trim().toLowerCase();
        const rawRoom = String(row.Room || row.room || row.doorNumber || "").trim();
        if (rawPRN && rawRoom && isValidRoom(rawRoom)) {
            const student = studentMapByPRN.get(rawPRN);
            if (student) {
                const currentRoom = student.doorNumber ? String(student.doorNumber).trim() : null;
                if (currentRoom && currentRoom !== rawRoom && isValidRoom(currentRoom)) {
                    // Moving out of current room
                    projectedRoomOccupants[currentRoom].delete(rawPRN);
                    roomRemovals[currentRoom] = (roomRemovals[currentRoom] || 0) + 1;
                }
                if (currentRoom !== rawRoom) {
                    // Moving into target room
                    projectedRoomOccupants[rawRoom].add(rawPRN);
                    roomAdditions[rawRoom] = (roomAdditions[rawRoom] || 0) + 1;
                } else {
                    // Retaining existing room (no double count)
                    projectedRoomOccupants[rawRoom].add(rawPRN);
                }
            }
        }
    });

    const roomProjections = {};
    const conflictingRooms = new Map(); // Rooms where this CSV creates or increases over-capacity
    const allOverCapacityRooms = new Map();

    ALL_ROOMS.forEach(r => {
        const existCount = existingRoomOccupants[r].size;
        const projCount = projectedRoomOccupants[r].size;
        const exceeds = projCount > MAX_STUDENTS_PER_ROOM;
        const additions = roomAdditions[r] || 0;
        const removals = roomRemovals[r] || 0;

        const proj = {
            roomNumber: r,
            existingOccupancy: existCount,
            proposedAdditions: additions,
            proposedRemovals: removals,
            projectedOccupancy: projCount,
            maxCapacity: MAX_STUDENTS_PER_ROOM,
            exceedsLimit: exceeds,
            isCSVConflict: additions > 0 && exceeds
        };
        roomProjections[r] = proj;

        if (exceeds) {
            allOverCapacityRooms.set(r, proj);
            if (additions > 0) {
                conflictingRooms.set(r, proj);
            }
        }
    });

    return {
        roomProjections,
        overCapacityRooms: conflictingRooms,
        allOverCapacityRooms,
        isBatchValid: conflictingRooms.size === 0
    };
}

module.exports = {
    syncRoomOccupancy,
    checkRoomCapacity,
    assignStudentRoomAtomic,
    atomicReserveRoomRoster,
    atomicReleaseRoomRoster,
    atomicConvertRosterToRegistered,
    calculateBatchProjections
};
