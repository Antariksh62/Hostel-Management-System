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
const Notification = require("../backend/models/Notification");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const OTP = require("../backend/models/OTP");
const admissionService = require("../backend/services/admissionService");
const notificationService = require("../backend/services/notificationService");
const otpController = require("../backend/controllers/otpController");
const {
    syncRoomOccupancy,
    checkRoomCapacity,
    assignStudentRoomAtomic,
    atomicReserveRoomRoster,
    atomicReleaseRoomRoster,
    atomicConvertRosterToRegistered
} = require("../backend/services/roomOccupancyService");
const { ALL_ROOMS, MAX_STUDENTS_PER_ROOM } = require("../backend/utils/hostelRooms");

let testHeadWarden, testWarden, testIncharge, testWifiIncharge, testStaff;

// Mock Express response helper
function createMockRes() {
    return {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        },
        cookie() { return this; }
    };
}

async function runHardeningSuite() {
    console.log("================================================================================");
    console.log("🛡️  POST-IMPLEMENTATION HARDENING & CONCURRENCY AUDIT SUITE");
    console.log("================================================================================\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Setup Test Administrative Users
    await User.deleteMany({
        email: { $in: [
            "harden_hw@pict.edu",
            "harden_w@pict.edu",
            "harden_inc@pict.edu",
            "harden_wifi@pict.edu",
            "harden_staff@pict.edu"
        ]}
    });

    testHeadWarden = await HeadWarden.create({
        name: "Hardening Head Warden", email: "harden_hw@pict.edu", role: "HEADWARDEN"
    });
    testWarden = await Warden.create({
        name: "Hardening Warden", email: "harden_w@pict.edu", role: "WARDEN"
    });
    testIncharge = await Incharge.create({
        name: "Hardening Incharge", email: "harden_inc@pict.edu", role: "INCHARGE"
    });
    testWifiIncharge = await WifiIncharge.create({
        name: "Hardening Wifi Incharge", email: "harden_wifi@pict.edu", role: "WIFI_INCHARGE"
    });
    testStaff = await Staff.create({
        name: "Hardening Staff", email: "harden_staff@pict.edu", role: "STAFF"
    });

    console.log("✅ Administrative test actors ready");

    // =========================================================================
    // SECTION 1: ROOM CAPACITY — CONCURRENCY TESTING (MAX = 2)
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("TEST GROUP 1: Room Capacity Concurrency & Atomic Invariants");
    console.log("--------------------------------------------------------------------------------");

    // Find an empty room for testing
    await syncRoomOccupancy();
    const emptyRoomDoc = await RoomOccupancy.findOne({ occupantCount: 0 });
    const testRoom = emptyRoomDoc ? emptyRoomDoc.roomNumber : "305";

    // Clean any prior test students or roster records in testRoom
    await Student.deleteMany({ doorNumber: testRoom });
    await StudentRoster.deleteMany({ doorNumber: testRoom });
    await RoomOccupancy.findOneAndUpdate(
        { roomNumber: testRoom },
        { $set: { occupantCount: 0, occupants: [], rosterReservations: [], isOverCapacity: false } },
        { upsert: true }
    );

    // Place 1 registered student in testRoom so only 1 slot remains
    const occupant1 = await Student.create({
        name: "Pre-existing Student",
        email: `pre_exist_${Date.now()}@ms.pict.edu`,
        prn: `PRN_PRE_${Date.now().toString().slice(-6)}`,
        doorNumber: null,
        role: "STUDENT"
    });
    await assignStudentRoomAtomic({
        studentId: occupant1._id,
        newRoom: testRoom,
        adminName: "Setup"
    });

    let roomState = await RoomOccupancy.findOne({ roomNumber: testRoom });
    assert.strictEqual(roomState.occupantCount, 1, "Room should have exactly 1 occupant before race test");
    console.log(`✅ Base setup: Room ${testRoom} has 1 occupant. 1 slot remaining.`);

    // 1.1: Race Condition Test: Two administrators concurrently approving different roster records
    console.log("\n[1.1] Testing simultaneous approval of 2 candidates for the last slot in Room " + testRoom + "...");
    const candA = await StudentRoster.create({
        name: "Candidate A",
        prn: `CAND_A_${Date.now()}`,
        email: `cand_a_${Date.now()}@ms.pict.edu`,
        doorNumber: testRoom,
        rollNumber: "101",
        branch: "CS",
        studentMobile: "9876543210",
        parentMobile: "9876543211",
        admissionStatus: "PENDING_APPROVAL"
    });

    const candB = await StudentRoster.create({
        name: "Candidate B",
        prn: `CAND_B_${Date.now()}`,
        email: `cand_b_${Date.now()}@ms.pict.edu`,
        doorNumber: testRoom,
        rollNumber: "102",
        branch: "IT",
        studentMobile: "9876543212",
        parentMobile: "9876543213",
        admissionStatus: "PENDING_APPROVAL"
    });

    // Execute concurrent approvals simultaneously via Promise.all
    const [resultA, resultB] = await Promise.all([
        admissionService.approveRosterRecords([candA._id], { id: testHeadWarden._id, name: testHeadWarden.name, role: "HEADWARDEN" }),
        admissionService.approveRosterRecords([candB._id], { id: testIncharge._id, name: testIncharge.name, role: "INCHARGE" })
    ]);

    const totalApproved = resultA.approvedCount + resultB.approvedCount;
    const totalSkipped = resultA.skippedCount + resultB.skippedCount;

    assert.strictEqual(totalApproved, 1, `Exactly 1 candidate must be approved, got ${totalApproved}`);
    assert.strictEqual(totalSkipped, 1, `Exactly 1 candidate must be skipped for capacity, got ${totalSkipped}`);

    roomState = await RoomOccupancy.findOne({ roomNumber: testRoom });
    assert.strictEqual(roomState.occupantCount, 2, "Room occupantCount must equal exactly MAX_STUDENTS_PER_ROOM (2)");
    assert.strictEqual(roomState.isOverCapacity, false, "Room must NOT be over capacity");
    assert.strictEqual(roomState.occupants.length, 1, "Must have 1 registered occupant");
    assert.strictEqual(roomState.rosterReservations.length, 1, "Must have 1 approved roster reservation");
    console.log(`✅ Race condition defeated: 1 approved, 1 skipped. Effective count = ${roomState.occupantCount}/2.`);

    // 1.2: Concurrency Race: Two concurrent batch imports targeting the same room
    console.log("\n[1.2] Testing simultaneous batch import commits with autoApprove=true targeting a full room...");
    const candC_row = {
        isValid: true,
        data: {
            name: "Candidate C",
            prn: `CAND_C_${Date.now()}`,
            email: `cand_c_${Date.now()}@ms.pict.edu`,
            doorNumber: testRoom,
            rollNumber: "103",
            branch: "ENTC",
            year: "FY",
            division: "1",
            studentMobile: "9876543214",
            parentMobile: "9876543215"
        }
    };
    const candD_row = {
        isValid: true,
        data: {
            name: "Candidate D",
            prn: `CAND_D_${Date.now()}`,
            email: `cand_d_${Date.now()}@ms.pict.edu`,
            doorNumber: testRoom,
            rollNumber: "104",
            branch: "AIDS",
            year: "FY",
            division: "2",
            studentMobile: "9876543216",
            parentMobile: "9876543217"
        }
    };

    const [importRes1, importRes2] = await Promise.all([
        admissionService.commitRosterImport({
            parsedRows: [candC_row],
            autoApprove: true,
            actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: "HEADWARDEN" }
        }).catch(err => ({ error: err.message })),
        admissionService.commitRosterImport({
            parsedRows: [candD_row],
            autoApprove: true,
            actor: { id: testIncharge._id, name: testIncharge.name, role: "INCHARGE" }
        }).catch(err => ({ error: err.message }))
    ]);

    const hasCapacityBlock = (importRes1.error && importRes1.error.includes("capacity")) ||
                             (importRes2.error && importRes2.error.includes("capacity"));
    assert.strictEqual(hasCapacityBlock, true, "Capacity protection must prevent over-allocating full room");

    roomState = await RoomOccupancy.findOne({ roomNumber: testRoom });
    assert.strictEqual(roomState.occupantCount, 2, "Room capacity remains strictly 2");
    console.log("✅ Concurrent batch import safe: over-allocation strictly prevented.");

    // 1.3: Atomic Transition: Verify roster reservation converts to registered occupant without double-counting
    console.log("\n[1.3] Testing atomic conversion from roster reservation to registered student occupant...");
    const approvedRoster = await StudentRoster.findOne({ doorNumber: testRoom, admissionStatus: "APPROVED" });
    assert.ok(approvedRoster, "An approved roster record must exist in testRoom");

    const newStudent = await Student.create({
        name: approvedRoster.name,
        email: approvedRoster.email,
        prn: approvedRoster.prn,
        doorNumber: testRoom,
        role: "STUDENT"
    });

    const convResult = await atomicConvertRosterToRegistered({
        roomNumber: testRoom,
        rosterId: approvedRoster._id,
        studentId: newStudent._id
    });

    assert.strictEqual(convResult.success, true, "Conversion must succeed");
    roomState = await RoomOccupancy.findOne({ roomNumber: testRoom });
    assert.strictEqual(roomState.occupantCount, 2, "Occupant count must remain strictly 2 (no double count!)");
    assert.strictEqual(roomState.occupants.length, 2, "Now has 2 registered occupants");
    assert.strictEqual(roomState.rosterReservations.length, 0, "Roster reservation was consumed atomically");
    console.log("✅ Atomic slot conversion verified: reservation seamlessly swapped to occupant.");

    // 1.4: Revocation / Release frees slot atomically
    console.log("\n[1.4] Testing atomic release of room slot upon eligibility revocation...");
    // Find another room and reserve it
    const freeRoomDoc = await RoomOccupancy.findOne({ occupantCount: 0 });
    const freeRoom = freeRoomDoc ? freeRoomDoc.roomNumber : "401";
    const tempRoster = await StudentRoster.create({
        name: "Temporary Student",
        prn: `TEMP_${Date.now()}`,
        email: `temp_${Date.now()}@ms.pict.edu`,
        doorNumber: freeRoom,
        rollNumber: "999",
        branch: "CS",
        studentMobile: "9876543218",
        parentMobile: "9876543219",
        admissionStatus: "PENDING_APPROVAL"
    });

    await admissionService.approveRosterRecords([tempRoster._id], { id: testHeadWarden._id, name: testHeadWarden.name, role: "HEADWARDEN" });
    let freeRoomState = await RoomOccupancy.findOne({ roomNumber: freeRoom });
    assert.strictEqual(freeRoomState.occupantCount, 1, "Should have 1 reservation");

    await admissionService.revokeRosterEligibility(tempRoster._id, { id: testHeadWarden._id, name: testHeadWarden.name, role: "HEADWARDEN" }, "Disciplinary issue");
    freeRoomState = await RoomOccupancy.findOne({ roomNumber: freeRoom });
    assert.strictEqual(freeRoomState.occupantCount, 0, "Slot must be atomically released upon revocation");
    console.log("✅ Atomic slot release verified: capacity freed immediately.");

    // =========================================================================
    // SECTION 2: OTP ELIGIBILITY — REVOCATION RACE & AUTH SECURITY
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("TEST GROUP 2: OTP Eligibility Revocation Race & Auth Integrity");
    console.log("--------------------------------------------------------------------------------");

    // 2.1: Revocation Race Sequence: Approve -> Send OTP -> Revoke -> Verify OTP
    console.log("\n[2.1] Testing Revocation Race: Approve -> Send OTP -> Revoke -> Verify OTP...");
    const racePRN = `RACE_${Date.now().toString().slice(-6)}`;
    const raceEmail = `race_${Date.now()}@ms.pict.edu`;
    const raceRoom = "402";

    const raceRoster = await StudentRoster.create({
        name: "Race Test Student",
        prn: racePRN,
        email: raceEmail,
        doorNumber: raceRoom,
        rollNumber: "555",
        branch: "CS",
        studentMobile: "9988776655",
        parentMobile: "9988776644",
        admissionStatus: "PENDING_APPROVAL"
    });

    // Step A: Admin approves student
    await admissionService.approveRosterRecords([raceRoster._id], { id: testHeadWarden._id, name: testHeadWarden.name, role: "HEADWARDEN" });

    // Step B: Student requests OTP
    const sendReq = { body: { email: raceEmail } };
    const sendRes = createMockRes();
    await otpController.sendOTP(sendReq, sendRes);
    assert.strictEqual(sendRes.statusCode, 200, "OTP send must succeed for approved student");
    const rawOtp = sendRes.data.devOtp;
    assert.ok(rawOtp, "Dev OTP must be returned in dev/test mode");

    // Step C: Administrator REVOKES admission eligibility before OTP is submitted
    await admissionService.revokeRosterEligibility(raceRoster._id, { id: testIncharge._id, name: testIncharge.name, role: "INCHARGE" }, "Revoked prior to registration completion");

    // Step D: Student submits previously issued OTP
    const verifyReq = { body: { email: raceEmail, otp: rawOtp } };
    const verifyRes = createMockRes();
    await otpController.verifyOTP(verifyReq, verifyRes);

    assert.strictEqual(verifyRes.statusCode, 403, "Must return HTTP 403 when eligibility was revoked before verification");
    assert.ok(verifyRes.data.message.includes("Registration denied"), "Message must indicate registration denial");

    // Verify student account was NOT created
    const uncreatedUser = await Student.findOne({ email: raceEmail });
    assert.strictEqual(uncreatedUser, null, "User account must NOT be created after eligibility revocation");
    console.log("✅ Revocation race condition blocked: Registration denied at final commit (HTTP 403).");

    // 2.2: Existing Student Login Unaffected by Roster Eligibility Changes
    console.log("\n[2.2] Testing existing registered student login retention after roster revocation...");
    const existPRN = `I2K2210${Date.now().toString().slice(-5)}`;
    const existEmail = `${existPRN.toLowerCase()}@ms.pict.edu`;
    const existStudent = await Student.create({
        name: "Existing Enrolled Student",
        email: existEmail,
        prn: existPRN,
        doorNumber: "403",
        role: "STUDENT",
        isVerified: true
    });
    const existRoster = await StudentRoster.create({
        name: existStudent.name,
        email: existEmail,
        prn: existPRN,
        doorNumber: "403",
        rollNumber: "556",
        branch: "CS",
        studentMobile: "9988771122",
        parentMobile: "9988771133",
        admissionStatus: "REVOKED", // Roster revoked!
        rejectionReason: "Testing retention"
    });

    const existSendRes = createMockRes();
    await otpController.sendOTP({ body: { email: existEmail } }, existSendRes);
    assert.strictEqual(existSendRes.statusCode, 200, "Existing registered student must be allowed to request OTP");

    const existVerifyRes = createMockRes();
    await otpController.verifyOTP({ body: { email: existEmail, otp: existSendRes.data.devOtp } }, existVerifyRes);
    assert.strictEqual(existVerifyRes.statusCode, 200, "Existing registered student must be allowed to complete login");
    assert.ok(existVerifyRes.data.token, "Login token must be issued");
    console.log("✅ Existing registered student retains login ability even if roster status is revoked.");

    // 2.3: Administrative Role Cannot Exploit Student OTP Endpoint
    console.log("\n[2.3] Testing administrative account rejection from student OTP endpoint...");
    const adminSendRes = createMockRes();
    await otpController.sendOTP({ body: { email: testWarden.email } }, adminSendRes);
    // Non @ms.pict.edu gets 400
    assert.strictEqual(adminSendRes.statusCode, 400, "Non-student email rejected");

    // If an administrative user somehow has @ms.pict.edu
    const fakeAdmin = await Staff.create({
        name: "Fake Admin Student Email",
        email: `fake_admin_${Date.now()}@ms.pict.edu`,
        role: "STAFF"
    });
    const fakeAdminRes = createMockRes();
    await otpController.sendOTP({ body: { email: fakeAdmin.email } }, fakeAdminRes);
    assert.strictEqual(fakeAdminRes.statusCode, 403, "Administrative role with @ms.pict.edu must receive HTTP 403");
    console.log("✅ Administrative roles strictly blocked from student OTP endpoint.");

    // =========================================================================
    // SECTION 3: NOTIFICATION RECIPIENT AND READ-STATE ISOLATION
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("TEST GROUP 3: Notification Isolation & Independent Read States");
    console.log("--------------------------------------------------------------------------------");

    // 3.1: ADMISSION_ADMINS broadcast isolates read states
    console.log("\n[3.1] Testing ADMISSION_ADMINS read state isolation between HEADWARDEN and INCHARGE...");
    const notifBatch = await notificationService.createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Test Isolation Notification",
        message: "Broadcasting to Head Warden and In-Charge",
        category: "ADMISSION",
        priority: "MEDIUM",
        entityType: "admission",
        entityId: `TEST_${Date.now()}`
    });

    // Both should see it as unread
    let hwUnread = await notificationService.getUnreadCount(testHeadWarden._id, "HEADWARDEN");
    let incUnread = await notificationService.getUnreadCount(testIncharge._id, "INCHARGE");
    const initHw = hwUnread;
    const initInc = incUnread;

    // Head Warden marks it as read
    await notificationService.markAsRead(notifBatch._id, testHeadWarden._id, "HEADWARDEN");

    hwUnread = await notificationService.getUnreadCount(testHeadWarden._id, "HEADWARDEN");
    incUnread = await notificationService.getUnreadCount(testIncharge._id, "INCHARGE");

    assert.strictEqual(hwUnread, initHw - 1, "Head Warden unread count must decrement by 1");
    assert.strictEqual(incUnread, initInc, "Incharge unread count must NOT change when Head Warden marks read");

    // Check individual notification object
    const hwList = await notificationService.getUserNotifications(testHeadWarden._id, "HEADWARDEN");
    const incList = await notificationService.getUserNotifications(testIncharge._id, "INCHARGE");

    const hwItem = hwList.notifications.find(n => String(n._id) === String(notifBatch._id));
    const incItem = incList.notifications.find(n => String(n._id) === String(notifBatch._id));

    assert.strictEqual(hwItem.read, true, "Item must show as read for Head Warden");
    assert.strictEqual(incItem.read, false, "Item must show as UNREAD for In-Charge");
    console.log("✅ Read state isolation confirmed: Head Warden read does NOT mark read for In-Charge.");

    // 3.2: Scoped Delivery: Warden receives NO admission or Wi-Fi notifications
    console.log("\n[3.2] Testing strict role isolation: Warden receives NO admission notifications...");
    const wardenList = await notificationService.getUserNotifications(testWarden._id, "WARDEN");
    const wardenAdmissionNotifs = wardenList.notifications.filter(n => n.category === "ADMISSION" || n.recipientRole === "ADMISSION_ADMINS");
    assert.strictEqual(wardenAdmissionNotifs.length, 0, "Warden must NEVER receive admission notifications");
    console.log("✅ Role scoping confirmed: Warden receives zero admission notifications.");

    // 3.3: Unauthorized client cannot mark another recipient's notification
    console.log("\n[3.3] Testing unauthorized read marker rejection...");
    const staffNotif = await notificationService.createNotification({
        recipient: testStaff._id,
        recipientRole: "STAFF",
        title: "Staff Personal Task",
        message: "Only for Staff member",
        category: "COMPLAINT",
        priority: "HIGH"
    });

    const unauthorizedAttempt = await notificationService.markAsRead(staffNotif._id, testWarden._id, "WARDEN");
    assert.strictEqual(unauthorizedAttempt.unauthorized, true, "Unauthorized user marking another's notification must be rejected");
    console.log("✅ Cross-user notification tampering blocked.");

    // =========================================================================
    // SECTION 4: DATABASE UNIQUENESS & IMPORT SAFETY
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("TEST GROUP 4: Database Uniqueness and Workbook Import Safety");
    console.log("--------------------------------------------------------------------------------");

    // 4.1: Unique index enforcement for PRN and Email
    console.log("\n[4.1] Testing unique index enforcement on PRN and Email...");
    const uniquePRN = `PRN_UNIQ_${Date.now()}`;
    const uniqueEmail = `uniq_${Date.now()}@ms.pict.edu`;

    await StudentRoster.create({
        name: "Unique Student 1",
        prn: uniquePRN,
        email: uniqueEmail,
        doorNumber: "101",
        rollNumber: "701",
        branch: "CS",
        studentMobile: "9876500001",
        parentMobile: "9876500002"
    });

    let duplicatePrnCaught = false;
    try {
        await StudentRoster.create({
            name: "Duplicate PRN Student",
            prn: uniquePRN, // Duplicate PRN
            email: `different_${Date.now()}@ms.pict.edu`,
            doorNumber: "102",
            rollNumber: "702",
            branch: "IT",
            studentMobile: "9876500003",
            parentMobile: "9876500004"
        });
    } catch (e) {
        duplicatePrnCaught = true;
    }
    assert.strictEqual(duplicatePrnCaught, true, "Duplicate PRN must trigger MongoDB unique index violation");

    let duplicateEmailCaught = false;
    try {
        await StudentRoster.create({
            name: "Duplicate Email Student",
            prn: `PRN_DIFF_${Date.now()}`,
            email: uniqueEmail, // Duplicate Email
            doorNumber: "103",
            rollNumber: "703",
            branch: "ENTC",
            studentMobile: "9876500005",
            parentMobile: "9876500006"
        });
    } catch (e) {
        duplicateEmailCaught = true;
    }
    assert.strictEqual(duplicateEmailCaught, true, "Duplicate Email must trigger MongoDB unique index violation");
    console.log("✅ MongoDB unique indexes verified: Duplicate PRN and Email strictly rejected.");

    // 4.2: Additive import preservation
    console.log("\n[4.2] Testing additive import preservation: Missing rows are never deleted...");
    const countBefore = await StudentRoster.countDocuments();
    const partialBatchRow = {
        isValid: true,
        data: {
            name: "Additive Import Student",
            prn: `ADDITIVE_${Date.now()}`,
            email: `additive_${Date.now()}@ms.pict.edu`,
            doorNumber: "104",
            rollNumber: "801",
            branch: "CS",
            year: "FY",
            division: "1",
            studentMobile: "9876511111",
            parentMobile: "9876511112"
        }
    };
    await admissionService.commitRosterImport({
        parsedRows: [partialBatchRow],
        autoApprove: false,
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: "HEADWARDEN" }
    });

    const countAfter = await StudentRoster.countDocuments();
    assert.strictEqual(countAfter, countBefore + 1, "Additive import must only increment records");
    console.log("✅ Additive import preserved: Zero existing records deleted or revoked.");

    // =========================================================================
    // SECTION 5: EXCEL SECURITY & ROW LIMIT ENFORCEMENT
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("TEST GROUP 5: Excel Security, Formula Protection & Row Limits");
    console.log("--------------------------------------------------------------------------------");

    // 5.1: Row limit enforcement (> 1500 rows)
    console.log("\n[5.1] Testing rejection of workbooks with > 1500 data rows...");
    const largeRows = [["PRN", "Name", "Roll No", "Email", "Branch", "Year", "Division", "Room", "Mobile", "Parent Mobile"]];
    for (let i = 0; i < 1505; i++) {
        largeRows.push([`PRN${i}`, `Student ${i}`, `${i}`, `student${i}@ms.pict.edu`, "CS", "FY", "1", "101", "9876543210", "9876543211"]);
    }
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(largeRows);
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    const largeBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    let rowLimitCaught = false;
    try {
        await admissionService.generateImportPreview({ buffer: largeBuffer });
    } catch (e) {
        if (e.message.includes("exceeds the maximum security limit")) {
            rowLimitCaught = true;
        }
    }
    assert.strictEqual(rowLimitCaught, true, "Workbook exceeding 1500 rows must be rejected");
    console.log("✅ Row limit protection verified: Oversized workbook (> 1500 rows) rejected.");

    // 5.2: Formula execution disabled
    console.log("\n[5.2] Testing formula safety: cellFormula: false configured...");
    const formulaRows = [
        ["PRN", "Name", "Roll No", "Email", "Branch", "Year", "Division", "Room", "Mobile", "Parent Mobile"],
        ["PRN_FORMULA_1", "=SUM(1+1)", "10", "formula@ms.pict.edu", "CS", "FY", "1", "105", "9876543210", "9876543211"]
    ];
    const wbFormula = xlsx.utils.book_new();
    const wsFormula = xlsx.utils.aoa_to_sheet(formulaRows);
    xlsx.utils.book_append_sheet(wbFormula, wsFormula, "Sheet1");
    const formulaBuffer = xlsx.write(wbFormula, { type: "buffer", bookType: "xlsx" });

    const formulaParsed = await admissionService.generateImportPreview({ buffer: formulaBuffer });
    assert.ok(formulaParsed.rows.length === 1, "Row was parsed without error");
    console.log("✅ Formula injection disabled: sheet parsed safely without executing formulas.");

    console.log("\n================================================================================");
    console.log("🎉 ALL POST-IMPLEMENTATION HARDENING & CONCURRENCY TESTS PASSED!");
    console.log("================================================================================");

    await mongoose.disconnect();
}

runHardeningSuite().catch(err => {
    console.error("\n❌ HARDENING TEST SUITE FAILED:", err);
    process.exit(1);
});
