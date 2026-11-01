const express = require("express");
const router  = express.Router();

const {
    getServiceHeatMap,
    getRoomComplaints
} = require("../controllers/serviceController");

const { authMiddleware, wifiInchargeOrWardenMiddleware } = require("../middleware/auth");

// Authorized for Wardens, HeadWardens, Incharges, and Wi-Fi In-Charge
router.use(authMiddleware, wifiInchargeOrWardenMiddleware);

router.get("/heat-map", getServiceHeatMap);
router.get("/room/:roomNumber/complaints", getRoomComplaints);

module.exports = router;
