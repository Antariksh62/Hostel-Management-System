const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { By, until } = require('selenium-webdriver');
const { createDriver, loginAsStudent } = require('./utils');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

describe('Feedback Mechanism', function() {
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

    it('Should allow a student to provide negative feedback on a resolved complaint', async function() {
        // Find the first "Provide Feedback" button. 
        const mongoose = require('../backend/node_modules/mongoose');
        await mongoose.connect('mongodb://127.0.0.1:27017/hostelDB');
        await mongoose.connection.collection('complaints').updateMany({}, { $set: { status: 'Resolved' } });
        await driver.navigate().refresh();
        await driver.sleep(2000); // Give dashboard time to load
        
        let provideFeedbackBtn = await driver.wait(
            until.elementLocated(By.css('.provide-feedback-btn')),
            5000
        );

        // Scroll into view to avoid click interception
        await driver.executeScript("arguments[0].scrollIntoView(true);", provideFeedbackBtn);
        await driver.sleep(500);
        await provideFeedbackBtn.click();

        // Wait for feedback form
        const negativeBtn = await driver.wait(
            until.elementLocated(By.xpath('//button[contains(., "No, still needs work")]')),
            5000
        );
        await negativeBtn.click();

        // Fill reason
        const commentBox = await driver.wait(
            until.elementLocated(By.css('textarea[placeholder="Why is the work still incomplete?"]')),
            5000
        );
        const uniqueComment = `Selenium feedback comment ${Date.now()}`;
        await commentBox.sendKeys(uniqueComment);

        // Submit feedback
        const submitBtn = await driver.findElement(By.xpath('//button[contains(., "Submit Feedback")]'));
        await submitBtn.click();

        // Wait for the feedback section to disappear and summary to appear
        await driver.sleep(2000);

        // Verify that the feedback is displayed
        const feedbackSummaries = await driver.findElements(By.css('.feedback-summary p'));
        let found = false;
        for (let summary of feedbackSummaries) {
            const text = await summary.getText();
            if (text === uniqueComment) {
                found = true;
                break;
            }
        }

        assert.ok(found, 'Negative feedback comment not displayed in the complaint list');

        const ss = await driver.takeScreenshot();
        fs.writeFileSync(path.join(SCREENSHOT_DIR, 'screenshot_feedback_submitted.png'), ss, 'base64');
    });
});
