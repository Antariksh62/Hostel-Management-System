const express = require("express");
const router = express.Router();
const { getProfile, getAllStudents, getAllStaff, getAllUsers, updateLanguage } = require("../controllers/userController");
const { authMiddleware, wardenMiddleware } = require("../middleware/auth");

router.get("/profile",  authMiddleware, getProfile);
router.put("/language", authMiddleware, updateLanguage);
router.get("/students", authMiddleware, wardenMiddleware, getAllStudents);
router.get("/staff",    authMiddleware, wardenMiddleware, getAllStaff);
router.get("/",         authMiddleware, wardenMiddleware, getAllUsers);

module.exports = router;
