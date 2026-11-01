const xlsx = require("xlsx");
const StudentRoster = require("../models/StudentRoster");
const AdmissionImportBatch = require("../models/AdmissionImportBatch");
const admissionService = require("../services/admissionService");
const logger = require("../utils/logger");

/**
 * Upload workbook & get worksheet names
 */
exports.getWorksheets = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ message: "Please upload an Excel workbook (.xlsx, .xls) or CSV file" });
        }
        const sheets = admissionService.getWorksheetNames(req.file.buffer);
        res.json({ sheets });
    } catch (err) {
        logger.error("getWorksheets error:", err);
        res.status(400).json({ message: "Failed to parse workbook: " + err.message });
    }
};

/**
 * Dry-run preview of Excel/CSV import
 * Zero database writes!
 */
exports.previewImport = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ message: "Please upload an Excel workbook (.xlsx, .xls) or CSV file" });
        }

        const sheetName = req.body.sheetName || null;
        const mode = req.body.mode || "ADD_UPDATE";
        let customMappings = null;
        if (req.body.mappings) {
            try {
                customMappings = typeof req.body.mappings === "string"
                    ? JSON.parse(req.body.mappings)
                    : req.body.mappings;
            } catch (e) {
                // Ignore parse error, use default
            }
        }

        const preview = await admissionService.generateImportPreview({
            buffer: req.file.buffer,
            sheetName,
            customMappings,
            mode
        });

        res.json(preview);
    } catch (err) {
        logger.error("previewImport error:", err);
        res.status(400).json({ message: "Failed to generate preview: " + err.message });
    }
};

/**
 * Commit approved/pending roster records from preview
 */
exports.commitImport = async (req, res) => {
    try {
        const { parsedRows, autoApprove, batchMeta, mode = "ADD_UPDATE", confirmRevokeMissing = false } = req.body;
        if (!parsedRows || !Array.isArray(parsedRows) || parsedRows.length === 0) {
            return res.status(400).json({ message: "No valid rows provided to commit" });
        }

        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };

        const result = await admissionService.commitRosterImport({
            parsedRows,
            autoApprove: !!autoApprove,
            batchMeta: batchMeta || {},
            actor,
            mode,
            confirmRevokeMissing: !!confirmRevokeMissing
        });

        res.json({
            message: "Student roster import committed successfully",
            ...result
        });
    } catch (err) {
        logger.error("commitImport error:", err);
        res.status(400).json({ message: "Import failed: " + err.message });
    }
};

/**
 * Manually add an individual student to the roster
 */
exports.addManualStudent = async (req, res) => {
    try {
        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };
        const record = await admissionService.addManualStudent({
            studentData: req.body,
            actor
        });
        res.status(201).json({
            message: `Student ${record.name} (${record.prn}) added to roster successfully`,
            record
        });
    } catch (err) {
        logger.error("addManualStudent error:", err);
        res.status(400).json({ message: err.message });
    }
};

/**
 * Update single student roster details
 */
exports.updateStudentDetails = async (req, res) => {
    try {
        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };
        const record = await admissionService.updateStudentRosterDetails({
            rosterId: req.params.id,
            updateData: req.body,
            actor
        });
        res.json({
            message: `Roster details updated for ${record.name} (${record.prn})`,
            record
        });
    } catch (err) {
        logger.error("updateStudentDetails error:", err);
        res.status(400).json({ message: err.message });
    }
};

/**
 * Delete / remove student from roster
 */
exports.deleteRosterRecord = async (req, res) => {
    try {
        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };
        const result = await admissionService.deleteRosterRecord(
            req.params.id,
            actor,
            req.body?.reason || "Removed from roster by Administrator"
        );
        res.json({
            message: "Student removed from admission roster successfully",
            ...result
        });
    } catch (err) {
        logger.error("deleteRosterRecord error:", err);
        res.status(400).json({ message: err.message });
    }
};

/**
 * Search, filter and paginate authorized student roster
 */
exports.getRoster = async (req, res) => {
    try {
        const {
            search = "",
            admissionStatus = "",
            registrationStatus = "",
            branch = "",
            year = "",
            doorNumber = "",
            page = 1,
            limit = 25
        } = req.query;

        const query = {};

        if (admissionStatus && admissionStatus !== "ALL") {
            query.admissionStatus = admissionStatus;
        }

        if (registrationStatus && registrationStatus !== "ALL") {
            query.registrationStatus = registrationStatus;
        }

        if (branch && branch !== "ALL") {
            query.branch = branch.toUpperCase();
        }

        if (year && year !== "ALL") {
            query.year = year.toUpperCase();
        }

        if (doorNumber) {
            query.doorNumber = String(doorNumber).trim();
        }

        if (search && search.trim()) {
            const s = search.trim();
            const rgx = new RegExp(s, "i");
            query.$or = [
                { name: rgx },
                { prn: rgx },
                { rollNumber: rgx },
                { email: rgx },
                { doorNumber: rgx },
                { studentMobile: rgx },
                { parentMobile: rgx }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 25);
        const skip = (pageNum - 1) * limitNum;

        const [records, total, stats] = await Promise.all([
            StudentRoster.find(query)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate("userId", "fullName isVerified profileComplete")
                .lean(),
            StudentRoster.countDocuments(query),
            StudentRoster.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        pending: { $sum: { $cond: [{ $eq: ["$admissionStatus", "PENDING_APPROVAL"] }, 1, 0] } },
                        approved: { $sum: { $cond: [{ $eq: ["$admissionStatus", "APPROVED"] }, 1, 0] } },
                        rejected: { $sum: { $cond: [{ $eq: ["$admissionStatus", "REJECTED"] }, 1, 0] } },
                        revoked: { $sum: { $cond: [{ $eq: ["$admissionStatus", "REVOKED"] }, 1, 0] } },
                        registered: { $sum: { $cond: [{ $eq: ["$registrationStatus", "REGISTERED"] }, 1, 0] } },
                        notRegistered: { $sum: { $cond: [{ $eq: ["$registrationStatus", "NOT_REGISTERED"] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const counts = stats[0] || {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            revoked: 0,
            registered: 0,
            notRegistered: 0
        };

        res.json({
            records,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            counts
        });
    } catch (err) {
        logger.error("getRoster error:", err);
        res.status(500).json({ message: "Server error retrieving roster", error: err.message });
    }
};

/**
 * Get single roster entry details
 */
exports.getRosterById = async (req, res) => {
    try {
        const record = await StudentRoster.findById(req.params.id)
            .populate("userId", "fullName email isVerified profileComplete")
            .populate("importBatchId");
        if (!record) {
            return res.status(404).json({ message: "Roster record not found" });
        }
        res.json({ record });
    } catch (err) {
        logger.error("getRosterById error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * Approve single or batch of roster records
 */
exports.approveRecords = async (req, res) => {
    try {
        const { ids, reason } = req.body;
        if (!ids || (Array.isArray(ids) && ids.length === 0)) {
            return res.status(400).json({ message: "Record IDs required" });
        }

        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };

        const result = await admissionService.approveRosterRecords(ids, actor, reason);
        res.json({
            message: `Successfully approved ${result.approvedCount} student(s)`,
            ...result
        });
    } catch (err) {
        logger.error("approveRecords error:", err);
        res.status(400).json({ message: "Approval failed: " + err.message });
    }
};

/**
 * Reject single or batch of roster records
 */
exports.rejectRecords = async (req, res) => {
    try {
        const { ids, reason } = req.body;
        if (!ids || (Array.isArray(ids) && ids.length === 0)) {
            return res.status(400).json({ message: "Record IDs required" });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: "Rejection reason is required" });
        }

        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };

        const result = await admissionService.rejectRosterRecords(ids, actor, reason.trim());
        res.json({
            message: `Successfully rejected ${result.rejectedCount} student(s)`,
            ...result
        });
    } catch (err) {
        logger.error("rejectRecords error:", err);
        res.status(400).json({ message: "Rejection failed: " + err.message });
    }
};

/**
 * Revoke student registration eligibility
 */
exports.revokeEligibility = async (req, res) => {
    try {
        const { id, reason } = req.body;
        if (!id) return res.status(400).json({ message: "Record ID required" });
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: "Revocation reason is required" });
        }

        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };

        const record = await admissionService.revokeRosterEligibility(id, actor, reason.trim());
        res.json({
            message: `Registration eligibility revoked for ${record.name} (${record.prn})`,
            record
        });
    } catch (err) {
        logger.error("revokeEligibility error:", err);
        res.status(400).json({ message: err.message });
    }
};

/**
 * Restore student registration eligibility
 */
exports.restoreEligibility = async (req, res) => {
    try {
        const { id, reason } = req.body;
        if (!id) return res.status(400).json({ message: "Record ID required" });

        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role
        };

        const record = await admissionService.restoreRosterEligibility(id, actor, reason);
        res.json({
            message: `Registration eligibility restored for ${record.name} (${record.prn})`,
            record
        });
    } catch (err) {
        logger.error("restoreEligibility error:", err);
        res.status(400).json({ message: err.message });
    }
};

/**
 * List import batch history
 */
exports.getBatches = async (req, res) => {
    try {
        const batches = await AdmissionImportBatch.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ batches });
    } catch (err) {
        logger.error("getBatches error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * Get admission audit history
 */
exports.getAuditHistory = async (req, res) => {
    try {
        const records = await StudentRoster.find(
            { "auditTrail.0": { $exists: true } },
            { name: 1, prn: 1, doorNumber: 1, auditTrail: 1 }
        )
            .sort({ "auditTrail.timestamp": -1 })
            .limit(100)
            .lean();

        const flatAudit = [];
        records.forEach(r => {
            (r.auditTrail || []).forEach(a => {
                flatAudit.push({
                    studentName: r.name,
                    prn: r.prn,
                    doorNumber: r.doorNumber,
                    action: a.action,
                    performedBy: a.performedBy,
                    details: a.details,
                    timestamp: a.timestamp
                });
            });
        });

        flatAudit.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json({ audit: flatAudit.slice(0, 100) });
    } catch (err) {
        logger.error("getAuditHistory error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

/**
 * Export authorized roster to CSV with formula-injection sanitization
 * and UTF-8 encoding.
 */
exports.exportRoster = async (req, res) => {
    try {
        const { admissionStatus, branch, year } = req.query;
        const query = {};
        if (admissionStatus && admissionStatus !== "ALL") query.admissionStatus = admissionStatus;
        if (branch && branch !== "ALL") query.branch = branch.toUpperCase();
        if (year && year !== "ALL") query.year = year.toUpperCase();

        const records = await StudentRoster.find(query).sort({ doorNumber: 1, name: 1 }).lean();

        // CSV Formula injection sanitization helper
        const sanitizeCSV = (val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val).trim();
            // Prevent formula execution in Excel: prefix with single quote if starts with =, +, -, @, \t, \r
            if (/^[=\+\-@\t\r]/.test(str)) {
                str = `'${str}`;
            }
            return `"${str.replace(/"/g, '""')}"`;
        };

        const headers = [
            "PRN",
            "Student Name",
            "Roll Number",
            "Official Email",
            "Branch",
            "Year",
            "Division",
            "Room Number",
            "Student Mobile",
            "Parent Mobile",
            "Admission Status",
            "Registration Status"
        ];

        const rows = records.map(r => [
            sanitizeCSV(r.prn),
            sanitizeCSV(r.name),
            sanitizeCSV(r.rollNumber),
            sanitizeCSV(r.email),
            sanitizeCSV(r.branch),
            sanitizeCSV(r.year),
            sanitizeCSV(r.division || ""),
            sanitizeCSV(r.doorNumber),
            sanitizeCSV(r.studentMobile),
            sanitizeCSV(r.parentMobile),
            sanitizeCSV(r.admissionStatus),
            sanitizeCSV(r.registrationStatus)
        ]);

        const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(","), ...rows.map(r => r.join(","))].join("\r\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="Authorized_Student_Roster_${new Date().toISOString().split("T")[0]}.csv"`);
        res.send(csvContent);
    } catch (err) {
        logger.error("exportRoster error:", err);
        res.status(500).json({ message: "Export failed", error: err.message });
    }
};

/**
 * Download official import template
 */
exports.downloadTemplate = (req, res) => {
    try {
        const buffer = admissionService.generateTemplateWorkbook();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="Hostel_Student_Roster_Template.xlsx"');
        res.send(buffer);
    } catch (err) {
        logger.error("downloadTemplate error:", err);
        res.status(500).json({ message: "Failed to generate template", error: err.message });
    }
};

