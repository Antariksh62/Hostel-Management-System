const mongoose = require("mongoose");

const RoomOccupancySchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    occupantCount: {
        type: Number,
        default: 0
    },
    occupants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    rosterReservations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "StudentRoster"
    }],
    isOverCapacity: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const RoomOccupancy = mongoose.models.RoomOccupancy || mongoose.model("RoomOccupancy", RoomOccupancySchema);

module.exports = RoomOccupancy;

