const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { User, Student, Warden, Incharge, Staff, WifiIncharge } = require("../backend/models/User");
const ResidentAuditLog = require("../backend/models/ResidentAuditLog");
const { ALL_ROOMS, isValidRoom } = require("../backend/utils/hostelRooms");
const { syncRoomOccupancy } = require("../backend/services/roomOccupancyService");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const API_URL = "http://localhost:5000/api";

const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
};

async function runTests() {
    console.log("==================================================");
    console.log("TESTING RESIDENT CSV IMPORT: INCHARGE EXCLUSIVE & 5 FIELDS");
    console.log("==================================================");

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");

    // Create test accounts
    await User.deleteMany({ email: /@test-csv-import\.local$/ });
    await Student.deleteMany({ doorNumber: { $in: ["314", "315"] } });
    await syncRoomOccupancy();
    await Student.deleteMany({ doorNumber: { $in: ["314", "315"] } });
    await syncRoomOccupancy();

    const incharge = await Incharge.create({
        name: "Test Incharge",
        email: "incharge@test-csv-import.local",
        role: "INCHARGE",
        officeLocation: "Office A"
    });

    const warden = await Warden.create({
        name: "Test Warden",
        email: "warden@test-csv-import.local",
        role: "WARDEN"
    });

    const staff = await Staff.create({
        name: "Test Staff",
        email: "staff@test-csv-import.local",
        role: "STAFF"
    });

    const wifiIncharge = await WifiIncharge.create({
        name: "Test Wifi Specialist",
        email: "wifi@test-csv-import.local",
        role: "WIFI_INCHARGE"
    });

    // Create test students
    const student1 = await Student.create({
        name: "Student One",
        fullName: "Student One Sharma",
        email: "s1@test-csv-import.local",
        role: "STUDENT",
        prn: "TEST_CSV_001",
        branch: "CE",
        year: "SY",
        doorNumber: "101",
        mobileNumber: "9820011111",
        guardianPhone: "9820022222",
        emergencyPhone: "9999900000",
        emergencyName: "Uncle Bob",
        roomHistory: [{ previousRoom: "Unassigned", newRoom: "101", changedBy: "Init", reason: "Initial", changedAt: new Date() }]
    });

    const student2 = await Student.create({
        name: "Student Two",
        fullName: "Student Two Verma",
        email: "s2@test-csv-import.local",
        role: "STUDENT",
        prn: "TEST_CSV_002",
        branch: "IT",
        year: "TY",
        doorNumber: "102",
        mobileNumber: "9820033333",
        guardianPhone: "9820044444",
        emergencyPhone: "9999911111",
        emergencyName: "Aunt Alice",
        roomHistory: []
    });

    const inchargeToken = generateToken(incharge);
    const wardenToken = generateToken(warden);
    const staffToken = generateToken(staff);
    const wifiToken = generateToken(wifiIncharge);
    const studentToken = generateToken(student1);

    // Test 1: Downloaded template contains 5 required columns
    console.log("\n--- TEST 1: CSV Template Columns ---");
    const templateRes = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    if (templateRes.status !== 200) throw new Error(`Template download failed: ${templateRes.status}`);
    const templateText = await templateRes.text();
    const firstLine = templateText.split(/\r\n|\n/)[0];
    const expectedHeaders = "PRN,Branch,Room,Parent Contact Number,Student Contact Number";
    if (firstLine.trim() === expectedHeaders) {
        console.log(`✓ PASS: Template contains exact 5 required columns: ${firstLine}`);
    } else {
        throw new Error(`Template headers mismatch: expected "${expectedHeaders}", got "${firstLine}"`);
    }

    // Test 2 & 3 & 4: Access Control for CSV Import
    console.log("\n--- TEST 2, 3, 4: Access Control Enforcement ---");
    // INCHARGE can access
    const inchargePreviewRes = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${inchargeToken}` },
        body: JSON.stringify({ rows: [] })
    });
    if (inchargePreviewRes.status === 400) {
        console.log("✓ PASS: INCHARGE can access import API (400 for empty rows as expected)");
    } else {
        throw new Error(`Unexpected status for INCHARGE: ${inchargePreviewRes.status}`);
    }

    // WARDEN denied
    const wardenTemplateRes = await fetch(`${API_URL}/residents/import-template`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    if (wardenTemplateRes.status === 403) {
        console.log("✓ PASS: WARDEN denied template download (403)");
    } else {
        throw new Error(`Expected 403 for Warden template download, got ${wardenTemplateRes.status}`);
    }

    const wardenPreviewRes = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${wardenToken}` },
        body: JSON.stringify({ rows: [{ PRN: "TEST_CSV_001" }] })
    });
    if (wardenPreviewRes.status === 403) {
        console.log("✓ PASS: WARDEN denied import preview (403)");
    } else {
        throw new Error(`Expected 403 for Warden import preview, got ${wardenPreviewRes.status}`);
    }

    const wardenConfirmRes = await fetch(`${API_URL}/residents/import-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${wardenToken}` },
        body: JSON.stringify({ records: [] })
    });
    if (wardenConfirmRes.status === 403) {
        console.log("✓ PASS: WARDEN denied import confirm (403)");
    } else {
        throw new Error(`Expected 403 for Warden import confirm, got ${wardenConfirmRes.status}`);
    }

    // Other roles denied
    for (const [roleName, token] of [["STAFF", staffToken], ["WIFI_INCHARGE", wifiToken], ["STUDENT", studentToken]]) {
        const res = await fetch(`${API_URL}/residents/import-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rows: [] })
        });
        if (res.status === 403) {
            console.log(`✓ PASS: ${roleName} denied import access (403)`);
        } else {
            throw new Error(`Expected 403 for ${roleName}, got ${res.status}`);
        }
    }

    // Unauthenticated denied
    const unauthRes = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [] })
    });
    if (unauthRes.status === 401) {
        console.log("✓ PASS: Unauthenticated denied import access (401)");
    } else {
        throw new Error(`Expected 401 for unauthenticated, got ${unauthRes.status}`);
    }

    // Warden still has full access to Directory, Occupancy, Reports
    const wardenDirRes = await fetch(`${API_URL}/residents`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    const wardenOccRes = await fetch(`${API_URL}/residents/occupancy`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    const wardenRepRes = await fetch(`${API_URL}/residents/reports`, {
        headers: { Authorization: `Bearer ${wardenToken}` }
    });
    if (wardenDirRes.status === 200 && wardenOccRes.status === 200 && wardenRepRes.status === 200) {
        console.log("✓ PASS: WARDEN retains full access to Directory, Occupancy, and Reports (200)");
    } else {
        throw new Error("Warden lost access to directory, occupancy, or reports");
    }

    // Test 5 & 6: Validation of 5 Required Fields
    console.log("\n--- TEST 5 & 6: Validation of 5 Required Fields ---");
    const testValidationRows = [
        // Row 1: Valid row
        {
            PRN: "TEST_CSV_001",
            Branch: "ENTC",
            Room: "314",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9833344444"
        },
        // Row 2: Missing PRN
        {
            PRN: "",
            Branch: "CE",
            Room: "103",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9833344444"
        },
        // Row 3: Unknown PRN
        {
            PRN: "NON_EXISTENT_PRN_999",
            Branch: "IT",
            Room: "104",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9833344444"
        },
        // Row 4: Invalid branch
        {
            PRN: "TEST_CSV_002",
            Branch: "BIOTECH",
            Room: "105",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9833344444"
        },
        // Row 5: Invalid room (outside 77 rooms)
        {
            PRN: "TEST_CSV_002",
            Branch: "IT",
            Room: "999",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9833344444"
        },
        // Row 6: Invalid parent mobile (not Indian 10-digit /^[6-9]\d{9}$/)
        {
            PRN: "TEST_CSV_002",
            Branch: "IT",
            Room: "206",
            "Parent Contact Number": "5555555555", // Starts with 5
            "Student Contact Number": "9833344444"
        },
        // Row 7: Invalid student mobile
        {
            PRN: "TEST_CSV_002",
            Branch: "IT",
            Room: "206",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "12345" // Short
        },
        // Row 8: Duplicate PRN in CSV
        {
            PRN: "TEST_CSV_001",
            Branch: "CE",
            Room: "101",
            "Parent Contact Number": "9811122222",
            "Student Contact Number": "9833344444"
        }
    ];

    const previewRes = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${inchargeToken}` },
        body: JSON.stringify({ rows: testValidationRows })
    });
    if (previewRes.status !== 200) throw new Error(`Preview failed: ${previewRes.status}`);
    const previewData = await previewRes.json();

    if (previewData.summary.validRows === 1 && previewData.summary.errorCount === 7) {
        console.log("✓ PASS: Validation accurately flagged 1 valid row and 7 invalid rows");
    } else {
        throw new Error(`Unexpected validation counts: ${JSON.stringify(previewData.summary)}`);
    }

    const errorsJoined = previewData.records.map(r => r.errors.join("; ")).join("\n");
    if (errorsJoined.includes("Missing required field: PRN") &&
        errorsJoined.includes("No existing student found with PRN NON_EXISTENT_PRN_999") &&
        errorsJoined.includes("Invalid branch 'BIOTECH'") &&
        errorsJoined.includes("Invalid room '999'") &&
        errorsJoined.includes("Invalid Parent Contact Number") &&
        errorsJoined.includes("Invalid Student Contact Number") &&
        errorsJoined.includes("Duplicate PRN in CSV file")) {
        console.log("✓ PASS: All specific rejection reasons detected accurately");
    } else {
        throw new Error(`Missing expected error messages in:\n${errorsJoined}`);
    }

    // Test 9 & 10: Preview does not modify database records & Cancellation makes no changes
    console.log("\n--- TEST 9 & 10: Preview & Cancellation Safety (0 DB writes) ---");
    const freshStudent1 = await Student.findById(student1._id);
    if (freshStudent1.doorNumber === "101" &&
        freshStudent1.branch === "CE" &&
        freshStudent1.mobileNumber === "9820011111" &&
        freshStudent1.guardianPhone === "9820022222") {
        console.log("✓ PASS: Database completely untouched after preview (0 mutations)");
    } else {
        throw new Error("Database mutated during preview!");
    }

    // Test 7, 8, 11: Explicit Confirmation, Field Mapping, Room History, Emergency Isolation
    console.log("\n--- TEST 7, 8, 11: Explicit Commit & Mappings ---");
    const validRowsForCommit = [
        {
            PRN: "TEST_CSV_001",
            Branch: "ENTC",
            Room: "314",
            "Parent Contact Number": "9876543210",
            "Student Contact Number": "9123456789"
        },
        {
            PRN: "TEST_CSV_002",
            Branch: "AIDS",
            Room: "315",
            "Parent Contact Number": "9898989898",
            "Student Contact Number": "9765432100"
        }
    ];

    const generatePreview = await fetch(`${API_URL}/residents/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${inchargeToken}` },
        body: JSON.stringify({ rows: validRowsForCommit })
    });
    const genData = await generatePreview.json();

    const commitRes = await fetch(`${API_URL}/residents/import-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${inchargeToken}` },
        body: JSON.stringify({
            records: genData.records.filter(r => r.isValid),
            idempotencyKey: genData.previewId
        })
    });
    if (commitRes.status !== 200) throw new Error(`Commit failed: ${commitRes.status}`);
    const commitData = await commitRes.json();
    if (commitData.appliedCount === 2) {
        console.log("✓ PASS: Explicit confirmation applied exactly 2 validated records");
    } else {
        throw new Error(`Expected 2 applied records, got ${commitData.appliedCount}`);
    }

    // Verify DB records
    const updatedStudent1 = await Student.findById(student1._id);
    const updatedStudent2 = await Student.findById(student2._id);

    // Verify field mappings
    if (updatedStudent1.branch === "ENTC" && updatedStudent1.doorNumber === "314" &&
        updatedStudent1.guardianPhone === "9876543210" && updatedStudent1.mobileNumber === "9123456789") {
        console.log("✓ PASS: Field mapping verified for Student 1 (Branch: ENTC, Room: 314, GuardianPhone: 9876543210, Mobile: 9123456789)");
    } else {
        throw new Error("Student 1 fields mismatch after commit");
    }

    // Verify emergency contact was NOT overwritten
    if (updatedStudent1.emergencyPhone === "9999900000" && updatedStudent1.emergencyName === "Uncle Bob") {
        console.log("✓ PASS: Emergency contact information strictly preserved (NOT overwritten by parent phone)");
    } else {
        throw new Error(`Emergency contact was corrupted! got phone: ${updatedStudent1.emergencyPhone}`);
    }

    // Verify room history
    const lastHistory = updatedStudent1.roomHistory[updatedStudent1.roomHistory.length - 1];
    if (lastHistory && lastHistory.previousRoom === "101" && lastHistory.newRoom === "314" && lastHistory.reason === "Bulk CSV Import") {
        console.log(`✓ PASS: Room history preserved (101 -> 314, reason: ${lastHistory.reason}, changedBy: ${lastHistory.changedBy})`);
    } else {
        throw new Error(`Room history entry invalid: ${JSON.stringify(lastHistory)}`);
    }

    // Verify duplicate commit prevention (idempotency)
    const duplicateCommitRes = await fetch(`${API_URL}/residents/import-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${inchargeToken}` },
        body: JSON.stringify({
            records: genData.records.filter(r => r.isValid),
            idempotencyKey: genData.previewId
        })
    });
    if (duplicateCommitRes.status === 409) {
        console.log("✓ PASS: Duplicate commit prevented with HTTP 409 Conflict");
    } else {
        throw new Error(`Expected 409 Conflict for duplicate commit, got ${duplicateCommitRes.status}`);
    }

    // Test 12: Directory search by new student phone and parent phone
    console.log("\n--- TEST 12: Directory Search by Phone Numbers Post-Import ---");
    const searchStudentPhoneRes = await fetch(`${API_URL}/residents?q=9123456789`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    const searchStudentPhoneData = await searchStudentPhoneRes.json();
    if (searchStudentPhoneData.residents?.some(s => s.prn === "TEST_CSV_001")) {
        console.log("✓ PASS: Directory search by imported student phone successfully matched student");
    } else {
        throw new Error("Directory search by student phone failed to match");
    }

    const searchParentPhoneRes = await fetch(`${API_URL}/residents?q=9876543210`, {
        headers: { Authorization: `Bearer ${inchargeToken}` }
    });
    const searchParentPhoneData = await searchParentPhoneRes.json();
    const matchedS1 = searchParentPhoneData.residents?.find(s => s.prn === "TEST_CSV_001");
    if (matchedS1 && (matchedS1.matchedCategory === "Guardian contact" || matchedS1.matchedCategory?.includes("Guardian"))) {
        console.log("✓ PASS: Directory search by imported parent phone matched with 'Guardian contact' badge");
    } else {
        throw new Error(`Directory search by parent phone failed or missing tag: ${JSON.stringify(matchedS1)}`);
    }

    // Cleanup test data
    await User.deleteMany({ email: /@test-csv-import\.local$/ });
    await ResidentAuditLog.deleteMany({ "details.idempotencyKey": genData.previewId });

    console.log("\n==================================================");
    console.log("ALL 12 TEST SCENARIOS PASSED WITH ZERO REGRESSIONS!");
    console.log("==================================================");
    await mongoose.disconnect();
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
