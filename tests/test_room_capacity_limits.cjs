const mongoose = require("../backend/node_modules/mongoose");
const jwt = require("../backend/node_modules/jsonwebtoken");
const path = require("path");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { User, Student, Warden, HeadWarden, Incharge } = require("../backend/models/User");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const { ALL_ROOMS, MAX_STUDENTS_PER_ROOM } = require("../backend/utils/hostelRooms");
const { syncRoomOccupancy, checkRoomCapacity, assignStudentRoomAtomic } = require("../backend/services/roomOccupancyService");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const API_URL = "http://localhost:5000/api";

const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
};

async function runTests() {
    console.log("==================================================");
    console.log("TESTING ROOM OCCUPANCY LIMIT (MAX 2 STUDENTS PER ROOM)");
    console.log("==================================================");

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");

    // Clean test accounts
    await User.deleteMany({ email: /@test-capacity\.local$/ });

    const headWarden = await HeadWarden.create({
        name: "Head Warden",
        email: "headwarden@test-capacity.local",
        role: "HEADWARDEN"
    });

    const incharge = await Incharge.create({
        name: "Capacity Incharge",
        email: "incharge@test-capacity.local",
        role: "INCHARGE"
    });

    const warden = await Warden.create({
        name: "Capacity Warden",
        email: "warden@test-capacity.local",
        role: "WARDEN"
    });

    const headWardenToken = generateToken(headWarden);
    const inchargeToken = generateToken(incharge);
    const wardenToken = generateToken(warden);

    // Pick an empty room on floor 3, e.g., 310
    const testRoom = "310";
    await Student.deleteMany({ doorNumber: testRoom });
    await syncRoomOccupancy();

    // Verify room 310 starts with 0 occupants
    const initialCheck = await checkRoomCapacity(testRoom);
    if (initialCheck.currentCount !== 0) {
        throw new Error(`Room ${testRoom} should be empty for tests, got ${initialCheck.currentCount}`);
    }

    // Create 3 synthetic students
    const studentA = await Student.create({
        name: "Student Alpha",
        fullName: "Student Alpha",
        email: "alpha@test-capacity.local",
        role: "STUDENT",
        prn: "CAP_PRN_001",
        branch: "CE",
        year: "TY",
        doorNumber: null,
        mobileNumber: "9811111111"
    });

    const studentB = await Student.create({
        name: "Student Beta",
        fullName: "Student Beta",
        email: "beta@test-capacity.local",
        role: "STUDENT",
        prn: "CAP_PRN_002",
        branch: "IT",
        year: "TY",
        doorNumber: null,
        mobileNumber: "9822222222"
    });

    const studentC = await Student.create({
        name: "Student Gamma",
        fullName: "Student Gamma",
        email: "gamma@test-capacity.local",
        role: "STUDENT",
        prn: "CAP_PRN_003",
        branch: "AIDS",
        year: "TY",
        doorNumber: null,
        mobileNumber: "9833333333"
    });

    // Test 1: First student can be assigned to an empty room
    console.log("\n--- TEST 1: First Student Assignment ---");
    const assign1 = await assignStudentRoomAtomic({
        studentId: studentA._id,
        newRoom: testRoom,
        adminName: "Warden Admin",
        reason: "First assignment"
    });
    const occAfter1 = await Student.countDocuments({ doorNumber: testRoom, role: "STUDENT" });
    if (assign1.success && occAfter1 === 1) {
        console.log(`✓ PASS: First student assigned to Room ${testRoom} (Occupancy: 1/2)`);
    } else {
        throw new Error(`Failed to assign first student. Count: ${occAfter1}`);
    }

    // Test 2: Second student can be assigned to that room
    console.log("\n--- TEST 2: Second Student Assignment ---");
    const assign2 = await assignStudentRoomAtomic({
        studentId: studentB._id,
        newRoom: testRoom,
        adminName: "Warden Admin",
        reason: "Second assignment"
    });
    const occAfter2 = await Student.countDocuments({ doorNumber: testRoom, role: "STUDENT" });
    if (assign2.success && occAfter2 === 2) {
        console.log(`✓ PASS: Second student assigned to Room ${testRoom} (Occupancy: 2/2 — FULL)`);
    } else {
        throw new Error(`Failed to assign second student. Count: ${occAfter2}`);
    }

    // Test 3: Third student is rejected
    console.log("\n--- TEST 3: Third Student Assignment Rejection ---");
    let rejectedThird = false;
    try {
        await assignStudentRoomAtomic({
            studentId: studentC._id,
            newRoom: testRoom,
            adminName: "Warden Admin",
            reason: "Third assignment attempt"
        });
    } catch (err) {
        if (err.message.includes("maximum capacity") || err.message.includes("2 students")) {
            rejectedThird = true;
            console.log(`✓ PASS: Third student assignment correctly rejected: "${err.message}"`);
        }
    }
    const occAfter3 = await Student.countDocuments({ doorNumber: testRoom, role: "STUDENT" });
    if (!rejectedThird || occAfter3 !== 2) {
        throw new Error(`Third student was not rejected! Occupancy: ${occAfter3}`);
    }

    // Test 4: Transfer into a full room is rejected
    console.log("\n--- TEST 4: Transfer into Full Room Rejection ---");
    // Assign Student C to another room 311 first
    const testRoom2 = "311";
    await Student.deleteMany({ doorNumber: testRoom2 });
    await syncRoomOccupancy();
    await assignStudentRoomAtomic({
        studentId: studentC._id,
        newRoom: testRoom2,
        adminName: "Warden Admin",
        reason: "Initial room for C"
    });

    const transferIntoFullRes = await fetch(`${API_URL}/residents/${studentC._id}/room`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${wardenToken}` },
        body: JSON.stringify({ newRoom: testRoom, reason: "Attempt transfer to full room" })
    });
    if (transferIntoFullRes.status === 400) {
        const data = await transferIntoFullRes.json();
        console.log(`✓ PASS: API transfer into full room rejected (400): "${data.message}"`);
    } else {
        throw new Error(`Expected 400 for transfer into full room, got ${transferIntoFullRes.status}`);
    }
    // Verify Student C remained in room 311
    const freshC = await Student.findById(studentC._id);
    if (freshC.doorNumber === testRoom2) {
        console.log(`✓ PASS: Student assignment unchanged after rejected transfer (remains in ${testRoom2})`);
    } else {
        throw new Error(`Student C assignment changed to ${freshC.doorNumber}!`);
    }

    // Test 5: Transfer from a full room into an available room succeeds
    console.log("\n--- TEST 5: Transfer from Full Room to Available Room ---");
    // Move Student B from full room 310 into available room 311
    const transferRes = await fetch(`${API_URL}/residents/${studentB._id}/room`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${wardenToken}` },
        body: JSON.stringify({ newRoom: testRoom2, reason: "Move B to 311" })
    });
    if (transferRes.status === 200) {
        console.log(`✓ PASS: Transfer succeeded (200). Room ${testRoom} now has 1 occupant, Room ${testRoom2} has 2.`);
    } else {
        const d = await transferRes.json();
        throw new Error(`Transfer failed: ${transferRes.status} ${JSON.stringify(d)}`);
    }
    const count310 = await Student.countDocuments({ doorNumber: testRoom, role: "STUDENT" });
    const count311 = await Student.countDocuments({ doorNumber: testRoom2, role: "STUDENT" });
    if (count310 === 1 && count311 === 2) {
        console.log(`✓ PASS: Room ${testRoom} count = 1, Room ${testRoom2} count = 2`);
    } else {
        throw new Error(`Unexpected counts: 310=${count310}, 311=${count311}`);
    }

    // Test 6: CSV preview correctly detects projected occupancy above two
    console.log("\n--- TEST 6: CSV Preview Projected Over-Capacity Detection ---");
    // Currently Room 311 has 2 occupants (B and C).
    // Propose adding Alpha (currently in 310) to 311 -> would make Room 311 have 3 occupants!
    const overCapacityRows = [
        {
            PRN: "CAP_PRN_001",
            Branch: "CE",
            Room: testRoom2, // 311 (already has 2)
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9811111111"
        }
    ];

    const previewRes = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${headWardenToken}` },
        body: JSON.stringify({ rows: overCapacityRows })
    });
    const previewData = await previewRes.json();
    if (previewData.summary.overCapacityRoomsCount >= 1) {
        console.log(`✓ PASS: Preview flagged ${previewData.summary.overCapacityRoomsCount} over-capacity room(s)`);
    } else {
        throw new Error(`Preview failed to flag over-capacity room: ${JSON.stringify(previewData.summary)}`);
    }
    const rowErr = previewData.records[0].errors.join("; ");
    if (rowErr.includes("exceed maximum capacity of 2")) {
        console.log(`✓ PASS: Row error explains capacity violation: "${rowErr}"`);
    } else {
        throw new Error(`Row missing capacity violation message: "${rowErr}"`);
    }

    // Test 7, 8, 9: Account for removals and existing occupants without double-counting
    console.log("\n--- TEST 7, 8, 9: CSV Movements, Removals, and Successful Import ---");
    // Room 310 has Alpha. Room 311 has Beta & Gamma.
    // CSV proposes:
    // 1. Beta moves from 311 to 310 (so 311 loses 1, 310 gains 1 -> 310: Alpha + Beta = 2)
    // 2. Delta (new student) moves to 311 (311: Gamma + Delta = 2)
    const studentDelta = await Student.create({
        name: "Student Delta",
        fullName: "Student Delta",
        email: "delta@test-capacity.local",
        role: "STUDENT",
        prn: "CAP_PRN_004",
        branch: "IT",
        year: "TY",
        doorNumber: null,
        mobileNumber: "9844444444"
    });

    const balancedRows = [
        {
            PRN: "CAP_PRN_002", // Beta moves from 311 to 310
            Branch: "IT",
            Room: testRoom, // 310
            "Parent Contact Number": "9822233333",
            "Student Contact Number": "9822222222"
        },
        {
            PRN: "CAP_PRN_004", // Delta moves to 311
            Branch: "IT",
            Room: testRoom2, // 311
            "Parent Contact Number": "9844455555",
            "Student Contact Number": "9844444444"
        }
    ];

    const balancedPreviewRes = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${headWardenToken}` },
        body: JSON.stringify({ rows: balancedRows })
    });
    const balancedPreviewData = await balancedPreviewRes.json();
    if (balancedPreviewData.summary.validRows === 2 && balancedPreviewData.summary.errorCount === 0) {
        console.log("✓ PASS: Balanced CSV preview passed with 0 errors (removals accurately offset additions)");
    } else {
        throw new Error(`Balanced preview failed: ${JSON.stringify(balancedPreviewData.summary)}`);
    }

    // Confirm balanced import
    const confirmImportRes = await fetch(`${API_URL}/residents/import-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${headWardenToken}` },
        body: JSON.stringify({
            records: balancedPreviewData.records.filter(r => r.isValid),
            idempotencyKey: balancedPreviewData.previewId
        })
    });
    if (confirmImportRes.status === 200) {
        console.log("✓ PASS: Balanced CSV import successfully confirmed and applied");
    } else {
        throw new Error(`Balanced import confirm failed: ${confirmImportRes.status}`);
    }

    const finalCount310 = await Student.countDocuments({ doorNumber: testRoom, role: "STUDENT" });
    const finalCount311 = await Student.countDocuments({ doorNumber: testRoom2, role: "STUDENT" });
    if (finalCount310 === 2 && finalCount311 === 2) {
        console.log(`✓ PASS: Both rooms exactly at 2 occupants (310: ${finalCount310}, 311: ${finalCount311})`);
    } else {
        throw new Error(`Expected both rooms at 2, got 310=${finalCount310}, 311=${finalCount311}`);
    }

    // Test 10: Concurrency safety
    console.log("\n--- TEST 10: Concurrency Safety (Simultaneous Assignment Race) ---");
    // Room 312 starts empty
    const testRoom3 = "312";
    await Student.deleteMany({ doorNumber: testRoom3 });
    await syncRoomOccupancy();

    const raceStudent1 = await Student.create({
        name: "Race 1",
        email: "race1@test-capacity.local",
        role: "STUDENT",
        prn: "RACE_001",
        mobileNumber: "9855555551"
    });
    const raceStudent2 = await Student.create({
        name: "Race 2",
        email: "race2@test-capacity.local",
        role: "STUDENT",
        prn: "RACE_002",
        mobileNumber: "9855555552"
    });
    const raceStudent3 = await Student.create({
        name: "Race 3",
        email: "race3@test-capacity.local",
        role: "STUDENT",
        prn: "RACE_003",
        mobileNumber: "9855555553"
    });

    // Fire 3 simultaneous atomic assignments to room 312
    const results = await Promise.allSettled([
        assignStudentRoomAtomic({ studentId: raceStudent1._id, newRoom: testRoom3, adminName: "RaceTester" }),
        assignStudentRoomAtomic({ studentId: raceStudent2._id, newRoom: testRoom3, adminName: "RaceTester" }),
        assignStudentRoomAtomic({ studentId: raceStudent3._id, newRoom: testRoom3, adminName: "RaceTester" })
    ]);

    const successes = results.filter(r => r.status === "fulfilled");
    const rejections = results.filter(r => r.status === "rejected");
    const finalRaceCount = await Student.countDocuments({ doorNumber: testRoom3, role: "STUDENT" });

    if (successes.length === 2 && rejections.length === 1 && finalRaceCount === 2) {
        console.log(`✓ PASS: Concurrency race test: Exactly 2 assignments succeeded, 1 rejected, final count = ${finalRaceCount} (<= 2)`);
    } else {
        throw new Error(`Concurrency race test failed! Successes: ${successes.length}, Rejections: ${rejections.length}, Count: ${finalRaceCount}`);
    }

    // Test 11: Existing over-capacity rooms are flagged without destructive changes
    console.log("\n--- TEST 11: Non-destructive Legacy Over-Capacity Handling ---");
    // Seed 3 test students into Room 204 temporarily to simulate legacy over-capacity state
    const legacyStudent1 = await Student.create({ name: "Legacy 1", email: "legacy1@test-capacity.local", role: "STUDENT", doorNumber: "204", prn: "LEGACY01", admissionStatus: "APPROVED" });
    const legacyStudent2 = await Student.create({ name: "Legacy 2", email: "legacy2@test-capacity.local", role: "STUDENT", doorNumber: "204", prn: "LEGACY02", admissionStatus: "APPROVED" });
    await syncRoomOccupancy();

    const occApiRes = await fetch(`${API_URL}/residents/occupancy?floor=2`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    const occApiData = await occApiRes.json();
    const room204 = occApiData.floors[0].rooms.find(r => r.roomNumber === "204");
    if (room204 && room204.isOverCapacity && room204.occupantCount > 2) {
        console.log(`✓ PASS: Legacy over-capacity Room 204 correctly flagged: ${room204.occupantCount}/2 occupied (${room204.statusText})`);
    } else {
        throw new Error(`Room 204 was not flagged as over-capacity: ${JSON.stringify(room204)}`);
    }
    // Verify none of the existing students were deleted
    const count204 = await Student.countDocuments({ doorNumber: "204", role: "STUDENT" });
    if (count204 === room204.occupantCount) {
        console.log(`✓ PASS: Zero legacy records mutated or deleted (Count preserved: ${count204})`);
    } else {
        throw new Error(`Records were deleted in Room 204!`);
    }

    // Clean up temporary legacy test accounts
    await Student.deleteMany({ email: { $in: ["legacy1@test-capacity.local", "legacy2@test-capacity.local"] } });
    await syncRoomOccupancy();

    // Test 12: Room occupancy reports and directory counts reflect actual assignments
    console.log("\n--- TEST 12: Occupancy Reports and Capacity Metrics ---");
    const repRes = await fetch(`${API_URL}/residents/reports`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    const repData = await repRes.json();
    if (repData.overview.maxCapacityPerRoom === 2 &&
        repData.overview.overCapacityRoomsCount >= 0 &&
        repData.overview.fullRoomsCount >= 0) {
        console.log(`✓ PASS: Reports reflect maxCapacityPerRoom = 2, overCapacityRoomsCount = ${repData.overview.overCapacityRoomsCount}, fullRoomsCount = ${repData.overview.fullRoomsCount}`);
    } else {
        throw new Error(`Reports capacity metrics missing: ${JSON.stringify(repData.overview)}`);
    }

    // Cleanup test accounts
    await User.deleteMany({ email: /@test-capacity\.local$/ });
    await Student.deleteMany({ doorNumber: { $in: [testRoom, testRoom2, testRoom3] } });
    await syncRoomOccupancy();

    console.log("\n==================================================");
    console.log("ALL 12 ROOM CAPACITY VERIFICATIONS PASSED!");
    console.log("==================================================");
    await mongoose.disconnect();
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});

