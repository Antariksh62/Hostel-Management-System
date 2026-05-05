const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createDriver, loginAsStudent, loginAsStaffOrWarden } = require('./utils');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

describe('Role-Based Authentication Tests', function() {
    this.timeout(30000); // 30 seconds for browser tests
    let driver;

    beforeEach(async function() {
        driver = await createDriver();
    });

    afterEach(async function() {
        if (driver) {
            await driver.quit();
        }
    });

    it('Should login as Student and redirect to Student Dashboard', async function() {
        await loginAsStudent(driver, 'student1@ms.pict.edu');
        
        const currentUrl = await driver.getCurrentUrl();
        assert.ok(currentUrl.includes('/student-dashboard'), `Expected /student-dashboard but got ${currentUrl}`);
        
        const ss = await driver.takeScreenshot();
        fs.writeFileSync(path.join(SCREENSHOT_DIR, 'screenshot_student_dashboard.png'), ss, 'base64');
    });

    it('Should login as Staff and redirect to Staff Dashboard', async function() {
        await loginAsStaffOrWarden(driver, 'staff1@test.com', '123456');
        
        const currentUrl = await driver.getCurrentUrl();
        assert.ok(currentUrl.includes('/staff-dashboard'), `Expected /staff-dashboard but got ${currentUrl}`);
    });

    it('Should login as Warden and redirect to Admin Dashboard', async function() {
        await loginAsStaffOrWarden(driver, 'warden@test.com', '123456');
        
        const currentUrl = await driver.getCurrentUrl();
        assert.ok(currentUrl.includes('/admin-dashboard'), `Expected /admin-dashboard but got ${currentUrl}`);
    });
});
