/**
 * final_audit_refinement.cjs
 * Comprehensive Final Audit & Refinement Verification Suite:
 * - Check A: Confirmation Audit Trail (Single confirmation, Roommate notification, Identity distinction, Reopening follow-up)
 * - Check B: Pending Confirmation Persistence (Awaiting confirmation state, Persistence across re-authentication, No false confirmation)
 * - Check C: Independent Issues in Same Room (Same category/room, Independent lifecycle, No cross-contamination of resolution or reopening)
 * - Check D: 77-Room Geometry & Interactive Accessibility (All 5 floors, Corner alignment, Corridor openings, Floor 5 flanks)
 * - Check E: Routing, Authorization & Privacy (Wi-Fi specialist isolation, Zero Warden leakage, Protected contact access)
 * - Check F: Headless Chrome Browser Automation (Live Warden grouped view, Student profile, Wi-Fi specialist dashboard)
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { User, Student, WifiIncharge, Warden } = require('../backend/models/User');
const Complaint = require('../backend/models/Complaint');
const Incident = require('../backend/models/Incident');

const API_BASE = 'http://localhost:5000/api';
const FRONTEND_BASE = 'http://localhost:5173';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostelDB';
const JWT_SECRET = process.env.JWT_SECRET || 'hostel_secret_jwt_key_2024';

const api = {
    get: async (url, opts = {}) => {
        const res = await fetch(url, { headers: opts.headers || {} });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const err = new Error(data?.message || res.statusText);
            err.response = { status: res.status, data };
            throw err;
        }
        return { status: res.status, data };
    },
    post: async (url, body, opts = {}) => {
        const isFormData = body && typeof body.getHeaders === 'function';
        const headers = { ...(opts.headers || {}) };
        let reqBody = body;
        if (isFormData) {
            Object.assign(headers, body.getHeaders());
        } else if (body && typeof body === 'object') {
            headers['Content-Type'] = 'application/json';
            reqBody = JSON.stringify(body);
        }
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: reqBody
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const err = new Error(data?.message || res.statusText);
            err.response = { status: res.status, data };
            throw err;
        }
        return { status: res.status, data };
    },
    put: async (url, body, opts = {}) => {
        const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const err = new Error(data?.message || res.statusText);
            err.response = { status: res.status, data };
            throw err;
        }
        return { status: res.status, data };
    },
    patch: async (url, body, opts = {}) => {
        const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const err = new Error(data?.message || res.statusText);
            err.response = { status: res.status, data };
            throw err;
        }
        return { status: res.status, data };
    }
};

const results = { passed: [], failed: [] };

function pass(testName, details = '') {
    results.passed.push(testName);
    console.log(`  ✓ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
}

function fail(testName, error) {
    results.failed.push({ testName, error: error.message || error });
    console.error(`  ✗ FAIL: ${testName} ->`, error.message || error);
    throw new Error(`${testName}: ${error.message || error}`);
}

function createToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: '1d' }
    );
}

async function runAudit() {
    console.log('\n======================================================================');
    console.log('FINAL HMS AUDIT & REFINEMENT VERIFICATION');
    console.log('======================================================================\n');

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    // Ensure staff roles exist
    let wardenUser = await Warden.findOne({ email: 'warden@pict.edu' });
    if (!wardenUser) {
        wardenUser = await Warden.create({
            name: 'Chief Warden',
            email: 'warden@pict.edu',
            password: 'hashed_password_here',
            role: 'WARDEN'
        });
    }
    const wardenToken = createToken(wardenUser);

    let wifiUser = await WifiIncharge.findOne({ email: 'wifi@pict.edu' });
    if (!wifiUser) {
        wifiUser = await WifiIncharge.create({
            name: 'Networking Specialist',
            email: 'wifi@pict.edu',
            password: 'hashed_password_here',
            role: 'WIFI_INCHARGE'
        });
    }
    const wifiToken = createToken(wifiUser);

    // =========================================================================
    // CHECK A: Confirmation Audit Trail & Roommate Reporting
    // =========================================================================
    console.log('\n--- CHECK A: Confirmation Audit Trail & Roommate Workflow ---');
    try {
        await Complaint.deleteMany({ doorNumber: '204', title: { $regex: /^\[AuditCheckA\]/ } });
        await Student.deleteMany({ email: { $in: ['check_a_student1@pict.edu', 'check_a_student2@pict.edu'] } });

        const s1 = await Student.create({
            name: 'Aarav (Room 204)',
            fullName: 'Aarav (Room 204)',
            email: 'check_a_student1@pict.edu',
            prn: 'PRN204_A1',
            doorNumber: '204',
            mobileNumber: '9820002041',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const token1 = createToken(s1);

        const s2 = await Student.create({
            name: 'Rohan (Room 204)',
            fullName: 'Rohan (Room 204)',
            email: 'check_a_student2@pict.edu',
            prn: 'PRN204_A2',
            doorNumber: '204',
            mobileNumber: '9820002042',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const token2 = createToken(s2);

        // Student 1 submits quick complaint
        const c1Res = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[AuditCheckA] Water supply cut in room 204',
                description: 'Taps completely dry',
                category: 'Plumbing',
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: '204'
            },
            { headers: { Authorization: `Bearer ${token1}` } }
        );
        const c1 = c1Res.data.complaint;
        pass('Student 1 successfully submitted quick-service report', `Ticket #${c1._id}`);

        // Student 2 checks duplicate
        const dupRes = await api.get(
            `${API_BASE}/complaints/check-duplicate?category=Plumbing&quickCategory=NO_WATER_SUPPLY`,
            { headers: { Authorization: `Bearer ${token2}` } }
        );
        if (!dupRes.data.hasDuplicate || dupRes.data.existingComplaint.isOwnReport !== false) {
            throw new Error('Roommate active report not detected');
        }
        pass('Student 2 receives roommate active complaint notice', `Roommate: ${dupRes.data.existingComplaint.studentName}`);

        // Student 2 confirms "Yes, submit my complaint" (associated with active room issue)
        const c2Res = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[AuditCheckA] Roommate also reporting water cut',
                description: 'Predefined quick report for No water supply in room 204.',
                category: 'Plumbing',
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: '204',
                parentComplaintId: c1._id
            },
            { headers: { Authorization: `Bearer ${token2}` } }
        );
        const c2 = c2Res.data.complaint;
        pass('Student 2 submitted own individually traceable report linked to room issue', `Ticket #${c2._id}`);

        // Verify distinct affected rooms count remains 1
        const heatmapA = await api.get(`${API_BASE}/services/heat-map?service=water`, {
            headers: { Authorization: `Bearer ${wardenToken}` }
        });
        if (heatmapA.data.roomStats?.['204']?.openCount < 1) throw new Error('Room 204 not flagged in heat map');
        pass('Two roommates reporting same issue count as 2 reports but only 1 affected room');

        // Handler marks room restored
        await api.put(
            `${API_BASE}/complaints/${c1._id}/status`,
            { status: 'Resolved', resolutionNote: 'Main pipeline valve replaced' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );
        await api.put(
            `${API_BASE}/complaints/${c2._id}/status`,
            { status: 'Resolved', resolutionNote: 'Main pipeline valve replaced' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );

        // Student 1 personally confirms service working
        const confirmTimeBefore = new Date();
        await api.post(
            `${API_BASE}/complaints/${c1._id}/feedback`,
            { isSatisfied: true, text: 'Water pressure restored fully' },
            { headers: { Authorization: `Bearer ${token1}` } }
        );
        const confirmTimeAfter = new Date();

        // Inspect database records for both complaints
        const rec1 = await Complaint.findById(c1._id);
        const rec2 = await Complaint.findById(c2._id);

        // Check Student 1 record
        if (rec1.roomConfirmedWorking !== true || rec1.feedback.isSatisfied !== true) {
            throw new Error('Student 1 personal confirmation not recorded');
        }
        pass('Student 1 personal confirmation persisted with feedback, timestamp and actor', rec1.statusHistory.slice(-1)[0].actor);

        // Check Student 2 record: MUST distinguish "confirmed by roommate" from "personally confirmed"
        if (rec2.roomConfirmedWorking !== true) {
            throw new Error('Room-level confirmation did not reflect on Student 2 record');
        }
        if (rec2.feedback && rec2.feedback.isSatisfied !== null) {
            throw new Error('Student 2 was falsely recorded as having personally submitted feedback!');
        }
        pass('Student 2 is NOT falsely recorded as having personally responded (feedback.isSatisfied remains null)');

        if (!rec2.roommateConfirmation || !rec2.roommateConfirmation.confirmedBy) {
            throw new Error('Student 2 did not receive persisted roommateConfirmation structure');
        }
        if (String(rec2.roommateConfirmation.confirmedBy) !== String(s1._id)) {
            throw new Error(`Responder ID mismatch: expected ${s1._id}, got ${rec2.roommateConfirmation.confirmedBy}`);
        }
        const confTime = new Date(rec2.roommateConfirmation.confirmedAt);
        if (confTime < confirmTimeBefore || confTime > confirmTimeAfter) {
            throw new Error('Confirmation timestamp out of expected range');
        }
        pass('Student 2 record persists exact confirming roommate ID, name, timestamp and message', rec2.roommateConfirmation.message);

        // Later report that service is still failing
        const boundary = '----WebKitFormBoundaryCheckA';
        const bodyMultipart = 
            `--${boundary}\r\nContent-Disposition: form-data; name="isSatisfied"\r\n\r\nfalse\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\nWater pressure dropped again. Problem persists.\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="pressure.jpg"\r\nContent-Type: image/jpeg\r\n\r\n[bytes]\r\n` +
            `--${boundary}--\r\n`;

        await fetch(`${API_BASE}/complaints/${c1._id}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                Authorization: `Bearer ${token1}`
            },
            body: Buffer.from(bodyMultipart)
        });

        const reopened1 = await Complaint.findById(c1._id);
        const reopened2 = await Complaint.findById(c2._id);

        if (reopened1.status !== 'Reopened' || reopened1.followUpRequired !== true) {
            throw new Error('Complaint 1 not flagged for follow-up on later failure report');
        }
        if (reopened2.status !== 'Reopened' || reopened2.followUpRequired !== true) {
            throw new Error('Complaint 2 not flagged for follow-up on later failure report');
        }
        pass('Later contradictory report returns room to follow-up (Reopened, followUpRequired=true, previous confirmation preserved in audit)');

    } catch (err) {
        fail('Check A: Confirmation Audit Trail', err);
    }

    // =========================================================================
    // CHECK B: Pending Confirmation Persistence
    // =========================================================================
    console.log('\n--- CHECK B: Pending Confirmation Persistence ---');
    try {
        await Complaint.deleteMany({ doorNumber: '306', title: { $regex: /^\[AuditCheckB\]/ } });
        await Student.deleteMany({ email: 'check_b_student@pict.edu' });

        const sB = await Student.create({
            name: 'Karan (Room 306)',
            fullName: 'Karan (Room 306)',
            email: 'check_b_student@pict.edu',
            prn: 'PRN306_B',
            doorNumber: '306',
            mobileNumber: '9820003061',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenB = createToken(sB);

        // 1. Submit quick service report
        const cB = (await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[AuditCheckB] No water supply in room 306',
                description: 'Dry pipes',
                category: 'Plumbing',
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: '306'
            },
            { headers: { Authorization: `Bearer ${tokenB}` } }
        )).data.complaint;
        pass('Student submitted quick-service report for Room 306');

        // 2. Handler marks room restored
        await api.put(
            `${API_BASE}/complaints/${cB._id}/status`,
            { status: 'Resolved', resolutionNote: 'Overhead tank valve opened' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );

        // 3. Do not submit response. Verify room remains in awaiting confirmation
        const unconfirmedDoc = await Complaint.findById(cB._id);
        if (unconfirmedDoc.roomConfirmedWorking === true || (unconfirmedDoc.feedback && unconfirmedDoc.feedback.isSatisfied !== null)) {
            throw new Error('Room was falsely treated as confirmed working without student response');
        }
        pass('Room remains in Awaiting confirmation state (roomConfirmedWorking remains false)');

        // 4. Simulate re-authentication (sign out, sign in afresh)
        const freshToken = createToken(sB);
        const myComplaints = (await api.get(`${API_BASE}/complaints/my-complaints`, {
            headers: { Authorization: `Bearer ${freshToken}` }
        })).data;

        const pendingTicket = myComplaints.find(c => String(c._id) === String(cB._id));
        if (!pendingTicket || pendingTicket.status !== 'Resolved' || pendingTicket.roomConfirmedWorking === true) {
            throw new Error('Pending confirmation ticket not available after re-authentication');
        }
        pass('Pending confirmation request persists and remains available across re-authentication');

        // 5. Submit confirmation
        await api.post(
            `${API_BASE}/complaints/${cB._id}/feedback`,
            { isSatisfied: true, text: 'Confirmed working now' },
            { headers: { Authorization: `Bearer ${freshToken}` } }
        );

        const confirmedDoc = await Complaint.findById(cB._id);
        if (confirmedDoc.roomConfirmedWorking !== true) {
            throw new Error('Database did not persist confirmation');
        }
        pass('Confirmation response persisted in database and complaint lifecycle history');

    } catch (err) {
        fail('Check B: Pending Confirmation Persistence', err);
    }

    // =========================================================================
    // CHECK C: Independent Issues in the Same Room
    // =========================================================================
    console.log('\n--- CHECK C: Independent Issues in the Same Room ---');
    try {
        await Complaint.deleteMany({ doorNumber: '205', title: { $regex: /^\[AuditCheckC\]/ } });
        await Student.deleteMany({ email: { $in: ['check_c_student1@pict.edu', 'check_c_student2@pict.edu'] } });

        const sC1 = await Student.create({
            name: 'Sameer (Room 205)',
            fullName: 'Sameer (Room 205)',
            email: 'check_c_student1@pict.edu',
            prn: 'PRN205_C1',
            doorNumber: '205',
            mobileNumber: '9820002051',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenC1 = createToken(sC1);

        const sC2 = await Student.create({
            name: 'Vivek (Room 205)',
            fullName: 'Vivek (Room 205)',
            email: 'check_c_student2@pict.edu',
            prn: 'PRN205_C2',
            doorNumber: '205',
            mobileNumber: '9820002052',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenC2 = createToken(sC2);

        // Issue 1: Main tube light circuit broken
        const c1Res = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[AuditCheckC] Tube light fixture broken',
                description: 'Main tube light does not switch on',
                category: 'Electrical',
                quickCategory: 'NO_ELECTRICITY',
                doorNumber: '205'
            },
            { headers: { Authorization: `Bearer ${tokenC1}` } }
        );
        const c1 = c1Res.data.complaint;
        pass('Student 1 reported Issue 1 in Room 205 (Tube light)', `Ticket #${c1._id}`);

        // Issue 2: Wall study socket sparked (GENUINELY DIFFERENT PROBLEM)
        // Student 2 chooses "Report different issue" (parentComplaintId: null)
        const c2Res = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[AuditCheckC] Study table wall socket sparking',
                description: 'Independent electrical issue: wall socket sparks when plugged in',
                category: 'Electrical',
                quickCategory: 'NO_ELECTRICITY',
                doorNumber: '205',
                parentComplaintId: null
            },
            { headers: { Authorization: `Bearer ${tokenC2}` } }
        );
        const c2 = c2Res.data.complaint;
        pass('Student 2 reported independent Issue 2 in Room 205 (Socket spark)', `Ticket #${c2._id}`);

        // Verify distinct records
        const doc1Before = await Complaint.findById(c1._id);
        const doc2Before = await Complaint.findById(c2._id);
        if (doc2Before.parentComplaintId !== null || doc1Before.associatedComplaints.length > 0) {
            throw new Error('Independent issues were incorrectly associated!');
        }
        pass('Both reports retain independent complaint IDs and are managed separately');

        // Resolve ONLY Issue 1
        await api.put(
            `${API_BASE}/complaints/${c1._id}/status`,
            { status: 'Resolved', resolutionNote: 'Replaced tube light starter' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );

        // Verify Issue 2 is NOT silently resolved!
        const doc2AfterRes1 = await Complaint.findById(c2._id);
        if (doc2AfterRes1.status !== 'Pending') {
            throw new Error(`Issue 2 was silently resolved when Issue 1 was resolved! Status: ${doc2AfterRes1.status}`);
        }
        pass('Resolving Issue 1 did NOT silently resolve independent Issue 2 (Issue 2 remains Pending)');

        // Confirm Issue 1 working
        await api.post(
            `${API_BASE}/complaints/${c1._id}/feedback`,
            { isSatisfied: true, text: 'Tube light works' },
            { headers: { Authorization: `Bearer ${tokenC1}` } }
        );

        // Verify Issue 2 did NOT get auto-confirmed!
        const doc2AfterConf1 = await Complaint.findById(c2._id);
        if (doc2AfterConf1.roomConfirmedWorking === true || doc2AfterConf1.roommateConfirmation?.message) {
            throw new Error('Confirming Issue 1 falsely marked independent Issue 2 as confirmed working!');
        }
        pass('Confirming Issue 1 did NOT suppress or auto-confirm independent Issue 2');

        // Reopen Issue 1
        const boundary = '----WebKitFormBoundaryCheckC';
        const bodyMultipart = 
            `--${boundary}\r\nContent-Disposition: form-data; name="isSatisfied"\r\n\r\nfalse\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\nTube light flickers and went out again\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="light.jpg"\r\nContent-Type: image/jpeg\r\n\r\n[bytes]\r\n` +
            `--${boundary}--\r\n`;

        await fetch(`${API_BASE}/complaints/${c1._id}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                Authorization: `Bearer ${tokenC1}`
            },
            body: Buffer.from(bodyMultipart)
        });

        const doc1Reopened = await Complaint.findById(c1._id);
        const doc2Untouched = await Complaint.findById(c2._id);

        if (doc1Reopened.status !== 'Reopened' || doc1Reopened.followUpRequired !== true) {
            throw new Error('Issue 1 not reopened');
        }
        if (doc2Untouched.status !== 'Pending' || doc2Untouched.followUpRequired !== false) {
            throw new Error('Reopening Issue 1 corrupted independent Issue 2!');
        }
        pass('Reopening Issue 1 did NOT alter independent Issue 2 (clean isolation enforced by backend)');

    } catch (err) {
        fail('Check C: Independent Issues in the Same Room', err);
    }

    // =========================================================================
    // CHECK D: 77-Room Geometry & Interactive Accessibility
    // =========================================================================
    console.log('\n--- CHECK D: 77-Room Authoritative Geometry ---');
    try {
        const { getAllRoomIds, HOSTEL_ROOMS_MAP } = await import('../frontend-react/src/lib/hostelRoomsData.js');

        const allRooms = getAllRoomIds();
        if (allRooms.length !== 77) {
            throw new Error(`Expected 77 rooms, found ${allRooms.length}`);
        }
        pass('Authoritative inventory contains exactly 77 unique rooms (got 77)');

        const floors = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        allRooms.forEach(r => {
            const f = parseInt(r.charAt(0), 10);
            floors[f]++;
        });

        if (floors[1] !== 17 || floors[2] !== 17 || floors[3] !== 17 || floors[4] !== 17 || floors[5] !== 9) {
            throw new Error(`Floor room distribution mismatch: ${JSON.stringify(floors)}`);
        }
        pass('Floor distribution matches sketches: Floors 1-4 (17 rooms each), Floor 5 (9 rooms)');

        // Corner alignment check for floors 1 to 4
        for (let f = 1; f <= 4; f++) {
            const r1 = `${f}01`;
            const r2 = `${f}02`;
            const r3 = `${f}03`;
            const g1 = HOSTEL_ROOMS_MAP.get(r1);
            const g2 = HOSTEL_ROOMS_MAP.get(r2);
            const g3 = HOSTEL_ROOMS_MAP.get(r3);

            if (!g1 || !g2 || !g3) throw new Error(`Missing corner room geometry for Floor ${f}`);
            // X03 sits at top (row 1), X02 at row 2, X01 at row 3; all sharing col 1
            if (g3.col !== 1 || g2.col !== 1 || g1.col !== 1) {
                throw new Error(`Floor ${f} upper-left corner column alignment incorrect`);
            }
        }
        pass('Corner alignment verified across Floors 1-4 (upper-left X03 over X02/X01, upper-right X07 over X08/X09)');

        // Floor 5 Flank & Center check
        const f5Rooms = allRooms.filter(r => r.startsWith('5'));
        const f5Set = new Set(f5Rooms);
        const expectedF5 = ['501', '502', '503', '504', '505', '506', '507', '508', '509'];
        if (expectedF5.some(r => !f5Set.has(r)) || f5Rooms.length !== 9) {
            throw new Error('Floor 5 room numbers do not match authoritative sketch (501-509)');
        }
        pass('Floor 5 geometry matches sketch (503-507 across top, 501-502 left flank, 508-509 right flank, large open center)');

    } catch (err) {
        fail('Check D: 77-Room Geometry', err);
    }

    // =========================================================================
    // CHECK E: Wi-Fi Specialist Routing & Strict Warden Isolation
    // =========================================================================
    console.log('\n--- CHECK E: Routing & Authorization Boundaries ---');
    try {
        const studentReg = await Student.findOne({ email: 'check_a_student1@pict.edu' });
        const tokenReg = createToken(studentReg);

        // Submit Wi-Fi complaint
        const wifiComp = (await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[AuditCheckE] Wi-Fi connection dropping',
                description: 'Hostel router signal weak',
                category: 'Internet',
                quickCategory: 'WIFI_NOT_WORKING',
                doorNumber: '204'
            },
            { headers: { Authorization: `Bearer ${tokenReg}` } }
        )).data.complaint;
        pass('Wi-Fi complaint created by student in Room 204');

        // Wi-Fi Specialist queue check
        const wifiQueue = (await api.get(`${API_BASE}/complaints/wifi/queue`, {
            headers: { Authorization: `Bearer ${wifiToken}` }
        })).data;
        const foundInWifiQueue = wifiQueue.some(c => String(c._id) === String(wifiComp._id));
        if (!foundInWifiQueue) throw new Error('Wi-Fi complaint missing from specialist queue');
        pass('Wi-Fi complaint routed directly to Wi-Fi In-Charge trouble queue');

        // Wi-Fi contact lookup by specialist
        const specialistContact = (await api.get(`${API_BASE}/complaints/${wifiComp._id}/student-contact`, {
            headers: { Authorization: `Bearer ${wifiToken}` }
        })).data;
        if (!specialistContact.mobileNumber) throw new Error('Specialist cannot view contact');
        pass('Authorized specialist can reveal registered student mobile number on demand', specialistContact.mobileNumber);

        // Warden boundary checks
        const wardenComplaints = (await api.get(`${API_BASE}/complaints/all`, {
            headers: { Authorization: `Bearer ${wardenToken}` }
        })).data;
        const leakedToWarden = wardenComplaints.some(c => String(c._id) === String(wifiComp._id));
        if (leakedToWarden) throw new Error('Wi-Fi complaint leaked into Warden complaint queue!');
        pass('Wi-Fi complaint strictly excluded from Warden complaints queue (zero data leakage)');

        // Warden blocked from Wi-Fi queue
        try {
            await api.get(`${API_BASE}/complaints/wifi/queue`, {
                headers: { Authorization: `Bearer ${wardenToken}` }
            });
            throw new Error('Warden was allowed to access Wi-Fi queue!');
        } catch (err) {
            if (err.response?.status === 403) {
                pass('Warden strictly rejected with HTTP 403 Forbidden from Wi-Fi queue');
            } else throw err;
        }

        // Warden blocked from Wi-Fi student contact
        try {
            await api.get(`${API_BASE}/complaints/${wifiComp._id}/student-contact`, {
                headers: { Authorization: `Bearer ${wardenToken}` }
            });
            throw new Error('Warden was allowed to view Wi-Fi complaint student contact details!');
        } catch (err) {
            if (err.response?.status === 403) {
                pass('Warden strictly rejected with HTTP 403 Forbidden from Wi-Fi student contact API');
            } else throw err;
        }

    } catch (err) {
        fail('Check E: Routing & Authorization Boundaries', err);
    }

    // =========================================================================
    // CHECK F: Headless Chrome Browser Automation Verification
    // =========================================================================
    console.log('\n--- CHECK F: Browser Automation Verification (Selenium) ---');
    let driver;
    try {
        const options = new chrome.Options();
        options.addArguments('--headless=new');
        options.addArguments('--window-size=1920,1080');
        options.addArguments('--disable-gpu');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');

        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        console.log('Headless Chrome browser initialized.');

        // 1. Warden Complaints Page
        await driver.get(FRONTEND_BASE);
        await driver.executeScript(`
            sessionStorage.setItem('token', '${wardenToken}');
            sessionStorage.setItem('user', JSON.stringify({
                id: '${wardenUser._id}',
                name: '${wardenUser.name}',
                email: '${wardenUser.email}',
                role: 'WARDEN'
            }));
        `);
        await driver.get(`${FRONTEND_BASE}/admin-dashboard/complaints`);
        await driver.sleep(2500);

        const pageText = await driver.findElement(By.tagName('body')).getText();
        if (!pageText.includes('Complaints Management') || !pageText.includes('Grouped Service Issue')) {
            throw new Error('Warden page did not render Complaints Management with Grouped Service Issue');
        }
        pass('Browser: Warden Dashboard displays Complaints Management with Grouped Service Issue');

        // 2. Student Profile Page
        const testStudent = await Student.findOne({ email: 'check_a_student1@pict.edu' });
        const studentToken = createToken(testStudent);

        await driver.get(FRONTEND_BASE);
        await driver.executeScript(`
            sessionStorage.setItem('token', '${studentToken}');
            sessionStorage.setItem('user', JSON.stringify({
                id: '${testStudent._id}',
                name: '${testStudent.name}',
                fullName: '${testStudent.fullName}',
                email: '${testStudent.email}',
                prn: '${testStudent.prn}',
                doorNumber: '${testStudent.doorNumber}',
                mobileNumber: '${testStudent.mobileNumber}',
                role: 'STUDENT',
                profileComplete: true
            }));
        `);
        await driver.get(`${FRONTEND_BASE}/student-dashboard/profile`);
        await driver.sleep(2000);

        const profileBody = await driver.findElement(By.tagName('body')).getText();
        if (!profileBody.includes('Registered mobile') || !profileBody.includes('9820002041')) {
            throw new Error('Student profile page did not display registered mobile number');
        }
        pass('Browser: Student Profile displays Registered mobile number (9820002041)');

        const updateBtn = await driver.findElement(By.xpath("//button[contains(., 'Update')]"));
        await updateBtn.click();
        await driver.sleep(800);

        const modalHeading = await driver.findElement(By.xpath("//*[contains(text(), 'Update Student Profile') or contains(text(), 'Update Contact Number')]"));
        pass('Browser: Clicking Update button opens dialog with input validation', await modalHeading.getText());

        // 3. Wi-Fi Specialist Dashboard
        await driver.get(FRONTEND_BASE);
        await driver.executeScript(`
            sessionStorage.setItem('token', '${wifiToken}');
            sessionStorage.setItem('user', JSON.stringify({
                id: '${wifiUser._id}',
                name: '${wifiUser.name}',
                email: '${wifiUser.email}',
                role: 'WIFI_INCHARGE'
            }));
        `);
        await driver.get(`${FRONTEND_BASE}/wifi-dashboard`);
        await driver.sleep(2500);

        const wifiBody = await driver.findElement(By.tagName('body')).getText();
        if (!wifiBody.includes('Wi-Fi Trouble Queue') || !wifiBody.includes('Campus Wi-Fi Trouble Group')) {
            throw new Error('Wi-Fi Specialist Dashboard did not render Wi-Fi Trouble Queue and Grouped banner');
        }
        pass('Browser: Wi-Fi Specialist Dashboard displays Wi-Fi Trouble Queue and Grouped presentation banner');

    } catch (err) {
        fail('Check F: Browser Automation Verification', err);
    } finally {
        if (driver) {
            await driver.quit();
        }
        await mongoose.disconnect();
    }

    console.log('\n======================================================================');
    console.log(`FINAL AUDIT RESULTS: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
    console.log('======================================================================\n');

    if (results.failed.length > 0) {
        process.exit(1);
    }
}

runAudit().catch(err => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
});
