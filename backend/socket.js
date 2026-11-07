const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./utils/logger");

let io = null;

const MANAGEMENT_ROLES = ["WARDEN", "HEADWARDEN", "INCHARGE", "MAIN_ADMIN"];

const initSocket = (server) => {
    const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"];
    const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    const allowedOrigins = envOrigins.length > 0 ? Array.from(new Set([...envOrigins, ...defaultOrigins])) : defaultOrigins;

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
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

    io.on("connection", async (socket) => {
        const { id, role } = socket.user;
        logger.info(`🔌 Socket connected: ${socket.id} (User: ${id}, Role: ${role})`);

        // Join personal user room
        socket.join(`user:${id}`);

        // Join role-specific room
        if (role) {
            socket.join(`role:${role}`);
        }

        // Join management/wardens room
        if (MANAGEMENT_ROLES.includes(role)) {
            socket.join("wardens");
            socket.join("management");
        }

        // Join department-specific rooms
        try {
            const { User } = require("./models/User");
            const Department = require("./models/Department");
            const liveUser = await User.findById(id, "departmentId authorizedDepartments dashboardPermissions staffRole").lean();

            if (liveUser) {
                if (liveUser.departmentId) {
                    socket.join(`dept:${liveUser.departmentId}`);
                    const d = await Department.findById(liveUser.departmentId, "code").lean();
                    if (d && d.code) socket.join(`dept:${d.code}`);
                }

                if (Array.isArray(liveUser.authorizedDepartments)) {
                    for (const authDeptId of liveUser.authorizedDepartments) {
                        socket.join(`dept:${authDeptId}`);
                    }
                }

                if (Array.isArray(liveUser.dashboardPermissions)) {
                    for (const perm of liveUser.dashboardPermissions) {
                        socket.join(`dept:${perm.toUpperCase()}`);
                    }
                }

                // Fallback by staffRole
                const sr = liveUser.staffRole || "";
                if (sr.match(/plumb/i)) socket.join("dept:PLUMBING");
                else if (sr.match(/elect/i)) socket.join("dept:ELECTRICAL");
                else if (sr.match(/carpent|furn|work/i)) socket.join("dept:WORKSHOP");
                else if (sr.match(/clean|house/i)) socket.join("dept:CLEANING");
                else if (sr.match(/secur/i)) socket.join("dept:SECURITY");
                else if (sr.match(/ragging/i)) socket.join("dept:ANTI_RAGGING");
            }
        } catch (err) {
            logger.error(`Error joining department rooms for user ${id}: ${err.message}`);
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
    const complaintObj = complaint.toObject ? complaint.toObject() : complaint;
    const payload = {
        complaintId: cid,
        complaint: complaintObj
    };
    const studentIdStr = getEntityId(complaint.studentId);
    
    const cat = complaint.quickCategory || complaint.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";
    const isAntiRagging = complaint.isAntiRagging || complaint.isConfidential || (cat && cat.match(/ragging/i));

    const rooms = [];
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);

    if (isAntiRagging) {
        // Strict privacy: Anti-Ragging emitted ONLY to authorized committee, Incharge, and Main Admin
        rooms.push("role:MAIN_ADMIN");
        rooms.push("role:INCHARGE");
        rooms.push("dept:ANTI_RAGGING");
        if (complaint.departmentId) {
            rooms.push(`dept:${getEntityId(complaint.departmentId)}`);
        }
    } else {
        if (isWifi) {
            rooms.push("role:WIFI_INCHARGE");
        }
        rooms.push("wardens");
        rooms.push("role:MAIN_ADMIN");
        if (complaint.departmentId) {
            const deptId = getEntityId(complaint.departmentId);
            rooms.push(`dept:${deptId}`);
            if (complaint.departmentId.code) {
                rooms.push(`dept:${complaint.departmentId.code}`);
            }
        }
    }

    io.to(rooms).emit("complaint:created", payload);
};

const emitComplaintStatusUpdated = (complaint) => {
    if (!io) return;
    const cid = getEntityId(complaint._id || complaint.id);
    const complaintObj = complaint.toObject ? complaint.toObject() : complaint;
    const payload = {
        complaintId: cid,
        status: complaint.status,
        complaint: complaintObj
    };
    const studentIdStr = getEntityId(complaint.studentId);
    const assignedStaffId = getEntityId(complaint.assignedTo);

    const cat = complaint.quickCategory || complaint.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";
    const isAntiRagging = complaint.isAntiRagging || complaint.isConfidential || (cat && cat.match(/ragging/i));

    const rooms = [];
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);
    if (assignedStaffId) rooms.push(`user:${assignedStaffId}`);

    if (isAntiRagging) {
        rooms.push("role:MAIN_ADMIN");
        rooms.push("role:INCHARGE");
        rooms.push("dept:ANTI_RAGGING");
        if (complaint.departmentId) {
            rooms.push(`dept:${getEntityId(complaint.departmentId)}`);
        }
    } else {
        if (isWifi) {
            rooms.push("role:WIFI_INCHARGE");
        }
        rooms.push("wardens");
        rooms.push("role:MAIN_ADMIN");
        if (complaint.departmentId) {
            const deptId = getEntityId(complaint.departmentId);
            rooms.push(`dept:${deptId}`);
            if (complaint.departmentId.code) {
                rooms.push(`dept:${complaint.departmentId.code}`);
            }
        }
    }

    io.to(rooms).emit("complaint:status-updated", payload);
};

const emitComplaintAssigned = (complaint) => {
    if (!io) return;
    const cid = getEntityId(complaint._id || complaint.id);
    const complaintObj = complaint.toObject ? complaint.toObject() : complaint;
    const payload = {
        complaintId: cid,
        assignedTo: complaint.assignedTo,
        status: complaint.status,
        complaint: complaintObj
    };
    const studentIdStr = getEntityId(complaint.studentId);
    const assignedStaffId = getEntityId(complaint.assignedTo);

    const cat = complaint.quickCategory || complaint.category;
    const isWifi = cat === "WIFI_NOT_WORKING" || cat === "Internet";
    const isAntiRagging = complaint.isAntiRagging || complaint.isConfidential || (cat && cat.match(/ragging/i));

    const rooms = [];
    if (studentIdStr) rooms.push(`user:${studentIdStr}`);
    if (assignedStaffId) rooms.push(`user:${assignedStaffId}`);

    if (isAntiRagging) {
        rooms.push("role:MAIN_ADMIN");
        rooms.push("role:INCHARGE");
        rooms.push("dept:ANTI_RAGGING");
        if (complaint.departmentId) {
            rooms.push(`dept:${getEntityId(complaint.departmentId)}`);
        }
    } else {
        if (isWifi) {
            rooms.push("role:WIFI_INCHARGE");
        }
        rooms.push("wardens");
        rooms.push("role:MAIN_ADMIN");
        if (complaint.departmentId) {
            const deptId = getEntityId(complaint.departmentId);
            rooms.push(`dept:${deptId}`);
            if (complaint.departmentId.code) {
                rooms.push(`dept:${complaint.departmentId.code}`);
            }
        }
    }

    io.to(rooms).emit("complaint:assigned", payload);
};

const emitComplaintDeleted = (complaintId, studentId = null) => {
    if (!io) return;
    const cid = getEntityId(complaintId);
    const payload = { complaintId: cid };
    const rooms = ["wardens", "role:WIFI_INCHARGE", "role:MAIN_ADMIN"];
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
