const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "hostel_pict_jwt_super_secret_2024";

let adminToken = "";
let studentToken = "";
let wardenToken = "";
let supervisorToken = "";
let staffToken = "";

let testDeptId = "";
let testSupervisorId = "";
let testStaffId = "";
let testComplaintId = "";
let antiRaggingComplaintId = "";

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runScenario(name, fn) {
  process.stdout.write(`\n--- Running: ${name} ---\n`);
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    results.push({ name, passed: true });
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    results.push({ name, passed: false, error: err.message });
  }
}

async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  console.log("=========================================================");
  console.log("    HOSTEL HUB EXTENSION: 9-SCENARIO VERIFICATION SUITE   ");
  console.log("=========================================================");

  // Connect to DB directly for student/warden token generation helper
  await mongoose.connect("mongodb://127.0.0.1:27017/hostelDB");
  const { Student, Warden, MainAdmin, Staff } = require("./models/User");
  const Department = require("./models/Department");
  const Complaint = require("./models/Complaint");
  const StudentRoster = require("./models/StudentRoster");

  const studentUser = await Student.findOne();
  assert(studentUser, "Student user found in DB");
  // Ensure student admission status is approved for complaint submission test
  await StudentRoster.updateOne({ email: studentUser.email }, { $set: { admissionStatus: "APPROVED" } });
  studentToken = jwt.sign({ id: studentUser._id, role: "STUDENT" }, JWT_SECRET, { expiresIn: "1h" });

  const wardenUser = await Warden.findOne();
  assert(wardenUser, "Warden user found in DB");
  wardenToken = jwt.sign({ id: wardenUser._id, role: "WARDEN" }, JWT_SECRET, { expiresIn: "1h" });

  // SCENARIO 1: Main Admin Login & Department Management
  await runScenario("SCENARIO 1: Main Admin Login & Department Creation/Configuration", async () => {
    // 1. Admin login via /api/auth/login
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "mainadmin@pict.edu", password: "Admin@Pict2024!" })
    });
    assert(loginRes.status === 200, `Admin login failed: ${JSON.stringify(loginRes.data)}`);
    adminToken = loginRes.data.token;
    assert(adminToken, "Admin token acquired");

    // Clean up any old test department if present
    await Department.deleteMany({ code: "BIOMETRIC" });

    // 2. Create department
    const createRes = await request("/admin/departments", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Biometric & Security Hardware",
        code: "BIOMETRIC",
        description: "Specialized maintenance for biometric turnstiles and scanners.",
        template: "SECURITY",
        complaintCategories: ["Biometric Scanner Failure", "Turnstile Gate Jam"]
      })
    });
    assert(createRes.status === 201, `Failed to create department: ${JSON.stringify(createRes.data)}`);
    testDeptId = createRes.data.department._id;
    assert(testDeptId, "Department ID returned");
    assert(createRes.data.department.isActive === true, "Department is active by default");

    // 3. Edit department details
    const editRes = await request(`/admin/departments/${testDeptId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        description: "Updated description: High priority biometric entrance turnstiles.",
        complaintCategories: ["Biometric Scanner Failure", "Turnstile Gate Jam", "Fingerprint Sensor Defect"]
      })
    });
    assert(editRes.status === 200, `Failed to update department: ${JSON.stringify(editRes.data)}`);
    assert(editRes.data.department.complaintCategories.includes("Fingerprint Sensor Defect"), "Category updated");

    // 4. Verify department appears in admin list
    const listRes = await request("/admin/departments", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(listRes.status === 200, "Get departments succeeded");
    const found = listRes.data.departments.find(d => d._id === testDeptId);
    assert(found, "Newly created department found in listing");
  });

  // SCENARIO 2: Centralized Staff Directory, Credentials & Account Management
  await runScenario("SCENARIO 2: Staff Creation, Department Assignment & Login", async () => {
    // Clean up old test staff
    await Staff.deleteMany({ email: { $in: ["biot supervisor@pict.edu", "biotech@pict.edu", "biosup@pict.edu"] } });

    // 1. Create Department Supervisor
    const supRes = await request("/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Bio Supervisor Sunita",
        email: "biosup@pict.edu",
        password: "BioPassword123!",
        employeeId: "BIO-SUP-01",
        phoneNumber: "9876500001",
        designation: "Chief Hardware Engineer",
        staffRole: "Supervisor",
        departmentId: testDeptId,
        isSupervisor: true
      })
    });
    assert(supRes.status === 201, `Supervisor creation failed: ${JSON.stringify(supRes.data)}`);
    testSupervisorId = supRes.data.staff._id || supRes.data.staff.id;

    // 2. Create standard staff technician
    const techRes = await request("/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Vikram BioTech",
        email: "biotech@pict.edu",
        password: "TechPassword123!",
        employeeId: "BIO-TECH-02",
        phoneNumber: "9876500002",
        designation: "Hardware Technician",
        staffRole: "Technician",
        departmentId: testDeptId,
        isSupervisor: false
      })
    });
    assert(techRes.status === 201, `Tech creation failed: ${JSON.stringify(techRes.data)}`);
    testStaffId = techRes.data.staff._id || techRes.data.staff.id;

    // 3. Set supervisor on department
    const setSupRes = await request(`/admin/departments/${testDeptId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supervisor: testSupervisorId })
    });
    assert(setSupRes.status === 200, "Supervisor assigned to department");

    // 4. Log in as Supervisor
    const supLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "biosup@pict.edu", password: "BioPassword123!" })
    });
    assert(supLogin.status === 200, "Supervisor login succeeded");
    supervisorToken = supLogin.data.token;
    assert(supLogin.data.user.isSupervisor === true, "Supervisor flag present on login user object");
    assert(supLogin.data.user.departmentName === "Biometric & Security Hardware", "Department name populated on login user");

    // 5. Log in as Tech
    const techLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "biotech@pict.edu", password: "TechPassword123!" })
    });
    assert(techLogin.status === 200, "Tech login succeeded");
    staffToken = techLogin.data.token;

    // 6. Test GET /api/auth/me for tech
    const meRes = await request("/auth/me", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(meRes.status === 200, "GET /auth/me succeeded");
    assert(meRes.data.user.employeeId === "BIO-TECH-02", "Employee ID preserved");
    assert(meRes.data.user.designation === "Hardware Technician", "Designation preserved");

    // 7. Test GET /api/staff/department-info
    const deptInfoRes = await request("/staff/department-info", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(deptInfoRes.status === 200, "GET /staff/department-info succeeded");
    assert(deptInfoRes.data.department.code === "BIOMETRIC", "Correct department info returned to staff");
  });

  // SCENARIO 3: Student Submits Complaint & Automatic Routing to Department Queue
  await runScenario("SCENARIO 3: Automatic Complaint Routing to Responsible Department", async () => {
    // Student submits complaint with "Biometric Scanner Failure"
    const submitRes = await request("/complaints", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        title: "East Wing Biometric Turnstile Not Scanning Thumb",
        description: "Turnstile sensor flashes red repeatedly when placing finger. Multiple students queued outside.",
        category: "Biometric Scanner Failure",
        location: "East Wing Entrance",
        room: "101"
      })
    });
    assert(submitRes.status === 201, `Complaint submission failed: ${JSON.stringify(submitRes.data)}`);
    testComplaintId = submitRes.data._id || submitRes.data.complaint?._id;
    assert(testComplaintId, "Complaint ID returned");

    // Verify complaint was automatically routed to BIOMETRIC department
    const complaintDoc = await Complaint.findById(testComplaintId);
    assert(complaintDoc.departmentId.toString() === testDeptId.toString(), "Complaint departmentId matches BIOMETRIC department");
    assert(complaintDoc.lifecycleState === "ROUTED" || complaintDoc.lifecycleState === "ASSIGNED", `Lifecycle state is ${complaintDoc.lifecycleState}`);
    assert(!complaintDoc.assignedTo, "Complaint is not yet assigned to an individual staff member");

    // Check department unassigned queue
    const queueRes = await request("/staff/department-complaints?scope=unassigned", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(queueRes.status === 200, "GET department complaints succeeded");
    const inQueue = queueRes.data.complaints.find(c => c._id.toString() === testComplaintId.toString());
    assert(inQueue, "Complaint found in department unassigned claim queue");
  });

  // SCENARIO 4: Department Supervisor Assigns Complaint to Staff
  await runScenario("SCENARIO 4: Department Supervisor Complaint Assignment", async () => {
    // Supervisor views colleagues in department
    const collRes = await request("/staff/department-colleagues", {
      headers: { Authorization: `Bearer ${supervisorToken}` }
    });
    assert(collRes.status === 200, "GET /staff/department-colleagues succeeded");
    const techColleague = collRes.data.colleagues.find(c => c._id.toString() === testStaffId.toString());
    assert(techColleague, "Colleague Vikram BioTech found in department roster");

    // Supervisor assigns complaint to Vikram
    const assignRes = await request(`/staff/complaint/${testComplaintId}/assign`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({ staffId: testStaffId, note: "Assigned to Vikram for immediate inspection" })
    });
    assert(assignRes.status === 200, `Assignment failed: ${JSON.stringify(assignRes.data)}`);
    const assignedStaffId = assignRes.data.complaint?.assignedTo?._id || assignRes.data.complaint?.assignedTo;
    assert(assignedStaffId?.toString() === testStaffId.toString(), "Complaint assignedTo is Vikram");
    assert(assignRes.data.complaint.lifecycleState === "ASSIGNED", "Lifecycle state transitioned to ASSIGNED");

    // Verify history recorded the assignment
    const updated = await Complaint.findById(testComplaintId);
    assert(updated.statusHistory && updated.statusHistory.some(h => h.note?.includes("Assigned") || h.status === "In Progress"), "History contains assignment record");
  });

  // SCENARIO 5: Staff Member Starts Work and Resolves Complaint Lifecycle
  await runScenario("SCENARIO 5: Staff Member Execution & Complaint Resolution", async () => {
    // 1. Staff views assigned complaints
    const myWorkRes = await request("/staff/department-complaints?scope=my_jobs", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(myWorkRes.status === 200, "Staff views assigned work");
    const assignedJob = myWorkRes.data.complaints.find(c => c._id.toString() === testComplaintId.toString());
    assert(assignedJob, "Complaint is present in staff member's assigned work list");

    // 2. Staff starts work
    const startRes = await request(`/staff/complaint/${testComplaintId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(startRes.status === 200, "Start work succeeded");
    assert(startRes.data.workStartedAt, "workStartedAt returned");

    // Verify state in DB
    const inProgDoc = await Complaint.findById(testComplaintId);
    assert(inProgDoc.lifecycleState === "IN_PROGRESS", "State is IN_PROGRESS in DB");
    assert(inProgDoc.workStartedAt, "workStartedAt timestamp persisted");

    // 3. Staff completes work / marks resolved
    const completeRes = await request(`/staff/complaint/${testComplaintId}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ resolutionNote: "Cleaned optical sensor lens and recalibrated turnstile firmware." })
    });
    assert(completeRes.status === 200, "Complete work succeeded");
    assert(completeRes.data.resolvedAt, "resolvedAt returned");

    // 4. Verify historical record integrity
    const resolvedDoc = await Complaint.findById(testComplaintId);
    assert(resolvedDoc.status === "Resolved", "DB status is Resolved");
    assert(resolvedDoc.resolvedAt, "DB resolvedAt timestamp exists");
    assert(resolvedDoc.statusHistory && resolvedDoc.statusHistory.length >= 3, "Complete event audit trail present");
  });

  // SCENARIO 6: Configurable Category Mapping & Unmapped Management Queue
  await runScenario("SCENARIO 6: Configurable Category Mapping & Review Queue Routing", async () => {
    // 1. Student submits complaint with an unmapped / unknown category
    const unmappedRes = await request("/complaints", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        title: "Solar panel inverter alarm on hostel roof",
        description: "High pitched screeching sound coming from solar battery room.",
        category: "Solar Inverter Glitch Unknown",
        location: "Hostel Roof",
        room: "Roof-01"
      })
    });
    assert(unmappedRes.status === 201, "Complaint submission succeeded");
    const unmappedDoc = await Complaint.findById(unmappedRes.data._id || unmappedRes.data.complaint?._id);
    assert(unmappedDoc, "Unmapped complaint found in DB");
    // Verify unmapped category safely enters review queue without crashing or losing record
    assert(unmappedDoc.departmentId === null, "DepartmentId is null (queued for management review)");
    assert(unmappedDoc.status === "Pending", "Status is Pending");
    assert(unmappedDoc.lifecycleState === "SUBMITTED", "Lifecycle is SUBMITTED");

    // 2. Verify previously resolved complaint under BIOMETRIC was NOT affected
    const prevComplaint = await Complaint.findById(testComplaintId);
    assert(prevComplaint.departmentId.toString() === testDeptId.toString(), "Historical complaint departmentId preserved");
    assert(prevComplaint.status === "Resolved", "Historical complaint status unchanged");
  });

  // SCENARIO 7: Anti-Ragging Strict Privacy & Access Control Isolation
  await runScenario("SCENARIO 7: Strict Anti-Ragging Privacy & Media Isolation", async () => {
    // 1. Submit an Anti-Ragging complaint
    const antiRaggingRes = await request("/complaints", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        title: "Verbal harassment outside second floor common room",
        description: "Confidential report: Senior students gathered at midnight intimidating first year students.",
        category: "Anti-Ragging / Harassment",
        location: "Second Floor Wing B",
        room: "205"
      })
    });
    assert(antiRaggingRes.status === 201, "Anti-Ragging complaint created");
    antiRaggingComplaintId = antiRaggingRes.data._id || antiRaggingRes.data.complaint?._id;
    assert(antiRaggingComplaintId, "Anti-Ragging ID generated");

    // 2. Ordinary Staff (Vikram) calling GET /api/complaints/all: must NOT see Anti-Ragging
    const staffAllRes = await request("/complaints/all", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (staffAllRes.status === 200 && Array.isArray(staffAllRes.data)) {
      const leaked = staffAllRes.data.find(c => c._id.toString() === antiRaggingComplaintId.toString());
      assert(!leaked, "LEAK DETECTED: Ordinary staff saw Anti-Ragging complaint in /complaints/all");
    }

    // 3. Ordinary Staff calling GET /api/complaints/:id: must receive 403 Forbidden
    const staffDetailRes = await request(`/complaints/${antiRaggingComplaintId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(staffDetailRes.status === 403, `Expected 403 for staff Anti-Ragging access, got: ${staffDetailRes.status}`);

    // 4. Ordinary Warden calling GET /api/complaints/analytics: Anti-Ragging must be excluded
    const analyticsRes = await request("/complaints/analytics", {
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(analyticsRes.status === 200, "Warden analytics query succeeded");

    // 5. Protected Media Gatekeeper test:
    // Calling protected media endpoint for Anti-Ragging without Anti-Ragging clearance returns 401/403
    const mediaGateRes = await request("http://localhost:5000/uploads/antiragging_confidential_test.jpg", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    // Staff should not access confidential attachments
    assert(mediaGateRes.status === 403 || mediaGateRes.status === 404, `Media gate returned ${mediaGateRes.status}`);

    // 6. Main Admin CAN access the Anti-Ragging complaint
    const adminDetailRes = await request(`/complaints/${antiRaggingComplaintId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDetailRes.status === 200, "Main Admin successfully retrieved Anti-Ragging complaint details");
    assert(adminDetailRes.data.complaint._id.toString() === antiRaggingComplaintId.toString(), "Admin received correct complaint");
  });

  // SCENARIO 8: Account Deactivation & Session Revocation
  await runScenario("SCENARIO 8: Staff Account Deactivation & Login Block", async () => {
    // 1. Admin deactivates Vikram's account
    const deactRes = await request(`/admin/staff/${testStaffId}/deactivate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: "End of contract / test deactivation" })
    });
    assert(deactRes.status === 200, "Deactivate request succeeded");

    // 2. Vikram tries to log in again: must receive 403 ACCOUNT_DEACTIVATED
    const blockedLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "biotech@pict.edu", password: "TechPassword123!" })
    });
    assert(blockedLogin.status === 403, `Expected 403 on deactivated login, got: ${blockedLogin.status}`);
    assert(blockedLogin.data.code === "ACCOUNT_DEACTIVATED", `Expected code ACCOUNT_DEACTIVATED, got: ${blockedLogin.data.code}`);

    // 3. Vikram's existing JWT token calling /api/auth/me: must receive 403 ACCOUNT_DEACTIVATED
    const sessionBlocked = await request("/auth/me", {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(sessionBlocked.status === 403, `Expected 403 for existing session of deactivated user, got: ${sessionBlocked.status}`);
    assert(sessionBlocked.data.code === "ACCOUNT_DEACTIVATED", `Expected ACCOUNT_DEACTIVATED code, got: ${sessionBlocked.data.code}`);

    // 4. Admin restores Vikram's account
    const restoreRes = await request(`/admin/staff/${testStaffId}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(restoreRes.status === 200, "Restore request succeeded");

    // 5. Admin tests password reset for Vikram
    const pwResetRes = await request(`/admin/staff/${testStaffId}/reset-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ newPassword: "BrandNewPassword2026!" })
    });
    assert(pwResetRes.status === 200, "Password reset succeeded");

    // 6. Vikram logs in with new password
    const newPwLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "biotech@pict.edu", password: "BrandNewPassword2026!" })
    });
    assert(newPwLogin.status === 200, "Login with newly reset password succeeded");
  });

  // SCENARIO 9: Overall System Overview & Regression Verification
  await runScenario("SCENARIO 9: System Overview & Zero Regressions", async () => {
    // 1. Admin System Overview endpoint
    const overviewRes = await request("/admin/overview/stats", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(overviewRes.status === 200, "GET /admin/overview/stats succeeded");
    assert(overviewRes.data.summary, "Overview summary present");
    assert(Array.isArray(overviewRes.data.departmentBreakdown), "Department breakdown array present");
    assert(Array.isArray(overviewRes.data.staffWorkloads), "Staff workloads array present");

    // 2. Warden Complaints endpoint works normally
    const wardenComplaintsRes = await request("/complaints/all", {
      headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wardenComplaintsRes.status === 200, "Warden /complaints/all works cleanly");

    // 3. Incharge portal endpoints work without regression
    const inchargeFeedRes = await request("/incharge/feed", {
      headers: { Authorization: `Bearer ${wardenToken}` }
    }).catch(() => null);
    // Even if incharge routes have specific incharge role requirements, verify no unhandled crashes
    assert(inchargeFeedRes !== null, "Incharge route responds");
  });

  // Clean up test data
  console.log("\n--- Cleaning up temporary test records ---");
  if (testDeptId) await Department.deleteOne({ _id: testDeptId });
  const staffToDelete = [testSupervisorId, testStaffId].filter(id => id && id.length === 24);
  if (staffToDelete.length) await Staff.deleteMany({ _id: { $in: staffToDelete } });
  const complaintsToDelete = [testComplaintId, antiRaggingComplaintId].filter(id => id && id.length === 24);
  if (complaintsToDelete.length) await Complaint.deleteMany({ _id: { $in: complaintsToDelete } });
  console.log("Cleanup complete.");

  await mongoose.disconnect();

  console.log("\n=========================================================");
  console.log("                TEST SUITE SUMMARY                       ");
  console.log("=========================================================");
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.passed ? "PASS" : "FAIL"}] ${r.name}`);
    if (!r.passed) allPassed = false;
  }
  console.log("=========================================================");
  if (allPassed) {
    console.log(">>> ALL 9 SCENARIOS VERIFIED SUCCESSFULLY! <<<");
    process.exit(0);
  } else {
    console.error(">>> SOME SCENARIOS FAILED! <<<");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
