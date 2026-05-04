const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("./models/User");
const Complaint = require("./models/Complaint");

const MONGO_URI = "mongodb://127.0.0.1:27017/hostelDB";

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("DB connected");

    // Clear old data
    await User.deleteMany();
    await Complaint.deleteMany();

    // Hash password
    const hashedPassword = await bcrypt.hash("123456", 10);

    // Create users
    const users = await User.insertMany([
      { name: "John Doe", email: "student1@ms.pict.edu", password: hashedPassword, role: "STUDENT", profileComplete: true, fullName: "John Doe", rollNumber: "101", classDiv: "CE-A", year: "SY", doorNumber: "A-101" },
      { name: "Jane Smith", email: "student2@ms.pict.edu", password: hashedPassword, role: "STUDENT", profileComplete: true, fullName: "Jane Smith", rollNumber: "102", classDiv: "CE-A", year: "SY", doorNumber: "A-102" },
      { name: "Alice Johnson", email: "student3@ms.pict.edu", password: hashedPassword, role: "STUDENT", profileComplete: true, fullName: "Alice Johnson", rollNumber: "103", classDiv: "CE-A", year: "SY", doorNumber: "A-103" },

      { name: "Head Warden", email: "warden@test.com", password: hashedPassword, role: "WARDEN" },

      { name: "Mike Manager", email: "staff1@test.com", password: hashedPassword, role: "STAFF" },
      { name: "Bob Builder", email: "staff2@test.com", password: hashedPassword, role: "STAFF" },
      { name: "Tom Technician", email: "staff3@test.com", password: hashedPassword, role: "STAFF" }
    ]);

    const students = users.filter(u => u.role === "STUDENT");
    const staff = users.filter(u => u.role === "STAFF");

    // Create complaints
    await Complaint.insertMany([
      {
        studentId: students[0]._id,
        title: "Broken Fan in Room 204",
        description: "Fan is noisy and slow",
        category: "Electrical"
      },
      {
        studentId: students[1]._id,
        title: "Water Leakage",
        description: "Shower leaking continuously",
        category: "Plumbing",
        status: "In Progress",
        assignedTo: staff[0]._id
      },
      {
        studentId: students[2]._id,
        title: "No Internet",
        description: "WiFi not working",
        category: "Network"
      },
      {
        studentId: students[0]._id,
        title: "Broken Window",
        description: "Window latch broken",
        category: "Carpentry"
      },
      {
        studentId: students[1]._id,
        title: "Blocked Sink",
        description: "Water not draining",
        category: "Plumbing",
        status: "Resolved",
        assignedTo: staff[1]._id
      },
      {
        studentId: students[2]._id,
        title: "Tube Light Issue",
        description: "Light flickering",
        category: "Electrical",
        status: "In Progress",
        assignedTo: staff[2]._id
      },
      {
        studentId: students[0]._id,
        title: "AC Not Cooling",
        description: "AC blowing warm air",
        category: "Appliance",   // ✅ now valid
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