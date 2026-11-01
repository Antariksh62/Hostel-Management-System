/**
 * HOSTEL MANAGEMENT SYSTEM — MULTILINGUAL (ENGLISH, HINDI, MARATHI) TEST SUITE
 * 
 * Verifies:
 * 1. Translation dictionary parity across 'en', 'hi', and 'mr' (100% key matching)
 * 2. Specialized terminology accuracy for hostel operations
 * 3. Backend API persistence: PUT /api/users/language, profile retrieval, login payload
 * 4. Role isolation and unauthorized access rejection
 * 5. Font and script configuration
 */

const path = require('path');
module.paths.push(path.resolve(__dirname, '../backend/node_modules'));

const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'pict_hostel_secret_key_2024';
const TEST_DB_URI = 'mongodb://127.0.0.1:27017/hostelI18nTestDB';

const { User, Student, Warden, HeadWarden, Incharge, WifiIncharge, Staff } = require('../backend/models/User');

const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', require('../backend/routes/authRoutes'));
  app.use('/api/users', require('../backend/routes/userRoutes'));

  return app;
}

function makeToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function makeRequest(port, options, body = null) {
  return new Promise((resolve) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 500, error: err.message });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getAllKeys(obj[k], fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

async function runTests() {
  console.log('================================================================================');
  console.log('🌐 HOSTEL MANAGEMENT SYSTEM — MULTILINGUAL (EN, HI, MR) TEST SUITE');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  [✅ PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [❌ FAIL] ${message} ${details ? `-> ${details}` : ''}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Translation Dictionaries Parity & Terminology Check
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Translation Dictionaries & Terminology ---');
  
  const localesDir = path.join(__dirname, '../frontend-react/src/locales');
  const enFile = JSON.parse(fs.readFileSync(path.join(localesDir, 'en/translation.json'), 'utf8'));
  const hiFile = JSON.parse(fs.readFileSync(path.join(localesDir, 'hi/translation.json'), 'utf8'));
  const mrFile = JSON.parse(fs.readFileSync(path.join(localesDir, 'mr/translation.json'), 'utf8'));

  const enKeys = getAllKeys(enFile).sort();
  const hiKeys = getAllKeys(hiFile).sort();
  const mrKeys = getAllKeys(mrFile).sort();

  assert(enKeys.length > 50, `English dictionary loaded with ${enKeys.length} keys`);
  assert(enKeys.length === hiKeys.length, `Hindi dictionary key count parity (${hiKeys.length}/${enKeys.length})`);
  assert(enKeys.length === mrKeys.length, `Marathi dictionary key count parity (${mrKeys.length}/${enKeys.length})`);

  const missingInHi = enKeys.filter((k) => !hiKeys.includes(k));
  const missingInMr = enKeys.filter((k) => !mrKeys.includes(k));

  assert(missingInHi.length === 0, 'Zero missing keys in Hindi dictionary', missingInHi.join(', '));
  assert(missingInMr.length === 0, 'Zero missing keys in Marathi dictionary', missingInMr.join(', '));

  // Verify crucial Marathi & Hindi terms
  assert(hiFile.complaints.title === 'शिकायतें', 'Hindi complaint term is natural ("शिकायतें")');
  assert(mrFile.complaints.title === 'तक्रारी', 'Marathi complaint term is natural ("तक्रारी")');
  assert(hiFile.residents.title === 'निवासी निर्देशिका', 'Hindi resident term is natural ("निवासी निर्देशिका")');
  assert(mrFile.residents.title === 'रहिवासी सूची', 'Marathi resident term is natural ("रहिवासी सूची")');
  assert(hiFile.status.APPROVED === 'स्वीकृत', 'Hindi approved status is "स्वीकृत"');
  assert(mrFile.status.APPROVED === 'मंजूर', 'Marathi approved status is "मंजूर"');

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Backend Language Preference Persistence API
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Backend Language Preference Persistence API ---');

  await mongoose.connect(TEST_DB_URI);
  await User.deleteMany({});

  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash('Admin@123', 10);

  const testWarden = await Warden.create({
    name: 'Warden Patil',
    email: 'warden.i18n@pict.edu',
    password: hashed,
    role: 'WARDEN',
    preferredLanguage: 'en'
  });

  const testStudent = await Student.create({
    name: 'Rohit Kulkarni',
    email: 'rohit.f24@ms.pict.edu',
    password: hashed,
    role: 'STUDENT',
    prn: 'F24CE999',
    doorNumber: '101',
    preferredLanguage: 'en'
  });

  const wardenToken = makeToken(testWarden);
  const studentToken = makeToken(testStudent);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(65524, '127.0.0.1', resolve));

  // 2.1 Unauthorized PUT /api/users/language should fail
  const unauthRes = await makeRequest(65524, {
    path: '/api/users/language',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, { language: 'mr' });
  assert(unauthRes.statusCode === 401, 'Unauthenticated language update rejected with HTTP 401');

  // 2.2 Invalid language code should fail with HTTP 400
  const invalidRes = await makeRequest(65524, {
    path: '/api/users/language',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardenToken}`
    }
  }, { language: 'fr' });
  assert(invalidRes.statusCode === 400, 'Invalid language code ("fr") rejected with HTTP 400');

  // 2.3 Valid language update to Marathi ('mr')
  const mrUpdateRes = await makeRequest(65524, {
    path: '/api/users/language',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardenToken}`
    }
  }, { language: 'mr' });
  assert(mrUpdateRes.statusCode === 200, 'Warden language successfully updated to Marathi ("mr")');
  assert(mrUpdateRes.data.preferredLanguage === 'mr', 'Response returns preferredLanguage: "mr"');

  // 2.4 Verify DB persisted
  const dbWarden = await User.findById(testWarden._id);
  assert(dbWarden.preferredLanguage === 'mr', 'Database record confirmed updated with preferredLanguage: "mr"');

  // 2.5 Verify profile endpoint returns preferredLanguage
  const profileRes = await makeRequest(65524, {
    path: '/api/users/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${wardenToken}` }
  });
  assert(profileRes.data.preferredLanguage === 'mr', 'GET /api/users/profile reflects updated language preference');

  // 2.6 Student updates language to Hindi ('hi')
  const hiUpdateRes = await makeRequest(65524, {
    path: '/api/users/language',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    }
  }, { language: 'hi' });
  assert(hiUpdateRes.statusCode === 200, 'Student language successfully updated to Hindi ("hi")');

  // 2.7 Verify Login endpoint returns preferredLanguage in user object
  const loginRes = await makeRequest(65524, {
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'warden.i18n@pict.edu', password: 'Admin@123' });
  assert(loginRes.statusCode === 200, 'Warden login succeeds with HTTP 200');
  assert(loginRes.data.user.preferredLanguage === 'mr', 'Login response payload includes user.preferredLanguage ("mr")');

  server.close();
  await mongoose.disconnect();

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Frontend Component Integration & Font Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Frontend Configuration & Font Checks ---');

  const indexHtml = fs.readFileSync(path.join(__dirname, '../frontend-react/index.html'), 'utf8');
  assert(indexHtml.includes('Noto+Sans+Devanagari'), 'index.html includes Noto Sans Devanagari Google Font');

  const indexCss = fs.readFileSync(path.join(__dirname, '../frontend-react/src/index.css'), 'utf8');
  assert(indexCss.includes('Noto Sans Devanagari'), 'index.css includes Noto Sans Devanagari in font-family fallback');

  const appShell = fs.readFileSync(path.join(__dirname, '../frontend-react/src/components/hms/app-shell.tsx'), 'utf8');
  assert(appShell.includes('LanguageSwitcher'), 'app-shell.tsx integrates LanguageSwitcher in header & drawer');

  const hoidssShell = fs.readFileSync(path.join(__dirname, '../frontend-react/src/components/hoidss/shell.tsx'), 'utf8');
  assert(hoidssShell.includes('LanguageSwitcher'), 'hoidss/shell.tsx integrates LanguageSwitcher in Incharge TopBar');

  const loginPage = fs.readFileSync(path.join(__dirname, '../frontend-react/src/pages/Login.jsx'), 'utf8');
  assert(loginPage.includes('LanguageSwitcher'), 'Login.jsx integrates LanguageSwitcher before authentication');

  const mainJsx = fs.readFileSync(path.join(__dirname, '../frontend-react/src/main.jsx'), 'utf8');
  assert(mainJsx.includes("import './i18n'"), 'main.jsx initializes i18n at application root');

  console.log('\n================================================================================');
  console.log(`🎉 MULTILINGUAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
