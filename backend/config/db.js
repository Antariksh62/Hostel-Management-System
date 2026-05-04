const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb+srv://vedant_10612:pict123@cluster0.rh4efgj.mongodb.net/hostelDB?retryWrites=true&w=majority");
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.log("❌ DB Error:", err);
        process.exit(1);
    }
};

module.exports = connectDB;
