const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
roomNumber: {
type: String,
required: true,
unique: true
},
capacity: {
type: Number,
default: 3
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
