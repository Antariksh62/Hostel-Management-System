const jwt = require("jsonwebtoken");
const StudentRoster = require("../models/StudentRoster");
const { User } = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains id, role, email

        // Validate account active status if ID present
        if (decoded.id) {
            const liveUser = await User.findById(decoded.id, "isActive role dashboardPermissions exportPermissions").lean();
            if (liveUser) {
                if (liveUser.isActive === false) {
                    return res.status(403).json({
                        message: "Your account has been deactivated. Please contact Administration.",
                        code: "ACCOUNT_DEACTIVATED"
                    });
                }
                if (liveUser.role) req.user.role = liveUser.role;
                req.user.dashboardPermissions = liveUser.dashboardPermissions || [];
                req.user.exportPermissions = Boolean(liveUser.exportPermissions);
            }
        }

        // ELIGIBILITY ENFORCEMENT & ACTIVE SESSION REVOCATION:
        // For STUDENT requests, verify active approved eligibility on the StudentRoster.
        // If the student has been revoked or removed from the roster, reject immediately with HTTP 403.
        if (decoded.role === "STUDENT") {
            let email = decoded.email ? decoded.email.toLowerCase() : null;
            if (!email && decoded.id) {
                const u = await User.findById(decoded.id, "email");
                if (u) email = u.email;
            }
            if (email) {
                const roster = await StudentRoster.findOne({ email }, "admissionStatus");
                if (!roster || roster.admissionStatus !== "APPROVED") {
                    return res.status(403).json({
                        message: "Access revoked: Your hostel admission eligibility has been revoked or removed.",
                        code: "ELIGIBILITY_REVOKED"
                    });
                }
            }
        }

        next();
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
};

const ELEVATED = ["MAIN_ADMIN", "WARDEN", "HEADWARDEN", "INCHARGE"];

const mainAdminOnlyMiddleware = (req, res, next) => {
    if (req.user && req.user.role === "MAIN_ADMIN") {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Supreme Main Administrator privileges required" });
    }
};

const staffManagementMiddleware = (req, res, next) => {
    if (req.user && ["MAIN_ADMIN", "INCHARGE"].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Main Administrator or Hostel In-Charge required to manage staff accounts" });
    }
};

/**
 * Anti-Ragging Strict Confidentiality Barrier (Section 4 & 12).
 * Strictly accessible ONLY by:
 * 1. MAIN_ADMIN
 * 2. INCHARGE
 * 3. Authorized Anti-Ragging personnel (dashboardPermissions includes ANTI_RAGGING)
 * Absolute restriction: WARDEN, HEADWARDEN, SECURITY, MAINTENANCE, and STUDENT are BLOCKED.
 */
const antiRaggingAccessMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const isAuthorizedAdmin = req.user.role === "MAIN_ADMIN" || req.user.role === "INCHARGE";
    const isAntiRaggingSpecialist = (req.user.dashboardPermissions || []).includes("ANTI_RAGGING");

    if (isAuthorizedAdmin || isAntiRaggingSpecialist) {
        next();
    } else {
        res.status(403).json({
            message: "Access denied: Strictly confidential Anti-Ragging clearance required",
            code: "ANTI_RAGGING_CONFIDENTIALITY_BOUNDARY"
        });
    }
};

/**
 * Security Management Authorization (Section 4 & 11).
 * Accessible by: MAIN_ADMIN, INCHARGE, HEADWARDEN, or authorized Security staff.
 * WARDEN, STUDENT, and ordinary staff are BLOCKED.
 */
const securityAccessMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const isAuthorizedElevated = ["MAIN_ADMIN", "INCHARGE", "HEADWARDEN"].includes(req.user.role);
    const isSecurityPersonnel = (req.user.dashboardPermissions || []).includes("SECURITY");

    if (isAuthorizedElevated || isSecurityPersonnel) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Authorized Security clearance required" });
    }
};

const wardenMiddleware = (req, res, next) => {
    if (req.user && ELEVATED.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Wardens only" });
    }
};

const wardenOrStaffMiddleware = (req, res, next) => {
    if (req.user && (ELEVATED.includes(req.user.role) || req.user.role === "STAFF")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Elevated rights required" });
    }
};

const wifiInchargeOrWardenMiddleware = (req, res, next) => {
    if (req.user && (ELEVATED.includes(req.user.role) || req.user.role === "WIFI_INCHARGE" || req.user.role === "STAFF")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Wi-Fi In-Charge or Warden rights required" });
    }
};

const wifiInchargeOnlyMiddleware = (req, res, next) => {
    if (req.user && req.user.role === "WIFI_INCHARGE") {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Authorized Wi-Fi In-Charge specialist only" });
    }
};

/**
 * Resident Management Module authorization.
 * Allows MAIN_ADMIN, HEADWARDEN, WARDEN and INCHARGE roles.
 * Disallows STAFF, WIFI_INCHARGE, and STUDENT.
 */
const residentAdminMiddleware = (req, res, next) => {
    if (req.user && ["MAIN_ADMIN", "HEADWARDEN", "WARDEN", "INCHARGE"].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Authorized Head Warden, Warden, or In-Charge only" });
    }
};

/**
 * Resident CSV Import and Export exclusive authorization.
 * Strictly HEADWARDEN role only (or MAIN_ADMIN).
 * Disallows WARDEN, INCHARGE, STAFF, WIFI_INCHARGE, and STUDENT.
 */
const headWardenOnlyMiddleware = (req, res, next) => {
    if (req.user && ["HEADWARDEN", "MAIN_ADMIN"].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Exclusive Head Warden permission required for CSV operations" });
    }
};

/**
 * Legacy In-Charge only middleware (preserved for compatibility)
 */
const inchargeOnlyMiddleware = (req, res, next) => {
    if (req.user && ["INCHARGE", "MAIN_ADMIN"].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: "Access denied: Authorized Hostel In-Charge access only" });
    }
};

/**
 * Student Admission & Eligibility Management authorization.
 * Strictly equal authority for HEADWARDEN, INCHARGE, and MAIN_ADMIN.
 * Absolute restriction: WARDEN, WIFI_INCHARGE, STAFF, and STUDENT are blocked with HTTP 403.
 */
const admissionAdminMiddleware = (req, res, next) => {
    if (req.user && ["HEADWARDEN", "INCHARGE", "MAIN_ADMIN"].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({
            message: "Access denied: Authorized Head Warden or Hostel In-Charge permissions required for Student Admission administration"
        });
    }
};

module.exports = {
    authMiddleware,
    mainAdminOnlyMiddleware,
    staffManagementMiddleware,
    antiRaggingAccessMiddleware,
    securityAccessMiddleware,
    wardenMiddleware,
    wardenOrStaffMiddleware,
    wifiInchargeOrWardenMiddleware,
    wifiInchargeOnlyMiddleware,
    residentAdminMiddleware,
    headWardenOnlyMiddleware,
    inchargeOnlyMiddleware,
    admissionAdminMiddleware
};
