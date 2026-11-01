const AntiRaggingCase = require("../models/AntiRaggingCase");
const AuditLog = require("../models/AuditLog");
const { broadcastNotification } = require("../services/notificationService");

exports.getAllCases = async (req, res) => {
    try {
        const { status, severity, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (status && status !== "all") filter.status = status;
        if (severity && severity !== "all") filter.severity = severity;

        // If specific squad member, show assigned cases or all unassigned
        if (req.user.role === "STAFF") {
            filter.$or = [
                { assignedOfficer: req.user.id },
                { assignedOfficer: null }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const cases = await AntiRaggingCase.find(filter)
            .populate("assignedOfficer", "name email staffRole")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const total = await AntiRaggingCase.countDocuments(filter);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            cases
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch anti-ragging cases", error: err.message });
    }
};

exports.getCaseById = async (req, res) => {
    try {
        const { id } = req.params;
        const caseRecord = await AntiRaggingCase.findById(id).populate("assignedOfficer", "name email");
        if (!caseRecord) return res.status(404).json({ message: "Case not found" });

        // Record confidential access audit
        await AuditLog.create({
            action: "ANTI_RAGGING_CASE_ACCESSED",
            performedBy: { id: req.user.id, name: req.user.name || "Officer", role: req.user.role, email: req.user.email },
            target: { id: caseRecord._id, model: "AntiRaggingCase", identifier: caseRecord.caseNumber }
        });

        res.json({ success: true, caseRecord });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch case details", error: err.message });
    }
};

exports.createCase = async (req, res) => {
    try {
        const { title, description, incidentDate, location, victimInfo, accusedInfo, severity = "SERIOUS", assignedOfficer } = req.body;
        if (!title || !description) {
            return res.status(400).json({ message: "Case title and description are required." });
        }

        const caseNumber = `ARC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const caseRecord = await AntiRaggingCase.create({
            caseNumber,
            title: title.trim(),
            description: description.trim(),
            incidentDate: incidentDate || new Date(),
            location: location || "Hostel Campus",
            victimInfo: victimInfo || { isAnonymous: false },
            accusedInfo: accusedInfo || [],
            severity,
            status: "CONFIDENTIAL_REPORTED",
            assignedOfficer: assignedOfficer || null
        });

        // Notify strictly MAIN_ADMIN and INCHARGE
        broadcastNotification({
            roles: ["MAIN_ADMIN", "INCHARGE"],
            type: "CONFIDENTIAL_ANTI_RAGGING_ALERT",
            title: `🔒 Anti-Ragging Case Reported: ${caseNumber}`,
            message: `Confidential incident filed with severity ${severity}. Direct investigation mandated.`,
            link: "/anti-ragging-dashboard"
        }).catch(() => {});

        res.status(201).json({ success: true, caseRecord });
    } catch (err) {
        res.status(500).json({ message: "Failed to create anti-ragging case", error: err.message });
    }
};

exports.updateCaseStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolutionSummary } = req.body;

        const caseRecord = await AntiRaggingCase.findById(id);
        if (!caseRecord) return res.status(404).json({ message: "Case not found" });

        caseRecord.status = status;
        if (status === "ACTION_TAKEN" || status === "CLOSED") {
            caseRecord.resolvedAt = new Date();
            if (resolutionSummary) caseRecord.resolutionSummary = resolutionSummary;
        }

        await caseRecord.save();

        await AuditLog.create({
            action: "ANTI_RAGGING_STATUS_UPDATED",
            performedBy: { id: req.user.id, name: req.user.name || "Officer", role: req.user.role, email: req.user.email },
            target: { id: caseRecord._id, model: "AntiRaggingCase", identifier: caseRecord.caseNumber },
            details: { newStatus: status }
        });

        res.json({ success: true, caseRecord });
    } catch (err) {
        res.status(500).json({ message: "Failed to update case status", error: err.message });
    }
};

exports.addInvestigationNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, attachments } = req.body;
        if (!note || !note.trim()) return res.status(400).json({ message: "Note text is required." });

        const caseRecord = await AntiRaggingCase.findById(id);
        if (!caseRecord) return res.status(404).json({ message: "Case not found" });

        caseRecord.investigationNotes.push({
            note: note.trim(),
            author: req.user.name || "Anti-Ragging Squad Member",
            authorId: req.user.id,
            authorRole: req.user.role,
            attachments: attachments || [],
            timestamp: new Date()
        });

        await caseRecord.save();
        res.json({ success: true, notes: caseRecord.investigationNotes });
    } catch (err) {
        res.status(500).json({ message: "Failed to add investigation note", error: err.message });
    }
};

exports.recordActionTaken = async (req, res) => {
    try {
        const { id } = req.params;
        const { actionType, details } = req.body;
        if (!actionType || !details) return res.status(400).json({ message: "Action type and details are required." });

        const caseRecord = await AntiRaggingCase.findById(id);
        if (!caseRecord) return res.status(404).json({ message: "Case not found" });

        caseRecord.actionsTaken.push({
            actionType,
            details: details.trim(),
            decidedBy: req.user.name || "Anti-Ragging Committee",
            decidedById: req.user.id,
            timestamp: new Date()
        });

        await caseRecord.save();
        res.json({ success: true, actionsTaken: caseRecord.actionsTaken });
    } catch (err) {
        res.status(500).json({ message: "Failed to record action taken", error: err.message });
    }
};

