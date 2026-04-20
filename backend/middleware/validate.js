const Joi = require("joi");

// ─── Middleware factory ────────────────────────────────────────────────────────
// Validates req.body against the given Joi schema.
// abortEarly: false → returns ALL validation errors at once.
// stripUnknown: true → silently removes unexpected fields.
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        const message = error.details.map((d) => d.message).join("; ");
        return res.status(400).json({ message });
    }
    req.body = value; // use the cleaned/coerced value
    next();
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const schemas = {
    sendOTP: Joi.object({
        email: Joi.string().email({ tlds: { allow: false } }).required()
    }),

    verifyOTP: Joi.object({
        email: Joi.string().email({ tlds: { allow: false } }).required(),
        otp: Joi.string().length(6).pattern(/^\d+$/).required()
            .messages({ "string.pattern.base": "OTP must be a 6-digit number" })
    }),

    login: Joi.object({
        email: Joi.string().email({ tlds: { allow: false } }).required(),
        password: Joi.string().min(6).required()
    }),

    register: Joi.object({
        name: Joi.string().trim().min(2).max(50).required(),
        email: Joi.string().email({ tlds: { allow: false } }).required(),
        password: Joi.string().min(6).required(),
        role: Joi.string().valid("WARDEN", "STAFF").required()
            .messages({ "any.only": "Role must be WARDEN or STAFF. Students register via OTP." })
    }),

    createComplaint: Joi.object({
        title: Joi.string().trim().min(3).max(100).required(),
        description: Joi.string().trim().min(10).required(),
        category: Joi.string()
            .valid("Electrical", "Plumbing", "Furniture", "Cleanliness", "Internet", "Other")
            .default("Other")
    }),

    completeProfile: Joi.object({
        fullName: Joi.string().trim().min(2).max(80).required(),
        rollNumber: Joi.string().trim().min(1).max(20).required(),
        classDiv: Joi.string().trim().required(),
        year: Joi.string().valid("FY", "SY", "TY", "Final Year").required(),
        doorNumber: Joi.string().trim().min(1).max(20).required()
    })
};

module.exports = { validate, schemas };
