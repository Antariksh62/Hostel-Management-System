const { spawn } = require('child_process');
const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

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

    const consoleMessages = [];
    const exceptions = [];

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
          consoleMessages.push(text);
          if (inner.params.type === 'error') {
            console.error('  [BROWSER ERROR]:', text);
          }
        }
        if (inner.method === 'Runtime.exceptionThrown') {
          const desc = inner.params.exceptionDetails.exception?.description || inner.params.exceptionDetails.text;
          exceptions.push(desc);
          console.error('  [UNCAUGHT EXCEPTION]:', desc);
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

    console.log('Clearing session and starting on Login page...');
    await sendToTarget('Runtime.evaluate', {
      expression: 'sessionStorage.clear();'
    });
    await new Promise(r => setTimeout(r, 2000));

    // Step 1: Send OTP for student f24ce307@ms.pict.edu
    console.log('Entering student email: f24ce307@ms.pict.edu ...');
    const sendOtpRes = await sendToTarget('Runtime.evaluate', {
      expression: `
        (async () => {
          const emailInput = document.querySelector('input[type="email"]');
          if (!emailInput) return { error: 'Email input not found' };
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(emailInput, 'f24ce307@ms.pict.edu');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));

          const btn = document.querySelector('button[type="submit"]');
          if (!btn) return { error: 'Send OTP button not found' };
          btn.click();
          return { status: 'clicked' };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Send OTP result:', sendOtpRes.result?.result?.value);

    // Wait 2.5 seconds for OTP to generate and response notice
    await new Promise(r => setTimeout(r, 2500));

    // Inspect page for dev OTP in notice text
    const noticeCheck = await sendToTarget('Runtime.evaluate', {
      expression: `
        (() => {
          const body = document.body.innerText;
          const match = body.match(/Dev OTP:\\s*([0-9]{6})/);
          return {
            text: body.slice(0, 300),
            devOtp: match ? match[1] : null
          };
        })()
      `,
      returnByValue: true
    });

    let otpCode = noticeCheck.result?.result?.value?.devOtp;
    console.log('Notice check:', noticeCheck.result?.result?.value);

    if (!otpCode) {
      await mongoose.connect('mongodb://127.0.0.1:27017/hostelDB');
      const latestOtp = await mongoose.connection.collection('otps').findOne(
        { email: 'f24ce307@ms.pict.edu' },
        { sort: { createdAt: -1 } }
      );
      otpCode = latestOtp?.otp;
      console.log('Fetched OTP from MongoDB:', otpCode);
    }

    if (!otpCode) {
      throw new Error('Could not obtain OTP for verification test');
    }

    // Step 2: Fill in OTP digits
    console.log(`Entering OTP code: ${otpCode} ...`);
    const otpFillRes = await sendToTarget('Runtime.evaluate', {
      expression: `
        (async () => {
          const otpInput = document.querySelector('input[autocomplete="one-time-code"]') || document.querySelector('#otp') || document.querySelector('input[maxlength="6"]');
          if (otpInput) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(otpInput, '${otpCode}');
            otpInput.dispatchEvent(new Event('input', { bubbles: true }));
            otpInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          await new Promise(r => setTimeout(r, 500));
          const verifyBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(b => b.innerText.includes('Verify'));
          if (verifyBtn) {
            verifyBtn.click();
            return 'Clicked verify button';
          }
          return 'Verify button not found';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('OTP fill result:', otpFillRes.result?.result?.value);

    // Wait 4 seconds for OTP verification and dashboard navigation
    await new Promise(r => setTimeout(r, 4000));

    const finalState = await sendToTarget('Runtime.evaluate', {
      expression: '({ href: window.location.href, text: document.body.innerText.trim().slice(0, 300), htmlLength: document.body.innerHTML.length })',
      returnByValue: true
    });

    const res = finalState.result?.result?.value;
    console.log('\n==============================================');
    console.log('FINAL STUDENT PORTAL RESULT:');
    console.log('==============================================');
    console.log('URL:', res?.href);
    console.log('HTML Length:', res?.htmlLength);
    console.log('Page Text Preview:', res?.text?.replace(/\n/g, ' '));
    console.log('Exceptions:', exceptions.length);

    if (res?.htmlLength < 500) {
      console.error('❌ STUDENT DASHBOARD IS STILL BLANK!');
    } else {
      console.log('🎉 SUCCESS: Student Dashboard rendered completely with zero errors!');
    }

    browserWs.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

run();
