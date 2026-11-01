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
    '--user-data-dir=C:\\Windows\\Temp\\chrome-debug-profile'
  ]);

  try {
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

    console.log('Page loaded...');
    await new Promise(r => setTimeout(r, 1500));

    // Test clicking tabs via mouse pointer events and check active tab
    const testTabs = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const triggers = Array.from(document.querySelectorAll('[role="tab"]'));
          return triggers.map(t => ({
            text: t.innerText,
            value: t.getAttribute('data-value') || t.getAttribute('value'),
            state: t.getAttribute('data-state'),
            rect: t.getBoundingClientRect()
          }));
        })()
      `,
      returnByValue: true
    });

    console.log('Tabs in DOM:', JSON.stringify(testTabs.result?.result?.value, null, 2));

    browserWs.close();
  } catch (err) {
    console.error('Debug script error:', err);
  } finally {
    chrome.kill();
  }
}

run();
