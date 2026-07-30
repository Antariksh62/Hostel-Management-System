const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains id and role
        next();
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
};

const ELEVATED = ["WARDEN", "HEADWARDEN", "INCHARGE"];

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

module.exports = { authMiddleware, wardenMiddleware, wardenOrStaffMiddleware };
