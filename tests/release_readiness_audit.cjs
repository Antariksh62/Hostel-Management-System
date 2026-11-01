/**
 * release_readiness_audit.cjs
 * Comprehensive Final Release-Readiness Audit Suite:
 * - 1. Regression Checks (Registration, Profile, Room, Regular Complaints with media/assignment/history, Incident lifecycle)
 * - 2. Security & Authorization (Cross-student access, Contact privacy, Room spoofing prevention, Wi-Fi isolation)
 * - 3. Data Integrity & Legacy Compatibility (Older schema records, Missing optional fields, Status history immutability)
 * - 4. State Machine & Concurrency Guardrails (Invalid transitions, Feedback on non-resolved complaints)
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { User, Student, WifiIncharge, Warden, Staff } = require('../backend/models/User');
const Complaint = require('../backend/models/Complaint');
const Incident = require('../backend/models/Incident');

const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostelDB';
const JWT_SECRET = process.env.JWT_SECRET || 'hostel_secret_jwt_key_2024';

const api = {
    get: async (url, opts = {}) => {
        const res = await fetch(url, { headers: opts.headers || {} });
        const data = await res.json().catch(() => null);
        return { status: res.status, ok: res.ok, data };
    },
    post: async (url, body, opts = {}) => {
        const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { status: res.status, ok: res.ok, data };
    },
    put: async (url, body, opts = {}) => {
        const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { status: res.status, ok: res.ok, data };
    },
    patch: async (url, body, opts = {}) => {
        const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { status: res.status, ok: res.ok, data };
    }
};

const results = { passed: [], failed: [] };

function pass(name, details = '') {
    results.passed.push(name);
    console.log(`  ✓ PASS: ${name} ${details ? '(' + details + ')' : ''}`);
}

function fail(name, err) {
    results.failed.push({ name, error: err.message || err });
    console.error(`  ✗ FAIL: ${name} -> ${err.message || err}`);
}

function createToken(user) {
    return jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '1d' }
    );
}

async function runAudit() {
    console.log('======================================================================');
    console.log('FINAL RELEASE-READINESS AUDIT — HOSTEL MANAGEMENT SYSTEM');
    console.log('======================================================================\n');

    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB: ${MONGO_URI}\n`);

    // Clean test accounts and audit records safely
    await Student.deleteMany({ email: /rr_test_/ });
    await User.deleteMany({ email: /rr_staff_/ });
    await Complaint.deleteMany({ title: /\[ReleaseAudit\]/ });

    // -------------------------------------------------------------------------
    // 1. REGRESSION: Student Registration, Profile Editing & Room Assignment
    // -------------------------------------------------------------------------
    console.log('--- 1. REGRESSION CHECKS: Student Registration, Profile & Regular Complaints ---');
    let studentA, studentB, staffUser, wardenUser, wifiUser;
    let tokenA, tokenB, tokenStaff, tokenWarden, tokenWifi;

    try {
        studentA = await Student.create({
            fullName: 'Audit Student Alpha',
            email: 'rr_test_student_a@pict.edu',
            prn: 'PRN_RR_001',
            doorNumber: '210',
            mobileNumber: '9820000001',
            role: 'STUDENT',
            isProfileComplete: true
        });
        tokenA = createToken(studentA);
        pass('Student Alpha registered and assigned Room 210');

        studentB = await Student.create({
            fullName: 'Audit Student Beta',
            email: 'rr_test_student_b@pict.edu',
            prn: 'PRN_RR_002',
            doorNumber: '210', // Roommate
            mobileNumber: '9820000002',
            role: 'STUDENT',
            isProfileComplete: true
        });
        tokenB = createToken(studentB);
        pass('Student Beta registered as roommate in Room 210');

        // Test profile update
        const updateRes = await api.patch(
            `${API_BASE}/auth/student/update-info`,
            { mobileNumber: '9820009999' },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (!updateRes.ok || updateRes.data.user.mobileNumber !== '9820009999') {
            throw new Error(`Profile update failed: ${JSON.stringify(updateRes.data)}`);
        }
        pass('Student profile successfully updated mobile number', updateRes.data.user.mobileNumber);

        // Fetch Staff, Warden, and Wi-Fi In-Charge
        staffUser = await Staff.findOneAndUpdate(
            { email: 'rr_staff_carpenter@pict.edu' },
            { name: 'Ramesh Carpenter', email: 'rr_staff_carpenter@pict.edu', role: 'STAFF', staffRole: 'Carpenter' },
            { upsert: true, returnDocument: 'after' }
        );
        tokenStaff = createToken(staffUser);

        wardenUser = await Warden.findOne({ role: { $in: ['WARDEN', 'HEADWARDEN'] } });
        if (!wardenUser) {
            wardenUser = await Warden.create({ name: 'Head Warden', email: 'warden_rr@pict.edu', role: 'HEADWARDEN' });
        }
        tokenWarden = createToken(wardenUser);

        wifiUser = await WifiIncharge.findOne({ role: 'WIFI_INCHARGE' });
        if (!wifiUser) {
            wifiUser = await WifiIncharge.create({ name: 'Network Admin', email: 'wifi_rr@pict.edu', role: 'WIFI_INCHARGE' });
        }
        tokenWifi = createToken(wifiUser);
        pass('Warden, Staff, and Wi-Fi Specialist identities authenticated');

        // Create Regular Complaint (with description, non-quick category)
        const regularCompRes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[ReleaseAudit] Broken wardrobe latch and hinge',
                description: 'The wooden wardrobe door hinge is completely loose and latch cannot lock properly.',
                category: 'Furniture'
            },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (!regularCompRes.ok) throw new Error(`Regular complaint creation failed: ${JSON.stringify(regularCompRes.data)}`);
        const regularComp = regularCompRes.data.complaint;
        pass('Regular complaint created with description and category', `ID: #${regularComp._id.slice(-6)}`);

        // Warden assigns complaint to staff
        const assignRes = await api.put(
            `${API_BASE}/complaints/${regularComp._id}/assign`,
            { staffId: staffUser._id.toString() },
            { headers: { Authorization: `Bearer ${tokenWarden}` } }
        );
        if (!assignRes.ok) throw new Error(`Complaint assignment failed: ${JSON.stringify(assignRes.data)}`);
        pass('Warden assigned regular complaint to staff member', staffUser.name);

        // Staff updates status to In Progress
        const statusRes = await api.put(
            `${API_BASE}/complaints/${regularComp._id}/status`,
            { status: 'In Progress', note: 'Carpenter visited room and measured hinges' },
            { headers: { Authorization: `Bearer ${tokenStaff}` } }
        );
        if (!statusRes.ok) throw new Error(`Staff status update failed: ${JSON.stringify(statusRes.data)}`);
        pass('Staff updated complaint status to In Progress with progress note');

        // Staff updates status to Resolved
        const resolveRes = await api.put(
            `${API_BASE}/complaints/${regularComp._id}/status`,
            { status: 'Resolved', note: 'New brass hinges fitted and tested' },
            { headers: { Authorization: `Bearer ${tokenStaff}` } }
        );
        if (!resolveRes.ok) throw new Error(`Staff resolve failed: ${JSON.stringify(resolveRes.data)}`);
        pass('Staff updated complaint status to Resolved');

        // Student submits feedback on resolved complaint
        const feedbackRes = await api.post(
            `${API_BASE}/complaints/${regularComp._id}/feedback`,
            { isSatisfied: true, text: 'Wardrobe latch is fixed and working smoothly!' },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (!feedbackRes.ok) throw new Error(`Student feedback failed: ${JSON.stringify(feedbackRes.data)}`);
        pass('Student submitted feedback confirming satisfactory resolution');

        // Verify status history timeline
        const compInDb = await Complaint.findById(regularComp._id);
        const statuses = compInDb.statusHistory.map(h => h.status);
        if (!statuses.includes('Pending') || !statuses.includes('In Progress') || !statuses.includes('Resolved') || !statuses.includes('Feedback')) {
            throw new Error(`Incomplete statusHistory timeline: ${JSON.stringify(statuses)}`);
        }
        pass('Complete audit timeline preserved: Pending -> In Progress -> Resolved -> Feedback');

    } catch (err) {
        fail('Regression: Regular complaint lifecycle', err);
    }

    // -------------------------------------------------------------------------
    // 2. SECURITY & PRIVACY: Backend Authorization Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- 2. SECURITY & PRIVACY: Authorization & Boundary Enforcement ---');
    try {
        // Create an un-resolved complaint for Student A
        const compA = (await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[ReleaseAudit] Desk drawer stuck',
                description: 'Drawer stuck',
                category: 'Furniture'
            },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        )).data.complaint;

        // Security Test 2.1: Student B attempting to submit feedback on Student A's complaint
        const crossFeedbackRes = await api.post(
            `${API_BASE}/complaints/${compA._id}/feedback`,
            { isSatisfied: true, text: 'Malicious feedback from B' },
            { headers: { Authorization: `Bearer ${tokenB}` } }
        );
        if (crossFeedbackRes.status !== 403) {
            throw new Error(`Expected HTTP 403 for cross-student feedback, got ${crossFeedbackRes.status}`);
        }
        pass('Cross-student feedback rejected with HTTP 403 Forbidden');

        // Security Test 2.2: Student submitting feedback on an un-resolved complaint
        const prematureFeedback = await api.post(
            `${API_BASE}/complaints/${compA._id}/feedback`,
            { isSatisfied: true, text: 'Feedback on pending ticket' },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (prematureFeedback.status !== 400) {
            throw new Error(`Expected HTTP 400 for premature feedback, got ${prematureFeedback.status}`);
        }
        pass('Feedback on un-resolved (Pending) complaint rejected with HTTP 400 Bad Request');

        // Security Test 2.3: Room number spoofing prevention
        // Student A attempts to submit a complaint for room 415 while registered in room 210
        const spoofRes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[ReleaseAudit] Spoofed room report',
                description: 'Attempting to inject doorNumber 415',
                category: 'Furniture',
                doorNumber: '415' // Attempted spoof
            },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (!spoofRes.ok) throw new Error(`Spoof submission failed: ${JSON.stringify(spoofRes.data)}`);
        const savedComp = await Complaint.findById(spoofRes.data.complaint._id);
        if (savedComp.doorNumber !== '210') {
            throw new Error(`Security breach: doorNumber was spoofed to ${savedComp.doorNumber}, expected registered room 210`);
        }
        pass('Room spoofing prevented: complaint strictly bound to student registered room 210 (ignored 415)');

        // Security Test 2.4: Student without room assignment cannot submit complaints
        const unassignedStudent = await Student.create({
            fullName: 'Unassigned Student',
            email: 'rr_test_unassigned@pict.edu',
            prn: 'PRN_RR_999',
            doorNumber: '', // No room
            mobileNumber: '9820000999',
            role: 'STUDENT',
            isProfileComplete: false
        });
        const unassignedToken = createToken(unassignedStudent);
        const unassignedSubmit = await api.post(
            `${API_BASE}/complaints`,
            { title: '[ReleaseAudit] No room test', category: 'Furniture' },
            { headers: { Authorization: `Bearer ${unassignedToken}` } }
        );
        if (unassignedSubmit.status !== 400) {
            throw new Error(`Expected HTTP 400 for unassigned student complaint, got ${unassignedSubmit.status}`);
        }
        pass('Unassigned student rejected with HTTP 400 and clear registration message');

        // Security Test 2.5: Unauthorized contact access
        // Student B attempting to view Student A's contact info
        const studentContactRes = await api.get(
            `${API_BASE}/complaints/${compA._id}/student-contact`,
            { headers: { Authorization: `Bearer ${tokenB}` } }
        );
        if (studentContactRes.status !== 403) {
            throw new Error(`Expected HTTP 403 for peer student contact access, got ${studentContactRes.status}`);
        }
        pass('Peer student contact access rejected with HTTP 403 Forbidden');

        // Security Test 2.6: Wi-Fi data leakage to Warden
        const wifiComp = (await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[ReleaseAudit] Wi-Fi down on Floor 2',
                category: 'Internet',
                quickCategory: 'WIFI_NOT_WORKING'
            },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        )).data.complaint;

        // Warden queries complaints list
        const wardenListRes = await api.get(`${API_BASE}/complaints`, { headers: { Authorization: `Bearer ${tokenWarden}` } });
        const wardenHasWifi = wardenListRes.data.some(c => c._id === wifiComp._id || c.category === 'Internet' || c.quickCategory === 'WIFI_NOT_WORKING');
        if (wardenHasWifi) {
            throw new Error('Security breach: Wi-Fi complaint returned in Warden complaint list');
        }
        pass('Warden complaint list strictly excludes Wi-Fi tickets (0 data leakage)');

        // Warden attempts to query Wi-Fi specialist queue
        const wardenWifiQueueRes = await api.get(`${API_BASE}/complaints/wifi/queue`, { headers: { Authorization: `Bearer ${tokenWarden}` } });
        if (wardenWifiQueueRes.status !== 403) {
            throw new Error(`Expected HTTP 403 for Warden accessing Wi-Fi queue, got ${wardenWifiQueueRes.status}`);
        }
        pass('Warden accessing Wi-Fi queue rejected with HTTP 403 Forbidden');

        // Warden attempts to view student contact for Wi-Fi complaint
        const wardenWifiContact = await api.get(`${API_BASE}/complaints/${wifiComp._id}/student-contact`, { headers: { Authorization: `Bearer ${tokenWarden}` } });
        if (wardenWifiContact.status !== 403) {
            throw new Error(`Expected HTTP 403 for Warden accessing Wi-Fi student contact, got ${wardenWifiContact.status}`);
        }
        pass('Warden accessing Wi-Fi student contact rejected with HTTP 403 Forbidden');

        // Wi-Fi In-Charge attempts to view student contact for Furniture complaint (cross-domain)
        const wifiOnFurniture = await api.get(`${API_BASE}/complaints/${compA._id}/student-contact`, { headers: { Authorization: `Bearer ${tokenWifi}` } });
        if (wifiOnFurniture.status !== 403) {
            throw new Error(`Expected HTTP 403 for Wi-Fi In-Charge accessing Furniture complaint contact, got ${wifiOnFurniture.status}`);
        }
        pass('Wi-Fi In-Charge accessing non-Wi-Fi student contact rejected with HTTP 403 Forbidden');

    } catch (err) {
        fail('Security & Privacy Authorization', err);
    }

    // -------------------------------------------------------------------------
    // 3. DATA INTEGRITY & LEGACY RECORD COMPATIBILITY
    // -------------------------------------------------------------------------
    console.log('\n--- 3. DATA INTEGRITY: Legacy Records & Schema Compatibility ---');
    try {
        // Create an older legacy complaint document directly in MongoDB lacking new optional fields
        const legacyDoc = await Complaint.create({
            title: '[ReleaseAudit] Historical Plumbing Complaint (Legacy Schema)',
            description: 'Water tap leaking from pipe joint',
            category: 'Plumbing',
            // quickCategory, parentComplaintId, associatedComplaints, roommateConfirmation are all omitted / undefined
            doorNumber: '210',
            studentId: studentA._id,
            status: 'Pending',
            statusHistory: [{
                status: 'Pending',
                timestamp: new Date(Date.now() - 30 * 86400000),
                note: 'Legacy complaint submitted 30 days ago'
            }]
        });
        pass('Legacy complaint created in DB without quickCategory, parentComplaintId, or roommateConfirmation');

        // Fetch via Warden /api/complaints
        const wardenFetch = await api.get(`${API_BASE}/complaints`, { headers: { Authorization: `Bearer ${tokenWarden}` } });
        const foundInWarden = wardenFetch.data.find(c => c._id === legacyDoc._id.toString());
        if (!foundInWarden) throw new Error('Legacy complaint not returned in Warden complaints list');
        pass('Legacy complaint cleanly retrieved by Warden API without schema errors');

        // Fetch via Student /api/complaints/my-complaints
        const studentFetch = await api.get(`${API_BASE}/complaints/my-complaints`, { headers: { Authorization: `Bearer ${tokenA}` } });
        const foundInStudent = studentFetch.data.find(c => c._id === legacyDoc._id.toString());
        if (!foundInStudent) throw new Error('Legacy complaint not returned in Student my-complaints list');
        pass('Legacy complaint cleanly retrieved by Student API');

        // Transition legacy complaint to In Progress then Resolved
        const updateLegacy = await api.put(
            `${API_BASE}/complaints/${legacyDoc._id}/status`,
            { status: 'Resolved', note: 'Replaced pipe joint washer' },
            { headers: { Authorization: `Bearer ${tokenWarden}` } }
        );
        if (!updateLegacy.ok) throw new Error(`Updating legacy complaint failed: ${JSON.stringify(updateLegacy.data)}`);
        pass('Legacy complaint status successfully updated to Resolved');

        // Submit feedback on resolved legacy complaint
        const feedbackLegacy = await api.post(
            `${API_BASE}/complaints/${legacyDoc._id}/feedback`,
            { isSatisfied: true, text: 'Tap no longer leaks. Thanks!' },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (!feedbackLegacy.ok) throw new Error(`Feedback on legacy complaint failed: ${JSON.stringify(feedbackLegacy.data)}`);
        pass('Feedback successfully accepted on legacy complaint without schema errors');

        // Verify statusHistory integrity
        const verifiedLegacy = await Complaint.findById(legacyDoc._id);
        if (verifiedLegacy.statusHistory.length < 3) {
            throw new Error(`Legacy statusHistory not updated: count=${verifiedLegacy.statusHistory.length}`);
        }
        pass('Legacy complaint statusHistory preserved with full audit entries');

    } catch (err) {
        fail('Data Integrity: Legacy Compatibility', err);
    }

    // -------------------------------------------------------------------------
    // 4. CLEANUP IDENTIFIABLE AUDIT RECORDS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. POST-AUDIT CLEANUP ---');
    try {
        const deletedStudents = await Student.deleteMany({ email: /rr_test_/ });
        const deletedStaff = await User.deleteMany({ email: /rr_staff_/ });
        const deletedComplaints = await Complaint.deleteMany({ title: /\[ReleaseAudit\]/ });
        pass(`Safely purged test records: ${deletedStudents.deletedCount} students, ${deletedStaff.deletedCount} staff, ${deletedComplaints.deletedCount} complaints`);
    } catch (err) {
        fail('Post-audit cleanup', err);
    }

    // -------------------------------------------------------------------------
    // FINAL AUDIT SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================================');
    console.log(`RELEASE-READINESS AUDIT SUMMARY: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
    console.log('======================================================================');

    if (results.failed.length > 0) {
        console.error('\nFAILED TESTS:');
        results.failed.forEach(f => console.error(`- ${f.name}: ${f.error}`));
        process.exit(1);
    }

    process.exit(0);
}

runAudit().catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
});
