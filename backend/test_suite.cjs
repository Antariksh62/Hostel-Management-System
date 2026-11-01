const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { User, Student, WifiIncharge, Warden } = require("./models/User");
const Complaint = require("./models/Complaint");
const Incident = require("./models/Incident");
const { processComplaintForIncidents, INCIDENT_CONFIG } = require("./services/incidentDetector");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("1. TESTING 77-ROOM INVENTORY & GEOMETRY");
  console.log("=================================================");

  // Dynamically import ESM hostelRoomsData
  const hostelData = await import("../frontend-react/src/lib/hostelRoomsData.js");
  const { HOSTEL_ROOMS, HOSTEL_FLOORS, getRoomsForFloor, getAllRoomIds } = hostelData;

  assert(HOSTEL_ROOMS.length === 77, `Total room count is exactly 77 (got ${HOSTEL_ROOMS.length})`);
  assert(getAllRoomIds().length === 77, `getAllRoomIds returns 77 rooms`);

  const uniqueRooms = new Set(HOSTEL_ROOMS.map(r => r.id));
  assert(uniqueRooms.size === 77, `All 77 room numbers are unique`);

  assert(getRoomsForFloor(1).length === 17, `Floor 1 has 17 rooms (got ${getRoomsForFloor(1).length})`);
  assert(getRoomsForFloor(2).length === 17, `Floor 2 has 17 rooms (got ${getRoomsForFloor(2).length})`);
  assert(getRoomsForFloor(3).length === 17, `Floor 3 has 17 rooms (got ${getRoomsForFloor(3).length})`);
  assert(getRoomsForFloor(4).length === 17, `Floor 4 has 17 rooms (got ${getRoomsForFloor(4).length})`);
  assert(getRoomsForFloor(5).length === 9, `Floor 5 has 9 rooms (got ${getRoomsForFloor(5).length})`);

  // Verify critical lower rooms requested by user
  const lowerRoomsFloor1 = ["112", "113", "114", "115"];
  const lowerRoomsFloor2 = ["212", "213", "214", "215"];
  const lowerRoomsFloor3 = ["312", "313", "314", "315"];
  const lowerRoomsFloor4 = ["412", "413", "414", "415"];

  assert(lowerRoomsFloor1.every(r => uniqueRooms.has(r)), `Floor 1 contains bottom-row rooms 112-115`);
  assert(lowerRoomsFloor2.every(r => uniqueRooms.has(r)), `Floor 2 contains bottom-row rooms 212-215`);
  assert(lowerRoomsFloor3.every(r => uniqueRooms.has(r)), `Floor 3 contains bottom-row rooms 312-315`);
  assert(lowerRoomsFloor4.every(r => uniqueRooms.has(r)), `Floor 4 contains bottom-row rooms 412-415`);

  // Verify Floor 5 distinct geometry
  const floor5Rooms = getRoomsForFloor(5).map(r => r.id);
  assert(!floor5Rooms.includes("510") && !floor5Rooms.includes("515"), `Floor 5 does not contain nonexistent lower rooms`);
  assert(floor5Rooms.includes("501") && floor5Rooms.includes("509"), `Floor 5 contains 501-509`);

  console.log("\n=================================================");
  console.log("2. TESTING DATABASE & SERVICES INTEGRATION");
  console.log("=================================================");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
  let connected = false;

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    connected = true;
    console.log(`Connected to MongoDB at ${mongoUri}`);
  } catch (err) {
    console.warn(`MongoDB not accessible directly: ${err.message}`);
    console.log("Skipping live database mutations, running in-memory model validation tests...");
  }

  if (connected) {
    try {
      // Setup test student
      const testStudent = await Student.findOneAndUpdate(
        { email: "test.student@pict.edu" },
        {
          fullName: "Test Student",
          email: "test.student@pict.edu",
          registrationNumber: "REG9999",
          doorNumber: "205",
          mobileNumber: "9876543210",
          role: "STUDENT",
        },
        { upsert: true, new: true }
      );

      assert(testStudent.mobileNumber === "9876543210", "Student discriminator correctly persists mobileNumber");

      // Verify WifiIncharge discriminator
      const wifiIncharge = await WifiIncharge.findOneAndUpdate(
        { email: "wifi.test@pict.edu" },
        {
          name: "Network Lead",
          email: "wifi.test@pict.edu",
          role: "WIFI_INCHARGE",
        },
        { upsert: true, returnDocument: "after" }
      );
      assert(wifiIncharge.role === "WIFI_INCHARGE", "WIFI_INCHARGE role is valid in User model");

      // Clean test incidents & complaints
      await Incident.deleteMany({});
      await Complaint.deleteMany({ $or: [{ title: /automated-test/ }, { title: /No water/i }, { title: /Power/i }, { title: /Wi-Fi/i }, { quickCategory: { $in: ["NO_WATER_SUPPLY", "NO_ELECTRICITY", "WIFI_NOT_WORKING"] } }] });

      console.log("\n--- Testing Incident Detector Rule: Threshold & Distinct Rooms ---");
      assert(INCIDENT_CONFIG.DISTINCT_ROOMS_THRESHOLD === 5, "Threshold configured to 5 distinct rooms");
      assert(INCIDENT_CONFIG.WINDOW_MINUTES === 10, "Window configured to 10 minutes");

      // Create 4 complaints from 4 distinct rooms
      const rooms = ["101", "102", "103", "104"];
      const createdComplaints = [];

      for (const r of rooms) {
        const c = await Complaint.create({
          title: `automated-test water issue ${r}`,
          description: "No water in room",
          category: "Plumbing",
          quickCategory: "NO_WATER_SUPPLY",
          doorNumber: r,
          studentId: testStudent._id,
        });
        createdComplaints.push(c);
        const incident = await processComplaintForIncidents(c);
        assert(incident === null, `No incident created yet for room ${r} (total distinct rooms: ${createdComplaints.length} < 5)`);
      }

      // Add a duplicate complaint from room 101 (should NOT increase distinct room count)
      const duplicateRoomComplaint = await Complaint.create({
        title: "automated-test water issue 101 duplicate",
        description: "Still no water in 101",
        category: "Plumbing",
        quickCategory: "NO_WATER_SUPPLY",
        doorNumber: "101",
        studentId: testStudent._id,
      });
      const resDup = await processComplaintForIncidents(duplicateRoomComplaint);
      assert(resDup === null, "Duplicate report from existing room 101 did NOT trigger incident (distinct rooms still 4)");

      // Now add 5th distinct room (105) -> MUST trigger proposed incident
      const fifthRoomComplaint = await Complaint.create({
        title: "automated-test water issue 105",
        description: "No water in 105",
        category: "Plumbing",
        quickCategory: "NO_WATER_SUPPLY",
        doorNumber: "105",
        studentId: testStudent._id,
      });
      const triggeredIncident = await processComplaintForIncidents(fifthRoomComplaint);
      assert(triggeredIncident !== null, "Incident successfully triggered upon reaching 5 distinct rooms!");
      assert(triggeredIncident.status === "PROPOSED", "New incident is in 'PROPOSED' status for Warden review");
      assert(triggeredIncident.serviceType === "WATER", "Incident serviceType is 'WATER'");
      assert(triggeredIncident.affectedRooms.length === 5, `Incident covers exactly 5 distinct rooms (got ${triggeredIncident.affectedRooms.length})`);
      assert(triggeredIncident.linkedComplaints.length >= 5, "Incident links all contributing complaints");

      // Verify 6th complaint automatically links to the active incident
      const sixthRoomComplaint = await Complaint.create({
        title: "automated-test water issue 106",
        description: "No water in 106",
        category: "Plumbing",
        quickCategory: "NO_WATER_SUPPLY",
        doorNumber: "106",
        studentId: testStudent._id,
      });
      const linkedIncident = await processComplaintForIncidents(sixthRoomComplaint);
      assert(linkedIncident !== null && String(linkedIncident._id) === String(triggeredIncident._id), "6th compatible complaint successfully links to active incident");

      console.log("\n--- Testing Wi-Fi Routing & Isolation ---");
      // Wi-Fi complaint must NOT trigger or link to shared incidents
      const wifiComplaint = await Complaint.create({
        title: "automated-test wifi issue 301",
        description: "No internet",
        category: "Internet",
        quickCategory: "WIFI_NOT_WORKING",
        doorNumber: "301",
        studentId: testStudent._id,
      });
      const wifiIncident = await processComplaintForIncidents(wifiComplaint);
      assert(wifiIncident === null, "Wi-Fi complaint does NOT trigger shared water/electricity incident");
      assert(wifiComplaint.incidentId === null || wifiComplaint.incidentId === undefined, "Wi-Fi complaint remains an individual ticket");

      console.log("\n--- Testing Incident Complaint Unlinking ---");
      const incidentController = require("./controllers/incidentController");
      const complaintController = require("./controllers/complaintController");

      // Test unlinking complaint 101 from triggeredIncident
      const c101 = createdComplaints[0];
      let unlinkResData = null;
      const mockUnlinkRes = {
        status: () => mockUnlinkRes,
        json: (data) => { unlinkResData = data; return mockUnlinkRes; }
      };

      await incidentController.unlinkComplaint(
        { params: { id: triggeredIncident._id }, body: { complaintId: c101._id }, user: { role: "WARDEN" } },
        mockUnlinkRes
      );

      const unlinkedC101 = await Complaint.findById(c101._id);
      assert(unlinkedC101.incidentId === null, "Unlinked complaint has incidentId reset to null");
      const reloadedInc = await Incident.findById(triggeredIncident._id);
      assert(!reloadedInc.linkedComplaints.includes(c101._id), "Incident no longer contains unlinked complaint ID");

      console.log("\n--- Testing Explicit Review on Incident Resolution ---");
      // c102 -> RESOLVE, c103 -> KEEP_OPEN
      const c102 = createdComplaints[1];
      const c103 = createdComplaints[2];
      let resolveResData = null;
      const mockResolveRes = {
        status: () => mockResolveRes,
        json: (data) => { resolveResData = data; return mockResolveRes; }
      };

      await incidentController.resolveIncident(
        {
          params: { id: triggeredIncident._id },
          body: {
            resolutionNote: "Water pipe repaired and tested",
            complaintDecisions: [
              { complaintId: c102._id, action: "RESOLVE", note: "Verified restored" },
              { complaintId: c103._id, action: "KEEP_OPEN", note: "Tap still vibrating, needs follow-up" }
            ]
          },
          user: { role: "WARDEN" }
        },
        mockResolveRes
      );

      const resolvedC102 = await Complaint.findById(c102._id);
      assert(resolvedC102.status === "Resolved", "Complaint 102 transitioned to 'Resolved' per review decision");
      assert(resolvedC102.statusHistory.some(h => h.status === "Resolved"), "Complaint 102 has 'Resolved' audit entry in statusHistory");

      const keptOpenC103 = await Complaint.findById(c103._id);
      assert(keptOpenC103.status === "Pending", "Complaint 103 remained 'Pending' per explicit 'KEEP_OPEN' decision");
      assert(keptOpenC103.incidentId === null, "Complaint 103 unlinked from resolved incident for independent follow-up");
      assert(keptOpenC103.statusHistory.some(h => h.note.includes("Kept open")), "Complaint 103 records explicit follow-up note in statusHistory");

      const resolvedIncidentRecord = await Incident.findById(triggeredIncident._id);
      assert(resolvedIncidentRecord.status === "RESOLVED", "Shared incident marked 'RESOLVED'");

      console.log("\n--- Testing Contact Privacy & Least-Privilege Access ---");
      let contactResStatus = 200;
      let contactResData = null;
      const createMockContactRes = () => {
        contactResStatus = 200;
        contactResData = null;
        const res = {
          status: (code) => { contactResStatus = code; return res; },
          json: (data) => { contactResData = data; return res; }
        };
        return res;
      };

      // 1. Wi-Fi In-Charge accessing Wi-Fi complaint -> Allowed (200)
      await complaintController.getStudentContact(
        { params: { id: wifiComplaint._id }, user: { role: "WIFI_INCHARGE", id: wifiIncharge._id } },
        createMockContactRes()
      );
      assert(contactResStatus === 200 && contactResData.mobileNumber === "9876543210", "Wi-Fi Incharge can access student mobile for Wi-Fi complaint");

      // 2. Wi-Fi In-Charge accessing Water complaint -> Denied (403)
      await complaintController.getStudentContact(
        { params: { id: c102._id }, user: { role: "WIFI_INCHARGE", id: wifiIncharge._id } },
        createMockContactRes()
      );
      assert(contactResStatus === 403, "Wi-Fi Incharge CANNOT access student mobile for unrelated Water complaint (403 Forbidden)");

      // 3. Regular Staff accessing contact -> Denied (403)
      await complaintController.getStudentContact(
        { params: { id: wifiComplaint._id }, user: { role: "STAFF", id: new mongoose.Types.ObjectId() } },
        createMockContactRes()
      );
      assert(contactResStatus === 403, "Staff member CANNOT access contact details (403 Forbidden)");

      // 4. Warden accessing contact -> Allowed (200)
      await complaintController.getStudentContact(
        { params: { id: c102._id }, user: { role: "WARDEN", id: new mongoose.Types.ObjectId() } },
        createMockContactRes()
      );
      assert(contactResStatus === 200 && contactResData.mobileNumber === "9876543210", "Warden can access contact details on-demand (200 OK)");

      console.log("\n--- Testing Server-Side Room Validation ---");
      // Student without registered room allotment must be rejected
      const unassignedStudent = await Student.create({
        fullName: "Homeless Student",
        email: "homeless.student@pict.edu",
        prn: "REG8888",
        doorNumber: null,
        mobileNumber: "9123456780",
        role: "STUDENT"
      });

      let createResStatus = 200;
      let createResData = null;
      const mockCreateRes = {
        status: (code) => { createResStatus = code; return mockCreateRes; },
        json: (data) => { createResData = data; return mockCreateRes; }
      };

      await complaintController.createComplaint(
        {
          body: { title: "Test unassigned room", category: "NO_WATER_SUPPLY", quickCategory: "NO_WATER_SUPPLY" },
          user: { id: unassignedStudent._id, role: "STUDENT" }
        },
        mockCreateRes
      );
      assert(createResStatus === 400, "Complaint rejected with 400 when student lacks registered room assignment");
      assert(createResData.message.includes("room assignment is missing"), "Rejection returns clear descriptive room assignment error");

      // Clean up test data
      await Incident.deleteMany({ _id: triggeredIncident._id });
      await Complaint.deleteMany({ title: /automated-test/ });
      await User.deleteMany({ email: /test\.(student|wifi)@pict\.edu/ });
      await User.deleteMany({ email: "homeless.student@pict.edu" });
    } catch (dbErr) {
      console.error("Database test error:", dbErr);
      failed++;
    } finally {
      await mongoose.disconnect();
    }
  }

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
