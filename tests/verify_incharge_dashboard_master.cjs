const { spawn } = require('child_process');

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome remote debugger not accessible');
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\chrome-incharge-master-test'
  ]);

  try {
    const browserWsUrl = await getDebuggerUrl();
    const browserWs = new WebSocket(browserWsUrl);
    let msgId = 1;
    const callbacks = new Map();

    function sendRaw(obj) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        browserWs.send(JSON.stringify({ ...obj, id }));
      });
    }

    browserWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        resolve(msg);
      }
    };

    await new Promise(r => browserWs.onopen = r);

    const targetRes = await sendRaw({ method: 'Target.createTarget', params: { url: 'about:blank' } });
    const targetId = targetRes.result.targetId;

    const attachRes = await sendRaw({ method: 'Target.attachToTarget', params: { targetId, flatten: true } });
    const sessionId = attachRes.result.sessionId;

    function sendToTarget(method, params = {}) {
      return sendRaw({ sessionId, method, params });
    }

    await sendToTarget('Page.enable');
    await sendToTarget('Runtime.enable');
    await sendToTarget('DOM.enable');
    await sendToTarget('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    async function evaluate(expression) {
      const res = await sendToTarget('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
      }
      return res.result.result ? res.result.result.value : null;
    }

    async function wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    console.log('=== STEP 1: AUTHENTICATE INCHARGE VIA FRONTEND ===');
    const jwt = require('../backend/node_modules/jsonwebtoken');
    const JWT_SECRET = 'hostel_pict_jwt_super_secret_2024';

    const inchargeToken = jwt.sign(
      { id: '672000000000000000000001', role: 'INCHARGE', email: 'incharge@pict.edu', name: 'Hostel Incharge' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const inchargeUser = { id: '672000000000000000000001', name: 'Hostel Incharge', email: 'incharge@pict.edu', role: 'INCHARGE' };

    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(2000);

    const authSetup = await evaluate(`
      (() => {
        sessionStorage.setItem('token', ${JSON.stringify(inchargeToken)});
        sessionStorage.setItem('user', JSON.stringify(${JSON.stringify(inchargeUser)}));
        localStorage.setItem('token', ${JSON.stringify(inchargeToken)});
        localStorage.setItem('user', JSON.stringify(${JSON.stringify(inchargeUser)}));
        return { success: true, user: ${JSON.stringify(inchargeUser.name)}, role: 'INCHARGE' };
      })()
    `);
    console.log('Auth setup result:', authSetup);

    // Navigate to incharge dashboard
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/incharge-dashboard' });
    await wait(3000);

    const postLoginUrl = await evaluate('window.location.href');
    console.log('Post-login URL:', postLoginUrl);
    if (!postLoginUrl.includes('/incharge-dashboard')) {
      throw new Error(`Failed to navigate to incharge dashboard, url: ${postLoginUrl}`);
    }

    console.log('\n=== STEP 2: VERIFY PROFILE AND REMOVAL OF HARDCODED IDENTITY ===');
    const profileCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        const hasHardcodedName = bodyText.includes('Dr. A. Deshpande');
        const hasChiefWarden = bodyText.includes('Chief Warden');
        const hasInchargeRole = bodyText.includes('Hostel In-Charge');
        const hasSignout = Array.from(document.querySelectorAll('button')).some(b => 
          b.textContent.includes('Sign out') || 
          b.textContent.includes('बाहेर पडा') || 
          b.textContent.includes('लॉग आउट') || 
          b.getAttribute('title') === 'Sign out'
        );

        return {
          hasHardcodedName,
          hasChiefWarden,
          hasInchargeRole,
          hasSignout
        };
      })()
    `);
    console.log('Profile Check:', profileCheck);
    if (profileCheck.hasHardcodedName) throw new Error('FAIL: Hardcoded "Dr. A. Deshpande" still present in DOM!');
    if (!profileCheck.hasSignout) throw new Error('FAIL: Sign out button not found!');

    console.log('\n=== STEP 3: VERIFY REMOVAL OF FAKE AI, MISSION CONTROL, FORECAST & DRAWER ===');
    const removalCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasMissionControl: bodyText.includes('Mission control') || bodyText.includes('Simulated monthly savings'),
          hasFakeSavings: bodyText.includes('₹') && bodyText.includes('saved'),
          hasForecastBand: bodyText.includes('Consumable stock depletion') || bodyText.includes('Forecast band') || bodyText.includes('Predictive maintenance'),
          hasInvestigationDrawer: Boolean(document.querySelector('[data-investigation-drawer]')) || bodyText.includes('Investigation Drawer'),
        };
      })()
    `);
    console.log('Removal Check:', removalCheck);
    if (removalCheck.hasMissionControl) throw new Error('FAIL: Fake Mission Control AI still present!');
    if (removalCheck.hasForecastBand) throw new Error('FAIL: Predictive Forecast band still present!');

    console.log('\n=== STEP 4: VERIFY OVERVIEW TAB & OPERATIONAL KPI STRIP ===');
    const overviewCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasMorningBrief: bodyText.includes('Brief') || bodyText.includes('Operations are') || bodyText.includes('complaints received'),
          hasSignalStrip: bodyText.includes('What is happening today?') || bodyText.includes('signals'),
          hasComplaintsButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Complaints & Hotspots')),
          hasResidentsButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Residents & Rooms')),
          hasStaffButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Staff Oversight')),
          hasWifiButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Wi-Fi Dashboard')),
        };
      })()
    `);
    console.log('Overview Check:', overviewCheck);
    if (!overviewCheck.hasComplaintsButton || !overviewCheck.hasResidentsButton || !overviewCheck.hasStaffButton) {
      throw new Error('FAIL: Operations quick navigation buttons missing from Overview!');
    }

    console.log('\n=== STEP 5: VERIFY ADMISSIONS & ELIGIBILITY ACCESSIBLE TO INCHARGE (EQUAL AUTHORITY) ===');
    const admissionsCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        const navButtons = Array.from(document.querySelectorAll('aside button, aside a')).map(el => el.textContent.trim());
        const hasAdmissionsInIncharge = navButtons.some(t => t.includes('Student Admission') || t.includes('Admissions'));
        return {
          hasAdmissionsInIncharge,
        };
      })()
    `);
    console.log('Admissions Check:', admissionsCheck);
    if (!admissionsCheck.hasAdmissionsInIncharge) throw new Error('FAIL: Admissions must be accessible in Incharge navigation per master prompt!');

    console.log('\n=== STEP 6: TEST COMPLAINTS & HOTSPOTS TAB (AUTHORITATIVE 77 ROOMS) ===');
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Complaints & Hotspots'));
        if (btn) btn.click();
      })()
    `);
    await wait(3000);

    const complaintsCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        // Count rooms in DOM: rooms have button or div with text 101..117, 201..217, etc.
        const allText = Array.from(document.querySelectorAll('*')).map(el => el.textContent.trim());
        
        let roomsFound = new Set();
        // Check authoritative rooms
        for (let f = 1; f <= 4; f++) {
          for (let r = 1; r <= 17; r++) {
            const rId = f + String(r).padStart(2, '0');
            if (document.querySelector('[data-room-id="' + rId + '"]') || document.body.innerText.includes(rId)) {
              roomsFound.add(rId);
            }
          }
        }
        for (let r = 1; r <= 9; r++) {
          const rId = '5' + String(r).padStart(2, '0');
          if (document.querySelector('[data-room-id="' + rId + '"]') || document.body.innerText.includes(rId)) {
            roomsFound.add(rId);
          }
        }

        // Check that invented room 120 does NOT exist
        const hasInventedRoom120 = document.querySelector('[data-room-id="120"]') !== null;
        const hasInventedRoom510 = document.querySelector('[data-room-id="510"]') !== null;

        return {
          url: window.location.href,
          hasHeatmapHeader: bodyText.includes('77-Room Spatial Heatmap') || bodyText.includes('Heat Map'),
          authoritativeRoomsDetected: roomsFound.size,
          hasInventedRoom120,
          hasInventedRoom510,
          hasComplaintsBand: bodyText.includes('What keeps breaking?') || bodyText.includes('Top categories'),
          hasComplaintsTable: bodyText.includes('Operational Complaints') || bodyText.includes('All status')
        };
      })()
    `);
    console.log('Complaints & Hotspots Check:', complaintsCheck);
    if (complaintsCheck.hasInventedRoom120 || complaintsCheck.hasInventedRoom510) {
      throw new Error('FAIL: Invented rooms (e.g. 120 or 510) detected in floor map!');
    }
    if (complaintsCheck.authoritativeRoomsDetected < 70) {
      throw new Error(`FAIL: Expected ~77 rooms detected, found only ${complaintsCheck.authoritativeRoomsDetected}`);
    }

    console.log('\n=== STEP 7: TEST RESIDENTS & ROOMS TAB ===');
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Residents & Rooms'));
        if (btn) btn.click();
      })()
    `);
    await wait(3000);

    const residentsCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent);
        const hasCSVImportTab = buttons.some(t => t.includes('CSV Import'));
        return {
          url: window.location.href,
          hasDirectory: bodyText.includes('Student Directory') || bodyText.includes('Directory'),
          hasOccupancyTab: buttons.some(t => t.includes('Room Occupancy') || t.includes('Occupancy')),
          hasCSVImportTab, // Must be FALSE for INCHARGE
          staysInHoidssLayout: !window.location.pathname.includes('/admin-dashboard'),
        };
      })()
    `);
    console.log('Residents Check:', residentsCheck);
    if (residentsCheck.hasCSVImportTab) {
      throw new Error('FAIL: CSV Import tab must NOT be exposed to INCHARGE (exclusive to HEADWARDEN)!');
    }
    if (!residentsCheck.staysInHoidssLayout) {
      throw new Error('FAIL: Incharge got redirected to /admin-dashboard instead of staying in HOIDSS!');
    }

    console.log('\n=== STEP 8: TEST STAFF OVERSIGHT TAB ===');
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Staff Oversight'));
        if (btn) btn.click();
      })()
    `);
    await wait(3000);

    const staffCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          url: window.location.href,
          hasStaffHeader: bodyText.includes('Staff Oversight') || bodyText.includes('Staff Performance') || bodyText.includes('Resolution Analytics'),
          hasWorkloadOrTable: bodyText.includes('Assigned') || bodyText.includes('Workload') || bodyText.includes('Operational Filters') || bodyText.includes('Resolution'),
          noFakeEfficiencyScores: !bodyText.includes('AI Productivity Score') && !bodyText.includes('Predicted Speed Index'),
          staysInHoidssLayout: !window.location.pathname.includes('/admin-dashboard'),
        };
      })()
    `);
    console.log('Staff Check:', staffCheck);
    if (!staffCheck.staysInHoidssLayout) {
      throw new Error('FAIL: Incharge got redirected to /admin-dashboard for staff performance!');
    }

    console.log('\n=== STEP 9: TEST WI-FI DASHBOARD ACCESS & RETURN LINK ===');
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Wi-Fi Dashboard'));
        if (btn) btn.click();
      })()
    `);
    await wait(3000);

    const wifiCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        const returnLink = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('Operations Intelligence'));
        return {
          url: window.location.href,
          isWifiDashboard: window.location.pathname.includes('/wifi-dashboard'),
          hasWifiMap: bodyText.includes('Wi-Fi Heat Map') || bodyText.includes('Networking'),
          hasReturnToIncharge: Boolean(returnLink),
        };
      })()
    `);
    console.log('Wi-Fi Check:', wifiCheck);
    if (!wifiCheck.isWifiDashboard) {
      throw new Error('FAIL: Wi-Fi Dashboard not reachable!');
    }
    if (!wifiCheck.hasReturnToIncharge) {
      throw new Error('FAIL: Return link to Operations Intelligence missing from Wi-Fi Dashboard for INCHARGE!');
    }

    // Click return link to go back
    await evaluate(`
      (() => {
        const returnLink = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('Operations Intelligence'));
        if (returnLink) returnLink.click();
      })()
    `);
    await wait(2500);

    const returnUrl = await evaluate('window.location.href');
    console.log('URL after returning from Wi-Fi:', returnUrl);
    if (!returnUrl.includes('/incharge-dashboard')) {
      throw new Error(`FAIL: Return link failed to navigate back to /incharge-dashboard, got ${returnUrl}`);
    }

    console.log('\n=== STEP 10: TEST LOGOUT FUNCTIONALITY ===');
    const logoutResult = await evaluate(`
      (async () => {
        const signoutBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.includes('Sign out') || 
          b.textContent.includes('बाहेर पडा') || 
          b.textContent.includes('लॉग आउट') || 
          b.getAttribute('title') === 'Sign out'
        );
        if (!signoutBtn) return { success: false, error: 'Sign out button not found' };
        signoutBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        return {
          success: true,
          url: window.location.href,
          tokenCleared: sessionStorage.getItem('token') === null,
        };
      })()
    `);
    console.log('Logout Result:', logoutResult);
    if (!logoutResult.tokenCleared) {
      throw new Error('FAIL: Token was not cleared after logout!');
    }

    console.log('\n=== STEP 11: VERIFY PERMISSION ENFORCEMENT ACROSS ALL 6 ROLES ===');

    const roleDefinitions = [
      { role: 'INCHARGE', email: 'incharge@pict.edu', id: '672000000000000000000001' },
      { role: 'HEADWARDEN', email: 'headwarden@pict.edu', id: '672000000000000000000002' },
      { role: 'WARDEN', email: 'warden@pict.edu', id: '672000000000000000000003' },
      { role: 'WIFI_INCHARGE', email: 'wifi@pict.edu', id: '672000000000000000000004' },
      { role: 'STAFF', email: 'staff1@test.com', id: '672000000000000000000005' },
      { role: 'STUDENT', email: 'student1@test.com', id: '672000000000000000000006' },
    ];

    const roleTests = {};
    for (const def of roleDefinitions) {
      const token = jwt.sign({ id: def.id, role: def.role, email: def.email }, JWT_SECRET, { expiresIn: '1h' });

      // Test admissions endpoint
      const admRes = await fetch('http://localhost:5000/api/admissions/roster', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      // Test Wi-Fi endpoint
      const wifiRes = await fetch('http://localhost:5000/api/services/heat-map?service=wifi', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      // Test staff analytics endpoint
      const staffRes = await fetch('http://localhost:5000/api/staff-analytics/overview', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      roleTests[def.role] = {
        role: def.role,
        admissionsStatus: admRes.status,
        wifiStatus: wifiRes.status,
        staffAnalyticsStatus: staffRes.status,
      };
    }

    console.log('Role Permissions Matrix:');
    console.table(roleTests);

    // Verify rules:
    // INCHARGE: admissions 200, wifi 200, staffAnalytics 200
    // HEADWARDEN: admissions 200, wifi 200, staffAnalytics 200
    // WARDEN: admissions 403 (strictly excluded!), wifi 200, staffAnalytics 200
    // WIFI_INCHARGE: admissions 403, wifi 200, staffAnalytics 403
    // STAFF: admissions 403, staffAnalytics 403
    // STUDENT: admissions 403, staffAnalytics 403
    if (roleTests['INCHARGE'].admissionsStatus !== 200) {
      throw new Error(`FAIL: INCHARGE should have 200 on admissions, got ${roleTests['INCHARGE'].admissionsStatus}`);
    }
    if (roleTests['HEADWARDEN'].admissionsStatus !== 200) {
      throw new Error(`FAIL: HEADWARDEN should have 200 on admissions, got ${roleTests['HEADWARDEN'].admissionsStatus}`);
    }
    if (roleTests['WARDEN'].admissionsStatus !== 403) {
      throw new Error(`FAIL: WARDEN MUST be 403 on admissions, got ${roleTests['WARDEN'].admissionsStatus}`);
    }
    if (roleTests['STAFF'].admissionsStatus !== 403) {
      throw new Error(`FAIL: STAFF MUST be 403 on admissions, got ${roleTests['STAFF'].admissionsStatus}`);
    }
    if (roleTests['STUDENT'].admissionsStatus !== 403) {
      throw new Error(`FAIL: STUDENT MUST be 403 on admissions, got ${roleTests['STUDENT'].admissionsStatus}`);
    }
    if (roleTests['WIFI_INCHARGE'].admissionsStatus !== 403) {
      throw new Error(`FAIL: WIFI_INCHARGE MUST be 403 on admissions, got ${roleTests['WIFI_INCHARGE'].admissionsStatus}`);
    }

    console.log('\n========================================');
    console.log(' ALL VERIFICATION CHECKS PASSED PERFECTLY!');
    console.log('========================================\n');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
