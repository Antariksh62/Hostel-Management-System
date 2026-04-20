const Complaint = require("../models/Complaint");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");

exports.createComplaint = async (req, res) => {
    try {
        const { title, description } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        // Auto-fetch the student's door number from their profile
        const student = await User.findById(req.user.id).select("doorNumber");
        const doorNumber = student?.doorNumber || "N/A";
        
        const newComplaint = new Complaint({
            title,
            description,
            image: imagePath,
            doorNumber,
            studentId: req.user.id
        });
        
        await newComplaint.save();
        res.status(201).json({ message: "Complaint created successfully", complaint: newComplaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getStudentComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find({ studentId: req.user.id }).sort({ createdAt: -1 });
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getAllComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find()
            .populate("studentId", "name fullName email prn rollNumber classDiv year doorNumber")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });

        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.updateComplaintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Pending", "In Progress", "Resolved"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(", ")}` });
        }

        const complaint = await Complaint.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!complaint) return res.status(404).json({ message: "Complaint not found" });

        res.json({ message: "Status updated successfully", complaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ✅ ASSIGN COMPLAINT
exports.assignComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId } = req.body;

        if (!staffId) {
            return res.status(400).json({ message: "staffId is required" });
        }

        // Verify the assigned user exists and is actually STAFF
        const staffMember = await User.findById(staffId);
        if (!staffMember) {
            return res.status(404).json({ message: "Staff member not found" });
        }
        if (staffMember.role !== "STAFF") {
            return res.status(400).json({ message: "Assigned user must have STAFF role" });
        }

        const complaint = await Complaint.findByIdAndUpdate(
            id,
            {
                assignedTo: staffId,
                status: "In Progress"
            },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        res.json({ message: "Complaint assigned successfully", complaint });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await Complaint.findById(id);
        
        if (!complaint) return res.status(404).json({ message: "Complaint not found" });
        
        if (complaint.image) {
            const imagePath = path.join(__dirname, "..", complaint.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await Complaint.findByIdAndDelete(id);
        res.json({ message: "Complaint deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};