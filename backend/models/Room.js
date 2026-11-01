const mongoose = require("mongoose");
const { MAX_STUDENTS_PER_ROOM } = require("../utils/hostelRooms");

const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        default: MAX_STUDENTS_PER_ROOM,
        max: [MAX_STUDENTS_PER_ROOM, `Maximum allowed capacity is ${MAX_STUDENTS_PER_ROOM}`]
    },
    occupants: [
        {
            name: String
        }
    ]
}, {
    timestamps: true
});

module.exports = mongoose.model("Room", roomSchema);
