const Complaint = require("../models/Complaint");
const Incident  = require("../models/Incident");
const logger    = require("../utils/logger");

// Helper to check category matching service
function matchCategoryForService(complaint, service) {
    const cat = complaint.quickCategory || complaint.category;
    if (service === "water") {
        return cat === "NO_WATER_SUPPLY" || cat === "Plumbing";
    }
    if (service === "electricity") {
        return cat === "NO_ELECTRICITY" || cat === "Electrical";
    }
    if (service === "wifi") {
        return cat === "WIFI_NOT_WORKING" || cat === "Internet";
    }
    return true;
}

// GET /api/services/heat-map
// Fast aggregated report counts and incident overlays for all 77 rooms
exports.getServiceHeatMap = async (req, res) => {
    try {
        const { service = "all" } = req.query;
        const userRole = req.user?.role;
        const isWifiSpecialist = userRole === "WIFI_INCHARGE";

        // Filter active complaints based on authorized role
        const complaintFilter = {
            status: { $in: ["Pending", "In Progress", "Reopened"] },
            doorNumber: { $exists: true, $ne: null }
        };

        if (isWifiSpecialist) {
            complaintFilter.$or = [{ category: "Internet" }, { quickCategory: "WIFI_NOT_WORKING" }];
        } else {
            // Warden / Staff / Management: Exclude Wi-Fi complaints completely
            complaintFilter.$and = [
                { category: { $ne: "Internet" } },
                { quickCategory: { $ne: "WIFI_NOT_WORKING" } }
            ];
            if (service === "water") {
                complaintFilter.$or = [{ category: "Plumbing" }, { quickCategory: "NO_WATER_SUPPLY" }];
            } else if (service === "electricity") {
                complaintFilter.$or = [{ category: "Electrical" }, { quickCategory: "NO_ELECTRICITY" }];
            } else {
                complaintFilter.$or = [
                    { category: { $in: ["Plumbing", "Electrical"] } },
                    { quickCategory: { $in: ["NO_WATER_SUPPLY", "NO_ELECTRICITY"] } }
                ];
            }
        }

        const activeComplaints = await Complaint.find(complaintFilter)
            .select("doorNumber category quickCategory status incidentId createdAt");

        // Query active incidents (Water and Electricity only for Warden)
        let activeIncidents = [];
        if (!isWifiSpecialist) {
            activeIncidents = await Incident.find({
                status: { $in: ["PROPOSED", "CONFIRMED", "IN_PROGRESS", "RESTORATION_REPORTED"] }
            }).select("incidentNumber serviceType status affectedRooms title");
        }

        const roomStats = {};
        const summary = isWifiSpecialist
            ? { wifi: { openCount: 0, distinctRooms: new Set(), activeIncidents: 0 } }
            : {
                water: { openCount: 0, distinctRooms: new Set(), activeIncidents: 0 },
                electricity: { openCount: 0, distinctRooms: new Set(), activeIncidents: 0 }
            };

        // Incident map for quick lookup by room
        const roomIncidentMap = {};
        activeIncidents.forEach(inc => {
            const svcKey = inc.serviceType === "WATER" ? "water" : "electricity";
            if (summary[svcKey]) {
                summary[svcKey].activeIncidents += 1;
            }

            (inc.affectedRooms || []).forEach(rm => {
                if (!roomIncidentMap[rm]) roomIncidentMap[rm] = [];
                roomIncidentMap[rm].push({
                    id: inc._id,
                    incidentNumber: inc.incidentNumber,
                    serviceType: inc.serviceType,
                    status: inc.status,
                    title: inc.title
                });
            });
        });

        activeComplaints.forEach(c => {
            const rm = String(c.doorNumber).trim();
            if (!rm || rm === "N/A") return;

            if (!roomStats[rm]) {
                roomStats[rm] = isWifiSpecialist
                    ? { wifi: 0, total: 0, incidents: [] }
                    : { water: 0, electricity: 0, total: 0, incidents: roomIncidentMap[rm] || [] };
            }

            const cat = c.quickCategory || c.category;

            if (isWifiSpecialist) {
                if (cat === "WIFI_NOT_WORKING" || cat === "Internet") {
                    roomStats[rm].wifi += 1;
                    summary.wifi.openCount += 1;
                    summary.wifi.distinctRooms.add(rm);
                    roomStats[rm].total += 1;
                }
            } else {
                if (cat === "NO_WATER_SUPPLY" || cat === "Plumbing") {
                    roomStats[rm].water += 1;
                    summary.water.openCount += 1;
                    summary.water.distinctRooms.add(rm);
                    roomStats[rm].total += 1;
                } else if (cat === "NO_ELECTRICITY" || cat === "Electrical") {
                    roomStats[rm].electricity += 1;
                    summary.electricity.openCount += 1;
                    summary.electricity.distinctRooms.add(rm);
                    roomStats[rm].total += 1;
                }
            }
        });

        // Convert distinctRooms sets to counts
        const formattedSummary = isWifiSpecialist
            ? {
                wifi: {
                    openCount: summary.wifi.openCount,
                    distinctRooms: summary.wifi.distinctRooms.size,
                    activeIncidents: 0
                }
            }
            : {
                water: {
                    openCount: summary.water.openCount,
                    distinctRooms: summary.water.distinctRooms.size,
                    activeIncidents: summary.water.activeIncidents
                },
                electricity: {
                    openCount: summary.electricity.openCount,
                    distinctRooms: summary.electricity.distinctRooms.size,
                    activeIncidents: summary.electricity.activeIncidents
                }
            };

        res.json({
            summary: formattedSummary,
            roomStats,
            activeIncidents
        });
    } catch (err) {
        logger.error("getServiceHeatMap error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/services/room/:roomNumber/complaints
// Detail complaints for a clicked room
exports.getRoomComplaints = async (req, res) => {
    try {
        const { roomNumber } = req.params;
        const { service = "all" } = req.query;
        const userRole = req.user?.role;
        const isWifiSpecialist = userRole === "WIFI_INCHARGE";

        const filter = {
            doorNumber: String(roomNumber).trim()
        };

        if (isWifiSpecialist) {
            // Wi-Fi In-Charge is ONLY authorized to view Wi-Fi complaints
            filter.$or = [{ category: "Internet" }, { quickCategory: "WIFI_NOT_WORKING" }];
        } else {
            // Warden / Staff / Management: NEVER expose Wi-Fi complaints
            if (service === "water") {
                filter.$or = [{ category: "Plumbing" }, { quickCategory: "NO_WATER_SUPPLY" }];
            } else if (service === "electricity") {
                filter.$or = [{ category: "Electrical" }, { quickCategory: "NO_ELECTRICITY" }];
            } else {
                filter.$and = [
                    { category: { $ne: "Internet" } },
                    { quickCategory: { $ne: "WIFI_NOT_WORKING" } }
                ];
            }
        }

        const complaints = await Complaint.find(filter)
            .populate("studentId", "name fullName prn doorNumber")
            .populate("assignedTo", "name email role")
            .populate("incidentId", "incidentNumber title status")
            .sort({ createdAt: -1 });

        // Also check if any active incident affects this room (Warden only)
        let activeIncidents = [];
        if (!isWifiSpecialist) {
            activeIncidents = await Incident.find({
                affectedRooms: String(roomNumber).trim(),
                status: { $in: ["PROPOSED", "CONFIRMED", "IN_PROGRESS", "RESTORATION_REPORTED"] }
            });
        }

        res.json({
            roomNumber,
            complaints,
            activeIncidents
        });
    } catch (err) {
        logger.error("getRoomComplaints error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
