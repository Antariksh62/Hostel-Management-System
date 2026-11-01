/**
 * HOSTEL MANAGEMENT SYSTEM — 700 USER SCALE PERFORMANCE & STRESS BENCHMARK
 * 
 * Scale:
 * - 700 Total registered user accounts (154 active boys in 77 rooms, 46 boys unassigned, 475 expansion students, 25 admin/staff)
 * - 77 Boys' hostel rooms (Floors 1-5, exactly 2 students per room)
 * - 1,500 Historical complaints
 * - 800 Historical notifications
 * - 500 Audit logs
 * 
 * Concurrency Tiers:
 * - 5 simultaneous users (normal usage)
 * - 10 simultaneous users (moderate usage)
 * - 25 simultaneous users (peak usage)
 * - 50 simultaneous users (heavy usage)
 * - 100 simultaneous users (controlled stress test)
 * 
 * Mixed realistic workload across all roles.
 */

const path = require('path');
module.paths.push(path.resolve(__dirname, '../backend/node_modules'));

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'pict_hostel_secret_key_2024';
const TEST_DB_URI = 'mongodb://127.0.0.1:27017/hostel700ScaleDB';

const { User, Student, HeadWarden, Incharge, Warden, WifiIncharge, Staff } = require('../backend/models/User');
const Complaint = require('../backend/models/Complaint');
const Notification = require('../backend/models/Notification');
const ResidentAuditLog = require('../backend/models/ResidentAuditLog');
const RoomOccupancy = require('../backend/models/RoomOccupancy');
const StudentRoster = require('../backend/models/StudentRoster');
const Incident = require('../backend/models/Incident');
const { ALL_ROOMS, MAX_STUDENTS_PER_ROOM } = require('../backend/utils/hostelRooms');

const express = require('express');
const cors = require('cors');

function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Register routes
    app.use('/api/auth', require('../backend/routes/authRoutes'));
    app.use('/api/users', require('../backend/routes/userRoutes'));
    app.use('/api/complaints', require('../backend/routes/complaintRoutes'));
    app.use('/api/admissions', require('../backend/routes/admissionRoutes'));
    app.use('/api/residents', require('../backend/routes/residentRoutes'));
    app.use('/api/services', require('../backend/routes/serviceRoutes'));
    app.use('/api/incidents', require('../backend/routes/incidentRoutes'));
    app.use('/api/notifications', require('../backend/routes/notificationRoutes'));
    app.use('/api/incharge', require('../backend/routes/inchargeRoutes'));
    app.use('/api/staff-analytics', require('../backend/routes/staffAnalyticsRoutes'));

    return app;
}

// Generate JWT token helper
function generateToken(user) {
    return jwt.sign(
        { id: user._id.toString(), role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

// Helper: HTTP Request Promise
function makeRequest(port, options, body = null) {
    return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        const reqOptions = {
            hostname: '127.0.0.1',
            port: port,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const end = process.hrtime.bigint();
                const latencyMs = Number(end - start) / 1e6;
                resolve({
                    statusCode: res.statusCode,
                    latencyMs,
                    bodyLength: data.length
                });
            });
        });

        req.on('error', (err) => {
            const end = process.hrtime.bigint();
            const latencyMs = Number(end - start) / 1e6;
            resolve({
                statusCode: 500,
                latencyMs,
                error: err.message
            });
        });

        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

// Percentile helper
function getPercentile(arr, p) {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return Number(arr[Math.max(0, index)].toFixed(2));
}

async function seed700Dataset() {
    console.log(`\n🌱 Seeding 700-Scale Dataset into ${TEST_DB_URI}...`);
    
    // Clean collections
    await User.deleteMany({});
    await Complaint.deleteMany({});
    await Notification.deleteMany({});
    await ResidentAuditLog.deleteMany({});
    await RoomOccupancy.deleteMany({});
    await StudentRoster.deleteMany({});
    await Incident.deleteMany({});

    // 1. Create Staff & Admin Accounts (25 users)
    const headWarden = await HeadWarden.create({
        name: 'Prof. Head Warden',
        email: 'headwarden.bench@pict.edu',
        password: 'hashedpassword',
        role: 'HEADWARDEN'
    });

    const incharge1 = await Incharge.create({
        name: 'Hostel In-Charge 1',
        email: 'incharge1.bench@pict.edu',
        password: 'hashedpassword',
        role: 'INCHARGE'
    });

    const incharge2 = await Incharge.create({
        name: 'Hostel In-Charge 2',
        email: 'incharge2.bench@pict.edu',
        password: 'hashedpassword',
        role: 'INCHARGE'
    });

    const wifiIncharge = await WifiIncharge.create({
        name: 'Wi-Fi Specialist In-Charge',
        email: 'wifi.incharge.bench@pict.edu',
        password: 'hashedpassword',
        role: 'WIFI_INCHARGE'
    });

    const wardens = [];
    for (let i = 1; i <= 3; i++) {
        const warden = await Warden.create({
            name: `Warden ${i}`,
            email: `warden${i}.bench@pict.edu`,
            password: 'hashedpassword',
            role: 'WARDEN'
        });
        wardens.push(warden);
    }

    const staffMembers = [];
    for (let i = 1; i <= 18; i++) {
        const staff = await Staff.create({
            name: `Staff Member ${i}`,
            email: `staff${i}.bench@pict.edu`,
            password: 'hashedpassword',
            role: 'STAFF'
        });
        staffMembers.push(staff);
    }

    // 2. Setup 77 Rooms and 154 Active Boys (2 per room)
    console.log(`   - Initializing 77 rooms with exactly 2 students each (154 occupants)...`);
    const studentUsers = [];
    const roomOccupancies = [];

    let studentIndex = 1;
    for (const roomNum of ALL_ROOMS) {
        const occupants = [];
        for (let bed = 1; bed <= MAX_STUDENTS_PER_ROOM; bed++) {
            const prn = `F24BOY${String(studentIndex).padStart(4, '0')}`;
            const student = await Student.create({
                name: `Student ${studentIndex}`,
                fullName: `Boys Hostel Student ${studentIndex}`,
                email: `student.${prn.toLowerCase()}@ms.pict.edu`,
                role: 'STUDENT',
                prn: prn,
                doorNumber: roomNum,
                branch: 'CE',
                year: 'SY',
                isVerified: true,
                profileComplete: true,
                mobileNumber: `982200${String(studentIndex).padStart(4, '0')}`
            });
            studentUsers.push(student);
            occupants.push(student._id);
            studentIndex++;
        }

        roomOccupancies.push({
            roomNumber: roomNum,
            occupantCount: 2,
            occupants: occupants,
            rosterReservations: [],
            isOverCapacity: false,
            updatedAt: new Date()
        });
    }
    await RoomOccupancy.insertMany(roomOccupancies);

    // 3. Create 46 Unassigned / Day-Scholar Boys (making boys total = 200)
    console.log(`   - Creating 46 unassigned boys student accounts...`);
    for (let i = 1; i <= 46; i++) {
        const prn = `F24UNAS${String(i).padStart(4, '0')}`;
        const student = await Student.create({
            name: `Unassigned Student ${i}`,
            fullName: `Unassigned Boys Student ${i}`,
            email: `unas.${prn.toLowerCase()}@ms.pict.edu`,
            role: 'STUDENT',
            prn: prn,
            doorNumber: null,
            branch: 'IT',
            year: 'FY',
            isVerified: true,
            profileComplete: true,
            mobileNumber: `982210${String(i).padStart(4, '0')}`
        });
        studentUsers.push(student);
    }

    // 4. Create 475 Expansion / Registered Students (bringing total user count to 700)
    // 25 admin/staff + 154 room boys + 46 unassigned boys + 475 expansion = 700 accounts!
    console.log(`   - Creating 475 expansion / registered accounts (Total Users = 700)...`);
    const expansionBatch = [];
    for (let i = 1; i <= 475; i++) {
        const prn = `F24EXP${String(i).padStart(4, '0')}`;
        expansionBatch.push({
            name: `Expansion Student ${i}`,
            fullName: `Registered Expansion Student ${i}`,
            email: `exp.${prn.toLowerCase()}@ms.pict.edu`,
            role: 'STUDENT',
            prn: prn,
            doorNumber: null,
            branch: i % 2 === 0 ? 'ENTC' : 'AIDS',
            year: i % 3 === 0 ? 'TY' : 'SY',
            isVerified: true,
            profileComplete: true,
            mobileNumber: `982250${String(i).padStart(4, '0')}`
        });
    }
    const createdExp = await Student.insertMany(expansionBatch);
    studentUsers.push(...createdExp);

    const totalUsersCount = await User.countDocuments({});
    console.log(`   ✅ Confirmed Total Registered Users in DB: ${totalUsersCount} accounts (Target Scale = 700)`);

    // 5. Create 1,500 Historical Complaints
    console.log(`   - Creating 1,500 historical complaints across categories...`);
    const categories = ['Electrical', 'Plumbing', 'Furniture', 'Cleanliness', 'Internet', 'NO_WATER_SUPPLY', 'NO_ELECTRICITY', 'WIFI_NOT_WORKING'];
    const statuses = ['Pending', 'In Progress', 'Resolved', 'Resolved', 'Resolved']; // weighted resolved
    const complaintsBatch = [];

    for (let i = 1; i <= 1500; i++) {
        const randomStudent = studentUsers[i % 154]; // distributed across room occupants
        const cat = categories[i % categories.length];
        const stat = statuses[i % statuses.length];
        const assignedStaff = stat !== 'Pending' ? staffMembers[i % staffMembers.length]._id : null;
        
        complaintsBatch.push({
            title: `Issue ${i}: ${cat} malfunction in room ${randomStudent.doorNumber || '101'}`,
            description: `Automated test complaint description for benchmarking issue #${i}.`,
            category: cat,
            status: stat,
            doorNumber: randomStudent.doorNumber || '101',
            studentId: randomStudent._id,
            assignedTo: assignedStaff,
            assignedAt: assignedStaff ? new Date(Date.now() - 86400000) : null,
            resolvedAt: stat === 'Resolved' ? new Date() : null,
            statusHistory: [
                { status: 'Pending', timestamp: new Date(Date.now() - 172800000), actor: 'Student' },
                ...(assignedStaff ? [{ status: 'In Progress', timestamp: new Date(Date.now() - 86400000), actor: 'Warden' }] : []),
                ...(stat === 'Resolved' ? [{ status: 'Resolved', timestamp: new Date(), actor: 'Staff' }] : [])
            ],
            createdAt: new Date(Date.now() - (i * 3600000))
        });
    }
    await Complaint.insertMany(complaintsBatch);
    console.log(`   ✅ Created 1,500 complaints.`);

    // 6. Create 800 Notifications
    console.log(`   - Creating 800 persistent administrative notifications...`);
    const notifBatch = [];
    const notifRoles = ['WARDEN', 'HEADWARDEN', 'INCHARGE', 'WIFI_INCHARGE', 'STAFF', 'ADMISSION_ADMINS'];
    for (let i = 1; i <= 800; i++) {
        const role = notifRoles[i % notifRoles.length];
        notifBatch.push({
            recipientRole: role,
            title: `System Alert #${i} for ${role}`,
            message: `Automated notification message body for scale benchmarking #${i}.`,
            category: i % 2 === 0 ? 'COMPLAINT' : 'SYSTEM',
            priority: i % 5 === 0 ? 'HIGH' : 'MEDIUM',
            entityType: 'complaint',
            entityId: String(i),
            readBy: i % 3 === 0 ? [wardens[0]._id] : [],
            createdAt: new Date(Date.now() - (i * 1800000))
        });
    }
    await Notification.insertMany(notifBatch);
    console.log(`   ✅ Created 800 notifications.`);

    // 7. Create 500 Resident Audit Logs
    console.log(`   - Creating 500 audit trail logs...`);
    const auditBatch = [];
    for (let i = 1; i <= 500; i++) {
        auditBatch.push({
            action: i % 2 === 0 ? 'REVEAL_CONTACT' : 'UPDATE_ROOM',
            performedBy: wardens[0]._id,
            adminName: 'Warden 1',
            adminRole: 'WARDEN',
            adminEmail: 'warden1.bench@pict.edu',
            studentPRN: `F24BOY${String((i % 154) + 1).padStart(4, '0')}`,
            details: { reason: 'Benchmarking operational verification' },
            createdAt: new Date(Date.now() - (i * 7200000))
        });
    }
    await ResidentAuditLog.insertMany(auditBatch);
    console.log(`   ✅ Created 500 audit logs.`);

    // Ensure all indexes are built
    await User.syncIndexes();
    await Complaint.syncIndexes();
    await Notification.syncIndexes();
    await ResidentAuditLog.syncIndexes();
    await RoomOccupancy.syncIndexes();
    await StudentRoster.syncIndexes();

    console.log(`✨ Dataset ready for realistic performance benchmarking!\n`);

    return {
        tokens: {
            student: generateToken(studentUsers[0]),
            studentRoomNumber: studentUsers[0].doorNumber,
            warden: generateToken(wardens[0]),
            headWarden: generateToken(headWarden),
            incharge: generateToken(incharge1),
            wifiIncharge: generateToken(wifiIncharge),
            staff: generateToken(staffMembers[0])
        },
        studentUsers,
        wardens,
        staffMembers
    };
}

// Generate a random request from the realistic mixed workload distribution
function pickMixedWorkload(tokens) {
    const r = Math.random();

    // 40% Student operations
    if (r < 0.20) {
        return {
            path: '/api/complaints/my-complaints',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.student}` },
            name: 'Student My Complaints'
        };
    } else if (r < 0.30) {
        return {
            path: '/api/users/profile',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.student}` },
            name: 'Student Profile'
        };
    } else if (r < 0.40) {
        return {
            path: '/api/complaints',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.student}`,
                'Content-Type': 'application/json'
            },
            body: {
                title: 'Water tap leaking slightly',
                description: 'Minor tap leakage in bathroom',
                category: 'Plumbing',
                doorNumber: tokens.studentRoomNumber || '101'
            },
            name: 'Student Submit Complaint'
        };
    }
    // 25% Warden operations
    else if (r < 0.50) {
        return {
            path: '/api/complaints/all',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.warden}` },
            name: 'Warden All Complaints'
        };
    } else if (r < 0.55) {
        return {
            path: '/api/complaints/analytics?days=30',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.warden}` },
            name: 'Warden Analytics'
        };
    } else if (r < 0.60) {
        return {
            path: '/api/services/heat-map',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.warden}` },
            name: 'Warden Heat Map'
        };
    } else if (r < 0.65) {
        return {
            path: '/api/residents?limit=20',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.warden}` },
            name: 'Warden Resident List'
        };
    }
    // 15% In-Charge / Head Warden operations
    else if (r < 0.70) {
        return {
            path: '/api/incharge/overview',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.incharge}` },
            name: 'Incharge Overview'
        };
    } else if (r < 0.75) {
        return {
            path: '/api/incharge/kpis',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.incharge}` },
            name: 'Incharge KPIs'
        };
    } else if (r < 0.80) {
        return {
            path: '/api/admissions/roster?limit=20',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.headWarden}` },
            name: 'HeadWarden Roster'
        };
    }
    // 10% Staff operations
    else if (r < 0.90) {
        return {
            path: '/api/complaints/all',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.staff}` },
            name: 'Staff Assigned Tasks'
        };
    }
    // 5% Wi-Fi Specialist
    else if (r < 0.95) {
        return {
            path: '/api/complaints/wifi/queue',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.wifiIncharge}` },
            name: 'Wi-Fi Queue'
        };
    }
    // 5% Notifications Feed
    else {
        return {
            path: '/api/notifications?limit=20',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokens.warden}` },
            name: 'Notification Feed'
        };
    }
}

async function runConcurrencyTier(port, tokens, concurrency, durationMs = 6000) {
    console.log(`\n================================================================================`);
    console.log(`🚀 RUNNING CONCURRENCY TIER: ${concurrency} SIMULTANEOUS USERS (${durationMs / 1000}s Mixed Workload)`);
    console.log(`================================================================================`);

    const latencies = [];
    let totalRequests = 0;
    let errorCount = 0;
    let bytesTransferred = 0;

    const startCpu = process.cpuUsage();
    const startMemory = process.memoryUsage();
    const startTime = Date.now();
    const stopTime = startTime + durationMs;

    // Worker function for a single concurrent user
    async function worker() {
        while (Date.now() < stopTime) {
            const reqSpec = pickMixedWorkload(tokens);
            const res = await makeRequest(port, reqSpec, reqSpec.body);
            totalRequests++;
            latencies.push(res.latencyMs);
            bytesTransferred += (res.bodyLength || 0);
            if (res.statusCode >= 400 && res.statusCode !== 404) {
                errorCount++;
            }
        }
    }

    // Launch `concurrency` concurrent workers
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    const actualDurationSec = (Date.now() - startTime) / 1000;
    const endCpu = process.cpuUsage(startCpu);
    const endMemory = process.memoryUsage();

    const cpuTotalMicros = endCpu.user + endCpu.system;
    const cpuPercent = Number(((cpuTotalMicros / (actualDurationSec * 1e6)) * 100).toFixed(1));
    const ramRssMb = Number((endMemory.rss / (1024 * 1024)).toFixed(1));
    const ramHeapMb = Number((endMemory.heapUsed / (1024 * 1024)).toFixed(1));

    let mongoConns = { current: 1, available: 100 };
    try {
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await adminDb.serverStatus();
        if (serverStatus && serverStatus.connections) {
            mongoConns = serverStatus.connections;
        }
    } catch (e) {
        // fallback
    }

    const throughput = Number((totalRequests / actualDurationSec).toFixed(1));
    const errorRate = Number(((errorCount / totalRequests) * 100).toFixed(2));
    const p50 = getPercentile(latencies, 50);
    const p95 = getPercentile(latencies, 95);
    const p99 = getPercentile(latencies, 99);
    const avgLatency = Number((latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2));

    const tierResult = {
        concurrency,
        totalRequests,
        throughputReqSec: throughput,
        errorRatePercent: errorRate,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
        avgLatencyMs: avgLatency,
        cpuUsagePercent: cpuPercent,
        ramHeapUsedMb: ramHeapMb,
        ramRssMb: ramRssMb,
        mongoActiveConnections: mongoConns.current
    };

    console.log(`Results for ${concurrency} simultaneous users:`);
    console.log(`   - Throughput:          ${throughput} req/sec (${totalRequests} total requests)`);
    console.log(`   - Error Rate:          ${errorRate}% (${errorCount} errors)`);
    console.log(`   - p50 Response Time:   ${p50} ms`);
    console.log(`   - p95 Response Time:   ${p95} ms`);
    console.log(`   - p99 Response Time:   ${p99} ms`);
    console.log(`   - Avg Response Time:   ${avgLatency} ms`);
    console.log(`   - Process CPU Usage:   ${cpuPercent}%`);
    console.log(`   - Node JS Heap Used:   ${ramHeapMb} MB (RSS: ${ramRssMb} MB)`);
    console.log(`   - Mongo Active Conns:  ${mongoConns.current}`);

    return tierResult;
}

async function main() {
    console.log(`================================================================================`);
    console.log(`📊 HOSTEL MANAGEMENT SYSTEM — 700 USER SCALE BENCHMARK & STRESS AUDIT`);
    console.log(`================================================================================`);

    await mongoose.connect(TEST_DB_URI, {
        maxPoolSize: 50,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
    });
    console.log(`✅ Connected to MongoDB: ${TEST_DB_URI}`);

    const seedData = await seed700Dataset();

    const app = createApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(65522, '127.0.0.1', resolve));
    console.log(`🚀 Benchmark Test Server listening on http://127.0.0.1:65522\n`);

    const tiers = [5, 10, 25, 50, 100];
    const results = [];

    for (const c of tiers) {
        await new Promise((r) => setTimeout(r, 1000));
        const res = await runConcurrencyTier(65522, seedData.tokens, c, 5000);
        results.push(res);
    }

    server.close();
    await mongoose.disconnect();

    console.log(`\n================================================================================`);
    console.log(`📈 FINAL PERFORMANCE SUMMARY TABLE (700-USER REGISTERED SCALE)`);
    console.log(`================================================================================`);
    console.table(results);
    console.log(`\n✅ 700-Scale Benchmark execution completed successfully.`);
}

main().catch((err) => {
    console.error('Fatal benchmark error:', err);
    process.exit(1);
});
