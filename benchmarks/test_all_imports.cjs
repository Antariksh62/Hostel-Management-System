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

async function testRole(role, email, password, path) {
  console.log(`\n==============================================`);
  console.log(`TESTING ROLE: ${role} (${email}) -> ${path}`);
  console.log(`==============================================`);

  let authData = {};
  if (role === 'STUDENT') {
    // Generate dev token for student
    const jwt = require('Hostel-Management-System/backend/node_modules/jsonwebtoken');
    const token = jwt.sign({ id: '6a9141146bc5f921b15c2979', role: 'STUDENT', email }, 'your_super_secret_jwt_key_change_in_production_12345', { expiresIn: '1d' });
    authData = {
      token,
      user: {
        id: '6a9141146bc5f921b15c2979',
        name: 'Test Student',
        fullName: 'Test Student',
        email,
        role: 'STUDENT',
        doorNumber: '101',
        preferredLanguage: 'en'
      }
    };
  } else {
    const authRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    authData = await authRes.json();
  }

  if (!authData.token) {
    console.error(`Could not authenticate ${email}:`, authData);
    return;
  }

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
  const consoleErrors = [];

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
          consoleErrors.push(text);
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

  await new Promise(r => setTimeout(r, 800));

  const setupScript = `
    sessionStorage.setItem('token', ${JSON.stringify(authData.token)});
    sessionStorage.setItem('user', ${JSON.stringify(JSON.stringify(authData.user))});
    window.location.href = '${path}';
  `;

  await sendToTarget('Runtime.evaluate', { expression: setupScript });

  await new Promise(r => setTimeout(r, 4000));

  const resultState = await sendToTarget('Runtime.evaluate', {
    expression: '({ href: window.location.href, text: document.body.innerText.trim().slice(0, 200), htmlLength: document.body.innerHTML.length })',
    returnByValue: true
  });

  const res = resultState.result?.result?.value;
  console.log(`  Current URL: ${res?.href}`);
  console.log(`  Page Text: "${res?.text?.replace(/\n/g, ' ')}"`);
  console.log(`  HTML Length: ${res?.htmlLength}`);
  console.log(`  Exceptions: ${exceptions.length}`);
  console.log(`  Console Errors: ${consoleErrors.length}`);

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
    await testRole('STAFF', 'staff@pict.edu', 'Admin@123', '/staff-dashboard');
    await testRole('STUDENT', 'f24ce307@ms.pict.edu', '', '/student-dashboard');
  } catch (err) {
    console.error('Run error:', err);
  } finally {
    chrome.kill();
  }
}

run();
