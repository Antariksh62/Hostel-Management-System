const fs = require('fs');
const path = require('path');

const authPath = path.join(__dirname, '../backend/controllers/authController.js');
let authCode = fs.readFileSync(authPath, 'utf8');
authCode = authCode.replace(
    'user: { id: user._id, name: user.name, email: user.email, role: user.role }',
    'user: { id: user._id, name: user.name, email: user.email, role: user.role, preferredLanguage: user.preferredLanguage || "en" }'
);
fs.writeFileSync(authPath, authCode, 'utf8');

const otpPath = path.join(__dirname, '../backend/controllers/otpController.js');
let otpCode = fs.readFileSync(otpPath, 'utf8');
otpCode = otpCode.replace(
    'profileComplete: user.profileComplete // Drives the frontend redirect',
    'profileComplete: user.profileComplete,\n                preferredLanguage: user.preferredLanguage || "en"'
);
fs.writeFileSync(otpPath, otpCode, 'utf8');

console.log('✅ Auth and OTP controllers successfully updated with preferredLanguage!');

