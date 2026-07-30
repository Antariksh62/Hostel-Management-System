/**
 * Run once to seed an INCHARGE and HEADWARDEN account.
 * Usage: node seedIncharge.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { User } = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const ACCOUNTS = [
    { name: 'Hostel Incharge',  email: 'incharge@pict.edu',    password: 'Admin@123', role: 'INCHARGE'   },
    { name: 'Head Warden',      email: 'headwarden@pict.edu',  password: 'Admin@123', role: 'HEADWARDEN' },
];

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const acc of ACCOUNTS) {
        const exists = await User.findOne({ email: acc.email });
        if (exists) {
            console.log(`⚠️  ${acc.role} already exists: ${acc.email}`);
            continue;
        }
        const hashed = await bcrypt.hash(acc.password, 10);
        await User.create({ name: acc.name, email: acc.email, password: hashed, role: acc.role });
        console.log(`✅ Created ${acc.role}: ${acc.email} / password: ${acc.password}`);
    }

    await mongoose.disconnect();
    console.log('\nDone! Login at the Staff/Warden login page (not the student OTP page).');
}

seed().catch(err => { console.error(err); process.exit(1); });
