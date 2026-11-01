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

async function runTest(email, password, roleIndex, roleName) {
  console.log(`\n======================================================`);
  console.log(`Testing [${roleName}] (${email}) in Marathi [mr]`);
  console.log(`======================================================`);

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

  await sendToTarget('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1500));

  // Set language in localStorage to Marathi
  await sendToTarget('Runtime.evaluate', {
    expression: `localStorage.setItem('hms_language', 'mr');`
  });
  await sendToTarget('Page.reload');
  await new Promise(r => setTimeout(r, 1500));

  // Click role tab by index: 0=student, 1=staff, 2=warden, 3=incharge
  await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        if (tabs[${roleIndex}]) tabs[${roleIndex}].click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Fill email
  await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(emailInput, '${email}');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  // Fill password
  await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const pwdInput = document.querySelector('input[type="password"]');
        if (!pwdInput) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(pwdInput, '${password}');
        pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `
  });

  await new Promise(r => setTimeout(r, 4000));

  const pageAudit = await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.innerText;
        const langBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('English') || b.innerText.includes('मराठी') || b.innerText.includes('हिन्दी'));
        const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);

        return {
          url: window.location.href,
          hasLangSwitcher: langBtns.length > 0,
          langButtonText: langBtns.map(b => b.innerText.trim()),
          snippet: lines.slice(0, 35)
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Result for ' + roleName + ':');
  console.log(JSON.stringify(pageAudit.result?.result?.value, null, 2));

  browserWs.close();
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\chrome-marathi-test-final'
  ]);

  try {
    // 1. Staff with 123456
    await runTest('staff1@test.com', '123456', 1, 'STAFF');

    // 2. Warden with Admin@123
    await runTest('warden@pict.edu', 'Admin@123', 2, 'WARDEN');

    // 3. Head Warden with Admin@123
    await runTest('headwarden@pict.edu', 'Admin@123', 2, 'HEADWARDEN');
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch(console.error);
