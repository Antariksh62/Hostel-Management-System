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

// Helper event emitters with strict authorization scope
const emitComplaintCreated = (complaint) => {
    if (!io) return;
    const payload = { complaint };
    const studentIdStr = complaint.studentId?._id || complaint.studentId;
    
    // Broadcast ONLY to management (wardens) and the student who created it
    let roomEmitter = io.to("wardens");
    if (studentIdStr) roomEmitter = roomEmitter.to(`user:${studentIdStr}`);
    roomEmitter.emit("complaint:created", payload);
};

const emitComplaintStatusUpdated = (complaint) => {
    if (!io) return;
    const payload = {
        complaintId: complaint._id,
        status: complaint.status,
        complaint
    };
    const studentIdStr = complaint.studentId?._id || complaint.studentId;
    const assignedStaffId = complaint.assignedTo?._id || complaint.assignedTo;

    // Broadcast to wardens, student owner, and assigned staff member
    let roomEmitter = io.to("wardens");
    if (studentIdStr) roomEmitter = roomEmitter.to(`user:${studentIdStr}`);
    if (assignedStaffId) roomEmitter = roomEmitter.to(`user:${assignedStaffId}`);

    roomEmitter.emit("complaint:status-updated", payload);
};

const emitComplaintAssigned = (complaint) => {
    if (!io) return;
    const payload = {
        complaintId: complaint._id,
        assignedTo: complaint.assignedTo,
        status: complaint.status,
        complaint
    };
    const studentIdStr = complaint.studentId?._id || complaint.studentId;
    const assignedStaffId = complaint.assignedTo?._id || complaint.assignedTo;

    // Broadcast to wardens, student owner, and the specific assigned staff member
    let roomEmitter = io.to("wardens");
    if (studentIdStr) roomEmitter = roomEmitter.to(`user:${studentIdStr}`);
    if (assignedStaffId) roomEmitter = roomEmitter.to(`user:${assignedStaffId}`);

    roomEmitter.emit("complaint:assigned", payload);
};

const emitComplaintDeleted = (complaintId, studentId = null) => {
    if (!io) return;
    const payload = { complaintId };
    let roomEmitter = io.to("wardens");
    if (studentId) roomEmitter = roomEmitter.to(`user:${studentId}`);
    roomEmitter.emit("complaint:deleted", payload);
};

module.exports = {
    initSocket,
    getIO,
    emitComplaintCreated,
    emitComplaintStatusUpdated,
    emitComplaintAssigned,
    emitComplaintDeleted
};
