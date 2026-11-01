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

async function testRole(email, password, roleValue, targetLang) {
  console.log(`\n======================================================`);
  console.log(`Testing Dashboard for: [${roleValue}] (${email}) in [${targetLang}]`);
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

  // Set language in localStorage
  await sendToTarget('Runtime.evaluate', {
    expression: `
      localStorage.setItem('hms_language', '${targetLang}');
    `
  });

  // Click appropriate role tab by value attribute
  await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const tab = document.querySelector('[role="tab"][value="${roleValue}"]');
        if (tab) tab.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));

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

  await new Promise(r => setTimeout(r, 4500));

  const pageAudit = await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.innerText;
        // Check if language switcher exists in the page
        const langBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('English') || b.innerText.includes('मराठी') || b.innerText.includes('हिन्दी'));
        
        return {
          url: window.location.href,
          hasLangSwitcher: langBtns.length > 0,
          langButtonText: langBtns.map(b => b.innerText.trim()),
          textSample: text.split('\\n').map(s => s.trim()).filter(Boolean).slice(0, 40)
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(pageAudit.result?.result?.value, null, 2));

  browserWs.close();
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\chrome-i18n-verify-2'
  ]);

  try {
    // 1. Test Staff in Marathi
    await testRole('staff1@test.com', 'Staff@123', 'staff', 'mr');

    // 2. Test Warden in Marathi
    await testRole('warden@pict.edu', 'Admin@123', 'warden', 'mr');
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch(console.error);
