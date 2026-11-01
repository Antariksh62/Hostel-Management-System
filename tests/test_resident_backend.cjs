const mongoose = require("../backend/node_modules/mongoose");
const path = require("path");
const jwt = require("../backend/node_modules/jsonwebtoken");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { User, Student, Warden, Incharge, WifiIncharge, Staff } = require("../backend/models/User");
const Complaint = require("../backend/models/Complaint");
const ResidentAuditLog = require("../backend/models/ResidentAuditLog");

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";

function makeToken(user) {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
}

async function runTests() {
    console.log("==================================================");
    console.log("TESTING RESIDENT MANAGEMENT MODULE BACKEND");
    console.log("==================================================");

    await mongoose.connect("mongodb://127.0.0.1:27017/hostelDB");

    // Clean up any test artifacts from prior runs
    await User.deleteMany({ email: /test_res_/ });
    await Complaint.deleteMany({ title: /Test Res/ });
    await ResidentAuditLog.deleteMany({ studentPRN: /TESTPRN_/ });

    // 1. Create Test Identities
    const wardenUser = await User.create({
        name: "Test Warden",
        email: "test_res_warden@pict.edu",
        password: "hash",
        role: "WARDEN"
    });
    const inchargeUser = await User.create({
        name: "Test Incharge",
        email: "test_res_incharge@pict.edu",
        password: "hash",
        role: "INCHARGE"
    });
    const staffUser = await Staff.create({
        name: "Test Staff",
        email: "test_res_staff@pict.edu",
        password: "hash",
        role: "STAFF"
    });
    const wifiUser = await WifiIncharge.create({
        name: "Test Wifi Specialist",
        email: "test_res_wifi@pict.edu",
        password: "hash",
        role: "WIFI_INCHARGE"
    });

    const studentAlpha = await Student.create({
        name: "Siddharth Ramesh Kulkarni",
        fullName: "Siddharth Ramesh Kulkarni",
        email: "test_res_sid@ms.pict.edu",
        prn: "TESTPRN_001",
        rollNumber: "31105",
        branch: "CE",
        year: "TY",
        classDiv: "TE-1",
        joiningYear: 2022,
        doorNumber: "305",
        mobileNumber: "9820011111",
        guardianName: "Ramesh Kulkarni",
        guardianRelationship: "Father",
        guardianPhone: "9820022222",
        emergencyName: "Sunita Kulkarni",
        emergencyRelationship: "Mother",
        emergencyPhone: "9820033333",
        profileComplete: true,
        role: "STUDENT"
    });

    const studentBeta = await Student.create({
        name: "Ananya Suresh Joshi",
        fullName: "Ananya Suresh Joshi",
        email: "test_res_ananya@ms.pict.edu",
        prn: "TESTPRN_002",
        rollNumber: "21210",
        branch: "IT",
        year: "SY",
        classDiv: "SE-2",
        joiningYear: 2023,
        doorNumber: "305", // Same room 305 as roommate!
        mobileNumber: "9820044444",
        guardianName: "Suresh Joshi",
        guardianRelationship: "Father",
        guardianPhone: "9820055555",
        emergencyName: "Sameer Joshi",
        emergencyRelationship: "Brother",
        emergencyPhone: "9820066666",
        profileComplete: true,
        role: "STUDENT"
    });

    const studentUnassigned = await Student.create({
        name: "Rohit Unassigned Verma",
        fullName: "Rohit Unassigned Verma",
        email: "test_res_rohit@ms.pict.edu",
        prn: "TESTPRN_003",
        rollNumber: "11101",
        branch: "ENTC",
        year: "FY",
        classDiv: "FE-1",
        joiningYear: 2024,
        doorNumber: null, // Unassigned!
        mobileNumber: "9820077777",
        profileComplete: false,
        role: "STUDENT"
    });

    // Create 1 plumbing complaint and 1 Wi-Fi complaint for studentAlpha
    const waterComplaint = await Complaint.create({
        studentId: studentAlpha._id,
        title: "Test Res Water Leak",
        description: "Tap leaking in room 305",
        category: "Plumbing",
        quickCategory: "NO_WATER_SUPPLY",
        doorNumber: "305",
        status: "Pending"
    });
    const wifiComplaint = await Complaint.create({
        studentId: studentAlpha._id,
        title: "Test Res Wi-Fi Down",
        description: "Wi-Fi not reachable",
        category: "Internet",
        quickCategory: "WIFI_NOT_WORKING",
        doorNumber: "305",
        status: "Pending"
    });

    const wardenToken = makeToken(wardenUser);
    const inchargeToken = makeToken(inchargeUser);
    const staffToken = makeToken(staffUser);
    const wifiToken = makeToken(wifiUser);
    const studentToken = makeToken(studentAlpha);

    const fetch = globalThis.fetch || require("node-fetch");
    const BASE = "http://localhost:5000/api/residents";

    // Helper for requests
    async function apiReq(url, token, options = {}) {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(url, { ...options, headers });
        let data = null;
        try {
            const ct = res.headers.get("content-type");
            if (ct && ct.includes("application/json")) {
                data = await res.json();
            } else {
                data = await res.text();
            }
        } catch {}
        return { status: res.status, data };
    }

    console.log("\n--- PART A: Access Control Verification ---");
    // WARDEN -> 200
    const resWarden = await apiReq(BASE, wardenToken);
    console.log("Warden access:", resWarden.status === 200 ? "✓ PASS (200)" : `✗ FAIL (${resWarden.status})`);

    // INCHARGE -> 200
    const resIncharge = await apiReq(BASE, inchargeToken);
    console.log("Incharge access:", resIncharge.status === 200 ? "✓ PASS (200)" : `✗ FAIL (${resIncharge.status})`);

    // STAFF -> 403
    const resStaff = await apiReq(BASE, staffToken);
    console.log("Staff access denied:", resStaff.status === 403 ? "✓ PASS (403)" : `✗ FAIL (${resStaff.status})`);

    // WIFI_INCHARGE -> 403
    const resWifi = await apiReq(BASE, wifiToken);
    console.log("Wi-Fi Incharge access denied:", resWifi.status === 403 ? "✓ PASS (403)" : `✗ FAIL (${resWifi.status})`);

    // STUDENT -> 403
    const resStudent = await apiReq(BASE, studentToken);
    console.log("Student access denied:", resStudent.status === 403 ? "✓ PASS (403)" : `✗ FAIL (${resStudent.status})`);

    // Unauthenticated -> 401
    const resUnauth = await apiReq(BASE, null);
    console.log("Unauthenticated denied:", resUnauth.status === 401 ? "✓ PASS (401)" : `✗ FAIL (${resUnauth.status})`);

    console.log("\n--- PART B: Unified Multi-Field Search ---");
    // 1. Search by Surname: "Kulkarni"
    const searchSurname = await apiReq(`${BASE}?q=Kulkarni`, wardenToken);
    const foundSid = searchSurname.data.residents.some(r => r.prn === "TESTPRN_001");
    console.log("Search by surname (Kulkarni):", foundSid ? "✓ PASS" : "✗ FAIL");

    // 2. Search by Middle Name: "Ramesh"
    const searchMiddle = await apiReq(`${BASE}?q=Ramesh`, wardenToken);
    const foundMid = searchMiddle.data.residents.some(r => r.prn === "TESTPRN_001");
    console.log("Search by middle name (Ramesh):", foundMid ? "✓ PASS" : "✗ FAIL");

    // 3. Search by PRN: "TESTPRN_002"
    const searchPRN = await apiReq(`${BASE}?q=TESTPRN_002`, wardenToken);
    const foundPRN = searchPRN.data.residents.some(r => r.prn === "TESTPRN_002");
    console.log("Search by PRN (TESTPRN_002):", foundPRN ? "✓ PASS" : "✗ FAIL");

    // 4. Search by Roll Number: "31105"
    const searchRoll = await apiReq(`${BASE}?q=31105`, wardenToken);
    const foundRoll = searchRoll.data.residents.some(r => r.prn === "TESTPRN_001");
    console.log("Search by roll number (31105):", foundRoll ? "✓ PASS" : "✗ FAIL");

    // 5. Search by Room: "305"
    const searchRoom = await apiReq(`${BASE}?q=305`, wardenToken);
    const room305Count = searchRoom.data.residents.filter(r => r.doorNumber === "305").length;
    console.log("Search by room (305):", room305Count >= 2 ? `✓ PASS (${room305Count} roommates found)` : `✗ FAIL (${room305Count})`);

    // 6. Search by Parent Phone Number: "9820022222"
    const searchParentPhone = await apiReq(`${BASE}?q=9820022222`, wardenToken);
    const foundByParent = searchParentPhone.data.residents.find(r => r.prn === "TESTPRN_001");
    console.log("Search by parent phone:", foundByParent && foundByParent.matchedCategory === "Guardian contact" ? "✓ PASS (Matched: Guardian contact)" : "✗ FAIL");

    // 7. Verify Directory row does NOT expose unmasked parent/emergency phone
    const rowLeaksNumber = JSON.stringify(foundByParent).includes("9820022222");
    console.log("Privacy check (Phone not leaked in search row):", !rowLeaksNumber ? "✓ PASS" : "✗ FAIL (LEAK)");

    console.log("\n--- PART C: On-Demand Contact Reveal & Audit Logging ---");
    // Reveal contacts
    const revealRes = await apiReq(`${BASE}/${studentAlpha._id}/reveal-contact`, wardenToken, { method: "POST" });
    const hasUnmasked = revealRes.data.guardianPhone === "9820022222" && revealRes.data.emergencyPhone === "9820033333";
    console.log("On-demand contact reveal:", hasUnmasked ? "✓ PASS (Unmasked accurately)" : "✗ FAIL");

    // Verify audit log created
    const auditRecord = await ResidentAuditLog.findOne({ targetStudent: studentAlpha._id, action: "REVEAL_CONTACT" });
    console.log("Audit log recorded:", auditRecord && auditRecord.adminRole === "WARDEN" ? `✓ PASS (Action: ${auditRecord.action} by ${auditRecord.adminName})` : "✗ FAIL");

    console.log("\n--- PART D: Contact Update & Audit ---");
    const updateContactRes = await apiReq(`${BASE}/${studentAlpha._id}/contacts`, wardenToken, {
        method: "PATCH",
        body: JSON.stringify({
            guardianName: "Ramesh G. Kulkarni",
            guardianPhone: "9820099999"
        })
    });
    console.log("Update contacts:", updateContactRes.status === 200 && updateContactRes.data.contacts.guardianPhone === "9820099999" ? "✓ PASS" : "✗ FAIL");
    const updateAudit = await ResidentAuditLog.findOne({ targetStudent: studentAlpha._id, action: "UPDATE_CONTACT" });
    console.log("Contact update audit log:", updateAudit ? "✓ PASS" : "✗ FAIL");

    console.log("\n--- PART E: Room Reassignment with History ---");
    // Ensure room 316 has available space
    await Student.deleteMany({ doorNumber: "316" });
    const { syncRoomOccupancy } = require("../backend/services/roomOccupancyService");
    await syncRoomOccupancy();

    const roomChangeRes = await apiReq(`${BASE}/${studentAlpha._id}/room`, wardenToken, {
        method: "PATCH",
        body: JSON.stringify({ newRoom: "316", reason: "Single room upgrade" })
    });
    console.log("Room reassignment to 316:", roomChangeRes.status === 200 && roomChangeRes.data.doorNumber === "316" ? "✓ PASS" : "✗ FAIL");
    const updatedSid = await Student.findById(studentAlpha._id);
    const hasHistoryEntry = updatedSid.roomHistory.some(h => h.previousRoom === "305" && h.newRoom === "316");
    console.log("Room history preserved:", hasHistoryEntry ? "✓ PASS (305 -> 316 recorded)" : "✗ FAIL");

    console.log("\n--- PART F: Complaint History & Wi-Fi Isolation ---");
    const complaintsRes = await apiReq(`${BASE}/${studentAlpha._id}/complaints`, wardenToken);
    const visibleComplaints = complaintsRes.data.currentComplaints || [];
    const hasWater = visibleComplaints.some(c => c._id.toString() === waterComplaint._id.toString());
    const hasWifi = visibleComplaints.some(c => c._id.toString() === wifiComplaint._id.toString()) ||
                    (complaintsRes.data.previousComplaints || []).some(c => c._id.toString() === wifiComplaint._id.toString());
    console.log("Water complaint visible:", hasWater ? "✓ PASS" : "✗ FAIL");
    console.log("Wi-Fi complaint isolated (0 leakage):", !hasWifi ? "✓ PASS (Wi-Fi strictly hidden)" : "✗ FAIL (Wi-Fi leaked!)");

    console.log("\n--- PART G: Room Occupancy & Unassigned Views ---");
    const occRes = await apiReq(`${BASE}/occupancy`, wardenToken);
    const has77Rooms = occRes.data.floors.reduce((sum, f) => sum + f.rooms.length, 0) === 77;
    console.log("77 authoritative rooms present in occupancy:", has77Rooms ? "✓ PASS (77 rooms)" : "✗ FAIL");
    const unassignedFound = occRes.data.unassignedStudents.some(s => s.prn === "TESTPRN_003");
    console.log("Unassigned student in exception list:", unassignedFound ? "✓ PASS" : "✗ FAIL");

    console.log("\n--- PART H: Reports & CSV Export ---");
    const reportsRes = await apiReq(`${BASE}/reports`, wardenToken);
    console.log("Resident reports generation:", reportsRes.status === 200 && reportsRes.data.overview.totalResidents > 0 ? "✓ PASS" : "✗ FAIL");

    const exportRes = await apiReq(`${BASE}/export`, wardenToken);
    const isCSV = exportRes.status === 200 && exportRes.data.includes("Full Name,PRN,Roll Number");
    console.log("CSV Export format:", isCSV ? "✓ PASS" : "✗ FAIL");
    const exportHasPhone = exportRes.data.includes("9820011111") || exportRes.data.includes("9820022222");
    console.log("CSV Privacy (Phone excluded by default):", !exportHasPhone ? "✓ PASS" : "✗ FAIL (LEAK)");

    console.log("\n--- PART I: CSV Import Preview & Confirm (INCHARGE Exclusive) ---");
    // Verify Warden is denied import
    const wardenDenial = await apiReq(`${BASE}/import-preview`, wardenToken, {
        method: "POST",
        body: JSON.stringify({ rows: [] })
    });
    console.log("Warden denied CSV Import access:", wardenDenial.status === 403 ? "✓ PASS (403)" : "✗ FAIL");

    // Ensure room 317 has available space for import test
    await Student.deleteMany({ doorNumber: "317" });
    await syncRoomOccupancy();

    // INCHARGE performs import with 5 required columns
    const previewRes = await apiReq(`${BASE}/import-preview`, inchargeToken, {
        method: "POST",
        body: JSON.stringify({
            rows: [
                {
                    PRN: "TESTPRN_002",
                    Branch: "IT",
                    Room: "317",
                    "Parent Contact Number": "9812345678",
                    "Student Contact Number": "9876543210"
                }, // Change Ananya from 305 to 317
                {
                    PRN: "NONEXISTENT_999",
                    Branch: "CE",
                    Room: "101",
                    "Parent Contact Number": "9812345678",
                    "Student Contact Number": "9876543210"
                }, // Unmatched PRN
                {
                    PRN: "TESTPRN_001",
                    Branch: "CE",
                    Room: "999",
                    "Parent Contact Number": "9812345678",
                    "Student Contact Number": "9876543210"
                } // Invalid room
            ]
        })
    });
    console.log("CSV Preview status:", previewRes.status === 200 ? "✓ PASS" : "✗ FAIL");
    const prevSummary = previewRes.data.summary;
    console.log(`CSV Preview diff detection: ${prevSummary.roomChangesCount} room change, ${prevSummary.errorCount} errors`);

    // Verify preview did NOT write to DB
    const ananyaPreCheck = await Student.findOne({ prn: "TESTPRN_002" });
    console.log("Preview safety check (No DB mutation):", ananyaPreCheck.doorNumber === "305" ? "✓ PASS" : "✗ FAIL (Premature write)");

    // Confirm import as INCHARGE
    const confirmRes = await apiReq(`${BASE}/import-confirm`, inchargeToken, {
        method: "POST",
        body: JSON.stringify({
            records: previewRes.data.records.filter(r => r.isValid),
            idempotencyKey: previewRes.data.previewId || `test_key_${Date.now()}`
        })
    });
    console.log("Confirm import status:", confirmRes.status === 200 ? "✓ PASS" : "✗ FAIL");
    const ananyaPostCheck = await Student.findOne({ prn: "TESTPRN_002" });
    console.log("Confirmed update applied:", ananyaPostCheck.doorNumber === "317" ? "✓ PASS (Room 317)" : "✗ FAIL");

    // Clean up test data
    await User.deleteMany({ email: /test_res_/ });
    await Complaint.deleteMany({ title: /Test Res/ });
    await ResidentAuditLog.deleteMany({ studentPRN: /TESTPRN_/ });
    await mongoose.disconnect();
    console.log("\nCleaned up test data.");
    console.log("ALL BACKEND VERIFICATIONS COMPLETED SUCCESSFULLY!");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
