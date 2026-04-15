const Complaint = require("../models/Complaint");
const fs = require("fs");
const path = require("path");

exports.createComplaint = async (req, res) => {
    try {
        const { title, description } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
        
        const newComplaint = new Complaint({
            title,
            description,
            image: imagePath,
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
            .populate("studentId", "name email")
            .populate("assignedTo", "name email") // ✅ IMPORTANT
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

// ✅ NEW: ASSIGN COMPLAINT
exports.assignComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId } = req.body;

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