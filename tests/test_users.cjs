const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function inspect() {
    await mongoose.connect('mongodb://127.0.0.1:27017/hostelDB');
    const { User } = require('../backend/models/User');
    const Department = require('../backend/models/Department');

    const depts = await Department.find({}, 'name code assignedStaff').lean();
    console.log('Departments:');
    depts.forEach(d => {
        console.log(`- ${d.name} (${d.code}) [${d._id}]: staff=${d.assignedStaff?.length}`);
    });

    const staffUsers = await User.find({ role: 'STAFF' }, 'name email departmentId authorizedDepartments staffRole').lean();
    console.log(`Total staff: ${staffUsers.length}`);
    staffUsers.forEach(s => {
        console.log(`- ${s.name} (${s.email}): dept=${s.departmentId}, authDepts=${s.authorizedDepartments?.join(',')}`);
    });

    await mongoose.disconnect();
}

inspect().catch(console.error);
