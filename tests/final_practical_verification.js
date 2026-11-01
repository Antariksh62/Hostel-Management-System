/**
 * final_practical_verification.js
 * End-to-End Practical Verification of Multi-Student Workflows in Hostel Management System
 * Using real browser automation (Selenium WebDriver) and live backend/MongoDB.
 */

const { Builder, By, until, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { User, Student, WifiIncharge, Warden } = require('../backend/models/User');
const Complaint = require('../backend/models/Complaint');
const Incident = require('../backend/models/Incident');
const OTP = require('../backend/models/OTP');

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostelDB';

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

async function createDriver() {
    const options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--window-size=1920,1080');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

    const prefs = new logging.Preferences();
    prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
    options.setLoggingPrefs(prefs);

    return await new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function setupNoRefreshTracker(driver) {
    await driver.executeScript(`
        window.__testNoRefresh = true;
        window.addEventListener('beforeunload', () => {
            window.__testNoRefresh = false;
        });
    `);
}

async function verifyNoRefresh(driver, roleName) {
    const noRefresh = await driver.executeScript('return window.__testNoRefresh;');
    if (noRefresh !== true) {
        throw new Error(`[FAIL] Page reload detected in ${roleName} session!`);
    }
    console.log(`  ✓ Verified: No page reload occurred in ${roleName} session.`);
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

async function runVerification() {
    console.log('======================================================================');
    console.log('FINAL PRACTICAL VERIFICATION: MULTI-STUDENT COMPLAINT WORKFLOWS');
    console.log('======================================================================\n');

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    // 1. Clean test collections to have clean testing state
    await Incident.deleteMany({});
    await Complaint.deleteMany({});

    // 2. Define synthetic test students
    const studentsConfig = [
        { email: 'f21ce101@ms.pict.edu', name: 'Aarav Sharma', room: '101', floor: 1, phone: '9876543210' },
        { email: 'f21ce102@ms.pict.edu', name: 'Rohan Patil',  room: '102', floor: 1, phone: '9876543211' },
        { email: 'f21it203@ms.pict.edu', name: 'Vikram Joshi', room: '203', floor: 2, phone: '9876543212' },
        { email: 'f21et305@ms.pict.edu', name: 'Aditya Kulkarni', room: '305', floor: 3, phone: '9876543213' },
        { email: 'f21ce404@ms.pict.edu', name: 'Sahil Deshmukh', room: '404', floor: 4, phone: '9876543214' },
        { email: 'f21ad502@ms.pict.edu', name: 'Nikhil Shinde',  room: '502', floor: 5, phone: '9876543215' }
    ];

    // Pre-seed/ensure student records have proper profile and doorNumber
    for (const conf of studentsConfig) {
        await Student.findOneAndUpdate(
            { email: conf.email },
            {
                fullName: conf.name,
                name: conf.name,
                email: conf.email,
                prn: conf.email.split('@')[0],
                doorNumber: conf.room,
                mobileNumber: conf.phone,
                role: 'STUDENT',
                isVerified: true,
                profileComplete: true,
                year: 'TY',
                branch: 'CE',
                classDiv: '1'
            },
            { upsert: true, returnDocument: 'after' }
        );
    }
    console.log(`Pre-seeded 6 synthetic students across floors 1 to 5.`);

    // -------------------------------------------------------------------------
    // SECTION A: WI-FI MULTI-STUDENT WORKFLOW VIA ACTUAL BROWSER
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('SECTION A: WI-FI MULTI-STUDENT BROWSER & SPECIALIST WORKFLOW');
    console.log('----------------------------------------------------------------------');

    const wifiSubmitterConfigs = [
        studentsConfig[0], // Room 101, F1
        studentsConfig[2], // Room 203, F2
        studentsConfig[3], // Room 305, F3
        studentsConfig[5]  // Room 502, F5
    ];

    const submittedWifiTickets = [];

    // Step A.1 & A.2: Log in through actual student workflow in browser and submit Wi-Fi complaints
    console.log('\n--- Step A.1 & A.2: Browser-based Student Logins & Wi-Fi Submissions ---');
    await OTP.deleteMany({});
    for (const s of wifiSubmitterConfigs) {
        const studentDriver = await createDriver();
        try {
            console.log(`  > Launching student browser session for ${s.name} (${s.email}, Room ${s.room})...`);
            await studentDriver.get(`${BASE_URL}/student-login`);

            // Enter Email
            const emailInput = await studentDriver.wait(until.elementLocated(By.id('email')), 5000);
            await emailInput.clear();
            await emailInput.sendKeys(s.email);

            const sendBtn = await studentDriver.findElement(By.css('button[type="submit"]'));
            await sendBtn.click();

            // Wait for OTP step
            await studentDriver.wait(until.elementLocated(By.css('button[type="submit"]')), 6000);
            await studentDriver.sleep(1500);

            // Fetch OTP generated for this email from DB
            const otpDoc = await OTP.findOne({ email: s.email });
            assert(Boolean(otpDoc), `OTP record created in database for ${s.email}`);

            // In dev mode, devOtp is auto-filled or we can submit OTP form
            // Click Verify & Sign in
            const verifyBtn = await studentDriver.wait(until.elementLocated(By.xpath('//button[contains(text(), "Verify & Sign in")]')), 5000);
            await verifyBtn.click();

            // Wait for student dashboard to load
            await studentDriver.wait(until.urlContains('student-dashboard'), 8000);
            assert(true, `Student ${s.name} logged in and redirected to /student-dashboard`);

            // Submit Wi-Fi complaint via Quick Issue Reporter
            // Find "Wi-Fi not working" button
            const wifiBtn = await studentDriver.wait(
                until.elementLocated(By.xpath('//button[.//p[contains(text(), "Wi-Fi not working")]]')),
                5000
            );
            await wifiBtn.click();
            await studentDriver.sleep(1500);

            // Verify toast or confirmation
            console.log(`    Submitted Wi-Fi complaint for Room ${s.room}`);
        } finally {
            await studentDriver.quit();
        }
    }

    // Step A.3: Verify distinct IDs and persistence in MongoDB
    console.log('\n--- Step A.3: Verify Complaint IDs & Persistence in Database ---');
    const wifiComplaints = await Complaint.find({
        $or: [{ category: 'Internet' }, { quickCategory: 'WIFI_NOT_WORKING' }]
    }).populate('studentId');

    assert(wifiComplaints.length === 4, `All 4 Wi-Fi complaints persisted (got ${wifiComplaints.length})`);
    const distinctIds = new Set(wifiComplaints.map(c => String(c._id)));
    assert(distinctIds.size === 4, `Every accepted Wi-Fi complaint received a distinct ID: ${Array.from(distinctIds).join(', ')}`);

    const roomsFound = wifiComplaints.map(c => c.doorNumber).sort();
    assert(
        JSON.stringify(roomsFound) === JSON.stringify(['101', '203', '305', '502']),
        `Persisted reports accurately map to Rooms 101, 203, 305, 502`
    );

    // Step A.4, A.5, A.6: Wi-Fi In-Charge Specialist Browser Inspection
    console.log('\n--- Step A.4, A.5, A.6: Wi-Fi Specialist Dashboard Browser Verification ---');
    const wifiDriver = await createDriver();
    try {
        await wifiDriver.get(BASE_URL);

        // Click Incharge/Staff tab or enter credentials directly
        const inchargeTab = await wifiDriver.wait(until.elementLocated(By.xpath('//button[contains(text(), "Incharge") or contains(text(), "Staff")]')), 5000);
        await inchargeTab.click();

        const emailIn = await wifiDriver.wait(until.elementLocated(By.id('email')), 5000);
        await emailIn.clear();
        await emailIn.sendKeys('wifi@pict.edu');

        const continueBtn = await wifiDriver.findElement(By.css('button[type="submit"]'));
        await continueBtn.click();

        const passIn = await wifiDriver.wait(until.elementLocated(By.id('password')), 5000);
        await passIn.sendKeys('Admin@123');

        const loginBtn = await wifiDriver.findElement(By.css('button[type="submit"]'));
        await loginBtn.click();

        await wifiDriver.wait(until.urlContains('wifi-dashboard'), 8000);
        assert(true, 'Wi-Fi In-Charge logged into /wifi-dashboard in browser');

        await setupNoRefreshTracker(wifiDriver);

        // Verify Wi-Fi Queue displays reports
        await wifiDriver.sleep(2000);
        const pageSource = await wifiDriver.getPageSource();
        for (const roomNum of ['101', '203', '305', '502']) {
            assert(pageSource.includes(`Room ${roomNum}`) || pageSource.includes(`>${roomNum}<`), `Specialist queue displays report for Room ${roomNum}`);
        }

        // Verify Heat Map reflects rooms across all floors
        assert(pageSource.includes("Boys' Hostel Wi-Fi Heat Map"), "Wi-Fi Heat Map is displayed on specialist dashboard");
        
        // Step A.5: On-demand student mobile number reveal in browser
        console.log('  > Testing On-Demand Mobile Number Reveal in browser...');
        const viewMobileButtons = await wifiDriver.findElements(By.xpath('//button[contains(., "View Mobile")]'));
        assert(viewMobileButtons.length > 0, `Specialist dashboard provides on-demand "View Mobile" buttons (${viewMobileButtons.length} found)`);

        // Click first View Mobile button
        await viewMobileButtons[0].click();
        await wifiDriver.sleep(1500);

        // Verify revealed phone number appears
        const updatedSource = await wifiDriver.getPageSource();
        const hasRevealedPhone = /987654321[0-5]/.test(updatedSource);
        assert(hasRevealedPhone, 'Authorized specialist successfully revealed student mobile number on demand');

        // Step A.6: Update complaint status in browser
        console.log('  > Testing Complaint Status Update from Specialist Dashboard...');
        console.log('  Current URL before update:', await wifiDriver.getCurrentUrl());
        const updateButtons = await wifiDriver.findElements(By.xpath('//button[contains(., "Update")]'));
        console.log(`  Found ${updateButtons.length} update buttons`);
        if (updateButtons.length > 0) {
            console.log('  Button outerHTML:', await updateButtons[0].getAttribute('outerHTML'));
        }
        assert(updateButtons.length > 0, 'Specialist dashboard has Update buttons for triage');

        await wifiDriver.executeScript("arguments[0].scrollIntoView({block: 'center'});", updateButtons[0]);
        await wifiDriver.sleep(500);
        await wifiDriver.executeScript("arguments[0].click();", updateButtons[0]);
        await wifiDriver.sleep(1500);

        // Check browser console logs
        const browserLogs = await wifiDriver.manage().logs().get(logging.Type.BROWSER);
        console.log('  Browser console logs after clicking Update:');
        browserLogs.forEach(l => console.log(`    [${l.level.name}] ${l.message}`));

        console.log('  Current URL after clicking Update:', await wifiDriver.getCurrentUrl());
        const modalHeading = await wifiDriver.findElements(By.xpath('//h3[contains(text(), "Update Wi-Fi Complaint")]'));
        console.log(`  Modal heading found: ${modalHeading.length > 0}`);
        if (modalHeading.length === 0) {
            console.log('  Page source snippet:', (await wifiDriver.getPageSource()).slice(0, 1000));
        }

        // Modal select
        const statusSelect = await wifiDriver.wait(until.elementLocated(By.xpath('//form//select')), 5000);
        await statusSelect.click();
        const optResolved = await wifiDriver.findElement(By.css('option[value="Resolved"]'));
        await optResolved.click();

        const noteInput = await wifiDriver.findElement(By.css('textarea'));
        await noteInput.sendKeys('Router channel optimized and tested in room.');

        const saveUpdateBtn = await wifiDriver.findElement(By.xpath('//form//button[@type="submit"]'));
        await saveUpdateBtn.click();
        await wifiDriver.sleep(2000);

        // Verify update persisted in DB
        const resolvedCount = await Complaint.countDocuments({
            $or: [{ category: 'Internet' }, { quickCategory: 'WIFI_NOT_WORKING' }],
            status: 'Resolved'
        });
        assert(resolvedCount >= 1, `Complaint status successfully updated to Resolved in database (${resolvedCount} resolved)`);

        await verifyNoRefresh(wifiDriver, 'Wi-Fi Specialist');
    } finally {
        await wifiDriver.quit();
    }

    // Step A.7: Strict Warden Exclusion Checks
    console.log('\n--- Step A.7: Strict Warden Boundary & Isolation Checks ---');
    const wardenLoginRes = await apiCall('POST', '/auth/login', {
        email: 'warden@pict.edu',
        password: 'Admin@123'
    });
    assert(wardenLoginRes.status === 200, 'Warden login returned HTTP 200');
    const wardenToken = wardenLoginRes.data.token;

    // Check Warden's complaints endpoint
    const wardenComplaintsRes = await apiCall('GET', '/complaints/all', null, wardenToken);
    assert(wardenComplaintsRes.status === 200, 'Warden accessed complaints API');
    const wardenComplaintList = wardenComplaintsRes.data;
    const wardenWifiLeaks = wardenComplaintList.filter(c =>
        c.category === 'Internet' || c.quickCategory === 'WIFI_NOT_WORKING'
    );
    assert(wardenWifiLeaks.length === 0, 'Zero Wi-Fi complaints leaked into Warden complaints queue');

    // Check Warden's Service Monitor heatmap
    const wardenHeatmapRes = await apiCall('GET', '/services/heat-map', null, wardenToken);
    assert(wardenHeatmapRes.status === 200, 'Warden accessed service heat-map API');
    assert(wardenHeatmapRes.data.summary.wifi === undefined, 'Warden heat-map summary completely excludes Wi-Fi');

    // Check Warden denied from Wi-Fi specialist queue
    const wardenWifiQueueRes = await apiCall('GET', '/complaints/wifi/queue', null, wardenToken);
    assert(wardenWifiQueueRes.status === 403, 'Warden strictly rejected (403 Forbidden) from Wi-Fi specialist queue');

    // Check Warden denied from student contact on Wi-Fi complaints
    const wardenContactRes = await apiCall('GET', `/complaints/${wifiComplaints[0]._id}/student-contact`, null, wardenToken);
    assert(wardenContactRes.status === 403, 'Warden strictly rejected (403 Forbidden) from Wi-Fi student contact API');

    // -------------------------------------------------------------------------
    // SECTION B: WATER SUPPLY MULTI-STUDENT WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('SECTION B: WATER SUPPLY MULTI-FLOOR WORKFLOW & SHARED INCIDENTS');
    console.log('----------------------------------------------------------------------');

    // Submit water complaints from 5 distinct rooms across 4 floors
    const waterSubmitters = [
        studentsConfig[0], // 101, F1
        studentsConfig[1], // 102, F1
        studentsConfig[2], // 203, F2
        studentsConfig[3], // 305, F3
        studentsConfig[4]  // 404, F4
    ];

    const waterComplaints = [];
    for (const s of waterSubmitters) {
        // Authenticate student session
        const authRes = await apiCall('POST', '/auth/student/send-otp', { email: s.email });
        const devOtp = authRes.data.devOtp;
        const vRes = await apiCall('POST', '/auth/student/verify-otp', { email: s.email, otp: devOtp });
        const sToken = vRes.data.token;

        const cRes = await apiCall('POST', '/complaints', {
            title: `No water supply in room ${s.room}`,
            quickCategory: 'NO_WATER_SUPPLY',
            doorNumber: s.room
        }, sToken);

        assert(cRes.status === 201, `Water complaint created for Room ${s.room} (Floor ${s.floor})`);
        waterComplaints.push(cRes.data.complaint);
    }

    assert(waterComplaints.length === 5, '5 individual water complaints persisted');

    // Verify distinct affected rooms and incident proposal
    const proposedIncidents = await apiCall('GET', '/incidents?status=PROPOSED', null, wardenToken);
    assert(proposedIncidents.status === 200, 'Warden retrieved proposed incidents');
    const waterIncident = proposedIncidents.data.find(inc => inc.serviceType === 'WATER');
    assert(Boolean(waterIncident), 'Shared Water Incident was automatically proposed');
    assert(waterIncident.status === 'PROPOSED', 'Incident status is PROPOSED');
    assert(waterIncident.affectedRooms.length === 5, `Incident covers exactly 5 distinct rooms across multiple floors: ${waterIncident.affectedRooms.join(', ')}`);

    // Warden Confirms Incident
    const confirmRes = await apiCall('PUT', `/incidents/${waterIncident._id}/confirm`, {
        note: 'Confirmed multiple floor water pressure drop.'
    }, wardenToken);
    assert(confirmRes.status === 200, 'Warden confirmed proposed water incident');
    assert(confirmRes.data.incident.status === 'CONFIRMED', 'Incident status transitioned to CONFIRMED');

    // Warden Assigns Responsible Team
    const assignRes = await apiCall('PUT', `/incidents/${waterIncident._id}/assign`, {
        assignedTo: 'Plumbing Unit',
        assignedTeam: 'Plumbing Staff',
        notes: 'Replacing faulty booster pump impeller'
    }, wardenToken);
    assert(assignRes.status === 200, 'Warden assigned responsible team');
    assert(assignRes.data.incident.status === 'IN_PROGRESS', 'Incident status transitioned to IN_PROGRESS');

    // Record Progress Update
    const progRes = await apiCall('POST', `/incidents/${waterIncident._id}/progress`, {
        note: 'New pump installed, running pressure test.'
    }, wardenToken);
    assert(progRes.status === 200, 'Incident progress update recorded');

    // Record Restoration
    const restoreRes = await apiCall('PUT', `/incidents/${waterIncident._id}/restoration`, {
        restorationDetails: 'Riser pressure normalized at 3.5 bar.'
    }, wardenToken);
    assert(restoreRes.status === 200, 'Restoration details recorded');
    assert(restoreRes.data.incident.status === 'RESTORATION_REPORTED', 'Incident transitioned to RESTORATION_REPORTED');

    // Explicit Review of Complaints before closure
    // 4 resolved, 1 kept open (Room 404)
    const resolveRes = await apiCall('PUT', `/incidents/${waterIncident._id}/resolve`, {
        resolutionSummary: 'Water pressure restored across wings.',
        complaintDecisions: [
            { complaintId: waterComplaints[0]._id, decision: 'RESOLVE', note: 'Restored' },
            { complaintId: waterComplaints[1]._id, decision: 'RESOLVE', note: 'Restored' },
            { complaintId: waterComplaints[2]._id, decision: 'RESOLVE', note: 'Restored' },
            { complaintId: waterComplaints[3]._id, decision: 'RESOLVE', note: 'Restored' },
            { complaintId: waterComplaints[4]._id, decision: 'KEEP_OPEN', note: 'Air trap in Room 404 fixture' }
        ]
    }, wardenToken);
    assert(resolveRes.status === 200, 'Incident resolved with explicit complaint review');
    assert(resolveRes.data.incident.status === 'RESOLVED', 'Incident status changed to RESOLVED');

    // Verify individual complaint states
    const c101 = await Complaint.findById(waterComplaints[0]._id);
    assert(c101.status === 'Resolved', 'Complaint for Room 101 transitioned to Resolved');

    const c404 = await Complaint.findById(waterComplaints[4]._id);
    assert(c404.status === 'Pending', 'Complaint for Room 404 kept Pending per explicit review decision');
    assert(c404.incidentId === null, 'Kept-open Room 404 unlinked from resolved incident for individual follow-up');
    assert(c404.statusHistory.some(h => h.note.includes('Air trap')), 'Room 404 audit history preserved with Warden note');

    // -------------------------------------------------------------------------
    // SECTION C: ELECTRICITY MULTI-STUDENT WORKFLOW & DUPLICATES
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('SECTION C: ELECTRICITY MULTI-FLOOR WORKFLOW & DUPLICATE HANDLING');
    console.log('----------------------------------------------------------------------');

    const elecSubmitters = [
        studentsConfig[0], // Room 101, F1
        studentsConfig[1], // Room 102, F1
        studentsConfig[2], // Room 203, F2
        studentsConfig[3], // Room 305, F3
        studentsConfig[4]  // Room 404, F4
    ];

    const elecComplaints = [];
    for (const s of elecSubmitters) {
        const authRes = await apiCall('POST', '/auth/student/send-otp', { email: s.email });
        const vRes = await apiCall('POST', '/auth/student/verify-otp', { email: s.email, otp: authRes.data.devOtp });
        const sToken = vRes.data.token;

        const cRes = await apiCall('POST', '/complaints', {
            title: `Power outage in room ${s.room}`,
            quickCategory: 'NO_ELECTRICITY',
            doorNumber: s.room
        }, sToken);
        assert(cRes.status === 201, `Electricity complaint created for Room ${s.room}`);
        elecComplaints.push(cRes.data.complaint);
    }

    // Submit duplicate complaint from Room 101
    const s101Auth = await apiCall('POST', '/auth/student/send-otp', { email: studentsConfig[0].email });
    const s101V = await apiCall('POST', '/auth/student/verify-otp', { email: studentsConfig[0].email, otp: s101Auth.data.devOtp });
    const s101Token = s101V.data.token;

    const dupRes = await apiCall('POST', '/complaints', {
        title: 'Power outage duplicate from room 101',
        quickCategory: 'NO_ELECTRICITY',
        doorNumber: '101'
    }, s101Token);
    assert(dupRes.status === 201, 'Duplicate report from Room 101 accepted independently');
    assert(dupRes.data.complaint._id !== elecComplaints[0]._id, 'Duplicate has its own distinct complaint ID');

    // Verify incident covers exactly 5 distinct rooms
    const elecIncidentsRes = await apiCall('GET', '/incidents?status=PROPOSED', null, wardenToken);
    const elecIncident = elecIncidentsRes.data.find(inc => inc.serviceType === 'ELECTRICITY');
    assert(Boolean(elecIncident), 'Shared Electricity incident was automatically proposed');
    assert(elecIncident.affectedRooms.length === 5, `Duplicate report did NOT inflate distinct room count (remains 5: ${elecIncident.affectedRooms.join(', ')})`);

    // Confirm and resolve electricity incident
    await apiCall('PUT', `/incidents/${elecIncident._id}/confirm`, {}, wardenToken);
    await apiCall('PUT', `/incidents/${elecIncident._id}/assign`, { assignedTo: 'Electrician' }, wardenToken);
    const elecResolve = await apiCall('PUT', `/incidents/${elecIncident._id}/resolve`, {
        resolutionSummary: 'Substation breaker reset.',
        complaintDecisions: elecComplaints.concat(dupRes.data.complaint).map(c => ({
            complaintId: c._id,
            decision: 'RESOLVE',
            note: 'Power restored'
        }))
    }, wardenToken);
    assert(elecResolve.status === 200, 'Warden resolved electricity incident');
    assert(elecResolve.data.incident.status === 'RESOLVED', 'Electricity incident status is RESOLVED');

    // -------------------------------------------------------------------------
    // SECTION D: REAL-TIME WEBSOCKET & ZERO-REFRESH BROWSER CHECKS
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('SECTION D: ACTUAL BROWSER & REAL-TIME ZERO-REFRESH CHECKS');
    console.log('----------------------------------------------------------------------');

    // Open Wi-Fi specialist dashboard in a browser session and verify real-time arrival of new complaint
    const liveSpecialistDriver = await createDriver();
    try {
        await liveSpecialistDriver.get(BASE_URL);
        const inchargeTab = await liveSpecialistDriver.wait(until.elementLocated(By.xpath('//button[contains(text(), "Incharge") or contains(text(), "Staff")]')), 5000);
        await inchargeTab.click();

        const emailIn = await liveSpecialistDriver.wait(until.elementLocated(By.id('email')), 5000);
        await emailIn.sendKeys('wifi@pict.edu');
        const contBtn = await liveSpecialistDriver.findElement(By.css('button[type="submit"]'));
        await contBtn.click();

        const passIn = await liveSpecialistDriver.wait(until.elementLocated(By.id('password')), 5000);
        await passIn.sendKeys('Admin@123');
        const signinBtn = await liveSpecialistDriver.findElement(By.css('button[type="submit"]'));
        await signinBtn.click();

        await liveSpecialistDriver.wait(until.urlContains('wifi-dashboard'), 8000);
        console.log('  > Specialist dashboard opened and live.');

        // Inject page reload tracker
        await setupNoRefreshTracker(liveSpecialistDriver);

        // Submit a new Wi-Fi complaint from a 5th student (Room 102) via API simulating another live student
        const auth102 = await apiCall('POST', '/auth/student/send-otp', { email: studentsConfig[1].email });
        const v102 = await apiCall('POST', '/auth/student/verify-otp', { email: studentsConfig[1].email, otp: auth102.data.devOtp });
        
        console.log('  > Submitting live Wi-Fi complaint from Room 102...');
        const liveCreateRes = await apiCall('POST', '/complaints', {
            title: 'Live Wi-Fi failure in Room 102',
            quickCategory: 'WIFI_NOT_WORKING',
            doorNumber: '102'
        }, v102.data.token);
        assert(liveCreateRes.status === 201, 'Live Wi-Fi complaint submitted');

        // Check if specialist dashboard updates within 5 seconds without manual page reload
        console.log('  > Waiting for specialist dashboard to update via WebSocket without refresh...');
        let updated = false;
        for (let i = 0; i < 10; i++) {
            await liveSpecialistDriver.sleep(1000);
            const content = await liveSpecialistDriver.getPageSource();
            if (content.includes('Room 102') || content.includes('>102<')) {
                updated = true;
                break;
            }
        }
        assert(updated, 'Specialist dashboard dynamically updated with Room 102 via WebSocket!');
        await verifyNoRefresh(liveSpecialistDriver, 'Wi-Fi Specialist');

        // Check browser console logs for any errors
        const logs = await liveSpecialistDriver.manage().logs().get(logging.Type.BROWSER);
        const severeLogs = logs.filter(l => l.level.name === 'SEVERE' && !l.message.includes('favicon'));
        assert(severeLogs.length === 0, `Zero SEVERE browser console errors during live operation (${severeLogs.length} found)`);
    } finally {
        await liveSpecialistDriver.quit();
    }

    console.log('\n======================================================================');
    console.log(`PRACTICAL VERIFICATION COMPLETED: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
    console.log('======================================================================\n');

    await mongoose.disconnect();
    process.exit(results.failed.length === 0 ? 0 : 1);
}

runVerification().catch(err => {
    console.error('Fatal verification failure:', err);
    process.exit(1);
});
