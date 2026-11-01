const http = require("http");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");
const { User, Student, WifiIncharge, Warden } = require("./models/User");
const Complaint = require("./models/Complaint");
const Incident = require("./models/Incident");

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

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on("error", reject);
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runE2E() {
  console.log("=================================================");
  console.log("STARTING END-TO-END HTTP API VERIFICATION");
  console.log("=================================================");

  // Connect to DB for test fixture setup & cleanup
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");

  try {
    // 1. Authenticate as Warden
    console.log("\n--- Step 1: Warden Authentication & Service Heat Map ---");
    const wardenLoginRes = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { email: "warden@pict.edu", password: "Admin@123" }
    );

    assert(wardenLoginRes.status === 200, "Warden login returned HTTP 200");
    const wardenToken = wardenLoginRes.data.token;
    assert(!!wardenToken, "Warden JWT token received");

    // Fetch Heat Map
    const heatMapRes = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/services/heat-map",
      method: "GET",
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(heatMapRes.status === 200, "GET /api/services/heat-map returned HTTP 200");
    assert(heatMapRes.data.summary !== undefined, "Heat map response contains summary metrics");
    assert(heatMapRes.data.roomStats !== undefined, "Heat map response contains roomStats object");

    // 2. Authenticate as Wi-Fi In-Charge
    console.log("\n--- Step 2: Wi-Fi In-Charge Specialist Queue & Isolation ---");
    const wifiLoginRes = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { email: "wifi@pict.edu", password: "Admin@123" }
    );
    assert(wifiLoginRes.status === 200, "Wi-Fi In-Charge login returned HTTP 200");
    const wifiToken = wifiLoginRes.data.token;
    assert(wifiLoginRes.data.user.role === "WIFI_INCHARGE", "User role confirmed as WIFI_INCHARGE");

    // Query Wi-Fi Queue
    const wifiQueueRes = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/complaints/wifi/queue",
      method: "GET",
      headers: { Authorization: `Bearer ${wifiToken}` }
    });
    assert(wifiQueueRes.status === 200, "GET /api/complaints/wifi/queue returned HTTP 200");
    assert(Array.isArray(wifiQueueRes.data), "Wi-Fi queue returned an array of complaints");

    // 3. Setup student with room and test quick submissions
    console.log("\n--- Step 3: Student Quick Submissions & Duplicate Check ---");
    const testStudentPRN = "PRN_E2E_TEST";
    let student = await Student.findOneAndUpdate(
      { prn: testStudentPRN },
      {
        name: "Aakash Sharma",
        fullName: "Aakash Sharma",
        email: "aakash.test@pict.edu",
        prn: testStudentPRN,
        doorNumber: "205",
        mobileNumber: "9876543210",
        role: "STUDENT"
      },
      { upsert: true, returnDocument: "after" }
    );

    // Generate student auth token
    const jwt = require("jsonwebtoken");
    const studentToken = jwt.sign(
      { id: student._id, role: "STUDENT", email: student.email },
      process.env.JWT_SECRET || "hostel_pict_jwt_super_secret_2024",
      { expiresIn: "1h" }
    );

    // Pre-flight duplicate check (should be false initially)
    const dupCheck1 = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/complaints/check-duplicate?category=Plumbing&quickCategory=NO_WATER_SUPPLY",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(dupCheck1.status === 200, "GET /api/complaints/check-duplicate returned HTTP 200");
    assert(dupCheck1.data.hasDuplicate === false, "No duplicate detected prior to submission");

    // Submit quick complaint for Water
    const submitWaterRes = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/complaints",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${studentToken}`
        }
      },
      {
        title: "No water in room 205",
        description: "Predefined quick report for No water supply in room 205.",
        category: "Plumbing",
        quickCategory: "NO_WATER_SUPPLY"
      }
    );
    assert(submitWaterRes.status === 201, "Quick complaint submission returned HTTP 201 Created");
    const waterComplaintId = submitWaterRes.data.complaint._id;

    // Pre-flight duplicate check again (should be true now)
    const dupCheck2 = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/complaints/check-duplicate?category=Plumbing&quickCategory=NO_WATER_SUPPLY",
      method: "GET",
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(dupCheck2.data.hasDuplicate === true, "Duplicate detected after first submission");
    assert(dupCheck2.data.existingComplaint.id === waterComplaintId, "Existing complaint ID accurately referenced in duplicate warning");

    // Student can still submit another report regardless (non-blocking)
    const submitSecondWaterRes = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/complaints",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${studentToken}`
        }
      },
      {
        title: "No water in room 205 (second report)",
        description: "Still no water in room 205.",
        category: "Plumbing",
        quickCategory: "NO_WATER_SUPPLY"
      }
    );
    assert(submitSecondWaterRes.status === 201, "Second submission accepted with distinct HTTP 201 Created");
    assert(submitSecondWaterRes.data.complaint._id !== waterComplaintId, "Second submission has its own distinct complaint ID");

    // Submit Wi-Fi Complaint
    const submitWifiRes = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/complaints",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${studentToken}`
        }
      },
      {
        title: "Wi-Fi down in room 205",
        category: "Internet",
        quickCategory: "WIFI_NOT_WORKING"
      }
    );
    assert(submitWifiRes.status === 201, "Wi-Fi quick complaint created successfully");
    const wifiComplaintId = submitWifiRes.data.complaint._id;

    // 4. Contact Details On-Demand Privacy Verification
    console.log("\n--- Step 4: Contact Privacy & Security Verification ---");
    // Wi-Fi In-Charge on Wi-Fi complaint -> Allowed
    const wifiContactRes = await request({
      hostname: "localhost",
      port: 5000,
      path: `/api/complaints/${wifiComplaintId}/student-contact`,
      method: "GET",
      headers: { Authorization: `Bearer ${wifiToken}` }
    });
    assert(wifiContactRes.status === 200, "Wi-Fi In-Charge granted access to student contact for Wi-Fi issue");
    assert(wifiContactRes.data.mobileNumber === "9876543210", "Accurate student mobile number returned");

    // Wi-Fi In-Charge on Water complaint -> Denied (403)
    const deniedContactRes = await request({
      hostname: "localhost",
      port: 5000,
      path: `/api/complaints/${waterComplaintId}/student-contact`,
      method: "GET",
      headers: { Authorization: `Bearer ${wifiToken}` }
    });
    assert(deniedContactRes.status === 403, "Wi-Fi In-Charge strictly denied (403) access to student contact for Water issue");

    // Warden on Water complaint -> Allowed
    const wardenContactRes = await request({
      hostname: "localhost",
      port: 5000,
      path: `/api/complaints/${waterComplaintId}/student-contact`,
      method: "GET",
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wardenContactRes.status === 200, "Warden granted access to student contact for Water issue");

    // 5. Shared Incident Threshold & Lifecycle
    console.log("\n--- Step 5: Shared Incident Threshold, Confirmation & Resolution ---");
    // Clean prior incidents and plumbing complaints
    await Incident.deleteMany({ serviceType: "WATER" });
    await Complaint.deleteMany({ category: "Plumbing" });

    // Submit 5 complaints from 5 distinct rooms
    const incidentRooms = ["301", "302", "303", "304", "305"];
    const incidentComplaints = [];

    for (const r of incidentRooms) {
      let rStudent = await Student.findOneAndUpdate(
        { prn: `PRN_E2E_${r}` },
        {
          name: `Student ${r}`,
          fullName: `Student ${r}`,
          email: `student.${r}@pict.edu`,
          prn: `PRN_E2E_${r}`,
          doorNumber: r,
          role: "STUDENT"
        },
        { upsert: true, returnDocument: "after" }
      );
      const rToken = jwt.sign(
        { id: rStudent._id, role: "STUDENT", email: rStudent.email },
        process.env.JWT_SECRET || "hostel_pict_jwt_super_secret_2024",
        { expiresIn: "1h" }
      );
      const resC = await request(
        {
          hostname: "localhost",
          port: 5000,
          path: "/api/complaints",
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${rToken}` }
        },
        { title: `Water outage in room ${r}`, category: "Plumbing", quickCategory: "NO_WATER_SUPPLY" }
      );
      incidentComplaints.push(resC.data.complaint);
    }

    // Query incidents as Warden
    const listIncidentsRes = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/incidents",
      method: "GET",
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(listIncidentsRes.status === 200, "GET /api/incidents returned HTTP 200");
    const proposedIncident = listIncidentsRes.data.find(inc => inc.serviceType === "WATER" && inc.status === "PROPOSED");
    assert(!!proposedIncident, "Shared incident automatically proposed after 5 distinct rooms reported");
    assert(proposedIncident.affectedRooms.length === 5, "Shared incident correctly covers exactly 5 distinct rooms");

    // Warden confirms incident
    const confirmRes = await request({
      hostname: "localhost",
      port: 5000,
      path: `/api/incidents/${proposedIncident._id}/confirm`,
      method: "PUT",
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(confirmRes.status === 200, "Warden confirmed shared incident (HTTP 200)");
    assert(confirmRes.data.incident.status === "CONFIRMED", "Incident status transitioned to CONFIRMED");

    // Warden resolves incident with explicit review decisions
    const cKeepOpen = incidentComplaints[0]._id;
    const cResolve = incidentComplaints[1]._id;

    const resolveRes = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: `/api/incidents/${proposedIncident._id}/resolve`,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${wardenToken}` }
      },
      {
        resolutionNote: "Main water valve restored",
        complaintDecisions: [
          { complaintId: cResolve, action: "RESOLVE", note: "Water pressure restored" },
          { complaintId: cKeepOpen, action: "KEEP_OPEN", note: "Air in pipes, keeping open for plumber" }
        ]
      }
    );
    assert(resolveRes.status === 200, "Warden resolved shared incident (HTTP 200)");
    assert(resolveRes.data.incident.status === "RESOLVED", "Incident status transitioned to RESOLVED");

    // Verify individual complaint states
    const checkResolved = await Complaint.findById(cResolve);
    const checkKeptOpen = await Complaint.findById(cKeepOpen);

    assert(checkResolved.status === "Resolved", "Complaint 1 transitioned to Resolved");
    assert(checkKeptOpen.status === "Pending", "Complaint 2 remained Pending for explicit follow-up");
    assert(checkKeptOpen.incidentId === null, "Kept-open complaint unlinked from resolved incident");

    // Clean up test data
    await Complaint.deleteMany({ _id: { $in: [waterComplaintId, submitSecondWaterRes.data.complaint._id, wifiComplaintId, ...incidentComplaints.map(c => c._id)] } });
    await Incident.deleteMany({ _id: proposedIncident._id });
    await Student.deleteMany({ prn: { $regex: /^PRN_E2E/ } });
  } catch (err) {
    console.error("E2E Test Exception:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n=================================================");
  console.log(`E2E TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2E();
