require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");

const app = express();

// ─── Core middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// ─── Uploads directory ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use("/uploads", express.static(uploadDir));

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes      = require("./routes/authRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const userRoutes      = require("./routes/userRoutes");
const roomRoutes      = require("./routes/roomRoutes");   // ← was never mounted before

app.use("/api/auth",       authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/users",      userRoutes);
app.use("/api/rooms",      roomRoutes);                   // ← now properly mounted

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
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Internal server error" });
});

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected:", MONGO_URI))
    .catch((err) => console.log("❌ DB Error:", err));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
