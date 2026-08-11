const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Room = require("../models/Room");
const { User } = require("../models/User");
const { authMiddleware, wardenMiddleware, wardenOrStaffMiddleware } = require("../middleware/auth");
const { roomLimiter } = require("../middleware/rateLimiter");

// ================= CREATE ROOM =================
router.post("/create", authMiddleware, wardenOrStaffMiddleware, async (req, res) => {
    try {
        const { roomNumber, capacity } = req.body;

        const room = new Room({
            roomNumber: String(roomNumber),
            capacity
        });

        await room.save();

        res.json(room);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= ALLOCATE ROOM =================
router.post("/", authMiddleware, wardenOrStaffMiddleware, roomLimiter, async (req, res) => {
    let session = null;
    let isTransactionActive = false;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        isTransactionActive = true;
    } catch (e) {
        // Standalone MongoDB instance without replica set
        session = null;
        isTransactionActive = false;
    }

    try {
        const { name, room } = req.body;
        const opts = session ? { session } : {};

        let existingRoom = await Room.findOne({ roomNumber: String(room) }, null, opts);

        // If room doesn't exist → create it
        if (!existingRoom) {
            existingRoom = new Room({
                roomNumber: String(room),
                occupants: [{ name: String(name) }]
            });
        } else {
            // Check capacity
            if (existingRoom.occupants.length >= existingRoom.capacity) {
                if (isTransactionActive && session) {
                    await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({ msg: "Room is full" });
            }

            existingRoom.occupants.push({ name: String(name) });
        }

        await existingRoom.save(opts);

        // Update Student doorNumber safely
        const student = await User.findOne({ 
            $or: [{ name: String(name) }, { fullName: String(name) }],
            role: "STUDENT"
        }, null, opts);

        if (student) {
            student.doorNumber = String(room);
            await student.save(opts);
        }

        if (isTransactionActive && session) {
            await session.commitTransaction();
            session.endSession();
        }

        res.json(existingRoom);

    } catch (err) {
        if (isTransactionActive && session) {
            await session.abortTransaction();
            session.endSession();
        }
        res.status(500).json({ error: err.message });
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
    try {
        await Room.findByIdAndDelete(req.params.id);
        res.json({ msg: "Room deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
