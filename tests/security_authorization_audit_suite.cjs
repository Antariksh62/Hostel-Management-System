const path = require("path");
module.paths.push(path.resolve(__dirname, "../backend/node_modules"));

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

// Use an isolated database strictly dedicated to security auditing
const AUDIT_DB_URI = "mongodb://127.0.0.1:27017/hostelSecurityAuditDB";
const JWT_SECRET = process.env.JWT_SECRET || "pict_hostel_secret_key_2024";

const { User, Student, Warden, HeadWarden, Incharge, WifiIncharge, Staff } = require("../backend/models/User");
const StudentRoster = require("../backend/models/StudentRoster");
const Complaint = require("../backend/models/Complaint");
const Incident = require("../backend/models/Incident");
const Notification = require("../backend/models/Notification");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const ResidentAuditLog = require("../backend/models/ResidentAuditLog");
const OTP = require("../backend/models/OTP");

let serverInstance = null;
let BASE_URL = "";

// Build Express app mirroring server.js
function buildAuditApp() {
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Routes
    app.use("/api/auth", require("../backend/routes/authRoutes"));
    app.use("/api/complaints", require("../backend/routes/complaintRoutes"));
    app.use("/api/users", require("../backend/routes/userRoutes"));
    app.use("/api/rooms", require("../backend/routes/roomRoutes"));
    app.use("/api/incharge", require("../backend/routes/inchargeRoutes"));
    app.use("/api/incidents", require("../backend/routes/incidentRoutes"));
    app.use("/api/services", require("../backend/routes/serviceRoutes"));
    app.use("/api/residents", require("../backend/routes/residentRoutes"));
    app.use("/api/staff-analytics", require("../backend/routes/staffAnalyticsRoutes"));
    app.use("/api/admissions", require("../backend/routes/admissionRoutes"));
    app.use("/api/notifications", require("../backend/routes/notificationRoutes"));

    app.use((err, _req, res, _next) => {
        if (err.message && err.message.includes("File type not allowed")) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: "Internal server error", error: err.message });
    });

    return app;
}

// Generate tokens for testing
function makeToken(user) {
    return jwt.sign(
        { id: user._id.toString(), role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

// Synthetic Accounts
let headWarden, warden, incharge, wifiIncharge, staff, studentA, studentB;
let tokenHW, tokenWarden, tokenIncharge, tokenWifi, tokenStaff, tokenStudA, tokenStudB;

const testResults = [];

function recordTest(category, name, passed, details = "") {
    testResults.push({ category, name, passed, details });
    const mark = passed ? "✅ PASS" : "❌ FAIL / VULNERABILITY FOUND";
    console.log(`  [${mark}] ${category} :: ${name}${details ? ` -> ${details}` : ""}`);
}

async function runAudit() {
    console.log("================================================================================");
    console.log("🔒 COMPREHENSIVE SECURITY, AUTHORIZATION & ROLE ISOLATION AUDIT");
    console.log("================================================================================\n");

    // 1. Connect to isolated audit database
    await mongoose.connect(AUDIT_DB_URI);
    console.log(`Connected to isolated test DB: ${AUDIT_DB_URI}`);

    // Drop previous test data in isolated DB
    await mongoose.connection.db.dropDatabase();

    // 2. Start HTTP server
    const app = buildAuditApp();
    serverInstance = http.createServer(app);
    await new Promise((resolve) => {
        serverInstance.listen(0, () => {
            const port = serverInstance.address().port;
            BASE_URL = `http://127.0.0.1:${port}`;
            console.log(`Test API server running at ${BASE_URL}\n`);
            resolve();
        });
    });

    // 3. Seed Synthetic Accounts
    headWarden = await HeadWarden.create({
        name: "Audit Head Warden",
        email: "audit.headwarden@pict.edu",
        role: "HEADWARDEN",
        officeLocation: "Admin Block 101"
    });
    warden = await Warden.create({
        name: "Audit Warden",
        email: "audit.warden@pict.edu",
        role: "WARDEN",
        officeLocation: "Hostel Office 1"
    });
    incharge = await Incharge.create({
        name: "Audit Incharge",
        email: "audit.incharge@pict.edu",
        role: "INCHARGE",
        officeLocation: "Hostel Main Office"
    });
    wifiIncharge = await WifiIncharge.create({
        name: "Audit Wifi Incharge",
        email: "audit.wifi@pict.edu",
        role: "WIFI_INCHARGE",
        officeLocation: "Networking Cell"
    });
    staff = await Staff.create({
        name: "Audit Maintenance Staff",
        email: "audit.staff@pict.edu",
        role: "STAFF",
        staffRole: "Electrician",
        phoneNumber: "9876543210"
    });

    studentA = await Student.create({
        name: "Student Alpha",
        fullName: "Student Alpha",
        email: "f24ce001@ms.pict.edu",
        prn: "F24CE001",
        role: "STUDENT",
        doorNumber: "101",
        mobileNumber: "9123456780",
        guardianPhone: "9822011111",
        guardianName: "Parent Alpha",
        emergencyPhone: "9822022222",
        emergencyName: "Emergency Alpha",
        profileComplete: true,
        isVerified: true
    });

    studentB = await Student.create({
        name: "Student Beta",
        fullName: "Student Beta",
        email: "f24ce002@ms.pict.edu",
        prn: "F24CE002",
        role: "STUDENT",
        doorNumber: "102",
        mobileNumber: "9123456781",
        guardianPhone: "9822033333",
        emergencyPhone: "9822044444",
        profileComplete: true,
        isVerified: true
    });

    tokenHW = makeToken(headWarden);
    tokenWarden = makeToken(warden);
    tokenIncharge = makeToken(incharge);
    tokenWifi = makeToken(wifiIncharge);
    tokenStaff = makeToken(staff);
    tokenStudA = makeToken(studentA);
    tokenStudB = makeToken(studentB);

    // Seed Complaints (Normal and Wi-Fi)
    const plumbingComplaint = await Complaint.create({
        title: "Leaking Tap in 101",
        description: "Bathroom tap is continuously dripping",
        category: "Plumbing",
        doorNumber: "101",
        studentId: studentA._id,
        status: "Pending"
    });

    const wifiComplaint = await Complaint.create({
        title: "Hostel Wi-Fi Unstable in 101",
        description: "Frequent disconnects",
        category: "Internet",
        quickCategory: "WIFI_NOT_WORKING",
        doorNumber: "101",
        studentId: studentA._id,
        status: "Pending"
    });

    console.log("--------------------------------------------------------------------------------");
    console.log("1. AUTHENTICATION & TOKEN AUDIT");
    console.log("--------------------------------------------------------------------------------");

    // 1.1 Unauthenticated request
    {
        const res = await fetch(`${BASE_URL}/api/users/profile`);
        recordTest("Authentication", "Rejection of unauthenticated request without token", res.status === 401, `Status: ${res.status}`);
    }

    // 1.2 Invalid/Malformed JWT
    {
        const res = await fetch(`${BASE_URL}/api/users/profile`, {
            headers: { Authorization: "Bearer invalid.signature.token" }
        });
        recordTest("Authentication", "Rejection of malformed/tampered JWT", res.status === 401, `Status: ${res.status}`);
    }

    // 1.3 Expired JWT
    {
        const expiredToken = jwt.sign(
            { id: studentA._id.toString(), role: "STUDENT", email: studentA.email },
            JWT_SECRET,
            { expiresIn: "-10s" }
        );
        const res = await fetch(`${BASE_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${expiredToken}` }
        });
        recordTest("Authentication", "Rejection of expired JWT", res.status === 401, `Status: ${res.status}`);
    }

    // 1.4 Student OTP Domain Validation
    {
        const res = await fetch(`${BASE_URL}/api/auth/student/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "attacker@gmail.com" })
        });
        recordTest("Authentication", "Rejection of non-PICT email domain for OTP", res.status === 400, `Status: ${res.status}`);
    }

    // 1.5 Account Enumeration Check via send-otp
    {
        const res = await fetch(`${BASE_URL}/api/auth/student/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "f24unknown999@ms.pict.edu" })
        });
        const data = await res.json();
        const revealsStatus = res.status === 403 && data.message && data.message.includes("admission roster");
        recordTest("Authentication", "Account enumeration: send-otp reveals roster existence", !revealsStatus, `Discloses: "${data.message}"`);
    }

    // 1.6 Admission Status Gates for OTP
    {
        // Add pending roster entry
        await StudentRoster.create({
            prn: "F24PENDING01",
            name: "Pending Student",
            rollNumber: "10101",
            branch: "CE",
            year: "FY",
            studentMobile: "9811122233",
            parentMobile: "9811122244",
            email: "f24pending01@ms.pict.edu",
            admissionStatus: "PENDING_APPROVAL",
            registrationStatus: "NOT_REGISTERED",
            doorNumber: "103"
        });

        const resPending = await fetch(`${BASE_URL}/api/auth/student/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "f24pending01@ms.pict.edu" })
        });
        recordTest("Authentication", "Rejection of PENDING roster record from OTP flow", resPending.status === 403, `Status: ${resPending.status}`);
    }

    // 1.7 Plaintext OTP in server logs / response
    {
        // Add approved roster entry
        await StudentRoster.create({
            prn: "F24APPROVED01",
            name: "Approved Student",
            rollNumber: "10102",
            branch: "IT",
            year: "FY",
            studentMobile: "9811122255",
            parentMobile: "9811122266",
            email: "f24approved01@ms.pict.edu",
            admissionStatus: "APPROVED",
            registrationStatus: "NOT_REGISTERED",
            doorNumber: "104"
        });

        const resApproved = await fetch(`${BASE_URL}/api/auth/student/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "f24approved01@ms.pict.edu" })
        });
        const data = await resApproved.json();
        const hasDevOtp = Boolean(data.devOtp);
        recordTest("Authentication", "Plaintext OTP leakage in HTTP response (devOtp)", !hasDevOtp, hasDevOtp ? `Leaked devOtp: ${data.devOtp}` : "No plaintext OTP in response");
    }

    // 1.8 OTP One-Time Usage & Expiry
    {
        // Create manual OTP record
        const rawOtp = "123456";
        const hashed = await bcrypt.hash(rawOtp, 6);
        await OTP.findOneAndUpdate(
            { email: "f24approved01@ms.pict.edu" },
            { otp: hashed, expiresAt: new Date(Date.now() + 600000), attempts: 0 },
            { upsert: true }
        );

        // Verify once
        const resVerify1 = await fetch(`${BASE_URL}/api/auth/student/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "f24approved01@ms.pict.edu", otp: rawOtp })
        });
        const passed1 = resVerify1.status === 200;

        // Verify second time with same OTP
        const resVerify2 = await fetch(`${BASE_URL}/api/auth/student/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "f24approved01@ms.pict.edu", otp: rawOtp })
        });
        const rejectedReplay = resVerify2.status === 400;
        recordTest("Authentication", "OTP one-time usage (replay protection)", passed1 && rejectedReplay, `1st status: ${resVerify1.status}, Replay status: ${resVerify2.status}`);
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("2. ADMISSION ISOLATION AUDIT (ALL 6 ROLES)");
    console.log("--------------------------------------------------------------------------------");

    // Endpoint: GET /api/admissions/roster
    {
        const testRoles = [
            { role: "HEADWARDEN", token: tokenHW, expected: 200 },
            { role: "INCHARGE", token: tokenIncharge, expected: 200 },
            { role: "WARDEN", token: tokenWarden, expected: 403 },
            { role: "WIFI_INCHARGE", token: tokenWifi, expected: 403 },
            { role: "STAFF", token: tokenStaff, expected: 403 },
            { role: "STUDENT", token: tokenStudA, expected: 403 }
        ];

        for (const t of testRoles) {
            const res = await fetch(`${BASE_URL}/api/admissions/roster`, {
                headers: { Authorization: `Bearer ${t.token}` }
            });
            recordTest("Admission Isolation", `GET /api/admissions/roster accessed by ${t.role}`, res.status === t.expected, `HTTP ${res.status} (Expected ${t.expected})`);
        }
    }

    // Endpoint: POST /api/admissions/approve
    {
        const pendingRoster = await StudentRoster.findOne({ prn: "F24PENDING01" });
        const pendingId = pendingRoster?._id?.toString() || "66d9f9a00000000000000001";

        const testRolesApprove = [
            { role: "HEADWARDEN", token: tokenHW, expected: 200 },
            { role: "INCHARGE", token: tokenIncharge, expected: 200 },
            { role: "WARDEN", token: tokenWarden, expected: 403 },
            { role: "WIFI_INCHARGE", token: tokenWifi, expected: 403 },
            { role: "STAFF", token: tokenStaff, expected: 403 },
            { role: "STUDENT", token: tokenStudA, expected: 403 }
        ];

        for (const t of testRolesApprove) {
            const res = await fetch(`${BASE_URL}/api/admissions/approve`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${t.token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ ids: [pendingId], reason: "Authorized security test approval" })
            });
            recordTest("Admission Isolation", `POST /api/admissions/approve accessed by ${t.role}`, res.status === t.expected, `HTTP ${res.status} (Expected ${t.expected})`);
        }
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("3. WI-FI ROLE ISOLATION AUDIT");
    console.log("--------------------------------------------------------------------------------");

    // 3.1 Wi-Fi Queue endpoint: /api/complaints/wifi/queue
    {
        const wifiQueueTests = [
            { role: "WIFI_INCHARGE", token: tokenWifi, expected: 200 },
            { role: "WARDEN", token: tokenWarden, expected: 403 },
            { role: "HEADWARDEN", token: tokenHW, expected: 403 },
            { role: "INCHARGE", token: tokenIncharge, expected: 403 },
            { role: "STAFF", token: tokenStaff, expected: 403 },
            { role: "STUDENT", token: tokenStudA, expected: 403 }
        ];

        for (const t of wifiQueueTests) {
            const res = await fetch(`${BASE_URL}/api/complaints/wifi/queue`, {
                headers: { Authorization: `Bearer ${t.token}` }
            });
            recordTest("Wi-Fi Isolation", `GET /api/complaints/wifi/queue by ${t.role}`, res.status === t.expected, `HTTP ${res.status} (Expected ${t.expected})`);
        }
    }

    // 3.2 Wi-Fi Student Contact on-demand endpoint: /api/complaints/:id/student-contact
    {
        // Try accessing Wi-Fi complaint student contact
        const resWifiByWifi = await fetch(`${BASE_URL}/api/complaints/${wifiComplaint._id}/student-contact`, {
            headers: { Authorization: `Bearer ${tokenWifi}` }
        });
        recordTest("Wi-Fi Isolation", "WIFI_INCHARGE accessing Wi-Fi complaint student contact", resWifiByWifi.status === 200, `Status: ${resWifiByWifi.status}`);

        const resWifiByWarden = await fetch(`${BASE_URL}/api/complaints/${wifiComplaint._id}/student-contact`, {
            headers: { Authorization: `Bearer ${tokenWarden}` }
        });
        recordTest("Wi-Fi Isolation", "WARDEN accessing Wi-Fi complaint student contact (Blocked 403)", resWifiByWarden.status === 403, `Status: ${resWifiByWarden.status}`);
    }

    // 3.3 Wi-Fi Exclusion from Warden Complaints List: /api/complaints/all
    {
        const res = await fetch(`${BASE_URL}/api/complaints/all`, {
            headers: { Authorization: `Bearer ${tokenWarden}` }
        });
        const complaints = await res.json();
        const hasWifiInList = Array.isArray(complaints) && complaints.some(c => c.category === "Internet" || c.quickCategory === "WIFI_NOT_WORKING");
        recordTest("Wi-Fi Isolation", "Exclusion of Wi-Fi complaints from WARDEN complaint list", !hasWifiInList, hasWifiInList ? "VULNERABILITY: Wi-Fi complaints leaked to Warden" : "Wi-Fi excluded cleanly");
    }

    // 3.4 Wi-Fi Leakage in Complaints Analytics: /api/complaints/analytics
    {
        const res = await fetch(`${BASE_URL}/api/complaints/analytics?days=30`, {
            headers: { Authorization: `Bearer ${tokenWarden}` }
        });
        const analytics = await res.json();
        const hasWifiCategoryInStats = Array.isArray(analytics.byCategory) && analytics.byCategory.some(c => c._id === "Internet" || c._id === "WIFI_NOT_WORKING");
        recordTest("Wi-Fi Isolation", "Exclusion of Wi-Fi metrics from WARDEN /api/complaints/analytics", !hasWifiCategoryInStats, hasWifiCategoryInStats ? "VULNERABILITY: Wi-Fi category counts leaked in Warden analytics" : "Wi-Fi excluded from analytics");
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("4. SENSITIVE INFORMATION & AUDIT LOGGING AUDIT");
    console.log("--------------------------------------------------------------------------------");

    // 4.1 Masked contacts in resident listing
    {
        const res = await fetch(`${BASE_URL}/api/residents`, {
            headers: { Authorization: `Bearer ${tokenWarden}` }
        });
        const data = await res.json();
        const resident = data.residents?.find(r => r.prn === "F24CE001");
        const isMasked = resident && resident.mobileNumberMasked && resident.mobileNumberMasked.includes("******");
        recordTest("Sensitive Information", "Default masking of student mobile in /api/residents", Boolean(isMasked), `Masked mobile: ${resident?.mobileNumberMasked}`);
    }

    // 4.2 Contact reveal generates immutable audit log
    {
        const auditCountBefore = await ResidentAuditLog.countDocuments({ action: "REVEAL_CONTACT", studentPRN: "F24CE001" });
        const res = await fetch(`${BASE_URL}/api/residents/${studentA._id}/reveal-contact`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenWarden}` }
        });
        const auditCountAfter = await ResidentAuditLog.countDocuments({ action: "REVEAL_CONTACT", studentPRN: "F24CE001" });
        recordTest("Sensitive Information", "Contact reveal creates ResidentAuditLog record", auditCountAfter === auditCountBefore + 1, `Audit count: ${auditCountAfter}`);
    }

    // 4.3 Bypass audit logging via /api/users/students
    {
        const res = await fetch(`${BASE_URL}/api/users/students`, {
            headers: { Authorization: `Bearer ${tokenWarden}` }
        });
        const students = await res.json();
        const student = Array.isArray(students) && students.find(s => s.prn === "F24CE001");
        const hasRawPhones = student && (student.guardianPhone || student.emergencyPhone || student.mobileNumber);
        recordTest("Sensitive Information", "Bypass of contact masking & audit via GET /api/users/students", !hasRawPhones, hasRawPhones ? `VULNERABILITY: Returns raw guardianPhone: ${student.guardianPhone}` : "Protected");
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("5. AUTHORIZATION, IDOR & PRIVILEGE ESCALATION AUDIT");
    console.log("--------------------------------------------------------------------------------");

    // 5.1 Student IDOR on Complaints feedback
    {
        const res = await fetch(`${BASE_URL}/api/complaints/${plumbingComplaint._id}/feedback`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenStudB}`, // Student B attempting to leave feedback on Student A's complaint
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ isSatisfied: true, text: "Unauthorized attempt" })
        });
        recordTest("Authorization / IDOR", "Student B leaving feedback on Student A's complaint (Blocked 403)", res.status === 403, `Status: ${res.status}`);
    }

    // 5.2 Staff Privilege Escalation: Can STAFF allocate rooms via /api/rooms?
    {
        const res = await fetch(`${BASE_URL}/api/rooms`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenStaff}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: "Student Alpha", room: "105" })
        });
        recordTest("Privilege Escalation", "STAFF allocating student rooms via POST /api/rooms (Blocked 403)", res.status === 403, `Status: ${res.status} (VULNERABILITY if 200/400)`);
    }

    // 5.3 Student attempting to modify role to HEADWARDEN via self-update
    {
        const res = await fetch(`${BASE_URL}/api/auth/student/update-info`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${tokenStudA}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ role: "HEADWARDEN", branch: "CE" })
        });
        const userCheck = await User.findById(studentA._id);
        const roleRemainsStudent = userCheck.role === "STUDENT";
        recordTest("Privilege Escalation", "Student attempting role tampering via /student/update-info", roleRemainsStudent, `Current role: ${userCheck.role}`);
    }

    // 5.4 Exclusive Head Warden CSV Export Endpoint: /api/residents/export
    {
        const exportTests = [
            { role: "HEADWARDEN", token: tokenHW, expected: 200 },
            { role: "WARDEN", token: tokenWarden, expected: 403 },
            { role: "INCHARGE", token: tokenIncharge, expected: 403 },
            { role: "STAFF", token: tokenStaff, expected: 403 },
            { role: "STUDENT", token: tokenStudA, expected: 403 }
        ];

        for (const t of exportTests) {
            const res = await fetch(`${BASE_URL}/api/residents/export`, {
                headers: { Authorization: `Bearer ${t.token}` }
            });
            recordTest("Authorization", `GET /api/residents/export exclusive to HEADWARDEN (tested ${t.role})`, res.status === t.expected, `HTTP ${res.status} (Expected ${t.expected})`);
        }
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("6. FILE & INPUT SECURITY AUDIT");
    console.log("--------------------------------------------------------------------------------");

    // 6.1 Formula Injection Protection in CSV Export
    {
        // Inject formula candidate student
        const formulaStudent = await Student.create({
            name: "=cmd|' /C calc'!A0",
            fullName: "=cmd|' /C calc'!A0",
            email: "f24formula@ms.pict.edu",
            prn: "F24FORMULA",
            role: "STUDENT",
            doorNumber: "106",
            mobileNumber: "9123456799",
            guardianPhone: "+919822099999",
            emergencyPhone: "@SUM(1,2)",
            profileComplete: true,
            isVerified: true
        });

        const res = await fetch(`${BASE_URL}/api/residents/export`, {
            headers: { Authorization: `Bearer ${tokenHW}` }
        });
        const csvText = await res.text();
        const hasUnsafePrefix = csvText.includes(`"=cmd|' /C calc'!A0"`) || csvText.includes(`"@SUM(1,2)"`);
        const hasSafeEscapedPrefix = csvText.includes(`"'=cmd|' /C calc'!A0"`) || csvText.includes(`"'@SUM(1,2)"`);
        recordTest("File & Input Security", "Formula injection neutralization in CSV export (prefixing with ')", hasSafeEscapedPrefix && !hasUnsafePrefix, hasSafeEscapedPrefix ? "Successfully neutralized with single quote" : "VULNERABILITY: Raw formula found in CSV export");
    }

    // 6.2 File Upload: Fake image / executable disguised as image (Magic Bytes Validation)
    {
        const fakePngContent = "MZ\x90\x00\x03\x00\x00\x00This is a fake PE executable";
        const formData = new FormData();
        const blob = new Blob([fakePngContent], { type: "image/png" });
        formData.append("images", blob, "malicious.png");
        formData.append("title", "Broken light test");
        formData.append("category", "Electrical");

        const res = await fetch(`${BASE_URL}/api/complaints`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenStudA}` },
            body: formData
        });
        const passedUploadReject = res.status === 400;
        recordTest("File & Input Security", "Rejection of fake image file failing magic byte validation", passedUploadReject, `Status: ${res.status}`);
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("7. API & OPERATIONAL SECURITY AUDIT");
    console.log("--------------------------------------------------------------------------------");

    // 7.1 Login Rate Limiting (5 attempts / minute)
    {
        let rateLimited = false;
        let lastStatus = 200;
        for (let i = 0; i < 7; i++) {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "audit.warden@pict.edu", password: "wrongpassword123" })
            });
            lastStatus = res.status;
            if (res.status === 429) {
                rateLimited = true;
                break;
            }
        }
        recordTest("Operational Security", "Brute-force protection on /api/auth/login (Rate Limiting HTTP 429)", rateLimited, `Final status: ${lastStatus}`);
    }

    // 7.2 Logout Token Revocation / Invalidation Check
    {
        // Auth token verified working
        const resBefore = await fetch(`${BASE_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${tokenStudA}` }
        });
        const isWorkingBefore = resBefore.status === 200;

        // Since backend has NO logout or revocation endpoint, check whether token can be invalidated
        const hasLogoutEndpoint = false; // routes/authRoutes.js has no /logout
        recordTest("Operational Security", "Server-side token revocation / logout blacklist exists", hasLogoutEndpoint, "VULNERABILITY: No server-side token revocation or /logout route; tokens cannot be invalidated prior to expiry");
    }

    console.log("\n================================================================================");
    console.log("AUDIT SUMMARY");
    console.log("================================================================================");
    const passedCount = testResults.filter(t => t.passed).length;
    const failedCount = testResults.filter(t => !t.passed).length;
    console.log(`Total Security Tests Executed: ${testResults.length}`);
    console.log(`Passed Checks:                 ${passedCount}`);
    console.log(`Vulnerabilities / Warnings:    ${failedCount}`);
    console.log("================================================================================\n");

    // Teardown
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
    serverInstance.close();
}

runAudit().catch(err => {
    console.error("Audit suite fatal error:", err);
    process.exit(1);
});
