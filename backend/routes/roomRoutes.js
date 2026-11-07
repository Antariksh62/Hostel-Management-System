const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const { Student } = require("../models/User");
const { authMiddleware, wardenMiddleware, wardenOrStaffMiddleware } = require("../middleware/auth");
const { roomLimiter } = require("../middleware/rateLimiter");
const { isValidRoom, MAX_STUDENTS_PER_ROOM } = require("../utils/hostelRooms");
const { checkRoomCapacity, assignStudentRoomAtomic } = require("../services/roomOccupancyService");

// ================= CREATE ROOM =================
router.post("/create", authMiddleware, wardenMiddleware, async (req, res) => {
    try {
        const { roomNumber, capacity } = req.body;
        const cleanRoom = String(roomNumber || "").trim();

        if (!cleanRoom || !isValidRoom(cleanRoom)) {
            return res.status(400).json({ message: `Room ${cleanRoom} is not a valid room in the 77-room inventory (101–509)` });
        }

        const existing = await Room.findOne({ roomNumber: cleanRoom });
        if (existing) {
            return res.status(400).json({ message: `Room ${cleanRoom} already exists in registry` });
        }

        const enforcedCapacity = Math.min(Number(capacity) || MAX_STUDENTS_PER_ROOM, MAX_STUDENTS_PER_ROOM);

        const room = new Room({
            roomNumber: cleanRoom,
            capacity: enforcedCapacity,
            occupants: []
        });

        await room.save();
        res.status(201).json(room);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= ALLOCATE ROOM =================
router.post("/", authMiddleware, wardenMiddleware, roomLimiter, async (req, res) => {
    try {
        const { name, room } = req.body;
        if (!name || !room) {
            return res.status(400).json({ message: "Student name/identifier and target room are required" });
        }

        const cleanRoom = String(room).trim();
        if (!isValidRoom(cleanRoom)) {
            return res.status(400).json({ message: `Room ${cleanRoom} is not a valid room in the 77-room inventory (101–509)` });
        }

        // Locate student
        const student = await Student.findOne({
            $or: [
                { name: String(name).trim() },
                { fullName: String(name).trim() },
                { prn: String(name).trim() }
            ],
            role: "STUDENT"
        });

        if (!student) {
            return res.status(404).json({ message: `Student '${name}' not found` });
        }

        // Strictly enforce MAX_STUDENTS_PER_ROOM = 2 via authoritative service
        const capacityCheck = await checkRoomCapacity(cleanRoom, student._id);
        if (!capacityCheck.allowed) {
            return res.status(400).json({
                message: capacityCheck.message,
                currentCount: capacityCheck.currentCount,
                maxCapacity: MAX_STUDENTS_PER_ROOM
            });
        }

        const adminName = req.user?.name || req.user?.email || "Administrator";

        // Concurrency-safe atomic assignment enforcing MAX_STUDENTS_PER_ROOM = 2
        await assignStudentRoomAtomic({
            studentId: student._id,
            newRoom: cleanRoom,
            previousRoom: student.doorNumber || null,
            adminName,
            reason: "Room assignment via /api/rooms"
        });

        // Sync legacy Room tracking document
        const currentOccupants = await Student.find({ doorNumber: cleanRoom, role: "STUDENT" }, "fullName name prn");
        const occupantsList = currentOccupants.map(s => ({ name: s.fullName || s.name || s.prn }));

        let legacyRoom = await Room.findOne({ roomNumber: cleanRoom });
        if (!legacyRoom) {
            legacyRoom = new Room({
                roomNumber: cleanRoom,
                capacity: MAX_STUDENTS_PER_ROOM,
                occupants: occupantsList
            });
        } else {
            legacyRoom.capacity = MAX_STUDENTS_PER_ROOM;
            legacyRoom.occupants = occupantsList;
        }

        await legacyRoom.save();
        res.json(legacyRoom);

    } catch (err) {
        const isClientError = err.message && (
            err.message.includes("capacity") ||
            err.message.includes("valid room") ||
            err.message.includes("required") ||
            err.message.includes("not found")
        );
        res.status(isClientError ? 400 : 500).json({
            message: err.message || "Failed to allocate room",
            error: err.message
        });
    }
});

// ================= GET ALL ROOMS =================
router.get("/", authMiddleware, async (req, res) => {
    try {
        const rooms = await Room.find();
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= DELETE ROOM =================
router.delete("/:id", authMiddleware, wardenMiddleware, async (req, res) => {
    return res.status(403).json({
        message: "Deleting rooms is disabled. The hostel operates with a fixed, immutable 77-room inventory (101-509)."
    });
});

module.exports = router;
