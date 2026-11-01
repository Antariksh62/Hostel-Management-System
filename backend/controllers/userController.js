const { User } = require("../models/User");

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getAllStudents = async (req, res) => {
    try {
        const students = await User.find({ role: "STUDENT" }).select("-password -phone -guardianPhone -emergencyContact -emergencyPhone -mobileNumber");
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getAllStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: "STAFF" }).select("-password");
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.updateLanguage = async (req, res) => {
    try {
        const { language } = req.body;
        if (!["en", "hi", "mr"].includes(language)) {
            return res.status(400).json({ message: "Invalid language code. Supported: 'en', 'hi', 'mr'" });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { preferredLanguage: language },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            message: "Language preference updated",
            preferredLanguage: user.preferredLanguage
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
