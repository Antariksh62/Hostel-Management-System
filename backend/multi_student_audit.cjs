/**
 * multi_student_audit.cjs
 * Comprehensive multi-student end-to-end audit for PICT Hostel Management System.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User, Student } = require('./models/User');
const Complaint = require('./models/Complaint');
const Incident = require('./models/Incident');

const API_BASE = 'http://127.0.0.1:5000/api';

const results = {
    passed: [],
    failed: []
};

function assert(condition, message) {
    if (!condition) {
        results.failed.push(message);
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(message);
    } else {
        results.passed.push(message);
        console.log(`  ✓ PASS: ${message}`);
    }
}

async function apiCall(method, endpoint, body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    let data = {};
    try {
        data = await res.json();
    } catch (e) {
        data = {};
    }

    return { status: res.status, data };
}

async function runAudit() {
    console.log('\n=================================================');
    console.log('HMS MULTI-STUDENT AUDIT & ROUTING ISOLATION TEST');
    console.log('=================================================\n');

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostelDB');

    // 1. Authenticate Warden and Wi-Fi In-Charge
    console.log('--- Step 1: Staff & Specialist Authentication ---');
    const wardenRes = await apiCall('POST', '/auth/login', {
        email: 'warden@pict.edu',
        password: 'Admin@123'
    });
    assert(wardenRes.status === 200, 'Warden login successful');
    const wardenToken = wardenRes.data.token;

    const wifiRes = await apiCall('POST', '/auth/login', {
        email: 'wifi@pict.edu',
        password: 'Admin@123'
    });
    assert(wifiRes.status === 200, 'Wi-Fi In-Charge login successful');
    const wifiToken = wifiRes.data.token;

    // 2. Set up synthetic students across floors
    console.log('\n--- Step 2: Authenticating Multi-Floor Test Students ---');
    const studentConfigs = [
        { email: 'f21ce101@ms.pict.edu', name: 'Aarav Sharma', room: '101', floor: 1, phone: '9876543210' },
        { email: 'f21ce102@ms.pict.edu', name: 'Rohan Patil',  room: '102', floor: 1, phone: '9876543211' },
        { email: 'f21it203@ms.pict.edu', name: 'Vikram Joshi', room: '203', floor: 2, phone: '9876543212' },
        { email: 'f21et305@ms.pict.edu', name: 'Aditya Kulkarni', room: '305', floor: 3, phone: '9876543213' },
        { email: 'f21ce404@ms.pict.edu', name: 'Sahil Deshmukh', room: '404', floor: 4, phone: '9876543214' },
        { email: 'f21ad502@ms.pict.edu', name: 'Nikhil Shinde',  room: '502', floor: 5, phone: '9876543215' },
    ];

    const studentSessions = [];

    for (const conf of studentConfigs) {
        // Send OTP
        const sendOtpRes = await apiCall('POST', '/auth/student/send-otp', { email: conf.email });
        assert(sendOtpRes.status === 200, `OTP requested for student ${conf.email}`);
        const devOtp = sendOtpRes.data.devOtp;
        assert(Boolean(devOtp), `Development OTP received for ${conf.email}`);

        // Verify OTP
        const verifyRes = await apiCall('POST', '/auth/student/verify-otp', {
            email: conf.email,
            otp: devOtp
        });
        assert(verifyRes.status === 200, `OTP verified for ${conf.email}`);
        const studentToken = verifyRes.data.token;
        const studentUser = verifyRes.data.user;

        // If profile not complete, complete it with registered room assignment and phone
        if (!studentUser.profileComplete) {
            const compRes = await apiCall(
                'POST',
                '/auth/student/complete-profile',
                {
                    fullName: conf.name,
                    rollNumber: conf.email.split('@')[0],
                    classDiv: 'TE-1',
                    year: 'TY',
                    doorNumber: conf.room,
                    branch: 'CE',
                    mobileNumber: conf.phone
                },
                studentToken
            );
            if (compRes.status !== 200) {
                console.error("complete-profile error:", compRes);
            }
            assert(compRes.status === 200, `Profile completed for student in room ${conf.room}`);
        } else {
            // Update to test room and mobile
            const updRes = await apiCall(
                'PATCH',
                '/auth/student/update-info',
                { doorNumber: conf.room, mobileNumber: conf.phone },
                studentToken
            );
            assert(updRes.status === 200, `Profile updated for student in room ${conf.room}`);
        }

        studentSessions.push({
            config: conf,
            token: studentToken,
            userId: studentUser.id
        });
        console.log(`  ✓ Student authenticated: ${conf.name} (Room ${conf.room}, Floor ${conf.floor}, Mobile: ${conf.phone})`);
    }

    // 3. Multi-Student Wi-Fi Complaints & Strict Specialist Isolation
    console.log('\n--- Step 3: Multi-Student Wi-Fi Complaints & Strict Specialist Isolation ---');
    const wifiComplaints = [];

    // Students from Room 101, 203, 305, 502 submit Wi-Fi complaints
    const wifiSubmitters = [studentSessions[0], studentSessions[2], studentSessions[3], studentSessions[5]];

    for (const s of wifiSubmitters) {
        const createRes = await apiCall(
            'POST',
            '/complaints',
            {
                title: 'Wi-Fi not working in room ' + s.config.room,
                quickCategory: 'WIFI_NOT_WORKING',
                doorNumber: s.config.room
            },
            s.token
        );
        assert(createRes.status === 201, `Wi-Fi complaint created by student in room ${s.config.room}`);
        const c = createRes.data.complaint;
        assert(Boolean(c._id), 'Complaint received unique database ID: ' + c._id);
        wifiComplaints.push(c);
    }

    console.log(`\n  Submitted ${wifiComplaints.length} Wi-Fi complaints across Floors 1, 2, 3, 5.`);

    // Check Wi-Fi In-Charge Queue
    const wifiQueueRes = await apiCall('GET', '/complaints/wifi/queue', null, wifiToken);
    assert(wifiQueueRes.status === 200, 'Wi-Fi In-Charge accessed queue successfully');
    const queueIds = wifiQueueRes.data.map(c => String(c._id));
    for (const c of wifiComplaints) {
        assert(queueIds.includes(String(c._id)), `Wi-Fi queue contains complaint ${c._id} from room ${c.doorNumber}`);
    }

    // Check Wi-Fi Specialist On-Demand Mobile Number Access
    const contactRes = await apiCall('GET', `/complaints/${wifiComplaints[0]._id}/student-contact`, null, wifiToken);
    assert(contactRes.status === 200, 'Wi-Fi specialist can retrieve student contact on demand');
    assert(contactRes.data.mobileNumber === wifiSubmitters[0].config.phone, 'Correct registered student phone returned to Wi-Fi specialist');
    assert(contactRes.data.doorNumber === wifiSubmitters[0].config.room, 'Correct door number returned to Wi-Fi specialist');

    // VERIFY CRITICAL BUSINESS RULE: WARDEN EXCLUSION
    console.log('\n  Verifying Wi-Fi Boundary: Warden Exclusion Checks...');
    // 1. Warden queue must NOT contain Wi-Fi complaints
    const wardenAllRes = await apiCall('GET', '/complaints/all', null, wardenToken);
    assert(wardenAllRes.status === 200, 'Warden complaints query returned HTTP 200');
    const wardenComplaintIds = wardenAllRes.data.map(c => String(c._id));
    for (const c of wifiComplaints) {
        assert(!wardenComplaintIds.includes(String(c._id)), `Warden complaints queue does NOT contain Wi-Fi complaint ${c._id}`);
    }

    // 2. Warden Service Monitor heat-map must NOT include Wi-Fi in summary or room stats
    const wardenHeatmapRes = await apiCall('GET', '/services/heat-map', null, wardenToken);
    assert(wardenHeatmapRes.status === 200, 'Warden heat-map query returned HTTP 200');
    assert(wardenHeatmapRes.data.summary.wifi === undefined, 'Warden heat-map summary does NOT contain wifi metrics');
    assert(wardenHeatmapRes.data.summary.water !== undefined, 'Warden heat-map summary contains water metrics');
    assert(wardenHeatmapRes.data.summary.electricity !== undefined, 'Warden heat-map summary contains electricity metrics');

    // 3. Warden cannot access Wi-Fi specialist queue
    const wardenWifiQueueRes = await apiCall('GET', '/complaints/wifi/queue', null, wardenToken);
    assert(wardenWifiQueueRes.status === 403, 'Warden strictly denied (403) from accessing Wi-Fi specialist queue');

    // 4. Warden cannot access student contact for a Wi-Fi complaint
    const wardenWifiContactRes = await apiCall('GET', `/complaints/${wifiComplaints[0]._id}/student-contact`, null, wardenToken);
    assert(wardenWifiContactRes.status === 403, 'Warden strictly denied (403) from accessing student contact for Wi-Fi complaint');

    // 4. Multi-Floor Water Complaints & Shared Incident Grouping
    console.log('\n--- Step 4: Multi-Floor Water Incident Grouping & Warden Resolution ---');
    // Clear active water incidents to start fresh
    await Incident.deleteMany({ serviceType: 'WATER' });

    // Submit water complaints from 5 distinct rooms across 4 different floors:
    // Room 101 (F1), 102 (F1), 203 (F2), 305 (F3), 404 (F4)
    const waterSubmitters = [
        studentSessions[0], // Room 101, F1
        studentSessions[1], // Room 102, F1
        studentSessions[2], // Room 203, F2
        studentSessions[3], // Room 305, F3
        studentSessions[4]  // Room 404, F4
    ];

    const waterComplaints = [];
    for (const s of waterSubmitters) {
        const createRes = await apiCall(
            'POST',
            '/complaints',
            {
                title: 'No water supply in room ' + s.config.room,
                quickCategory: 'NO_WATER_SUPPLY',
                doorNumber: s.config.room
            },
            s.token
        );
        assert(createRes.status === 201, `Water complaint created for Room ${s.config.room} (Floor ${s.config.floor})`);
        waterComplaints.push(createRes.data.complaint);
    }

    // Check that a multi-floor shared incident was automatically detected and proposed
    const incidentsRes = await apiCall('GET', '/incidents?status=PROPOSED', null, wardenToken);
    assert(incidentsRes.status === 200, 'Warden fetched proposed incidents');
    const waterIncident = incidentsRes.data.find(inc => inc.serviceType === 'WATER');
    assert(Boolean(waterIncident), 'Shared Water incident was automatically proposed');
    assert(waterIncident.status === 'PROPOSED', 'Incident is in PROPOSED status for Warden review');
    assert(waterIncident.affectedRooms.length === 5, 'Incident covers exactly 5 distinct rooms across multiple floors');
    
    // Check that affected rooms include all 4 floors
    const hasFloor1 = waterIncident.affectedRooms.some(r => r.startsWith('1'));
    const hasFloor2 = waterIncident.affectedRooms.some(r => r.startsWith('2'));
    const hasFloor3 = waterIncident.affectedRooms.some(r => r.startsWith('3'));
    const hasFloor4 = waterIncident.affectedRooms.some(r => r.startsWith('4'));
    assert(hasFloor1 && hasFloor2 && hasFloor3 && hasFloor4, 'Shared incident spans Rooms across Floors 1, 2, 3, and 4');

    // 5. Complete Warden Incident Workflow
    console.log('\n--- Step 5: Full Warden Incident Lifecycle Management ---');
    // A) Confirm incident
    const confirmRes = await apiCall(
        'PUT',
        `/incidents/${waterIncident._id}/confirm`,
        { note: 'Water tank line suspected across south wing' },
        wardenToken
    );
    assert(confirmRes.status === 200, 'Warden confirmed proposed incident');
    assert(confirmRes.data.incident.status === 'CONFIRMED', 'Incident status changed to CONFIRMED');

    // B) Assign responsible team
    const assignRes = await apiCall(
        'PUT',
        `/incidents/${waterIncident._id}/assign`,
        {
            assignedTo: 'Plumbing Emergency Response Team',
            assignedTeam: 'Plumbing Staff',
            notes: 'Dispatching plumber to inspect rooftop distribution valves'
        },
        wardenToken
    );
    assert(assignRes.status === 200, 'Warden assigned responsible team to incident');
    assert(assignRes.data.incident.status === 'IN_PROGRESS', 'Incident status transitioned to IN_PROGRESS');

    // C) Record progress update
    const progressRes = await apiCall(
        'POST',
        `/incidents/${waterIncident._id}/progress`,
        { note: 'Main valve replaced, tank refilling commenced.' },
        wardenToken
    );
    assert(progressRes.status === 200, 'Warden recorded incident progress update');

    // D) Record restoration details
    const restoreRes = await apiCall(
        'PUT',
        `/incidents/${waterIncident._id}/restoration`,
        {
            restorationDetails: 'Pressure restored across all vertical risers on Floors 1-4.',
            expectedResolutionAt: new Date()
        },
        wardenToken
    );
    assert(restoreRes.status === 200, 'Warden recorded restoration details');
    assert(restoreRes.data.incident.status === 'RESTORATION_REPORTED', 'Incident transitioned to RESTORATION_REPORTED');

    // E) Explicit Complaint Review before Closure:
    // Resolve 4 complaints (Rooms 101, 102, 203, 305) and KEEP Room 404 OPEN for airlock check
    const complaintDecisions = [
        { complaintId: waterComplaints[0]._id, decision: 'RESOLVE', note: 'Water supply verified restored' },
        { complaintId: waterComplaints[1]._id, decision: 'RESOLVE', note: 'Water supply verified restored' },
        { complaintId: waterComplaints[2]._id, decision: 'RESOLVE', note: 'Water supply verified restored' },
        { complaintId: waterComplaints[3]._id, decision: 'RESOLVE', note: 'Water supply verified restored' },
        { complaintId: waterComplaints[4]._id, decision: 'KEEP_OPEN', note: 'Room 404 reported low flow — airlock follow-up needed' }
    ];

    const resolveRes = await apiCall(
        'PUT',
        `/incidents/${waterIncident._id}/resolve`,
        {
            resolutionSummary: 'Main distribution valve replaced. Pressure restored.',
            complaintDecisions
        },
        wardenToken
    );
    assert(resolveRes.status === 200, 'Warden resolved incident with explicit complaint review');
    assert(resolveRes.data.incident.status === 'RESOLVED', 'Incident status successfully changed to RESOLVED');

    // F) Verify individual complaint records & histories
    const c101 = await Complaint.findById(waterComplaints[0]._id);
    assert(c101.status === 'Resolved', 'Complaint for Room 101 marked Resolved');
    assert(c101.statusHistory.some(h => h.status === 'Resolved'), 'Room 101 statusHistory preserved with Resolved transition');

    const c404 = await Complaint.findById(waterComplaints[4]._id);
    assert(c404.status === 'Pending', 'Complaint for Room 404 kept Pending per explicit review decision');
    assert(c404.incidentId === null, 'Kept-open complaint Room 404 unlinked from resolved incident for individual follow-up');
    assert(c404.statusHistory.some(h => h.note.includes('airlock follow-up')), 'Room 404 audit history preserved with Warden follow-up note');

    // 6. Wi-Fi In-Charge Specialist Resolution Workflow
    console.log('\n--- Step 6: Wi-Fi Specialist Complaint Resolution Workflow ---');
    const wifiComplaintToResolve = wifiComplaints[0];
    
    // In Progress update
    const wifiProgRes = await apiCall(
        'PUT',
        `/complaints/wifi/${wifiComplaintToResolve._id}/status`,
        {
            status: 'In Progress',
            note: 'Access Point 1B rebooted, monitoring RSSI'
        },
        wifiToken
    );
    assert(wifiProgRes.status === 200, 'Wi-Fi In-Charge updated status to In Progress');

    // Resolved update
    const wifiResolveRes = await apiCall(
        'PUT',
        `/complaints/wifi/${wifiComplaintToResolve._id}/status`,
        {
            status: 'Resolved',
            note: 'DHCP lease pool expanded and signal calibrated at -54dBm'
        },
        wifiToken
    );
    assert(wifiResolveRes.status === 200, 'Wi-Fi In-Charge resolved complaint');

    const persistedWifi = await Complaint.findById(wifiComplaintToResolve._id);
    assert(persistedWifi.status === 'Resolved', 'Wi-Fi complaint successfully persisted as Resolved');
    assert(persistedWifi.statusHistory.length >= 3, 'Full audit timeline preserved in Wi-Fi complaint history');

    // 7. Multi-Floor Electricity Outage Incident Workflow
    console.log('\n--- Step 7: Multi-Floor Electricity Incident Grouping & Warden Resolution ---');
    const elecPayloads = [
        { student: studentSessions[0], room: '101' },
        { student: studentSessions[1], room: '102' },
        { student: studentSessions[2], room: '203' },
        { student: studentSessions[3], room: '305' },
        { student: studentSessions[4], room: '404' }
    ];

    const elecComplaints = [];
    for (const item of elecPayloads) {
        const cRes = await apiCall(
            'POST',
            '/complaints',
            {
                title: 'Power outage in room',
                description: 'Complete power cutoff in room, MCB tripped or line fault.',
                quickCategory: 'NO_ELECTRICITY'
            },
            item.student.token
        );
        assert(cRes.status === 201, `Electricity complaint created for Room ${item.room}`);
        elecComplaints.push(cRes.data.complaint);
    }

    // Submit duplicate from Room 101 to verify distinct-room count is not inflated
    const dupRes = await apiCall(
        'POST',
        '/complaints',
        {
            title: 'Power still out',
            description: 'Second report from room 101',
            quickCategory: 'NO_ELECTRICITY'
        },
        studentSessions[0].token
    );
    assert(dupRes.status === 201, 'Duplicate report from Room 101 accepted independently');

    const proposedElec = await apiCall('GET', '/incidents?status=PROPOSED', null, wardenToken);
    assert(proposedElec.status === 200, 'Warden fetched proposed electricity incidents');
    const elecIncident = proposedElec.data.find(inc => inc.serviceType === 'ELECTRICITY');
    assert(elecIncident !== undefined, 'Shared Electricity incident was automatically proposed');
    assert(elecIncident.status === 'PROPOSED', 'Electricity incident in PROPOSED status for Warden review');
    assert(elecIncident.affectedRooms.length === 5, 'Duplicate report from Room 101 did not inflate distinct room count (remains 5)');

    // Warden confirms and assigns electricity incident
    const elecConfirmRes = await apiCall('PUT', `/incidents/${elecIncident._id}/confirm`, {}, wardenToken);
    assert(elecConfirmRes.status === 200, 'Warden confirmed proposed electricity incident');

    const elecAssignRes = await apiCall(
        'PUT',
        `/incidents/${elecIncident._id}/assign`,
        {
            assignedTo: 'Electrical Maintenance Unit',
            notes: 'Replacing blown phase fuse on Substation Distribution Board'
        },
        wardenToken
    );
    assert(elecAssignRes.status === 200, 'Warden assigned responsible team to electricity incident');

    const elecResolveRes = await apiCall(
        'PUT',
        `/incidents/${elecIncident._id}/resolve`,
        {
            resolutionSummary: 'Phase fuse replaced and feeder voltage balanced at 230V.',
            complaintDecisions: elecComplaints.map(c => ({
                complaintId: c._id,
                decision: 'RESOLVE',
                note: 'Power restored and verified'
            }))
        },
        wardenToken
    );
    assert(elecResolveRes.status === 200, 'Warden resolved electricity incident');
    assert(elecResolveRes.data.incident.status === 'RESOLVED', 'Electricity incident status is RESOLVED');

    console.log('\n=================================================');
    console.log(`MULTI-STUDENT AUDIT COMPLETED: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
    console.log('=================================================\n');

    process.exit(results.failed.length === 0 ? 0 : 1);
}

runAudit().catch(err => {
    console.error('Fatal audit failure:', err.message);
    process.exit(1);
});
