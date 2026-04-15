const Room = require("../models/Room");

// CREATE ROOM
exports.createRoom = async (req, res) => {
try {
const { roomNumber, capacity } = req.body;


    const room = new Room({ roomNumber, capacity });
    await room.save();

    res.json(room);
} catch (err) {
    res.status(500).json({ error: err.message });
}


};

// ALLOCATE ROOM
exports.allocateRoom = async (req, res) => {
try {
const { name, room } = req.body;


    let existingRoom = await Room.findOne({ roomNumber: room });

    if (!existingRoom) {
        existingRoom = new Room({
            roomNumber: room,
            occupants: [{ name }]
        });
    } else {
        if (existingRoom.occupants.length >= existingRoom.capacity) {
            return res.status(400).json({ msg: "Room full" });
        }
        existingRoom.occupants.push({ name });
    }

    await existingRoom.save();

    res.json(existingRoom);

} catch (err) {
    res.status(500).json({ error: err.message });
}


};

// GET ROOMS
exports.getRooms = async (req, res) => {
try {
const rooms = await Room.find();
res.json(rooms);
} catch (err) {
res.status(500).json({ error: err.message });
}
};
