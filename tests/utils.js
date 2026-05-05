const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE_URL = 'http://localhost:5173';

async function createDriver() {
    let options = new chrome.Options();
    // Use headless mode for faster automated tests without UI
    options.addArguments('--headless=new');
    options.addArguments('--window-size=1920,1080');
    return await new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function loginAsStaffOrWarden(driver, email, password) {
    await driver.get(BASE_URL);
    
    // Wait for the login form to load
    const emailInput = await driver.wait(until.elementLocated(By.id('staff-email')), 5000);
    const passwordInput = await driver.findElement(By.id('staff-password'));
    const loginBtn = await driver.findElement(By.id('staff-login-btn'));

    await emailInput.sendKeys(email);
    await passwordInput.sendKeys(password);
    await loginBtn.click();

    // Wait for redirect to dashboard
    await driver.wait(until.urlContains('dashboard'), 5000);
}

async function loginAsStudent(driver, email) {
    await driver.get(`${BASE_URL}/student-login`);
    
    // Step 1: Send OTP
    const emailInput = await driver.wait(until.elementLocated(By.id('student-email')), 5000);
    await emailInput.sendKeys(email);
    const sendOtpBtn = await driver.findElement(By.id('send-otp-btn'));
    await sendOtpBtn.click();

    // Step 2: Verify OTP
    const otpInput = await driver.wait(until.elementLocated(By.id('otp-input')), 5000);
    // Wait an extra second for state updates/animation
    await driver.sleep(1000);
    await otpInput.sendKeys('123456'); // Fixed OTP configured for testing
    
    const verifyOtpBtn = await driver.wait(until.elementLocated(By.id('verify-otp-btn')), 5000);
    await driver.wait(until.elementIsEnabled(verifyOtpBtn), 5000);
    await verifyOtpBtn.click();

    // Wait for redirect to dashboard
    await driver.wait(until.urlContains('dashboard'), 5000);
}

module.exports = {
    BASE_URL,
    createDriver,
    loginAsStaffOrWarden,
    loginAsStudent
};
