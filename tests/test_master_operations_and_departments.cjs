/**
 * test_master_operations_and_departments.cjs
 * Comprehensive end-to-end integration and verification suite using native fetch:
 * 1. Master Departments & Categories Configuration
 * 2. Main Admin Authentication & Privileges
 * 3. Automated Workload Routing & Least-Loaded Staff Selection
 * 4. Anti-Ragging Confidentiality Barrier (403 for Warden, HeadWarden, Student)
 * 5. Security Incident Access Barrier (403 for Warden, Student)
 * 6. Append-Only Event History Engine (ComplaintEvent lifecycle audit)
 * 7. Staff Lifecycle Management (Create, Deactivate, Reallocate Work, Reactivate)
 * 8. 77-Room Authoritative Inventory & Capacity Constraint (Max 2)
 * 9. Active Roster OTP Access Control
 */

const mongoose = require("../backend/node_modules/mongoose");
const jwt = require("../backend/node_modules/jsonwebtoken");

const path = require("path");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const API_BASE = "http://localhost:5000/api";
const MONGO_URI = "mongodb://127.0.0.1:27017/hostelDB";
const JWT_SECRET = process.env.JWT_SECRET || "hostel_pict_jwt_super_secret_2024";

// Models
const { User } = require("../backend/models/User");
const Department = require("../backend/models/Department");
const ComplaintCategory = require("../backend/models/ComplaintCategory");
const Complaint = require("../backend/models/Complaint");
const ComplaintEvent = require("../backend/models/ComplaintEvent");
const SecurityIncident = require("../backend/models/SecurityIncident");
const AntiRaggingCase = require("../backend/models/AntiRaggingCase");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const StudentRoster = require("../backend/models/StudentRoster");

let mainAdminToken, inchargeToken, headWardenToken, wardenToken, studentToken, plumber1Token, plumber2Token;
let testStudentId, testPlumber1Id, testPlumber2Id;

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      dashboardPermissions: user.dashboardPermissions || [],
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

async function runMasterTestSuite() {
  console.log("================================================================================");
  console.log("🚀 STARTING HMS MASTER OPERATIONS & ARCHITECTURAL VERIFICATION SUITE");
  console.log("================================================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected directly to MongoDB for authoritative verification\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // --------------------------------------------------------------------------
    // PHASE 1: DEPARTMENT & CATEGORY CONFIGURATION VERIFICATION
    // --------------------------------------------------------------------------
    console.log("📋 PHASE 1: Verifying Master Department & Category Catalog...");
    const depts = await Department.find({ isActive: true });
    assert(depts.length >= 7, `Authoritative departments configured (Found: ${depts.length})`);

    const expectedDepts = ["Plumbing", "Electrical", "Workshop", "Cleaning", "Wi-Fi", "Security", "Anti-Ragging"];
    for (const dName of expectedDepts) {
      const match = depts.find((d) => d.name.toLowerCase().includes(dName.toLowerCase()));
      assert(Boolean(match), `Department "${dName}" exists and is active`);
    }

    const categories = await ComplaintCategory.find({ isActive: true });
    assert(categories.length >= 10, `Complaint categories catalog populated (Found: ${categories.length})`);

    const antiRaggingCat = categories.find((c) => c.code === "ANTIRAGGING" || c.name.toLowerCase().includes("ragging"));
    assert(Boolean(antiRaggingCat && antiRaggingCat.isConfidential), "Anti-ragging category is strictly flagged confidential");

    // --------------------------------------------------------------------------
    // PHASE 2: AUTHENTICATION SETUP & TOKENS
    // --------------------------------------------------------------------------
    console.log("\n🔑 PHASE 2: Authenticating System Actors & Generating Tokens...");
    // 1. Main Admin
    const mainAdmin = await User.findOne({ email: "mainadmin@pict.edu" });
    assert(Boolean(mainAdmin && mainAdmin.role === "MAIN_ADMIN"), "Main Admin supreme account initialized");
    mainAdminToken = generateToken(mainAdmin);

    // 2. Hostel Incharge
    let incharge = await User.findOne({ role: "INCHARGE" });
    if (!incharge) {
      incharge = await User.create({
        name: "Hostel Incharge",
        fullName: "Hostel Incharge",
        email: "incharge@pict.edu",
        role: "INCHARGE",
        isActive: true,
        isAvailable: true,
      });
    }
    inchargeToken = generateToken(incharge);

    // 3. Head Warden
    let headWarden = await User.findOne({ role: "HEADWARDEN" });
    if (!headWarden) {
      headWarden = await User.create({
        name: "Head Warden",
        fullName: "Head Warden",
        email: "headwarden@pict.edu",
        role: "HEADWARDEN",
        isActive: true,
        isAvailable: true,
      });
    }
    headWardenToken = generateToken(headWarden);

    // 4. Regular Warden
    let warden = await User.findOne({ role: "WARDEN" });
    if (!warden) {
      warden = await User.create({
        name: "Floor Warden",
        fullName: "Floor Warden",
        email: "warden@hostel.com",
        role: "WARDEN",
        isActive: true,
        isAvailable: true,
      });
    }
    wardenToken = generateToken(warden);

    // 5. Test Student
    let student = await User.findOne({ role: "STUDENT" });
    if (!student) {
      student = await User.create({
        name: "Test Resident",
        fullName: "Test Resident",
        email: "resident.test@ms.pict.edu",
        role: "STUDENT",
        prn: "PRN99999",
        doorNumber: "101",
        room: "101",
        isActive: true,
      });
    } else {
      student.doorNumber = student.doorNumber || "101";
      student.room = student.room || "101";
      await student.save();
    }
    testStudentId = student._id;
    studentToken = generateToken(student);

    // Ensure student is in active approved roster
    await StudentRoster.findOneAndUpdate(
      { email: student.email.toLowerCase() },
      {
        prn: student.prn || "PRN99999",
        name: student.fullName || student.name,
        email: student.email.toLowerCase(),
        rollNumber: student.rollNumber || "101",
        branch: "CS",
        year: "FY",
        doorNumber: student.doorNumber || "101",
        studentMobile: "9876543210",
        parentMobile: "9876543211",
        admissionStatus: "APPROVED",
        registrationStatus: "REGISTERED",
      },
      { upsert: true, returnDocument: "after" }
    );

    // 6. Two Plumbers for Workload Balancing verification
    const plumbingDept = depts.find((d) => d.code === "PLUMBING");
    let plumber1 = await User.findOne({ email: "plumber1@pict.edu" });
    if (!plumber1) {
      plumber1 = await User.create({
        name: "Plumber One",
        fullName: "Plumber One",
        email: "plumber1@pict.edu",
        role: "STAFF",
        departmentId: plumbingDept._id,
        isActive: true,
        isAvailable: true,
      });
    }
    testPlumber1Id = plumber1._id;
    plumber1Token = generateToken(plumber1);

    let plumber2 = await User.findOne({ email: "plumber2@pict.edu" });
    if (!plumber2) {
      plumber2 = await User.create({
        name: "Plumber Two",
        fullName: "Plumber Two",
        email: "plumber2@pict.edu",
        role: "STAFF",
        departmentId: plumbingDept._id,
        isActive: true,
        isAvailable: true,
      });
    }
    testPlumber2Id = plumber2._id;
    plumber2Token = generateToken(plumber2);

    assert(Boolean(mainAdminToken && inchargeToken && headWardenToken && wardenToken && studentToken), "All system test tokens generated");

    // --------------------------------------------------------------------------
    // PHASE 3: AUTOMATED WORKLOAD ROUTING & LEAST-LOADED ALLOCATION
    // --------------------------------------------------------------------------
    console.log("\n⚖️ PHASE 3: Verifying Automated Workload Routing & Least-Loaded Selection...");

    // Clear test jobs
    await Complaint.deleteMany({ title: /E2E/ });

    // Set other plumbers temporarily unavailable for clean isolated 2-plumber comparison
    await User.updateMany(
      { role: "STAFF", departmentId: plumbingDept._id, _id: { $nin: [testPlumber1Id, testPlumber2Id] } },
      { isAvailable: false }
    );
    await User.updateMany(
      { _id: { $in: [testPlumber1Id, testPlumber2Id] } },
      { isAvailable: true }
    );

    // Job A assigned to Plumber 1
    await Complaint.create({
      studentId: testStudentId,
      title: "E2E Test Job 1",
      description: "Sink drip",
      category: "Plumbing",
      departmentId: plumbingDept._id,
      assignedTo: testPlumber1Id,
      status: "In Progress",
      lifecycleState: "IN_PROGRESS",
    });

    // Job B assigned to Plumber 1
    await Complaint.create({
      studentId: testStudentId,
      title: "E2E Test Job 2",
      description: "Pipe leak",
      category: "Plumbing",
      departmentId: plumbingDept._id,
      assignedTo: testPlumber1Id,
      status: "Pending",
      lifecycleState: "ASSIGNED",
    });

    // Now submit a new Plumbing complaint via Student API
    const studentSubmitRes = await request(`${API_BASE}/complaints`, {
      method: "POST",
      body: JSON.stringify({
        title: "E2E Test New Plumbing Leak",
        description: "Washbasin pipe leaking water",
        category: "Plumbing",
        room: "101",
      }),
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    if (studentSubmitRes.status !== 201) {
      console.error("Student submit failed:", studentSubmitRes.status, studentSubmitRes.data);
    }
    assert(studentSubmitRes.status === 201, "Student complaint submitted successfully");
    const routedComplaint = studentSubmitRes.data.complaint || studentSubmitRes.data;

    // Verify atomic assignment to Plumber 2 (least-loaded: 0 active vs 2 active)
    console.log("Routed complaint assignedTo:", routedComplaint.assignedTo, "Plumber1:", testPlumber1Id, "Plumber2:", testPlumber2Id);
    assert(
      String(routedComplaint.assignedTo?._id || routedComplaint.assignedTo) === String(testPlumber2Id),
      `Workload router correctly selected least-loaded employee (Plumber 2: ${testPlumber2Id})`
    );

    // Verify append-only ComplaintEvent was recorded
    const events = await ComplaintEvent.find({ complaintId: routedComplaint._id }).sort({ timestamp: 1 });
    assert(events.length >= 3, `Append-only ComplaintEvents recorded (Found: ${events.length})`);
    assert(events[0].eventType === "SUBMITTED", "Initial event is SUBMITTED");
    assert(events[1].eventType === "ROUTED", "Intermediate event is ROUTED");
    assert(events[2].eventType === "ASSIGNED", "Subsequent event is ASSIGNED");

    // --------------------------------------------------------------------------
    // PHASE 4: EMPLOYEE WORK LIFECYCLE (ACCEPT -> START -> COMPLETE)
    // --------------------------------------------------------------------------
    console.log("\n🛠️ PHASE 4: Verifying Staff Section 5.2 Work Lifecycle Transitions...");

    // 1. Plumber 2 accepts the job
    const acceptRes = await request(`${API_BASE}/staff/complaint/${routedComplaint._id}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${plumber2Token}` },
    });
    assert(acceptRes.status === 200, "Plumber 2 accepted the assigned job");

    // 2. Plumber 2 starts work
    const startRes = await request(`${API_BASE}/staff/complaint/${routedComplaint._id}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${plumber2Token}` },
    });
    assert(startRes.status === 200, "Plumber 2 transitioned job to IN_PROGRESS");

    // 3. Plumber 2 logs work note
    const noteRes = await request(`${API_BASE}/staff/complaint/${routedComplaint._id}/note`, {
      method: "POST",
      body: JSON.stringify({ note: "Replaced faulty rubber washer on tap inlet." }),
      headers: { Authorization: `Bearer ${plumber2Token}` },
    });
    assert(noteRes.status === 200, "Plumber 2 logged technical work note");

    // 4. Plumber 2 completes work
    const completeRes = await request(`${API_BASE}/staff/complaint/${routedComplaint._id}/complete`, {
      method: "POST",
      body: JSON.stringify({ resolutionNote: "Tap repaired and leak stopped completely." }),
      headers: { Authorization: `Bearer ${plumber2Token}` },
    });
    assert(completeRes.status === 200, "Plumber 2 completed work and resolved complaint");

    // Verify event audit trail contains all 5 transitions
    const finalEvents = await ComplaintEvent.find({ complaintId: routedComplaint._id }).sort({ timestamp: 1 });
    const eventTypes = finalEvents.map((e) => e.eventType);
    assert(eventTypes.includes("ACKNOWLEDGED"), "Audit log contains ACKNOWLEDGED event");
    assert(eventTypes.includes("WORK_STARTED"), "Audit log contains WORK_STARTED event");
    assert(eventTypes.includes("NOTE_ADDED"), "Audit log contains NOTE_ADDED event");
    assert(eventTypes.includes("WORK_COMPLETED"), "Audit log contains WORK_COMPLETED event");

    // --------------------------------------------------------------------------
    // PHASE 5: ANTI-RAGGING STRICT CONFIDENTIALITY BARRIER
    // --------------------------------------------------------------------------
    console.log("\n🔒 PHASE 5: Verifying Anti-Ragging Confidentiality Barrier...");

    // 1. Create a confidential anti-ragging case via Main Admin
    const caseRes = await request(`${API_BASE}/anti-ragging/cases`, {
      method: "POST",
      body: JSON.stringify({
        title: "E2E Confidential Ragging Report",
        description: "Late night corridor verbal intimidation incident",
        location: "Hostel B 2nd Floor Corridor",
        severity: "SEVERE",
        isAnonymous: true,
      }),
      headers: { Authorization: `Bearer ${mainAdminToken}` },
    });
    if (caseRes.status !== 201) {
      console.error("Anti-ragging case creation failed:", caseRes.status, caseRes.data);
    }
    assert(caseRes.status === 201, "Confidential Anti-Ragging case filed by Main Admin");

    // 2. Hostel Incharge can read cases: HTTP 200
    const inchargeCaseRes = await request(`${API_BASE}/anti-ragging/cases`, {
      headers: { Authorization: `Bearer ${inchargeToken}` },
    });
    assert(inchargeCaseRes.status === 200, "Hostel Incharge has clearance to access Anti-Ragging Vault");

    // 3. Regular Warden CANNOT read cases: HTTP 403 Forbidden!
    const wardenCaseRes = await request(`${API_BASE}/anti-ragging/cases`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert(wardenCaseRes.status === 403, "Regular Warden is STRICTLY BLOCKED with HTTP 403 from Anti-Ragging Vault");

    // 4. Head Warden CANNOT read cases: HTTP 403 Forbidden!
    const hwCaseRes = await request(`${API_BASE}/anti-ragging/cases`, {
      headers: { Authorization: `Bearer ${headWardenToken}` },
    });
    assert(hwCaseRes.status === 403, "Head Warden is STRICTLY BLOCKED with HTTP 403 from Anti-Ragging Vault");

    // 5. Student CANNOT read cases: HTTP 403 Forbidden!
    const studentCaseRes = await request(`${API_BASE}/anti-ragging/cases`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(studentCaseRes.status === 403, "Student is STRICTLY BLOCKED with HTTP 403 from Anti-Ragging Vault");

    // --------------------------------------------------------------------------
    // PHASE 6: SECURITY MANAGEMENT ACCESS BARRIER
    // --------------------------------------------------------------------------
    console.log("\n🛡️ PHASE 6: Verifying Security Incident Access Barrier...");

    // 1. Log incident via Incharge
    const secRes = await request(`${API_BASE}/security/incidents`, {
      method: "POST",
      body: JSON.stringify({
        title: "E2E Perimeter Gate Check",
        description: "Visitor logged without pass",
        location: "Main Gate",
        severity: "LOW",
      }),
      headers: { Authorization: `Bearer ${inchargeToken}` },
    });
    assert(secRes.status === 201, "Security incident logged by Incharge");

    // 2. Head Warden can access security incidents: HTTP 200
    const hwSecRes = await request(`${API_BASE}/security/incidents`, {
      headers: { Authorization: `Bearer ${headWardenToken}` },
    });
    assert(hwSecRes.status === 200, "Head Warden has clearance to view Security Desk");

    // 3. Regular Warden CANNOT access security incidents: HTTP 403 Forbidden!
    const wardenSecRes = await request(`${API_BASE}/security/incidents`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert(wardenSecRes.status === 403, "Regular Warden is STRICTLY BLOCKED with HTTP 403 from Security Desk");

    // 4. Student CANNOT access security incidents: HTTP 403 Forbidden!
    const studentSecRes = await request(`${API_BASE}/security/incidents`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(studentSecRes.status === 403, "Student is STRICTLY BLOCKED with HTTP 403 from Security Desk");

    // --------------------------------------------------------------------------
    // PHASE 7: STAFF LIFECYCLE (DEACTIVATION & REALLOCATION)
    // --------------------------------------------------------------------------
    console.log("\n👥 PHASE 7: Verifying Staff Lifecycle, Deactivation & Reallocation...");

    // Give Plumber 1 an unfinished active job
    const unfinComplaint = await Complaint.create({
      studentId: testStudentId,
      title: "E2E Unfinished Job for Reallocation",
      description: "Main line leak",
      category: "Plumbing",
      departmentId: plumbingDept._id,
      assignedTo: testPlumber1Id,
      status: "In Progress",
      lifecycleState: "IN_PROGRESS",
    });

    // Main Admin deactivates Plumber 1 and reallocates work
    const deactRes = await request(`${API_BASE}/admin/staff/${testPlumber1Id}/deactivate`, {
      method: "POST",
      body: JSON.stringify({ reason: "On medical leave", reallocateWork: true }),
      headers: { Authorization: `Bearer ${mainAdminToken}` },
    });
    if (deactRes.status !== 200) {
      console.error("Deactivate staff failed:", deactRes.status, deactRes.data);
    }
    assert(deactRes.status === 200, "Main Admin deactivated staff member with work reallocation");

    // Verify Plumber 1 is marked inactive in database
    const updatedPlumber1 = await User.findById(testPlumber1Id);
    assert(updatedPlumber1.isActive === false, "Plumber 1 isActive status is false");

    // Verify the complaint was reallocated to Plumber 2
    const reallocatedComp = await Complaint.findById(unfinComplaint._id);
    assert(
      String(reallocatedComp.assignedTo) === String(testPlumber2Id),
      `Unfinished job was atomically reallocated to Plumber 2 (${testPlumber2Id})`
    );

    // Verify Plumber 1 token is now rejected due to account deactivation check
    const deactTokenRes = await request(`${API_BASE}/staff/my-jobs`, {
      headers: { Authorization: `Bearer ${plumber1Token}` },
    });
    console.log("Deact token res:", deactTokenRes.status, deactTokenRes.data);
    assert(
      (deactTokenRes.status === 403 || deactTokenRes.status === 401) && deactTokenRes.data?.code === "ACCOUNT_DEACTIVATED",
      "Deactivated staff session is immediately terminated (HTTP 403 ACCOUNT_DEACTIVATED)"
    );

    // Main Admin restores Plumber 1
    const restoreRes = await request(`${API_BASE}/admin/staff/${testPlumber1Id}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${mainAdminToken}` },
    });
    assert(restoreRes.status === 200, "Main Admin restored staff member");

    // --------------------------------------------------------------------------
    // PHASE 8: 77-ROOM INVENTORY & CAPACITY ENFORCEMENT
    // --------------------------------------------------------------------------
    console.log("\n🏠 PHASE 8: Verifying Authoritative 77-Room Inventory & Capacity constraint...");
    const roomCount = await RoomOccupancy.countDocuments();
    assert(roomCount === 77, `Exactly 77 physical rooms synchronized in database (Found: ${roomCount})`);

    // Ensure all rooms enforce maxCapacity = 2 (no room over capacity)
    const overCapacityRooms = await RoomOccupancy.countDocuments({
      $or: [{ occupantCount: { $gt: 2 } }, { isOverCapacity: true }],
    });
    assert(overCapacityRooms === 0, "All 77 rooms strictly enforce maxCapacity = 2 (0 over capacity)");

    // --------------------------------------------------------------------------
    // PHASE 9: STUDENT ACTIVE ROSTER OTP ACCESS CONTROL
    // --------------------------------------------------------------------------
    console.log("\n🎓 PHASE 9: Verifying Active Roster OTP Access Control...");

    // Test unauthorized email (not in approved active roster)
    const unauthorizedRes = await request(`${API_BASE}/auth/student/send-otp`, {
      method: "POST",
      body: JSON.stringify({ email: "unauthorized.intruder@ms.pict.edu" }),
    });
    assert(unauthorizedRes.status === 403, "Non-roster student email is blocked from receiving OTP (HTTP 403)");

    // Ensure approved roster student can request OTP
    const approvedRosterStudent = await StudentRoster.findOne({
      admissionStatus: "APPROVED",
      email: /@ms\.pict\.edu$/i,
    });
    if (approvedRosterStudent) {
      const allowedRes = await request(`${API_BASE}/auth/student/send-otp`, {
        method: "POST",
        body: JSON.stringify({ email: approvedRosterStudent.email }),
      });
      assert(allowedRes.status === 200, `Approved roster student (${approvedRosterStudent.email}) receives OTP successfully`);
    }

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY! SYSTEM IS 100% VERIFIED.`);
    console.log("================================================================================\n");
  } catch (err) {
    console.error("\n❌ SUITE FAILED AT STEP:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runMasterTestSuite();
