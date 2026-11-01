const mongoose = require("mongoose");

const DashboardTemplateSchema = new mongoose.Schema({
    templateId: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    roleCode: {
        type: String,
        required: true,
        uppercase: true
    },
    description: {
        type: String,
        default: ""
    },
    defaultModules: [{
        type: String,
        trim: true
    }]
}, { timestamps: true });

const DashboardInstanceSchema = new mongoose.Schema({
    instanceId: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        required: true
    },
    templateId: {
        type: String,
        required: true,
        uppercase: true
    },
    assignedEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    activeModules: [{
        type: String,
        trim: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    settings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, { timestamps: true });

DashboardInstanceSchema.index({ departmentId: 1, isActive: 1 });
DashboardInstanceSchema.index({ templateId: 1 });

const DashboardTemplate = mongoose.model("DashboardTemplate", DashboardTemplateSchema);
const DashboardInstance = mongoose.model("DashboardInstance", DashboardInstanceSchema);

module.exports = {
    DashboardTemplate,
    DashboardInstance
};

