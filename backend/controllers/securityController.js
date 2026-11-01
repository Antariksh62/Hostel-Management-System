const SecurityIncident = require("../models/SecurityIncident");
const { User } = require("../models/User");
const { broadcastNotification } = require("../services/notificationService");

exports.getAllIncidents = async (req, res) => {
    try {
        const { status, severity, page = 1, limit = 50 } = req.query;
        const filter = {};

        // If individual security staff, show assigned incidents plus unassigned ones
        if (req.user.role === "STAFF") {
            filter.$or = [
                { assignedTo: req.user.id },
                { assignedTo: null }
            ];
        }

        if (status && status !== "all") filter.status = status;
        if (severity && severity !== "all") filter.severity = severity;

        const skip = (Number(page) - 1) * Number(limit);
        const incidents = await SecurityIncident.find(filter)
            .populate("assignedTo", "name email staffRole")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const total = await SecurityIncident.countDocuments(filter);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            incidents
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch security incidents", error: err.message });
    }
};

exports.reportIncident = async (req, res) => {
    try {
        const { title, description, location, severity = "MEDIUM", assignedTo } = req.body;
        if (!title || !location) {
            return res.status(400).json({ message: "Title and location are required." });
        }

        const incidentNumber = `SEC-${Date.now().toString().slice(-6)}`;
        const now = new Date();

        const incident = await SecurityIncident.create({
            incidentNumber,
            title: title.trim(),
            description: description || "",
            location: location.trim(),
            severity,
            status: assignedTo ? "INVESTIGATING" : "REPORTED",
            reportedBy: {
                id: req.user.id,
                name: req.user.name || "Security Officer",
                role: req.user.role
            },
            assignedTo: assignedTo || null,
            assignedAt: assignedTo ? now : null,
            auditHistory: [{
                action: "REPORTED",
                actor: req.user.name || "Staff",
                actorId: req.user.id,
                timestamp: now,
                details: { severity, location }
            }]
        });

        // Broadcast to MAIN_ADMIN, INCHARGE, HEADWARDEN
        broadcastNotification({
            roles: ["MAIN_ADMIN", "INCHARGE", "HEADWARDEN"],
            type: "SECURITY_INCIDENT_REPORTED",
            title: `🚨 Security Alert [${severity}]: ${title}`,
            message: `Location: ${location}. Reported by ${req.user.name || 'Security'}.`,
            link: "/security-dashboard"
        }).catch(() => {});

        res.status(201).json({ success: true, incident });
    } catch (err) {
        res.status(500).json({ message: "Failed to report security incident", error: err.message });
    }
};

exports.updateIncidentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note, resolutionSummary } = req.body;

        const incident = await SecurityIncident.findById(id);
        if (!incident) return res.status(404).json({ message: "Security incident not found" });

        const now = new Date();
        const prevStatus = incident.status;
        incident.status = status;

        if (status === "RESOLVED" || status === "CLOSED") {
            incident.resolvedAt = now;
            if (resolutionSummary) incident.resolutionSummary = resolutionSummary;
        }

        if (note) {
            incident.notes.push({
                note: note.trim(),
                addedBy: req.user.id,
                addedByName: req.user.name || "Security Officer",
                addedAt: now
            });
        }

        incident.auditHistory.push({
            action: `STATUS_CHANGED_${status}`,
            actor: req.user.name || "Staff",
            actorId: req.user.id,
            timestamp: now,
            details: { previousStatus: prevStatus, newStatus: status, note }
        });

        await incident.save();

        res.json({ success: true, incident });
    } catch (err) {
        res.status(500).json({ message: "Failed to update incident status", error: err.message });
    }
};

exports.addIncidentNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, attachments } = req.body;
        if (!note || !note.trim()) return res.status(400).json({ message: "Note text is required." });

        const incident = await SecurityIncident.findById(id);
        if (!incident) return res.status(404).json({ message: "Security incident not found" });

        const now = new Date();
        incident.notes.push({
            note: note.trim(),
            addedBy: req.user.id,
            addedByName: req.user.name || "Security Officer",
            attachments: attachments || [],
            addedAt: now
        });

        await incident.save();
        res.json({ success: true, notes: incident.notes });
    } catch (err) {
        res.status(500).json({ message: "Failed to add incident note", error: err.message });
    }
};

