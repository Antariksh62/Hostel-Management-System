const puppeteer = require('puppeteer');

async function inspect() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  // Click on Incharge tab
  const tabs = await page.$$('button');
  for (const tab of tabs) {
    const txt = await page.evaluate(el => el.textContent.trim(), tab);
    if (txt === 'Incharge' || txt === 'Hostel Administration' || txt === 'Operations Intelligence') {
      await tab.click();
      console.log('Clicked tab:', txt);
      break;
    }
  }

  // Type email and password
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'incharge@pict.edu');
  await page.type('input[type="password"]', 'Admin@123');

  // Click submit
  const submitBtn = await page.$('button[type="submit"]');
  await submitBtn.click();
  console.log('Submitted login credentials...');

  await new Promise(r => setTimeout(r, 3000));

  console.log('Current URL after login:', page.url());
  console.log('Console Errors caught:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 5));
  }

  // Check page elements
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('Page text snippet:\n', bodyText);

  // Take screenshot of main dashboard
  await page.screenshot({ path: 'benchmarks/incharge_dashboard_main.png', fullPage: false });
  console.log('Screenshot saved to benchmarks/incharge_dashboard_main.png');

  // Test Admissions view
  console.log('Testing admissions navigation...');
  await page.goto('http://localhost:5173/incharge-dashboard?view=admissions', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Admissions page URL:', page.url());
  const admissionsText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Admissions text snippet:\n', admissionsText);
  await page.screenshot({ path: 'benchmarks/incharge_dashboard_admissions.png', fullPage: false });

  await browser.close();
}

inspect().catch(err => { console.error('Inspection failed:', err); process.exit(1); });

