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

async function testFullUiLogin(roleName, tabText, email, password, expectedUrlPrefix) {
  console.log(`\n======================================================`);
  console.log(`Testing Full UI Login for: ${roleName} (${email})`);
  console.log(`======================================================`);

  const browserWsUrl = await getDebuggerUrl();
  const browserWs = new WebSocket(browserWsUrl);
  let msgId = 1;
  const callbacks = new Map();

  function sendRaw(obj) {
    return new Promise((resolve) => {
      callbacks.set(obj.id, resolve);
      browserWs.send(JSON.stringify(obj));
    });
  }

  const exceptions = [];
  const errors = [];

  browserWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
    if (msg.method === 'Target.receivedMessageFromTarget' && msg.params.sessionId === sessionId) {
      const inner = JSON.parse(msg.params.message);
      if (inner.id && callbacks.has(inner.id)) {
        callbacks.get(inner.id)(inner);
        callbacks.delete(inner.id);
      }
      if (inner.method === 'Runtime.consoleAPICalled') {
        const text = inner.params.args.map(a => a.value || a.description || '').join(' ');
        if (inner.params.type === 'error') {
          errors.push(text);
          console.error(`  [CONSOLE ERROR]:`, text);
        }
      }
      if (inner.method === 'Runtime.exceptionThrown') {
        const desc = inner.params.exceptionDetails.exception?.description || inner.params.exceptionDetails.text;
        exceptions.push(desc);
        console.error(`  [UNCAUGHT EXCEPTION]:`, desc);
      }
    }
  };

  await new Promise(r => browserWs.onopen = r);

  const targetRes = await sendRaw({ id: msgId++, method: 'Target.createTarget', params: { url: 'http://localhost:5173/' } });
  const targetId = targetRes.result.targetId;

  const attachRes = await sendRaw({ id: msgId++, method: 'Target.attachToTarget', params: { targetId, flatten: true } });
  var sessionId = attachRes.result.sessionId;

  function sendToTarget(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      browserWs.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  await sendToTarget('Page.enable');
  await sendToTarget('Runtime.enable');

  // Clear storage and start fresh on /
  await sendToTarget('Runtime.evaluate', {
    expression: `
      localStorage.setItem('hms_language', 'en');
      sessionStorage.clear();
      window.location.href = '/';
    `
  });

  await new Promise(r => setTimeout(r, 1500));

  // Step 1: Click the appropriate tab
  const clickTabRes = await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const tab = tabs.find(t => t.innerText.trim().toLowerCase() === '${tabText.toLowerCase()}');
        if (!tab) return 'Tab ${tabText} not found among: ' + tabs.map(t => t.innerText).join(', ');
        tab.click();
        return 'Clicked ' + tab.innerText;
      })()
    `,
    returnByValue: true
  });
  console.log('  Tab step:', clickTabRes.result?.result?.value);

  await new Promise(r => setTimeout(r, 500));

  // Step 2: Fill in email and submit
  const emailStepRes = await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        if (!emailInput) return 'Email input not found';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(emailInput, '${email}');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));

        const submitBtn = document.querySelector('button[type="submit"]');
        if (!submitBtn) return 'Submit button not found';
        submitBtn.click();
        return 'Entered email, clicked: ' + submitBtn.innerText;
      })()
    `,
    returnByValue: true
  });
  console.log('  Email step:', emailStepRes.result?.result?.value);

  await new Promise(r => setTimeout(r, 800));

  // Step 3: Fill in password and submit
  const pwdStepRes = await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const pwdInput = document.querySelector('input[type="password"]');
        if (!pwdInput) return 'Password input not found';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(pwdInput, '${password}');
        pwdInput.dispatchEvent(new Event('input', { bubbles: true }));

        const submitBtn = document.querySelector('button[type="submit"]');
        if (!submitBtn) return 'Sign in button not found';
        submitBtn.click();
        return 'Entered password, clicked: ' + submitBtn.innerText;
      })()
    `,
    returnByValue: true
  });
  console.log('  Password step:', pwdStepRes.result?.result?.value);

  // Wait 4 seconds for navigation & dashboard rendering
  await new Promise(r => setTimeout(r, 4000));

  const pageCheck = await sendToTarget('Runtime.evaluate', {
    expression: `
      ({
        url: window.location.href,
        text: document.body.innerText.trim().slice(0, 150),
        htmlLength: document.body.innerHTML.length
      })
    `,
    returnByValue: true
  });

  const final = pageCheck.result?.result?.value;
  console.log('  Final URL:', final?.url);
  console.log('  Page Preview:', final?.text?.replace(/\n/g, ' '));
  console.log('  HTML Length:', final?.htmlLength);

  if (final?.htmlLength < 500) {
    console.error(`❌ FAILED: Page rendered blank white screen!`);
  } else if (!final?.url.includes(expectedUrlPrefix)) {
    console.error(`❌ FAILED: Unexpected URL ${final?.url} (expected to contain ${expectedUrlPrefix})`);
  } else {
    console.log(`✅ SUCCESS: ${roleName} logged in cleanly via UI with zero white screen!`);
  }

  browserWs.close();
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\chrome-debug-profile'
  ]);

  try {
    await testFullUiLogin('Warden', 'Warden', 'warden@pict.edu', 'Admin@123', 'admin-dashboard');
    await testFullUiLogin('Incharge', 'Incharge', 'incharge@pict.edu', 'Admin@123', 'incharge-dashboard');
    await testFullUiLogin('Staff', 'Staff', 'staff@pict.edu', 'Admin@123', 'staff-dashboard');
    await testFullUiLogin('Head Warden', 'Warden', 'headwarden@pict.edu', 'Admin@123', 'headwarden-dashboard');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

run();
