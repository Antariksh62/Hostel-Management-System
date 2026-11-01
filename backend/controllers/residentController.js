const mongoose = require("mongoose");
const { User, Student } = require("../models/User");
const Complaint = require("../models/Complaint");
const ResidentAuditLog = require("../models/ResidentAuditLog");
const { ALL_ROOMS, isValidRoom, getFloorFromRoom, getRoomsByFloor, MAX_STUDENTS_PER_ROOM } = require("../utils/hostelRooms");
const { checkRoomCapacity, assignStudentRoomAtomic, calculateBatchProjections } = require("../services/roomOccupancyService");
const logger = require("../utils/logger");

// Helper to escape regex input
function escapeRegex(text) {
    if (typeof text !== "string") return "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Helper to sanitize CSV cells against formula injection
function sanitizeCSVCell(value) {
    if (value === null || value === undefined || value === "") return '""';
    let str = String(value).trim();
    // Strip legacy em-dashes or hyphens intended as placeholders so cells remain truly empty in Excel
    if (str === "—" || str === "-" || str === "–" || str === "N/A" || str === "None") return '""';
    // Neutralize spreadsheet formula injection characters
    if (/^[=+@-]/i.test(str)) {
        str = "'" + str;
    }
    // Escape quotes
    return `"${str.replace(/"/g, '""')}"`;
}

// Mask sensitive phone numbers for unrevealed views
function maskPhone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/\D/g, "");
    if (clean.length < 4) return "******";
    return "*".repeat(clean.length - 4) + clean.slice(-4);
}

// =============================================================================
// 1. GET /api/residents — Paginated directory with unified multi-field search
// =============================================================================
exports.getResidents = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            q = "",
            floor,
            branch,
            year,
            division,
            roomStatus,
            profileStatus,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        // Base filter: must be STUDENT
        const filter = { role: "STUDENT" };

        // Floor filter
        if (floor) {
            const fNum = parseInt(floor, 10);
            if ([1, 2, 3, 4, 5].includes(fNum)) {
                const floorRooms = getRoomsByFloor(fNum);
                filter.doorNumber = { $in: floorRooms };
            }
        }

        // Branch filter
        if (branch) {
            filter.branch = String(branch).trim().toUpperCase();
        }

        // Year filter
        if (year) {
            filter.year = String(year).trim().toUpperCase();
        }

        // Division / class filter
        if (division) {
            filter.classDiv = { $regex: new RegExp(`^${escapeRegex(division.trim())}$`, "i") };
        }

        // Room assignment status filter
        if (roomStatus === "assigned") {
            filter.doorNumber = { $exists: true, $nin: [null, ""] };
        } else if (roomStatus === "unassigned") {
            filter.$or = [
                { doorNumber: { $exists: false } },
                { doorNumber: null },
                { doorNumber: "" }
            ];
        }

        // Profile status filter
        if (profileStatus === "complete") {
            filter.profileComplete = true;
        } else if (profileStatus === "incomplete") {
            filter.profileComplete = false;
        }

        // Unified multi-field search
        let matchReason = null;
        if (q && q.trim()) {
            const rawQuery = q.trim();
            const digitsOnly = rawQuery.replace(/\D/g, "");
            const searchOr = [];

            // 1. Phone number match (normalized Indian numbers, 4 to 10 digits)
            if (digitsOnly.length >= 4) {
                const phoneRegex = new RegExp(`${escapeRegex(digitsOnly)}$`);
                searchOr.push({ mobileNumber: { $regex: phoneRegex } });
                searchOr.push({ guardianPhone: { $regex: phoneRegex } });
                searchOr.push({ guardianSecondaryPhone: { $regex: phoneRegex } });
                searchOr.push({ emergencyPhone: { $regex: phoneRegex } });
                searchOr.push({ emergencySecondaryPhone: { $regex: phoneRegex } });
            }

            // 2. Tokenized Name Search (handles first name, middle name, surname)
            const tokens = rawQuery.split(/\s+/).filter(Boolean);
            if (tokens.length > 0) {
                const nameTokenConditions = tokens.map(token => {
                    const tRegex = new RegExp(escapeRegex(token), "i");
                    return {
                        $or: [
                            { fullName: { $regex: tRegex } },
                            { name: { $regex: tRegex } }
                        ]
                    };
                });
                // All tokens must match somewhere in the name
                searchOr.push({ $and: nameTokenConditions });
            }

            // 3. Identifier searches (PRN, Roll number, Room number, Email)
            const tokenRegex = new RegExp(escapeRegex(rawQuery), "i");
            searchOr.push({ prn: { $regex: tokenRegex } });
            searchOr.push({ rollNumber: { $regex: tokenRegex } });
            searchOr.push({ email: { $regex: tokenRegex } });

            // Room number lookup
            if (isValidRoom(rawQuery)) {
                searchOr.push({ doorNumber: rawQuery });
            } else if (/^\d{1,3}$/.test(rawQuery)) {
                searchOr.push({ doorNumber: { $regex: new RegExp(`^${escapeRegex(rawQuery)}`, "i") } });
            }

            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
                delete filter.$or;
            } else {
                filter.$or = searchOr;
            }
        }

        // Sorting
        const sortOptions = {};
        const allowedSortFields = ["fullName", "name", "prn", "doorNumber", "createdAt", "year", "branch"];
        const cleanSortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
        sortOptions[cleanSortField] = sortOrder === "asc" ? 1 : -1;

        const total = await Student.countDocuments(filter);
        const students = await Student.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Shape response and annotate search match reasons without leaking full contact numbers
        const cleanQuery = q.trim().toLowerCase();
        const queryDigits = q.trim().replace(/\D/g, "");

        const residents = students.map(s => {
            let matchedCategory = null;

            if (q && q.trim()) {
                const gPhone = (s.guardianPhone || "").replace(/\D/g, "");
                const gSec = (s.guardianSecondaryPhone || "").replace(/\D/g, "");
                const ePhone = (s.emergencyPhone || "").replace(/\D/g, "");
                const eSec = (s.emergencySecondaryPhone || "").replace(/\D/g, "");
                const mPhone = (s.mobileNumber || "").replace(/\D/g, "");

                if (queryDigits.length >= 4 && (gPhone.includes(queryDigits) || gSec.includes(queryDigits))) {
                    matchedCategory = "Guardian contact";
                } else if (queryDigits.length >= 4 && (ePhone.includes(queryDigits) || eSec.includes(queryDigits))) {
                    matchedCategory = "Emergency contact";
                } else if (queryDigits.length >= 4 && mPhone.includes(queryDigits)) {
                    matchedCategory = "Student mobile";
                } else if (s.doorNumber && s.doorNumber.toLowerCase() === cleanQuery) {
                    matchedCategory = "Room number";
                } else if (s.prn && s.prn.toLowerCase().includes(cleanQuery)) {
                    matchedCategory = "PRN";
                } else if (s.rollNumber && s.rollNumber.toLowerCase().includes(cleanQuery)) {
                    matchedCategory = "Roll number";
                } else if (s.email && s.email.toLowerCase().includes(cleanQuery)) {
                    matchedCategory = "College email";
                } else {
                    matchedCategory = "Student name";
                }
            }

            const floorNum = s.doorNumber ? getFloorFromRoom(s.doorNumber) : null;

            return {
                id: s._id,
                name: s.fullName || s.name || "—",
                fullName: s.fullName || s.name || "—",
                prn: s.prn,
                email: s.email,
                rollNumber: s.rollNumber || "—",
                branch: s.branch || "—",
                year: s.year || "—",
                classDiv: s.classDiv || "—",
                doorNumber: s.doorNumber || null,
                floor: floorNum,
                isAssigned: Boolean(s.doorNumber && isValidRoom(s.doorNumber)),
                profileComplete: Boolean(s.profileComplete),
                mobileNumberMasked: maskPhone(s.mobileNumber),
                hasGuardianContact: Boolean(s.guardianPhone || s.guardianName),
                hasEmergencyContact: Boolean(s.emergencyPhone || s.emergencyName),
                matchedCategory
            };
        });

        res.json({
            residents,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1
            }
        });
    } catch (err) {
        logger.error("getResidents error:", err);
        res.status(500).json({ message: "Failed to fetch resident directory", error: err.message });
    }
};

// =============================================================================
// 2. GET /api/residents/:id — Single student complete detail record
// =============================================================================
exports.getResidentById = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, role: "STUDENT" }).lean();
        if (!student) {
            return res.status(404).json({ message: "Resident not found" });
        }

        const floorNum = student.doorNumber ? getFloorFromRoom(student.doorNumber) : null;

        res.json({
            id: student._id,
            name: student.fullName || student.name || "—",
            fullName: student.fullName || student.name || "—",
            prn: student.prn,
            email: student.email, // Read-only official email
            rollNumber: student.rollNumber || "—",
            branch: student.branch || "—",
            year: student.year || "—",
            classDiv: student.classDiv || "—",
            joiningYear: student.joiningYear || null,
            doorNumber: student.doorNumber || null,
            floor: floorNum,
            isAssigned: Boolean(student.doorNumber && isValidRoom(student.doorNumber)),
            profileComplete: Boolean(student.profileComplete),

            // Masked contact information by default
            mobileNumberMasked: maskPhone(student.mobileNumber),
            guardianPhoneMasked: maskPhone(student.guardianPhone),
            guardianSecondaryPhoneMasked: maskPhone(student.guardianSecondaryPhone),
            emergencyPhoneMasked: maskPhone(student.emergencyPhone),
            emergencySecondaryPhoneMasked: maskPhone(student.emergencySecondaryPhone),

            // Names & relationships (not sensitive)
            guardianName: student.guardianName || "",
            guardianRelationship: student.guardianRelationship || "",
            emergencyName: student.emergencyName || "",
            emergencyRelationship: student.emergencyRelationship || "",

            // Historical room assignments
            roomHistory: student.roomHistory || [],

            createdAt: student.createdAt,
            updatedAt: student.updatedAt
        });
    } catch (err) {
        logger.error("getResidentById error:", err);
        res.status(500).json({ message: "Failed to load resident details", error: err.message });
    }
};

// =============================================================================
// 3. POST /api/residents/:id/reveal-contact — On-demand contact unmask with audit
// =============================================================================
exports.revealResidentContacts = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, role: "STUDENT" });
        if (!student) {
            return res.status(404).json({ message: "Resident not found" });
        }

        const admin = await User.findById(req.user.id);
        const adminName = admin ? (admin.name || admin.email) : "Administrator";

        // Audit the contact reveal
        await ResidentAuditLog.create({
            action: "REVEAL_CONTACT",
            performedBy: req.user.id,
            adminName,
            adminRole: req.user.role,
            adminEmail: admin?.email || "",
            targetStudent: student._id,
            studentName: student.fullName || student.name || student.prn,
            studentPRN: student.prn,
            details: { reason: "On-demand contact inspection" },
            ipAddress: req.ip || req.connection?.remoteAddress || ""
        });

        logger.info(`[AUDIT] Contact numbers for student ${student.prn} revealed by ${req.user.role} ${adminName}`);

        // Return unmasked contact numbers
        res.json({
            id: student._id,
            mobileNumber: student.mobileNumber || null,
            guardianName: student.guardianName || "",
            guardianRelationship: student.guardianRelationship || "",
            guardianPhone: student.guardianPhone || null,
            guardianSecondaryPhone: student.guardianSecondaryPhone || null,
            emergencyName: student.emergencyName || "",
            emergencyRelationship: student.emergencyRelationship || "",
            emergencyPhone: student.emergencyPhone || null,
            emergencySecondaryPhone: student.emergencySecondaryPhone || null
        });
    } catch (err) {
        logger.error("revealResidentContacts error:", err);
        res.status(500).json({ message: "Failed to reveal contact details", error: err.message });
    }
};

// =============================================================================
// 4. PATCH /api/residents/:id/contacts — Admin-managed emergency & parent contacts
// =============================================================================
exports.updateResidentContacts = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, role: "STUDENT" });
        if (!student) {
            return res.status(404).json({ message: "Resident not found" });
        }

        const {
            guardianName,
            guardianRelationship,
            guardianPhone,
            guardianSecondaryPhone,
            emergencyName,
            emergencyRelationship,
            emergencyPhone,
            emergencySecondaryPhone
        } = req.body;

        const mobileRegex = /^[6-9]\d{9}$/;
        const fieldsChanged = [];

        if (guardianName !== undefined) {
            student.guardianName = guardianName.trim();
            fieldsChanged.push("guardianName");
        }
        if (guardianRelationship !== undefined) {
            student.guardianRelationship = guardianRelationship.trim();
            fieldsChanged.push("guardianRelationship");
        }
        if (guardianPhone !== undefined) {
            const cleanG = guardianPhone.trim();
            if (cleanG && !mobileRegex.test(cleanG)) {
                return res.status(400).json({ message: "Guardian phone must be a valid 10-digit Indian mobile number" });
            }
            student.guardianPhone = cleanG;
            fieldsChanged.push("guardianPhone");
        }
        if (guardianSecondaryPhone !== undefined) {
            const cleanGSec = guardianSecondaryPhone.trim();
            if (cleanGSec && !mobileRegex.test(cleanGSec)) {
                return res.status(400).json({ message: "Secondary guardian phone must be a valid 10-digit Indian mobile number" });
            }
            student.guardianSecondaryPhone = cleanGSec;
            fieldsChanged.push("guardianSecondaryPhone");
        }

        if (emergencyName !== undefined) {
            student.emergencyName = emergencyName.trim();
            fieldsChanged.push("emergencyName");
        }
        if (emergencyRelationship !== undefined) {
            student.emergencyRelationship = emergencyRelationship.trim();
            fieldsChanged.push("emergencyRelationship");
        }
        if (emergencyPhone !== undefined) {
            const cleanE = emergencyPhone.trim();
            if (cleanE && !mobileRegex.test(cleanE)) {
                return res.status(400).json({ message: "Emergency phone must be a valid 10-digit Indian mobile number" });
            }
            student.emergencyPhone = cleanE;
            fieldsChanged.push("emergencyPhone");
        }
        if (emergencySecondaryPhone !== undefined) {
            const cleanESec = emergencySecondaryPhone.trim();
            if (cleanESec && !mobileRegex.test(cleanESec)) {
                return res.status(400).json({ message: "Secondary emergency phone must be a valid 10-digit Indian mobile number" });
            }
            student.emergencySecondaryPhone = cleanESec;
            fieldsChanged.push("emergencySecondaryPhone");
        }

        await student.save();

        const admin = await User.findById(req.user.id);
        const adminName = admin ? (admin.name || admin.email) : "Administrator";

        // Audit the contact change
        await ResidentAuditLog.create({
            action: "UPDATE_CONTACT",
            performedBy: req.user.id,
            adminName,
            adminRole: req.user.role,
            adminEmail: admin?.email || "",
            targetStudent: student._id,
            studentName: student.fullName || student.name || student.prn,
            studentPRN: student.prn,
            details: { fieldsChanged },
            ipAddress: req.ip || req.connection?.remoteAddress || ""
        });

        logger.info(`[AUDIT] Contacts updated for student ${student.prn} by ${req.user.role} ${adminName}`);

        res.json({
            message: "Contacts updated successfully",
            contacts: {
                guardianName: student.guardianName,
                guardianRelationship: student.guardianRelationship,
                guardianPhone: student.guardianPhone,
                guardianSecondaryPhone: student.guardianSecondaryPhone,
                emergencyName: student.emergencyName,
                emergencyRelationship: student.emergencyRelationship,
                emergencyPhone: student.emergencyPhone,
                emergencySecondaryPhone: student.emergencySecondaryPhone
            }
        });
    } catch (err) {
        logger.error("updateResidentContacts error:", err);
        res.status(500).json({ message: "Failed to update contact records", error: err.message });
    }
};

// =============================================================================
// 5. PATCH /api/residents/:id/room — Admin-managed room reassignment with history
// =============================================================================
exports.updateResidentRoom = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, role: "STUDENT" });
        if (!student) {
            return res.status(404).json({ message: "Resident not found" });
        }

        const { newRoom, reason = "Manual administrative reassignment" } = req.body;
        if (!newRoom) {
            return res.status(400).json({ message: "New room number is required" });
        }

        const cleanRoom = String(newRoom).trim();
        if (!isValidRoom(cleanRoom)) {
            return res.status(400).json({ message: `Room ${cleanRoom} is not a valid room in the 77-room inventory` });
        }

        const previousRoom = student.doorNumber || "Unassigned";
        if (previousRoom === cleanRoom) {
            return res.status(400).json({ message: `Student is already registered in Room ${cleanRoom}` });
        }

        const admin = await User.findById(req.user.id);
        const adminName = admin ? (admin.name || admin.email) : "Administrator";

        // Concurrency-safe atomic reservation enforcing MAX_STUDENTS_PER_ROOM (2)
        const assignResult = await assignStudentRoomAtomic({
            studentId: student._id,
            newRoom: cleanRoom,
            previousRoom: student.doorNumber || null,
            adminName,
            reason: reason.trim()
        });

        // Audit the room update
        await ResidentAuditLog.create({
            action: "UPDATE_ROOM",
            performedBy: req.user.id,
            adminName,
            adminRole: req.user.role,
            adminEmail: admin?.email || "",
            targetStudent: student._id,
            studentName: student.fullName || student.name || student.prn,
            studentPRN: student.prn,
            details: { previousRoom, newRoom: cleanRoom, reason, maxCapacity: MAX_STUDENTS_PER_ROOM },
            ipAddress: req.ip || req.connection?.remoteAddress || ""
        });

        logger.info(`[AUDIT] Room for student ${student.prn} changed from ${previousRoom} to ${cleanRoom} by ${adminName}`);

        res.json({
            message: `Room updated to ${cleanRoom}`,
            doorNumber: cleanRoom,
            floor: getFloorFromRoom(cleanRoom),
            roomHistory: assignResult.roomHistory
        });
    } catch (err) {
        logger.error("updateResidentRoom error:", err);
        const isClientError = err.message && (
            err.message.includes("capacity") ||
            err.message.includes("valid room") ||
            err.message.includes("required")
        );
        res.status(isClientError ? 400 : 500).json({
            message: err.message || "Failed to update room assignment",
            error: err.message
        });
    }
};

// =============================================================================
// 6. GET /api/residents/:id/complaints — Authorized complaints with Wi-Fi ISOLATION
// =============================================================================
exports.getResidentComplaints = async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, role: "STUDENT" });
        if (!student) {
            return res.status(404).json({ message: "Resident not found" });
        }

        // STRICT MANDATORY WI-FI ISOLATION:
        // Never expose Wi-Fi complaints or internet category to Warden/In-Charge resident views
        const filter = {
            studentId: student._id,
            category: { $ne: "Internet" },
            quickCategory: { $ne: "WIFI_NOT_WORKING" }
        };

        const complaints = await Complaint.find(filter)
            .populate("assignedTo", "name email role staffRole")
            .populate("incidentId", "incidentNumber title status")
            .sort({ createdAt: -1 })
            .lean();

        const activeStatuses = ["Pending", "In Progress", "Reopened"];
        const currentComplaints = complaints.filter(c => activeStatuses.includes(c.status));
        const previousComplaints = complaints.filter(c => !activeStatuses.includes(c.status));

        const summary = {
            total: complaints.length,
            activeCount: currentComplaints.length,
            resolvedCount: complaints.filter(c => c.status === "Resolved" || c.status === "resolved").length,
            reopenedCount: complaints.filter(c => c.status === "Reopened").length
        };

        res.json({
            summary,
            currentComplaints,
            previousComplaints
        });
    } catch (err) {
        logger.error("getResidentComplaints error:", err);
        res.status(500).json({ message: "Failed to load complaint history", error: err.message });
    }
};

// =============================================================================
// 7. GET /api/residents/occupancy — Room-wise occupancy across 77 rooms
// =============================================================================
exports.getRoomOccupancy = async (req, res) => {
    try {
        const { floor } = req.query;

        // Query all students
        const students = await Student.find({ role: "STUDENT" })
            .select("fullName name prn rollNumber branch year classDiv doorNumber")
            .lean();

        // Group students by doorNumber
        const occupancyMap = {};
        ALL_ROOMS.forEach(r => {
            occupancyMap[r] = [];
        });

        const unassignedStudents = [];

        students.forEach(s => {
            const rm = s.doorNumber ? String(s.doorNumber).trim() : null;
            if (rm && isValidRoom(rm)) {
                occupancyMap[rm].push({
                    id: s._id,
                    name: s.fullName || s.name || "—",
                    prn: s.prn,
                    rollNumber: s.rollNumber || "—",
                    branch: s.branch || "—",
                    year: s.year || "—",
                    classDiv: s.classDiv || "—"
                });
            } else {
                unassignedStudents.push({
                    id: s._id,
                    name: s.fullName || s.name || "—",
                    prn: s.prn,
                    rollNumber: s.rollNumber || "—",
                    branch: s.branch || "—",
                    year: s.year || "—",
                    invalidRoom: s.doorNumber || "None"
                });
            }
        });

        // Identify all over-capacity rooms (> 2) for administrative review
        const overCapacityList = [];
        ALL_ROOMS.forEach(rNum => {
            const occ = occupancyMap[rNum] || [];
            if (occ.length > MAX_STUDENTS_PER_ROOM) {
                overCapacityList.push({
                    roomNumber: rNum,
                    occupantCount: occ.length,
                    maxCapacity: MAX_STUDENTS_PER_ROOM,
                    occupants: occ
                });
            }
        });

        // Structure room cards by floor with capacity state
        const targetFloors = floor ? [parseInt(floor, 10)] : [1, 2, 3, 4, 5];
        const floorsData = targetFloors.filter(f => [1, 2, 3, 4, 5].includes(f)).map(f => {
            const floorRooms = getRoomsByFloor(f).map(rNum => {
                const occupants = occupancyMap[rNum] || [];
                const count = occupants.length;
                const maxCapacity = MAX_STUDENTS_PER_ROOM;
                const availablePlaces = Math.max(0, maxCapacity - count);
                const isFull = count >= maxCapacity;
                const isOverCapacity = count > maxCapacity;

                let statusState = "available";
                let statusText = `${count}/${maxCapacity} occupied — ${availablePlaces} ${availablePlaces === 1 ? 'place' : 'places'} available`;
                if (count === 0) {
                    statusState = "vacant";
                    statusText = `0/${maxCapacity} occupied — ${maxCapacity} places available`;
                } else if (isOverCapacity) {
                    statusState = "overcapacity";
                    statusText = `${count}/${maxCapacity} occupied — Over capacity (Requires Administrative Review)`;
                } else if (isFull) {
                    statusState = "full";
                    statusText = `${count}/${maxCapacity} occupied — Full`;
                }

                return {
                    roomNumber: rNum,
                    floor: f,
                    occupantCount: count,
                    maxCapacity,
                    availablePlaces,
                    isFull,
                    isOverCapacity,
                    statusState,
                    statusText,
                    occupants
                };
            });

            return {
                floor: f,
                totalRooms: floorRooms.length,
                assignedResidents: floorRooms.reduce((sum, r) => sum + r.occupantCount, 0),
                rooms: floorRooms
            };
        });

        res.json({
            floors: floorsData,
            unassignedCount: unassignedStudents.length,
            unassignedStudents,
            totalAssigned: students.length - unassignedStudents.length,
            totalStudents: students.length,
            maxCapacityPerRoom: MAX_STUDENTS_PER_ROOM,
            overCapacityCount: overCapacityList.length,
            overCapacityRooms: overCapacityList
        });
    } catch (err) {
        logger.error("getRoomOccupancy error:", err);
        res.status(500).json({ message: "Failed to load room occupancy", error: err.message });
    }
};

// =============================================================================
// 8. GET /api/residents/reports — Comprehensive administrative reports
// =============================================================================
exports.getResidentReports = async (req, res) => {
    try {
        const students = await Student.find({ role: "STUDENT" })
            .select("doorNumber branch year classDiv profileComplete")
            .lean();

        const totalResidents = students.length;
        let assignedCount = 0;
        let unassignedCount = 0;
        let profileCompleteCount = 0;
        let profileIncompleteCount = 0;

        const floorDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const branchDist = {};
        const yearDist = { FY: 0, SY: 0, TY: 0 };
        const divisionDist = {};

        const occupiedRoomsSet = new Set();

        students.forEach(s => {
            if (s.profileComplete) profileCompleteCount++;
            else profileIncompleteCount++;

            if (s.doorNumber && isValidRoom(s.doorNumber)) {
                assignedCount++;
                const fl = getFloorFromRoom(s.doorNumber);
                if (fl && floorDist[fl] !== undefined) floorDist[fl]++;
                occupiedRoomsSet.add(s.doorNumber);
            } else {
                unassignedCount++;
            }

            if (s.branch) {
                branchDist[s.branch] = (branchDist[s.branch] || 0) + 1;
            }

            if (s.year && yearDist[s.year] !== undefined) {
                yearDist[s.year]++;
            }

            if (s.classDiv) {
                divisionDist[s.classDiv] = (divisionDist[s.classDiv] || 0) + 1;
            }
        });

        // Calculate room occupancy distribution
        const roomCounts = {};
        ALL_ROOMS.forEach(r => { roomCounts[r] = 0; });
        students.forEach(s => {
            if (s.doorNumber && isValidRoom(s.doorNumber)) {
                roomCounts[s.doorNumber] = (roomCounts[s.doorNumber] || 0) + 1;
            }
        });

        let vacantRoomsCount = 0;
        let singleOccupancyCount = 0;
        let fullRoomsCount = 0;
        let overCapacityRoomsCount = 0;

        ALL_ROOMS.forEach(r => {
            const cnt = roomCounts[r];
            if (cnt === 0) vacantRoomsCount++;
            else if (cnt === 1) singleOccupancyCount++;
            else if (cnt === MAX_STUDENTS_PER_ROOM) fullRoomsCount++;
            else if (cnt > MAX_STUDENTS_PER_ROOM) overCapacityRoomsCount++;
        });

        res.json({
            overview: {
                totalResidents,
                assignedCount,
                unassignedCount,
                profileCompleteCount,
                profileIncompleteCount,
                emptyRoomsCount: vacantRoomsCount,
                vacantRoomsCount,
                singleOccupancyCount,
                fullRoomsCount,
                overCapacityRoomsCount,
                maxCapacityPerRoom: MAX_STUDENTS_PER_ROOM,
                totalRooms: ALL_ROOMS.length
            },
            floorDistribution: floorDist,
            branchDistribution: branchDist,
            yearDistribution: yearDist,
            divisionDistribution: divisionDist
        });
    } catch (err) {
        logger.error("getResidentReports error:", err);
        res.status(500).json({ message: "Failed to generate reports", error: err.message });
    }
};

// =============================================================================
// 9. GET /api/residents/export — Secure sanitized CSV export
// =============================================================================
exports.exportResidentsCSV = async (req, res) => {
    try {
        const { floor, branch, year, roomStatus, profileStatus } = req.query;

        const filter = { role: "STUDENT" };

        if (floor) {
            const fNum = parseInt(floor, 10);
            if ([1, 2, 3, 4, 5].includes(fNum)) {
                filter.doorNumber = { $in: getRoomsByFloor(fNum) };
            }
        }
        if (branch) filter.branch = String(branch).trim().toUpperCase();
        if (year) filter.year = String(year).trim().toUpperCase();
        if (roomStatus === "assigned") {
            filter.doorNumber = { $exists: true, $nin: [null, ""] };
        } else if (roomStatus === "unassigned") {
            filter.$or = [
                { doorNumber: { $exists: false } },
                { doorNumber: null },
                { doorNumber: "" }
            ];
        }
        if (profileStatus === "complete") filter.profileComplete = true;
        if (profileStatus === "incomplete") filter.profileComplete = false;

        const students = await Student.find(filter)
            .sort({ doorNumber: 1, prn: 1 })
            .lean();

        // Build Excel-compatible CSV content (starts with mandatory 5 template columns, followed by non-sensitive identity fields)
        const headers = [
            "PRN",
            "Branch",
            "Room",
            "Parent Contact Number",
            "Student Contact Number",
            "Full Name",
            "Roll Number",
            "Official College Email",
            "Year",
            "Division",
            "Floor"
        ];
        const rows = [headers.join(",")];

        students.forEach(s => {
            const fl = s.doorNumber ? (getFloorFromRoom(s.doorNumber) || "") : "";
            const rowValues = [
                sanitizeCSVCell(s.prn || ""),
                sanitizeCSVCell(s.branch || ""),
                sanitizeCSVCell(s.doorNumber || ""),
                sanitizeCSVCell(s.guardianPhone || ""),
                sanitizeCSVCell(s.mobileNumber || ""),
                sanitizeCSVCell(s.fullName || s.name || ""),
                sanitizeCSVCell(s.rollNumber || ""),
                sanitizeCSVCell(s.email || ""),
                sanitizeCSVCell(s.year || ""),
                sanitizeCSVCell(s.classDiv || ""),
                sanitizeCSVCell(fl)
            ];
            rows.push(rowValues.join(","));
        });

        // Prefix with UTF-8 Byte Order Mark (\uFEFF) for native Microsoft Excel character decoding
        const csvContent = "\uFEFF" + rows.join("\r\n");

        // Audit the export action
        const admin = await User.findById(req.user.id);
        await ResidentAuditLog.create({
            action: "CSV_EXPORT",
            performedBy: req.user.id,
            adminName: admin ? (admin.name || admin.email) : "Administrator",
            adminRole: req.user.role,
            adminEmail: admin?.email || "",
            details: { recordCount: students.length, filters: req.query },
            ipAddress: req.ip || req.connection?.remoteAddress || ""
        });

        logger.info(`[AUDIT] CSV Export of ${students.length} resident records by ${req.user.role}`);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="hostel_residents_export.csv"');
        res.status(200).send(csvContent);
    } catch (err) {
        logger.error("exportResidentsCSV error:", err);
        res.status(500).json({ message: "Failed to export resident records", error: err.message });
    }
};

// =============================================================================
// 10. GET /api/residents/import-template — Exclusive INCHARGE template download
// =============================================================================
exports.downloadImportTemplate = async (req, res) => {
    try {
        const csvContent = "\uFEFFPRN,Branch,Room,Parent Contact Number,Student Contact Number\r\nf21ce101,CE,101,9820012345,9820054321\r\nf21it102,IT,102,9821012345,9821054321\r\n";
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="resident_import_template.csv"');
        res.status(200).send(csvContent);
    } catch (err) {
        logger.error("downloadImportTemplate error:", err);
        res.status(500).json({ message: "Failed to download template", error: err.message });
    }
};

// =============================================================================
// 11. POST /api/residents/import-preview — Exclusive INCHARGE parse & match (0 DB writes)
// =============================================================================
exports.previewImportResidentsCSV = async (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ message: "No CSV records supplied for preview" });
        }

        const SUPPORTED_BRANCHES = ["CE", "ENTC", "IT", "AIDS", "ECE"];
        const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

        const maskPhoneNumber = (phone) => {
            if (!phone) return "";
            const str = String(phone).replace(/\D/g, "");
            if (str.length < 10) return "••••••••••";
            return `+91 ••••• ••${str.slice(-3)}`;
        };

        // Fetch all existing students by PRN for matching and batch projection
        const existingStudents = await Student.find({ role: "STUDENT" }).lean();
        const studentMapByPRN = new Map();
        existingStudents.forEach(s => {
            if (s.prn) studentMapByPRN.set(s.prn.trim().toLowerCase(), s);
        });

        // Strip initial UTF-8 BOM (\uFEFF) from header keys if present
        const sanitizedRows = rows.map(r => {
            const clean = {};
            for (const [k, v] of Object.entries(r)) {
                clean[k.replace(/^\uFEFF/, "").trim()] = v;
            }
            return clean;
        });

        // Compute projected room occupancy across all 77 rooms
        const { roomProjections, overCapacityRooms } = calculateBatchProjections(sanitizedRows, existingStudents);

        const seenPRNsInFile = new Set();
        const previewRecords = [];
        let roomChangesCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;

        sanitizedRows.forEach((row, index) => {
            const rawPRN = String(row.PRN || row.prn || "").trim();
            const rawBranch = String(row.Branch || row.branch || "").trim().toUpperCase();
            const rawRoom = String(row.Room || row.room || row.doorNumber || row["Room Number"] || "").trim();
            const rawParentPhone = String(row["Parent Contact Number"] || row["Parent Phone"] || row.parentContactNumber || row.guardianPhone || "").trim();
            const rawStudentPhone = String(row["Student Contact Number"] || row["Student Phone"] || row.studentContactNumber || row.mobileNumber || "").trim();

            const recordErrors = [];

            // 1. PRN Validation
            if (!rawPRN) {
                recordErrors.push("Missing required field: PRN");
            } else if (seenPRNsInFile.has(rawPRN.toLowerCase())) {
                recordErrors.push("Duplicate PRN in CSV file");
            } else {
                seenPRNsInFile.add(rawPRN.toLowerCase());
            }

            const matchedStudent = rawPRN ? studentMapByPRN.get(rawPRN.toLowerCase()) : null;
            if (rawPRN && !matchedStudent) {
                recordErrors.push(`No existing student found with PRN ${rawPRN}`);
            }

            // 2. Branch Validation
            if (!rawBranch) {
                recordErrors.push("Missing required field: Branch");
            } else if (!SUPPORTED_BRANCHES.includes(rawBranch)) {
                recordErrors.push(`Invalid branch '${rawBranch}'. Must be one of: ${SUPPORTED_BRANCHES.join(", ")}`);
            }

            // 3. Room Validation
            if (!rawRoom) {
                recordErrors.push("Missing required field: Room");
            } else if (!isValidRoom(rawRoom)) {
                recordErrors.push(`Invalid room '${rawRoom}'. Must be in 77-room inventory (101–509)`);
            } else if (overCapacityRooms.has(rawRoom)) {
                const proj = overCapacityRooms.get(rawRoom);
                recordErrors.push(`Room ${rawRoom} would exceed maximum capacity of ${MAX_STUDENTS_PER_ROOM} students (existing: ${proj.existingOccupancy}, additions: +${proj.proposedAdditions}, removals: -${proj.proposedRemovals}, projected: ${proj.projectedOccupancy})`);
            }

            // 4. Parent Contact Number Validation
            const cleanParentDigits = rawParentPhone.replace(/\D/g, "");
            if (!rawParentPhone) {
                recordErrors.push("Missing required field: Parent Contact Number");
            } else if (!INDIAN_MOBILE_REGEX.test(cleanParentDigits)) {
                recordErrors.push("Invalid Parent Contact Number. Must be a valid 10-digit Indian mobile number (/^[6-9]\\d{9}$/)");
            }

            // 5. Student Contact Number Validation
            const cleanStudentDigits = rawStudentPhone.replace(/\D/g, "");
            if (!rawStudentPhone) {
                recordErrors.push("Missing required field: Student Contact Number");
            } else if (!INDIAN_MOBILE_REGEX.test(cleanStudentDigits)) {
                recordErrors.push("Invalid Student Contact Number. Must be a valid 10-digit Indian mobile number (/^[6-9]\\d{9}$/)");
            }

            const isError = recordErrors.length > 0;
            if (isError) errorCount++;

            let hasRoomChange = false;
            let hasBranchChange = false;
            let hasParentPhoneChange = false;
            let hasStudentPhoneChange = false;

            let currentRoom = null;
            let currentBranch = null;
            let currentParentPhone = null;
            let currentStudentPhone = null;

            if (matchedStudent) {
                currentRoom = matchedStudent.doorNumber || "Unassigned";
                currentBranch = matchedStudent.branch || "Unassigned";
                currentParentPhone = matchedStudent.guardianPhone || null;
                currentStudentPhone = matchedStudent.mobileNumber || null;

                if (rawRoom && rawRoom !== matchedStudent.doorNumber) {
                    hasRoomChange = true;
                    roomChangesCount++;
                }
                if (rawBranch && rawBranch !== matchedStudent.branch) {
                    hasBranchChange = true;
                }
                if (cleanParentDigits && cleanParentDigits !== (matchedStudent.guardianPhone || "")) {
                    hasParentPhoneChange = true;
                }
                if (cleanStudentDigits && cleanStudentDigits !== (matchedStudent.mobileNumber || "")) {
                    hasStudentPhoneChange = true;
                }

                if (!isError && !hasRoomChange && !hasBranchChange && !hasParentPhoneChange && !hasStudentPhoneChange) {
                    unchangedCount++;
                }
            }

            previewRecords.push({
                rowIndex: index + 1,
                prn: rawPRN,
                matchedStudentId: matchedStudent ? matchedStudent._id : null,
                studentName: matchedStudent ? (matchedStudent.fullName || matchedStudent.name) : "—",
                currentRoom,
                newRoom: rawRoom,
                hasRoomChange,
                currentBranch,
                newBranch: rawBranch,
                hasBranchChange,
                currentParentPhoneMasked: maskPhoneNumber(currentParentPhone),
                newParentPhoneMasked: maskPhoneNumber(cleanParentDigits),
                hasParentPhoneChange,
                currentStudentPhoneMasked: maskPhoneNumber(currentStudentPhone),
                newStudentPhoneMasked: maskPhoneNumber(cleanStudentDigits),
                hasStudentPhoneChange,
                cleanData: !isError ? {
                    prn: rawPRN,
                    branch: rawBranch,
                    room: rawRoom,
                    parentPhone: cleanParentDigits,
                    studentPhone: cleanStudentDigits
                } : null,
                isValid: !isError,
                errors: recordErrors
            });
        });

        // PREVIEW ONLY: Does not modify database
        res.json({
            previewId: `prev_${Date.now()}`,
            summary: {
                totalRows: rows.length,
                validRows: rows.length - errorCount,
                roomChangesCount,
                unchangedCount,
                errorCount,
                maxStudentsPerRoom: MAX_STUDENTS_PER_ROOM,
                overCapacityRoomsCount: overCapacityRooms.size
            },
            roomProjections: Array.from(overCapacityRooms.values()),
            records: previewRecords
        });
    } catch (err) {
        logger.error("previewImportResidentsCSV error:", err);
        res.status(500).json({ message: "Failed to parse import preview", error: err.message });
    }
};

// =============================================================================
// 12. POST /api/residents/import-confirm — Exclusive INCHARGE confirmed commit
// =============================================================================
exports.confirmImportResidentsCSV = async (req, res) => {
    try {
        const { records, idempotencyKey } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: "No confirmed records provided to import" });
        }

        const SUPPORTED_BRANCHES = ["CE", "ENTC", "IT", "AIDS", "ECE"];
        const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

        // Prevent accidental duplicate application of the same import
        if (idempotencyKey) {
            const existingImport = await ResidentAuditLog.findOne({
                action: "CSV_IMPORT",
                "details.idempotencyKey": idempotencyKey
            });
            if (existingImport) {
                return res.status(409).json({
                    message: "This import batch has already been applied. Duplicate import prevented.",
                    appliedCount: 0
                });
            }
        }

        const admin = await User.findById(req.user.id);
        const adminName = admin ? (admin.name || admin.email) : "Hostel In-Charge";

        let appliedCount = 0;
        let failedCount = 0;
        const failedDetails = [];

        // Batch projected occupancy validation: reject entire import if any room would exceed 2
        const existingStudents = await Student.find({ role: "STUDENT" }).lean();
        const { overCapacityRooms, isBatchValid } = calculateBatchProjections(records.map(r => r.cleanData || r), existingStudents);

        if (!isBatchValid) {
            const conflictDetails = Array.from(overCapacityRooms.values()).map(o => `Room ${o.roomNumber} (projected: ${o.projectedOccupancy}/${o.maxCapacity})`).join(", ");
            return res.status(400).json({
                message: `Import rejected: One or more rooms would exceed the maximum capacity of ${MAX_STUDENTS_PER_ROOM} students: ${conflictDetails}. Please correct the CSV and generate a new preview.`,
                conflictingRooms: Array.from(overCapacityRooms.values())
            });
        }

        for (const item of records) {
            try {
                const data = item.cleanData || item;
                const prn = String(data.prn || data.PRN || "").trim();
                const branch = String(data.branch || data.Branch || "").trim().toUpperCase();
                const room = String(data.room || data.doorNumber || data.Room || "").trim();
                const parentPhone = String(data.parentPhone || data["Parent Contact Number"] || data.guardianPhone || "").replace(/\D/g, "");
                const studentPhone = String(data.studentPhone || data["Student Contact Number"] || data.mobileNumber || "").replace(/\D/g, "");

                // Validate all 5 required fields strictly
                if (!prn || !branch || !room || !parentPhone || !studentPhone) {
                    failedCount++;
                    failedDetails.push({ prn: prn || "Unknown", error: "Missing required fields" });
                    continue;
                }

                if (!SUPPORTED_BRANCHES.includes(branch)) {
                    failedCount++;
                    failedDetails.push({ prn, error: `Invalid branch ${branch}` });
                    continue;
                }

                if (!isValidRoom(room)) {
                    failedCount++;
                    failedDetails.push({ prn, error: `Invalid room ${room}` });
                    continue;
                }

                if (!INDIAN_MOBILE_REGEX.test(parentPhone)) {
                    failedCount++;
                    failedDetails.push({ prn, error: "Invalid parent contact number" });
                    continue;
                }

                if (!INDIAN_MOBILE_REGEX.test(studentPhone)) {
                    failedCount++;
                    failedDetails.push({ prn, error: "Invalid student contact number" });
                    continue;
                }

                const student = await Student.findOne({ prn, role: "STUDENT" });
                if (!student) {
                    failedCount++;
                    failedDetails.push({ prn, error: "Student not found" });
                    continue;
                }

                // Apply mapped fields:
                student.branch = branch;
                student.guardianPhone = parentPhone;
                student.mobileNumber = studentPhone;
                await student.save();

                // Room reassignment with atomic reservation and history preservation
                if (room !== (student.doorNumber || "")) {
                    await assignStudentRoomAtomic({
                        studentId: student._id,
                        newRoom: room,
                        previousRoom: student.doorNumber || null,
                        adminName,
                        reason: "Bulk CSV Import"
                    });
                }

                appliedCount++;
            } catch (recordErr) {
                failedCount++;
                failedDetails.push({ prn: item.prn || "Unknown", error: recordErr.message });
            }
        }

        // Record audit log for the bulk import (no phone numbers in general log)
        await ResidentAuditLog.create({
            action: "CSV_IMPORT",
            performedBy: req.user.id,
            adminName,
            adminRole: req.user.role,
            adminEmail: admin?.email || "",
            details: {
                totalSubmitted: records.length,
                appliedCount,
                failedCount,
                idempotencyKey: idempotencyKey || null
            },
            ipAddress: req.ip || req.connection?.remoteAddress || ""
        });

        logger.info(`[AUDIT] CSV Bulk Import completed by ${req.user.role} (${adminName}): ${appliedCount} records updated, ${failedCount} errors`);

        res.json({
            message: `Import complete: ${appliedCount} records updated successfully`,
            appliedCount,
            failedCount,
            failedDetails
        });
    } catch (err) {
        logger.error("confirmImportResidentsCSV error:", err);
        res.status(500).json({ message: "Failed to apply bulk import", error: err.message });
    }
};
