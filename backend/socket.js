const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./utils/logger");

let io = null;

const MANAGEMENT_ROLES = ["WARDEN", "HEADWARDEN", "INCHARGE"];

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "http://localhost:5173",
            credentials: true
        }
    });

    // JWT Authentication middleware for socket connections
    io.use((socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = {
                id: decoded.id,
                role: decoded.role,
                email: decoded.email
            };
            next();
        } catch (err) {
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        const { id, role } = socket.user;
        logger.info(`🔌 Socket connected: ${socket.id} (User: ${id}, Role: ${role})`);

        // Join personal user room
        socket.join(`user:${id}`);

        // Join role-specific room
        if (role) {
            socket.join(`role:${role}`);
        }

        // Join management/wardens room (WARDEN, HEADWARDEN, INCHARGE only — excluding STAFF)
        if (MANAGEMENT_ROLES.includes(role)) {
            socket.join("wardens");
        }

        socket.on("disconnect", (reason) => {
            logger.info(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io has not been initialized!");
    }
    return io;
};

const getEntityId = (entity) => {
    if (!entity) return null;
    if (typeof entity === "string") return entity;
    if (entity._id) return String(entity._id);
    if (entity.id) return String(entity.id);
    return String(entity);
};

// Helper event emitters with strict authorization scope
const emitComplaintCreated = (complaint) => {
    if (!io) return;
    const cid = getEntityId(complaint._id || complaint.id);
    const payload = {
        complaintId: cid,
        complaint: complaint.toObject ? complaint.toObject() : complaint
    };
    const studentIdStr = getEntityId(complaint.studentId);
    
    const cat = complaint.quickCategory || complaint.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";

    const rooms = [];
    if (isWifi) {
        rooms.push("role:WIFI_INCHARGE");
    } else {
        rooms.push("wardens");
    }
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);

    io.to(rooms).emit("complaint:created", payload);
};

const emitComplaintStatusUpdated = (complaint) => {
    if (!io) return;
    const cid = getEntityId(complaint._id || complaint.id);
    const payload = {
        complaintId: cid,
        status: complaint.status,
        complaint: complaint.toObject ? complaint.toObject() : complaint
    };
    const studentIdStr = getEntityId(complaint.studentId);
    const assignedStaffId = getEntityId(complaint.assignedTo);

    const cat = complaint.quickCategory || complaint.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";

    const rooms = [];
    if (isWifi) {
        rooms.push("role:WIFI_INCHARGE");
    } else {
        rooms.push("wardens");
    }
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);
    if (assignedStaffId) rooms.push(`user:${assignedStaffId}`);

    io.to(rooms).emit("complaint:status-updated", payload);
};

const emitComplaintAssigned = (complaint) => {
    if (!io) return;
    const cid = getEntityId(complaint._id || complaint.id);
    const payload = {
        complaintId: cid,
        assignedTo: complaint.assignedTo,
        status: complaint.status,
        complaint: complaint.toObject ? complaint.toObject() : complaint
    };
    const studentIdStr = getEntityId(complaint.studentId);
    const assignedStaffId = getEntityId(complaint.assignedTo);

    const cat = complaint.quickCategory || complaint.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";

    const rooms = [];
    if (isWifi) {
        rooms.push("role:WIFI_INCHARGE");
    } else {
        rooms.push("wardens");
    }
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);
    if (assignedStaffId) rooms.push(`user:${assignedStaffId}`);

    io.to(rooms).emit("complaint:assigned", payload);
};

const emitComplaintDeleted = (complaintId, studentId = null) => {
    if (!io) return;
    const cid = getEntityId(complaintId);
    const payload = { complaintId: cid };
    const rooms = ["wardens", "role:WIFI_INCHARGE"];
    const studentIdStr = getEntityId(studentId);
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);
    io.to(rooms).emit("complaint:deleted", payload);
};

// ─── Shared Incident Emitters ────────────────────────────────────────────────
const emitIncidentCreated = (incident) => {
    if (!io) return;
    const payload = {
        incidentId: getEntityId(incident._id || incident.id),
        incident: incident.toObject ? incident.toObject() : incident
    };
    io.to("wardens").emit("incident:created", payload);
};

const emitIncidentUpdated = (incident) => {
    if (!io) return;
    const payload = {
        incidentId: getEntityId(incident._id || incident.id),
        incident: incident.toObject ? incident.toObject() : incident
    };
    io.to("wardens").emit("incident:updated", payload);
};

const emitServiceHeatmapUpdate = (delta) => {
    if (!io) return;
    const cat = delta?.quickCategory || delta?.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";
    if (isWifi) {
        io.to("role:WIFI_INCHARGE").emit("service:heatmap-update", delta);
    } else {
        io.to("wardens").emit("service:heatmap-update", delta);
    }
};

module.exports = {
    initSocket,
    getIO,
    emitComplaintCreated,
    emitComplaintStatusUpdated,
    emitComplaintAssigned,
    emitComplaintDeleted,
    emitIncidentCreated,
    emitIncidentUpdated,
    emitServiceHeatmapUpdate
};
