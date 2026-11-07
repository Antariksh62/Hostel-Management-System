const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Complaint = require("../models/Complaint");
const { User } = require("../models/User");
const Department = require("../models/Department");

/**
 * Protects media files so that confidential / Anti-Ragging evidence
 * cannot be accessed by unauthorized users. Standard maintenance media
 * is served directly.
 */
async function protectedMediaMiddleware(req, res, next) {
    try {
        const safeFilename = path.basename(req.path);
        const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads"));
        const filePath = path.resolve(uploadsDir, safeFilename);

        if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found" });
        }

        const relativeUrl = `/uploads/${safeFilename}`;

        // Find if this file belongs to a confidential / Anti-Ragging complaint
        const complaint = await Complaint.findOne({
            $or: [
                { "media.url": relativeUrl },
                { "feedback.media.url": relativeUrl },
                { image: relativeUrl },
                { beforePhotos: relativeUrl },
                { afterPhotos: relativeUrl }
            ]
        }).select("isAntiRagging isConfidential category studentId departmentId").lean();

        const isConfidential = complaint && (
            complaint.isAntiRagging ||
            complaint.isConfidential ||
            (complaint.category && complaint.category.match(/ragging/i))
        );

        if (!isConfidential) {
            // Standard maintenance media (plumbing, electrical, furniture, cleaning, etc.)
            return res.sendFile(filePath);
        }

        // 🔒 Confidential / Anti-Ragging Media Gatekeeper
        let token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token && req.query.token) {
            token = req.query.token;
        }
        if (!token && req.cookies && req.cookies.jwt) {
            token = req.cookies.jwt;
        }

        if (!token) {
            return res.status(401).json({
                message: "Authentication required to access confidential complaint media",
                code: "AUTH_REQUIRED"
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            return res.status(401).json({ message: "Invalid or expired authorization token" });
        }

        const user = await User.findById(decoded.id, "role isActive departmentId dashboardPermissions").lean();
        if (!user || user.isActive === false) {
            return res.status(403).json({ message: "Account inactive or unauthorized", code: "ACCOUNT_DEACTIVATED" });
        }

        const isMainAdminOrIncharge = user.role === "MAIN_ADMIN" || user.role === "INCHARGE";
        const hasAntiRaggingPermission = (user.dashboardPermissions || []).includes("ANTI_RAGGING");
        const isStudentOwner = String(complaint.studentId) === String(user._id);

        let isDeptMember = false;
        if (complaint.departmentId && user.departmentId) {
            isDeptMember = String(complaint.departmentId) === String(user.departmentId);
        }

        if (isMainAdminOrIncharge || hasAntiRaggingPermission || isStudentOwner || isDeptMember) {
            return res.sendFile(filePath);
        }

        return res.status(403).json({
            message: "Access denied: Strictly confidential Anti-Ragging evidence clearance required",
            code: "ANTI_RAGGING_CONFIDENTIALITY_BOUNDARY"
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error serving media", error: err.message });
    }
}

module.exports = protectedMediaMiddleware;
