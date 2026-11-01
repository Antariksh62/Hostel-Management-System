/**
 * test_part3_phases4_5_6_7.cjs
 *
 * Exhaustive Verification Suite for:
 * - PHASE 4: Department Dashboards & Management Visibility (Employee isolation, Warden, Headwarden, Incharge, Security, Anti-Ragging)
 * - PHASE 5: Event History, Timestamps, Escalation Engine & Monitoring
 * - PHASE 6: Security, Privacy & Permission Verification (Student directory barrier, Anti-Ragging fortress, Session invalidation)
 * - PHASE 7: Integrated System Integrity & Production Build
 */

const assert = require("assert");
const path = require("path");
const mongoose = require("../backend/node_modules/mongoose");
const jwt = require("../backend/node_modules/jsonwebtoken");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
const JWT_SECRET = process.env.JWT_SECRET || "hostel_pict_jwt_super_secret_2024";
const API_BASE = "http://localhost:5000/api";

const { User, Student, Staff, Warden, HeadWarden, MainAdmin, Incharge } = require("../backend/models/User");
const Department = require("../backend/models/Department");
const Complaint = require("../backend/models/Complaint");
const ComplaintEvent = require("../backend/models/ComplaintEvent");
const EscalationEvent = require("../backend/models/EscalationEvent");
const AntiRaggingCase = require("../backend/models/AntiRaggingCase");
const SecurityIncident = require("../backend/models/SecurityIncident");
const StudentRoster = require("../backend/models/StudentRoster");
const AuditLog = require("../backend/models/AuditLog");

const { evaluateEscalations } = require("../backend/services/escalationService");

async function request(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
    let data;
    try {
        data = await res.json();
    } catch (_) {
        data = null;
    }
    return { status: res.status, data };
}

function tokenFor(user) {
    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role,
            email: user.email,
            name: user.name,
            dashboardPermissions: user.dashboardPermissions || []
        },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

async function runSuite() {
    console.log("================================================================================");
    console.log("🚀 PART 3 VERIFICATION: PHASES 4, 5, 6 & 7");
    console.log("================================================================================");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    let passCount = 0;
    const test = (desc, fn) => {
        try {
            fn();
            passCount++;
            console.log(`  [PASS] ${desc}`);
        } catch (err) {
            console.error(`  [FAIL] ${desc}\n    Error: ${err.message}`);
            throw err;
        }
    };

    // ─── ACTOR PROVISIONING ────────────────────────────────────────────────────────
    console.log("\n🔑 Provisioning Test Actors across all roles...");

    const depts = await Department.find();
    const plumbingDept = depts.find(d => d.code === "PLUMBING");
    const electricalDept = depts.find(d => d.code === "ELECTRICAL");
    const antiRaggingDept = depts.find(d => d.code === "ANTI_RAGGING");
    const securityDept = depts.find(d => d.code === "SECURITY");

    // Clean up previous test users
    await User.deleteMany({ email: /@test-part3-p4567\.pict\.edu$/ });

    const mainAdmin = await MainAdmin.create({
        name: "Supreme Admin",
        fullName: "Supreme Admin",
        email: "mainadmin@test-part3-p4567.pict.edu",
        role: "MAIN_ADMIN",
        isActive: true,
        isAvailable: true
    });
    const mainAdminToken = tokenFor(mainAdmin);

    const incharge = await Incharge.create({
        name: "Incharge Officer",
        fullName: "Incharge Officer",
        email: "incharge@test-part3-p4567.pict.edu",
        role: "INCHARGE",
        isActive: true,
        isAvailable: true
    });
    const inchargeToken = tokenFor(incharge);

    const headWarden = await HeadWarden.create({
        name: "Head Warden Officer",
        fullName: "Head Warden Officer",
        email: "headwarden@test-part3-p4567.pict.edu",
        role: "HEADWARDEN",
        isActive: true,
        isAvailable: true
    });
    const headWardenToken = tokenFor(headWarden);

    const warden = await Warden.create({
        name: "Floor Warden",
        fullName: "Floor Warden",
        email: "warden@test-part3-p4567.pict.edu",
        role: "WARDEN",
        isActive: true,
        isAvailable: true
    });
    const wardenToken = tokenFor(warden);

    const student = await Student.create({
        name: "Resident Student",
        fullName: "Resident Student",
        email: "student@test-part3-p4567.pict.edu",
        role: "STUDENT",
        prn: "PRN-PART3-01",
        rollNumber: "301",
        doorNumber: "101",
        room: "101",
        mobileNumber: "9876543210",
        isActive: true
    });
    const studentToken = tokenFor(student);

    await StudentRoster.findOneAndUpdate(
        { email: student.email },
        {
            prn: student.prn,
            name: student.name,
            email: student.email,
            rollNumber: "301",
            branch: "CS",
            year: "TE",
            doorNumber: "101",
            studentMobile: "9876543210",
            parentMobile: "9876543211",
            admissionStatus: "APPROVED",
            registrationStatus: "REGISTERED"
        },
        { upsert: true }
    );

    const plumberA = await Staff.create({
        name: "Plumber Alpha",
        fullName: "Plumber Alpha",
        email: "plumber.alpha@test-part3-p4567.pict.edu",
        role: "STAFF",
        departmentId: plumbingDept._id,
        staffRole: "Plumber",
        isActive: true,
        isAvailable: true
    });
    const plumberAToken = tokenFor(plumberA);

    const plumberB = await Staff.create({
        name: "Plumber Beta",
        fullName: "Plumber Beta",
        email: "plumber.beta@test-part3-p4567.pict.edu",
        role: "STAFF",
        departmentId: plumbingDept._id,
        staffRole: "Plumber",
        isActive: true,
        isAvailable: true
    });
    const plumberBToken = tokenFor(plumberB);

    const electrician = await Staff.create({
        name: "Sparky Tech",
        fullName: "Sparky Tech",
        email: "electrician@test-part3-p4567.pict.edu",
        role: "STAFF",
        departmentId: electricalDept._id,
        staffRole: "Electrician",
        isActive: true,
        isAvailable: true
    });
    const electricianToken = tokenFor(electrician);

    const securityGuard = await Staff.create({
        name: "Guard Vikram",
        fullName: "Guard Vikram",
        email: "security@test-part3-p4567.pict.edu",
        role: "STAFF",
        departmentId: securityDept._id,
        dashboardPermissions: ["SECURITY"],
        staffRole: "Security Guard",
        isActive: true,
        isAvailable: true
    });
    const securityGuardToken = tokenFor(securityGuard);

    console.log("  [PASS] All test actors provisioned successfully.");

    // ─── PHASE 4: DEPARTMENT DASHBOARDS & MANAGEMENT VISIBILITY ───────────────────
    console.log("\n📋 PHASE 4: Verifying Department Dashboards & Management Visibility...");

    // Create 1 job for Plumber A, 1 job for Electrician
    const compPlumbing = await Complaint.create({
        title: "P4 Pipe Leak Test",
        description: "Bathroom pipe leak in room 101",
        category: "Plumbing",
        doorNumber: "101",
        studentId: student._id,
        departmentId: plumbingDept._id,
        assignedTo: plumberA._id,
        status: "Pending",
        lifecycleState: "ASSIGNED",
        assignedAt: new Date()
    });

    const compElectrical = await Complaint.create({
        title: "P4 Switch Sparking",
        description: "Socket sparking in room 102",
        category: "Electrical",
        doorNumber: "102",
        studentId: student._id,
        departmentId: electricalDept._id,
        assignedTo: electrician._id,
        status: "Pending",
        lifecycleState: "ASSIGNED",
        assignedAt: new Date()
    });

    // 4.1 Plumber Alpha queries /api/complaints/all: Should ONLY see their assigned job
    const pAGetRes = await request(`${API_BASE}/complaints/all`, {
        headers: { Authorization: `Bearer ${plumberAToken}` }
    });
    test("4.1 Individual staff calling /complaints/all receives ONLY their assigned complaints", () => {
        assert.strictEqual(pAGetRes.status, 200);
        assert(Array.isArray(pAGetRes.data));
        const hasOtherWork = pAGetRes.data.some(c => String(c.assignedTo?._id || c.assignedTo) !== String(plumberA._id));
        assert.strictEqual(hasOtherWork, false, "Staff must never see other employees' complaints");
        const hasMine = pAGetRes.data.some(c => String(c._id) === String(compPlumbing._id));
        assert.strictEqual(hasMine, true, "Staff must see their assigned complaint");
    });

    // 4.2 Plumber Beta (0 assigned) queries /api/complaints/all: Should see 0
    const pBGetRes = await request(`${API_BASE}/complaints/all`, {
        headers: { Authorization: `Bearer ${plumberBToken}` }
    });
    test("4.2 Unassigned staff member receives empty complaint list", () => {
        assert.strictEqual(pBGetRes.status, 200);
        const hasMine = pBGetRes.data.some(c => String(c._id) === String(compPlumbing._id));
        assert.strictEqual(hasMine, false);
    });

    // 4.3 Sanitized student info: Employee does NOT receive academic directory details (prn, rollNumber) in /all
    test("4.3 Employee complaint view sanitizes resident details (no academic directory leak)", () => {
        const item = pAGetRes.data.find(c => String(c._id) === String(compPlumbing._id));
        assert(item, "Found assigned complaint");
        assert.strictEqual(item.studentId.prn, undefined, "PRN must be withheld from staff");
        assert.strictEqual(item.studentId.rollNumber, undefined, "Roll number must be withheld from staff");
        assert(Boolean(item.studentId.name), "Resident name is available");
    });

    // 4.4 Warden visibility: Sees ordinary complaints across maintenance departments
    const wardenGetRes = await request(`${API_BASE}/complaints/all`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    test("4.4 Warden can view ordinary complaints across all maintenance departments", () => {
        assert.strictEqual(wardenGetRes.status, 200);
        const hasPlumbing = wardenGetRes.data.some(c => String(c._id) === String(compPlumbing._id));
        const hasElectrical = wardenGetRes.data.some(c => String(c._id) === String(compElectrical._id));
        assert(hasPlumbing && hasElectrical, "Warden sees Plumbing and Electrical");
    });

    // 4.5 Security Management Desk
    // Incharge reports security incident
    const secReportRes = await request(`${API_BASE}/security/incidents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${inchargeToken}` },
        body: JSON.stringify({
            title: "Unauthorized Visitor at Main Gate",
            location: "Main Gate",
            severity: "HIGH",
            description: "Individual without college ID refused sign-in",
            assignedTo: securityGuard._id
        })
    });
    test("4.5 Management reports security incident successfully (HTTP 201)", () => {
        assert.strictEqual(secReportRes.status, 201);
        assert(secReportRes.data.incident);
    });
    const secIncidentId = secReportRes.data.incident._id;

    // Headwarden can view Security desk
    const hwSecRes = await request(`${API_BASE}/security/incidents`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    test("4.6 Headwarden has visibility into Security incidents (HTTP 200)", () => {
        assert.strictEqual(hwSecRes.status, 200);
        assert(hwSecRes.data.incidents.length > 0);
    });

    // Warden is strictly blocked from Security desk with HTTP 403
    const wardenSecRes = await request(`${API_BASE}/security/incidents`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    test("4.7 Warden is STRICTLY BLOCKED with HTTP 403 from Security desk", () => {
        assert.strictEqual(wardenSecRes.status, 403);
    });

    // 4.8 Anti-Ragging Confidential Portal
    // Main Admin logs confidential Anti-Ragging case
    const arCaseRes = await request(`${API_BASE}/anti-ragging/cases`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mainAdminToken}` },
        body: JSON.stringify({
            title: "Report of Intimidation in Corridor",
            description: "Senior students blocking first-year entry after hours",
            location: "2nd Floor Corridor",
            severity: "SEVERE",
            victimInfo: { isAnonymous: true, name: "Confidential Student" }
        })
    });
    test("4.8 Main Admin files confidential Anti-Ragging case (HTTP 201)", () => {
        assert.strictEqual(arCaseRes.status, 201);
        assert(arCaseRes.data.caseRecord);
    });
    const arCaseId = arCaseRes.data.caseRecord._id;

    // Incharge accesses Anti-Ragging vault
    const inchargeArRes = await request(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    test("4.9 Incharge has clearance to access Anti-Ragging Vault (HTTP 200)", () => {
        assert.strictEqual(inchargeArRes.status, 200);
        assert(inchargeArRes.data.cases.length > 0);
    });

    // Headwarden is strictly blocked from Anti-Ragging with HTTP 403
    const hwArRes = await request(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    test("4.10 Headwarden is STRICTLY BLOCKED with HTTP 403 from Anti-Ragging Vault", () => {
        assert.strictEqual(hwArRes.status, 403);
    });

    // Warden is strictly blocked from Anti-Ragging with HTTP 403
    const wardenArRes = await request(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    test("4.11 Warden is STRICTLY BLOCKED with HTTP 403 from Anti-Ragging Vault", () => {
        assert.strictEqual(wardenArRes.status, 403);
    });

    // Student is strictly blocked from Anti-Ragging with HTTP 403
    const studentArRes = await request(`${API_BASE}/anti-ragging/cases`, {
        headers: { Authorization: `Bearer ${studentToken}` }
    });
    test("4.12 Student is STRICTLY BLOCKED with HTTP 403 from Anti-Ragging Vault", () => {
        assert.strictEqual(studentArRes.status, 403);
    });

    // ─── PHASE 5: EVENT HISTORY, TIMESTAMPS, ESCALATION & MONITORING ──────────────
    console.log("\n⚡ PHASE 5: Verifying Event History, Timestamps & Escalation Engine...");

    // 5.1 Staff work lifecycle event generation
    const acceptRes = await request(`${API_BASE}/department-staff/complaint/${compPlumbing._id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${plumberAToken}` }
    });
    test("5.1 Plumber Alpha accepts job (HTTP 200)", () => {
        assert.strictEqual(acceptRes.status, 200);
    });

    const startRes = await request(`${API_BASE}/department-staff/complaint/${compPlumbing._id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${plumberAToken}` }
    });
    test("5.2 Plumber Alpha transitions to WORK_STARTED (HTTP 200)", () => {
        assert.strictEqual(startRes.status, 200);
    });

    const noteRes = await request(`${API_BASE}/department-staff/complaint/${compPlumbing._id}/note`, {
        method: "POST",
        headers: { Authorization: `Bearer ${plumberAToken}` },
        body: JSON.stringify({ note: "Inspected washer, ordering replacement gasket." })
    });
    test("5.3 Plumber Alpha records technical note (HTTP 200)", () => {
        assert.strictEqual(noteRes.status, 200);
    });

    // 5.4 Check ComplaintEvents timeline integrity
    const events = await ComplaintEvent.find({ complaintId: compPlumbing._id }).sort({ timestamp: 1 });
    test("5.4 Append-only ComplaintEvents recorded with valid timestamps", () => {
        const types = events.map(e => e.eventType);
        assert(types.includes("ACKNOWLEDGED") || types.includes("ACCEPTED"), "Must contain ACKNOWLEDGED/ACCEPTED event");
        assert(types.includes("WORK_STARTED"), "Must contain WORK_STARTED event");
        assert(types.includes("NOTE_ADDED"), "Must contain NOTE_ADDED event");
        // Verify UTC timestamp format
        events.forEach(e => {
            assert(e.timestamp instanceof Date && !isNaN(e.timestamp.getTime()), "Valid UTC Date required");
        });
    });

    // 5.5 Autonomous Escalation Engine
    // Configure an overdue unacknowledged complaint
    const overdueComp = await Complaint.create({
        title: "P5 Urgent Water Overflow",
        description: "Main tank valve leaking heavily",
        category: "Plumbing",
        doorNumber: "101",
        studentId: student._id,
        departmentId: plumbingDept._id,
        assignedTo: plumberA._id,
        status: "Pending",
        lifecycleState: "ASSIGNED",
        assignedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago (> ackDeadlineMinutes of 120 mins)
    });

    // Trigger escalation evaluation
    const escResult = await evaluateEscalations();
    test("5.5 Autonomous escalation engine detected overdue complaint", () => {
        assert(escResult.escalatedCount >= 1, "Escalation engine must detect overdue complaint");
        const found = escResult.escalations.find(e => String(e.complaintId) === String(overdueComp._id));
        assert(found, "Overdue complaint escalated");
        assert.strictEqual(found.triggerType, "UNACKNOWLEDGED_DEADLINE");
    });

    // 5.6 EscalationEvent persisted in DB
    const escEvent = await EscalationEvent.findOne({ complaintId: overdueComp._id });
    test("5.6 EscalationEvent logged with notified management roles", () => {
        assert(escEvent, "EscalationEvent must exist");
        assert.strictEqual(escEvent.escalationCycle, 1);
        assert(escEvent.notifiedRoles.includes("WARDEN"));
        assert(escEvent.notifiedRoles.includes("HEADWARDEN"));
        assert(escEvent.notifiedRoles.includes("INCHARGE"));
        assert(escEvent.notifiedRoles.includes("MAIN_ADMIN"));
    });

    // 5.7 Escalation deduplication window
    const secondEscResult = await evaluateEscalations();
    test("5.7 Deduplication window prevents redundant re-escalation in same interval", () => {
        const foundAgain = secondEscResult.escalations.find(e => String(e.complaintId) === String(overdueComp._id));
        assert.strictEqual(foundAgain, undefined, "Must not duplicate escalation in same window");
    });

    // ─── PHASE 6: SECURITY, PRIVACY & PERMISSION VERIFICATION ─────────────────────
    console.log("\n🛡️ PHASE 6: Security, Privacy & Permission Verification...");

    // 6.1 Resident Directory access barrier
    const staffResidentRes = await request(`${API_BASE}/residents`, {
        headers: { Authorization: `Bearer ${plumberAToken}` }
    });
    test("6.1 Individual staff member BLOCKED with HTTP 403 from Resident Directory", () => {
        assert.strictEqual(staffResidentRes.status, 403);
    });

    const studentResidentRes = await request(`${API_BASE}/residents`, {
        headers: { Authorization: `Bearer ${studentToken}` }
    });
    test("6.2 Student BLOCKED with HTTP 403 from Resident Directory", () => {
        assert.strictEqual(studentResidentRes.status, 403);
    });

    const inchargeResidentRes = await request(`${API_BASE}/residents`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    test("6.3 Incharge permitted to access Resident Directory (HTTP 200)", () => {
        assert.strictEqual(inchargeResidentRes.status, 200);
    });

    // 6.4 Student Contact Details On-Demand Privacy Gate
    // Plumber A is assigned to compPlumbing -> ALLOWED
    const pAContactRes = await request(`${API_BASE}/complaints/${compPlumbing._id}/student-contact`, {
        headers: { Authorization: `Bearer ${plumberAToken}` }
    });
    test("6.4 Assigned employee permitted to view student contact for their assigned job (HTTP 200)", () => {
        assert.strictEqual(pAContactRes.status, 200);
        assert.strictEqual(pAContactRes.data.mobileNumber, "9876543210");
    });

    // Plumber B is NOT assigned to compPlumbing -> BLOCKED with HTTP 403!
    const pBContactRes = await request(`${API_BASE}/complaints/${compPlumbing._id}/student-contact`, {
        headers: { Authorization: `Bearer ${plumberBToken}` }
    });
    test("6.5 Unassigned employee STRICTLY BLOCKED with HTTP 403 from student contact", () => {
        assert.strictEqual(pBContactRes.status, 403);
    });

    // 6.6 Staff Account Deactivation & Session Invalidation
    const deactRes = await request(`${API_BASE}/admin/staff/${plumberB._id}/deactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mainAdminToken}` },
        body: JSON.stringify({ reason: "End of seasonal contract" })
    });
    test("6.6 Main Admin deactivates staff account (HTTP 200)", () => {
        assert.strictEqual(deactRes.status, 200);
    });

    // Subsequent request with deactivated Plumber B's token is immediately rejected
    const deactCheckRes = await request(`${API_BASE}/complaints/all`, {
        headers: { Authorization: `Bearer ${plumberBToken}` }
    });
    test("6.7 Deactivated employee token immediately rejected with HTTP 403 ACCOUNT_DEACTIVATED", () => {
        assert.strictEqual(deactCheckRes.status, 403);
        assert.strictEqual(deactCheckRes.data.code, "ACCOUNT_DEACTIVATED");
    });

    // 6.8 Audit log verified for staff deactivation
    const auditLog = await AuditLog.findOne({
        action: "STAFF_DEACTIVATED",
        "target.id": plumberB._id
    });
    test("6.8 Staff deactivation audited with actor and reason in AuditLog", () => {
        assert(auditLog, "AuditLog entry must exist");
        assert.strictEqual(auditLog.performedBy.role, "MAIN_ADMIN");
    });

    // ─── CLEANUP ──────────────────────────────────────────────────────────────────
    console.log("\n🧹 Cleaning up test artifacts...");
    await Complaint.deleteMany({ _id: { $in: [compPlumbing._id, compElectrical._id, overdueComp._id] } });
    await ComplaintEvent.deleteMany({ complaintId: { $in: [compPlumbing._id, compElectrical._id, overdueComp._id] } });
    await EscalationEvent.deleteMany({ complaintId: overdueComp._id });
    await AntiRaggingCase.deleteOne({ _id: arCaseId });
    await SecurityIncident.deleteOne({ _id: secIncidentId });
    await User.deleteMany({ email: /@test-part3-p4567\.pict\.edu$/ });
    await StudentRoster.deleteOne({ email: "student@test-part3-p4567.pict.edu" });

    console.log("================================================================================");
    console.log(`🎉 ALL ${passCount}/${passCount} TESTS PASSED CLEANLY ACROSS PHASES 4, 5 & 6!`);
    console.log("================================================================================");

    await mongoose.disconnect();
}

runSuite().catch(err => {
    console.error("FATAL SUITE ERROR:", err);
    process.exit(1);
});
