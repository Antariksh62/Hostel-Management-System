const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { By, until } = require('selenium-webdriver');
const { createDriver, loginAsStudent } = require('./utils');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

describe('Complaint Submission Process', function() {
    this.timeout(40000); // 40 seconds
    let driver;

    before(async function() {
        driver = await createDriver();
        await loginAsStudent(driver, 'student1@ms.pict.edu');
    });

    after(async function() {
        if (driver) {
            await driver.quit();
        }
    });

    it('Should allow a student to submit a new complaint', async function() {
        const uniqueTitle = `Automated Test Complaint ${Date.now()}`;
        
        // Find title input
        const titleInput = await driver.wait(
            until.elementLocated(By.css('input[placeholder="e.g. Broken Fan in Room 204"]')),
            5000
        );
        await titleInput.sendKeys(uniqueTitle);

        // Find description input
        const descInput = await driver.findElement(By.css('textarea[placeholder="Provide details..."]'));
        await descInput.sendKeys('This is a test complaint submitted by Selenium WebDriver.');

        // Submit form
        const submitBtn = await driver.findElement(By.xpath('//button[contains(text(), "Submit Complaint")]'));
        await submitBtn.click();

        // Wait for success message
        const successMsg = await driver.wait(
            until.elementLocated(By.css('.success-msg')),
            5000
        );
        const msgText = await successMsg.getText();
        assert.strictEqual(msgText, 'Complaint submitted successfully!');

        // Wait a moment for complaints list to refresh
        await driver.sleep(2000);

        // Verify the complaint appears in the list
        const complaintTitles = await driver.findElements(By.css('.complaint-title'));
        let found = false;
        for (let title of complaintTitles) {
            const text = await title.getText();
            if (text === uniqueTitle) {
                found = true;
                break;
            }
        }
        
        assert.ok(found, 'Newly submitted complaint not found in the list');

        const ss = await driver.takeScreenshot();
        fs.writeFileSync(path.join(SCREENSHOT_DIR, 'screenshot_complaint_submitted.png'), ss, 'base64');
    });
});
