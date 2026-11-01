const mongoose = require("../backend/node_modules/mongoose");
const jwt = require("../backend/node_modules/jsonwebtoken");
const path = require("path");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { User, Student, Warden, HeadWarden, Incharge, Staff, WifiIncharge } = require("../backend/models/User");
const Complaint = require("../backend/models/Complaint");
const ResidentAuditLog = require("../backend/models/ResidentAuditLog");
const { syncRoomOccupancy } = require("../backend/services/roomOccupancyService");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const API_URL = "http://localhost:5000/api";

const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
};

async function runTests() {
    console.log("===============================================================================");
    console.log("TESTING: HEADWARDEN EXCLUSIVE CSV, EXCEL FORMATTING, & STAFF PERFORMANCE ANALYTICS");
    console.log("===============================================================================");

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");

    // Clean test accounts & data
    await User.deleteMany({ email: /@test-hms-exclusive\.local$/ });
    await Complaint.deleteMany({ title: /\[TEST-STAFF-ANALYTICS\]/ });

    // 1. Create role accounts
    const headWarden = await HeadWarden.create({
        name: "Test Head Warden",
        email: "headwarden@test-hms-exclusive.local",
        role: "HEADWARDEN"
    });

    const warden = await Warden.create({
        name: "Test Regular Warden",
        email: "warden@test-hms-exclusive.local",
        role: "WARDEN"
    });

    const incharge = await Incharge.create({
        name: "Test Hostel Incharge",
        email: "incharge@test-hms-exclusive.local",
        role: "INCHARGE",
        officeLocation: "Admin Office B"
    });

    const staff1 = await Staff.create({
        name: "Ramesh Electrician",
        email: "ramesh@test-hms-exclusive.local",
        role: "STAFF",
        department: "Electrical",
        phone: "9820011111"
    });

    const staff2 = await Staff.create({
        name: "Suresh Wi-Fi Tech",
        email: "suresh@test-hms-exclusive.local",
        role: "STAFF",
        department: "Internet",
        phone: "9820022222"
    });

    const wifiIncharge = await WifiIncharge.create({
        name: "Test Wi-Fi Incharge",
        email: "wifi@test-hms-exclusive.local",
        role: "WIFI_INCHARGE"
    });

    const student1 = await Student.create({
        name: "Student Alpha",
        fullName: "Alpha Student",
        email: "alpha@test-hms-exclusive.local",
        role: "STUDENT",
        prn: "HW_TEST_001",
        branch: "CE",
        year: "FY",
        doorNumber: "101",
        mobileNumber: "9123456780",
        guardianPhone: "9123456789"
    });

    const student2 = await Student.create({
        name: "Student Beta",
        fullName: "Beta Student",
        email: "beta@test-hms-exclusive.local",
        role: "STUDENT",
        prn: "HW_TEST_002",
        branch: "IT",
        year: "SY",
        doorNumber: "102",
        mobileNumber: "9123456781"
    });

    await syncRoomOccupancy();

    const headWardenToken = generateToken(headWarden);
    const wardenToken = generateToken(warden);
    const inchargeToken = generateToken(incharge);
    const staffToken = generateToken(staff1);
    const wifiToken = generateToken(wifiIncharge);
    const studentToken = generateToken(student1);

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

    // -------------------------------------------------------------
    // PART 1: HEADWARDEN EXCLUSIVE CSV ACCESS (IMPORT & EXPORT)
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: CSV Access Control (Template, Preview, Confirm, Export) ---");

    // 1.1 Template download
    const hwTemplate = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    assert(hwTemplate.status === 200, "HEADWARDEN can download CSV template (HTTP 200)");
    const hwTemplateBuf = Buffer.from(await hwTemplate.arrayBuffer());
    const hasTemplateBOM = hwTemplateBuf[0] === 0xEF && hwTemplateBuf[1] === 0xBB && hwTemplateBuf[2] === 0xBF;
    assert(hasTemplateBOM, "CSV template response begins with UTF-8 BOM bytes (EF BB BF) for native Excel compatibility");
    const hwTemplateText = hwTemplateBuf.toString("utf8");
    assert(hwTemplateText.includes("PRN,Branch,Room,Parent Contact Number,Student Contact Number"), "CSV template includes all 5 required columns");

    const wTemplate = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wTemplate.status === 403, "WARDEN is forbidden from CSV template (HTTP 403)");

    const incTemplate = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    assert(incTemplate.status === 403, "INCHARGE is forbidden from CSV template (HTTP 403)");

    const staffTemplate = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(staffTemplate.status === 403, "STAFF is forbidden from CSV template (HTTP 403)");

    const stuTemplate = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(stuTemplate.status === 403, "STUDENT is forbidden from CSV template (HTTP 403)");

    // 1.2 CSV Export
    const hwExport = await fetch(`${API_URL}/residents/export`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    assert(hwExport.status === 200, "HEADWARDEN can export residents CSV (HTTP 200)");
    const hwExportBuf = Buffer.from(await hwExport.arrayBuffer());
    if (hwExport.status !== 200) {
        console.error("hwExport error body:", hwExportBuf.toString("utf8"));
    }
    const hasExportBOM = hwExportBuf[0] === 0xEF && hwExportBuf[1] === 0xBB && hwExportBuf[2] === 0xBF;
    assert(hasExportBOM, "CSV export begins with UTF-8 BOM bytes (EF BB BF) for native Excel compatibility");
    const hwExportText = hwExportBuf.toString("utf8");
    assert(!hwExportText.includes("â€”") && !hwExportText.includes("—"), "CSV export contains zero mojibake or em-dash characters");
    assert(hwExportText.includes("PRN,Branch,Room,Parent Contact Number,Student Contact Number"), "CSV export starts with the 5 required columns");

    const wExport = await fetch(`${API_URL}/residents/export`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wExport.status === 403, "WARDEN is forbidden from CSV export (HTTP 403)");

    const incExport = await fetch(`${API_URL}/residents/export`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    assert(incExport.status === 403, "INCHARGE is forbidden from CSV export (HTTP 403)");

    // 1.3 CSV Preview
    const sampleCsvData = [
        {
            PRN: "HW_TEST_001",
            Branch: "CE",
            Room: "114",
            "Parent Contact Number": "9998887771",
            "Student Contact Number": "9123456780"
        }
    ];

    const hwPreview = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${headWardenToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows: sampleCsvData })
    });
    if (hwPreview.status !== 200) {
        console.error("hwPreview status:", hwPreview.status, await hwPreview.text());
    }
    assert(hwPreview.status === 200, "HEADWARDEN can preview CSV import (HTTP 200)");

    const wPreview = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${wardenToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows: sampleCsvData })
    });
    assert(wPreview.status === 403, "WARDEN is forbidden from CSV import preview (HTTP 403)");

    const incPreview = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${inchargeToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows: sampleCsvData })
    });
    assert(incPreview.status === 403, "INCHARGE is forbidden from CSV import preview (HTTP 403)");

    // 1.4 CSV Confirm
    const hwConfirm = await fetch(`${API_URL}/residents/import-confirm`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${headWardenToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ records: sampleCsvData })
    });
    if (hwConfirm.status !== 200) {
        console.error("hwConfirm status:", hwConfirm.status, await hwConfirm.text());
    }
    assert(hwConfirm.status === 200, "HEADWARDEN can commit CSV import (HTTP 200)");

    const wConfirm = await fetch(`${API_URL}/residents/import-confirm`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${wardenToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ records: sampleCsvData })
    });
    assert(wConfirm.status === 403, "WARDEN is forbidden from CSV import commit (HTTP 403)");

    // 1.5 Non-CSV endpoints remain accessible to WARDEN and INCHARGE
    const wDirectory = await fetch(`${API_URL}/residents?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wDirectory.status === 200, "WARDEN can access Student Directory (HTTP 200)");

    const incDirectory = await fetch(`${API_URL}/residents?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    assert(incDirectory.status === 200, "INCHARGE can access Student Directory (HTTP 200)");

    const wOccupancy = await fetch(`${API_URL}/residents/occupancy`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wOccupancy.status === 200, "WARDEN can access Room Occupancy Map (HTTP 200)");

    // -------------------------------------------------------------
    // PART 2: STAFF PERFORMANCE ANALYTICS & WI-FI ISOLATION
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Staff Performance Analytics & Wi-Fi Isolation ---");

    // Create test complaints for lifecycle verification
    // 1. First-attempt success complaint: Electrical assigned to Ramesh, resolved, student gave positive feedback
    const comp1 = await Complaint.create({
        title: "[TEST-STAFF-ANALYTICS] Broken Light",
        description: "Bulb flickering in room 103",
        category: "Electrical",
        studentId: student1._id,
        doorNumber: "103",
        assignedTo: staff1._id,
        status: "Resolved",
        assignedAt: new Date(Date.now() - 3600000 * 5),
        resolvedAt: new Date(Date.now() - 3600000 * 2),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 6), note: "Created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 5), note: `Assigned to ${staff1.name}`, actor: "Warden", actorId: warden._id, staffId: staff1._id },
            { status: "In Progress", timestamp: new Date(Date.now() - 3600000 * 4), note: "Staff arrived", actor: "Staff", actorId: staff1._id, staffId: staff1._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 2), note: "Bulb replaced", actor: "Staff", actorId: staff1._id, staffId: staff1._id }
        ],
        feedback: {
            text: "Fast fix!",
            submittedAt: new Date(Date.now() - 3600000 * 1),
            roomConfirmedWorking: true,
            isSatisfied: true
        }
    });

    // 2. Not solved on first try complaint: Reopened after resolution
    const comp2 = await Complaint.create({
        title: "[TEST-STAFF-ANALYTICS] Fan Not Spinning",
        description: "Fan regulator jammed",
        category: "Electrical",
        studentId: student1._id,
        doorNumber: "103",
        assignedTo: staff1._id,
        status: "In Progress",
        assignedAt: new Date(Date.now() - 3600000 * 10),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 10), note: "Created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 9), note: `Assigned to ${staff1.name}`, actor: "Warden", actorId: warden._id, staffId: staff1._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 7), note: "Regulator lubricated", actor: "Staff", actorId: staff1._id, staffId: staff1._id },
            { status: "Reopened", timestamp: new Date(Date.now() - 3600000 * 5), note: "Stopped again", actor: "Student" },
            { status: "In Progress", timestamp: new Date(Date.now() - 3600000 * 3), note: "Working on it", actor: "Staff", actorId: staff1._id, staffId: staff1._id }
        ]
    });

    // 3. Wi-Fi complaint: Internet assigned to Suresh
    const comp3 = await Complaint.create({
        title: "[TEST-STAFF-ANALYTICS] Wi-Fi No Internet",
        description: "AP in corridor offline",
        category: "Internet",
        studentId: student2._id,
        doorNumber: "102",
        assignedTo: staff2._id,
        status: "Resolved",
        assignedAt: new Date(Date.now() - 3600000 * 4),
        resolvedAt: new Date(Date.now() - 3600000 * 1),
        statusHistory: [
            { status: "Pending", timestamp: new Date(Date.now() - 3600000 * 4), note: "Created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(Date.now() - 3600000 * 3), note: `Assigned to ${staff2.name}`, actor: "WifiIncharge", actorId: wifiIncharge._id, staffId: staff2._id },
            { status: "Resolved", timestamp: new Date(Date.now() - 3600000 * 1), note: "Port reset", actor: "Staff", actorId: staff2._id, staffId: staff2._id }
        ],
        feedback: {
            text: "Fixed",
            isSatisfied: true
        }
    });

    // 2.1 Fetch Overview as HEADWARDEN (should see all categories including Wi-Fi)
    const hwOverviewRes = await fetch(`${API_URL}/staff-analytics/overview`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    if (hwOverviewRes.status !== 200) {
        console.error("hwOverviewRes status:", hwOverviewRes.status, await hwOverviewRes.text());
    }
    assert(hwOverviewRes.status === 200, "HEADWARDEN can access staff analytics overview (HTTP 200)");
    const hwOverview = await hwOverviewRes.json();
    assert(!!hwOverview.overview, "Analytics overview returns overview object");
    assert(hwOverview.overview.firstAttemptSuccessCount >= 1, "Analytics records at least 1 first-attempt success");
    assert(hwOverview.overview.notSolvedFirstTryCount >= 1, "Analytics records at least 1 not solved first try");

    // 2.2 Fetch Overview as WARDEN (CRITICAL: Wi-Fi isolation must exclude comp3)
    const wOverviewRes = await fetch(`${API_URL}/staff-analytics/overview`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wOverviewRes.status === 200, "WARDEN can access staff analytics overview (HTTP 200)");
    const wOverview = await wOverviewRes.json();
    const wDeptKeys = Object.keys(wOverview.categoryBreakdown || {});
    assert(!wDeptKeys.includes("Internet") && !wDeptKeys.includes("WIFI_NOT_WORKING"), "WARDEN overview strictly excludes 'Internet' / Wi-Fi department");

    // 2.3 Fetch Staff Table as WARDEN (Wi-Fi tech Suresh must not have Wi-Fi tickets counted under Warden)
    const wStaffTableRes = await fetch(`${API_URL}/staff-analytics/staff-table`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    assert(wStaffTableRes.status === 200, "WARDEN can access staff table (HTTP 200)");
    const wStaffTable = await wStaffTableRes.json();
    const rameshRow = wStaffTable.staff?.find(s => s.staffId === staff1._id.toString());
    assert(!!rameshRow, "Ramesh Electrician row present in staff performance table");
    if (rameshRow) {
        assert(rameshRow.firstAttemptSuccessCount >= 1, "Ramesh has firstAttemptSuccessCount >= 1");
        assert(rameshRow.notSolvedFirstTryCount >= 1, "Ramesh has notSolvedFirstTryCount >= 1");
    }

    // 2.4 Staff Drilldown
    const drilldownRes = await fetch(`${API_URL}/staff-analytics/staff/${staff1._id}/complaints`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    assert(drilldownRes.status === 200, "Staff drilldown complaints retrieved successfully (HTTP 200)");
    const drilldownData = await drilldownRes.json();
    assert(drilldownData.complaints?.length >= 2, "Drilldown returns complaints for Ramesh");

    // 2.5 Resolution Timeline
    const timelineRes = await fetch(`${API_URL}/staff-analytics/complaint/${comp1._id}/timeline`, {
        headers: { Authorization: `Bearer ${headWardenToken}` }
    });
    assert(timelineRes.status === 200, "Resolution timeline retrieved successfully (HTTP 200)");
    const timelineData = await timelineRes.json();
    assert(timelineData.complaint?.firstAttemptOutcome === "FIRST_ATTEMPT_SUCCESS", "Timeline outcome is FIRST_ATTEMPT_SUCCESS");
    assert(timelineData.complaint?.totalAttempts === 1, "Timeline reports exactly 1 resolution attempt for comp1");

    // Cleanup
    await User.deleteMany({ email: /@test-hms-exclusive\.local$/ });
    await Complaint.deleteMany({ title: /\[TEST-STAFF-ANALYTICS\]/ });
    await syncRoomOccupancy();

    console.log("\n==================================================");
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    await mongoose.disconnect();
    process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
