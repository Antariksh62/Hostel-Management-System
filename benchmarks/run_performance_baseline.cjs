const path = require("path");
module.paths.push(path.resolve(__dirname, "../backend/node_modules"));

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
const JWT_SECRET = process.env.JWT_SECRET || "pict_hostel_secret_key_2024";

const { User, Student, HeadWarden, Incharge, Warden, WifiIncharge, Staff } = require("../backend/models/User");
const Complaint = require("../backend/models/Complaint");
const StudentRoster = require("../backend/models/StudentRoster");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const Incident = require("../backend/models/Incident");
const Notification = require("../backend/models/Notification");
const ResidentAuditLog = require("../backend/models/ResidentAuditLog");

function makeToken(user) {
    return jwt.sign(
        { id: user._id.toString(), role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
}

function buildTestApp() {
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

    return app;
}

async function measureQuery(name, queryFn) {
    const explainResult = await queryFn().explain("executionStats");
    const stats = explainResult.executionStats;
    const plan = explainResult.queryPlanner.winningPlan;

    // Helper to detect stages in plan
    function findStages(node, acc = []) {
        if (!node) return acc;
        acc.push(node.stage);
        if (node.inputStage) findStages(node.inputStage, acc);
        if (node.inputStages) node.inputStages.forEach(s => findStages(s, acc));
        return acc;
    }

    const stages = findStages(plan);
    const usesCollscan = stages.includes("COLLSCAN");
    const usesInMemorySort = stages.includes("SORT");
    const indexName = plan.inputStage?.indexName || (plan.stage === "IXSCAN" ? plan.indexName : (stages.includes("IXSCAN") ? "IXSCAN (nested)" : "NONE"));

    return {
        name,
        executionTimeMillis: stats.executionTimeMillis,
        totalDocsExamined: stats.totalDocsExamined,
        totalKeysExamined: stats.totalKeysExamined,
        nReturned: stats.nReturned,
        usesCollscan,
        usesInMemorySort,
        primaryStage: plan.stage,
        indexUsed: indexName
    };
}

async function run() {
    console.log("================================================================================");
    console.log("📊 HOSTEL MANAGEMENT SYSTEM — SYSTEM PERFORMANCE BASELINE AUDIT");
    console.log("================================================================================\n");

    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to MongoDB: ${MONGO_URI}`);

    // Retrieve active representative accounts for all 6 roles
    const hwUser = (await HeadWarden.findOne({ role: "HEADWARDEN" })) || (await User.findOne({ role: "HEADWARDEN" }));
    const inchargeUser = (await Incharge.findOne({ role: "INCHARGE" })) || (await User.findOne({ role: "INCHARGE" }));
    const wardenUser = (await Warden.findOne({ role: "WARDEN" })) || (await User.findOne({ role: "WARDEN" }));
    const wifiUser = (await WifiIncharge.findOne({ role: "WIFI_INCHARGE" })) || (await User.findOne({ role: "WIFI_INCHARGE" }));
    const staffUser = (await Staff.findOne({ role: "STAFF" })) || (await User.findOne({ role: "STAFF" }));
    const studentUser = (await Student.findOne({ role: "STUDENT" })) || (await User.findOne({ role: "STUDENT" }));

    const tokens = {
        HEADWARDEN: hwUser ? makeToken(hwUser) : null,
        INCHARGE: inchargeUser ? makeToken(inchargeUser) : null,
        WARDEN: wardenUser ? makeToken(wardenUser) : null,
        WIFI_INCHARGE: wifiUser ? makeToken(wifiUser) : null,
        STAFF: staffUser ? makeToken(staffUser) : null,
        STUDENT: studentUser ? makeToken(studentUser) : null
    };

    console.log("\n================================================================================");
    console.log("PART A: MONGODB EXECUTION STATS & QUERY EXPLAIN PLANS");
    console.log("================================================================================");

    const queryBenchmarks = [];

    // 1. User count by role (Runs on Incharge/Headwarden Dashboard load)
    queryBenchmarks.push(await measureQuery(
        "User.countDocuments({ role: 'STAFF' })",
        () => User.find({ role: "STAFF" })
    ));

    // 2. Resident lookup by role + doorNumber
    queryBenchmarks.push(await measureQuery(
        "Student.find({ role: 'STUDENT', doorNumber: '204' })",
        () => Student.find({ role: "STUDENT", doorNumber: "204" })
    ));

    // 3. Staff assigned complaints sorted by createdAt (Staff dashboard query)
    const staffId = staffUser ? staffUser._id : new mongoose.Types.ObjectId();
    queryBenchmarks.push(await measureQuery(
        "Complaint.find({ assignedTo: staffId }).sort({ createdAt: -1 })",
        () => Complaint.find({ assignedTo: staffId }).sort({ createdAt: -1 })
    ));

    // 4. Complaints by status sorted by createdAt
    queryBenchmarks.push(await measureQuery(
        "Complaint.find({ status: 'Pending' }).sort({ createdAt: -1 })",
        () => Complaint.find({ status: "Pending" }).sort({ createdAt: -1 })
    ));

    // 5. Unindexed incidentId in complaints (Incident resolution & unlinking)
    queryBenchmarks.push(await measureQuery(
        "Complaint.find({ incidentId: new ObjectId() })",
        () => Complaint.find({ incidentId: new mongoose.Types.ObjectId() })
    ));

    // 6. Student roster pagination sorted by updatedAt: -1
    queryBenchmarks.push(await measureQuery(
        "StudentRoster.find({ admissionStatus: 'APPROVED' }).sort({ updatedAt: -1 })",
        () => StudentRoster.find({ admissionStatus: "APPROVED" }).sort({ updatedAt: -1 })
    ));

    // 7. Active incidents polling query on Service Monitor
    queryBenchmarks.push(await measureQuery(
        "Incident.find({ isResolved: false }).sort({ timestamp: -1 })",
        () => Incident.find({ isResolved: false }).sort({ timestamp: -1 })
    ));

    // 8. Notifications feed query for authenticated role
    queryBenchmarks.push(await measureQuery(
        "Notification.find({ recipientRole: 'WARDEN' }).sort({ createdAt: -1 })",
        () => Notification.find({ recipientRole: "WARDEN" }).sort({ createdAt: -1 })
    ));

    // 9. Notification unread count query with $ne
    const sampleUserId = wardenUser ? wardenUser._id.toString() : "66d9f9a00000000000000001";
    queryBenchmarks.push(await measureQuery(
        "Notification.countDocuments({ recipientRole: { $in: [...] }, readBy: { $ne: userId } })",
        () => Notification.find({
            $or: [
                { recipient: sampleUserId, read: false },
                { recipientRole: { $in: ["WARDEN"] }, readBy: { $ne: sampleUserId } }
            ]
        })
    ));

    // Print table of query performance
    console.table(queryBenchmarks.map(q => ({
        "Query Target": q.name,
        "Time (ms)": q.executionTimeMillis,
        "Docs Examined": q.totalDocsExamined,
        "Returned": q.nReturned,
        "COLLSCAN": q.usesCollscan ? "⚠️ YES" : "NO",
        "In-Memory Sort": q.usesInMemorySort ? "⚠️ YES" : "NO",
        "Index Used": q.indexUsed
    })));

    console.log("\n================================================================================");
    console.log("PART B: BACKEND API LATENCY & PAYLOAD MEASUREMENTS (ALL 6 ROLES)");
    console.log("================================================================================");

    // Spin up local HTTP server to measure API endpoints
    const app = buildTestApp();
    const server = http.createServer(app);
    let baseUrl = "";
    await new Promise(resolve => {
        server.listen(0, () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });

    const endpointsToMeasure = [
        { role: "STUDENT", endpoint: "/api/complaints/my-complaints", label: "Student Complaints List" },
        { role: "STUDENT", endpoint: "/api/users/profile", label: "Student Profile" },
        { role: "WARDEN", endpoint: "/api/complaints/all", label: "Warden All Complaints" },
        { role: "WARDEN", endpoint: "/api/complaints/analytics?days=30", label: "Warden Analytics" },
        { role: "WARDEN", endpoint: "/api/services/heat-map", label: "Warden Heat Map" },
        { role: "WARDEN", endpoint: "/api/residents?limit=20", label: "Resident Directory" },
        { role: "WARDEN", endpoint: "/api/notifications?limit=20", label: "Warden Notifications Feed" },
        { role: "HEADWARDEN", endpoint: "/api/admissions/roster?limit=20", label: "HeadWarden Admission Roster" },
        { role: "HEADWARDEN", endpoint: "/api/admissions/batches", label: "Admission Import Batches" },
        { role: "INCHARGE", endpoint: "/api/incharge/overview", label: "Incharge Main Overview" },
        { role: "INCHARGE", endpoint: "/api/incharge/kpis", label: "Incharge KPIs" },
        { role: "WIFI_INCHARGE", endpoint: "/api/complaints/wifi/queue", label: "Wi-Fi Specialist Queue" },
        { role: "WIFI_INCHARGE", endpoint: "/api/services/heat-map?service=wifi", label: "Wi-Fi Heat Map" },
        { role: "STAFF", endpoint: "/api/complaints/all", label: "Staff Assigned Tasks" },
        { role: "STAFF", endpoint: "/api/staff-analytics/staff-table", label: "Staff Performance Table" }
    ];

    const apiResults = [];

    for (const ep of endpointsToMeasure) {
        const token = tokens[ep.role];
        if (!token) {
            console.log(`⚠️ Skipping ${ep.label}: Token for role ${ep.role} not available`);
            continue;
        }

        const times = [];
        let payloadBytes = 0;
        let statusCode = 200;

        // Warm up with 1 request
        await fetch(`${baseUrl}${ep.endpoint}`, { headers: { Authorization: `Bearer ${token}` } });

        // Measure 15 iterations
        const ITERATIONS = 15;
        for (let i = 0; i < ITERATIONS; i++) {
            const start = performance.now();
            const res = await fetch(`${baseUrl}${ep.endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const elapsed = performance.now() - start;
            times.push(elapsed);
            statusCode = res.status;
            if (i === 0) {
                const text = await res.text();
                payloadBytes = Buffer.byteLength(text, "utf8");
            }
        }

        times.sort((a, b) => a - b);
        const avg = times.reduce((acc, t) => acc + t, 0) / times.length;
        const p50 = times[Math.floor(times.length * 0.50)];
        const p95 = times[Math.floor(times.length * 0.95)];

        apiResults.push({
            Role: ep.role,
            Endpoint: ep.endpoint,
            Description: ep.label,
            Status: statusCode,
            "p50 (ms)": parseFloat(p50.toFixed(2)),
            "p95 (ms)": parseFloat(p95.toFixed(2)),
            "Avg (ms)": parseFloat(avg.toFixed(2)),
            "Payload (KB)": parseFloat((payloadBytes / 1024).toFixed(2))
        });
    }

    console.table(apiResults);

    server.close();
    await mongoose.disconnect();

    console.log("\n✅ Baseline benchmarking completed successfully.");
}

run().catch(err => {
    console.error("Baseline runner error:", err);
    process.exit(1);
});

