const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const { protect, authorize } = require("../middleware/authMiddleware");

// ================= CREATE ROOM =================
router.post("/create", async (req, res) => {
try {
const { roomNumber, capacity } = req.body;


    const room = new Room({
        roomNumber,
        capacity
    });

    await room.save();

    res.json(room);

} catch (err) {
    res.status(500).json({ error: err.message });
}


});

// ================= ALLOCATE ROOM =================
router.post("/", async (req, res) => {
try {
const { name, room } = req.body;


    let existingRoom = await Room.findOne({ roomNumber: room });

    // If room doesn't exist → create it
    if (!existingRoom) {
        existingRoom = new Room({
            roomNumber: room,
            occupants: [{ name }]
        });
    } else {
        // Check capacity
        if (existingRoom.occupants.length >= existingRoom.capacity) {
            return res.status(400).json({ msg: "Room is full" });
        }

        existingRoom.occupants.push({ name });
    }

    await existingRoom.save();

    res.json(existingRoom);

} catch (err) {
    res.status(500).json({ error: err.message });
}


});

// ================= GET ALL ROOMS =================
router.get("/", async (req, res) => {
try {
const rooms = await Room.find();
res.json(rooms);
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// ================= DELETE ROOM =================
router.delete("/:id", async (req, res) => {
try {
await Room.findByIdAndDelete(req.params.id);
res.json({ msg: "Room deleted" });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

module.exports = router;
