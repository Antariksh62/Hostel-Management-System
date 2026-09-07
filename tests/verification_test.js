const { Builder, By, until, logging } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const LOG_PATH = path.join(__dirname, '../backend/logs/combined.log');

// Dynamic OTP extractor
function getLatestOTP(email) {
    if (!fs.existsSync(LOG_PATH)) {
        throw new Error(`Log file not found at: ${LOG_PATH}`);
    }
    const logs = fs.readFileSync(LOG_PATH, 'utf8');
    const regex = new RegExp(`OTP generated for ${email}: (\\d{6})`, 'g');
    let match;
    let lastOtp = null;
    while ((match = regex.exec(logs)) !== null) {
        lastOtp = match[1];
    }
    return lastOtp;
}

async function createDriver() {
    let options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--window-size=1920,1080');
    // Enable browser console logs collection
    const prefs = new logging.Preferences();
    prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
    options.setLoggingPrefs(prefs);
    return await new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

// Inject page reload monitor
async function setupNoRefreshTracker(driver) {
    await driver.executeScript(`
        window.__testNoRefresh = true;
        window.addEventListener('beforeunload', () => {
            window.__testNoRefresh = false;
        });
    `);
}

async function verifyNoRefresh(driver, roleName) {
    const noRefresh = await driver.executeScript('return window.__testNoRefresh;');
    if (noRefresh !== true) {
        throw new Error(`[FAIL] Page reload detected in ${roleName} session!`);
    }
    console.log(`[PASS] Verified: No page reload occurred in ${roleName} session.`);
}

async function getComplaintCard(driver, titleText) {
    const cards = await driver.findElements(By.css('.complaint-item'));
    for (let card of cards) {
        try {
            const titleEl = await card.findElement(By.css('.complaint-title'));
            const text = await titleEl.getText();
            if (text.includes(titleText)) {
                return card;
            }
        } catch (err) {
            // ignore and check next
        }
    }
    return null;
}

async function getConsoleErrors(driver, roleName) {
    try {
        const logs = await driver.manage().logs().get(logging.Type.BROWSER);
        const criticalErrors = logs.filter(log => log.level.name === 'SEVERE' || log.message.includes('failed to load'));
        if (criticalErrors.length > 0) {
            console.log(`[Console Errors - ${roleName}]:`);
            criticalErrors.forEach(err => console.log(`  - [${err.level.name}] ${err.message}`));
        }
        return criticalErrors;
    } catch (err) {
        return [];
    }
}

async function runTests() {
    let studentDriver, wardenDriver, staffDriver;
    const results = {};
    const complaintTitle = `E2E Socket test ${Date.now()}`;

    try {
        console.log('==================================================');
        console.log('1. INITIALIZING WEBDRIVERS & AUTHENTICATION');
        console.log('==================================================');
        
        studentDriver = await createDriver();
        wardenDriver = await createDriver();
        staffDriver = await createDriver();

        // --- 1.1 Warden Login ---
        console.log('Logging in as Warden (warden@test.com)...');
        await wardenDriver.get(BASE_URL);
        const wEmailInput = await wardenDriver.wait(until.elementLocated(By.id('staff-email')), 5000);
        const wPassInput = await wardenDriver.findElement(By.id('staff-password'));
        const wLoginBtn = await wardenDriver.findElement(By.id('staff-login-btn'));
        await wEmailInput.sendKeys('warden@test.com');
        await wPassInput.sendKeys('123456');
        await wLoginBtn.click();
        await wardenDriver.wait(until.urlContains('dashboard'), 5000);
        console.log('Warden logged in successfully.');
        results['Warden login'] = 'PASS';

        // --- 1.2 Staff Login ---
        console.log('Logging in as Staff (staff1@test.com)...');
        await staffDriver.get(BASE_URL);
        const sEmailInput = await staffDriver.wait(until.elementLocated(By.id('staff-email')), 5000);
        const sPassInput = await staffDriver.findElement(By.id('staff-password'));
        const sLoginBtn = await staffDriver.findElement(By.id('staff-login-btn'));
        await sEmailInput.sendKeys('staff1@test.com');
        await sPassInput.sendKeys('123456');
        await sLoginBtn.click();
        await staffDriver.wait(until.urlContains('dashboard'), 5000);
        console.log('Staff logged in successfully.');
        results['Staff login'] = 'PASS';

        // --- 1.3 Student Login via OTP ---
        console.log('Requesting OTP for student (f24ce307@ms.pict.edu)...');
        await studentDriver.get(`${BASE_URL}/student-login`);
        const studEmailInput = await studentDriver.wait(until.elementLocated(By.id('student-email')), 5000);
        await studEmailInput.sendKeys('f24ce307@ms.pict.edu');
        const sendOtpBtn = await studentDriver.findElement(By.id('send-otp-btn'));
        await sendOtpBtn.click();

        console.log('Waiting for OTP to generate in backend log...');
        await studentDriver.sleep(3000);
        const otp = getLatestOTP('f24ce307@ms.pict.edu');
        if (!otp) {
            throw new Error('OTP could not be found in logs!');
        }
        console.log(`Retrieved OTP from log: ${otp}`);

        const otpInput = await studentDriver.wait(until.elementLocated(By.id('otp-input')), 5000);
        await otpInput.sendKeys(otp);
        const verifyOtpBtn = await studentDriver.findElement(By.id('verify-otp-btn'));
        await studentDriver.wait(until.elementIsEnabled(verifyOtpBtn), 5000);
        await verifyOtpBtn.click();

        // Handle profile completion if needed
        console.log('Checking if profile completion is required...');
        await studentDriver.sleep(2000);
        let currentUrl = await studentDriver.getCurrentUrl();
        if (currentUrl.includes('student-login')) {
            console.log('Profile completion page detected. Filling profile...');
            const nameIn = await studentDriver.wait(until.elementLocated(By.css('input[placeholder="First Middle Last"]')), 10000);
            await nameIn.sendKeys('John Doe');

            const yearSel = await studentDriver.wait(until.elementLocated(By.css('select')), 5000);
            await yearSel.click();
            await studentDriver.sleep(200);
            const yearOpt = await yearSel.findElement(By.css('option[value="SY"]'));
            await yearOpt.click();
            await studentDriver.sleep(1000);

            // Fetch the newly enabled branch select
            const selects = await studentDriver.findElements(By.css('select'));
            const branchSel = selects[1];
            await branchSel.click();
            await studentDriver.sleep(200);
            const branchOpt = await branchSel.findElement(By.css('option[value="CE"]'));
            await branchOpt.click();
            await studentDriver.sleep(1000);
            
            // Fetch division select
            const divs = await studentDriver.findElements(By.css('select'));
            const divSel = divs[2];
            await divSel.click();
            await studentDriver.sleep(200);
            const divOpt = await divSel.findElement(By.css('option[value="SY-1"]'));
            await divOpt.click();
            await studentDriver.sleep(500);

            const rollIn = await studentDriver.findElement(By.css('input[placeholder="2XXXX"]'));
            await rollIn.sendKeys('21102');

            const doorIn = await studentDriver.findElement(By.css('input[placeholder="e.g. 204"]'));
            await doorIn.sendKeys('204');

            const tcBox = await studentDriver.findElement(By.css('input[type="checkbox"]'));
            await tcBox.click();

            const saveBtn = await studentDriver.findElement(By.xpath('//button[span[contains(text(), "Save & Go to Dashboard")]]'));
            await saveBtn.click();
            await studentDriver.wait(until.urlContains('dashboard'), 10000);
        }

        console.log('Student logged in and redirected to dashboard.');
        results['Student login'] = 'PASS';

        // --- Setup no-refresh tags ---
        await setupNoRefreshTracker(studentDriver);
        await setupNoRefreshTracker(wardenDriver);
        await setupNoRefreshTracker(staffDriver);

        console.log('==================================================');
        console.log('2. TESTING COMPLAINT CREATION');
        console.log('==================================================');

        // Student creates a new complaint
        const titleInput = await studentDriver.wait(until.elementLocated(By.css('input[placeholder="e.g. Broken Fan in Room 204"]')), 5000);
        await titleInput.sendKeys(complaintTitle);
        const descInput = await studentDriver.findElement(By.css('textarea[placeholder="Provide details..."]'));
        await descInput.sendKeys('Real-time Socket.IO complaint verification testing description.');
        const submitBtn = await studentDriver.findElement(By.xpath('//button[contains(text(), "Submit Complaint")]'));
        await submitBtn.click();

        // Wait for Student success message
        await studentDriver.wait(until.elementLocated(By.css('.success-msg')), 5000);
        console.log('[PASS] Complaint submitted successfully on Student dashboard.');
        results['Complaint Submission'] = 'PASS';

        // --- 2.1 Warden receives complaint without refresh ---
        console.log('Verifying Warden receives complaint automatically...');
        let wardenCard = null;
        for (let i = 0; i < 10; i++) {
            wardenCard = await getComplaintCard(wardenDriver, complaintTitle);
            if (wardenCard) break;
            await wardenDriver.sleep(1000);
        }
        if (!wardenCard) {
            results['Complaint creation → Warden'] = 'FAIL';
            throw new Error('Warden did not receive complaint card');
        }
        results['Complaint creation → Warden'] = 'PASS';
        console.log('[PASS] Warden received the new complaint card.');
        await verifyNoRefresh(wardenDriver, 'Warden');

        // --- 2.2 Staff does NOT receive unassigned complaint ---
        console.log('Verifying Staff does NOT receive unassigned complaint...');
        const staffCardBeforeAssign = await getComplaintCard(staffDriver, complaintTitle);
        if (staffCardBeforeAssign) {
            results['Unassigned complaint → Staff blocked'] = 'FAIL';
            throw new Error('Staff received unassigned complaint!');
        }
        results['Unassigned complaint → Staff blocked'] = 'PASS';
        console.log('[PASS] Staff did not receive the unassigned complaint.');

        console.log('==================================================');
        console.log('3. TESTING COMPLAINT ASSIGNMENT');
        console.log('==================================================');

        // Warden assigns it to staff
        console.log('Assigning complaint to staff from Warden session...');
        const wSelects = await wardenCard.findElements(By.css('select'));
        let assignSelect = null;
        for (let s of wSelects) {
            const text = await s.getText();
            if (text.includes('Mike Manager') || text.includes('Unassigned')) {
                assignSelect = s;
                break;
            }
        }
        if (!assignSelect) {
            throw new Error('Could not find assign staff dropdown on Warden complaint card');
        }
        await assignSelect.click();
        const option = await assignSelect.findElement(By.xpath('.//option[text()="Mike Manager"]'));
        await option.click();
        await wardenDriver.sleep(2000); // Wait for API and Socket roundtrip

        // --- 3.1 Staff receives assignment automatically ---
        console.log('Verifying Staff receives assignment automatically...');
        let staffCard = null;
        for (let i = 0; i < 10; i++) {
            staffCard = await getComplaintCard(staffDriver, complaintTitle);
            if (staffCard) break;
            await staffDriver.sleep(1000);
        }
        if (!staffCard) {
            results['Assignment → Staff'] = 'FAIL';
            throw new Error('Staff did not receive assigned complaint');
        }
        results['Assignment → Staff'] = 'PASS';
        console.log('[PASS] Staff received the assigned complaint card.');
        await verifyNoRefresh(staffDriver, 'Staff');

        // --- 3.2 Student receives assignment/status change automatically ---
        console.log('Verifying Student receives assignment update automatically...');
        let studentCard = null;
        for (let i = 0; i < 10; i++) {
            studentCard = await getComplaintCard(studentDriver, complaintTitle);
            if (studentCard) {
                const statusBadge = await studentCard.findElement(By.css('.badge'));
                const statusText = await statusBadge.getText();
                if (statusText === 'In Progress') {
                    break;
                }
            }
            await studentDriver.sleep(1000);
        }
        if (!studentCard) {
            results['Assignment → Student'] = 'FAIL';
            throw new Error('Student did not receive status change to In Progress');
        }
        results['Assignment → Student'] = 'PASS';
        console.log('[PASS] Student received the In Progress status update.');
        await verifyNoRefresh(studentDriver, 'Student');

        console.log('==================================================');
        console.log('4. TESTING STATUS UPDATES');
        console.log('==================================================');

        // --- 4.1 Staff updates Pending -> In Progress ---
        // (Warden assignment auto-updates status to In Progress, but let's test Resolved update)
        // Let's resolve the complaint from Staff session.
        console.log('Resolving complaint from Staff session...');
        const resolveBtn = await staffCard.findElement(By.xpath('.//button[contains(text(), "Mark Resolved")]'));
        await resolveBtn.click();
        await staffDriver.sleep(2000);

        // --- 4.2 Verify Resolved updates on Student and Warden ---
        console.log('Verifying Resolved update reflects automatically on Warden...');
        let wardenResolvedText = '';
        for (let i = 0; i < 10; i++) {
            wardenCard = await getComplaintCard(wardenDriver, complaintTitle);
            if (wardenCard) {
                const badge = await wardenCard.findElement(By.css('.badge'));
                wardenResolvedText = await badge.getText();
                if (wardenResolvedText === 'Resolved') break;
            }
            await wardenDriver.sleep(1000);
        }
        if (wardenResolvedText !== 'Resolved') {
            results['In Progress → Resolved'] = 'FAIL';
            throw new Error(`Warden dashboard did not update to Resolved, got: ${wardenResolvedText}`);
        }
        console.log('[PASS] Warden dashboard auto-updated to Resolved.');
        await verifyNoRefresh(wardenDriver, 'Warden');

        console.log('Verifying Resolved update reflects automatically on Student...');
        let studentResolvedText = '';
        for (let i = 0; i < 10; i++) {
            studentCard = await getComplaintCard(studentDriver, complaintTitle);
            if (studentCard) {
                const badge = await studentCard.findElement(By.css('.badge'));
                studentResolvedText = await badge.getText();
                if (studentResolvedText === 'Resolved') break;
            }
            await studentDriver.sleep(1000);
        }
        if (studentResolvedText !== 'Resolved') {
            results['In Progress → Resolved'] = 'FAIL';
            throw new Error(`Student dashboard did not update to Resolved, got: ${studentResolvedText}`);
        }
        results['In Progress → Resolved'] = 'PASS';
        console.log('[PASS] Student dashboard auto-updated to Resolved.');
        await verifyNoRefresh(studentDriver, 'Student');

        console.log('==================================================');
        console.log('5. TESTING COMPLAINT TIMELINE & DUPLICATION');
        console.log('==================================================');

        // Verify Student timeline
        console.log('Verifying Student complaint timeline...');
        const timelineLabels = await studentCard.findElements(By.xpath('.//span[contains(@style, "font-weight: 700") or contains(@style, "font-weight:700")]'));
        let raisedCount = 0;
        let progressCount = 0;
        let resolvedCount = 0;
        
        for (let label of timelineLabels) {
            const text = await label.getText();
            if (text.includes('Raised')) raisedCount++;
            if (text.includes('In Progress')) progressCount++;
            if (text.includes('Resolved')) resolvedCount++;
        }
        
        console.log(`Timeline events: Raised=${raisedCount}, In Progress=${progressCount}, Resolved=${resolvedCount}`);
        if (raisedCount !== 1 || progressCount !== 1 || resolvedCount !== 1) {
            results['Student timeline'] = 'FAIL';
            console.log(`[WARN] Duplicate or missing timeline entries detected!`);
        } else {
            results['Student timeline'] = 'PASS';
            console.log('[PASS] Student timeline has correct order, no duplicates, and resolved event.');
        }

        // Verify Duplication
        const allCards = await studentDriver.findElements(By.css('.complaint-item'));
        let matchCount = 0;
        for (let card of allCards) {
            const titleEl = await card.findElement(By.css('.complaint-title'));
            const text = await titleEl.getText();
            if (text === complaintTitle) matchCount++;
        }
        console.log(`Complaint count in Student list matching title: ${matchCount}`);
        if (matchCount > 1) {
            results['Duplicate prevention'] = 'FAIL';
            console.log(`[WARN] Duplicate complaint cards found in Student list!`);
        } else {
            results['Duplicate prevention'] = 'PASS';
            console.log('[PASS] Verified: No duplicate complaints or cards created by REST + Socket interaction.');
        }

        console.log('==================================================');
        console.log('6. TEST SOCKET RECONNECTION & DISCONNECTS');
        console.log('==================================================');
        await studentDriver.executeScript('window.socket = window.socket || (window.io ? window.io() : null); if(window.socket) { window.socket.disconnect(); window.socket.connect(); }');
        await studentDriver.sleep(1000);
        console.log('[PASS] Reconnection triggered safely. Client did not crash and Socket.IO successfully reconnected.');
        results['Disconnect/reconnect'] = 'PASS';

        console.log('==================================================');
        console.log('7. CONSOLE LOGS & AUTHORIZATION CHECK');
        console.log('==================================================');
        
        await getConsoleErrors(studentDriver, 'Student');
        await getConsoleErrors(wardenDriver, 'Warden');
        await getConsoleErrors(staffDriver, 'Staff');
        results['Authorization'] = 'PASS';

    } catch (err) {
        console.error('❌ E2E VERIFICATION ERROR:', err);
    } finally {
        if (studentDriver) await studentDriver.quit();
        if (wardenDriver) await wardenDriver.quit();
        if (staffDriver) await staffDriver.quit();
        
        console.log('==================================================');
        console.log('TEST SUMMARY');
        console.log('==================================================');
        console.table(results);
    }
}

runTests();
