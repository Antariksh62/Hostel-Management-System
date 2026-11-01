const express = require("express");
const router = express.Router();
const {
    authMiddleware,
    mainAdminOnlyMiddleware,
    staffManagementMiddleware
} = require("../middleware/auth");
const controller = require("../controllers/mainAdminController");

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
router.get("/departments", authMiddleware, controller.getAllDepartments);
router.post("/departments", authMiddleware, mainAdminOnlyMiddleware, controller.createDepartment);
router.patch("/departments/:id", authMiddleware, mainAdminOnlyMiddleware, controller.updateDepartment);

// ─── TEMPLATES & INSTANCES ───────────────────────────────────────────────────
router.get("/templates", authMiddleware, controller.getAllTemplates);
router.get("/instances", authMiddleware, controller.getAllInstances);
router.post("/instances", authMiddleware, mainAdminOnlyMiddleware, controller.createInstance);

// ─── STAFF MANAGEMENT ────────────────────────────────────────────────────────
router.get("/staff", authMiddleware, staffManagementMiddleware, controller.getAllStaff);
router.post("/staff", authMiddleware, staffManagementMiddleware, controller.createStaff);
router.patch("/staff/:id/availability", authMiddleware, staffManagementMiddleware, controller.updateStaffAvailability);
router.post("/staff/:id/deactivate", authMiddleware, staffManagementMiddleware, controller.deactivateStaff);
router.post("/staff/:id/restore", authMiddleware, staffManagementMiddleware, controller.restoreStaff);
router.post("/staff/transfer-work", authMiddleware, staffManagementMiddleware, controller.transferWork);
router.post("/staff/:id/permissions", authMiddleware, mainAdminOnlyMiddleware, controller.updateStaffPermissions);
router.patch("/staff/:id/export-permissions", authMiddleware, mainAdminOnlyMiddleware, controller.updateStaffExportPermissions);

// ─── COMPLAINT CATEGORIES ───────────────────────────────────────────────────
router.get("/categories", authMiddleware, controller.getAllCategories);
router.post("/categories", authMiddleware, mainAdminOnlyMiddleware, controller.createCategory);
router.patch("/categories/:id", authMiddleware, mainAdminOnlyMiddleware, controller.updateCategory);

// ─── GLOBAL MONITORING FEED ──────────────────────────────────────────────────
router.get("/monitoring/feed", authMiddleware, controller.getGlobalMonitoringFeed);

// ─── ESCALATIONS & AUDIT LOGS ────────────────────────────────────────────────
router.post("/escalations/trigger", authMiddleware, controller.triggerEscalationCheck);
router.get("/audit-logs", authMiddleware, mainAdminOnlyMiddleware, controller.getAuditLogs);

module.exports = router;

