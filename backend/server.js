require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const logger = require("./utils/logger");

const app = express();

app.use(helmet());

app.use(cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const userRoutes = require("./routes/userRoutes");
const roomRoutes     = require("./routes/roomRoutes");
const inchargeRoutes = require("./routes/inchargeRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const serviceRoutes  = require("./routes/serviceRoutes");
const residentRoutes = require("./routes/residentRoutes");
const staffAnalyticsRoutes = require("./routes/staffAnalyticsRoutes");
const admissionRoutes = require("./routes/admissionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const mainAdminRoutes = require("./routes/mainAdminRoutes");
const securityRoutes = require("./routes/securityRoutes");
const antiRaggingRoutes = require("./routes/antiRaggingRoutes");
const departmentStaffRoutes = require("./routes/departmentStaffRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms",    roomRoutes);
app.use("/api/incharge", inchargeRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/services",  serviceRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/staff-analytics", staffAnalyticsRoutes);
app.use("/api/admissions", admissionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", mainAdminRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/anti-ragging", antiRaggingRoutes);
app.use("/api/staff", departmentStaffRoutes);
app.use("/api/department-staff", departmentStaffRoutes);

// ─── Global error handler for Multer / validation errors ──────────────────────
app.use((err, _req, res, _next) => {
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum size is 20 MB." });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ message: "Too many files. Maximum is 5 images + 1 video." });
    }
    if (err.message?.includes("File type not allowed")) {
        return res.status(400).json({ message: err.message });
    }
    logger.error("Unhandled error:", err);
    res.status(500).json({ message: "Internal server error" });
});

const http = require("http");
const { initSocket } = require("./socket");

const server = http.createServer(app);
initSocket(server);

// ─── MongoDB & Retention Service ──────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
const { cleanupOldComplaints } = require("./controllers/complaintController");
const { syncRoomOccupancy } = require("./services/roomOccupancyService");
const { backfillExistingStudents } = require("./services/admissionService");

mongoose.connect(MONGO_URI, {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
})
    .then(() => {
        logger.info("✅ MongoDB Connected: " + MONGO_URI);
        // Run 6-month complaint retention cleanup on startup and every 24 hours
        cleanupOldComplaints();
        setInterval(cleanupOldComplaints, 24 * 60 * 60 * 1000);
        // Synchronize 77-room occupancy status and track over-capacity rooms
        syncRoomOccupancy().catch(err => logger.error("syncRoomOccupancy startup error:", err));
        // Backfill existing registered student accounts into authorized roster (zero lockouts)
        backfillExistingStudents().catch(err => logger.error("backfillExistingStudents startup error:", err));
        // Bootstrap 7 departments, categories, templates and initial MAIN_ADMIN
        const { bootstrapDepartmentsAndTemplates } = require("./services/bootstrapService");
        bootstrapDepartmentsAndTemplates().catch(err => logger.error("bootstrapDepartments startup error:", err));
        // Autonomous Escalation Engine (Runs every 5 mins)
        const { evaluateEscalations } = require("./services/escalationService");
        evaluateEscalations().catch(err => logger.error("initial escalation check error:", err));
        setInterval(() => evaluateEscalations().catch(() => {}), 5 * 60 * 1000);
    })
    .catch((err) => logger.error("❌ DB Error:", err));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => logger.info(`🚀 Server & Socket.IO running on port ${PORT}`));
