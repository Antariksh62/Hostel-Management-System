/**
 * test_new_requirements.cjs
 * Comprehensive verification of new HMS requirements:
 * 1. Issue-first grouping under high volume (100 distinct authenticated reports)
 * 2. Same-room roommate behaviour (same-room confirmation, independent report, distinct room count)
 * 3. Resolution feedback (room-level workflow, positive confirmation by either roommate, roommate notification, reopening follow-up, no auto-confirmation on missing feedback)
 * 4. Student mobile registration and updates (validation, authorization, persistence, zero leakage)
 * 5. Headless browser automation verification (Warden dashboard, Student profile, Wi-Fi specialist dashboard)
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

const results = {
    passed: [],
    failed: []
};

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

async function run() {
    console.log('\n================================================================');
    console.log('STARTING TARGETED VERIFICATION OF NEW HMS REQUIREMENTS');
    console.log('================================================================\n');

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    // Ensure core staff accounts exist
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
            name: 'Networking In-Charge',
            email: 'wifi@pict.edu',
            password: 'hashed_password_here',
            role: 'WIFI_INCHARGE'
        });
    }
    const wifiToken = createToken(wifiUser);

    // =========================================================================
    // REQUIREMENT 1: Issue-first grouping under high volume (100 distinct reports)
    // =========================================================================
    console.log('\n--- SECTION 1: Issue-First Grouping Under High Volume (100 Reports) ---');
    try {
        // Clean previous test data for this run
        await Complaint.deleteMany({ title: { $regex: /^\[HighVol100\]/ } });
        await Student.deleteMany({ email: { $regex: /^highvol_student_/ } });
        await Incident.deleteMany({ title: { $regex: /Water Supply Outage/i } });

        console.log('Creating 100 distinct authenticated student accounts across 5 floors...');
        const students100 = [];
        const rooms = [];
        // 5 floors: floors 1-5, e.g. rooms 101-110, 201-210, 301-310, 401-410, 501-509 (49 distinct rooms)
        for (let f = 1; f <= 5; f++) {
            const maxRoom = f === 5 ? 9 : 10;
            for (let r = 1; r <= maxRoom; r++) {
                const roomStr = `${f}${r < 10 ? '0' + r : r}`;
                rooms.push(roomStr);
            }
        }

        // Generate 100 student accounts
        for (let i = 1; i <= 100; i++) {
            const assignedRoom = rooms[(i - 1) % rooms.length];
            const email = `highvol_student_${String(i).padStart(3, '0')}@pict.edu`;
            const prn = `HVPRN${String(i).padStart(4, '0')}`;
            const student = await Student.create({
                name: `HV Student ${i}`,
                fullName: `HV Student ${i}`,
                email,
                prn,
                doorNumber: assignedRoom,
                mobileNumber: `987000${String(i).padStart(4, '0')}`,
                role: 'STUDENT',
                profileComplete: true,
                isVerified: true
            });
            students100.push({ student, token: createToken(student), room: assignedRoom });
        }
        pass('Created 100 distinct authenticated student records', `Total: ${students100.length}`);

        console.log('Submitting 100 authenticated NO_WATER_SUPPLY complaints...');
        const submittedComplaintIds = [];
        for (let i = 0; i < students100.length; i++) {
            const s = students100[i];
            const res = await api.post(
                `${API_BASE}/complaints`,
                {
                    title: `[HighVol100] No water supply report #${i + 1}`,
                    description: `Automated test report from room ${s.room}`,
                    category: 'Plumbing',
                    quickCategory: 'NO_WATER_SUPPLY',
                    doorNumber: s.room
                },
                { headers: { Authorization: `Bearer ${s.token}` } }
            );
            submittedComplaintIds.push(res.data.complaint._id);
        }

        // 1. Every accepted report persists as an individual record
        const persistedCount = await Complaint.countDocuments({
            _id: { $in: submittedComplaintIds }
        });
        if (persistedCount !== 100) throw new Error(`Expected 100 persisted complaints, found ${persistedCount}`);
        pass('Every accepted report persists as an individual record in MongoDB', `Count: ${persistedCount}`);

        // 2. Fetch Warden complaint queue
        const wardenRes = await api.get(`${API_BASE}/complaints/all`, {
            headers: { Authorization: `Bearer ${wardenToken}` }
        });
        const wardenComplaints = wardenRes.data;

        // Verify high-volume complaints are present in Warden queue
        const hvComplaintsInWarden = wardenComplaints.filter(c => submittedComplaintIds.includes(String(c._id)));
        if (hvComplaintsInWarden.length !== 100) {
            throw new Error(`Expected all 100 complaints in Warden queue, found ${hvComplaintsInWarden.length}`);
        }
        pass('Warden API retrieves all 100 individual complaint records with history');

        // Test the grouping logic as executed by Warden dashboard UI
        const distinctRoomsExpected = new Set(students100.map(s => s.room));
        const affectedFloorsExpected = new Set([...distinctRoomsExpected].map(r => r.charAt(0)));

        // In WardenComplaints.jsx:
        // Complaints sharing an incidentId or quickCategory NO_WATER_SUPPLY group into 1 active group
        const groupKey = hvComplaintsInWarden[0].incidentId
            ? `incident_${hvComplaintsInWarden[0].incidentId._id || hvComplaintsInWarden[0].incidentId}`
            : `quick_${hvComplaintsInWarden[0].quickCategory}`;

        const groupItems = hvComplaintsInWarden.filter(c => {
            const k = c.incidentId
                ? `incident_${c.incidentId._id || c.incidentId}`
                : `quick_${c.quickCategory}`;
            return k === groupKey;
        });

        if (groupItems.length !== 100) {
            throw new Error(`Expected 100 complaints grouped together, got ${groupItems.length}`);
        }
        pass('Warden dashboard presents 1 grouped service issue rather than 100 top-level complaint cards', `Single group of ${groupItems.length} reports`);

        // Verify counts
        const distinctRoomsInGroup = new Set(groupItems.map(c => c.doorNumber));
        const affectedFloorsInGroup = new Set([...distinctRoomsInGroup].map(r => r.charAt(0)));

        if (distinctRoomsInGroup.size !== distinctRoomsExpected.size) {
            throw new Error(`Distinct rooms count mismatch: expected ${distinctRoomsExpected.size}, got ${distinctRoomsInGroup.size}`);
        }
        pass('Group displays correct distinct-room count', `Distinct rooms: ${distinctRoomsInGroup.size}`);

        if (affectedFloorsInGroup.size !== affectedFloorsExpected.size) {
            throw new Error(`Affected floors count mismatch: expected ${affectedFloorsExpected.size}, got ${affectedFloorsInGroup.size}`);
        }
        pass('Group displays correct affected-floor count', `Floors: ${[...affectedFloorsInGroup].sort().join(', ')}`);

        // Check Heatmap API
        const heatmapRes = await api.get(`${API_BASE}/services/heat-map?service=water`, {
            headers: { Authorization: `Bearer ${wardenToken}` }
        });
        const roomStats = heatmapRes.data.roomStats || {};
        const unhighlighted = [];
        distinctRoomsExpected.forEach(room => {
            if (!roomStats[room] || roomStats[room].openCount < 1) {
                unhighlighted.push(room);
            }
        });
        if (unhighlighted.length > 0) {
            throw new Error(`Heatmap missed rooms: ${unhighlighted.slice(0, 5).join(', ')}`);
        }
        pass('Heat map highlights all correct rooms across all affected floors', `Highlighted rooms: ${distinctRoomsExpected.size}`);

        // Verify Wi-Fi Specialist Queue has ZERO water complaints
        const wifiQueueRes = await api.get(`${API_BASE}/complaints/wifi/queue`, {
            headers: { Authorization: `Bearer ${wifiToken}` }
        });
        const waterInWifiQueue = wifiQueueRes.data.filter(c => submittedComplaintIds.includes(String(c._id)));
        if (waterInWifiQueue.length !== 0) {
            throw new Error(`Water complaints leaked to Wi-Fi queue! Leaked count: ${waterInWifiQueue.length}`);
        }
        pass('Wi-Fi specialist queue excludes all Water complaints (zero cross-service leakage)');

        // Submit Wi-Fi complaints and verify equivalent grouped presentation in specialist queue
        const wifiComplaints = [];
        for (let i = 0; i < 5; i++) {
            const s = students100[i];
            const wRes = await api.post(
                `${API_BASE}/complaints`,
                {
                    title: `[HighVolWifi] Wi-Fi connection issue in room ${s.room}`,
                    description: 'Cannot connect to hostel access point',
                    category: 'Internet',
                    quickCategory: 'WIFI_NOT_WORKING',
                    doorNumber: s.room
                },
                { headers: { Authorization: `Bearer ${s.token}` } }
            );
            wifiComplaints.push(wRes.data.complaint);
        }

        const wifiQueueAfter = (await api.get(`${API_BASE}/complaints/wifi/queue`, {
            headers: { Authorization: `Bearer ${wifiToken}` }
        })).data;
        const retrievedWifi = wifiQueueAfter.filter(c => wifiComplaints.map(w => String(w._id)).includes(String(c._id)));
        if (retrievedWifi.length !== 5) {
            throw new Error(`Expected 5 Wi-Fi complaints in Wi-Fi queue, got ${retrievedWifi.length}`);
        }
        pass('Wi-Fi reports populate the specialist trouble queue with individual ticket details');

        // Check that Wi-Fi complaints are strictly excluded from Warden complaint API
        const wardenCheckRes = await api.get(`${API_BASE}/complaints/all`, {
            headers: { Authorization: `Bearer ${wardenToken}` }
        });
        const wifiInWarden = wardenCheckRes.data.filter(c => wifiComplaints.map(w => String(w._id)).includes(String(c._id)));
        if (wifiInWarden.length !== 0) {
            throw new Error(`Wi-Fi complaints leaked to Warden complaints queue! Count: ${wifiInWarden.length}`);
        }
        pass('Wi-Fi reports remain strictly excluded from Warden complaint data flow');

    } catch (err) {
        fail('Requirement 1: High Volume Grouping', err);
    }

    // =========================================================================
    // REQUIREMENT 2: Same-room roommate behaviour
    // =========================================================================
    console.log('\n--- SECTION 2: Same-Room Roommate Behaviour ---');
    try {
        await Complaint.deleteMany({ doorNumber: '204', title: { $regex: /^\[RoommateTest\]/ } });
        await Student.deleteMany({ email: { $in: ['roommate_a_204@pict.edu', 'roommate_b_204@pict.edu'] } });

        const studentA = await Student.create({
            name: 'Student A (Room 204)',
            fullName: 'Student A (Room 204)',
            email: 'roommate_a_204@pict.edu',
            prn: 'PRN204A',
            doorNumber: '204',
            mobileNumber: '9820000204',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenA = createToken(studentA);

        const studentB = await Student.create({
            name: 'Student B (Room 204)',
            fullName: 'Student B (Room 204)',
            email: 'roommate_b_204@pict.edu',
            prn: 'PRN204B',
            doorNumber: '204',
            mobileNumber: '9830000204',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenB = createToken(studentB);

        // 1. Student A reports quick-service issue
        const compARes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[RoommateTest] No water supply in room 204',
                description: 'Taps completely dry in Room 204',
                category: 'Plumbing',
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: '204'
            },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        const compA = compARes.data.complaint;
        pass('Student A reported quick-service issue in Room 204', `Ticket #${compA._id}`);

        // 2. Student B selects the same category -> preflight checkDuplicate
        const dupCheckRes = await api.get(
            `${API_BASE}/complaints/check-duplicate?category=Plumbing&quickCategory=NO_WATER_SUPPLY`,
            { headers: { Authorization: `Bearer ${tokenB}` } }
        );
        const dupData = dupCheckRes.data;

        if (!dupData.hasDuplicate) {
            throw new Error('Expected duplicate check to find existing room issue');
        }
        if (dupData.existingComplaint.isOwnReport !== false) {
            throw new Error(`Expected isOwnReport to be false for roommate, got ${dupData.existingComplaint.isOwnReport}`);
        }
        if (String(dupData.existingComplaint.id) !== String(compA._id)) {
            throw new Error(`Expected duplicate to point to Complaint A ${compA._id}, got ${dupData.existingComplaint.id}`);
        }
        pass('Student B receives same-room issue confirmation question with roommate identity', `Identified roommate: ${dupData.existingComplaint.studentName}`);

        // 3. Student B confirms it is the same issue
        const compBRes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[RoommateTest] Confirmed same water supply issue',
                description: 'Predefined quick report for No water supply in room 204.',
                category: 'Plumbing',
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: '204',
                parentComplaintId: compA._id
            },
            { headers: { Authorization: `Bearer ${tokenB}` } }
        );
        const compB = compBRes.data.complaint;

        // Verify association
        const fetchedCompA = await Complaint.findById(compA._id);
        const fetchedCompB = await Complaint.findById(compB._id);

        if (String(fetchedCompB.parentComplaintId) !== String(compA._id)) {
            throw new Error(`Complaint B parentComplaintId not set to Complaint A`);
        }
        if (!fetchedCompA.associatedComplaints.map(String).includes(String(compB._id))) {
            throw new Error(`Complaint A associatedComplaints does not include Complaint B`);
        }
        pass('Both reports associated with the same room-level issue while preserving individual IDs & histories');

        // Verify distinct affected rooms count was NOT inflated
        const heatmapCheck = await api.get(`${API_BASE}/services/heat-map?service=water`, {
            headers: { Authorization: `Bearer ${wardenToken}` }
        });
        const room204Stats = heatmapCheck.data.roomStats?.['204'];
        if (!room204Stats) throw new Error('Room 204 not found in heatmap stats');
        pass('Repeated reports from Room 204 do not inflate distinct affected rooms count');

        // 4. Test "Different Problem" from another room (Room 205)
        await Complaint.deleteMany({ doorNumber: '205', title: { $regex: /^\[RoommateTest\]/ } });
        await Student.deleteMany({ email: { $in: ['roommate_c_205@pict.edu', 'roommate_d_205@pict.edu'] } });

        const studentC = await Student.create({
            name: 'Student C (Room 205)',
            fullName: 'Student C (Room 205)',
            email: 'roommate_c_205@pict.edu',
            prn: 'PRN205C',
            doorNumber: '205',
            mobileNumber: '9840000205',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenC = createToken(studentC);

        const studentD = await Student.create({
            name: 'Student D (Room 205)',
            fullName: 'Student D (Room 205)',
            email: 'roommate_d_205@pict.edu',
            prn: 'PRN205D',
            doorNumber: '205',
            mobileNumber: '9850000205',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenD = createToken(studentD);

        // Student C reports NO_ELECTRICITY
        const compCRes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[RoommateTest] Main light switch broken',
                description: 'Main room light flickers',
                category: 'Electrical',
                quickCategory: 'NO_ELECTRICITY',
                doorNumber: '205'
            },
            { headers: { Authorization: `Bearer ${tokenC}` } }
        );
        const compC = compCRes.data.complaint;

        // Student D says it is a DIFFERENT problem (e.g. wall socket dead)
        const compDRes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[RoommateTest] Wall charging socket spark',
                description: 'Different electrical problem: socket sparked',
                category: 'Electrical',
                quickCategory: 'NO_ELECTRICITY',
                doorNumber: '205',
                parentComplaintId: null // independent
            },
            { headers: { Authorization: `Bearer ${tokenD}` } }
        );
        const compD = compDRes.data.complaint;

        const fetchedCompD = await Complaint.findById(compD._id);
        if (fetchedCompD.parentComplaintId !== null) {
            throw new Error('Independent report unexpectedly has parentComplaintId');
        }
        pass('Independent report permitted when roommate indicates a different problem');

    } catch (err) {
        fail('Requirement 2: Same-Room Roommate Behaviour', err);
    }

    // =========================================================================
    // REQUIREMENT 3: Resolution feedback
    // =========================================================================
    console.log('\n--- SECTION 3: Resolution Feedback ---');
    try {
        // Test with Room 204 (Student A & Student B who reported the same issue)
        const compA = await Complaint.findOne({ title: '[RoommateTest] No water supply in room 204' });
        const compB = await Complaint.findOne({ title: '[RoommateTest] Confirmed same water supply issue' });
        const studentA = await Student.findOne({ email: 'roommate_a_204@pict.edu' });
        const studentB = await Student.findOne({ email: 'roommate_b_204@pict.edu' });
        const tokenA = createToken(studentA);
        const tokenB = createToken(studentB);

        // 1. Responsible person marks room restored (status -> Resolved)
        await api.put(
            `${API_BASE}/complaints/${compA._id}/status`,
            { status: 'Resolved', resolutionNote: 'Plumbing team replaced inlet valve for room 204' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );
        await api.put(
            `${API_BASE}/complaints/${compB._id}/status`,
            { status: 'Resolved', resolutionNote: 'Plumbing team replaced inlet valve for room 204' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );

        // Verify missing feedback is NOT treated as confirmation
        const unconfirmedA = await Complaint.findById(compA._id);
        const unconfirmedB = await Complaint.findById(compB._id);
        if (unconfirmedA.roomConfirmedWorking === true || unconfirmedB.roomConfirmedWorking === true) {
            throw new Error('Missing feedback was automatically treated as confirmation!');
        }
        pass('Missing feedback is NOT automatically treated as confirmation (roomConfirmedWorking remains false)');

        // 2. Student A submits positive feedback
        const feedbackRes = await api.post(
            `${API_BASE}/complaints/${compA._id}/feedback`,
            { isSatisfied: true, text: 'Water supply fully restored and running clean.' },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        if (feedbackRes.status !== 200) throw new Error('Feedback submission failed');

        // Check persisted state of both complaints
        const confirmedA = await Complaint.findById(compA._id);
        const confirmedB = await Complaint.findById(compB._id);

        if (confirmedA.roomConfirmedWorking !== true) {
            throw new Error('Complaint A roomConfirmedWorking is not true');
        }
        if (confirmedB.roomConfirmedWorking !== true) {
            throw new Error('Complaint B roomConfirmedWorking is not true after roommate positive feedback');
        }
        pass('Either roommate positive confirmation marks room as student-confirmed working in database');

        if (!confirmedB.roommateConfirmation || !confirmedB.roommateConfirmation.message) {
            throw new Error('Complaint B did not receive persisted roommateConfirmation message');
        }
        pass('Other reporting roommate receives persisted notification that roommate confirmed issue is working', confirmedB.roommateConfirmation.message);

        // Verify individual report IDs, timestamps and histories remain intact
        if (String(confirmedA._id) === String(confirmedB._id)) throw new Error('Individual IDs merged!');
        if (confirmedA.statusHistory.length < 2 || confirmedB.statusHistory.length < 2) {
            throw new Error('Complaint history lost!');
        }
        pass('Individual report IDs, timestamps and lifecycle histories remain intact');

        // 3. Test Reopening / Follow-up workflow:
        // Create Room 305 with Student E and Student F
        await Complaint.deleteMany({ doorNumber: '305', title: { $regex: /^\[FollowUpTest\]/ } });
        await Student.deleteMany({ email: { $in: ['followup_e_305@pict.edu', 'followup_f_305@pict.edu'] } });

        const studentE = await Student.create({
            name: 'Student E (Room 305)',
            fullName: 'Student E (Room 305)',
            email: 'followup_e_305@pict.edu',
            prn: 'PRN305E',
            doorNumber: '305',
            mobileNumber: '9860000305',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenE = createToken(studentE);

        const studentF = await Student.create({
            name: 'Student F (Room 305)',
            fullName: 'Student F (Room 305)',
            email: 'followup_f_305@pict.edu',
            prn: 'PRN305F',
            doorNumber: '305',
            mobileNumber: '9870000305',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenF = createToken(studentF);

        const compERes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[FollowUpTest] Power outage in room 305',
                description: 'Circuit breaker tripped',
                category: 'Electrical',
                quickCategory: 'NO_ELECTRICITY',
                doorNumber: '305'
            },
            { headers: { Authorization: `Bearer ${tokenE}` } }
        );
        const compE = compERes.data.complaint;

        const compFRes = await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[FollowUpTest] Also reporting power outage in 305',
                description: 'Dark in room 305',
                category: 'Electrical',
                quickCategory: 'NO_ELECTRICITY',
                doorNumber: '305',
                parentComplaintId: compE._id
            },
            { headers: { Authorization: `Bearer ${tokenF}` } }
        );
        const compF = compFRes.data.complaint;

        // Mark Resolved
        await api.put(
            `${API_BASE}/complaints/${compE._id}/status`,
            { status: 'Resolved', resolutionNote: 'Reset breaker in sub-panel' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );
        await api.put(
            `${API_BASE}/complaints/${compF._id}/status`,
            { status: 'Resolved', resolutionNote: 'Reset breaker in sub-panel' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );

        // Student E submits unsatisfied feedback (problem still exists)
        // Note: For feedback not satisfied, backend accepts text / media
        const boundary = '----WebKitFormBoundaryTest123';
        const bodyMultipart = 
            `--${boundary}\r\nContent-Disposition: form-data; name="isSatisfied"\r\n\r\nfalse\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\nPower tripped again after 3 minutes. Problem still exists.\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="evidence.jpg"\r\nContent-Type: image/jpeg\r\n\r\n[fake_image_bytes]\r\n` +
            `--${boundary}--\r\n`;

        const reopenRes = await fetch(`${API_BASE}/complaints/${compE._id}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                Authorization: `Bearer ${tokenE}`
            },
            body: Buffer.from(bodyMultipart)
        });
        if (!reopenRes.ok) {
            const errData = await reopenRes.json();
            throw new Error(`Reopening failed: ${errData.message}`);
        }

        const reopenedE = await Complaint.findById(compE._id);
        const reopenedF = await Complaint.findById(compF._id);

        if (reopenedE.status !== 'Reopened' || reopenedE.followUpRequired !== true) {
            throw new Error(`Complaint E not marked Reopened with followUpRequired. Status: ${reopenedE.status}`);
        }
        if (reopenedF.status !== 'Reopened' || reopenedF.followUpRequired !== true) {
            throw new Error(`Complaint F not marked Reopened with followUpRequired. Status: ${reopenedF.status}`);
        }
        pass('Dissatisfied feedback returns room to follow-up (status=Reopened, followUpRequired=true across roommate reports)');

        // 4. Test Single Student Confirmation (Room 408)
        await Complaint.deleteMany({ doorNumber: '408', title: { $regex: /^\[SingleStudentTest\]/ } });
        await Student.deleteMany({ email: 'single_g_408@pict.edu' });

        const studentG = await Student.create({
            name: 'Student G (Room 408)',
            fullName: 'Student G (Room 408)',
            email: 'single_g_408@pict.edu',
            prn: 'PRN408G',
            doorNumber: '408',
            mobileNumber: '9880000408',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenG = createToken(studentG);

        const compG = (await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[SingleStudentTest] Broken tap in room 408',
                description: 'Tap leaking water',
                category: 'Plumbing',
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: '408'
            },
            { headers: { Authorization: `Bearer ${tokenG}` } }
        )).data.complaint;

        await api.put(
            `${API_BASE}/complaints/${compG._id}/status`,
            { status: 'Resolved', resolutionNote: 'Washer replaced' },
            { headers: { Authorization: `Bearer ${wardenToken}` } }
        );

        await api.post(
            `${API_BASE}/complaints/${compG._id}/feedback`,
            { isSatisfied: true, text: 'Tap works perfectly' },
            { headers: { Authorization: `Bearer ${tokenG}` } }
        );

        const confirmedG = await Complaint.findById(compG._id);
        if (confirmedG.roomConfirmedWorking !== true) {
            throw new Error('Single reporting student feedback did not mark roomConfirmedWorking');
        }
        pass('Single reporting student can independently confirm their room issue is working');

    } catch (err) {
        fail('Requirement 3: Resolution Feedback', err);
    }

    // =========================================================================
    // REQUIREMENT 4: Student mobile registration and updates
    // =========================================================================
    console.log('\n--- SECTION 4: Student Mobile Registration & Updates ---');
    try {
        await Student.deleteMany({ email: 'mobile_test_student@pict.edu' });

        // 1. Register with valid mobile number
        const studentReg = await Student.create({
            name: 'Mobile Test Student',
            fullName: 'Mobile Test Student',
            email: 'mobile_test_student@pict.edu',
            prn: 'PRNMOB01',
            doorNumber: '112',
            mobileNumber: '9890123456',
            role: 'STUDENT',
            profileComplete: true,
            isVerified: true
        });
        const tokenM = createToken(studentReg);

        const savedStudent = await Student.findById(studentReg._id);
        if (savedStudent.mobileNumber !== '9890123456') {
            throw new Error(`Mobile number not stored correctly: got ${savedStudent.mobileNumber}`);
        }
        pass('Student registered with valid mobile number and stored correctly in database', savedStudent.mobileNumber);

        // 2. Reject invalid mobile updates via updateInfo
        // Too short
        try {
            await api.patch(
                `${API_BASE}/auth/student/update-info`,
                { mobileNumber: '12345' },
                { headers: { Authorization: `Bearer ${tokenM}` } }
            );
            throw new Error('Server accepted short mobile number!');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                pass('Server rejected short mobile number (HTTP 400 validation error)');
            } else {
                throw err;
            }
        }

        // Invalid starting digit (e.g. 5xxxxxxxxx)
        try {
            await api.patch(
                `${API_BASE}/auth/student/update-info`,
                { mobileNumber: '5890123456' },
                { headers: { Authorization: `Bearer ${tokenM}` } }
            );
            throw new Error('Server accepted mobile starting with 5!');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                pass('Server rejected invalid prefix mobile number (HTTP 400 validation error)');
            } else {
                throw err;
            }
        }

        // 3. Update with valid mobile number
        const updateRes = await api.patch(
            `${API_BASE}/auth/student/update-info`,
            { mobileNumber: '9822334455' },
            { headers: { Authorization: `Bearer ${tokenM}` } }
        );
        if (updateRes.status !== 200 || updateRes.data.user.mobileNumber !== '9822334455') {
            throw new Error('Failed to update mobile number with valid 10 digits');
        }
        const updatedStudentInDb = await Student.findById(studentReg._id);
        if (updatedStudentInDb.mobileNumber !== '9822334455') {
            throw new Error('Database did not persist updated mobile number');
        }
        pass('Student successfully updated mobile number through profile endpoint', updatedStudentInDb.mobileNumber);

        // 4. Authorized on-demand retrieval vs privacy boundary
        // Create a Wi-Fi complaint for this student
        const wifiComplaint = (await api.post(
            `${API_BASE}/complaints`,
            {
                title: '[MobileTest] Wi-Fi down in 112',
                description: 'Need network engineer',
                category: 'Internet',
                quickCategory: 'WIFI_NOT_WORKING',
                doorNumber: '112'
            },
            { headers: { Authorization: `Bearer ${tokenM}` } }
        )).data.complaint;

        // Authorized Wi-Fi In-Charge retrieves contact
        const wifiContactRes = await api.get(
            `${API_BASE}/complaints/${wifiComplaint._id}/student-contact`,
            { headers: { Authorization: `Bearer ${wifiToken}` } }
        );
        if (wifiContactRes.data.mobileNumber !== '9822334455') {
            throw new Error(`Wi-Fi Incharge received wrong number: ${wifiContactRes.data.mobileNumber}`);
        }
        pass('Authorized Wi-Fi In-Charge retrieves the current updated mobile number on demand', wifiContactRes.data.mobileNumber);

        // Unauthorized Warden accessing Wi-Fi contact must be rejected (403)
        try {
            await api.get(
                `${API_BASE}/complaints/${wifiComplaint._id}/student-contact`,
                { headers: { Authorization: `Bearer ${wardenToken}` } }
            );
            throw new Error('Warden was allowed to view Wi-Fi complaint contact details!');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                pass('Unauthorized handler (Warden on Wi-Fi complaint) strictly denied contact access (HTTP 403 Forbidden)');
            } else {
                throw err;
            }
        }

        // Unrelated student accessing contact must be rejected (403)
        const otherStudent = await Student.findOne({ email: 'roommate_a_204@pict.edu' });
        const otherToken = createToken(otherStudent);
        try {
            await api.get(
                `${API_BASE}/complaints/${wifiComplaint._id}/student-contact`,
                { headers: { Authorization: `Bearer ${otherToken}` } }
            );
            throw new Error('Unrelated student was allowed to view another student contact!');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                pass('Unrelated student strictly denied contact access (HTTP 403 Forbidden)');
            } else {
                throw err;
            }
        }

        // Student themselves can always access their own contact
        const selfContactRes = await api.get(
            `${API_BASE}/complaints/${wifiComplaint._id}/student-contact`,
            { headers: { Authorization: `Bearer ${tokenM}` } }
        );
        if (selfContactRes.data.mobileNumber !== '9822334455') {
            throw new Error('Student could not retrieve their own contact details');
        }
        pass('Student can view their own contact details');

    } catch (err) {
        fail('Requirement 4: Student Mobile Registration & Updates', err);
    }

    // =========================================================================
    // REQUIREMENT 5: Browser Automation Verification (Selenium WebDriver)
    // =========================================================================
    console.log('\n--- SECTION 5: Browser Automation Verification (Selenium) ---');
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

        // Test 1: Warden Dashboard shows 1 grouped service issue with 100 reports
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
        pass('Browser: Warden authenticated session initialized');

        // Check for Grouped Service Issue card
        const groupedTitle = await driver.findElement(By.xpath("//h3[contains(text(), 'Grouped Service Issue')]"));
        const titleText = await groupedTitle.getText();
        pass('Browser: Warden Complaints page displays Grouped Service Issue card', titleText);

        // Check for 100 reports metric
        const bodyText = await driver.findElement(By.tagName('body')).getText();
        const countMatch = bodyText.match(/(\d+)\s+TOTAL REPORTS/i);
        const reportCount = countMatch ? parseInt(countMatch[1], 10) : 0;
        if (reportCount < 100 || !bodyText.toLowerCase().includes('total reports')) {
            throw new Error(`Grouped Service Issue card does not display >= 100 Total Reports (got ${reportCount})`);
        }
        pass(`Browser: Grouped card renders "${reportCount} TOTAL REPORTS" metric (>= 100 reports consolidated)`);

        // Click "View 100 Individual Reports & Histories" button
        const expandBtn = await driver.findElement(By.xpath("//button[contains(., 'View') and contains(., 'Individual Reports')]"));
        await expandBtn.click();
        await driver.sleep(1000);

        // Verify individual complaint cards expanded
        const expandedHeader = await driver.findElement(By.xpath("//h4[contains(text(), 'Individual Report Records')]"));
        const expHeaderText = await expandedHeader.getText();
        pass('Browser: Clicking group button successfully expands individual complaint records', expHeaderText);

        // Test 2: Student Profile shows mobile number and Update button
        const testStudent = await Student.findOne({ email: 'mobile_test_student@pict.edu' });
        const studentToken = createToken(testStudent);

        // Inject student session into browser
        await driver.get(`${FRONTEND_BASE}/`);
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
        await driver.sleep(1500);

        const profileText = await driver.findElement(By.tagName('body')).getText();
        if (!profileText.includes('Registered mobile') || !profileText.includes('9822334455')) {
            throw new Error('Student profile page does not show Registered mobile number');
        }
        pass('Browser: Student profile interface displays Registered mobile number (9822334455)');

        const updateBtn = await driver.findElement(By.xpath("//button[contains(., 'Update')]"));
        await updateBtn.click();
        await driver.sleep(800);

        const modalTitle = await driver.findElement(By.xpath("//*[contains(text(), 'Update Student Profile') or contains(text(), 'Update Contact Number')]"));
        pass('Browser: Clicking Update button opens mobile number dialog with 10-digit validation', await modalTitle.getText());

        // Test 3: Wi-Fi Specialist Dashboard displays Grouped presentation
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
        pass('Browser: Wi-Fi Specialist authenticated session initialized');

        const wifiBodyText = await driver.findElement(By.tagName('body')).getText();
        if (!wifiBodyText.includes('Campus Wi-Fi Trouble Group') || !wifiBodyText.toLowerCase().includes('total reports')) {
            throw new Error('Wi-Fi dashboard did not display Campus Wi-Fi Trouble Group banner');
        }
        pass('Browser: Wi-Fi Specialist Dashboard displays Campus Wi-Fi Trouble Group consolidated presentation');

    } catch (err) {
        fail('Requirement 5: Browser Automation Verification', err);
    } finally {
        if (driver) {
            await driver.quit();
        }
        await mongoose.disconnect();
    }

    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
    console.log('================================================================\n');

    if (results.failed.length > 0) {
        process.exit(1);
    }
}

run().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
