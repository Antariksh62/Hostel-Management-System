/**
 * test_part3_phases1_2_3.cjs
 * Comprehensive verification for Phase 1, Phase 2, and Phase 3.
 */

const path = require("path");
const dotenv = require("../backend/node_modules/dotenv");
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const mongoose = require("../backend/node_modules/mongoose");
const jwt = require("../backend/node_modules/jsonwebtoken");

const Department = require("../backend/models/Department");
const { DashboardTemplate, DashboardInstance } = require("../backend/models/DashboardInstance");
const ComplaintCategory = require("../backend/models/ComplaintCategory");
const { User, Student, Staff, MainAdmin, HeadWarden, Warden, Incharge } = require("../backend/models/User");
const StudentRoster = require("../backend/models/StudentRoster");
const Complaint = require("../backend/models/Complaint");
const ComplaintEvent = require("../backend/models/ComplaintEvent");
const AuditLog = require("../backend/models/AuditLog");
const AntiRaggingCase = require("../backend/models/AntiRaggingCase");
const SecurityIncident = require("../backend/models/SecurityIncident");
const { bootstrapDepartmentsAndTemplates } = require("../backend/services/bootstrapService");

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "hostel_pict_jwt_super_secret_2024";

function makeToken(user) {
    return jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log("================================================================================");
    console.log("🚀 PART 3 VERIFICATION: PHASES 1, 2 & 3");
    console.log("================================================================================");

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");
    console.log("✅ Connected to MongoDB");

    // Ensure bootstrap runs
    await bootstrapDepartmentsAndTemplates();

    // ─── SETUP ACTORS ────────────────────────────────────────────────────────
    console.log("\n🔑 Setting up Actors across all Roles...");
    await User.deleteMany({ email: { $in: ["mainadmin.test@pict.edu", "headwarden.test@pict.edu", "warden.test@pict.edu", "incharge.test@pict.edu", "plumber.alpha@pict.edu", "plumber.beta@pict.edu", "student.part3@ms.pict.edu"] } });

    const mainAdmin = await MainAdmin.create({
        name: "Super Admin",
        email: "mainadmin.test@pict.edu",
        role: "MAIN_ADMIN",
        isActive: true
    });
    const headWarden = await HeadWarden.create({
        name: "Prof Head Warden",
        email: "headwarden.test@pict.edu",
        role: "HEADWARDEN",
        isActive: true
    });
    const warden = await Warden.create({
        name: "Rector Warden",
        email: "warden.test@pict.edu",
        role: "WARDEN",
        isActive: true
    });
    const incharge = await Incharge.create({
        name: "Hostel Incharge",
        email: "incharge.test@pict.edu",
        role: "INCHARGE",
        isActive: true
    });

    const plumbingDept = await Department.findOne({ code: "PLUMBING" });
    const electricalDept = await Department.findOne({ code: "ELECTRICAL" });

    // Two Plumbers for workload balance testing
    const plumberAlpha = await Staff.create({
        name: "Plumber Alpha",
        email: "plumber.alpha@pict.edu",
        role: "STAFF",
        staffRole: "Plumber",
        departmentId: plumbingDept._id,
        isActive: true,
        isAvailable: true,
        dashboardPermissions: ["PLUMBING"]
    });
    const plumberBeta = await Staff.create({
        name: "Plumber Beta",
        email: "plumber.beta@pict.edu",
        role: "STAFF",
        staffRole: "Plumber",
        departmentId: plumbingDept._id,
        isActive: true,
        isAvailable: true,
        dashboardPermissions: ["PLUMBING"]
    });

    // Student actor
    const testStudent = await Student.create({
        name: "Aditi Patil",
        email: "student.part3@ms.pict.edu",
        role: "STUDENT",
        prn: "F24CE991",
        rollNumber: "24191",
        doorNumber: "201",
        mobileNumber: "9876543210",
        isActive: true
    });
    await StudentRoster.findOneAndUpdate(
        { email: "student.part3@ms.pict.edu" },
        { email: "student.part3@ms.pict.edu", fullName: "Aditi Patil", prn: "F24CE991", rollNumber: "24191", roomNumber: "201", admissionStatus: "APPROVED", isActive: true },
        { upsert: true }
    );

    const tokenAdmin = makeToken(mainAdmin);
    const tokenHead = makeToken(headWarden);
    const tokenWarden = makeToken(warden);
    const tokenIncharge = makeToken(incharge);
    const tokenPlumberAlpha = makeToken(plumberAlpha);
    const tokenStudent = makeToken(testStudent);

    // =========================================================================
    // PHASE 1: CORE AUTHORIZATION AND DATABASE FOUNDATION
    // =========================================================================
    console.log("\n🔒 PHASE 1: Core Authorization & Database Foundation...");

    // 1.1 MAIN_ADMIN role separation from HEADWARDEN
    const resAdminOnly = await fetch(`${API_BASE}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${tokenHead}` }
    });
    assert(resAdminOnly.status === 403, "1.1 HEADWARDEN cannot access MAIN_ADMIN restricted routes (HTTP 403)");

    const resWardenAdminOnly = await fetch(`${API_BASE}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${tokenWarden}` }
    });
    assert(resWardenAdminOnly.status === 403, "1.2 WARDEN cannot access MAIN_ADMIN restricted routes (HTTP 403)");

    const resStudentAdminOnly = await fetch(`${API_BASE}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${tokenStudent}` }
    });
    assert(resStudentAdminOnly.status === 403, "1.3 STUDENT cannot access MAIN_ADMIN restricted routes (HTTP 403)");

    const resSuperAdminAccess = await fetch(`${API_BASE}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert(resSuperAdminAccess.status === 200, "1.4 MAIN_ADMIN accesses audit logs successfully (HTTP 200)");

    // 1.2 Database-driven departments
    const allDepts = await Department.find({ isActive: true });
    assert(allDepts.length >= 7, `1.5 Initial departments present in DB (Found: ${allDepts.length} >= 7)`);

    // 1.3 Anti-Ragging Access Barrier
    const resAR_Warden = await fetch(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${tokenWarden}` }
    });
    assert(resAR_Warden.status === 403, "1.6 WARDEN strictly blocked with 403 from Anti-Ragging");

    const resAR_Head = await fetch(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${tokenHead}` }
    });
    assert(resAR_Head.status === 403, "1.7 HEADWARDEN strictly blocked with 403 from Anti-Ragging");

    const resAR_Incharge = await fetch(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${tokenIncharge}` }
    });
    assert(resAR_Incharge.status === 200, "1.8 INCHARGE permitted to access Anti-Ragging vault (HTTP 200)");

    // 1.4 Management-controlled availability
    const resAvail = await fetch(`${API_BASE}/admin/staff/${plumberAlpha._id}/availability`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: false, availabilityReason: "On medical leave" })
    });
    const availJson = await resAvail.json();
    assert(resAvail.status === 200 && availJson.isAvailable === false, "1.9 Staff availability updated to false by Management");

    const pAlphaCheck = await User.findById(plumberAlpha._id);
    assert(pAlphaCheck.isAvailable === false, "1.10 Employee isAvailable persisted in DB");

    // Restore availability for next phases
    await User.findByIdAndUpdate(plumberAlpha._id, { isAvailable: true, availabilityReason: "" });

    // =========================================================================
    // PHASE 2: MAIN_ADMIN CONTROL PANEL ENDPOINTS
    // =========================================================================
    console.log("\n🎛️ PHASE 2: Main Admin Control Panel & Management APIs...");

    // 2.1 Department Management
    const testDeptCode = `DEPT_${Date.now().toString().slice(-4)}`;
    const resCreateDept = await fetch(`${API_BASE}/admin/departments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            name: `Specialized ${testDeptCode}`,
            code: testDeptCode,
            description: "Custom operational department",
            template: "GENERAL_STAFF",
            workloadPolicy: { weightPending: 1, weightOverdue: 3 }
        })
    });
    assert(resCreateDept.status === 201, "2.1 MAIN_ADMIN creates custom department (HTTP 201)");

    // 2.2 Category Management
    const resCreateCat = await fetch(`${API_BASE}/admin/categories`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            name: `Pressure Valve Leak ${testDeptCode}`,
            departmentId: plumbingDept._id,
            description: "Water pressure regulator failure",
            defaultPriority: "High"
        })
    });
    assert(resCreateCat.status === 201, "2.2 MAIN_ADMIN creates complaint category (HTTP 201)");

    const resGetCats = await fetch(`${API_BASE}/admin/categories`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const catsData = await resGetCats.json();
    assert(resGetCats.status === 200 && catsData.count > 0, `2.3 Fetched categories list (Count: ${catsData.count})`);

    // 2.3 Dashboard Instances
    const resCreateInst = await fetch(`${API_BASE}/admin/instances`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Plumbing Quick Response Unit 2",
            departmentId: plumbingDept._id,
            templateId: "PLUMBING_OPS",
            activeModules: ["assigned_work", "work_history", "inventory"]
        })
    });
    assert(resCreateInst.status === 201, "2.4 MAIN_ADMIN creates dashboard instance (HTTP 201)");

    // 2.4 Multiple Dashboard Permissions Assignment with Warning/Audit
    // Request multiple permissions without confirmation -> should return requiresConfirmation
    const resPermReq = await fetch(`${API_BASE}/admin/staff/${plumberAlpha._id}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            dashboardPermissions: ["PLUMBING", "ELECTRICAL"],
            confirmedMultipleAccess: false
        })
    });
    const permReqJson = await resPermReq.json();
    assert(permReqJson.requiresConfirmation === true, "2.5 Multiple permissions request triggers confirmation notice");

    // Confirm multiple permissions
    const resPermConfirm = await fetch(`${API_BASE}/admin/staff/${plumberAlpha._id}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            dashboardPermissions: ["PLUMBING", "ELECTRICAL"],
            confirmedMultipleAccess: true
        })
    });
    assert(resPermConfirm.status === 200, "2.6 Multiple permissions confirmed and applied (HTTP 200)");

    // Verify AuditLog
    const auditPerm = await AuditLog.findOne({
        action: "PERMISSIONS_UPDATED",
        "target.identifier": plumberAlpha.email
    }).sort({ timestamp: -1 });
    assert(auditPerm && auditPerm.details.confirmedMultipleAccess === true, "2.7 Permission change auditable with confirmation logged in AuditLog");

    // 2.5 Export Permissions Configuration
    const resExportPerm = await fetch(`${API_BASE}/admin/staff/${plumberAlpha._id}/export-permissions`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({ exportPermissions: true })
    });
    const exportJson = await resExportPerm.json();
    assert(resExportPerm.status === 200 && exportJson.exportPermissions === true, "2.8 Export permissions toggled on for staff");

    // 2.6 Global Monitoring Feed
    const resFeed = await fetch(`${API_BASE}/admin/monitoring/feed?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const feedJson = await resFeed.json();
    assert(resFeed.status === 200 && feedJson.complaints !== undefined, "2.9 Global Monitoring Feed retrieved successfully");

    // =========================================================================
    // PHASE 3: AUTOMATIC COMPLAINT ROUTING & WORKLOAD BALANCING
    // =========================================================================
    console.log("\n⚖️ PHASE 3: Automatic Complaint Routing & Workload Balancing...");

    // Clean existing open complaints for Plumber Alpha & Beta to benchmark clean balance
    await Complaint.deleteMany({
        status: { $in: ["Pending", "In Progress"] },
        category: "Plumbing"
    });
    // Set other plumbers temporarily off-duty so Alpha & Beta are the isolated test pair
    await Staff.updateMany(
        { email: { $nin: ["plumber.alpha@pict.edu", "plumber.beta@pict.edu"] } },
        { isAvailable: false }
    );
    await Staff.findByIdAndUpdate(plumberAlpha._id, { isAvailable: true, isActive: true });
    await Staff.findByIdAndUpdate(plumberBeta._id, { isAvailable: true, isActive: true });

    // 3.1 First complaint submitted -> Plumber Alpha and Beta both at 0 load.
    const resComp1 = await fetch(`${API_BASE}/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStudent}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            title: "Shower Valve Jammed in Room 201",
            description: "Water won't turn off from main shower tap.",
            category: "Plumbing"
        })
    });
    const c1Json = await resComp1.json();
    const c1Id = c1Json.complaint?._id || c1Json._id;
    assert(resComp1.status === 201, "3.1 Student complaint 1 submitted with category 'Plumbing' (HTTP 201)");

    const c1Doc = await Complaint.findById(c1Id);
    const firstAssigned = c1Doc.assignedTo.toString();
    const otherPlumber = firstAssigned === plumberAlpha._id.toString() ? plumberBeta._id.toString() : plumberAlpha._id.toString();
    assert(firstAssigned === plumberAlpha._id.toString() || firstAssigned === plumberBeta._id.toString(), "3.2 Complaint 1 automatically assigned to an eligible plumber without Warden dispatch");

    // Verify append-only history for complaint 1
    const events1 = await ComplaintEvent.find({ complaintId: c1Doc._id }).sort({ timestamp: 1 });
    assert(events1.some(e => e.eventType === "SUBMITTED"), "3.3 Event 'SUBMITTED' recorded");
    assert(events1.some(e => e.eventType === "ROUTED"), "3.4 Event 'ROUTED' recorded with department details");
    assert(events1.some(e => e.eventType === "ASSIGNED"), "3.5 Event 'ASSIGNED' recorded with workload score");

    // 3.2 Second complaint submitted -> Workload Router MUST choose the other plumber (who is currently at 0 load)
    const resComp2 = await fetch(`${API_BASE}/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStudent}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            title: "Basin Pipe Leaking in Room 201",
            description: "Continuous dripping under the washbasin.",
            category: "Plumbing"
        })
    });
    const c2Json = await resComp2.json();
    const c2Id = c2Json.complaint?._id || c2Json._id;
    const c2Doc = await Complaint.findById(c2Id);
    assert(c2Doc.assignedTo.toString() === otherPlumber, "3.6 Complaint 2 automatically assigned to least-loaded Plumber (Least-active load balancing verified!)");

    // 3.3 Concurrency Test: Submit 4 simultaneous complaints
    console.log("  Running concurrency race test: 4 simultaneous complaint submissions...");
    const promises = [1, 2, 3, 4].map(i =>
        fetch(`${API_BASE}/complaints`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenStudent}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                title: `Concurrent Plumbing Issue #${i} Room 201`,
                description: `Stress testing automated router concurrency #${i}`,
                category: "Plumbing"
            })
        }).then(r => r.json())
    );
    const concurrentResults = await Promise.all(promises);
    if (!concurrentResults[0]?.complaint?._id) {
        console.log("  [DEBUG concurrentResults]:", concurrentResults);
    }
    const concurrentIds = concurrentResults.map(r => r.complaint?._id || r._id);

    const concurrentDocs = await Complaint.find({ _id: { $in: concurrentIds } });
    const countAlpha = concurrentDocs.filter(c => c.assignedTo && c.assignedTo.toString() === plumberAlpha._id.toString()).length;
    const countBeta = concurrentDocs.filter(c => c.assignedTo && c.assignedTo.toString() === plumberBeta._id.toString()).length;
    assert(countAlpha > 0 && countBeta > 0, `3.7 Concurrency safety: Work distributed across both plumbers (Alpha: ${countAlpha}, Beta: ${countBeta})`);

    // 3.4 Availability Bypass: Mark Plumber Beta unavailable
    await Staff.findByIdAndUpdate(plumberBeta._id, { isAvailable: false, availabilityReason: "Shift ended" });

    const resCompAvail = await fetch(`${API_BASE}/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStudent}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            title: "Flush Tank Stuck in Room 201",
            description: "Bypass test for unavailable technician",
            category: "Plumbing"
        })
    });
    const cAvailJson = await resCompAvail.json();
    const cAvailId = cAvailJson.complaint?._id || cAvailJson._id;
    const cAvailDoc = await Complaint.findById(cAvailId);
    console.log("  [DEBUG 3.8 cAvailDoc.assignedTo]:", cAvailDoc?.assignedTo, "Alpha:", plumberAlpha._id, "Beta:", plumberBeta._id);
    assert(cAvailDoc.assignedTo.toString() === plumberAlpha._id.toString(), "3.8 Router correctly bypassed unavailable Plumber Beta and assigned to available Plumber Alpha");

    // 3.5 Reassignment Workflow with Mandatory Reason
    const resReassignFail = await fetch(`${API_BASE}/complaints/${cAvailDoc._id}/reassign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newStaffId: plumberBeta._id, reason: "" })
    });
    assert(resReassignFail.status === 400, "3.9 Reassignment rejected if mandatory reason is missing (HTTP 400)");

    const resReassignSuccess = await fetch(`${API_BASE}/complaints/${cAvailDoc._id}/reassign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenAdmin}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            newStaffId: plumberBeta._id,
            reason: "Reassigned for urgent specialized repair."
        })
    });
    assert(resReassignSuccess.status === 200, "3.10 Reassignment executed successfully with mandatory reason (HTTP 200)");

    const reassignDoc = await Complaint.findById(cAvailDoc._id);
    assert(reassignDoc.assignedTo.toString() === plumberBeta._id.toString(), "3.11 Reassigned complaint now assigned to Plumber Beta");
    assert(reassignDoc.reassignmentHistory.length > 0 && reassignDoc.reassignmentHistory[0].reason === "Reassigned for urgent specialized repair.", "3.12 Reassignment history entry preserved on complaint");

    // Cleanup test data
    await User.findByIdAndUpdate(plumberBeta._id, { isAvailable: true, availabilityReason: "" });

    console.log("\n================================================================================");
    console.log(`📊 FINAL SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("Test suite runtime failure:", err);
    process.exit(1);
});
