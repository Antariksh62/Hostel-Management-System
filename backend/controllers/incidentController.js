const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const Complaint = require("../models/Complaint");
const { User } = require("../models/User");
const { emitIncidentCreated, emitIncidentUpdated, emitComplaintStatusUpdated, emitServiceHeatmapUpdate } = require("../socket");
const logger = require("../utils/logger");

// POST /api/incidents
// Warden: Manually create a shared incident for selected complaints/rooms
exports.createIncident = async (req, res) => {
    try {
        const { serviceType, title, description, complaintIds = [], affectedRooms = [] } = req.body;

        if (!serviceType || !["WATER", "ELECTRICITY"].includes(serviceType)) {
            return res.status(400).json({ message: "serviceType must be WATER or ELECTRICITY" });
        }
        if (!title) {
            return res.status(400).json({ message: "title is required" });
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomCode = Math.floor(100 + Math.random() * 900);
        const incidentNumber = `INC-${serviceType.slice(0, 3)}-${dateStr}-${randomCode}`;

        // Fetch complaints to link
        const complaints = await Complaint.find({ _id: { $in: complaintIds } });
        const rooms = new Set(affectedRooms);
        complaints.forEach(c => {
            if (c.doorNumber && c.doorNumber !== "N/A") rooms.add(c.doorNumber);
        });

        const incident = new Incident({
            incidentNumber,
            serviceType,
            serviceCategory: serviceType === "WATER" ? "NO_WATER_SUPPLY" : "NO_ELECTRICITY",
            title,
            description: description || `Manually created shared incident for ${serviceType.toLowerCase()}`,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            affectedRooms: Array.from(rooms),
            linkedComplaints: complaints.map(c => c._id),
            statusHistory: [{
                status: "CONFIRMED",
                timestamp: new Date(),
                actor: req.user?.role || "Warden",
                note: `Incident manually created by ${req.user?.role || "Warden"}`
            }]
        });

        await incident.save();

        if (complaints.length > 0) {
            await Complaint.updateMany(
                { _id: { $in: complaints.map(c => c._id) } },
                { $set: { incidentId: incident._id } }
            );
        }

        const populated = await Incident.findById(incident._id)
            .populate("linkedComplaints")
            .populate("assignedTo", "name email");

        if (emitIncidentCreated) emitIncidentCreated(populated);
        emitServiceHeatmapUpdate({ service: serviceType });

        res.status(201).json({ message: "Shared incident created successfully", incident: populated });
    } catch (err) {
        logger.error("createIncident error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/incidents
exports.getAllIncidents = async (req, res) => {
    try {
        const { serviceType, status } = req.query;
        const filter = {};
        if (serviceType) filter.serviceType = String(serviceType);
        if (status) filter.status = String(status);

        const incidents = await Incident.find(filter)
            .populate({
                path: "linkedComplaints",
                select: "title description category status doorNumber createdAt studentId",
                populate: { path: "studentId", select: "name fullName prn doorNumber" }
            })
            .populate("assignedTo", "name email role")
            .sort({ createdAt: -1 });

        res.json(incidents);
    } catch (err) {
        logger.error("getAllIncidents error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/incidents/:id
exports.getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await Incident.findById(id)
            .populate({
                path: "linkedComplaints",
                populate: { path: "studentId", select: "name fullName prn doorNumber" }
            })
            .populate("assignedTo", "name email role");

        if (!incident) return res.status(404).json({ message: "Incident not found" });

        res.json(incident);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// PUT /api/incidents/:id/confirm
// Warden confirms a proposed shared incident
exports.confirmIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await Incident.findById(id);
        if (!incident) return res.status(404).json({ message: "Incident not found" });

        if (incident.status !== "PROPOSED") {
            return res.status(400).json({ message: `Cannot confirm incident with status ${incident.status}` });
        }

        const now = new Date();
        incident.status = "CONFIRMED";
        incident.confirmedAt = now;
        incident.statusHistory.push({
            status: "CONFIRMED",
            timestamp: now,
            actor: req.user?.role || "Warden",
            note: "Proposed shared incident confirmed by warden"
        });

        await incident.save();

        const populated = await Incident.findById(id)
            .populate("linkedComplaints")
            .populate("assignedTo", "name email");

        emitIncidentUpdated(populated);
        emitServiceHeatmapUpdate({ service: incident.serviceType });

        res.json({ message: "Incident confirmed successfully", incident: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// PUT /api/incidents/:id/reject
// Warden rejects a proposed shared incident (unlinks complaints, keeps complaints intact)
exports.rejectIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await Incident.findById(id);
        if (!incident) return res.status(404).json({ message: "Incident not found" });

        // Unlink all complaints without altering their individual status
        await Complaint.updateMany(
            { incidentId: incident._id },
            { $set: { incidentId: null } }
        );

        const now = new Date();
        incident.status = "REJECTED";
        incident.linkedComplaints = [];
        incident.affectedRooms = [];
        incident.statusHistory.push({
            status: "REJECTED",
            timestamp: now,
            actor: req.user?.role || "Warden",
            note: "Proposed grouping rejected by warden. Individual complaints unlinked and retained."
        });

        await incident.save();

        emitIncidentUpdated(incident);
        emitServiceHeatmapUpdate({ service: incident.serviceType });

        res.json({ message: "Incident rejected. Linked complaints remain intact.", incident });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// PUT /api/incidents/:id/status
exports.updateIncidentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note, restorationDetails } = req.body;

        const allowed = ["CONFIRMED", "IN_PROGRESS", "RESTORATION_REPORTED"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}` });
        }

        const incident = await Incident.findById(id);
        if (!incident) return res.status(404).json({ message: "Incident not found" });

        const now = new Date();
        incident.status = status;
        incident.statusHistory.push({
            status,
            timestamp: now,
            actor: req.user?.role || "Warden",
            note: note || restorationDetails || `Incident status updated to ${status}`
        });

        await incident.save();

        const populated = await Incident.findById(id)
            .populate("linkedComplaints")
            .populate("assignedTo", "name email");

        emitIncidentUpdated(populated);
        emitServiceHeatmapUpdate({ service: incident.serviceType });

        res.json({ message: "Incident status updated successfully", incident: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// PUT /api/incidents/:id/assign
exports.assignIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId, assignedTo, assignedTeam, note, notes } = req.body;

        const incident = await Incident.findById(id);
        if (!incident) return res.status(404).json({ message: "Incident not found" });

        let assigneeLabel = assignedTeam || assignedTo || "Maintenance Team";
        const candidateId = staffId || (mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null);

        if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
            const staff = await User.findById(candidateId);
            if (staff) {
                incident.assignedTo = staff._id;
                assigneeLabel = staff.name;
            }
        }

        const now = new Date();
        incident.status = "IN_PROGRESS";
        incident.statusHistory.push({
            status: "IN_PROGRESS",
            timestamp: now,
            actor: req.user?.role || "Warden",
            note: note || notes || `Assigned to ${assigneeLabel}`
        });

        await incident.save();

        const populated = await Incident.findById(id)
            .populate("linkedComplaints")
            .populate("assignedTo", "name email");

        emitIncidentUpdated(populated);

        res.json({ message: "Incident assigned successfully", incident: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// PUT /api/incidents/:id/unlink-complaint
// Unlink a single complaint that was mistakenly grouped
exports.unlinkComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { complaintId } = req.body;

        if (!complaintId) return res.status(400).json({ message: "complaintId is required" });

        const complaint = await Complaint.findById(complaintId);
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        complaint.incidentId = null;
        await complaint.save();

        const incident = await Incident.findById(id);
        if (!incident) return res.status(404).json({ message: "Incident not found" });

        incident.linkedComplaints = incident.linkedComplaints.filter(c => String(c) !== String(complaintId));

        // Recalculate affected rooms from remaining linked complaints
        const remaining = await Complaint.find({ _id: { $in: incident.linkedComplaints } });
        incident.affectedRooms = Array.from(new Set(remaining.map(r => r.doorNumber).filter(Boolean)));

        incident.statusHistory.push({
            status: incident.status,
            timestamp: new Date(),
            actor: req.user?.role || "Warden",
            note: `Unlinked complaint ${complaintId} (Room ${complaint.doorNumber}) from incident.`
        });

        await incident.save();

        const populated = await Incident.findById(id)
            .populate("linkedComplaints")
            .populate("assignedTo", "name email");

        emitIncidentUpdated(populated);

        res.json({ message: "Complaint unlinked successfully", incident: populated });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/incidents/:id/resolve
// Requires review decisions on linked unresolved complaints
exports.resolveIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionNote, resolutionSummary, complaintDecisions = [] } = req.body;

        const incident = await Incident.findById(id).populate("linkedComplaints");
        if (!incident) return res.status(404).json({ message: "Incident not found" });

        const now = new Date();
        const effectiveNote = resolutionSummary || resolutionNote || "Service restored and verified.";

        // Process individual complaint decisions explicitly:
        // complaintDecisions: [{ complaintId, action: "RESOLVE" | "KEEP_OPEN", note }]
        const decisionMap = new Map();
        (complaintDecisions || []).forEach(d => decisionMap.set(String(d.complaintId), d));

        for (const complaint of incident.linkedComplaints) {
            const decision = decisionMap.get(String(complaint._id));
            const action = decision?.action || decision?.decision;

            if (action === "RESOLVE" && complaint.status !== "Resolved") {
                complaint.status = "Resolved";
                complaint.resolvedAt = now;
                complaint.resolutionNote = decision.note || `Resolved with shared incident ${incident.incidentNumber}: ${effectiveNote}`;
                complaint.statusHistory.push({
                    status: "Resolved",
                    timestamp: now,
                    actor: req.user?.role || "Warden",
                    note: complaint.resolutionNote
                });
                await complaint.save();
                emitComplaintStatusUpdated(complaint);
            } else if (action === "KEEP_OPEN") {
                // Keep open for further follow-up, unlink from resolved incident to allow independent tracking
                complaint.incidentId = null;
                complaint.statusHistory.push({
                    status: complaint.status,
                    timestamp: now,
                    actor: req.user?.role || "Warden",
                    note: decision.note ? `Kept open: ${decision.note}` : "Kept open for independent follow-up after incident closure."
                });
                await complaint.save();
                emitComplaintStatusUpdated(complaint);
            }
        }

        incident.status = "RESOLVED";
        incident.resolvedAt = now;
        incident.resolutionNote = effectiveNote;
        incident.statusHistory.push({
            status: "RESOLVED",
            timestamp: now,
            actor: req.user?.role || "Warden",
            note: incident.resolutionNote
        });

        await incident.save();

        const populated = await Incident.findById(id)
            .populate("linkedComplaints")
            .populate("assignedTo", "name email");

        emitIncidentUpdated(populated);
        emitServiceHeatmapUpdate({ service: incident.serviceType });

        res.json({ message: "Incident resolved successfully", incident: populated });
    } catch (err) {
        logger.error("resolveIncident error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
