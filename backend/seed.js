const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("./models/User");
const Complaint = require("./models/Complaint");

const MONGO_URI = "mongodb://127.0.0.1:27017/hostelDB";

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("DB connected");

    // 🔥 Clear old data
    await User.deleteMany();
    await Complaint.deleteMany();

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash("123456", 10);

    // 👥 Create users
    const users = await User.insertMany([
      { name: "John Doe", email: "student1@test.com", password: hashedPassword, role: "STUDENT" },
      { name: "Jane Smith", email: "student2@test.com", password: hashedPassword, role: "STUDENT" },
      { name: "Alice Johnson", email: "student3@test.com", password: hashedPassword, role: "STUDENT" },

      { name: "Head Warden", email: "warden@test.com", password: hashedPassword, role: "WARDEN" },

      { name: "Mike Manager", email: "staff1@test.com", password: hashedPassword, role: "STAFF" },
      { name: "Bob Builder", email: "staff2@test.com", password: hashedPassword, role: "STAFF" },
      { name: "Tom Technician", email: "staff3@test.com", password: hashedPassword, role: "STAFF" }
    ]);

    // 🎯 Separate users by role
    const students = users.filter(u => u.role === "STUDENT");
    const staff = users.filter(u => u.role === "STAFF");

    // 📝 Create complaints
    await Complaint.insertMany([
      {
        studentId: students[0]._id,
        title: "Broken Fan in Room 204",
        description: "The ceiling fan is making weird noises and constantly slowing down.",
        category: "Electrical",
        status: "Pending",
        assignedTo: null
      },
      {
        studentId: students[1]._id,
        title: "Water Leakage in Bathroom 3",
        description: "The shower head keeps dripping continuously since yesterday.",
        category: "Plumbing",
        status: "In Progress",
        assignedTo: staff[0]._id
      },
      {
        studentId: students[2]._id,
        title: "No Internet Connection",
        description: "The router on the 2nd floor is completely dead.",
        category: "Network",
        status: "Pending",
        assignedTo: null
      },
      {
        studentId: students[0]._id,
        title: "Broken Window Latch",
        description: "The window on the left side of the room won't lock properly.",
        category: "Carpentry",
        status: "Pending",
        assignedTo: null
      },
      {
        studentId: students[1]._id,
        title: "Blocked Sink",
        description: "Water isn't draining from the main washbasin in the corridor.",
        category: "Plumbing",
        status: "Resolved",
        assignedTo: staff[1]._id
      },
      {
        studentId: students[2]._id,
        title: "Dim Tube Light",
        description: "The main fluorescent light in the room is constantly flickering.",
        category: "Electrical",
        status: "In Progress",
        assignedTo: staff[2]._id
      },
      {
        studentId: students[0]._id,
        title: "AC Not Cooling",
        description: "The air conditioner turns on but blows out warm air.",
        category: "Appliance",
        status: "Resolved",
        assignedTo: staff[0]._id
      }
    ]);

    console.log("Seeding done ✅");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();