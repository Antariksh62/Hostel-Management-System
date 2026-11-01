const path = require("path");
module.paths.push(path.resolve(__dirname, "../backend/node_modules"));

const assert = require("assert");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const xlsx = require("xlsx");

require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
const JWT_SECRET = process.env.JWT_SECRET || "pict_hostel_secret_key_2024";

const { User, Student, Warden, HeadWarden, Incharge, WifiIncharge, Staff } = require("../backend/models/User");
const StudentRoster = require("../backend/models/StudentRoster");
const AdmissionImportBatch = require("../backend/models/AdmissionImportBatch");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const OTP = require("../backend/models/OTP");
const admissionService = require("../backend/services/admissionService");
const { sendOTP, verifyOTP } = require("../backend/controllers/otpController");
const { authMiddleware, admissionAdminMiddleware } = require("../backend/middleware/auth");

let testHeadWarden, testIncharge, testWarden, testWifiIncharge, testStaff;

function createMockRes() {
    let statusCode = 200;
    let responseData = null;
    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        },
        getHeader: () => {},
        setHeader: () => {}
    };
    return {
        res,
        getStatus: () => statusCode,
        getData: () => responseData
    };
}

async function runMasterTestSuite() {
    console.log("================================================================================");
    console.log("🧪 MASTER TEST SUITE: COMPLETE STUDENT ELIGIBILITY, ROSTER & OTP ACCESS CONTROL");
    console.log("================================================================================\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB:", MONGO_URI);

    // Clean up test records
    const testEmails = [
        "hw_eligibility_test@pict.edu",
        "inc_eligibility_test@pict.edu",
        "warden_elig_test@pict.edu",
        "wifi_elig_test@pict.edu",
        "staff_elig_test@pict.edu",
        "manual.valid@ms.pict.edu",
        "manual.edit@ms.pict.edu",
        "sync.absent1@ms.pict.edu",
        "sync.absent2@ms.pict.edu",
        "sync.present@ms.pict.edu",
        "active.session@ms.pict.edu"
    ];
    await User.deleteMany({ email: { $in: testEmails } });
    await StudentRoster.deleteMany({ email: { $in: testEmails } });
    await OTP.deleteMany({ email: { $in: testEmails } });

    // ─── STEP 1: Setup Administrative Actors ─────────────────────────────────────
    console.log("\n--- STEP 1: Setup Administrative Actors ---");
    testHeadWarden = await HeadWarden.create({
        name: "Head Warden Master",
        email: "hw_eligibility_test@pict.edu",
        role: "HEADWARDEN"
    });
    testIncharge = await Incharge.create({
        name: "Incharge Master",
        email: "inc_eligibility_test@pict.edu",
        role: "INCHARGE"
    });
    testWarden = await Warden.create({
        name: "Warden Unauthorized",
        email: "warden_elig_test@pict.edu",
        role: "WARDEN"
    });
    testWifiIncharge = await WifiIncharge.create({
        name: "Wifi Unauthorized",
        email: "wifi_elig_test@pict.edu",
        role: "WIFI_INCHARGE"
    });
    testStaff = await Staff.create({
        name: "Staff Unauthorized",
        email: "staff_elig_test@pict.edu",
        role: "STAFF"
    });
    console.log("✅ Created test actors: HEADWARDEN, INCHARGE, WARDEN, WIFI_INCHARGE, STAFF");

    // ─── STEP 2: Manual Student Addition (Method B) ──────────────────────────────
    console.log("\n--- STEP 2: Manual Student Addition Validation (Method B) ---");
    
    // 2.1 Valid manual addition
    const manualStudentData = {
        name: "Manual Valid Student",
        email: "manual.valid@ms.pict.edu",
        prn: "F24CE888",
        rollNumber: "10888",
        branch: "CE",
        year: "FY",
        division: "1",
        doorNumber: "104",
        studentMobile: "9876543210",
        parentMobile: "9876543211",
        admissionStatus: "APPROVED"
    };

    const addedRecord = await admissionService.addManualStudent({
        studentData: manualStudentData,
        actor: { id: testIncharge._id, name: testIncharge.name, role: testIncharge.role }
    });
    assert.strictEqual(addedRecord.email, "manual.valid@ms.pict.edu");
    assert.strictEqual(addedRecord.admissionStatus, "APPROVED");
    assert.strictEqual(addedRecord.auditTrail[0].action, "MANUAL_STUDENT_ADDED");
    assert.strictEqual(addedRecord.auditTrail[0].performedBy.role, "INCHARGE");
    console.log("✅ 2.1 Valid student manually added by INCHARGE and approved.");

    // 2.2 Invalid non-PICT email
    try {
        await admissionService.addManualStudent({
            studentData: { ...manualStudentData, email: "invalid@gmail.com", prn: "F24CE889" },
            actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
        });
        assert.fail("Should have failed for non-PICT email");
    } catch (err) {
        assert.ok(err.message.includes("@ms.pict.edu"));
        console.log("✅ 2.2 Non-PICT email rejected:", err.message);
    }

    // 2.3 Duplicate email
    try {
        await admissionService.addManualStudent({
            studentData: { ...manualStudentData, prn: "F24CE890" },
            actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
        });
        assert.fail("Should have failed for duplicate email");
    } catch (err) {
        assert.ok(err.message.includes("already registered"));
        console.log("✅ 2.3 Duplicate email rejected:", err.message);
    }

    // 2.4 Duplicate PRN
    try {
        await admissionService.addManualStudent({
            studentData: { ...manualStudentData, email: "unique.email@ms.pict.edu" },
            actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
        });
        assert.fail("Should have failed for duplicate PRN");
    } catch (err) {
        assert.ok(err.message.includes("already registered"));
        console.log("✅ 2.4 Duplicate PRN rejected:", err.message);
    }

    // 2.5 Invalid room number
    try {
        await admissionService.addManualStudent({
            studentData: { ...manualStudentData, email: "valid.room@ms.pict.edu", prn: "F24CE891", doorNumber: "999" },
            actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
        });
        assert.fail("Should have failed for invalid room 999");
    } catch (err) {
        assert.ok(err.message.includes("invalid") || err.message.includes("77 rooms"));
        console.log("✅ 2.5 Non-existent room (999 outside 77-room inventory) rejected:", err.message);
    }

    // ─── STEP 3: Manual Student Detail Editing ───────────────────────────────────
    console.log("\n--- STEP 3: Manual Student Detail Editing ---");
    const editRecord = await admissionService.updateStudentRosterDetails({
        rosterId: addedRecord._id,
        updateData: {
            name: "Manual Valid Student Renamed",
            rollNumber: "10999",
            division: "2",
            doorNumber: "105"
        },
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    });
    assert.strictEqual(editRecord.name, "Manual Valid Student Renamed");
    assert.strictEqual(editRecord.rollNumber, "10999");
    assert.strictEqual(editRecord.doorNumber, "105");
    const auditActions = editRecord.auditTrail.map(a => a.action);
    assert.ok(auditActions.includes("STUDENT_DETAILS_UPDATED"));
    console.log("✅ Student details edited and room reallocated with audit trail intact.");

    // ─── STEP 4: Manual Revoke & Restore Lifecycle ───────────────────────────────
    console.log("\n--- STEP 4: Manual Revoke & Restore Lifecycle ---");
    // Revoke
    const revokedRecord = await admissionService.revokeRosterEligibility(
        addedRecord._id,
        { id: testIncharge._id, name: testIncharge.name, role: testIncharge.role },
        "Disciplinary fee clearance pending"
    );
    assert.strictEqual(revokedRecord.admissionStatus, "REVOKED");
    assert.strictEqual(revokedRecord.rejectionReason, "Disciplinary fee clearance pending");
    console.log("✅ Revocation succeeded. Status transitioned to REVOKED.");

    // Test OTP rejection while revoked
    const mockRes1 = createMockRes();
    await sendOTP({ body: { email: "manual.valid@ms.pict.edu" } }, mockRes1.res);
    assert.strictEqual(mockRes1.getStatus(), 403, "Revoked student must receive HTTP 403 on OTP request");
    assert.ok(mockRes1.getData().message.includes("revoked"));
    console.log("✅ Verified: Revoked student rejected from requesting OTP (HTTP 403):", mockRes1.getData().message);

    // Restore
    const restoredRecord = await admissionService.restoreRosterEligibility(
        addedRecord._id,
        { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role },
        "Dues settled upon verification"
    );
    assert.strictEqual(restoredRecord.admissionStatus, "APPROVED");
    console.log("✅ Restoration succeeded. Status transitioned to APPROVED.");

    // Test OTP allowed after restore
    const mockRes2 = createMockRes();
    await sendOTP({ body: { email: "manual.valid@ms.pict.edu" } }, mockRes2.res);
    assert.strictEqual(mockRes2.getStatus(), 200, "Restored student must be allowed to request OTP");
    console.log("✅ Verified: Restored student permitted to request fresh OTP (HTTP 200).");

    // ─── STEP 5: Excel Upload — Mode A (Add/Update Only) vs Mode B (Full Sync) ──
    console.log("\n--- STEP 5: Excel Upload — Mode A vs Mode B (Full Sync) ---");
    
    // Seed 2 active students in roster: sync.absent1 and sync.present
    const absentStudent = await admissionService.addManualStudent({
        studentData: {
            name: "Absent Student One",
            email: "sync.absent1@ms.pict.edu",
            prn: "F24CE701",
            doorNumber: "106",
            studentMobile: "9876543201",
            parentMobile: "9876543202",
            admissionStatus: "APPROVED"
        },
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    });
    const presentStudent = await admissionService.addManualStudent({
        studentData: {
            name: "Present Student",
            email: "sync.present@ms.pict.edu",
            prn: "F24CE702",
            doorNumber: "107",
            studentMobile: "9876543203",
            parentMobile: "9876543204",
            admissionStatus: "APPROVED"
        },
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    });

    // Create an Excel containing ONLY sync.present
    const headers = ["PRN", "Name", "Roll No", "Official Email", "Branch", "Year", "Division", "Room No", "Student Mobile", "Parent Mobile"];
    const rows = [
        ["F24CE702", "Present Student Updated", "10702", "sync.present@ms.pict.edu", "CE", "FY", "1", "107", "9876543203", "9876543204"]
    ];
    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Roster");
    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // 5.1 Test Preview in Mode A (ADD_UPDATE)
    const previewModeA = await admissionService.generateImportPreview({
        buffer: excelBuffer,
        mode: "ADD_UPDATE"
    });
    assert.strictEqual(previewModeA.summary.validCount, 1);
    assert.strictEqual(previewModeA.missingStudents.length, 0, "Mode A preview must NOT flag missing students");
    console.log("✅ 5.1 Mode A Preview: Missing students not targeted for revocation.");

    // 5.2 Test Preview in Mode B (FULL_SYNC)
    const previewModeB = await admissionService.generateImportPreview({
        buffer: excelBuffer,
        mode: "FULL_SYNC"
    });
    assert.strictEqual(previewModeB.summary.validCount, 1);
    const missingEmails = previewModeB.missingStudents.map(m => m.email);
    assert.ok(missingEmails.includes("sync.absent1@ms.pict.edu"), "Mode B must detect absent active student");
    console.log("✅ 5.2 Mode B Preview: Successfully identified absent active students:", missingEmails);

    // 5.3 Test Commit in Mode B with confirmRevokeMissing = true
    const commitModeB = await admissionService.commitRosterImport({
        parsedRows: previewModeB.rows,
        autoApprove: true,
        mode: "FULL_SYNC",
        confirmRevokeMissing: true,
        actor: { id: testIncharge._id, name: testIncharge.name, role: testIncharge.role }
    });
    assert.ok(commitModeB.revokedMissingCount > 0, "Mode B commit must revoke missing students");
    
    // Verify sync.absent1 is now REVOKED in DB
    const checkAbsent = await StudentRoster.findOne({ email: "sync.absent1@ms.pict.edu" });
    assert.strictEqual(checkAbsent.admissionStatus, "REVOKED");
    assert.ok(checkAbsent.rejectionReason.includes("Full Roster Sync"));
    console.log("✅ 5.3 Mode B Commit: Absent student successfully revoked via Full Roster Sync.");

    // ─── STEP 6: Active Session & JWT Revocation ─────────────────────────────────
    console.log("\n--- STEP 6: Active Session & Server-Side JWT Revocation ---");
    
    // Create an approved student user with active session
    const activeStudentRoster = await admissionService.addManualStudent({
        studentData: {
            name: "Active Session Student",
            email: "active.session@ms.pict.edu",
            prn: "F24CE601",
            doorNumber: "108",
            studentMobile: "9876543220",
            parentMobile: "9876543221",
            admissionStatus: "APPROVED"
        },
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    });

    const studentUser = await Student.create({
        name: "Active Session Student",
        email: "active.session@ms.pict.edu",
        prn: "F24CE601",
        role: "STUDENT",
        isVerified: true
    });

    // Generate valid JWT token for student
    const studentToken = jwt.sign(
        { id: studentUser._id, role: "STUDENT", email: studentUser.email },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    // Test authMiddleware with APPROVED student -> Must pass
    let nextCalled = false;
    let authRes = createMockRes();
    const mockReqApproved = {
        header: () => `Bearer ${studentToken}`
    };
    await authMiddleware(mockReqApproved, authRes.res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, "Approved student with valid JWT must pass authMiddleware");
    console.log("✅ 6.1 Active student session successfully authenticated through authMiddleware.");

    // Now revoking student eligibility
    await admissionService.revokeRosterEligibility(
        activeStudentRoster._id,
        { id: testIncharge._id, name: testIncharge.name, role: testIncharge.role },
        "Administrative suspension"
    );

    // Test authMiddleware with REVOKED student using SAME active JWT token -> Must be rejected HTTP 403
    nextCalled = false;
    authRes = createMockRes();
    const mockReqRevoked = {
        header: () => `Bearer ${studentToken}`
    };
    await authMiddleware(mockReqRevoked, authRes.res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, "Revoked student must NOT pass authMiddleware");
    assert.strictEqual(authRes.getStatus(), 403, "Revoked student must receive HTTP 403");
    assert.strictEqual(authRes.getData().code, "ELIGIBILITY_REVOKED");
    console.log("✅ 6.2 Active JWT session immediately rejected with HTTP 403 code ELIGIBILITY_REVOKED:", authRes.getData().message);

    // ─── STEP 7: Role Authorization Enforcement Across All 6 Roles ──────────────
    console.log("\n--- STEP 7: Role Authorization Enforcement Across All 6 Roles ---");
    
    const roleChecks = [
        { role: "HEADWARDEN", expectedAllowed: true },
        { role: "INCHARGE", expectedAllowed: true },
        { role: "WARDEN", expectedAllowed: false },
        { role: "WIFI_INCHARGE", expectedAllowed: false },
        { role: "STAFF", expectedAllowed: false },
        { role: "STUDENT", expectedAllowed: false }
    ];

    for (const r of roleChecks) {
        let mwPassed = false;
        const mwRes = createMockRes();
        admissionAdminMiddleware({ user: { role: r.role } }, mwRes.res, () => { mwPassed = true; });

        if (r.expectedAllowed) {
            assert.strictEqual(mwPassed, true, `${r.role} should be allowed`);
            console.log(`✅ Role ${r.role}: ALLOWED (Equal authority confirmed)`);
        } else {
            assert.strictEqual(mwPassed, false, `${r.role} must be blocked`);
            assert.strictEqual(mwRes.getStatus(), 403);
            console.log(`✅ Role ${r.role}: BLOCKED with HTTP 403`);
        }
    }

    console.log("\n================================================================================");
    console.log("🎉 ALL MASTER SUITE TESTS PASSED WITH 100% SUCCESS!");
    console.log("================================================================================\n");

    await mongoose.disconnect();
}

runMasterTestSuite().catch(err => {
    console.error("❌ TEST SUITE FAILED:", err);
    process.exit(1);
});

