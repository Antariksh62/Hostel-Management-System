const { spawn } = require("child_process");
const http = require("http");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on("error", reject);
    });
}

async function runBrowserAudit(targetUrl = "http://localhost:5173") {
    console.log("================================================================================");
    console.log("🌐 CHROME DEVTOOLS BROWSER PERFORMANCE BENCHMARK");
    console.log("================================================================================\n");

    console.log(`Target URL: ${targetUrl}`);
    console.log("Launching headless Chrome with Remote Debugging on port 9222...");

    const chromeProcess = spawn(CHROME_PATH, [
        "--headless=new",
        `--remote-debugging-port=${PORT}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=C:\\Users\\antar\\AppData\\Local\\Temp\\chrome_dev_audit",
        "--disable-extensions",
        "--disable-background-networking"
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const version = await fetchJSON(`http://127.0.0.1:${PORT}/json/version`);
        console.log(`Chrome Connected: ${version["Browser"]}`);

        // Get active target or open tab
        const tabs = await fetchJSON(`http://127.0.0.1:${PORT}/json/list`);
        const targetTab = tabs.find(t => t.type === "page") || tabs[0];
        console.log(`Page opened in tab: ${targetTab?.id}`);

        // Connect WebSocket to page
        const wsUrl = targetTab.webSocketDebuggerUrl;
        const WebSocket = require("ws");
        const ws = new WebSocket(wsUrl);

        let id = 1;
        const pendingCallbacks = new Map();

        ws.on("message", (msg) => {
            const data = JSON.parse(msg);
            if (data.id && pendingCallbacks.has(data.id)) {
                pendingCallbacks.get(data.id)(data);
                pendingCallbacks.delete(data.id);
            }
        });

        const send = (method, params = {}) => new Promise((resolve) => {
            const msgId = id++;
            pendingCallbacks.set(msgId, resolve);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });

        await new Promise(r => ws.on("open", r));

        // Enable domains
        await send("Network.enable");
        await send("Page.enable");
        await send("Performance.enable");

        const networkRequests = [];
        let totalBytesTransferred = 0;
        let totalEncodedBytes = 0;

        ws.on("message", (msg) => {
            const data = JSON.parse(msg);
            if (data.method === "Network.responseReceived") {
                const resp = data.params.response;
                networkRequests.push({
                    url: resp.url,
                    status: resp.status,
                    mimeType: resp.mimeType,
                    size: resp.encodedDataLength || 0
                });
            }
            if (data.method === "Network.loadingFinished") {
                totalEncodedBytes += data.params.encodedDataLength || 0;
            }
        });

        // Navigate to target
        console.log("Navigating and measuring performance...");
        const navStart = performance.now();
        await send("Page.navigate", { url: targetUrl });

        // Wait for page load event
        await new Promise(r => setTimeout(r, 3500));
        const navDuration = performance.now() - navStart;

        // Collect metrics
        const perfMetrics = await send("Performance.getMetrics");
        const metricMap = {};
        (perfMetrics.result?.metrics || []).forEach(m => {
            metricMap[m.name] = m.value;
        });

        const jsHeapUsedMB = ((metricMap["JSHeapUsedSize"] || 0) / (1024 * 1024)).toFixed(2);
        const jsHeapTotalMB = ((metricMap["JSHeapTotalSize"] || 0) / (1024 * 1024)).toFixed(2);
        const domNodes = metricMap["Nodes"] || 0;
        const taskDurationMs = ((metricMap["TaskDuration"] || 0) * 1000).toFixed(1);
        const scriptDurationMs = ((metricMap["ScriptDuration"] || 0) * 1000).toFixed(1);
        const layoutDurationMs = ((metricMap["LayoutDuration"] || 0) * 1000).toFixed(1);

        console.log("\n================================================================================");
        console.log("BROWSER RUNTIME METRICS (Chrome DevTools)");
        console.log("================================================================================");
        console.table({
            "Navigation Time (ms)": parseFloat(navDuration.toFixed(1)),
            "Total HTTP Requests": networkRequests.length,
            "Transferred Bytes (KB)": parseFloat((totalEncodedBytes / 1024).toFixed(1)),
            "JS Heap Used (MB)": parseFloat(jsHeapUsedMB),
            "JS Heap Total (MB)": parseFloat(jsHeapTotalMB),
            "DOM Nodes Count": domNodes,
            "Script Exec Time (ms)": parseFloat(scriptDurationMs),
            "Layout Duration (ms)": parseFloat(layoutDurationMs),
            "Main Thread Task Time (ms)": parseFloat(taskDurationMs)
        });

        // List top transfer assets
        console.log("\nTop Transferred Assets in Browser:");
        const sortedAssets = [...networkRequests].sort((a, b) => b.size - a.size).slice(0, 5);
        console.table(sortedAssets.map(a => ({
            "Asset URL": a.url.split("/").pop() || a.url,
            "Type": a.mimeType,
            "Status": a.status,
            "Size (KB)": (a.size / 1024).toFixed(1)
        })));

        ws.close();
    } catch (err) {
        console.error("Browser audit error:", err.message);
    } finally {
        chromeProcess.kill();
    }
}

// Check if port provided
const url = process.argv[2] || "http://localhost:5173";
runBrowserAudit(url);
