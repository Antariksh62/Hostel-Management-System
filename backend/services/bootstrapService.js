const bcrypt = require("bcryptjs");
const Department = require("../models/Department");
const { DashboardTemplate, DashboardInstance } = require("../models/DashboardInstance");
const ComplaintCategory = require("../models/ComplaintCategory");
const { User, MainAdmin } = require("../models/User");
const Complaint = require("../models/Complaint");

const INITIAL_DEPARTMENTS = [
    {
        name: "Plumbing",
        code: "PLUMBING",
        description: "Hostel plumbing, pipe fittings, water supply lines, and sanitary maintenance.",
        template: "PLUMBER",
        modules: ["assigned_work", "work_history", "spatial_map", "materials"],
        complaintCategories: ["Plumbing", "Tap broken", "Water leakage", "Water not coming"],
        workloadPolicy: { maxActiveJobsPerEmployee: 10, weightPending: 1, weightOverdue: 2, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 120, startDeadlineMinutes: 240, resolveDeadlineMinutes: 1440, reEscalationIntervalMinutes: 360 },
        isSystem: true
    },
    {
        name: "Electrical",
        code: "ELECTRICAL",
        description: "Electrical infrastructure, lighting, fans, power sockets, and board maintenance.",
        template: "ELECTRICIAN",
        modules: ["assigned_work", "work_history", "spatial_map", "materials"],
        complaintCategories: ["Electrical", "Fan not working", "Socket damaged", "Switch broken"],
        workloadPolicy: { maxActiveJobsPerEmployee: 10, weightPending: 1, weightOverdue: 2, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 120, startDeadlineMinutes: 240, resolveDeadlineMinutes: 1440, reEscalationIntervalMinutes: 360 },
        isSystem: true
    },
    {
        name: "Workshop",
        code: "WORKSHOP",
        description: "Carpentry, metalwork, bed frames, study tables, cupboards, door hinges and locks.",
        template: "WORKSHOP",
        modules: ["assigned_work", "work_history", "spatial_map"],
        complaintCategories: ["Workshop", "Furniture", "Study table wobbling", "Bed frame broken", "Door hinge problem"],
        workloadPolicy: { maxActiveJobsPerEmployee: 10, weightPending: 1, weightOverdue: 2, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 180, startDeadlineMinutes: 360, resolveDeadlineMinutes: 2880, reEscalationIntervalMinutes: 720 },
        isSystem: true
    },
    {
        name: "Cleaning",
        code: "CLEANING",
        description: "Unified hostel cleaning, washrooms, corridors, premises, and waste clearance.",
        template: "CLEANING",
        modules: ["assigned_work", "work_history", "spatial_map"],
        complaintCategories: ["Cleaning", "Cleanliness", "Room cleaning", "Washroom cleaning"],
        workloadPolicy: { maxActiveJobsPerEmployee: 15, weightPending: 1, weightOverdue: 2, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 60, startDeadlineMinutes: 120, resolveDeadlineMinutes: 720, reEscalationIntervalMinutes: 240 },
        isSystem: true
    },
    {
        name: "Wi-Fi",
        code: "WIFI",
        description: "Hostel Wi-Fi network, access points, routers, authentication, and bandwidth monitoring.",
        template: "WIFI",
        modules: ["assigned_work", "network_monitor", "router_map", "work_history"],
        complaintCategories: ["Wi-Fi", "Internet", "Wi-Fi not working"],
        workloadPolicy: { maxActiveJobsPerEmployee: 20, weightPending: 1, weightOverdue: 2, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 60, startDeadlineMinutes: 120, resolveDeadlineMinutes: 720, reEscalationIntervalMinutes: 180 },
        isSystem: true
    },
    {
        name: "Security",
        code: "SECURITY",
        description: "Hostel security, entrance checkpoints, safety patrol, and incident management.",
        template: "SECURITY",
        modules: ["incident_reporting", "assigned_incidents", "incident_history"],
        complaintCategories: ["Security", "Security incident"],
        workloadPolicy: { maxActiveJobsPerEmployee: 5, weightPending: 1, weightOverdue: 3, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 30, startDeadlineMinutes: 60, resolveDeadlineMinutes: 360, reEscalationIntervalMinutes: 60 },
        isSystem: true
    },
    {
        name: "Anti-Ragging",
        code: "ANTI_RAGGING",
        description: "Confidential anti-ragging cell, incident investigations, hearings, and compliance tracking.",
        template: "ANTI_RAGGING",
        modules: ["confidential_cases", "investigation_workflow", "case_notes", "actions_taken"],
        complaintCategories: ["Anti-Ragging", "Ragging incident"],
        workloadPolicy: { maxActiveJobsPerEmployee: 5, weightPending: 1, weightOverdue: 3, balancingStrategy: "LEAST_ACTIVE_LOAD" },
        escalationPolicy: { ackDeadlineMinutes: 15, startDeadlineMinutes: 30, resolveDeadlineMinutes: 1440, reEscalationIntervalMinutes: 120 },
        isSystem: true
    }
];

const INITIAL_TEMPLATES = [
    {
        templateId: "PLUMBER",
        name: "Plumbing Technician Dashboard",
        roleCode: "STAFF",
        description: "Operational view for assigned plumbing jobs, before/after photos, and materials used.",
        defaultModules: ["assigned_work", "work_history", "spatial_map"]
    },
    {
        templateId: "ELECTRICIAN",
        name: "Electrician Dashboard",
        roleCode: "STAFF",
        description: "Operational view for assigned electrical complaints, power safety, and work progress.",
        defaultModules: ["assigned_work", "work_history", "spatial_map"]
    },
    {
        templateId: "WORKSHOP",
        name: "Workshop Specialist Dashboard",
        roleCode: "STAFF",
        description: "Operational view for furniture, carpentry, and metal repairs.",
        defaultModules: ["assigned_work", "work_history", "spatial_map"]
    },
    {
        templateId: "CLEANING",
        name: "Cleaning Staff Dashboard",
        roleCode: "STAFF",
        description: "Operational view for assigned cleaning routines and inspections.",
        defaultModules: ["assigned_work", "work_history", "spatial_map"]
    },
    {
        templateId: "WIFI",
        name: "Wi-Fi Specialist Dashboard",
        roleCode: "WIFI_INCHARGE",
        description: "Operational view for Wi-Fi complaint queue, router map, and network diagnostics.",
        defaultModules: ["assigned_work", "network_monitor", "router_map", "work_history"]
    },
    {
        templateId: "SECURITY",
        name: "Security Personnel Dashboard",
        roleCode: "STAFF",
        description: "Operational view for assigned security incidents, location logging, and status tracking.",
        defaultModules: ["incident_reporting", "assigned_incidents", "incident_history"]
    },
    {
        templateId: "ANTI_RAGGING",
        name: "Anti-Ragging Confidential Portal",
        roleCode: "STAFF",
        description: "Strictly confidential portal for Anti-Ragging squad members with full case management.",
        defaultModules: ["confidential_cases", "investigation_workflow", "case_notes", "actions_taken"]
    },
    {
        templateId: "GENERAL_STAFF",
        name: "General Staff Dashboard",
        roleCode: "STAFF",
        description: "Standard operational view for assigned maintenance tasks.",
        defaultModules: ["assigned_work", "work_history"]
    }
];

async function bootstrapDepartmentsAndTemplates() {
    try {
        console.log("[BOOTSTRAP] Initializing Departments, Templates, and Categories...");

        // 1. Templates
        for (const tmpl of INITIAL_TEMPLATES) {
            await DashboardTemplate.findOneAndUpdate(
                { templateId: tmpl.templateId },
                tmpl,
                { upsert: true, returnDocument: 'after' }
            );
        }

        // 2. Departments
        const deptMap = {};
        for (const deptData of INITIAL_DEPARTMENTS) {
            const dept = await Department.findOneAndUpdate(
                { code: deptData.code },
                deptData,
                { upsert: true, returnDocument: 'after' }
            );
            deptMap[deptData.code] = dept;

            // Ensure at least one default DashboardInstance exists
            const defaultInstanceId = `${deptData.code}_INSTANCE_1`;
            await DashboardInstance.findOneAndUpdate(
                { instanceId: defaultInstanceId },
                {
                    instanceId: defaultInstanceId,
                    name: `${deptData.name} Primary Workspace`,
                    departmentId: dept._id,
                    templateId: deptData.template,
                    activeModules: deptData.modules,
                    isActive: true
                },
                { upsert: true }
            );

            // 3. Categories for this department
            for (const catName of deptData.complaintCategories) {
                const catCode = catName.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
                const isConfidential = deptData.code === "ANTI_RAGGING";
                await ComplaintCategory.findOneAndUpdate(
                    { code: catCode },
                    {
                        name: catName,
                        code: catCode,
                        departmentId: dept._id,
                        description: `${catName} routed to ${deptData.name} Department`,
                        defaultPriority: isConfidential ? "Emergency" : (catName.includes("Water not") ? "High" : "Medium"),
                        isConfidential,
                        isActive: true
                    },
                    { upsert: true, returnDocument: 'after' }
                );
            }
        }

        // 4. Initial MAIN_ADMIN bootstrap account
        const mainAdminEmail = process.env.MAIN_ADMIN_EMAIL || "mainadmin@pict.edu";
        const existingAdmin = await User.findOne({ email: mainAdminEmail });
        if (!existingAdmin) {
            const defaultPassword = process.env.MAIN_ADMIN_PASSWORD || "Admin@Pict2024!";
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultPassword, salt);
            await MainAdmin.create({
                name: "Main System Administrator",
                email: mainAdminEmail,
                password: hashedPassword,
                role: "MAIN_ADMIN",
                title: "Supreme System Administrator",
                officeLocation: "Directorate Central Office",
                isActive: true,
                isAvailable: true,
                dashboardPermissions: ["MAIN_ADMIN", "PLUMBING", "ELECTRICAL", "WORKSHOP", "CLEANING", "WIFI", "SECURITY", "ANTI_RAGGING"],
                exportPermissions: true
            });
            console.log(`[BOOTSTRAP] ✅ Initial MAIN_ADMIN created: ${mainAdminEmail}`);
        } else if (existingAdmin.role !== "MAIN_ADMIN") {
            existingAdmin.role = "MAIN_ADMIN";
            existingAdmin.dashboardPermissions = ["MAIN_ADMIN", "PLUMBING", "ELECTRICAL", "WORKSHOP", "CLEANING", "WIFI", "SECURITY", "ANTI_RAGGING"];
            await existingAdmin.save();
        }

        // 5. Backfill existing complaints to their matching department
        const unlinkedComplaints = await Complaint.find({ departmentId: null });
        if (unlinkedComplaints.length > 0) {
            console.log(`[BOOTSTRAP] Backfilling ${unlinkedComplaints.length} unlinked complaints to departments...`);
            for (const comp of unlinkedComplaints) {
                let targetDeptCode = "PLUMBING";
                const cat = (comp.category || "").toLowerCase();
                if (cat.includes("electric") || comp.quickCategory === "NO_ELECTRICITY") {
                    targetDeptCode = "ELECTRICAL";
                } else if (cat.includes("plumb") || cat.includes("water") || comp.quickCategory === "NO_WATER_SUPPLY") {
                    targetDeptCode = "PLUMBING";
                } else if (cat.includes("furn") || cat.includes("workshop") || cat.includes("table") || cat.includes("bed")) {
                    targetDeptCode = "WORKSHOP";
                } else if (cat.includes("clean")) {
                    targetDeptCode = "CLEANING";
                } else if (cat.includes("internet") || cat.includes("wifi") || comp.quickCategory === "WIFI_NOT_WORKING") {
                    targetDeptCode = "WIFI";
                } else if (cat.includes("security")) {
                    targetDeptCode = "SECURITY";
                } else if (cat.includes("ragging")) {
                    targetDeptCode = "ANTI_RAGGING";
                }

                if (deptMap[targetDeptCode]) {
                    comp.departmentId = deptMap[targetDeptCode]._id;
                    if (targetDeptCode === "ANTI_RAGGING") {
                        comp.isConfidential = true;
                        comp.isAntiRagging = true;
                    }
                    if (targetDeptCode === "SECURITY") {
                        comp.isSecurity = true;
                    }
                    await comp.save();
                }
            }
            console.log("[BOOTSTRAP] ✅ Backfilled unlinked complaints.");
        }

        console.log("[BOOTSTRAP] ✅ System departments, categories and templates successfully synchronized.");
    } catch (err) {
        console.error("[BOOTSTRAP] ❌ Error initializing system:", err);
    }
}

module.exports = {
    bootstrapDepartmentsAndTemplates,
    INITIAL_DEPARTMENTS,
    INITIAL_TEMPLATES
};
