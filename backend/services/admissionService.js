const xlsx = require("xlsx");
const { v4: uuidv4 } = require("uuid");
const StudentRoster = require("../models/StudentRoster");
const AdmissionImportBatch = require("../models/AdmissionImportBatch");
const { Student, User } = require("../models/User");
const { isValidRoom, MAX_STUDENTS_PER_ROOM, ALL_ROOMS } = require("../utils/hostelRooms");
const { atomicReserveRoomRoster, atomicReleaseRoomRoster, checkRoomCapacity } = require("./roomOccupancyService");
const { createNotification } = require("./notificationService");
const logger = require("../utils/logger");

const COLUMN_ALIASES = {
    prn: ["prn", "student prn", "registration number", "registration no", "reg no", "student id", "roll prn", "prn number", "prn no"],
    name: ["name", "student name", "full name", "candidate name", "student_name", "fullname", "student's name"],
    rollNumber: ["roll no", "roll number", "university roll number", "class roll no", "roll_no", "rollno", "roll"],
    email: ["email", "official email", "college email", "institutional email", "student email", "mail id", "e-mail", "email id"],
    branch: ["branch", "department", "program", "stream", "dept", "course"],
    year: ["year", "academic year", "current year", "class year", "acad year"],
    division: ["division", "class", "section", "div", "class div", "div/section"],
    doorNumber: ["room", "room no", "door number", "door no", "hostel room", "allocated room", "room_no", "room assigned", "bed room", "room id"],
    studentMobile: ["mobile", "student phone", "phone number", "contact number", "student mobile", "mobile no", "student contact", "phone", "student mobile number", "student cell"],
    parentMobile: ["parent phone", "guardian mobile", "parent contact", "guardian contact", "father mobile", "mother mobile", "parent no", "guardian phone", "parent mobile", "parent cell"]
};

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Clean and normalize phone numbers (strips +91, 0, spaces, dashes)
 */
function normalizePhone(val) {
    if (!val) return "";
    let clean = String(val).trim().replace(/[\s\-\(\)\.]/g, "");
    if (clean.startsWith("+91")) clean = clean.substring(3);
    else if (clean.startsWith("91") && clean.length === 12) clean = clean.substring(2);
    else if (clean.startsWith("0") && clean.length === 11) clean = clean.substring(1);
    return clean;
}

/**
 * Detect column mappings from a header row
 */
function autoDetectColumns(headers) {
    const mappings = {};
    const unmapped = [];

    const normHeaders = headers.map(h => String(h || "").trim().toLowerCase());

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        let matchedIndex = -1;
        for (let i = 0; i < normHeaders.length; i++) {
            const h = normHeaders[i];
            if (aliases.includes(h) || aliases.some(alias => h.includes(alias))) {
                matchedIndex = i;
                break;
            }
        }
        if (matchedIndex !== -1) {
            mappings[field] = headers[matchedIndex];
        }
    }

    // Collect unrecognized columns
    const mappedHeaderValues = Object.values(mappings);
    for (const h of headers) {
        if (!mappedHeaderValues.includes(h)) {
            unmapped.push(h);
        }
    }

    return { mappings, unmapped };
}

/**
 * Read workbook worksheets and return sheet names
 */
function getWorksheetNames(buffer) {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    return workbook.SheetNames;
}

/**
 * Parses a selected worksheet from workbook buffer and detects header row
 */
function parseWorksheetData(buffer, sheetName = null) {
    // Disable cell formula evaluation to mitigate Excel formula injection attacks
    const workbook = xlsx.read(buffer, { type: "buffer", cellFormula: false, cellHTML: false });
    const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
        ? sheetName
        : workbook.SheetNames[0];

    const worksheet = workbook.Sheets[targetSheet];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });

    if (!rawRows || rawRows.length === 0) {
        throw new Error("The selected worksheet is empty");
    }

    const MAX_ROSTER_IMPORT_ROWS = 1500;
    if (rawRows.length > MAX_ROSTER_IMPORT_ROWS) {
        throw new Error(`Workbook contains ${rawRows.length} rows, which exceeds the maximum security limit of ${MAX_ROSTER_IMPORT_ROWS} rows.`);
    }

    // Detect header row by scanning first 10 rows
    let headerRowIndex = 0;
    let maxMatchCount = 0;

    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r].map(c => String(c).trim().toLowerCase());
        let matches = 0;
        for (const aliases of Object.values(COLUMN_ALIASES)) {
            if (row.some(c => aliases.includes(c) || aliases.some(a => c.includes(a)))) {
                matches++;
            }
        }
        if (matches > maxMatchCount) {
            maxMatchCount = matches;
            headerRowIndex = r;
        }
    }

    const headers = rawRows[headerRowIndex].map(c => String(c).trim()).filter(Boolean);
    const dataRows = rawRows.slice(headerRowIndex + 1).filter(r => r.some(c => String(c).trim() !== ""));

    return {
        sheetName: targetSheet,
        headers,
        dataRows,
        headerRowIndex
    };
}

/**
 * Calculate active room occupancy:
 * Registered students in room + Approved (not yet registered) roster students in room
 */
async function getCurrentRoomOccupancyMap() {
    const occMap = {};
    ALL_ROOMS.forEach(r => { occMap[r] = 0; });

    // 1. Registered students
    const regStudents = await Student.aggregate([
        { $match: { role: "STUDENT", doorNumber: { $exists: true, $nin: [null, ""] } } },
        { $group: { _id: "$doorNumber", count: { $sum: 1 } } }
    ]);
    regStudents.forEach(item => {
        if (occMap[item._id] !== undefined) {
            occMap[item._id] = item.count;
        }
    });

    // 2. Approved un-registered roster students
    const approvedRoster = await StudentRoster.aggregate([
        {
            $match: {
                admissionStatus: "APPROVED",
                registrationStatus: { $ne: "REGISTERED" },
                doorNumber: { $exists: true, $nin: [null, ""] }
            }
        },
        { $group: { _id: "$doorNumber", count: { $sum: 1 } } }
    ]);
    approvedRoster.forEach(item => {
        if (occMap[item._id] !== undefined) {
            occMap[item._id] = (occMap[item._id] || 0) + item.count;
        }
    });

    return occMap;
}

/**
 * Generate dry-run preview for an uploaded Excel roster
 * ZERO database writes!
 */
async function generateImportPreview({ buffer, sheetName = null, customMappings = null, mode = "ADD_UPDATE" }) {
    const { sheetName: targetSheet, headers, dataRows } = parseWorksheetData(buffer, sheetName);
    const auto = autoDetectColumns(headers);
    const mappings = customMappings || auto.mappings;

    const currentOccupancy = await getCurrentRoomOccupancyMap();
    const projectedOccupancy = { ...currentOccupancy };

    const parsedRows = [];
    const seenPRNs = new Set();
    const seenEmails = new Set();

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let existingMatchedCount = 0;
    let newCandidateCount = 0;

    // Prefetch existing database records for fast lookup
    const allExistingStudents = await Student.find({}, "prn email doorNumber fullName").lean();
    const allExistingRoster = await StudentRoster.find({}, "prn email doorNumber admissionStatus registrationStatus").lean();

    const existingStudentByPRN = new Map(allExistingStudents.map(s => [s.prn?.toUpperCase(), s]));
    const existingStudentByEmail = new Map(allExistingStudents.map(s => [s.email?.toLowerCase(), s]));
    const existingRosterByPRN = new Map(allExistingRoster.map(r => [r.prn?.toUpperCase(), r]));
    const existingRosterByEmail = new Map(allExistingRoster.map(r => [r.email?.toLowerCase(), r]));

    // Map rows to objects
    for (let i = 0; i < dataRows.length; i++) {
        const raw = dataRows[i];
        const rowObj = {};
        headers.forEach((h, idx) => {
            rowObj[h] = raw[idx] !== undefined ? String(raw[idx]).trim() : "";
        });

        // Extract fields using mappings
        const prn = String(rowObj[mappings.prn] || "").trim().toUpperCase();
        const name = String(rowObj[mappings.name] || "").trim();
        const rollNumber = String(rowObj[mappings.rollNumber] || "").trim();
        const email = String(rowObj[mappings.email] || "").trim().toLowerCase();
        const branch = String(rowObj[mappings.branch] || "").trim().toUpperCase();
        const rawYear = String(rowObj[mappings.year] || "").trim().toUpperCase();
        const division = String(rowObj[mappings.division] || "").trim();
        const doorNumber = String(rowObj[mappings.doorNumber] || "").trim();
        const studentMobile = normalizePhone(rowObj[mappings.studentMobile]);
        const parentMobile = normalizePhone(rowObj[mappings.parentMobile]);

        let year = "FY";
        if (["FY", "FIRST YEAR", "1", "1ST"].includes(rawYear)) year = "FY";
        else if (["SY", "SECOND YEAR", "2", "2ND"].includes(rawYear)) year = "SY";
        else if (["TY", "THIRD YEAR", "3", "3RD"].includes(rawYear)) year = "TY";

        const errors = [];

        // 1. Mandatory Identity Validations
        if (!prn) errors.push("PRN is required");
        if (!name) errors.push("Student name is required");
        if (!rollNumber) errors.push("Roll number is required");
        if (!email) {
            errors.push("Email is required");
        } else if (!email.endsWith("@ms.pict.edu")) {
            errors.push("Official college email must end with @ms.pict.edu");
        }
        if (!branch) errors.push("Branch is required");

        // 2. Contact Validations
        if (!studentMobile) {
            errors.push("Student mobile number is required");
        } else if (!INDIAN_MOBILE_REGEX.test(studentMobile)) {
            errors.push("Student mobile must be a valid 10-digit Indian number (/^[6-9]\\d{9}$/)");
        }

        if (!parentMobile) {
            errors.push("Parent/Guardian contact number is required");
        } else if (!INDIAN_MOBILE_REGEX.test(parentMobile)) {
            errors.push("Parent/Guardian contact must be a valid 10-digit Indian number (/^[6-9]\\d{9}$/)");
        }

        // 3. Room Validation
        if (!doorNumber) {
            errors.push("Hostel room allocation is required");
        } else if (!isValidRoom(doorNumber)) {
            errors.push(`Room ${doorNumber} is invalid (must be one of 77 rooms: 101–117, 201–217, 301–317, 401–417, 501–509)`);
        }

        // 4. Duplicate checks within workbook
        if (prn && seenPRNs.has(prn)) {
            errors.push(`Duplicate PRN '${prn}' found within this spreadsheet`);
            duplicateCount++;
        }
        if (email && seenEmails.has(email)) {
            errors.push(`Duplicate email '${email}' found within this spreadsheet`);
            duplicateCount++;
        }
        if (prn) seenPRNs.add(prn);
        if (email) seenEmails.add(email);

        // 5. Cross-conflict checks with existing DB records
        const existingStudent = existingStudentByPRN.get(prn);
        const existingStudentEmail = existingStudentByEmail.get(email);
        if (existingStudent && existingStudent.email !== email) {
            errors.push(`PRN '${prn}' belongs to another existing student (${existingStudent.email})`);
        }
        if (existingStudentEmail && existingStudentEmail.prn !== prn) {
            errors.push(`Email '${email}' belongs to another existing student with PRN ${existingStudentEmail.prn}`);
        }

        const isExisting = !!(existingStudent || existingRosterByPRN.get(prn) || existingRosterByEmail.get(email));
        if (isExisting) existingMatchedCount++;
        else newCandidateCount++;

        // 6. Projected Room Capacity Check
        if (doorNumber && isValidRoom(doorNumber) && errors.length === 0) {
            const projected = (projectedOccupancy[doorNumber] || 0) + 1;
            projectedOccupancy[doorNumber] = projected;
            if (projected > MAX_STUDENTS_PER_ROOM) {
                errors.push(`Room ${doorNumber} will exceed maximum capacity of ${MAX_STUDENTS_PER_ROOM} students (projected: ${projected})`);
            }
        }

        const isValid = errors.length === 0;
        if (isValid) validCount++;
        else invalidCount++;

        parsedRows.push({
            rowNumber: i + 1,
            data: {
                prn,
                name,
                rollNumber,
                email,
                branch,
                year,
                division,
                doorNumber,
                studentMobile,
                parentMobile
            },
            isValid,
            isExisting,
            errors
        });
    }

    const overCapacityRooms = Object.entries(projectedOccupancy)
        .filter(([_, count]) => count > MAX_STUDENTS_PER_ROOM)
        .map(([room, count]) => ({
            room,
            current: currentOccupancy[room] || 0,
            projected: count,
            max: MAX_STUDENTS_PER_ROOM
        }));

    // Mode B: Full Roster Sync — identify active approved students absent from this workbook
    let missingStudents = [];
    if (mode === "FULL_SYNC") {
        const activeApprovedRoster = await StudentRoster.find(
            { admissionStatus: { $in: ["APPROVED", "PENDING_APPROVAL"] } },
            "name prn rollNumber email doorNumber admissionStatus registrationStatus"
        ).lean();

        missingStudents = activeApprovedRoster.filter(r => {
            const emailMatch = r.email && seenEmails.has(r.email.toLowerCase());
            const prnMatch = r.prn && seenPRNs.has(r.prn.toUpperCase());
            return !emailMatch && !prnMatch;
        });
    }

    return {
        sheetName: targetSheet,
        headers,
        mappings,
        unmappedColumns: auto.unmapped,
        mode,
        summary: {
            totalRows: dataRows.length,
            validCount,
            invalidCount,
            duplicateCount,
            existingMatchedCount,
            newCandidateCount,
            missingCount: missingStudents.length,
            overCapacityCount: overCapacityRooms.length
        },
        overCapacityRooms,
        missingStudents,
        rows: parsedRows
    };
}

/**
 * Commit validated roster rows to the database.
 * Supports autoApprove = true ("Import and Approve Selected Valid Records")
 * or autoApprove = false ("Import as Pending Approval").
 * Additive: never revokes or deletes missing rows!
 */
async function commitRosterImport({
    parsedRows,
    autoApprove = false,
    batchMeta = {},
    actor = { id: null, name: "Administrator", role: "HEADWARDEN" },
    mode = "ADD_UPDATE",
    confirmRevokeMissing = false
}) {
    const batchId = `BATCH-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let updatedCount = 0;
    const committedIds = [];

    // Filter to valid rows only
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
        throw new Error("No valid records to import");
    }

    // Revalidate concurrency-safe room capacity if auto-approving
    if (autoApprove) {
        const occMap = await getCurrentRoomOccupancyMap();
        for (const row of validRows) {
            const room = row.data.doorNumber;
            if ((occMap[room] || 0) + 1 > MAX_STUDENTS_PER_ROOM) {
                throw new Error(`Room capacity conflict: Room ${room} would exceed limit of ${MAX_STUDENTS_PER_ROOM} students upon approval`);
            }
            occMap[room] = (occMap[room] || 0) + 1;
        }
    }

    // Save batch record first
    const importBatch = new AdmissionImportBatch({
        batchId,
        originalFileName: batchMeta.originalFileName || "student_roster.xlsx",
        worksheetName: batchMeta.worksheetName || "Sheet1",
        uploadedBy: {
            id: actor.id,
            name: actor.name,
            role: actor.role
        },
        columnMappings: batchMeta.mappings || {},
        totalRows: parsedRows.length,
        validRows: validRows.length,
        invalidRows: parsedRows.length - validRows.length,
        approvedRows: autoApprove ? validRows.length : 0,
        rejectedRows: 0,
        updatedRecords: 0,
        outcome: "COMPLETED",
        notes: batchMeta.notes || (autoApprove ? "Imported and approved directly" : "Imported as pending approval")
    });
    await importBatch.save();

    for (const row of validRows) {
        const d = row.data;
        const initialStatus = autoApprove ? "APPROVED" : "PENDING_APPROVAL";

        let roster = await StudentRoster.findOne({
            $or: [{ prn: d.prn }, { email: d.email }]
        });

        // Link with existing User account if one already exists
        const matchedUser = await Student.findOne({
            $or: [{ prn: d.prn }, { email: d.email }]
        });

        if (roster) {
            // Additive update
            roster.name = d.name;
            roster.rollNumber = d.rollNumber;
            roster.branch = d.branch;
            roster.year = d.year;
            roster.division = d.division;
            roster.doorNumber = d.doorNumber;
            roster.studentMobile = d.studentMobile;
            roster.parentMobile = d.parentMobile;
            roster.importBatchId = importBatch._id;

            if (autoApprove) {
                const res = await atomicReserveRoomRoster({ roomNumber: d.doorNumber, rosterId: roster._id });
                if (res.success) {
                    roster.statusHistory.push({
                        fromStatus: roster.admissionStatus,
                        toStatus: "APPROVED",
                        changedBy: actor,
                        reason: "Approved via batch import",
                        timestamp: new Date()
                    });
                    roster.admissionStatus = "APPROVED";
                    approvedCount++;
                } else {
                    roster.statusHistory.push({
                        fromStatus: roster.admissionStatus,
                        toStatus: "PENDING_APPROVAL",
                        changedBy: actor,
                        reason: `Auto-approval skipped: ${res.message}`,
                        timestamp: new Date()
                    });
                    roster.admissionStatus = "PENDING_APPROVAL";
                    pendingCount++;
                }
            }

            if (matchedUser) {
                roster.userId = matchedUser._id;
                roster.registrationStatus = matchedUser.profileComplete ? "REGISTERED" : "REGISTRATION_STARTED";
            }

            roster.auditTrail.push({
                action: "ROSTER_UPDATED_FROM_IMPORT",
                performedBy: actor,
                details: { batchId, autoApprove },
                timestamp: new Date()
            });

            await roster.save();
            updatedCount++;
            committedIds.push(roster._id);
        } else {
            // New roster entry
            roster = new StudentRoster({
                prn: d.prn,
                name: d.name,
                rollNumber: d.rollNumber,
                email: d.email,
                branch: d.branch,
                year: d.year,
                division: d.division,
                doorNumber: d.doorNumber,
                studentMobile: d.studentMobile,
                parentMobile: d.parentMobile,
                admissionStatus: "PENDING_APPROVAL",
                registrationStatus: matchedUser ? (matchedUser.profileComplete ? "REGISTERED" : "REGISTRATION_STARTED") : "NOT_REGISTERED",
                userId: matchedUser ? matchedUser._id : null,
                importBatchId: importBatch._id,
                statusHistory: [{
                    fromStatus: "NONE",
                    toStatus: "PENDING_APPROVAL",
                    changedBy: actor,
                    reason: autoApprove ? "Uploaded via roster import (pending atomic reservation)" : "Uploaded via roster import",
                    timestamp: new Date()
                }],
                auditTrail: [{
                    action: "ROSTER_CREATED_FROM_IMPORT",
                    performedBy: actor,
                    details: { batchId, initialStatus: "PENDING_APPROVAL" },
                    timestamp: new Date()
                }]
            });

            await roster.save();

            if (autoApprove) {
                const res = await atomicReserveRoomRoster({ roomNumber: d.doorNumber, rosterId: roster._id });
                if (res.success) {
                    roster.admissionStatus = "APPROVED";
                    roster.statusHistory.push({
                        fromStatus: "PENDING_APPROVAL",
                        toStatus: "APPROVED",
                        changedBy: actor,
                        reason: "Imported and approved directly",
                        timestamp: new Date()
                    });
                    await roster.save();
                    approvedCount++;
                } else {
                    pendingCount++;
                }
            } else {
                pendingCount++;
            }

            committedIds.push(roster._id);
        }
    }

    importBatch.approvedRows = approvedCount;
    importBatch.updatedRecords = updatedCount;

    let revokedMissingCount = 0;
    const revokedMissingStudents = [];

    // Mode B: Full Roster Sync — Revoke active approved students missing from the imported workbook
    if (mode === "FULL_SYNC" && confirmRevokeMissing) {
        const uploadedEmails = new Set(validRows.map(r => r.data.email.toLowerCase()));
        const uploadedPRNs = new Set(validRows.map(r => r.data.prn.toUpperCase()));

        const activeRoster = await StudentRoster.find({
            admissionStatus: { $in: ["APPROVED", "PENDING_APPROVAL"] }
        });

        for (const record of activeRoster) {
            const isPresent = uploadedEmails.has(record.email.toLowerCase()) || uploadedPRNs.has(record.prn.toUpperCase());
            if (!isPresent) {
                const prev = record.admissionStatus;
                record.admissionStatus = "REVOKED";
                record.rejectionReason = "Revoked via Full Roster Sync (absent from latest official uploaded roster)";
                record.statusHistory.push({
                    fromStatus: prev,
                    toStatus: "REVOKED",
                    changedBy: actor,
                    reason: "Revoked via Full Roster Sync",
                    timestamp: new Date()
                });
                record.auditTrail.push({
                    action: "FULL_SYNC_BULK_REVOKED",
                    performedBy: actor,
                    details: { batchId, previousStatus: prev },
                    timestamp: new Date()
                });
                await record.save({ validateModifiedOnly: true });

                if (prev === "APPROVED" && record.doorNumber) {
                    await atomicReleaseRoomRoster({ roomNumber: record.doorNumber, rosterId: record._id });
                }

                if (record.email) {
                    await Student.updateMany(
                        { email: record.email.toLowerCase() },
                        { $set: { isVerified: false } }
                    );
                }

                revokedMissingCount++;
                revokedMissingStudents.push({ id: record._id, prn: record.prn, email: record.email, name: record.name });
            }
        }

        importBatch.notes = (importBatch.notes || "") + ` [Full Roster Sync: ${revokedMissingCount} absent students revoked]`;
    }

    await importBatch.save();

    // Trigger administrative notifications for HEADWARDEN and INCHARGE
    await createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Student Roster Import Completed",
        message: `${actor.name} (${actor.role}) imported ${validRows.length} students (${approvedCount} approved, ${pendingCount} pending${revokedMissingCount > 0 ? `, ${revokedMissingCount} revoked via full sync` : ""}). Batch ID: ${batchId}`,
        category: "ADMISSION",
        priority: "MEDIUM",
        entityType: "import",
        entityId: batchId,
        metadata: { batchId, total: validRows.length, approved: approvedCount, pending: pendingCount, revokedMissing: revokedMissingCount }
    });

    return {
        batchId,
        mode,
        totalCommitted: committedIds.length,
        approvedCount,
        pendingCount,
        updatedCount,
        revokedMissingCount,
        revokedMissingStudents
    };
}

/**
 * Approve single or batch of roster records
 */
async function approveRosterRecords(rosterIds, actor, reason = "Approved by Administrator") {
    const ids = Array.isArray(rosterIds) ? rosterIds : [rosterIds];
    const records = await StudentRoster.find({ _id: { $in: ids } });

    const approved = [];
    const skipped = [];

    for (const record of records) {
        if (record.admissionStatus === "APPROVED") {
            skipped.push({ id: record._id, prn: record.prn, reason: "Already approved" });
            continue;
        }

        const room = record.doorNumber;
        // Concurrency-safe atomic single-document slot reservation
        const reservation = await atomicReserveRoomRoster({ roomNumber: room, rosterId: record._id });
        if (!reservation.success) {
            skipped.push({
                id: record._id,
                prn: record.prn,
                reason: reservation.message || `Room ${room} has reached maximum capacity of ${MAX_STUDENTS_PER_ROOM} students`
            });
            continue;
        }

        const prev = record.admissionStatus;
        record.admissionStatus = "APPROVED";
        record.rejectionReason = "";
        record.statusHistory.push({
            fromStatus: prev,
            toStatus: "APPROVED",
            changedBy: actor,
            reason,
            timestamp: new Date()
        });
        record.auditTrail.push({
            action: "ADMISSION_APPROVED",
            performedBy: actor,
            details: { previousStatus: prev, reason },
            timestamp: new Date()
        });

        await record.save();
        approved.push(record);
    }

    if (approved.length > 0) {
        await createNotification({
            recipientRole: "ADMISSION_ADMINS",
            title: "Student Admissions Approved",
            message: `${actor.name} approved registration eligibility for ${approved.length} student(s).`,
            category: "ADMISSION",
            priority: "LOW",
            entityType: "admission",
            entityId: approved[0]._id.toString(),
            metadata: { count: approved.length, approvedPRNs: approved.map(a => a.prn) }
        });
    }

    return { approvedCount: approved.length, skippedCount: skipped.length, skipped };
}

/**
 * Reject single or batch of roster records
 */
async function rejectRosterRecords(rosterIds, actor, reason = "Rejected by Administrator") {
    const ids = Array.isArray(rosterIds) ? rosterIds : [rosterIds];
    const records = await StudentRoster.find({ _id: { $in: ids } });

    const rejected = [];

    for (const record of records) {
        const prev = record.admissionStatus;
        record.admissionStatus = "REJECTED";
        record.rejectionReason = reason;
        record.statusHistory.push({
            fromStatus: prev,
            toStatus: "REJECTED",
            changedBy: actor,
            reason,
            timestamp: new Date()
        });
        record.auditTrail.push({
            action: "ADMISSION_REJECTED",
            performedBy: actor,
            details: { previousStatus: prev, reason },
            timestamp: new Date()
        });

        await record.save();

        // Release atomic room reservation if student was previously approved
        if (prev === "APPROVED" && record.doorNumber) {
            await atomicReleaseRoomRoster({ roomNumber: record.doorNumber, rosterId: record._id });
        }

        rejected.push(record);
    }

    if (rejected.length > 0) {
        await createNotification({
            recipientRole: "ADMISSION_ADMINS",
            title: "Student Admissions Rejected",
            message: `${actor.name} rejected ${rejected.length} student admission application(s). Reason: ${reason}`,
            category: "ADMISSION",
            priority: "LOW",
            entityType: "admission",
            entityId: rejected[0]._id.toString(),
            metadata: { count: rejected.length, reason }
        });
    }

    return { rejectedCount: rejected.length };
}

/**
 * Revoke student registration eligibility
 */
async function revokeRosterEligibility(rosterId, actor, reason) {
    if (!reason || !reason.trim()) {
        throw new Error("A specific reason is required to revoke registration eligibility");
    }

    const record = await StudentRoster.findById(rosterId);
    if (!record) {
        throw new Error("Roster record not found");
    }

    const prev = record.admissionStatus;
    record.admissionStatus = "REVOKED";
    record.rejectionReason = reason.trim();
    record.statusHistory.push({
        fromStatus: prev,
        toStatus: "REVOKED",
        changedBy: actor,
        reason: reason.trim(),
        timestamp: new Date()
    });
    record.auditTrail.push({
        action: "ELIGIBILITY_REVOKED",
        performedBy: actor,
        details: { previousStatus: prev, reason: reason.trim() },
        timestamp: new Date()
    });

    await record.save();

    // Release atomic room reservation if student was previously approved
    if (prev === "APPROVED" && record.doorNumber) {
        await atomicReleaseRoomRoster({ roomNumber: record.doorNumber, rosterId: record._id });
    }

    // If a linked Student user account exists, de-authorize active access
    if (record.email) {
        await Student.updateMany(
            { email: record.email.toLowerCase() },
            { $set: { isVerified: false } }
        );
    }

    await createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Student Registration Eligibility Revoked",
        message: `${actor.name} revoked eligibility for ${record.name} (PRN: ${record.prn}). Reason: ${reason}`,
        category: "ADMISSION",
        priority: "HIGH",
        entityType: "admission",
        entityId: record._id.toString(),
        metadata: { prn: record.prn, email: record.email, reason }
    });

    return record;
}

/**
 * Restore student registration eligibility
 */
async function restoreRosterEligibility(rosterId, actor, reason = "Eligibility restored after administrative review") {
    const record = await StudentRoster.findById(rosterId);
    if (!record) {
        throw new Error("Roster record not found");
    }

    const room = record.doorNumber;
    // Concurrency-safe atomic reservation check
    const reservation = await atomicReserveRoomRoster({ roomNumber: room, rosterId: record._id });
    if (!reservation.success) {
        throw new Error(reservation.message || `Cannot restore eligibility: Allocated Room ${room} is currently at full capacity (${MAX_STUDENTS_PER_ROOM} students)`);
    }

    const prev = record.admissionStatus;
    record.admissionStatus = "APPROVED";
    record.rejectionReason = "";
    record.statusHistory.push({
        fromStatus: prev,
        toStatus: "APPROVED",
        changedBy: actor,
        reason,
        timestamp: new Date()
    });
    record.auditTrail.push({
        action: "ELIGIBILITY_RESTORED",
        performedBy: actor,
        details: { previousStatus: prev, reason },
        timestamp: new Date()
    });

    await record.save();

    // Re-verify linked Student user account if present
    if (record.email) {
        await Student.updateMany(
            { email: record.email.toLowerCase() },
            { $set: { isVerified: true } }
        );
    }

    await createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Student Registration Eligibility Restored",
        message: `${actor.name} restored registration eligibility for ${record.name} (PRN: ${record.prn}).`,
        category: "ADMISSION",
        priority: "MEDIUM",
        entityType: "admission",
        entityId: record._id.toString(),
        metadata: { prn: record.prn, email: record.email, reason }
    });

    return record;
}

/**
 * Manually add an individual student to the roster
 */
async function addManualStudent({ studentData, actor }) {
    let {
        name,
        email,
        prn,
        rollNumber = "",
        branch = "",
        year = "FY",
        division = "",
        doorNumber = "",
        studentMobile = "",
        parentMobile = "",
        admissionStatus = "APPROVED",
        reason = "Manually registered by Administrator"
    } = studentData;

    if (!name || !name.trim()) throw new Error("Student name is required");
    if (!email || !email.trim()) throw new Error("Official email is required");
    if (!prn || !prn.trim()) throw new Error("PRN is required");

    email = email.toLowerCase().trim();
    prn = prn.toUpperCase().trim();

    if (!rollNumber || !String(rollNumber).trim()) {
        rollNumber = prn.replace(/\D/g, "") || prn;
    }
    if (!branch || !branch.trim()) {
        const branchMatch = prn.match(/^F\d{2}([A-Z]+)/i);
        const branchCode = branchMatch ? branchMatch[1].toUpperCase() : "";
        const branchMap = { CE: "CE", ET: "ENTC", ENTC: "ENTC", IT: "IT", AD: "AIDS", AIDS: "AIDS", EC: "ECE", ECE: "ECE" };
        branch = branchMap[branchCode] || "CE";
    }

    if (!email.endsWith("@ms.pict.edu")) {
        throw new Error("Only official PICT emails (@ms.pict.edu) are allowed");
    }

    // Duplicate check in StudentRoster
    const existingRosterEmail = await StudentRoster.findOne({ email });
    if (existingRosterEmail) {
        throw new Error(`Email '${email}' is already registered in the roster (PRN: ${existingRosterEmail.prn})`);
    }
    const existingRosterPRN = await StudentRoster.findOne({ prn });
    if (existingRosterPRN) {
        throw new Error(`PRN '${prn}' is already registered in the roster (${existingRosterPRN.email})`);
    }

    // Duplicate check in User collection
    const existingUserEmail = await User.findOne({ email });
    if (existingUserEmail) {
        throw new Error(`Email '${email}' is already associated with an existing system account (${existingUserEmail.role})`);
    }
    const existingUserPRN = await Student.findOne({ prn });
    if (existingUserPRN) {
        throw new Error(`PRN '${prn}' is already associated with an existing student user`);
    }

    // Validate doorNumber if provided
    if (doorNumber) {
        doorNumber = String(doorNumber).trim();
        if (!isValidRoom(doorNumber)) {
            throw new Error(`Room '${doorNumber}' is invalid. Must be one of 77 rooms (101–117, 201–217, 301–317, 401–417, 501–509)`);
        }
        if (admissionStatus === "APPROVED") {
            const capCheck = await checkRoomCapacity(doorNumber);
            if (!capCheck.allowed) {
                throw new Error(`Room capacity conflict: ${capCheck.message}`);
            }
        }
    } else {
        doorNumber = "";
    }

    // Validate phone numbers if provided
    if (studentMobile) {
        studentMobile = normalizePhone(studentMobile);
        if (studentMobile && !INDIAN_MOBILE_REGEX.test(studentMobile)) {
            throw new Error("Student mobile number must be a valid 10-digit Indian number");
        }
    }
    if (parentMobile) {
        parentMobile = normalizePhone(parentMobile);
        if (parentMobile && !INDIAN_MOBILE_REGEX.test(parentMobile)) {
            throw new Error("Parent contact number must be a valid 10-digit Indian number");
        }
    }

    const roster = new StudentRoster({
        prn,
        name: name.trim(),
        rollNumber: rollNumber ? String(rollNumber).trim() : "",
        email,
        branch: branch ? branch.toUpperCase().trim() : "",
        year: year ? year.toUpperCase().trim() : "FY",
        division: division ? String(division).trim() : "",
        doorNumber: doorNumber || null,
        studentMobile: studentMobile || "",
        parentMobile: parentMobile || "",
        admissionStatus: admissionStatus || "APPROVED",
        registrationStatus: "NOT_REGISTERED",
        rejectionReason: "",
        statusHistory: [{
            fromStatus: "NONE",
            toStatus: admissionStatus || "APPROVED",
            changedBy: actor,
            reason: reason.trim(),
            timestamp: new Date()
        }],
        auditTrail: [{
            action: "MANUAL_STUDENT_ADDED",
            performedBy: actor,
            details: { name: name.trim(), prn, email, doorNumber, initialStatus: admissionStatus },
            timestamp: new Date()
        }]
    });

    await roster.save();

    // If approved and room allocated, reserve atomically
    if (doorNumber && (admissionStatus === "APPROVED")) {
        await atomicReserveRoomRoster({ roomNumber: doorNumber, rosterId: roster._id });
    }

    await createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Student Manually Added to Roster",
        message: `${actor.name} (${actor.role}) manually registered ${roster.name} (${roster.prn}) to the hostel roster.`,
        category: "ADMISSION",
        priority: "LOW",
        entityType: "admission",
        entityId: roster._id.toString(),
        metadata: { prn, email, actor: actor.name }
    });

    return roster;
}

/**
 * Edit student information in the roster
 */
async function updateStudentRosterDetails({ rosterId, updateData, actor }) {
    const record = await StudentRoster.findById(rosterId);
    if (!record) {
        throw new Error("Roster record not found");
    }

    const {
        name,
        rollNumber,
        branch,
        year,
        division,
        doorNumber,
        studentMobile,
        parentMobile
    } = updateData;

    const changedFields = {};

    if (name !== undefined && name.trim() && name.trim() !== record.name) {
        changedFields.name = { from: record.name, to: name.trim() };
        record.name = name.trim();
    }
    if (rollNumber !== undefined && String(rollNumber).trim() !== record.rollNumber) {
        changedFields.rollNumber = { from: record.rollNumber, to: String(rollNumber).trim() };
        record.rollNumber = String(rollNumber).trim();
    }
    if (branch !== undefined && branch.trim().toUpperCase() !== record.branch) {
        changedFields.branch = { from: record.branch, to: branch.trim().toUpperCase() };
        record.branch = branch.trim().toUpperCase();
    }
    if (year !== undefined && year.trim().toUpperCase() !== record.year) {
        changedFields.year = { from: record.year, to: year.trim().toUpperCase() };
        record.year = year.trim().toUpperCase();
    }
    if (division !== undefined && String(division).trim() !== record.division) {
        changedFields.division = { from: record.division, to: String(division).trim() };
        record.division = String(division).trim();
    }
    if (studentMobile !== undefined) {
        const cleanMob = normalizePhone(studentMobile);
        if (cleanMob && !INDIAN_MOBILE_REGEX.test(cleanMob)) {
            throw new Error("Student mobile number must be a valid 10-digit Indian number");
        }
        if (cleanMob !== record.studentMobile) {
            changedFields.studentMobile = { from: record.studentMobile, to: cleanMob };
            record.studentMobile = cleanMob;
        }
    }
    if (parentMobile !== undefined) {
        const cleanParent = normalizePhone(parentMobile);
        if (cleanParent && !INDIAN_MOBILE_REGEX.test(cleanParent)) {
            throw new Error("Parent mobile number must be a valid 10-digit Indian number");
        }
        if (cleanParent !== record.parentMobile) {
            changedFields.parentMobile = { from: record.parentMobile, to: cleanParent };
            record.parentMobile = cleanParent;
        }
    }

    // Handle room changes
    if (doorNumber !== undefined) {
        const cleanRoom = doorNumber ? String(doorNumber).trim() : null;
        if (cleanRoom && !isValidRoom(cleanRoom)) {
            throw new Error(`Room '${cleanRoom}' is invalid. Must be one of 77 rooms (101–117, 201–217, 301–317, 401–417, 501–509)`);
        }
        if (cleanRoom !== record.doorNumber) {
            // Check capacity for new room if student is currently approved
            if (cleanRoom && record.admissionStatus === "APPROVED") {
                const capCheck = await checkRoomCapacity(cleanRoom);
                if (!capCheck.allowed) {
                    throw new Error(`Room capacity conflict: ${capCheck.message}`);
                }
            }

            // Release previous room reservation
            if (record.doorNumber && record.admissionStatus === "APPROVED") {
                await atomicReleaseRoomRoster({ roomNumber: record.doorNumber, rosterId: record._id });
            }

            // Reserve new room
            if (cleanRoom && record.admissionStatus === "APPROVED") {
                await atomicReserveRoomRoster({ roomNumber: cleanRoom, rosterId: record._id });
            }

            changedFields.doorNumber = { from: record.doorNumber, to: cleanRoom };
            record.doorNumber = cleanRoom;
        }
    }

    if (Object.keys(changedFields).length === 0) {
        return record; // No changes
    }

    record.auditTrail.push({
        action: "STUDENT_DETAILS_UPDATED",
        performedBy: actor,
        details: { changes: changedFields },
        timestamp: new Date()
    });

    await record.save();

    // Synchronize to Student User model if account exists
    const matchingStudent = await Student.findOne({ email: record.email.toLowerCase() });
    if (matchingStudent) {
        if (changedFields.name) {
            matchingStudent.name = record.name;
            matchingStudent.fullName = record.name;
        }
        if (changedFields.rollNumber) matchingStudent.rollNumber = record.rollNumber;
        if (changedFields.branch) matchingStudent.branch = record.branch;
        if (changedFields.year) matchingStudent.year = record.year;
        if (changedFields.division) matchingStudent.classDiv = record.division;
        if (changedFields.studentMobile) matchingStudent.mobileNumber = record.studentMobile;
        if (changedFields.doorNumber) {
            matchingStudent.doorNumber = record.doorNumber;
            matchingStudent.roomHistory.push({
                previousRoom: changedFields.doorNumber.from || "Unassigned",
                newRoom: record.doorNumber || "Unassigned",
                changedBy: actor.name,
                reason: "Administrative roster update",
                changedAt: new Date()
            });
        }
        await matchingStudent.save();
    }

    return record;
}

/**
 * Delete student record from the roster
 */
async function deleteRosterRecord(rosterId, actor, reason = "Deleted by Administrator") {
    const record = await StudentRoster.findById(rosterId);
    if (!record) {
        throw new Error("Roster record not found");
    }

    if (record.doorNumber && record.admissionStatus === "APPROVED") {
        await atomicReleaseRoomRoster({ roomNumber: record.doorNumber, rosterId: record._id });
    }

    // De-authorize linked student account if any
    if (record.email) {
        await Student.updateMany(
            { email: record.email.toLowerCase() },
            { $set: { isVerified: false, doorNumber: null } }
        );
    }

    await StudentRoster.deleteOne({ _id: rosterId });

    await createNotification({
        recipientRole: "ADMISSION_ADMINS",
        title: "Student Removed from Roster",
        message: `${actor.name} removed ${record.name} (${record.prn}) from the admission roster. Reason: ${reason}`,
        category: "ADMISSION",
        priority: "MEDIUM",
        entityType: "admission",
        entityId: rosterId.toString(),
        metadata: { prn: record.prn, email: record.email, reason }
    });

    return { deletedId: rosterId, email: record.email, prn: record.prn };
}

/**
 * Backfill existing registered student accounts into StudentRoster
 * Guarantees zero lockouts for existing students!
 */
async function backfillExistingStudents() {
    try {
        const students = await Student.find({ role: "STUDENT" });
        let backfilled = 0;

        for (const st of students) {
            const existing = await StudentRoster.findOne({
                $or: [{ prn: st.prn }, { email: st.email }]
            });

            if (!existing) {
                const roster = new StudentRoster({
                    prn: st.prn || `LEGACY_${st._id}`,
                    name: st.fullName || st.name || "Hostel Resident",
                    rollNumber: st.rollNumber || "N/A",
                    email: st.email,
                    branch: st.branch || "CE",
                    year: st.year || "FY",
                    division: st.classDiv || "",
                    doorNumber: st.doorNumber || "101",
                    studentMobile: st.mobileNumber || "9876543210",
                    parentMobile: st.guardianPhone || "9876543211",
                    admissionStatus: "APPROVED",
                    registrationStatus: st.profileComplete ? "REGISTERED" : "REGISTRATION_STARTED",
                    userId: st._id,
                    statusHistory: [{
                        fromStatus: "NONE",
                        toStatus: "APPROVED",
                        changedBy: { name: "System Legacy Migration", role: "SYSTEM" },
                        reason: "Pre-existing registered student auto-backfilled to authorized roster",
                        timestamp: new Date()
                    }],
                    auditTrail: [{
                        action: "LEGACY_STUDENT_BACKFILLED",
                        performedBy: { name: "System Legacy Migration", role: "SYSTEM" },
                        details: { studentId: st._id, prn: st.prn, email: st.email },
                        timestamp: new Date()
                    }]
                });
                await roster.save();
                backfilled++;
            } else if (!existing.userId) {
                existing.userId = st._id;
                existing.registrationStatus = st.profileComplete ? "REGISTERED" : "REGISTRATION_STARTED";
                await existing.save();
            }
        }

        if (backfilled > 0) {
            logger.info(`[ADMISSION] Backfilled ${backfilled} existing student accounts into authorized roster.`);
        }
        return backfilled;
    } catch (err) {
        logger.error("backfillExistingStudents error:", err);
    }
}

/**
 * Generate official Excel template for student roster import
 */
function generateTemplateWorkbook() {
    const headers = [
        "PRN",
        "Student Name",
        "Roll Number",
        "Official Email",
        "Branch",
        "Academic Year",
        "Division",
        "Room No",
        "Student Mobile",
        "Parent Mobile"
    ];

    const sampleRows = [
        [
            "F24CE101",
            "Aarav Sharma",
            "10101",
            "f24ce101@ms.pict.edu",
            "CE",
            "FY",
            "1",
            "101",
            "9876543210",
            "9876543211"
        ],
        [
            "F24IT202",
            "Rohan Patil",
            "10202",
            "f24it202@ms.pict.edu",
            "IT",
            "FY",
            "2",
            "102",
            "9823456789",
            "9823456780"
        ]
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Student_Roster_Template");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
    getWorksheetNames,
    autoDetectColumns,
    generateImportPreview,
    commitRosterImport,
    approveRosterRecords,
    rejectRosterRecords,
    revokeRosterEligibility,
    restoreRosterEligibility,
    addManualStudent,
    updateStudentRosterDetails,
    deleteRosterRecord,
    backfillExistingStudents,
    generateTemplateWorkbook,
    getCurrentRoomOccupancyMap
};

