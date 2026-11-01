const { spawn } = require('child_process');
const jwt = require('../backend/node_modules/jsonwebtoken');
const mongoose = require('../backend/node_modules/mongoose');
const StudentRoster = require('../backend/models/StudentRoster');

const JWT_SECRET = 'hostel_pict_jwt_super_secret_2024';

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
    '--user-data-dir=C:\\Windows\\Temp\\chrome-lang-test'
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

    console.log('=== TEST 1: VERIFY LANGUAGE SWITCHER ON LOGIN PAGE ACROSS ALL 4 TABS ===');
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(2000);

    // Clear any previous session so we are on the unauthenticated login page
    await evaluate(`
      (() => {
        localStorage.clear();
        sessionStorage.clear();
      })()
    `);
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(2000);

    // Check all 4 tabs on login page
    const tabsCheck = await evaluate(`
      (async () => {
        const results = {};
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

        for (const tab of tabs) {
          const tabName = tab.textContent.trim();
          tab.click();
          await new Promise(r => setTimeout(r, 400));
          const hasLanguageSwitcher = Boolean(document.querySelector('button[title*="language" i]') || document.querySelector('button[aria-label*="language" i]'));
          results[tabName] = hasLanguageSwitcher;
        }

        return results;
      })()
    `);
    console.log('Login tabs LanguageSwitcher check:', tabsCheck);
    for (const [tab, visible] of Object.entries(tabsCheck)) {
      if (!visible) {
        throw new Error(`FAIL: LanguageSwitcher was not visible on login page tab: "${tab}"!`);
      }
    }

    console.log('\n=== TEST 2: DEFAULT LANGUAGE IS ENGLISH ===');
    // Clear localStorage and sessionStorage to test pristine first visit
    await evaluate(`
      (() => {
        localStorage.clear();
        sessionStorage.clear();
      })()
    `);
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(2000);

    const defaultLangCheck = await evaluate(`
      (() => {
        const langBtn = document.querySelector('button[title*="language" i]') || document.querySelector('button[aria-label*="language" i]');
        const bodyText = document.body.innerText;
        return {
          langButtonText: langBtn ? langBtn.textContent.trim() : null,
          hasSignInText: bodyText.includes('Sign in'),
          hasStudentText: bodyText.includes('Student'),
        };
      })()
    `);
    console.log('Default Language Check:', defaultLangCheck);
    if (!defaultLangCheck.hasSignInText) {
      throw new Error(`FAIL: Default language is not English! Content: ${JSON.stringify(defaultLangCheck)}`);
    }

    console.log('\n=== TEST 3: CHANGE LANGUAGE TO MARATHI AND REMEMBER ACROSS RELOAD ===');
    // Click language switcher and select Marathi
    const switchMarathi = await evaluate(`
      (async () => {
        const langBtn = document.querySelector('button[title*="language" i]') || document.querySelector('button[aria-label*="language" i]');
        if (!langBtn) return { success: false, error: 'Language button not found' };
        langBtn.click();
        await new Promise(r => setTimeout(r, 400));

        const marathiOption = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('मराठी'));
        if (!marathiOption) return { success: false, error: 'Marathi option not found in menu' };
        marathiOption.click();
        await new Promise(r => setTimeout(r, 600));

        return {
          success: true,
          savedStorage: localStorage.getItem('hms_language'),
          pageText: document.body.innerText.includes('प्रवेश करा')
        };
      })()
    `);
    console.log('Switch to Marathi result:', switchMarathi);
    if (!switchMarathi.success || !switchMarathi.pageText) {
      throw new Error('FAIL: Switching to Marathi failed!');
    }

    // Now reload page http://localhost:5173/ and check if Marathi persists WITHOUT changing anything
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
    await wait(2000);

    const reloadPersistCheck = await evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          savedStorage: localStorage.getItem('hms_language'),
          hasMarathiHeader: bodyText.includes('प्रवेश करा'),
        };
      })()
    `);
    console.log('Reload Persistence Check:', reloadPersistCheck);
    if (!reloadPersistCheck.hasMarathiHeader || reloadPersistCheck.savedStorage !== 'mr') {
      throw new Error('FAIL: Language preference was not remembered after page reload!');
    }

    console.log('\n=== TEST 4: VERIFY DASHBOARD SCOPING ACROSS ALL ROLES ===');

    async function checkDashboardLanguageSwitcher(role, dashboardUrl, email, expectedVisible) {
      const token = jwt.sign({ id: '672000000000000000000099', role, email, name: `Test ${role}` }, JWT_SECRET, { expiresIn: '1h' });
      const user = { id: '672000000000000000000099', role, email, name: `Test ${role}` };

      await evaluate(`
        (() => {
          sessionStorage.setItem('token', ${JSON.stringify(token)});
          sessionStorage.setItem('user', JSON.stringify(${JSON.stringify(user)}));
          localStorage.setItem('token', ${JSON.stringify(token)});
          localStorage.setItem('user', JSON.stringify(${JSON.stringify(user)}));
        })()
      `);

      await sendToTarget('Page.navigate', { url: `http://localhost:5173${dashboardUrl}` });
      await wait(3000);

      const check = await evaluate(`
        (() => {
          const langBtn = document.querySelector('button[title*="language" i]') || document.querySelector('button[aria-label*="language" i]');
          return {
            url: window.location.href,
            hasLanguageSwitcher: Boolean(langBtn),
          };
        })()
      `);

      console.log(`Role ${role} (${dashboardUrl}): URL = ${check.url}, LanguageSwitcher visible = ${check.hasLanguageSwitcher} (Expected: ${expectedVisible})`);
      if (check.hasLanguageSwitcher !== expectedVisible) {
        throw new Error(`FAIL: Role ${role} expected LanguageSwitcher to be ${expectedVisible}, but got ${check.hasLanguageSwitcher}! Current URL: ${check.url}`);
      }
    }

    // Role expectations:
    // STAFF -> true
    await checkDashboardLanguageSwitcher('STAFF', '/staff-dashboard', 'staff1@test.com', true);

    // WARDEN -> true
    await checkDashboardLanguageSwitcher('WARDEN', '/admin-dashboard', 'warden@pict.edu', true);

    // HEADWARDEN -> true
    await checkDashboardLanguageSwitcher('HEADWARDEN', '/headwarden-dashboard', 'headwarden@pict.edu', true);

    // INCHARGE -> false (strictly specific to staff, warden, head warden)
    await checkDashboardLanguageSwitcher('INCHARGE', '/incharge-dashboard', 'incharge@pict.edu', false);

    // WIFI_INCHARGE -> false
    await checkDashboardLanguageSwitcher('WIFI_INCHARGE', '/wifi-dashboard', 'wifi@pict.edu', false);

    // Connect DB to ensure an active approved student exists
    await mongoose.connect('mongodb://127.0.0.1:27017/hostelDB');
    await StudentRoster.findOneAndUpdate(
      { email: 'lang.student@ms.pict.edu' },
      {
        name: 'Language Test Student',
        email: 'lang.student@ms.pict.edu',
        prn: 'F24LANG999',
        rollNumber: '99999',
        branch: 'CS',
        yearOfStudy: 'FE',
        doorNumber: '102',
        studentMobile: '9822099999',
        parentMobile: '9822088888',
        admissionStatus: 'APPROVED'
      },
      { upsert: true, returnDocument: 'after' }
    );

    // STUDENT -> false
    await checkDashboardLanguageSwitcher('STUDENT', '/student-dashboard', 'lang.student@ms.pict.edu', false);

    console.log('\n========================================');
    console.log(' ALL LANGUAGE REQUIREMENTS VERIFIED 100%!');
    console.log('========================================\n');

  } finally {
    if (mongoose.connection.readyState !== 0) {
      await StudentRoster.deleteOne({ email: 'lang.student@ms.pict.edu' }).catch(() => {});
      await mongoose.disconnect();
    }
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ LANGUAGE VERIFICATION FAILED:', err);
  process.exit(1);
});
