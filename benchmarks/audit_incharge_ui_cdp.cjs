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
    '--user-data-dir=C:\\Windows\\Temp\\chrome-incharge-audit'
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

    console.log('Navigating to http://localhost:5173/ ...');
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 2000));

    // Step 1: Click Incharge Tab
    const tabRes = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
          const tab = tabs.find(t => t.innerText.trim().toLowerCase() === 'incharge');
          if (!tab) return 'Incharge tab not found among: ' + tabs.map(t => t.innerText).join(', ');
          tab.click();
          return 'Clicked tab: ' + tab.innerText;
        })()
      `,
      returnByValue: true
    });
    console.log('Tab selection:', tabRes.result?.result?.value);
    await new Promise(r => setTimeout(r, 600));

    // Step 2: Fill Email
    const emailRes = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const emailInput = document.querySelector('input[type="email"]');
          if (!emailInput) return 'no email input';
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(emailInput, 'incharge@pict.edu');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));

          const nextBtn = document.querySelector('button[type="submit"]');
          if (!nextBtn) return 'no submit button on email step';
          nextBtn.click();
          return 'Entered email, clicked ' + nextBtn.innerText;
        })()
      `,
      returnByValue: true
    });
    console.log('Email step:', emailRes.result?.result?.value);
    await new Promise(r => setTimeout(r, 1000));

    // Step 3: Fill Password
    const pwdRes = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const pwdInput = document.querySelector('input[type="password"]');
          if (!pwdInput) return 'no password input';
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(pwdInput, 'Admin@123');
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));

          const submitBtn = document.querySelector('button[type="submit"]');
          if (!submitBtn) return 'no submit button on password step';
          submitBtn.click();
          return 'Entered password, clicked ' + submitBtn.innerText;
        })()
      `,
      returnByValue: true
    });
    console.log('Password step:', pwdRes.result?.result?.value);

    console.log('Awaiting Incharge Dashboard render...');
    await new Promise(r => setTimeout(r, 4500));

    const auditState = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const url = window.location.href;
          const text = document.body.innerText;
          const sidebarLinks = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.getAttribute('href') }));
          const hasBrief = text.includes('Hostel health score') || text.includes('Morning Brief') || text.includes('Composite of complaints');
          const hasHeatmap = text.includes('Spatial Heatmap') || text.includes('Floor');
          const hasSignals = text.includes('Occupancy') && text.includes('Complaint Health');
          const hasMissionControl = text.includes('Mission Control') || text.includes('Actionable Decisions') || text.includes('Recommendation');
          const hasForecast = text.includes('Forecast') || text.includes('Trajectory');
          const userNameInProfile = text.includes('Dr. A. Deshpande') ? 'Dr. A. Deshpande, Chief Warden (HARDCODED)' : 'Dynamic Auth User';

          return {
            url,
            textSnippet: text.slice(0, 500).replace(/\\n+/g, ' | '),
            hasBrief,
            hasHeatmap,
            hasSignals,
            hasMissionControl,
            hasForecast,
            userNameInProfile,
            sidebarLinks: sidebarLinks.filter(l => l.text.length > 0 && l.text.length < 50)
          };
        })()
      `,
      returnByValue: true
    });

    console.log('\n--- MAIN INCHARGE DASHBOARD AUDIT ---');
    console.log(JSON.stringify(auditState.result?.result?.value, null, 2));

    // Test Admissions view
    console.log('\nTesting Admissions View: /incharge-dashboard?view=admissions ...');
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/incharge-dashboard?view=admissions' });
    await new Promise(r => setTimeout(r, 3500));

    const admissionsAudit = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const text = document.body.innerText;
          const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
          const hasTable = !!document.querySelector('table');
          const hasUploadBtn = buttons.some(b => b.toLowerCase().includes('upload') || b.toLowerCase().includes('import'));
          const hasExportBtn = buttons.some(b => b.toLowerCase().includes('export'));
          const hasApproveBtn = buttons.some(b => b.toLowerCase().includes('approve'));

          return {
            url: window.location.href,
            textSnippet: text.slice(0, 400).replace(/\\n+/g, ' | '),
            hasTable,
            hasUploadBtn,
            hasExportBtn,
            hasApproveBtn,
            buttonLabels: buttons.slice(0, 15)
          };
        })()
      `,
      returnByValue: true
    });

    console.log('\n--- ADMISSIONS MODULE AUDIT ---');
    console.log(JSON.stringify(admissionsAudit.result?.result?.value, null, 2));

    browserWs.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch(console.error);
