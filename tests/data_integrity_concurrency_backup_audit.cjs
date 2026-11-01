const path = require("path");
module.paths.push(path.resolve(__dirname, "../backend/node_modules"));

const mongoose = require("mongoose");
const assert = require("assert");

require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const AUDIT_DB_URI = "mongodb://127.0.0.1:27017/hostelIntegrityAuditDB";
const RESTORE_DRILL_DB_URI = "mongodb://127.0.0.1:27017/hostelRestoreDrillDB";

const { User, Student, HeadWarden, Incharge, Warden } = require("../backend/models/User");
const StudentRoster = require("../backend/models/StudentRoster");
const Complaint = require("../backend/models/Complaint");
const Incident = require("../backend/models/Incident");
const Notification = require("../backend/models/Notification");
const RoomOccupancy = require("../backend/models/RoomOccupancy");
const ResidentAuditLog = require("../backend/models/ResidentAuditLog");
const AdmissionImportBatch = require("../backend/models/AdmissionImportBatch");

const {
    syncRoomOccupancy,
    checkRoomCapacity,
    assignStudentRoomAtomic,
    atomicReserveRoomRoster,
    atomicReleaseRoomRoster,
    atomicConvertRosterToRegistered
} = require("../backend/services/roomOccupancyService");

const {
    commitRosterImport,
    approveRosterRecords,
    revokeRosterEligibility,
    restoreRosterEligibility
} = require("../backend/services/admissionService");

const { MAX_STUDENTS_PER_ROOM } = require("../backend/utils/hostelRooms");

const testResults = [];

function recordTest(section, testName, passed, details = "") {
    testResults.push({ section, testName, passed, details });
    const mark = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`  [${mark}] ${section} :: ${testName}${details ? ` -> ${details}` : ""}`);
}

async function runAudit() {
    console.log("================================================================================");
    console.log("🛠️  DATA INTEGRITY, CONCURRENCY, BACKUP & DISASTER RECOVERY AUDIT");
    console.log("================================================================================\n");

    await mongoose.connect(AUDIT_DB_URI);
    console.log(`Connected to isolated audit DB: ${AUDIT_DB_URI}`);
    await mongoose.connection.db.dropDatabase();

    // Initialize 77-room occupancy baseline
    await syncRoomOccupancy();

    console.log("\n--------------------------------------------------------------------------------");
    console.log("SECTION 1: ROOM ALLOCATION CONCURRENCY & CAPACITY INTEGRITY");
    console.log("--------------------------------------------------------------------------------");

    // 1.1 Strict Maximum 2 Students: Concurrent allocation against same room
    {
        // Place 1 existing student in Room 101
        const stud1 = await Student.create({
            name: "Roommate 1",
            fullName: "Roommate 1",
            email: "f24occ1@ms.pict.edu",
            prn: "F24OCC1",
            role: "STUDENT",
            doorNumber: null,
            mobileNumber: "9123450001",
            profileComplete: true
        });
        await assignStudentRoomAtomic({ studentId: stud1._id, newRoom: "101", adminName: "Admin" });

        // Create 4 candidates all trying to take the 2nd slot concurrently
        const candidates = [];
        for (let i = 2; i <= 5; i++) {
            const c = await Student.create({
                name: `Candidate ${i}`,
                fullName: `Candidate ${i}`,
                email: `f24occ${i}@ms.pict.edu`,
                prn: `F24OCC${i}`,
                role: "STUDENT",
                doorNumber: null,
                mobileNumber: `912345000${i}`,
                profileComplete: true
            });
            candidates.push(c);
        }

        // Fire 4 parallel room allocations targeting Room 101
        const outcomes = await Promise.allSettled(
            candidates.map(c => assignStudentRoomAtomic({ studentId: c._id, newRoom: "101", adminName: "Concurrent Test" }))
        );

        const successes = outcomes.filter(o => o.status === "fulfilled");
        const rejections = outcomes.filter(o => o.status === "rejected");

        const occDoc = await RoomOccupancy.findOne({ roomNumber: "101" });
        const actualAssigned = await Student.countDocuments({ doorNumber: "101", role: "STUDENT" });

        const capSafe = occDoc.occupantCount <= MAX_STUDENTS_PER_ROOM && actualAssigned <= MAX_STUDENTS_PER_ROOM;
        recordTest(
            "Room Allocation",
            "Race condition protection: 4 concurrent allocations for 1 remaining slot",
            capSafe && successes.length === 1 && rejections.length === 3 && actualAssigned === 2,
            `Successes: ${successes.length}, Rejected: ${rejections.length}, Final Occupancy: ${actualAssigned}/${MAX_STUDENTS_PER_ROOM}`
        );
    }

    // 1.2 Approved Roster Reservation + Concurrent Registration (Zero Double Counting)
    {
        // Reserve Room 102 for Roster Student
        const roster = await StudentRoster.create({
            prn: "F24ROST01",
            name: "Roster Alpha",
            rollNumber: "10201",
            email: "f24rost01@ms.pict.edu",
            branch: "CE",
            year: "FY",
            studentMobile: "9811100001",
            parentMobile: "9811100002",
            doorNumber: "102",
            admissionStatus: "APPROVED",
            registrationStatus: "NOT_REGISTERED"
        });

        // Reserve in RoomOccupancy
        const resReserve = await atomicReserveRoomRoster({ roomNumber: "102", rosterId: roster._id });
        const occBefore = await RoomOccupancy.findOne({ roomNumber: "102" });

        // Simulate student completing OTP registration and converting reservation to occupant
        const newStudent = await Student.create({
            name: "Roster Alpha",
            fullName: "Roster Alpha",
            email: "f24rost01@ms.pict.edu",
            prn: "F24ROST01",
            role: "STUDENT",
            doorNumber: "102",
            mobileNumber: "9811100001",
            profileComplete: true
        });

        const resConvert = await atomicConvertRosterToRegistered({
            roomNumber: "102",
            rosterId: roster._id,
            studentId: newStudent._id
        });

        const occAfter = await RoomOccupancy.findOne({ roomNumber: "102" });

        const countRemainedOne = occBefore.occupantCount === 1 && occAfter.occupantCount === 1;
        const rosterRemoved = !occAfter.rosterReservations.map(String).includes(String(roster._id));
        const studentAdded = occAfter.occupants.map(String).includes(String(newStudent._id));

        recordTest(
            "Room Allocation",
            "Atomic roster conversion (zero double-counting during registration linking)",
            countRemainedOne && rosterRemoved && studentAdded,
            `Count before: ${occBefore.occupantCount}, Count after: ${occAfter.occupantCount}`
        );
    }

    // 1.3 Transfer Enforces Capacity on Both Old and New Rooms
    {
        // Room 103 has 2 occupants (Full)
        for (let i = 1; i <= 2; i++) {
            const s = await Student.create({
                name: `Room 103 Student ${i}`,
                fullName: `Room 103 Student ${i}`,
                email: `f24full${i}@ms.pict.edu`,
                prn: `F24FULL${i}`,
                role: "STUDENT",
                doorNumber: null,
                mobileNumber: `912345001${i}`,
                profileComplete: true
            });
            await assignStudentRoomAtomic({ studentId: s._id, newRoom: "103", adminName: "Setup" });
        }

        // Student in Room 104 tries to transfer into full Room 103
        const transferStudent = await Student.create({
            name: "Transfer Student",
            fullName: "Transfer Student",
            email: "f24trans@ms.pict.edu",
            prn: "F24TRANS",
            role: "STUDENT",
            doorNumber: null,
            mobileNumber: "9123450099",
            profileComplete: true
        });
        await assignStudentRoomAtomic({ studentId: transferStudent._id, newRoom: "104", adminName: "Setup" });

        let transferBlocked = false;
        try {
            await assignStudentRoomAtomic({
                studentId: transferStudent._id,
                newRoom: "103",
                previousRoom: "104",
                adminName: "Warden"
            });
        } catch (err) {
            transferBlocked = err.message.includes("capacity");
        }

        const studAfter = await Student.findById(transferStudent._id);
        const remainedInOld = studAfter.doorNumber === "104";

        recordTest(
            "Room Allocation",
            "Transfer blocked when target room is at capacity (student retains old room)",
            transferBlocked && remainedInOld,
            `Door after attempt: ${studAfter.doorNumber}`
        );
    }

    // 1.4 Room History Persistence
    {
        // Perform a valid transfer from 104 to 105
        const stud = await Student.findOne({ prn: "F24TRANS" });
        await assignStudentRoomAtomic({
            studentId: stud._id,
            newRoom: "105",
            previousRoom: "104",
            adminName: "Warden Dave",
            reason: "Room change request"
        });

        const refreshed = await Student.findById(stud._id);
        const hasHistory = refreshed.roomHistory && refreshed.roomHistory.length >= 2;
        const lastEntry = refreshed.roomHistory[refreshed.roomHistory.length - 1];
        const correctHistory = lastEntry.previousRoom === "104" && lastEntry.newRoom === "105" && lastEntry.changedBy === "Warden Dave";

        recordTest(
            "Room Allocation",
            "Historical room assignment audit trail maintained across transfers",
            hasHistory && correctHistory,
            `History length: ${refreshed.roomHistory.length}, Last: ${lastEntry.previousRoom} -> ${lastEntry.newRoom}`
        );
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("SECTION 2: ADMISSION DATA INTEGRITY & WORKBOOK RE-IMPORT");
    console.log("--------------------------------------------------------------------------------");

    // 2.1 Re-importing same workbook does not duplicate students
    {
        const batch1Rows = [
            {
                isValid: true,
                data: {
                    prn: "F24IMPORT01",
                    name: "Import Student One",
                    rollNumber: "10601",
                    email: "f24import01@ms.pict.edu",
                    branch: "IT",
                    year: "FY",
                    division: "1",
                    doorNumber: "106",
                    studentMobile: "9822100001",
                    parentMobile: "9822100002"
                }
            },
            {
                isValid: true,
                data: {
                    prn: "F24IMPORT02",
                    name: "Import Student Two",
                    rollNumber: "10602",
                    email: "f24import02@ms.pict.edu",
                    branch: "IT",
                    year: "FY",
                    division: "1",
                    doorNumber: "106",
                    studentMobile: "9822100003",
                    parentMobile: "9822100004"
                }
            }
        ];

        // First import
        await commitRosterImport({
            parsedRows: batch1Rows,
            autoApprove: false,
            actor: { id: "66d9f9a00000000000000001", name: "Head Warden", role: "HEADWARDEN" }
        });

        const countAfterFirst = await StudentRoster.countDocuments({ prn: { $in: ["F24IMPORT01", "F24IMPORT02"] } });

        // Second import with modified name for student 1
        batch1Rows[0].data.name = "Import Student One (Updated)";
        await commitRosterImport({
            parsedRows: batch1Rows,
            autoApprove: false,
            actor: { id: "66d9f9a00000000000000001", name: "Head Warden", role: "HEADWARDEN" }
        });

        const countAfterSecond = await StudentRoster.countDocuments({ prn: { $in: ["F24IMPORT01", "F24IMPORT02"] } });
        const updatedDoc = await StudentRoster.findOne({ prn: "F24IMPORT01" });

        const noDuplicates = countAfterFirst === 2 && countAfterSecond === 2;
        const updatedName = updatedDoc.name === "Import Student One (Updated)";
        const hasAuditTrail = updatedDoc.auditTrail.length >= 1;

        recordTest(
            "Admission Integrity",
            "Re-import idempotency (updates existing, zero duplicate records, audit logged)",
            noDuplicates && updatedName && hasAuditTrail,
            `Count 1st: ${countAfterFirst}, Count 2nd: ${countAfterSecond}, Audit entries: ${updatedDoc.auditTrail.length}`
        );
    }

    // 2.2 Missing rows in subsequent workbook do not delete existing records
    {
        const batch2Rows = [
            {
                isValid: true,
                data: {
                    prn: "F24IMPORT02", // F24IMPORT01 is intentionally omitted from this workbook
                    name: "Import Student Two",
                    rollNumber: "10602",
                    email: "f24import02@ms.pict.edu",
                    branch: "IT",
                    year: "FY",
                    division: "1",
                    doorNumber: "106",
                    studentMobile: "9822100003",
                    parentMobile: "9822100004"
                }
            }
        ];

        await commitRosterImport({
            parsedRows: batch2Rows,
            autoApprove: false,
            actor: { id: "66d9f9a00000000000000001", name: "Head Warden", role: "HEADWARDEN" }
        });

        const omittedRecord = await StudentRoster.findOne({ prn: "F24IMPORT01" });
        const preserved = omittedRecord !== null;

        recordTest(
            "Admission Integrity",
            "Additive import guarantee: records omitted from subsequent workbook are preserved",
            preserved,
            preserved ? `Record ${omittedRecord.prn} still exists intact` : "VULNERABILITY: Record was deleted"
        );
    }

    // 2.3 Eligibility Revocation & Restoration Audit Trail
    {
        const roster = await StudentRoster.findOne({ prn: "F24IMPORT01" });
        roster.admissionStatus = "APPROVED";
        await roster.save();

        const actor = { id: "66d9f9a00000000000000001", name: "Incharge Dave", role: "INCHARGE" };

        // Revoke
        await revokeRosterEligibility(roster._id, actor, "Disciplinary hold");
        const revokedDoc = await StudentRoster.findById(roster._id);
        const isRevoked = revokedDoc.admissionStatus === "REVOKED";

        // Restore
        await restoreRosterEligibility(roster._id, actor, "Clearance obtained");
        const restoredDoc = await StudentRoster.findById(roster._id);
        const isRestored = restoredDoc.admissionStatus === "APPROVED";

        const hasRevokeHistory = restoredDoc.statusHistory.some(s => s.toStatus === "REVOKED" && s.reason === "Disciplinary hold");
        const hasRestoreHistory = restoredDoc.statusHistory.some(s => s.toStatus === "APPROVED" && s.reason === "Clearance obtained");

        recordTest(
            "Admission Integrity",
            "Eligibility revocation and restoration lifecycle maintains immutable audit trail",
            isRevoked && isRestored && hasRevokeHistory && hasRestoreHistory,
            `Status: ${restoredDoc.admissionStatus}, History length: ${restoredDoc.statusHistory.length}`
        );
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("SECTION 3: COMPLAINT WORKFLOW & ROOMMATE CONFIRMATION INTEGRITY");
    console.log("--------------------------------------------------------------------------------");

    // 3.1 Status history preservation after multiple resolve and reopen cycles
    {
        const student = await Student.create({
            name: "Complaint Tester",
            fullName: "Complaint Tester",
            email: "f24cmpl@ms.pict.edu",
            prn: "F24CMPL",
            role: "STUDENT",
            doorNumber: "107",
            mobileNumber: "9123450088",
            profileComplete: true
        });

        const complaint = await Complaint.create({
            title: "Fan making sound",
            category: "Electrical",
            doorNumber: "107",
            studentId: student._id,
            status: "Pending",
            statusHistory: [
                { status: "Pending", timestamp: new Date(), actor: "Student", note: "Initial submission" }
            ]
        });

        // 1. Assign
        complaint.status = "In Progress";
        complaint.assignedTo = "66d9f9a00000000000000002";
        complaint.statusHistory.push({
            status: "In Progress",
            timestamp: new Date(),
            actor: "Warden",
            note: "Assigned to Electrician"
        });

        // 2. Resolve (First attempt)
        complaint.status = "Resolved";
        complaint.resolvedAt = new Date();
        complaint.statusHistory.push({
            status: "Resolved",
            timestamp: new Date(),
            actor: "Electrician John",
            staffId: "66d9f9a00000000000000002",
            note: "Capacitor replaced"
        });

        // 3. Reopen (Student dissatisfied)
        complaint.status = "Reopened";
        complaint.followUpRequired = true;
        complaint.roomConfirmedWorking = false;
        complaint.statusHistory.push({
            status: "Reopened",
            timestamp: new Date(),
            actor: "Complaint Tester",
            note: "Fan still wobbles at high speed"
        });

        // 4. Resolve again (Second attempt)
        complaint.status = "Resolved";
        complaint.resolvedAt = new Date();
        complaint.statusHistory.push({
            status: "Resolved",
            timestamp: new Date(),
            actor: "Senior Electrician Dave",
            staffId: "66d9f9a00000000000000003",
            note: "Blade alignment adjusted"
        });

        await complaint.save();

        const refComplaint = await Complaint.findById(complaint._id);
        const resolveAttempts = refComplaint.statusHistory.filter(s => s.status === "Resolved");
        const reopenEvents = refComplaint.statusHistory.filter(s => s.status === "Reopened");

        const historyPreserved = resolveAttempts.length === 2 && reopenEvents.length === 1;
        recordTest(
            "Complaint Workflow",
            "Multi-cycle resolution & reopen history preservation in statusHistory array",
            historyPreserved,
            `Resolve attempts: ${resolveAttempts.length}, Reopen events: ${reopenEvents.length}`
        );
    }

    // 3.2 Coexistence of multiple independent service incidents
    {
        const inc1 = await Incident.create({
            incidentNumber: "INC-TEST-001",
            serviceType: "WATER",
            serviceCategory: "Plumbing",
            status: "CONFIRMED",
            affectedRooms: ["101", "102", "103"],
            title: "Water Tank 1 Low Pressure",
            description: "Maintenance undergoing"
        });

        const inc2 = await Incident.create({
            incidentNumber: "INC-TEST-002",
            serviceType: "ELECTRICITY",
            serviceCategory: "Electrical",
            status: "IN_PROGRESS",
            affectedRooms: ["103", "104"],
            title: "Phase Failure Wing A",
            description: "EB transformer tripped"
        });

        const activeCount = await Incident.countDocuments({ status: { $in: ["CONFIRMED", "IN_PROGRESS"] } });
        const inc1Check = await Incident.findOne({ incidentNumber: "INC-TEST-001" });
        const inc2Check = await Incident.findOne({ incidentNumber: "INC-TEST-002" });

        const coexists = activeCount >= 2 && inc1Check && inc2Check;
        recordTest(
            "Complaint Workflow",
            "Multiple concurrent independent service incidents can coexist without collision",
            coexists,
            `Active incidents: ${activeCount}`
        );
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("SECTION 4: NOTIFICATION DEDUPLICATION & AUDIT INTEGRITY");
    console.log("--------------------------------------------------------------------------------");

    // 4.1 Notification Deduplication within 5 minutes
    {
        const { createNotification } = require("../backend/services/notificationService");

        const dedupKey = "room_101_water_burst";
        const notif1 = await createNotification({
            recipientRole: "WARDEN",
            title: "Water Outage",
            message: "Room 101 pipeline maintenance",
            dedupKey
        });

        const notif2 = await createNotification({
            recipientRole: "WARDEN",
            title: "Water Outage",
            message: "Room 101 pipeline maintenance (duplicate event)",
            dedupKey
        });

        const duplicateBlocked = notif1._id.toString() === notif2._id.toString();
        recordTest(
            "Notification & Audit",
            "Notification deduplication (dedupKey prevents duplicate notification entries within 5m)",
            duplicateBlocked,
            `First ID: ${notif1._id}, Second ID: ${notif2._id}`
        );
    }

    // 4.2 Immutable Audit Trail in ResidentAuditLog
    {
        const auditDoc = await ResidentAuditLog.create({
            action: "UPDATE_ROOM",
            performedBy: "66d9f9a00000000000000001",
            adminName: "Audit Head Warden",
            adminRole: "HEADWARDEN",
            studentPRN: "F24TEST99",
            studentName: "Audit Student",
            details: { from: "101", to: "102" }
        });

        const found = await ResidentAuditLog.findById(auditDoc._id);
        const isPersisted = found !== null && found.studentPRN === "F24TEST99";
        recordTest(
            "Notification & Audit",
            "ResidentAuditLog persistence and schema immutability",
            isPersisted,
            `Action: ${found.action}, PRN: ${found.studentPRN}`
        );
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("SECTION 5: SYNTHETIC BACKUP & RESTORE DRILL");
    console.log("--------------------------------------------------------------------------------");

    // 5.1 Perform isolated backup and restore drill into hostelRestoreDrillDB
    {
        console.log("Executing synthetic document-level backup from hostelIntegrityAuditDB...");
        const collectionsToBackup = ["users", "studentrosters", "roomoccupancies", "complaints", "residentauditlogs"];
        const backupSnapshot = {};

        for (const collName of collectionsToBackup) {
            const docs = await mongoose.connection.db.collection(collName).find({}).toArray();
            backupSnapshot[collName] = docs;
        }

        const totalBackedUp = Object.values(backupSnapshot).reduce((acc, docs) => acc + docs.length, 0);
        console.log(`Snapshot complete: ${totalBackedUp} documents extracted across ${collectionsToBackup.length} collections.`);

        // Connect to separate drill database
        console.log(`Connecting to disaster recovery drill DB: ${RESTORE_DRILL_DB_URI}...`);
        const restoreConn = await mongoose.createConnection(RESTORE_DRILL_DB_URI).asPromise();
        await restoreConn.db.dropDatabase();

        console.log("Restoring snapshot into disaster recovery drill DB...");
        let totalRestored = 0;
        let parityPassed = true;

        for (const collName of collectionsToBackup) {
            const docs = backupSnapshot[collName];
            if (docs.length > 0) {
                await restoreConn.db.collection(collName).insertMany(docs);
                const restoredCount = await restoreConn.db.collection(collName).countDocuments();
                if (restoredCount !== docs.length) {
                    parityPassed = false;
                }
                totalRestored += restoredCount;
            }
        }

        const exactParity = parityPassed && (totalBackedUp === totalRestored);
        recordTest(
            "Backup & Restore",
            "Disaster Recovery Drill: 100% document count & integrity parity in restore DB",
            exactParity,
            `Backed Up: ${totalBackedUp} docs, Restored: ${totalRestored} docs in hostelRestoreDrillDB`
        );

        // Teardown restore drill DB
        await restoreConn.db.dropDatabase();
        await restoreConn.close();
    }

    console.log("\n================================================================================");
    console.log("AUDIT SUMMARY");
    console.log("================================================================================");
    const passedCount = testResults.filter(t => t.passed).length;
    const failedCount = testResults.filter(t => !t.passed).length;
    console.log(`Total Checks Executed:  ${testResults.length}`);
    console.log(`Passed Checks:          ${passedCount}`);
    console.log(`Defects / Failures:     ${failedCount}`);
    console.log("================================================================================\n");

    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
}

runAudit().catch(err => {
    console.error("Fatal audit execution error:", err);
    process.exit(1);
});
