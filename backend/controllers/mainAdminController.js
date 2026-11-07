const Department = require("../models/Department");
const { DashboardTemplate, DashboardInstance } = require("../models/DashboardInstance");
const ComplaintCategory = require("../models/ComplaintCategory");
const { User, Staff } = require("../models/User");
const Complaint = require("../models/Complaint");
const ComplaintEvent = require("../models/ComplaintEvent");
const AuditLog = require("../models/AuditLog");
const staffLifecycleService = require("../services/staffLifecycleService");
const { calculateEmployeeWorkload } = require("../services/workloadRoutingService");
const { evaluateEscalations } = require("../services/escalationService");

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

exports.getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.find()
            .populate("supervisor", "name email staffRole designation phoneNumber")
            .sort({ isSystem: -1, name: 1 })
            .lean();

        // Attach operational counts and assigned staff members
        const enriched = await Promise.all(departments.map(async (d) => {
            const staffInDept = await User.find({
                role: { $in: ["STAFF", "WIFI_INCHARGE"] },
                $or: [
                    { departmentId: d._id },
                    { authorizedDepartments: d._id },
                    { dashboardPermissions: d.code }
                ],
                isActive: true
            }, "name email staffRole designation employeeId phoneNumber isSupervisor isAvailable activeWorkload").lean();

            const employeeCount = staffInDept.length;

            const openJobsCount = await Complaint.countDocuments({
                departmentId: d._id,
                status: { $in: ["Pending", "In Progress", "Reopened"] },
                lifecycleState: { $nin: ["RESOLVED", "AWAITING_STUDENT_CONFIRMATION", "CONFIRMED", "CLOSED"] }
            });

            return {
                ...d,
                employeeCount,
                openJobsCount,
                staffMembers: staffInDept.map(s => ({
                    id: s._id,
                    name: s.name,
                    email: s.email,
                    designation: s.designation || s.staffRole || "Staff",
                    employeeId: s.employeeId || "",
                    phoneNumber: s.phoneNumber || "",
                    isSupervisor: Boolean(s.isSupervisor),
                    isAvailable: s.isAvailable !== false
                }))
            };
        }));

        res.json({ success: true, departments: enriched });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch departments", error: err.message });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        const { name, code, description, template, modules, complaintCategories, supervisor, workloadPolicy, escalationPolicy, isActive } = req.body;
        if (!name || !code) {
            return res.status(400).json({ message: "Department name and uppercase code are required." });
        }

        const cleanCode = code.trim().toUpperCase();
        const existing = await Department.findOne({ $or: [{ code: cleanCode }, { name: name.trim() }] });
        if (existing) {
            return res.status(400).json({ message: `Department with name '${name}' or code '${cleanCode}' already exists.` });
        }

        const department = await Department.create({
            name: name.trim(),
            code: cleanCode,
            description: description || "",
            template: template || "GENERAL_STAFF",
            modules: modules || ["assigned_work", "work_history"],
            complaintCategories: Array.isArray(complaintCategories) ? complaintCategories : [name.trim()],
            supervisor: supervisor || null,
            workloadPolicy: workloadPolicy || {},
            escalationPolicy: escalationPolicy || {},
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            createdBy: req.user.id
        });

        if (supervisor) {
            await User.findByIdAndUpdate(supervisor, { isSupervisor: true, departmentId: department._id });
        }

        // Create default instance for this department (upsert to handle recreation gracefully)
        const instanceId = `${cleanCode}_INSTANCE_1`;
        await DashboardInstance.findOneAndUpdate(
            { instanceId },
            {
                instanceId,
                name: `${name.trim()} Workspace`,
                departmentId: department._id,
                templateId: department.template,
                activeModules: department.modules,
                createdBy: req.user.id
            },
            { upsert: true, new: true }
        );

        // Create complaint categories
        if (Array.isArray(complaintCategories)) {
            for (const cat of complaintCategories) {
                const catCode = cat.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
                await ComplaintCategory.findOneAndUpdate(
                    { code: catCode },
                    { name: cat, code: catCode, departmentId: department._id, description: `${cat} category`, isActive: true },
                    { upsert: true }
                );
            }
        }

        await AuditLog.create({
            action: "DEPARTMENT_CREATED",
            performedBy: { id: req.user.id, name: req.user.name || "Main Admin", role: req.user.role, email: req.user.email },
            target: { id: department._id, model: "Department", identifier: department.name },
            details: { code: department.code, template: department.template }
        });

        res.status(201).json({ success: true, department });
    } catch (err) {
        res.status(500).json({ message: "Failed to create department", error: err.message });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, supervisor, modules, complaintCategories, workloadPolicy, escalationPolicy, isActive } = req.body;

        const dept = await Department.findById(id);
        if (!dept) return res.status(404).json({ message: "Department not found" });

        if (name && name.trim()) dept.name = name.trim();
        if (description !== undefined) dept.description = description;
        if (supervisor !== undefined) {
            dept.supervisor = supervisor || null;
            if (supervisor) {
                await User.findByIdAndUpdate(supervisor, { isSupervisor: true, departmentId: dept._id });
            }
        }
        if (modules !== undefined) dept.modules = modules;
        if (complaintCategories !== undefined) {
            dept.complaintCategories = complaintCategories;
            // Also sync/create ComplaintCategory documents if provided
            if (Array.isArray(complaintCategories)) {
                for (const cat of complaintCategories) {
                    const catCode = cat.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
                    await ComplaintCategory.findOneAndUpdate(
                        { code: catCode },
                        { name: cat, code: catCode, departmentId: dept._id, description: `${cat} category`, isActive: true },
                        { upsert: true }
                    );
                }
            }
        }
        if (workloadPolicy !== undefined) dept.workloadPolicy = workloadPolicy;
        if (escalationPolicy !== undefined) dept.escalationPolicy = escalationPolicy;
        if (isActive !== undefined) {
            dept.isActive = Boolean(isActive);
        }

        await dept.save();

        await AuditLog.create({
            action: "DEPARTMENT_UPDATED",
            performedBy: { id: req.user.id, name: req.user.name || "Main Admin", role: req.user.role, email: req.user.email },
            target: { id: dept._id, model: "Department", identifier: dept.name }
        });

        res.json({ success: true, department: dept });
    } catch (err) {
        res.status(500).json({ message: "Failed to update department", error: err.message });
    }
};

exports.assignStaffToDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId, staffIds } = req.body;
        const targetIds = staffIds || (staffId ? [staffId] : []);

        const dept = await Department.findById(id);
        if (!dept) return res.status(404).json({ message: "Department not found" });

        const updated = await User.updateMany(
            { _id: { $in: targetIds }, role: { $in: ["STAFF", "WIFI_INCHARGE"] } },
            { $set: { departmentId: dept._id }, $addToSet: { authorizedDepartments: dept._id } }
        );

        await AuditLog.create({
            action: "STAFF_ASSIGNED_TO_DEPARTMENT",
            performedBy: { id: req.user.id, name: req.user.name, role: req.user.role, email: req.user.email },
            target: { id: dept._id, model: "Department", identifier: dept.name },
            details: { assignedCount: updated.modifiedCount, staffIds: targetIds }
        });

        res.json({ success: true, message: `Assigned ${updated.modifiedCount} staff members to ${dept.name}` });
    } catch (err) {
        res.status(500).json({ message: "Failed to assign staff to department", error: err.message });
    }
};

exports.removeStaffFromDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId } = req.body;

        const dept = await Department.findById(id);
        if (!dept) return res.status(404).json({ message: "Department not found" });

        const staff = await User.findById(staffId);
        if (!staff) return res.status(404).json({ message: "Staff member not found" });

        if (String(staff.departmentId) === String(dept._id)) {
            staff.departmentId = null;
        }
        staff.authorizedDepartments = (staff.authorizedDepartments || []).filter(dId => String(dId) !== String(dept._id));
        if (String(dept.supervisor) === String(staff._id)) {
            dept.supervisor = null;
            staff.isSupervisor = false;
            await dept.save();
        }
        await staff.save();

        await AuditLog.create({
            action: "STAFF_REMOVED_FROM_DEPARTMENT",
            performedBy: { id: req.user.id, name: req.user.name, role: req.user.role, email: req.user.email },
            target: { id: dept._id, model: "Department", identifier: dept.name },
            details: { staffId: staff._id, staffName: staff.name }
        });

        res.json({ success: true, message: `Removed ${staff.name} from ${dept.name}` });
    } catch (err) {
        res.status(500).json({ message: "Failed to remove staff from department", error: err.message });
    }
};

exports.setDepartmentSupervisor = async (req, res) => {
    try {
        const { id } = req.params;
        const { supervisorId } = req.body;

        const dept = await Department.findById(id);
        if (!dept) return res.status(404).json({ message: "Department not found" });

        // If removing supervisor
        if (!supervisorId) {
            if (dept.supervisor) {
                await User.findByIdAndUpdate(dept.supervisor, { isSupervisor: false });
            }
            dept.supervisor = null;
            await dept.save();
            return res.json({ success: true, message: "Department supervisor cleared" });
        }

        const supervisor = await User.findById(supervisorId);
        if (!supervisor) return res.status(404).json({ message: "Supervisor staff member not found" });

        // Remove old supervisor's supervisor flag if changed
        if (dept.supervisor && String(dept.supervisor) !== String(supervisorId)) {
            await User.findByIdAndUpdate(dept.supervisor, { isSupervisor: false });
        }

        dept.supervisor = supervisor._id;
        supervisor.isSupervisor = true;
        if (!supervisor.departmentId) {
            supervisor.departmentId = dept._id;
        }
        if (!supervisor.authorizedDepartments?.includes(dept._id)) {
            supervisor.authorizedDepartments = [...(supervisor.authorizedDepartments || []), dept._id];
        }

        await dept.save();
        await supervisor.save();

        await AuditLog.create({
            action: "DEPARTMENT_SUPERVISOR_CHANGED",
            performedBy: { id: req.user.id, name: req.user.name, role: req.user.role, email: req.user.email },
            target: { id: dept._id, model: "Department", identifier: dept.name },
            details: { supervisorId: supervisor._id, supervisorName: supervisor.name }
        });

        res.json({ success: true, message: `Set ${supervisor.name} as supervisor of ${dept.name}`, supervisor: { id: supervisor._id, name: supervisor.name } });
    } catch (err) {
        res.status(500).json({ message: "Failed to set supervisor", error: err.message });
    }
};

// ─── TEMPLATES & INSTANCES ───────────────────────────────────────────────────

exports.getAllTemplates = async (req, res) => {
    try {
        const templates = await DashboardTemplate.find().sort({ name: 1 });
        res.json({ success: true, templates });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch templates", error: err.message });
    }
};

exports.getAllInstances = async (req, res) => {
    try {
        const instances = await DashboardInstance.find().populate("departmentId assignedEmployees", "name email staffRole isActive").sort({ name: 1 });
        res.json({ success: true, instances });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch instances", error: err.message });
    }
};

exports.createInstance = async (req, res) => {
    try {
        const { name, departmentId, templateId, activeModules, assignedEmployees } = req.body;
        if (!name || !departmentId || !templateId) {
            return res.status(400).json({ message: "Instance name, departmentId and templateId are required." });
        }

        const instanceId = `INST_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const instance = await DashboardInstance.create({
            instanceId,
            name: name.trim(),
            departmentId,
            templateId: templateId.toUpperCase(),
            activeModules: activeModules || [],
            assignedEmployees: assignedEmployees || [],
            createdBy: req.user.id
        });

        res.status(201).json({ success: true, instance });
    } catch (err) {
        res.status(500).json({ message: "Failed to create instance", error: err.message });
    }
};

// ─── STAFF ACCOUNTS & PERMISSIONS ────────────────────────────────────────────

exports.getAllStaff = async (req, res) => {
    try {
        const query = { role: { $in: ["STAFF", "WIFI_INCHARGE"] } };
        // If Incharge, filter to operational departments only
        if (req.user.role === "INCHARGE") {
            const antiRaggingDept = await Department.findOne({ code: "ANTI_RAGGING" });
            if (antiRaggingDept) {
                query.departmentId = { $ne: antiRaggingDept._id };
                query.dashboardPermissions = { $ne: "ANTI_RAGGING" };
            }
        }

        const staffList = await User.find(query)
            .populate("departmentId", "name code template")
            .populate("authorizedDepartments", "name code")
            .sort({ createdAt: -1 })
            .lean();

        // Enrich with real-time active load
        const enriched = await Promise.all(staffList.map(async (s) => {
            const stats = await calculateEmployeeWorkload(s._id);
            return {
                id: s._id,
                name: s.name,
                email: s.email,
                role: s.role,
                employeeId: s.employeeId || "",
                phoneNumber: s.phoneNumber || "",
                designation: s.designation || s.staffRole || "Technician",
                staffRole: s.staffRole || s.designation || "Technician",
                departmentId: s.departmentId ? s.departmentId._id : null,
                department: s.departmentId ? s.departmentId.name : "General Maintenance",
                departmentCode: s.departmentId ? s.departmentId.code : "GENERAL",
                authorizedDepartments: s.authorizedDepartments || [],
                isSupervisor: Boolean(s.isSupervisor),
                dashboardPermissions: s.dashboardPermissions || [],
                isActive: s.isActive !== false,
                isAvailable: s.isAvailable !== false,
                availabilityReason: s.availabilityReason || "",
                exportPermissions: Boolean(s.exportPermissions),
                activeWorkload: stats.activeCount,
                workloadScore: stats.totalScore,
                overdueWorkload: stats.overdueCount,
                createdAt: s.createdAt
            };
        }));

        res.json({ success: true, staff: enriched });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch staff list", error: err.message });
    }
};

exports.createStaff = async (req, res) => {
    try {
        const actor = {
            id: req.user.id,
            name: req.user.name || "Administrator",
            role: req.user.role,
            email: req.user.email
        };

        const result = await staffLifecycleService.createStaffAccount({
            ...req.body,
            actor
        });

        res.status(201).json({ success: true, staff: result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const actor = { id: req.user.id, name: req.user.name || "Administrator", role: req.user.role, email: req.user.email };

        const result = await staffLifecycleService.updateStaffAccount({
            staffId: id,
            ...req.body,
            actor
        });

        res.json({ success: true, staff: result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.resetStaffPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const actor = { id: req.user.id, name: req.user.name || "Administrator", role: req.user.role, email: req.user.email };

        const result = await staffLifecycleService.resetStaffPassword({
            staffId: id,
            newPassword,
            actor
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.updateStaffAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAvailable, availabilityReason } = req.body;
        const actor = { id: req.user.id, name: req.user.name || "Administrator", role: req.user.role, email: req.user.email };

        const result = await staffLifecycleService.updateEmployeeAvailability({
            staffId: id,
            isAvailable,
            availabilityReason,
            actor
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deactivateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, reallocateWork } = req.body;
        const actor = { id: req.user.id, name: req.user.name || "Administrator", role: req.user.role, email: req.user.email };

        const result = await staffLifecycleService.deactivateStaffAccount({
            staffId: id,
            reason,
            reallocateWork: Boolean(reallocateWork),
            actor
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.restoreStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const actor = { id: req.user.id, name: req.user.name || "Administrator", role: req.user.role, email: req.user.email };

        const result = await staffLifecycleService.restoreStaffAccount({
            staffId: id,
            actor
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.transferWork = async (req, res) => {
    try {
        const { fromStaffId, toStaffId, reason } = req.body;
        const actor = { id: req.user.id, name: req.user.name || "Administrator", role: req.user.role, email: req.user.email };

        const result = await staffLifecycleService.transferUnfinishedWork({
            fromStaffId,
            toStaffId,
            reason,
            actor
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

/**
 * Assign Multiple Dashboard Permissions with Confirmation Audit (Section 3.3).
 */
exports.updateStaffPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { dashboardPermissions, confirmedMultipleAccess } = req.body;
        const staff = await User.findById(id);
        if (!staff) return res.status(404).json({ message: "Staff member not found" });

        const newPermissions = Array.isArray(dashboardPermissions) ? dashboardPermissions.map(p => p.toUpperCase()) : [];

        // If multiple dashboard permissions requested without explicit confirmation:
        if (newPermissions.length > 1 && !confirmedMultipleAccess) {
            return res.status(200).json({
                requiresConfirmation: true,
                employeeName: staff.name,
                existingPermissions: staff.dashboardPermissions || [],
                requestedPermissions: newPermissions,
                warning: "This user will receive cross-departmental access to multiple operational dashboards. Please confirm authorization."
            });
        }

        const prev = staff.dashboardPermissions || [];
        staff.dashboardPermissions = newPermissions;
        await staff.save();

        await AuditLog.create({
            action: "PERMISSIONS_UPDATED",
            performedBy: { id: req.user.id, name: req.user.name || "Admin", role: req.user.role, email: req.user.email },
            target: { id: staff._id, model: "User", identifier: staff.email },
            details: {
                previousPermissions: prev,
                newPermissions,
                confirmedMultipleAccess: Boolean(confirmedMultipleAccess)
            }
        });

        res.json({ success: true, staffId: staff._id, dashboardPermissions: staff.dashboardPermissions });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// ─── LIVE GLOBAL COMPLAINT MONITORING (Section 13.1) ─────────────────────────

exports.getGlobalMonitoringFeed = async (req, res) => {
    try {
        const { department, status, priority, escalated, search, page = 1, limit = 50 } = req.query;
        const filter = {};

        // Anti-Ragging Strict Confidentiality Barrier:
        // If the requester is not MAIN_ADMIN or INCHARGE, exclude Anti-Ragging complaints entirely!
        if (req.user.role !== "MAIN_ADMIN" && req.user.role !== "INCHARGE") {
            filter.isAntiRagging = { $ne: true };
            filter.isConfidential = { $ne: true };
        }

        if (department) {
            const deptDoc = await Department.findOne({ $or: [{ code: department.toUpperCase() }, { name: department }] });
            if (deptDoc) filter.departmentId = deptDoc._id;
        }

        if (status && status !== "all") {
            filter.status = status;
        }

        if (escalated === "true") {
            filter.escalationLevel = { $gt: 0 };
        }

        if (search) {
            filter.$or = [
                { title: new RegExp(search, "i") },
                { doorNumber: new RegExp(search, "i") }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const complaints = await Complaint.find(filter)
            .populate("studentId", "name email prn doorNumber mobileNumber")
            .populate("assignedTo", "name email staffRole")
            .populate("departmentId", "name code")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const total = await Complaint.countDocuments(filter);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            complaints
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch monitoring feed", error: err.message });
    }
};

// ─── ESCALATION TRIGGER ──────────────────────────────────────────────────────

exports.triggerEscalationCheck = async (req, res) => {
    try {
        const result = await evaluateEscalations();
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ message: "Failed to run escalation check", error: err.message });
    }
};

// ─── COMPLAINT CATEGORIES ───────────────────────────────────────────────────

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await ComplaintCategory.find()
            .populate("departmentId", "name code template")
            .sort({ name: 1 })
            .lean();
        res.json({ success: true, count: categories.length, categories });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch categories", error: err.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, departmentId, description, defaultPriority, isConfidential, routingKeywords } = req.body;
        if (!name || !departmentId) {
            return res.status(400).json({ message: "Category name and departmentId are required." });
        }

        const code = name.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        const existing = await ComplaintCategory.findOne({ $or: [{ code }, { name: name.trim() }] });
        if (existing) {
            return res.status(400).json({ message: `Category '${name}' already exists.` });
        }

        const category = await ComplaintCategory.create({
            name: name.trim(),
            code,
            departmentId,
            description: description || "",
            defaultPriority: defaultPriority || "Medium",
            isConfidential: Boolean(isConfidential),
            routingKeywords: Array.isArray(routingKeywords) ? routingKeywords : []
        });

        await AuditLog.create({
            action: "CATEGORY_CREATED",
            performedBy: { id: req.user.id, name: req.user.name || "Main Admin", role: req.user.role, email: req.user.email },
            target: { id: category._id, model: "ComplaintCategory", identifier: category.name },
            details: { code: category.code, departmentId: category.departmentId }
        });

        res.status(201).json({ success: true, category });
    } catch (err) {
        res.status(500).json({ message: "Failed to create category", error: err.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, departmentId, description, defaultPriority, isConfidential, isActive, routingKeywords } = req.body;

        const category = await ComplaintCategory.findById(id);
        if (!category) return res.status(404).json({ message: "Category not found" });

        if (name) {
            category.name = name.trim();
            category.code = name.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        }
        if (departmentId) category.departmentId = departmentId;
        if (description !== undefined) category.description = description;
        if (defaultPriority) category.defaultPriority = defaultPriority;
        if (isConfidential !== undefined) category.isConfidential = Boolean(isConfidential);
        if (isActive !== undefined) category.isActive = Boolean(isActive);
        if (routingKeywords !== undefined) category.routingKeywords = routingKeywords;

        await category.save();

        await AuditLog.create({
            action: "CATEGORY_UPDATED",
            performedBy: { id: req.user.id, name: req.user.name || "Main Admin", role: req.user.role, email: req.user.email },
            target: { id: category._id, model: "ComplaintCategory", identifier: category.name }
        });

        res.json({ success: true, category });
    } catch (err) {
        res.status(500).json({ message: "Failed to update category", error: err.message });
    }
};

// ─── EXPORT PERMISSIONS ──────────────────────────────────────────────────────

exports.updateStaffExportPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { exportPermissions } = req.body;
        const staff = await User.findById(id);
        if (!staff) return res.status(404).json({ message: "Staff member not found" });

        const prev = Boolean(staff.exportPermissions);
        staff.exportPermissions = Boolean(exportPermissions);
        await staff.save();

        await AuditLog.create({
            action: "EXPORT_PERMISSIONS_UPDATED",
            performedBy: { id: req.user.id, name: req.user.name || "Main Admin", role: req.user.role, email: req.user.email },
            target: { id: staff._id, model: "User", identifier: staff.email },
            details: { previous: prev, updated: staff.exportPermissions }
        });

        res.json({ success: true, staffId: staff._id, exportPermissions: staff.exportPermissions });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

exports.getAuditLogs = async (req, res) => {
    try {
        const { action, limit = 100 } = req.query;
        const filter = {};
        if (action) filter.action = action;

        const logs = await AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(Number(limit))
            .lean();

        res.json({ success: true, count: logs.length, logs });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch audit logs", error: err.message });
    }
};

// ─── SYSTEM OVERVIEW & WORKLOADS (Section 7) ─────────────────────────────────

exports.getSystemOverview = async (req, res) => {
    try {
        const now = new Date();
        const departments = await Department.find().sort({ name: 1 }).lean();

        // 1. Complaint counts
        const allComplaints = await Complaint.find().select("departmentId status createdAt escalationLevel assignedTo lifecycleState").lean();
        const totalComplaints = allComplaints.length;
        let pendingComplaints = 0;
        let inProgressComplaints = 0;
        let resolvedComplaints = 0;
        let overdueComplaints = 0;

        const deptMap = {};
        for (const d of departments) {
            deptMap[String(d._id)] = {
                departmentId: d._id,
                name: d.name,
                code: d.code,
                isActive: d.isActive,
                total: 0,
                pending: 0,
                inProgress: 0,
                resolved: 0,
                overdue: 0,
                activeWorkloadScore: 0
            };
        }
        deptMap["unassigned"] = {
            departmentId: null,
            name: "Management Review / Unassigned",
            code: "UNASSIGNED",
            isActive: true,
            total: 0,
            pending: 0,
            inProgress: 0,
            resolved: 0,
            overdue: 0,
            activeWorkloadScore: 0
        };

        for (const c of allComplaints) {
            const isResolved = c.status === "Resolved" || ["RESOLVED", "CONFIRMED", "CLOSED"].includes(c.lifecycleState);
            const isInProg = c.status === "In Progress" || c.lifecycleState === "IN_PROGRESS";
            const isPending = !isResolved && !isInProg;

            if (isResolved) resolvedComplaints++;
            else if (isInProg) inProgressComplaints++;
            else pendingComplaints++;

            // Overdue check (> 48h or escalated)
            const ageHours = (now - new Date(c.createdAt)) / (1000 * 60 * 60);
            const isOverdue = !isResolved && (ageHours > 48 || (c.escalationLevel || 0) > 0);
            if (isOverdue) overdueComplaints++;

            const dKey = c.departmentId ? String(c.departmentId) : "unassigned";
            if (deptMap[dKey]) {
                deptMap[dKey].total++;
                if (isResolved) deptMap[dKey].resolved++;
                else if (isInProg) deptMap[dKey].inProgress++;
                else deptMap[dKey].pending++;
                if (isOverdue) deptMap[dKey].overdue++;
            }
        }

        // 2. Staff workloads
        const staffList = await User.find({ role: { $in: ["STAFF", "WIFI_INCHARGE"] }, isActive: true })
            .populate("departmentId", "name code")
            .lean();

        const staffWorkloads = await Promise.all(staffList.map(async (s) => {
            const stats = await calculateEmployeeWorkload(s._id);
            return {
                id: s._id,
                name: s.name,
                email: s.email,
                designation: s.designation || s.staffRole || "Staff",
                department: s.departmentId?.name || "General",
                departmentCode: s.departmentId?.code || "GENERAL",
                activeCount: stats.activeCount,
                pendingCount: stats.pendingCount,
                overdueCount: stats.overdueCount,
                workloadScore: stats.totalScore,
                isAvailable: s.isAvailable !== false
            };
        }));

        const summary = {
            totalComplaints,
            pendingComplaints,
            inProgressComplaints,
            resolvedComplaints,
            overdueComplaints
        };
        const departmentBreakdown = Object.values(deptMap);

        res.json({
            success: true,
            summary,
            departmentBreakdown,
            staffWorkloads: staffWorkloads.sort((a, b) => b.workloadScore - a.workloadScore),
            overview: {
                totalComplaints,
                pendingComplaints,
                inProgressComplaints,
                resolvedComplaints,
                overdueComplaints,
                complaintsByDepartment: departmentBreakdown,
                departmentWorkloads: departmentBreakdown.map(d => ({
                    name: d.name,
                    code: d.code,
                    activeJobs: d.pending + d.inProgress,
                    overdueJobs: d.overdue
                })),
                staffWorkloads: staffWorkloads.sort((a, b) => b.workloadScore - a.workloadScore)
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch system overview", error: err.message });
    }
};
