const Complaint = require("../models/Complaint");
const Incident = require("../models/Incident");
const logger = require("../utils/logger");

/**
 * Configurable shared-incident detection thresholds.
 * Straightforward to tune after real complaint data becomes available.
 */
const INCIDENT_CONFIG = {
    WINDOW_MINUTES: 10,            // Rolling 10-minute window
    DISTINCT_ROOMS_THRESHOLD: 5,   // At least 5 distinct rooms reporting
    // Configurable operational policy:
    // When false (default), new complaints from rooms NOT already in an active/confirmed incident
    // remain independent rather than being automatically merged into an ongoing incident.
    // They can accumulate with other unlinked reports to trigger a separate incident proposal.
    AUTO_MERGE_UNLINKED_TO_ACTIVE: false,
};

// Map raw or quick categories to service types
function getServiceType(category, quickCategory) {
    const cat = quickCategory || category;
    if (cat === "NO_WATER_SUPPLY" || cat === "Plumbing") return "WATER";
    if (cat === "NO_ELECTRICITY" || cat === "Electrical") return "ELECTRICITY";
    return null; // Wi-Fi and others are not grouped into water/electricity incidents
}

/**
 * Process a newly created complaint for potential or active shared incidents.
 * Concurrency-safe: uses findOneAndUpdate and sets to avoid duplicates.
 */
async function processComplaintForIncidents(complaint, ioEmitter = null) {
    try {
        const serviceType = getServiceType(complaint.category, complaint.quickCategory);
        if (!serviceType) return null; // Not an eligible category for water/electricity grouping

        const doorNumber = complaint.doorNumber;
        if (!doorNumber || doorNumber === "N/A") return null;

        // 1. Check for an ongoing CONFIRMED or IN_PROGRESS incident
        // If AUTO_MERGE_UNLINKED_TO_ACTIVE is true, all subsequent incoming reports attach.
        // If false (default), only reports from rooms ALREADY part of the active incident attach,
        // allowing separate episodes from other rooms to form distinct incidents.
        if (INCIDENT_CONFIG.AUTO_MERGE_UNLINKED_TO_ACTIVE) {
            const activeIncident = await Incident.findOne({
                serviceType,
                status: { $in: ["CONFIRMED", "IN_PROGRESS", "RESTORATION_REPORTED"] }
            }).sort({ createdAt: -1 });

            if (activeIncident) {
                complaint.incidentId = activeIncident._id;
                await complaint.save();

                await Incident.findByIdAndUpdate(activeIncident._id, {
                    $addToSet: {
                        affectedRooms: doorNumber,
                        linkedComplaints: complaint._id
                    }
                });

                logger.info(`Linked complaint ${complaint._id} (Room ${doorNumber}) to active incident ${activeIncident.incidentNumber}`);
                
                if (ioEmitter && ioEmitter.emitIncidentUpdated) {
                    const updatedInc = await Incident.findById(activeIncident._id).populate("linkedComplaints");
                    ioEmitter.emitIncidentUpdated(updatedInc);
                }
                return activeIncident;
            }
        } else {
            const roomIncident = await Incident.findOne({
                serviceType,
                affectedRooms: doorNumber,
                status: { $in: ["CONFIRMED", "IN_PROGRESS", "RESTORATION_REPORTED"] }
            }).sort({ createdAt: -1 });

            if (roomIncident) {
                complaint.incidentId = roomIncident._id;
                await complaint.save();

                await Incident.findByIdAndUpdate(roomIncident._id, {
                    $addToSet: { linkedComplaints: complaint._id }
                });

                logger.info(`Linked repeat complaint ${complaint._id} (Room ${doorNumber}) to ongoing incident ${roomIncident.incidentNumber}`);

                if (ioEmitter && ioEmitter.emitIncidentUpdated) {
                    const updatedInc = await Incident.findById(roomIncident._id).populate("linkedComplaints");
                    ioEmitter.emitIncidentUpdated(updatedInc);
                }
                return roomIncident;
            }
        }

        // 2. Check for an already PROPOSED incident within the rolling window
        const windowStart = new Date(Date.now() - INCIDENT_CONFIG.WINDOW_MINUTES * 60 * 1000);

        const proposedIncident = await Incident.findOne({
            serviceType,
            status: "PROPOSED",
            proposedAt: { $gte: windowStart }
        });

        if (proposedIncident) {
            complaint.incidentId = proposedIncident._id;
            await complaint.save();

            await Incident.findByIdAndUpdate(proposedIncident._id, {
                $addToSet: {
                    affectedRooms: doorNumber,
                    linkedComplaints: complaint._id
                }
            });

            logger.info(`Added complaint ${complaint._id} (Room ${doorNumber}) to proposed incident ${proposedIncident.incidentNumber}`);
            
            if (ioEmitter && ioEmitter.emitIncidentUpdated) {
                const updatedInc = await Incident.findById(proposedIncident._id).populate("linkedComplaints");
                ioEmitter.emitIncidentUpdated(updatedInc);
            }
            return proposedIncident;
        }

        // 3. Check for emerging pattern: find unlinked complaints within rolling window
        const eligibleCategories = serviceType === "WATER"
            ? ["Plumbing", "NO_WATER_SUPPLY"]
            : ["Electrical", "NO_ELECTRICITY"];

        const recentComplaints = await Complaint.find({
            $or: [
                { category: { $in: eligibleCategories } },
                { quickCategory: { $in: eligibleCategories } }
            ],
            status: { $in: ["Pending", "In Progress", "Reopened"] },
            incidentId: null,
            createdAt: { $gte: windowStart }
        });

        const distinctRooms = new Set(recentComplaints.map(c => c.doorNumber).filter(r => r && r !== "N/A"));

        // If distinct affected rooms threshold is met, propose an incident for Warden review
        if (distinctRooms.size >= INCIDENT_CONFIG.DISTINCT_ROOMS_THRESHOLD) {
            let saved = false;
            let newIncident = null;
            let attempts = 0;

            while (!saved && attempts < 3) {
                attempts++;
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
                const randomCode = Math.floor(100 + Math.random() * 900);
                const incidentNumber = `INC-${serviceType.slice(0, 3)}-${dateStr}-${randomCode}`;

                const serviceLabel = serviceType === "WATER" ? "Water Supply Outage" : "Electricity Outage";
                const affectedRoomsList = Array.from(distinctRooms);

                newIncident = new Incident({
                    incidentNumber,
                    serviceType,
                    serviceCategory: eligibleCategories[0],
                    title: `Suspected ${serviceLabel} across ${distinctRooms.size} rooms`,
                    description: `Automated detection triggered: ${recentComplaints.length} reports across ${distinctRooms.size} distinct rooms within ${INCIDENT_CONFIG.WINDOW_MINUTES} minutes.`,
                    status: "PROPOSED",
                    affectedRooms: affectedRoomsList,
                    linkedComplaints: recentComplaints.map(c => c._id),
                    proposedAt: new Date(),
                    statusHistory: [{
                        status: "PROPOSED",
                        timestamp: new Date(),
                        actor: "System Detector",
                        note: `Proposed automatically after ${distinctRooms.size} distinct rooms reported ${serviceLabel.toLowerCase()}.`
                    }]
                });

                try {
                    await newIncident.save();
                    saved = true;
                } catch (saveErr) {
                    if (saveErr.code === 11000 && saveErr.keyPattern?.incidentNumber) {
                        continue;
                    }
                    throw saveErr;
                }
            }

            // Link all eligible complaints to this new incident
            await Complaint.updateMany(
                { _id: { $in: recentComplaints.map(c => c._id) } },
                { $set: { incidentId: newIncident._id } }
            );

            logger.info(`🚨 PROPOSED shared incident ${newIncident.incidentNumber} for ${serviceType} across ${distinctRooms.size} rooms.`);

            if (ioEmitter && ioEmitter.emitIncidentCreated) {
                const populatedInc = await Incident.findById(newIncident._id).populate("linkedComplaints");
                ioEmitter.emitIncidentCreated(populatedInc);
            }
            return newIncident;
        }

        return null;
    } catch (err) {
        logger.error("Error in processComplaintForIncidents:", err);
        return null;
    }
}

module.exports = {
    INCIDENT_CONFIG,
    getServiceType,
    processComplaintForIncidents
};
