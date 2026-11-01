const { spawn } = require('child_process');
const path = require('path');
const jwt = require(path.resolve(__dirname, '../backend/node_modules/jsonwebtoken'));

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
    '--user-data-dir=C:\\Windows\\Temp\\chrome-debug-profile'
  ]);

  try {
    const token = jwt.sign(
      { id: '6a9141146bc5f921b15c2979', role: 'STUDENT', email: 'f24ce307@ms.pict.edu' },
      'your_super_secret_jwt_key_change_in_production_12345',
      { expiresIn: '1d' }
    );
    const userData = {
      id: '6a9141146bc5f921b15c2979',
      _id: '6a9141146bc5f921b15c2979',
      name: 'Antariksh Kothari',
      fullName: 'Antariksh Kothari',
      email: 'f24ce307@ms.pict.edu',
      role: 'STUDENT',
      doorNumber: '204',
      prn: 'F24CE307',
      preferredLanguage: 'en'
    };

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
          console.log(`[BROWSER ${inner.params.type.toUpperCase()}]:`, ...inner.params.args.map(a => a.value || a.description || ''));
        }
        if (inner.method === 'Runtime.exceptionThrown') {
          console.error('[UNCAUGHT EXCEPTION]:', inner.params.exceptionDetails.text, inner.params.exceptionDetails.exception?.description || '');
          errors.push(inner.params.exceptionDetails);
        }
      }
    };

    await new Promise(r => browserWs.onopen = r);

    // Create target on http://localhost:5173/ first!
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

    console.log('Setting auth in localhost:5173 sessionStorage...');
    await sendToTarget('Runtime.evaluate', {
      expression: `
        sessionStorage.setItem('token', ${JSON.stringify(token)});
        sessionStorage.setItem('user', ${JSON.stringify(JSON.stringify(userData))});
      `
    });

    const routes = [
      { name: 'Student Home', path: '/student-dashboard' },
      { name: 'Student Complaints', path: '/student-dashboard/complaints' },
      { name: 'Student Room', path: '/student-dashboard/room' },
      { name: 'Student Profile', path: '/student-dashboard/profile' }
    ];

    for (const r of routes) {
      console.log(`\nNavigating to ${r.name} (${r.path})...`);
      await sendToTarget('Runtime.evaluate', {
        expression: `window.location.href = '${r.path}';`
      });
      await new Promise(res => setTimeout(res, 3000));

      const state = await sendToTarget('Runtime.evaluate', {
        expression: '({ href: window.location.href, text: document.body.innerText.trim().slice(0, 100), htmlLength: document.body.innerHTML.length })',
        returnByValue: true
      });
      const val = state.result?.result?.value;
      console.log(`  URL: ${val?.href}`);
      console.log(`  HTML Length: ${val?.htmlLength}`);
      console.log(`  Text: "${val?.text?.replace(/\n/g, ' ')}"`);

      if (val?.htmlLength < 500) {
        console.error(`❌ FAILED: ${r.name} rendered blank!`);
      } else {
        console.log(`✅ PASSED: ${r.name} rendered cleanly!`);
      }
    }

    console.log(`\nTotal errors: ${errors.length}`);
    browserWs.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

run();

