const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/hostelDB');
    const Room = require('../backend/models/Room');
    const RoomOccupancy = require('../backend/models/RoomOccupancy');
    const { ALL_ROOMS } = require('../backend/utils/hostelRooms');

    const roomCount = await Room.countDocuments();
    const roCount = await RoomOccupancy.countDocuments();

    console.log('ALL_ROOMS constant length:', ALL_ROOMS.length);
    console.log('Room count in MongoDB:', roomCount);
    console.log('RoomOccupancy count in MongoDB:', roCount);

    const rooms = await Room.find({}, 'roomNumber capacity occupants').lean();
    console.log('First 3 rooms:', rooms.slice(0, 3));
    console.log('Last 3 rooms:', rooms.slice(-3));

    // Check if any room has invalid roomNumber
    const invalidRooms = rooms.filter(r => !ALL_ROOMS.includes(r.roomNumber));
    console.log('Invalid rooms outside 77 inventory:', invalidRooms.length);

    await mongoose.disconnect();
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
