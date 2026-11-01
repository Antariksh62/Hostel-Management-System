const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../backend/controllers/complaintController.js");
let code = fs.readFileSync(file, "utf8");

// Normalize line endings temporarily to \n for robust matching
const isCRLF = code.includes("\r\n");
code = code.replace(/\r\n/g, "\n");

// 1. Add .lean() to getStudentComplaints
code = code.replace(
    /const complaints = await Complaint\.find\(\{ studentId: req\.user\.id \}\)\s*\.populate\("studentId"[^\)]+\)\s*\.populate\("assignedTo"[^\)]+\)\s*\.sort\(\{ createdAt: -1 \}\);/,
    `const complaints = await Complaint.find({ studentId: req.user.id })\n            .populate("studentId", "name fullName email prn rollNumber classDiv year branch doorNumber")\n            .populate("assignedTo", "name email")\n            .sort({ createdAt: -1 })\n            .lean();`
);

// 2. Add .lean() to getAllComplaints
code = code.replace(
    /let complaints = await Complaint\.find\(filter\)\s*\.populate\("studentId"[^\)]+\)\s*\.populate\("assignedTo"[^\)]+\)\s*\.sort\(\{ createdAt: -1 \}\);/,
    `let complaints = await Complaint.find(filter)\n            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")\n            .populate("assignedTo", "name email")\n            .sort({ createdAt: -1 })\n            .lean();`
);

// 3. Update cleanupOldComplaints to non-destructive archival
code = code.replace(
    /exports\.cleanupOldComplaints = async \(\) => \{[\s\S]*?return expiredComplaints\.length;\s*\} catch \(err\) \{[\s\S]*?\}\s*\};/,
    `exports.cleanupOldComplaints = async () => {\n    try {\n        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);\n        // Preserve historical data: mark resolved older complaints as archived rather than hard-deleting\n        const result = await Complaint.updateMany(\n            { createdAt: { $lt: sixMonthsAgo }, status: "Resolved", isArchived: { $ne: true } },\n            { $set: { isArchived: true } }\n        );\n        if (result.modifiedCount > 0) {\n            console.log(\`[Retention Policy] Safely archived \${result.modifiedCount} historical complaints older than 6 months (zero data loss).\`);\n        }\n        return result.modifiedCount;\n    } catch (err) {\n        console.error("[Retention Policy] Error during automatic complaint archival:", err);\n    }\n};`
);

// 4. Update getAnalytics with baseMatch Wi-Fi exclusion
code = code.replace(
    /const \[statusSummary, byCategory, trend, avgResolution\] = await Promise\.all\(\[\s*\/\/ Counts grouped by status\s*Complaint\.aggregate\(\[\s*\{ \$group: \{ _id: "\$status", count: \{ \$sum: 1 \} \} \}\s*\]\),/,
    `// Enforce Wi-Fi isolation for WARDEN: strictly exclude Wi-Fi records\n        const baseMatch = {};\n        if (req.user?.role === "WARDEN") {\n            baseMatch.category = { $ne: "Internet" };\n            baseMatch.quickCategory = { $ne: "WIFI_NOT_WORKING" };\n        }\n\n        const [statusSummary, byCategory, trend, avgResolution] = await Promise.all([\n            // Counts grouped by status\n            Complaint.aggregate([\n                ...(Object.keys(baseMatch).length ? [{ $match: baseMatch }] : []),\n                { $group: { _id: "$status", count: { $sum: 1 } } }\n            ]),`
);

code = code.replace(
    /\/\/ Counts grouped by category\s*Complaint\.aggregate\(\[\s*\{ \$group: \{ _id: "\$category", count: \{ \$sum: 1 \} \} \},\s*\{ \$sort:\s*\{ count: -1 \} \}\s*\]\),/,
    `// Counts grouped by category\n            Complaint.aggregate([\n                ...(Object.keys(baseMatch).length ? [{ $match: baseMatch }] : []),\n                { $group: { _id: "$category", count: { $sum: 1 } } },\n                { $sort:  { count: -1 } }\n            ]),`
);

code = code.replace(
    /\{ \$match: \{ createdAt: \{ \$gte: sinceDate \} \} \},/,
    `{ $match: { ...baseMatch, createdAt: { $gte: sinceDate } } },`
);

code = code.replace(
    /\{ \$match: \{\s*status:\s*"Resolved",\s*resolvedAt: \{ \$exists: true, \$ne: null \}\s*\} \},/,
    `{ $match: {\n                        ...baseMatch,\n                        status:     "Resolved",\n                        resolvedAt: { $exists: true, $ne: null }\n                    } },`
);

if (isCRLF) {
    code = code.replace(/\n/g, "\r\n");
}

fs.writeFileSync(file, code, "utf8");
console.log("complaintController.js successfully patched!");

