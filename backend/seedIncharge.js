/**
 * Run to seed or update INCHARGE, HEADWARDEN, WARDEN, WIFI_INCHARGE, and STAFF accounts.
 * Usage: node seedIncharge.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { User, Staff } = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hostelDB';

const ACCOUNTS = [
    { name: 'Hostel Incharge',              email: 'incharge@pict.edu',    password: 'Admin@123', role: 'INCHARGE' },
    { name: 'Head Warden',                  email: 'headwarden@pict.edu',  password: 'Admin@123', role: 'HEADWARDEN' },
    { name: 'Wi-Fi In-Charge',              email: 'wifi@pict.edu',        password: 'Admin@123', role: 'WIFI_INCHARGE' },
    { name: 'Hostel Warden',                email: 'warden@pict.edu',      password: 'Admin@123', role: 'WARDEN' },
    { name: 'Mike Manager (Electrician)',   email: 'staff1@test.com',      password: '123456',    role: 'STAFF', staffRole: 'Electrician' },
    { name: 'Bob Builder (Plumber)',        email: 'staff2@test.com',      password: '123456',    role: 'STAFF', staffRole: 'Plumber' },
    { name: 'Tom Technician (Carpenter)',   email: 'staff3@test.com',      password: '123456',    role: 'STAFF', staffRole: 'Carpenter' },
    { name: 'Hostel Staff (Maintenance)',   email: 'staff@pict.edu',       password: 'Admin@123', role: 'STAFF', staffRole: 'General Maintenance' },
    { name: 'Hostel Staff (General)',       email: 'staff@hostel.com',     password: '123456',    role: 'STAFF', staffRole: 'General Maintenance' },
];

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const acc of ACCOUNTS) {
        const hashed = await bcrypt.hash(acc.password, 10);
        const exists = await User.findOne({ email: acc.email });
        if (exists) {
            exists.name = acc.name;
            exists.role = acc.role;
            exists.password = hashed;
            if (acc.staffRole) exists.staffRole = acc.staffRole;
            await exists.save();
            console.log(`🔄 Updated ${acc.role}: ${acc.email} / password: ${acc.password}`);
            continue;
        }

        const Model = acc.role === 'STAFF' ? Staff : User;
        await Model.create({
            name: acc.name,
            email: acc.email,
            password: hashed,
            role: acc.role,
            ...(acc.staffRole ? { staffRole: acc.staffRole } : {})
        });
        console.log(`✅ Created ${acc.role}: ${acc.email} / password: ${acc.password}`);
    }

    await mongoose.disconnect();
    console.log('\nDone! Login at the Staff/Warden login page (not the student OTP page).');
}

seed().catch(err => { console.error(err); process.exit(1); });
