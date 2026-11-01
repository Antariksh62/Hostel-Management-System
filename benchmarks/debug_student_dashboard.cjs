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
          console.error('[BROWSER EXCEPTION]:', inner.params.exceptionDetails.text, inner.params.exceptionDetails.exception?.description || '');
        }
      }
    };

    await new Promise(r => browserWs.onopen = r);

    const targetRes = await sendRaw({ id: msgId++, method: 'Target.createTarget', params: { url: 'about:blank' } });
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
    await sendToTarget('Log.enable');

    const initScript = `
      sessionStorage.setItem('token', ${JSON.stringify(token)});
      sessionStorage.setItem('user', ${JSON.stringify(JSON.stringify(userData))});
    `;
    await sendToTarget('Page.addScriptToEvaluateOnNewDocument', { source: initScript });

    console.log('Navigating directly to http://localhost:5173/student-dashboard ...');
    await sendToTarget('Page.navigate', { url: 'http://localhost:5173/student-dashboard' });

    await new Promise(r => setTimeout(r, 6000));

    const checkState = await sendToTarget('Runtime.evaluate', {
      expression: '({ href: window.location.href, text: document.body.innerText.trim(), html: document.body.innerHTML })',
      returnByValue: true
    });
    console.log('Rendered student dashboard state:');
    console.log('URL:', checkState.result?.result?.value?.href);
    console.log('Text:', checkState.result?.result?.value?.text);
    console.log('HTML snippet:', checkState.result?.result?.value?.html?.slice(0, 300));

    browserWs.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

run();
