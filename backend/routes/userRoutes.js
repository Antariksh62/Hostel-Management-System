const express = require("express");
const router = express.Router();
const { getProfile, getAllStudents, getAllUsers } = require("../controllers/userController");
const { authMiddleware, wardenMiddleware } = require("../middleware/auth");

router.get("/profile", authMiddleware, getProfile);
router.get("/students", authMiddleware, wardenMiddleware, getAllStudents);

// Handle the /users route assuming it is routed here from server.js
if (getAllUsers) {
    router.get("/", authMiddleware, wardenMiddleware, getAllUsers);
}

module.exports = router;
