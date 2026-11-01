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
const Complaint = require("../backend/models/Complaint");
const OTP = require("../backend/models/OTP");
const admissionService = require("../backend/services/admissionService");
const notificationService = require("../backend/services/notificationService");
const { checkRoomCapacity, syncRoomOccupancy } = require("../backend/services/roomOccupancyService");
const { ALL_ROOMS } = require("../backend/utils/hostelRooms");

let testHeadWarden, testWarden, testIncharge, testWifiIncharge, testStaff, testStudent;

async function runTestSuite() {
    console.log("================================================================================");
    console.log("🧪 STARTING COMPREHENSIVE ADMISSION & NOTIFICATION SYSTEM TEST SUITE");
    console.log("================================================================================\n");

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Setup Test Users
    console.log("\n--- STEP 1: Setting up Test Actors ---");
    await User.deleteMany({
        email: { $in: [
            "test_hw_auto@pict.edu",
            "test_w_auto@pict.edu",
            "test_inc_auto@pict.edu",
            "test_wifi_auto@pict.edu",
            "test_staff_auto@pict.edu",
            "aarav.kulkarni@ms.pict.edu",
            "tanvi.deshmukh@ms.pict.edu"
        ]}
    });
    await StudentRoster.deleteMany({
        prn: { $in: ["PRN_TEST_01", "PRN_TEST_02", "PRN_TEST_03_INVALID", "PRN_TEST_03_THIRD", "PRN_NEW_01", "PRN_NEW_02"] }
    });
    await OTP.deleteMany({
        email: { $in: ["aarav.kulkarni@ms.pict.edu", "tanvi.deshmukh@ms.pict.edu"] }
    });
    await syncRoomOccupancy();

    testHeadWarden = await HeadWarden.create({
        name: "Test Head Warden", email: "test_hw_auto@pict.edu", role: "HEADWARDEN"
    });
    testWarden = await Warden.create({
        name: "Test Regular Warden", email: "test_w_auto@pict.edu", role: "WARDEN"
    });
    testIncharge = await Incharge.create({
        name: "Test Hostel Incharge", email: "test_inc_auto@pict.edu", role: "INCHARGE"
    });
    testWifiIncharge = await WifiIncharge.create({
        name: "Test Wifi Incharge", email: "test_wifi_auto@pict.edu", role: "WIFI_INCHARGE"
    });
    testStaff = await Staff.create({
        name: "Test Electrician Staff", email: "test_staff_auto@pict.edu", role: "STAFF"
    });

    console.log("Actors verified: HEADWARDEN, WARDEN, INCHARGE, WIFI_INCHARGE, STAFF");

    // 2. Test Excel Workbook Generation & Flexible Column Recognition
    console.log("\n--- STEP 2: Testing Flexible Excel Roster Parsing & Column Recognition ---");
    
    // Create an Excel workbook in memory with non-standard headers and different column arrangement
    const nonStandardHeaders = [
        "Reg No",                // PRN alias
        "Candidate Name",        // Name alias
        "Class Roll No",         // Roll number alias
        "College Email",         // Email alias
        "Department",            // Branch alias
        "Class Year",            // Year alias
        "Section",               // Division alias
        "Allocated Room",        // Room alias
        "Student Phone",         // Student contact alias
        "Guardian Contact",      // Parent contact alias
        "Extraneous Info"        // Unknown column to be ignored
    ];

    // Find a completely empty room for testing
    const currentOcc = await admissionService.getCurrentRoomOccupancyMap();
    const testRoom = ALL_ROOMS.find(r => currentOcc[r] === 0) || "508";
    console.log("Selected empty test room:", testRoom);

    const testRows = [
        [
            "PRN_TEST_01",
            "Aarav Kulkarni",
            "101",
            "aarav.kulkarni@ms.pict.edu",
            "CE",
            "FY",
            "1",
            testRoom,               // Room occupant 1
            "9823000001",
            "9823000002",
            "Some Notes"
        ],
        [
            "PRN_TEST_02",
            "Tanvi Deshmukh",
            "102",
            "tanvi.deshmukh@ms.pict.edu",
            "IT",
            "FY",
            "2",
            testRoom,               // Room occupant 2
            "9823000003",
            "9823000004",
            "Some Notes"
        ],
        [
            "PRN_TEST_03_INVALID",
            "Invalid Student",
            "103",
            "invalid.email@gmail.com", // INVALID EMAIL DOMAIN
            "AIDS",
            "FY",
            "1",
            "999",                     // INVALID ROOM NUMBER
            "12345",                   // INVALID PHONE
            "67890",                   // INVALID PHONE
            "Some Notes"
        ]
    ];

    const ws = xlsx.utils.aoa_to_sheet([nonStandardHeaders, ...testRows]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Hostel_Allotment");
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([["Empty Sheet"]]), "Notes");
    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // Test worksheet detection
    const sheets = admissionService.getWorksheetNames(excelBuffer);
    assert.deepStrictEqual(sheets, ["Hostel_Allotment", "Notes"], "Worksheet detection failed");
    console.log("✅ Worksheets detected successfully:", sheets);

    // Test dry-run preview (Zero DB writes)
    const initialRosterCount = await StudentRoster.countDocuments();
    const preview = await admissionService.generateImportPreview({
        buffer: excelBuffer,
        sheetName: "Hostel_Allotment"
    });

    const postPreviewRosterCount = await StudentRoster.countDocuments();
    assert.strictEqual(initialRosterCount, postPreviewRosterCount, "Dry-run preview must perform ZERO database writes!");
    console.log("✅ Verified: Dry-run preview performed ZERO database writes.");

    // Check summary
    assert.strictEqual(preview.summary.totalRows, 3, "Total rows mismatch");
    assert.strictEqual(preview.summary.validCount, 2, "Valid rows mismatch");
    assert.strictEqual(preview.summary.invalidCount, 1, "Invalid rows mismatch");
    assert.ok(preview.unmappedColumns.includes("Extraneous Info"), "Unmapped column detection failed");
    console.log("✅ Summary verified: 2 valid rows, 1 invalid row, unmapped column correctly isolated.");

    // 3. Test Commit Import as Pending Approval
    console.log("\n--- STEP 3: Testing Import Commit (Pending Approval) ---");
    // Clean up any test records first
    await StudentRoster.deleteMany({ prn: { $in: ["PRN_TEST_01", "PRN_TEST_02", "PRN_TEST_03_INVALID", "PRN_NEW_01"] } });

    const commitResult = await admissionService.commitRosterImport({
        parsedRows: preview.rows,
        autoApprove: false,
        batchMeta: { originalFileName: "test_allotment.xlsx", worksheetName: "Hostel_Allotment" },
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    });

    assert.strictEqual(commitResult.pendingCount, 2, "Committed pending count mismatch");
    console.log("✅ 2 records successfully committed as PENDING_APPROVAL with Batch ID:", commitResult.batchId);

    // 4. Test OTP Registration Gate with Pending Record
    console.log("\n--- STEP 4: Testing OTP Registration Gate with PENDING_APPROVAL Record ---");
    const { sendOTP } = require("../backend/controllers/otpController");

    let mockResStatus = null;
    let mockResJson = null;
    const mockRes = {
        status: (code) => { mockResStatus = code; return mockRes; },
        json: (data) => { mockResJson = data; return mockRes; }
    };

    // Attempt OTP with pending student
    await sendOTP({ body: { email: "aarav.kulkarni@ms.pict.edu" } }, mockRes);
    assert.strictEqual(mockResStatus, 403, "Pending student must be blocked from OTP registration!");
    assert.ok(mockResJson.message.includes("pending approval"), "Expected pending approval message");
    console.log("✅ Verified: Pending student blocked from OTP with HTTP 403:", mockResJson.message);

    // 5. Test Approval of Registration Eligibility by INCHARGE
    console.log("\n--- STEP 5: Testing Approval by INCHARGE (Equal Authority Verification) ---");
    const pendingStudent = await StudentRoster.findOne({ prn: "PRN_TEST_01" });
    assert.strictEqual(pendingStudent.admissionStatus, "PENDING_APPROVAL");

    const approveResult = await admissionService.approveRosterRecords(
        [pendingStudent._id],
        { id: testIncharge._id, name: testIncharge.name, role: testIncharge.role },
        "Approved by Hostel In-Charge for Room 103"
    );
    assert.strictEqual(approveResult.approvedCount, 1, "Approval failed");

    const approvedStudent = await StudentRoster.findOne({ prn: "PRN_TEST_01" });
    assert.strictEqual(approvedStudent.admissionStatus, "APPROVED", "Status must transition to APPROVED");
    assert.strictEqual(approvedStudent.statusHistory[approvedStudent.statusHistory.length - 1].changedBy.role, "INCHARGE");
    console.log("✅ Verified: INCHARGE independently approved student record. Audit captured role:", approvedStudent.statusHistory[approvedStudent.statusHistory.length - 1].changedBy.role);

    // 6. Test OTP Registration with APPROVED Record
    console.log("\n--- STEP 6: Testing OTP Issuance for APPROVED Record ---");
    mockResStatus = null;
    mockResJson = null;
    await OTP.deleteMany({ email: "aarav.kulkarni@ms.pict.edu" });

    await sendOTP({ body: { email: "aarav.kulkarni@ms.pict.edu" } }, mockRes);
    assert.ok(!mockResStatus || mockResStatus === 200, "Approved student should receive OTP successfully!");
    assert.ok(mockResJson.emailDelivered !== undefined, "OTP delivery response expected");
    console.log("✅ Verified: Approved student permitted to receive registration OTP!");

    // Verify registration status updated to REGISTRATION_STARTED
    const regStartedStudent = await StudentRoster.findOne({ prn: "PRN_TEST_01" });
    assert.strictEqual(regStartedStudent.registrationStatus, "REGISTRATION_STARTED");
    console.log("✅ Verified: Roster registrationStatus transitioned to REGISTRATION_STARTED");

    // 7. Test Revoke & Restore Eligibility Lifecycle
    console.log("\n--- STEP 7: Testing Revoke & Restore Eligibility Lifecycle ---");
    // Revoke
    await admissionService.revokeRosterEligibility(
        pendingStudent._id,
        { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role },
        "Disciplinary fee non-payment"
    );

    const revokedStudent = await StudentRoster.findOne({ prn: "PRN_TEST_01" });
    assert.strictEqual(revokedStudent.admissionStatus, "REVOKED");
    assert.strictEqual(revokedStudent.rejectionReason, "Disciplinary fee non-payment");
    console.log("✅ Verified: Eligibility revoked with mandatory reason recorded.");

    // Attempt OTP with revoked student
    mockResStatus = null;
    mockResJson = null;
    await sendOTP({ body: { email: "aarav.kulkarni@ms.pict.edu" } }, mockRes);
    assert.strictEqual(mockResStatus, 403, "Revoked student must be blocked from OTP!");
    assert.ok(mockResJson.message.includes("revoked"), "Expected revocation message");
    console.log("✅ Verified: Revoked student blocked from OTP registration with HTTP 403:", mockResJson.message);

    // Restore
    await admissionService.restoreRosterEligibility(
        pendingStudent._id,
        { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role },
        "Dues cleared upon office verification"
    );

    const restoredStudent = await StudentRoster.findOne({ prn: "PRN_TEST_01" });
    assert.strictEqual(restoredStudent.admissionStatus, "APPROVED");
    console.log("✅ Verified: Eligibility restored to APPROVED upon authorized review.");

    // 8. Test Strict Maximum 2 Students Per Room Capacity Invariant
    console.log("\n--- STEP 8: Testing Absolute Room Capacity Invariant (MAX_STUDENTS_PER_ROOM = 2) ---");
    // Make sure testRoom has 2 approved occupants
    const p2 = await StudentRoster.findOne({ prn: "PRN_TEST_02" });
    await admissionService.approveRosterRecords(
        [p2._id],
        { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    );

    // Check capacity of testRoom (now has PRN_TEST_01 and PRN_TEST_02 reserving capacity)
    const capCheck = await checkRoomCapacity(testRoom);
    assert.strictEqual(capCheck.allowed, false, `Room ${testRoom} should be full at 2 students!`);
    console.log(`✅ Verified: Room ${testRoom} capacity reached limit of 2 students:`, capCheck.message);

    // Attempt to approve a 3rd student into testRoom
    const thirdStudent = new StudentRoster({
        prn: "PRN_TEST_03_THIRD",
        name: "Third Resident",
        rollNumber: "10303",
        email: "third.student@ms.pict.edu",
        branch: "CE",
        doorNumber: testRoom, // Same room
        studentMobile: "9876543219",
        parentMobile: "9876543218",
        admissionStatus: "PENDING_APPROVAL"
    });
    await thirdStudent.save();

    const thirdApproveResult = await admissionService.approveRosterRecords(
        [thirdStudent._id],
        { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    );
    assert.strictEqual(thirdApproveResult.approvedCount, 0, `Third occupant must not be approved into Room ${testRoom}!`);
    assert.strictEqual(thirdApproveResult.skippedCount, 1, "Third occupant must be skipped due to capacity violation");
    console.log("✅ Verified: 3rd occupant blocked from room allocation:", thirdApproveResult.skipped[0].reason);

    // Cleanup third test student
    await StudentRoster.deleteOne({ _id: thirdStudent._id });

    // 9. Test Additive Import Invariant (Missing rows are NEVER deleted or revoked)
    console.log("\n--- STEP 9: Testing Additive Import (Zero Deletions of Missing Students) ---");
    const freshOcc = await admissionService.getCurrentRoomOccupancyMap();
    const freeRoomForStep9 = ALL_ROOMS.find(r => (freshOcc[r] || 0) === 0 && r !== testRoom) || "507";

    // Create an Excel with only 1 new student (PRN_NEW_01)
    const newWs = xlsx.utils.aoa_to_sheet([
        ["PRN", "Name", "Roll No", "Email", "Branch", "Year", "Room No", "Student Mobile", "Parent Mobile"],
        ["PRN_NEW_01", "New Candidate", "901", "new.cand@ms.pict.edu", "CE", "FY", freeRoomForStep9, "9812345678", "9812345679"]
    ]);
    const newWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWb, newWs, "Sheet1");
    const newBuffer = xlsx.write(newWb, { type: "buffer", bookType: "xlsx" });

    const newPreview = await admissionService.generateImportPreview({ buffer: newBuffer });
    await admissionService.commitRosterImport({
        parsedRows: newPreview.rows,
        autoApprove: false,
        actor: { id: testHeadWarden._id, name: testHeadWarden.name, role: testHeadWarden.role }
    });

    // Check that previously existing PRN_TEST_01 is still APPROVED and untouched!
    const stillExisting = await StudentRoster.findOne({ prn: "PRN_TEST_01" });
    assert.ok(stillExisting, "Existing student must NOT be deleted when absent from new spreadsheet!");
    assert.strictEqual(stillExisting.admissionStatus, "APPROVED", "Existing student status must NOT be modified or revoked!");
    console.log("✅ Verified: Additive import invariant satisfied. Existing students preserved intact.");

    // 10. Test Role Permissions and WARDEN Absolute Exclusion
    console.log("\n--- STEP 10: Testing Role Permissions and WARDEN 403 Exclusion ---");
    const { admissionAdminMiddleware } = require("../backend/middleware/auth");

    let mwNextCalled = false;
    let mwResStatus = null;
    let mwResJson = null;

    const mockMiddlewareRes = {
        status: (code) => { mwResStatus = code; return mockMiddlewareRes; },
        json: (data) => { mwResJson = data; return mockMiddlewareRes; }
    };

    // Test HEADWARDEN -> Allowed
    mwNextCalled = false;
    admissionAdminMiddleware({ user: { role: "HEADWARDEN" } }, mockMiddlewareRes, () => { mwNextCalled = true; });
    assert.strictEqual(mwNextCalled, true, "HEADWARDEN must pass admissionAdminMiddleware");

    // Test INCHARGE -> Allowed
    mwNextCalled = false;
    admissionAdminMiddleware({ user: { role: "INCHARGE" } }, mockMiddlewareRes, () => { mwNextCalled = true; });
    assert.strictEqual(mwNextCalled, true, "INCHARGE must pass admissionAdminMiddleware");

    // Test WARDEN -> Blocked HTTP 403
    mwNextCalled = false;
    mwResStatus = null;
    admissionAdminMiddleware({ user: { role: "WARDEN" } }, mockMiddlewareRes, () => { mwNextCalled = true; });
    assert.strictEqual(mwNextCalled, false, "WARDEN must NOT pass admissionAdminMiddleware");
    assert.strictEqual(mwResStatus, 403, "WARDEN must receive HTTP 403");
    console.log("✅ Verified: WARDEN receives HTTP 403 for admission operations:", mwResJson.message);

    // Test WIFI_INCHARGE -> Blocked HTTP 403
    mwNextCalled = false;
    mwResStatus = null;
    admissionAdminMiddleware({ user: { role: "WIFI_INCHARGE" } }, mockMiddlewareRes, () => { mwNextCalled = true; });
    assert.strictEqual(mwResStatus, 403, "WIFI_INCHARGE must receive HTTP 403");

    // Test STAFF -> Blocked HTTP 403
    mwNextCalled = false;
    mwResStatus = null;
    admissionAdminMiddleware({ user: { role: "STAFF" } }, mockMiddlewareRes, () => { mwNextCalled = true; });
    assert.strictEqual(mwResStatus, 403, "STAFF must receive HTTP 403");

    // Test STUDENT -> Blocked HTTP 403
    mwNextCalled = false;
    mwResStatus = null;
    admissionAdminMiddleware({ user: { role: "STUDENT" } }, mockMiddlewareRes, () => { mwNextCalled = true; });
    assert.strictEqual(mwResStatus, 403, "STUDENT must receive HTTP 403");
    console.log("✅ Verified: All unauthorized roles (WARDEN, WIFI_INCHARGE, STAFF, STUDENT) strictly blocked with HTTP 403.");

    // 11. Test Real-Time Administrative Notification Persistence & Role Isolation
    console.log("\n--- STEP 11: Testing Notification Persistence & Strict Role Isolation ---");
    // Clear notifications for test
    await Notification.deleteMany({ dedupKey: { $regex: /^test_/ } });

    // 1. Create a Wi-Fi complaint notification -> Must go ONLY to WIFI_INCHARGE
    await notificationService.createNotification({
        recipientRole: "WIFI_INCHARGE",
        title: "Test Wi-Fi Issue",
        message: "Room 101 router offline",
        category: "COMPLAINT",
        priority: "HIGH",
        entityType: "complaint",
        entityId: "test_wifi_cid",
        dedupKey: "test_wifi_1"
    });

    // 2. Create an Admission notification -> Must go ONLY to ADMISSION_ADMINS (HEADWARDEN, INCHARGE)
    await notificationService.createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Test Admission Event",
        message: "New roster imported",
        category: "ADMISSION",
        priority: "MEDIUM",
        entityType: "admission",
        entityId: "test_batch_1",
        dedupKey: "test_admission_1"
    });

    // 3. Create a Water / Electricity notification -> Must go to WARDEN
    await notificationService.createNotification({
        recipientRole: "WARDEN",
        title: "Test Water Leak",
        message: "Room 205 tap leakage",
        category: "COMPLAINT",
        priority: "MEDIUM",
        entityType: "complaint",
        entityId: "test_water_cid",
        dedupKey: "test_water_1"
    });

    // Query notifications for WARDEN:
    const wardenNotifs = await notificationService.getUserNotifications(testWarden._id, "WARDEN");
    const wardenTitles = wardenNotifs.notifications.map(n => n.title);
    assert.ok(wardenTitles.includes("Test Water Leak"), "Warden should receive Water complaint notification");
    assert.ok(!wardenTitles.includes("Test Wi-Fi Issue"), "Warden must NEVER receive Wi-Fi notifications!");
    assert.ok(!wardenTitles.includes("Test Admission Event"), "Warden must NEVER receive Admission notifications!");
    console.log("✅ Verified: WARDEN received Water notification, and was strictly excluded from Wi-Fi & Admission notifications.");

    // Query notifications for WIFI_INCHARGE:
    const wifiNotifs = await notificationService.getUserNotifications(testWifiIncharge._id, "WIFI_INCHARGE");
    const wifiTitles = wifiNotifs.notifications.map(n => n.title);
    assert.ok(wifiTitles.includes("Test Wi-Fi Issue"), "Wi-Fi incharge should receive Wi-Fi notification");
    assert.ok(!wifiTitles.includes("Test Water Leak"), "Wi-Fi incharge must NOT receive Warden notifications!");
    assert.ok(!wifiTitles.includes("Test Admission Event"), "Wi-Fi incharge must NOT receive Admission notifications!");
    console.log("✅ Verified: WIFI_INCHARGE received Wi-Fi notification, strictly excluded from Warden & Admission notifications.");

    // Query notifications for HEADWARDEN:
    const hwNotifs = await notificationService.getUserNotifications(testHeadWarden._id, "HEADWARDEN");
    const hwTitles = hwNotifs.notifications.map(n => n.title);
    assert.ok(hwTitles.includes("Test Admission Event"), "Head Warden should receive Admission notification");
    assert.ok(!hwTitles.includes("Test Wi-Fi Issue"), "Head Warden must NOT receive Wi-Fi notification");
    console.log("✅ Verified: HEADWARDEN received Admission notifications, excluded from Wi-Fi.");

    // 12. Test Notification Mark As Read & Unread Count
    console.log("\n--- STEP 12: Testing Mark-As-Read & Unread Count ---");
    const unreadBefore = await notificationService.getUnreadCount(testHeadWarden._id, "HEADWARDEN");
    assert.ok(unreadBefore > 0, "Unread count must be > 0");

    await notificationService.markAllAsRead(testHeadWarden._id, "HEADWARDEN");
    const unreadAfter = await notificationService.getUnreadCount(testHeadWarden._id, "HEADWARDEN");
    assert.strictEqual(unreadAfter, 0, "Unread count must be 0 after markAllAsRead");
    console.log(`✅ Verified: Unread count transitioned from ${unreadBefore} to ${unreadAfter} after markAllAsRead.`);

    // 13. Test Deduplication
    console.log("\n--- STEP 13: Testing Notification Deduplication ---");
    const notifCountBefore = await Notification.countDocuments({ dedupKey: "test_dedup_key" });
    await notificationService.createNotification({
        recipientRole: "WARDEN",
        title: "Dedup Test",
        message: "First instance",
        dedupKey: "test_dedup_key"
    });
    // Immediately call again with same dedupKey
    await notificationService.createNotification({
        recipientRole: "WARDEN",
        title: "Dedup Test",
        message: "Duplicate instance",
        dedupKey: "test_dedup_key"
    });
    const notifCountAfter = await Notification.countDocuments({ dedupKey: "test_dedup_key" });
    assert.strictEqual(notifCountAfter, 1, "Duplicate notifications with same dedupKey must not be inserted!");
    console.log("✅ Verified: Duplicate notification suppressed by dedupKey window.");

    // Clean up temporary test data
    await StudentRoster.deleteMany({ prn: { $in: ["PRN_TEST_01", "PRN_TEST_02", "PRN_NEW_01"] } });
    await Notification.deleteMany({ dedupKey: { $regex: /^test_/ } });

    console.log("\n================================================================================");
    console.log("🎉 ALL 13 TEST PHASES PASSED WITH ZERO FAILURES!");
    console.log("================================================================================\n");

    process.exit(0);
}

runTestSuite().catch(err => {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
});
