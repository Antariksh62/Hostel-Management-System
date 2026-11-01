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

async function testLang(langCode) {
  console.log(`\nTesting login tabs in ${langCode}...`);
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

  await sendToTarget('Runtime.evaluate', {
    expression: `localStorage.setItem('hms_language', '${langCode}'); sessionStorage.clear(); window.location.reload();`
  });

  await new Promise(r => setTimeout(r, 2000));

  const tabInfo = await sendToTarget('Runtime.evaluate', {
    expression: `
      (() => {
        const triggers = Array.from(document.querySelectorAll('[role="tab"]'));
        return triggers.map(t => {
          const r = t.getBoundingClientRect();
          return {
            text: t.innerText.trim(),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height),
            state: t.getAttribute('data-state')
          };
        });
      })()
    `,
    returnByValue: true
  });

  const tabs = tabInfo.result?.result?.value || [];
  console.table(tabs);

  let hasOverlap = false;
  for (let i = 0; i < tabs.length - 1; i++) {
    if (tabs[i].right > tabs[i + 1].left) {
      console.error(`🚨 OVERLAP DETECTED in ${langCode} between ${tabs[i].text} and ${tabs[i+1].text}`);
      hasOverlap = true;
    }
  }
  if (!hasOverlap) {
    console.log(`✅ In ${langCode}, ALL TABS HAVE ZERO HORIZONTAL OVERLAP!`);
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
    await testLang('hi');
    await testLang('mr');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

run();
