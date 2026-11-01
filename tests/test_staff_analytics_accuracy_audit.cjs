const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { User, Student, Warden, HeadWarden, Incharge, Staff, WifiIncharge } = require("../backend/models/User");
const Complaint = require("../backend/models/Complaint");
const { syncRoomOccupancy } = require("../backend/services/roomOccupancyService");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const API_URL = "http://localhost:5000/api";

const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
};

async function runAccuracyAudit() {
    console.log("===============================================================================");
    console.log("FINAL STAFF PERFORMANCE ANALYTICS ACCURACY & FAIR ATTRIBUTION AUDIT");
    console.log("===============================================================================");

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");

    // Clean previous test data
    await User.deleteMany({ email: /@audit-test\.local$/ });
    await Complaint.deleteMany({ title: /\[ACCURACY-AUDIT\]/ });

    const baselineTotal = await Complaint.countDocuments();
    const baselineFloor2 = await Complaint.countDocuments({ doorNumber: { $in: ["201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "212", "213", "214", "215", "216", "217"] } });

    // 1. Create Roles
    const headWarden = await HeadWarden.create({
        name: "Audit Head Warden",
        email: "headwarden@audit-test.local",
        role: "HEADWARDEN"
    });

    const warden = await Warden.create({
        name: "Audit Regular Warden",
        email: "warden@audit-test.local",
        role: "WARDEN"
    });

    const incharge = await Incharge.create({
        name: "Audit Hostel Incharge",
        email: "incharge@audit-test.local",
        role: "INCHARGE",
        officeLocation: "HOIDSS Office"
    });

    const staffA = await Staff.create({
        name: "Ravi Carpenter",
        email: "ravi@audit-test.local",
        role: "STAFF",
        staffRole: "Carpentry",
        phoneNumber: "9811100001"
    });

    const staffB = await Staff.create({
        name: "Manoj Electrician",
        email: "manoj@audit-test.local",
        role: "STAFF",
        staffRole: "Electrical",
        phoneNumber: "9811100002"
    });

    const wifiStaff = await Staff.create({
        name: "Amit Wi-Fi Tech",
        email: "amit@audit-test.local",
        role: "STAFF",
        staffRole: "Wi-Fi Specialist",
        phoneNumber: "9811100003"
    });

    const student1 = await Student.create({
        name: "Audit Student 1",
        fullName: "Audit Student One",
        email: "student1@audit-test.local",
        role: "STUDENT",
        prn: "AUDIT_PRN_001",
        branch: "CE",
        year: "FY",
        doorNumber: "101",
        mobileNumber: "9123450001"
    });

    const student2 = await Student.create({
        name: "Audit Student 2",
        fullName: "Audit Student Two",
        email: "student2@audit-test.local",
        role: "STUDENT",
        prn: "AUDIT_PRN_002",
        branch: "IT",
        year: "SY",
        doorNumber: "201",
        mobileNumber: "9123450002"
    });

    const headWardenToken = generateToken(headWarden);
    const wardenToken = generateToken(warden);
    const inchargeToken = generateToken(incharge);

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 1: Point 1 & Point 5 — Multi-attempt, Multi-status Transitions
    // A single complaint with 6 status changes, 2 reopens, 3 resolution attempts.
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 1 & 5: Single Unique Counting & Multi-Reopen Timestamp Accuracy ---");
    const t0 = new Date(Date.now() - 3600000 * 20);
    const t1 = new Date(Date.now() - 3600000 * 18);
    const t2 = new Date(Date.now() - 3600000 * 15);
    const t3 = new Date(Date.now() - 3600000 * 12);
    const t4 = new Date(Date.now() - 3600000 * 9);
    const t5 = new Date(Date.now() - 3600000 * 6);
    const t6 = new Date(Date.now() - 3600000 * 2);

    const compMulti = await Complaint.create({
        title: "[ACCURACY-AUDIT] Door Hinge Jammed (Multi-Reopen)",
        description: "Door hinge stuck and squeaking",
        category: "Furniture",
        studentId: student1._id,
        doorNumber: "101",
        assignedTo: staffA._id,
        assignedAt: t1,
        resolvedAt: t6,
        status: "Resolved",
        createdAt: t0,
        statusHistory: [
            { status: "Pending", timestamp: t0, note: "Ticket opened", actor: "Student" },
            { status: "Assigned", timestamp: t1, note: `Assigned to ${staffA.name}`, actor: "Warden", actorId: warden._id, staffId: staffA._id },
            { status: "Resolved", timestamp: t2, note: "Tightened hinge screws", actor: "Staff", actorId: staffA._id, staffId: staffA._id },
            { status: "Reopened", timestamp: t3, note: "Door still sagging", actor: "Student" },
            { status: "Resolved", timestamp: t4, note: "Applied oil lubricant", actor: "Staff", actorId: staffA._id, staffId: staffA._id },
            { status: "Reopened", timestamp: t5, note: "Hinge screws popped out", actor: "Student" },
            { status: "Resolved", timestamp: t6, note: "Replaced whole hinge set", actor: "Staff", actorId: staffA._id, staffId: staffA._id }
        ],
        feedback: {
            text: "Finally works great!",
            submittedAt: new Date(Date.now() - 3600000 * 1),
            isSatisfied: true,
            roomConfirmedWorking: true
        }
    });

    const timelineRes = await fetch(`${API_URL}/staff-analytics/complaint/${compMulti._id}/timeline`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    assert(timelineRes.status === 200, "Resolution timeline retrieved (HTTP 200)");
    const timelineData = await timelineRes.json();
    const cTimeline = timelineData.complaint;

    // Verify Point 5: Exactly 3 resolution attempts and accurate timestamps
    assert(cTimeline.totalAttempts === 3, "Complaint with 3 resolutions reports totalAttempts = 3");
    assert(cTimeline.reopenCount === 2, "Complaint reopened twice reports reopenCount = 2");
    assert(cTimeline.attempts.length === 3, "Attempts array contains exactly 3 items");
    assert(cTimeline.attempts[0].wasReopenedLater === true, "Attempt 1 marked wasReopenedLater = true");
    assert(cTimeline.attempts[1].wasReopenedLater === true, "Attempt 2 marked wasReopenedLater = true");
    assert(cTimeline.attempts[2].wasReopenedLater === false, "Attempt 3 marked wasReopenedLater = false");
    assert(new Date(cTimeline.attempts[0].timestamp).getTime() === t2.getTime(), "Attempt 1 timestamp matches exact statusHistory t2");
    assert(new Date(cTimeline.attempts[1].timestamp).getTime() === t4.getTime(), "Attempt 2 timestamp matches exact statusHistory t4");
    assert(new Date(cTimeline.attempts[2].timestamp).getTime() === t6.getTime(), "Attempt 3 timestamp matches exact statusHistory t6");

    // Verify Point 1: Single counting in overview
    const overview1Res = await fetch(`${API_URL}/staff-analytics/overview`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    const overview1 = await overview1Res.json();
    assert(overview1.overview.totalHandled === baselineTotal + 1, "Single complaint counted exactly once in totalHandled (increased by exactly 1, not 3 attempts or 7 status events)");
    assert(overview1.overview.notSolvedFirstTryCount >= 1, "Multi-attempt complaint outcome is NOT_SOLVED_FIRST_TRY");
    assert(overview1.overview.firstAttemptSuccessCount === 0, "Multi-attempt complaint is NOT counted as firstAttemptSuccess");

    // -------------------------------------------------------------------------
    // SCENARIO 2: Point 3 & Point 4 — Fair Attribution Across Staff Reassignment
    // Ticket starts with Staff A. Staff A resolves it (Attempt 1). Student reopens.
    // Warden reassigns to Staff B. Staff B resolves it (Attempt 2). Student confirms.
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 3 & 4: Staff Reassignment & Fair Resolution Credit Attribution ---");
    const compReassign = await Complaint.create({
        title: "[ACCURACY-AUDIT] Wall Socket Sparking",
        description: "Socket sparking when plugging laptop",
        category: "Electrical",
        studentId: student2._id,
        doorNumber: "201",
        assignedTo: staffB._id, // Currently assigned to Staff B
        assignedAt: new Date(Date.now() - 3600000 * 8),
        resolvedAt: new Date(Date.now() - 3600000 * 2),
        status: "Resolved",
        createdAt: new Date(Date.now() - 3600000 * 16),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 16), note: "Ticket opened", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 15), note: `Assigned to ${staffA.name}`, actor: "Warden", actorId: warden._id, staffId: staffA._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 12), note: "Tightened socket faceplate", actor: "Staff", actorId: staffA._id, staffId: staffA._id },
            { status: "Reopened", timestamp: new Date(Date.now() - 3600000 * 10), note: "Still sparking internally", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 8), note: `Reassigned to ${staffB.name}`, actor: "Warden", actorId: warden._id, staffId: staffB._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 2), note: "Replaced faulty wiring harness", actor: "Staff", actorId: staffB._id, staffId: staffB._id }
        ],
        feedback: {
            text: "Fixed by Manoj perfectly",
            submittedAt: new Date(Date.now() - 3600000 * 1),
            isSatisfied: true,
            roomConfirmedWorking: true
        }
    });

    const staffTableRes = await fetch(`${API_URL}/staff-analytics/staff-table`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    const staffTable = await staffTableRes.json();
    const rowStaffA = staffTable.staff.find(s => s.staffId === staffA._id.toString());
    const rowStaffB = staffTable.staff.find(s => s.staffId === staffB._id.toString());

    // Staff A performed Attempt 1 (which was reopened later):
    // Staff A should get notSolvedFirstTryCount = 1 (plus 1 from Scenario 1 = 2)
    // Staff A should get reopenedCount = 1 (plus 2 from Scenario 1 = 3)
    assert(rowStaffA.notSolvedFirstTryCount === 2, "Staff A receives notSolvedFirstTryCount for both failed first attempts");
    assert(rowStaffA.reopenedCount === 3, "Staff A receives reopenedCount for attempts that were reopened later");
    // Staff B performed the final successful resolution on compReassign:
    // Staff B must get resolvedCount = 1
    assert(rowStaffB.resolvedCount === 1, "Staff B receives resolvedCount = 1 for the actual final resolution performed");
    // Staff B must NOT get penalized for Staff A's failed first attempt:
    assert(rowStaffB.notSolvedFirstTryCount === 0, "Staff B notSolvedFirstTryCount is 0 (Staff A's failure did not leak to Staff B)");
    assert(rowStaffB.reopenedCount === 0, "Staff B reopenedCount is 0");
    // Both staff members were involved in compReassign:
    assert(rowStaffA.assignedCount >= 2, "Staff A assignedCount reflects handled complaints");
    assert(rowStaffB.assignedCount >= 1, "Staff B assignedCount reflects handled complaints");

    // -------------------------------------------------------------------------
    // SCENARIO 3: Point 6 — Unresolved Complaints and Missing Student Feedback
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 6: Unresolved Complaints & Missing Feedback Handling ---");
    // Unresolved: Pending ticket
    const compPending = await Complaint.create({
        title: "[ACCURACY-AUDIT] Leaking Faucet",
        description: "Continuous drip in washbasin",
        category: "Plumbing",
        studentId: student1._id,
        doorNumber: "101",
        assignedTo: staffB._id,
        status: "In Progress",
        createdAt: new Date(Date.now() - 3600000 * 4),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 4), note: "Ticket created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 3), note: `Assigned to ${staffB.name}`, actor: "Warden", actorId: warden._id, staffId: staffB._id }
        ]
    });

    // Resolved, but student has NOT provided feedback (feedback.isSatisfied is null, roomConfirmedWorking is false)
    const compAwaiting = await Complaint.create({
        title: "[ACCURACY-AUDIT] Chair Leg Broken",
        description: "Study chair wobbly",
        category: "Furniture",
        studentId: student2._id,
        doorNumber: "201",
        assignedTo: staffA._id,
        status: "Resolved",
        createdAt: new Date(Date.now() - 3600000 * 6),
        assignedAt: new Date(Date.now() - 3600000 * 5),
        resolvedAt: new Date(Date.now() - 3600000 * 1),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 6), note: "Ticket created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 5), note: `Assigned to ${staffA.name}`, actor: "Warden", actorId: warden._id, staffId: staffA._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 1), note: "Leg reinforced", actor: "Staff", actorId: staffA._id, staffId: staffA._id }
        ],
        feedback: {
            isSatisfied: null,
            roomConfirmedWorking: false
        }
    });

    const pendingTimeline = await (await fetch(`${API_URL}/staff-analytics/complaint/${compPending._id}/timeline`, { headers: { Authorization: `Bearer ${headWardenToken}` } })).json();
    assert(pendingTimeline.complaint.firstAttemptOutcome === "PENDING", "Unresolved complaint outcome is PENDING (not success)");

    const awaitingTimeline = await (await fetch(`${API_URL}/staff-analytics/complaint/${compAwaiting._id}/timeline`, { headers: { Authorization: `Bearer ${headWardenToken}` } })).json();
    assert(awaitingTimeline.complaint.firstAttemptOutcome === "AWAITING_CONFIRMATION", "Resolved complaint without student feedback is AWAITING_CONFIRMATION (never counted as success)");

    // -------------------------------------------------------------------------
    // SCENARIO 4: Point 7 — Legacy Complaints Without Status History
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 7: Legacy Complaints Without Complete History ---");
    const compLegacy = await Complaint.create({
        title: "[ACCURACY-AUDIT] Old Legacy Complaint 2023",
        description: "Fixed years ago before statusHistory logging",
        category: "Other",
        studentId: student1._id,
        doorNumber: "101",
        status: "Resolved",
        createdAt: new Date(Date.now() - 3600000 * 24 * 60),
        statusHistory: [] // Empty history
    });

    const legacyTimeline = await (await fetch(`${API_URL}/staff-analytics/complaint/${compLegacy._id}/timeline`, { headers: { Authorization: `Bearer ${headWardenToken}` } })).json();
    assert(legacyTimeline.complaint.firstAttemptOutcome === "UNKNOWN", "Legacy resolved complaint with empty status history is labeled UNKNOWN (no invented outcome)");

    // -------------------------------------------------------------------------
    // SCENARIO 5: Point 10 — Critical Wi-Fi Isolation for Warden
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 10: Strict Wi-Fi Isolation for Warden ---");
    const compWifi = await Complaint.create({
        title: "[ACCURACY-AUDIT] Wi-Fi AP 101 Dropping Packets",
        description: "SSID pict_hostel unreachable in room 101",
        category: "Internet",
        quickCategory: "WIFI_NOT_WORKING",
        studentId: student1._id,
        doorNumber: "101",
        assignedTo: wifiStaff._id,
        status: "Resolved",
        createdAt: new Date(Date.now() - 3600000 * 5),
        assignedAt: new Date(Date.now() - 3600000 * 4),
        resolvedAt: new Date(Date.now() - 3600000 * 1),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 5), note: "Ticket created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 4), note: `Assigned to ${wifiStaff.name}`, actor: "WifiIncharge", staffId: wifiStaff._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 1), note: "Replaced patch cable", actor: "Staff", actorId: wifiStaff._id, staffId: wifiStaff._id }
        ],
        feedback: {
            text: "Wi-Fi works now",
            isSatisfied: true,
            roomConfirmedWorking: true
        }
    });

    // 10.1 Warden Overview must strictly exclude compWifi
    const wardenOverviewRes = await fetch(`${API_URL}/staff-analytics/overview`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    const wardenOverview = await wardenOverviewRes.json();
    const wardenCategories = Object.keys(wardenOverview.categoryBreakdown || {});
    assert(!wardenCategories.includes("Internet") && !wardenCategories.includes("WIFI_NOT_WORKING"), "Warden overview strictly excludes 'Internet' and 'WIFI_NOT_WORKING' categories");

    // 10.2 Warden Staff Table must not include Wi-Fi Specialist
    const wardenTableRes = await fetch(`${API_URL}/staff-analytics/staff-table`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    const wardenTable = await wardenTableRes.json();
    const wifiInWardenTable = wardenTable.staff.some(s => s.staffRole === "Wi-Fi Specialist" || s.staffId === wifiStaff._id.toString());
    assert(wifiInWardenTable === false, "Warden staff table strictly excludes Wi-Fi Specialist staff");

    // 10.3 Warden attempting to inspect Wi-Fi staff drilldown must receive 403 Forbidden
    const wardenDrilldownRes = await fetch(`${API_URL}/staff-analytics/staff/${wifiStaff._id}/complaints`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wardenDrilldownRes.status === 403, "Warden accessing Wi-Fi specialist drilldown is rejected with HTTP 403 Forbidden");

    // 10.4 Warden attempting to inspect Wi-Fi complaint timeline must receive 403 Forbidden
    const wardenTimelineRes = await fetch(`${API_URL}/staff-analytics/complaint/${compWifi._id}/timeline`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wardenTimelineRes.status === 403, "Warden accessing Wi-Fi complaint resolution timeline is rejected with HTTP 403 Forbidden");

    // -------------------------------------------------------------------------
    // SCENARIO 6: Point 8 — Filter Accuracy (Date, Category, Floor)
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 8: Filter Parameter Accuracy ---");
    // Category filter = Furniture
    const furnitureRes = await fetch(`${API_URL}/staff-analytics/overview?category=Furniture`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    const furnitureData = await furnitureRes.json();
    // We created compMulti (Furniture) and compAwaiting (Furniture)
    assert(furnitureData.overview.totalHandled === 2, "Category filter = 'Furniture' returns exactly 2 complaints");

    // Floor filter = 2
    const floor2Res = await fetch(`${API_URL}/staff-analytics/overview?floor=2`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    const floor2Data = await floor2Res.json();
    // In room 201: compReassign and compAwaiting (+ baselineFloor2)
    assert(floor2Data.overview.totalHandled === baselineFloor2 + 2, "Floor filter = '2' returns exactly baseline + 2 complaints on Floor 2");

    // -------------------------------------------------------------------------
    // SCENARIO 7: Point 9 — Role Access Across Dashboards
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 9: Separate Dashboard Access Authorization ---");
    const hwAccess = await fetch(`${API_URL}/staff-analytics/overview`, { headers: { Authorization: `Bearer ${headWardenToken}` } });
    const wAccess = await fetch(`${API_URL}/staff-analytics/overview`, { headers: { Authorization: `Bearer ${wardenToken}` } });
    const incAccess = await fetch(`${API_URL}/staff-analytics/overview`, { headers: { Authorization: `Bearer ${inchargeToken}` } });
    assert(hwAccess.status === 200, "HEADWARDEN can access staff analytics (HTTP 200)");
    assert(wAccess.status === 200, "WARDEN can access staff analytics (HTTP 200)");
    assert(incAccess.status === 200, "INCHARGE can access staff analytics (HTTP 200)");

    // Unauthorized roles (STUDENT, STAFF) must be rejected with 403
    const stuToken = generateToken(student1);
    const staffToken = generateToken(staffA);
    const stuAccess = await fetch(`${API_URL}/staff-analytics/overview`, { headers: { Authorization: `Bearer ${stuToken}` } });
    const staffAccess = await fetch(`${API_URL}/staff-analytics/overview`, { headers: { Authorization: `Bearer ${staffToken}` } });
    assert(stuAccess.status === 403, "STUDENT is forbidden from staff analytics (HTTP 403)");
    assert(staffAccess.status === 403, "STAFF is forbidden from staff analytics (HTTP 403)");

    // -------------------------------------------------------------------------
    // SCENARIO 8: Point 11 — Read-Only Inspection Verification
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 11: Read-Only Immutability ---");
    const postTimeline = await fetch(`${API_URL}/staff-analytics/complaint/${compMulti._id}/timeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${headWardenToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ maliciousChange: "fake_resolve" })
    });
    assert(postTimeline.status === 404 || postTimeline.status === 405, "POST to timeline endpoint rejected (HTTP 404 / 405 Method Not Allowed)");

    // -------------------------------------------------------------------------
    // SCENARIO 9: Point 12 — Query Efficiency & Indexes
    // -------------------------------------------------------------------------
    console.log("\n--- AUDIT 12: Database Index Verification ---");
    const indexes = await Complaint.collection.indexes();
    const indexKeyNames = indexes.map(idx => Object.keys(idx.key).join(","));
    assert(indexKeyNames.some(k => k.includes("category") && k.includes("status")), "Index exists for category + status compound queries");
    assert(indexKeyNames.some(k => k.includes("assignedTo")), "Index exists for assignedTo queries");
    assert(indexKeyNames.some(k => k.includes("doorNumber")), "Index exists for doorNumber floor queries");
    assert(indexKeyNames.some(k => k.includes("statusHistory.staffId")), "Index exists for statusHistory.staffId queries");

    // Cleanup synthetic test records
    await User.deleteMany({ email: /@audit-test\.local$/ });
    await Complaint.deleteMany({ title: /\[ACCURACY-AUDIT\]/ });
    await syncRoomOccupancy();

    console.log("\n==================================================");
    console.log(`ACCURACY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    await mongoose.disconnect();
    process.exit(failed === 0 ? 0 : 1);
}

runAccuracyAudit().catch(err => {
    console.error("Accuracy audit execution failed:", err);
    process.exit(1);
});
