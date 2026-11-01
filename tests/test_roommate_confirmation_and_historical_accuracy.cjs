const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const { User, Student, Warden, HeadWarden, Incharge, Staff } = require("../backend/models/User");
const Complaint = require("../backend/models/Complaint");
const { syncRoomOccupancy } = require("../backend/services/roomOccupancyService");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const API_URL = "http://localhost:5000/api";

const generateToken = (user) => {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
};

async function runRoommateAccuracyTests() {
    console.log("===============================================================================");
    console.log("TESTING: ROOMMATE CONFIRMATION, HISTORICAL ACCURACY, & 8 REPORTING METRICS");
    console.log("===============================================================================");

    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelDB");

    // Clean previous test data
    await User.deleteMany({ email: /@roommate-audit\.local$/ });
    await Complaint.deleteMany({ title: /\[ROOMMATE-ACCURACY\]/ });

    const headWarden = await HeadWarden.create({
        name: "Head Warden Tester",
        email: "hw@roommate-audit.local",
        role: "HEADWARDEN"
    });

    const staff1 = await Staff.create({
        name: "Sunil Plumber",
        email: "sunil@roommate-audit.local",
        role: "STAFF",
        staffRole: "Plumbing"
    });

    const studentA = await Student.create({
        name: "Student A Roommate",
        fullName: "Aarav Sharma",
        email: "aarav@roommate-audit.local",
        role: "STUDENT",
        prn: "RM_TEST_001",
        branch: "CE",
        year: "FY",
        doorNumber: "105",
        mobileNumber: "9811000001"
    });

    const studentB = await Student.create({
        name: "Student B Roommate",
        fullName: "Bhavin Patel",
        email: "bhavin@roommate-audit.local",
        role: "STUDENT",
        prn: "RM_TEST_002",
        branch: "CE",
        year: "FY",
        doorNumber: "105",
        mobileNumber: "9811000002"
    });

    const hwToken = generateToken(headWarden);
    const stuAToken = generateToken(studentA);
    const stuBToken = generateToken(studentB);

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // SECTION A & B: Legacy Complaints & Explicit Feedback Verification
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION A & B: Legacy UNKNOWN & Explicit Feedback Isolation ---");

    const tLegacy = new Date(Date.now() - 3600000 * 24 * 30);
    const compLegacy = await Complaint.create({
        title: "[ROOMMATE-ACCURACY] Legacy Tap Leak 2023",
        description: "Old resolved ticket before statusHistory",
        category: "Plumbing",
        studentId: studentA._id,
        doorNumber: "105",
        status: "Resolved",
        createdAt: tLegacy,
        statusHistory: [] // Zero statusHistory entries
    });

    const tAwaiting = new Date(Date.now() - 3600000 * 10);
    const compAwaiting = await Complaint.create({
        title: "[ROOMMATE-ACCURACY] Resolved But No Feedback Yet",
        description: "Shower head replaced",
        category: "Plumbing",
        studentId: studentB._id,
        doorNumber: "105",
        assignedTo: staff1._id,
        status: "Resolved",
        createdAt: tAwaiting,
        assignedAt: new Date(tAwaiting.getTime() + 3600000 * 1),
        resolvedAt: new Date(tAwaiting.getTime() + 3600000 * 3),
        statusHistory: [
            { status: "Pending", timestamp: tAwaiting, note: "Created", actor: "Student" },
            { status: "Assigned", timestamp: new Date(tAwaiting.getTime() + 3600000 * 1), note: `Assigned to ${staff1.name}`, actor: "Warden", staffId: staff1._id },
            { status: "Resolved", timestamp: new Date(tAwaiting.getTime() + 3600000 * 3), note: "Replaced washer", actor: "Staff", staffId: staff1._id }
        ],
        feedback: {
            isSatisfied: null,
            roomConfirmedWorking: false
        }
    });

    const legacyTimeline = await (await fetch(`${API_URL}/staff-analytics/complaint/${compLegacy._id}/timeline`, { headers: { Authorization: `Bearer ${hwToken}` } })).json();
    assert(legacyTimeline.complaint.firstAttemptOutcome === "UNKNOWN", "Section A: Legacy complaint receives firstAttemptOutcome = 'UNKNOWN'");

    const awaitingTimeline = await (await fetch(`${API_URL}/staff-analytics/complaint/${compAwaiting._id}/timeline`, { headers: { Authorization: `Bearer ${hwToken}` } })).json();
    assert(awaitingTimeline.complaint.firstAttemptOutcome === "AWAITING_CONFIRMATION", "Section B: Resolved complaint without student feedback is 'AWAITING_CONFIRMATION'");

    // -------------------------------------------------------------------------
    // SECTION C: Roommate Linked Complaints & Confirmation
    // Student A & B both report same broken toilet flush in Room 105
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION C: Roommate Linked Complaints & Authentic Confirmation ---");
    const tIssue = new Date(Date.now() - 3600000 * 8);

    // Complaint 1 filed by Student A (Root Complaint)
    const compFlushA = await Complaint.create({
        title: "[ROOMMATE-ACCURACY] Toilet Flush Broken (Aarav)",
        description: "Valve lever stuck in Room 105",
        category: "Plumbing",
        studentId: studentA._id,
        doorNumber: "105",
        assignedTo: staff1._id,
        status: "Resolved",
        createdAt: tIssue,
        assignedAt: new Date(tIssue.getTime() + 3600000 * 1),
        resolvedAt: new Date(tIssue.getTime() + 3600000 * 3),
        statusHistory: [
            { status: "Pending", timestamp: tIssue, note: "Ticket opened by Aarav", actor: "Student" },
            { status: "Assigned", timestamp: new Date(tIssue.getTime() + 3600000 * 1), note: `Assigned to ${staff1.name}`, actor: "Warden", staffId: staff1._id },
            { status: "Resolved", timestamp: new Date(tIssue.getTime() + 3600000 * 3), note: "Flush handle tightened", actor: "Staff", staffId: staff1._id }
        ]
    });

    // Complaint 2 filed by Student B (Linked to Complaint 1)
    const compFlushB = await Complaint.create({
        title: "[ROOMMATE-ACCURACY] Toilet Flush Broken (Bhavin)",
        description: "Flush lever not flushing in Room 105",
        category: "Plumbing",
        studentId: studentB._id,
        doorNumber: "105",
        parentComplaintId: compFlushA._id,
        assignedTo: staff1._id,
        status: "Resolved",
        createdAt: new Date(tIssue.getTime() + 60000),
        assignedAt: new Date(tIssue.getTime() + 3600000 * 1),
        resolvedAt: new Date(tIssue.getTime() + 3600000 * 3),
        statusHistory: [
            { status: "Pending", timestamp: new Date(tIssue.getTime() + 60000), note: "Ticket opened by Bhavin", actor: "Student" },
            { status: "Assigned", timestamp: new Date(tIssue.getTime() + 3600000 * 1), note: `Assigned to ${staff1.name}`, actor: "Warden", staffId: staff1._id },
            { status: "Resolved", timestamp: new Date(tIssue.getTime() + 3600000 * 3), note: "Flush handle tightened", actor: "Staff", staffId: staff1._id }
        ]
    });

    // Update parent's associatedComplaints
    compFlushA.associatedComplaints = [compFlushB._id];
    await compFlushA.save();

    // Now Student A confirms satisfaction on compFlushA:
    const confirmTime = new Date(Date.now() - 3600000 * 4);
    compFlushA.feedback = {
        isSatisfied: true,
        text: "Working fine now, thanks Sunil!",
        submittedAt: confirmTime
    };
    compFlushA.roomConfirmedWorking = true;
    compFlushA.statusHistory.push({
        status: "Feedback",
        timestamp: confirmTime,
        actor: studentA.fullName,
        note: "Student confirmed issue resolved to satisfaction"
    });
    await compFlushA.save();

    // Roommate confirmation propagated to compFlushB:
    compFlushB.roomConfirmedWorking = true;
    compFlushB.roommateConfirmation = {
        confirmedBy: String(studentA._id),
        confirmedAt: confirmTime,
        message: `Your roommate (${studentA.fullName}) confirmed the issue is working. No further confirmation required.`
    };
    compFlushB.statusHistory.push({
        status: "Feedback",
        timestamp: confirmTime,
        actor: "Roommate",
        note: `Roommate (${studentA.fullName}) confirmed issue is working for room 105.`
    });
    await compFlushB.save();

    // Verify Section C properties on compFlushA and compFlushB
    const timelineA = await (await fetch(`${API_URL}/staff-analytics/complaint/${compFlushA._id}/timeline`, { headers: { Authorization: `Bearer ${hwToken}` } })).json();
    const timelineB = await (await fetch(`${API_URL}/staff-analytics/complaint/${compFlushB._id}/timeline`, { headers: { Authorization: `Bearer ${hwToken}` } })).json();

    assert(timelineA.complaint.personallyConfirmed === true, "Section C: Student A has personallyConfirmed = true");
    assert(timelineB.complaint.personallyConfirmed === false, "Section C: Student B is NOT recorded as personally confirming (personallyConfirmed = false)");
    assert(timelineB.complaint.confirmedByRoommate === true, "Section C: Student B has confirmedByRoommate = true");
    assert(timelineB.complaint.actualConfirmingActor === String(studentA._id), "Section C: Student B records Student A as the authentic confirming actor");
    assert(timelineA.complaint.issueId === timelineB.complaint.issueId, "Section C: Both complaints share the exact same room-level issueId");

    // -------------------------------------------------------------------------
    // SECTION E: Verify 8 Distinct Reporting Metrics
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION E: Reporting Separation of All 8 Key Metrics ---");
    const overviewRes = await fetch(`${API_URL}/staff-analytics/overview`, {
        headers: { Authorization: `Bearer ${hwToken}` }
    });
    const overviewData = await overviewRes.json();
    const ov = overviewData.overview;

    // 1. Unique individual complaints handled
    assert(typeof ov.uniqueIndividualComplaintsHandled === "number" && ov.uniqueIndividualComplaintsHandled >= 4,
        `Metric 1: uniqueIndividualComplaintsHandled = ${ov.uniqueIndividualComplaintsHandled} (counts every complaint document)`);

    // 2. Unique room-level issues handled
    assert(typeof ov.uniqueRoomIssuesHandled === "number" && ov.uniqueRoomIssuesHandled < ov.uniqueIndividualComplaintsHandled,
        `Metric 2: uniqueRoomIssuesHandled = ${ov.uniqueRoomIssuesHandled} (roommate complaints A & B counted as 1 shared room issue)`);

    // 3. First-attempt successful resolutions
    assert(typeof ov.firstAttemptSuccessCount === "number" && ov.firstAttemptSuccessCount >= 2,
        `Metric 3: firstAttemptSuccessCount = ${ov.firstAttemptSuccessCount}`);

    // 4. First-attempt unsuccessful resolutions
    assert(typeof ov.firstAttemptUnsuccessfulCount === "number",
        `Metric 4: firstAttemptUnsuccessfulCount = ${ov.firstAttemptUnsuccessfulCount}`);

    // 5. Subsequent resolution attempts
    assert(typeof ov.subsequentResolutionAttempts === "number",
        `Metric 5: subsequentResolutionAttempts = ${ov.subsequentResolutionAttempts}`);

    // 6. Reopened issues
    assert(typeof ov.reopenedIssuesCount === "number",
        `Metric 6: reopenedIssuesCount = ${ov.reopenedIssuesCount}`);

    // 7. Awaiting confirmation
    assert(typeof ov.awaitingConfirmationCount === "number" && ov.awaitingConfirmationCount >= 1,
        `Metric 7: awaitingConfirmationCount = ${ov.awaitingConfirmationCount} (includes compAwaiting)`);

    // 8. UNKNOWN / UNATTRIBUTED historical records
    assert(typeof ov.unknownLegacyCount === "number" && ov.unknownLegacyCount >= 1,
        `Metric 8: unknownLegacyCount = ${ov.unknownLegacyCount} (includes compLegacy)`);

    // Verify room issues resolved counted once
    assert(typeof ov.roomIssuesResolvedCount === "number",
        `Shared room-level issues resolved count = ${ov.roomIssuesResolvedCount} (counted only once per issue)`);

    // Verify actual student feedback submissions does not double count roommate confirmation
    assert(ov.actualStudentResponsesCount < ov.uniqueIndividualComplaintsHandled,
        `Actual student responses count (${ov.actualStudentResponsesCount}) excludes redundant roommate copies`);

    // -------------------------------------------------------------------------
    // SECTION D: Subsequent Contradictory Feedback
    // Student B later tests the flush and reports it is still leaking/failing!
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION D: Subsequent Contradictory Feedback Handling ---");
    const reopenTime = new Date(Date.now() - 3600000 * 2);

    // Student B reports failure:
    compFlushB.status = "Reopened";
    compFlushB.followUpRequired = true;
    compFlushB.roomConfirmedWorking = false;
    compFlushB.feedback = {
        isSatisfied: false,
        text: "Water is still leaking around the base seal!",
        submittedAt: reopenTime
    };
    compFlushB.statusHistory.push({
        status: "Reopened",
        timestamp: reopenTime,
        actor: studentB.fullName,
        note: "Student reported issue was not resolved: Water is still leaking around the base seal!"
    });
    await compFlushB.save();

    // Linked compFlushA updated per roommate contradictory report:
    compFlushA.status = "Reopened";
    compFlushA.followUpRequired = true;
    compFlushA.roomConfirmedWorking = false;
    compFlushA.statusHistory.push({
        status: "Reopened",
        timestamp: reopenTime,
        actor: "Roommate Follow-up",
        note: `Roommate (${studentB.fullName}) reported problem still exists. Room returned to follow-up.`
    });
    await compFlushA.save();

    // Verify Section D post-reopen behavior:
    const postTimelineA = await (await fetch(`${API_URL}/staff-analytics/complaint/${compFlushA._id}/timeline`, { headers: { Authorization: `Bearer ${hwToken}` } })).json();
    const postTimelineB = await (await fetch(`${API_URL}/staff-analytics/complaint/${compFlushB._id}/timeline`, { headers: { Authorization: `Bearer ${hwToken}` } })).json();

    assert(postTimelineA.complaint.hasContradictoryFeedback === true, "Section D: Complaint A identifies hasContradictoryFeedback = true");
    assert(postTimelineB.complaint.hasContradictoryFeedback === true, "Section D: Complaint B identifies hasContradictoryFeedback = true");
    assert(postTimelineA.complaint.statusHistory.some(e => e.status === "Feedback"), "Section D: Earlier positive Feedback event PRESERVED in statusHistory");
    assert(postTimelineA.complaint.statusHistory.some(e => e.status === "Reopened"), "Section D: Subsequent Reopened event RECORDED in statusHistory with actor & timestamp");
    assert(postTimelineA.complaint.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY", "Section D: Complaint A resolution outcome updated to NOT_SOLVED_FIRST_TRY");
    assert(postTimelineB.complaint.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY", "Section D: Complaint B resolution outcome updated to NOT_SOLVED_FIRST_TRY");

    // Clean test records
    await User.deleteMany({ email: /@roommate-audit\.local$/ });
    await Complaint.deleteMany({ title: /\[ROOMMATE-ACCURACY\]/ });
    await syncRoomOccupancy();

    console.log("\n==================================================");
    console.log(`ROOMMATE AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    await mongoose.disconnect();
    process.exit(failed === 0 ? 0 : 1);
}

runRoommateAccuracyTests().catch(err => {
    console.error("Roommate accuracy tests failed:", err);
    process.exit(1);
});

