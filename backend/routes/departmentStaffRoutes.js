const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const controller = require("../controllers/departmentStaffController");

router.use(authMiddleware);

router.get("/department-info", controller.getMyDepartmentInfo);
router.get("/department-complaints", controller.getDepartmentComplaints);
router.get("/department-colleagues", controller.getDepartmentColleagues);
router.post("/complaint/:id/claim", controller.claimComplaint);
router.post("/complaint/:id/assign", controller.assignDepartmentComplaint);

router.get("/my-jobs", controller.getMyAssignedJobs);
router.get("/my-history", controller.getMyWorkHistory);
router.post("/complaint/:id/accept", controller.acceptJob);
router.post("/complaint/:id/start", controller.startWork);
router.post("/complaint/:id/start-work", controller.startWork);
router.post("/complaint/:id/note", controller.addWorkNote);
router.post("/complaint/:id/complete", controller.completeWork);
router.post("/complaint/:id/complete-work", controller.completeWork);
router.get("/complaint/:id/events", controller.getComplaintTimeline);

module.exports = router;

