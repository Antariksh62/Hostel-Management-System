const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User, Student } = require("../models/User");
const OTP = require("../models/OTP");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";
const OTP_BCRYPT_ROUNDS = 6;                    // Low rounds — OTP is short-lived anyway
const OTP_EXPIRY_MS = 10 * 60 * 1000;       // 10 minutes
const RESEND_COOLDOWN_S = 60;                    // 60-second cooldown between sends
const MAX_ATTEMPTS = 5;

// ─── Nodemailer transporter ───────────────────────────────────────────────────
// Uses Gmail SMTP (port 587 / STARTTLS). Falls back to Ethereal if credentials
// are missing or rejected. OTP is always printed to console in dev mode.
let _transporter = null;
let _usingEthereal = false;

const getTransporter = async () => {
    if (_transporter) return _transporter;

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass) {
        // Explicit Gmail SMTP — more reliable than service:'gmail' shortcut
        const gmailTransport = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,   // STARTTLS on port 587
            auth: { user, pass },
            tls: { rejectUnauthorized: false }
        });
        try {
            await gmailTransport.verify();
            console.log("✅ Gmail SMTP verified — real emails will be delivered to students");
            _transporter = gmailTransport;
            _usingEthereal = false;
            return _transporter;
        } catch (err) {
            console.error("\n╔══════════════════════════════════════════════════════════╗");
            console.error("║  ❌ Gmail SMTP FAILED — OTP emails will NOT be delivered ║");
            console.error("╠══════════════════════════════════════════════════════════╣");
            console.error("║  Error: " + err.message.slice(0, 52).padEnd(52) + " ║");
            console.error("║                                                          ║");
            console.error("║  To fix (2 minutes):                                    ║");
            console.error("║  1. Log into: " + (user || "your Gmail").padEnd(43) + " ║");
            console.error("║  2. Go to: myaccount.google.com/apppasswords            ║");
            console.error("║  3. Generate a new App Password (select 'Mail')         ║");
            console.error("║  4. Paste it as EMAIL_PASS in backend/.env              ║");
            console.error("║  5. Restart the server                                  ║");
            console.error("║                                                          ║");
            console.error("║  In the meantime: OTP is shown in the browser UI ✅     ║");
            console.error("╚══════════════════════════════════════════════════════════╝\n");
        }
    } else {
        console.warn("⚠️  EMAIL_USER / EMAIL_PASS not set in .env — using Ethereal fallback");
    }

    // Fallback: Ethereal catches all emails, preview URL logged to console
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
    });
    _usingEthereal = true;
    console.log("📧 Ethereal test SMTP active:", testAccount.user);
    return _transporter;
};


// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const extractPRN = (email) => email.toLowerCase().split("@")[0];

/**
 * Parses a PICT autonomous PRN (e.g. f24ce307) and returns:
 *   { branch: 'CE', joiningYear: 2024 }
 * Supported branch codes: ce → CE, et → ENTC, it → IT, ad → AIDS, ec → ECE
 */
const parsePRN = (prn) => {
    prn = prn.toLowerCase();
    // Extract joining year digits: f24... → 24 → 2024
    const yearMatch = prn.match(/^f(\d{2})/);
    const joiningYear = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : null;

    // Branch code is the letters after the year digits
    const branchMatch = prn.match(/^f\d{2}([a-z]+)/);
    const branchCode = branchMatch ? branchMatch[1] : '';

    const branchMap = { ce: 'CE', et: 'ENTC', it: 'IT', ad: 'AIDS', ec: 'ECE' };
    const branch = branchMap[branchCode] || null;

    return { branch, joiningYear };
};

// =============================================================================
// POST /api/auth/student/send-otp
// Body already validated by Joi middleware (schemas.sendOTP)
// =============================================================================
exports.sendOTP = async (req, res) => {
    try {
        let { email } = req.body;
        email = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email });
        const isRegistered = !!existingUser;

        // Validate PICT domain (belt-and-suspenders after Joi)
        if (!email.endsWith("@ms.pict.edu")) {
            return res.status(400).json({
                message: "Only PICT student emails (@ms.pict.edu) are allowed"
            });
        }

        // ── Resend cooldown: check DB record ─────────────────────────────────
        const existing = await OTP.findOne({ email });
        if (existing) {
            const secondsSinceSent = Math.floor(
                (Date.now() - existing.lastSentAt.getTime()) / 1000
            );
            if (secondsSinceSent < RESEND_COOLDOWN_S) {
                const resendAfter = RESEND_COOLDOWN_S - secondsSinceSent;
                return res.status(429).json({
                    message: `Please wait ${resendAfter} seconds before requesting a new OTP.`,
                    resendAfter
                });
            }
        }

        // ── Generate & hash OTP ───────────────────────────────────────────────
        const rawOTP = generateOTP();
        const hashedOTP = await bcrypt.hash(rawOTP, OTP_BCRYPT_ROUNDS);

        // ── Upsert into DB (create or overwrite) ──────────────────────────────
        await OTP.findOneAndUpdate(
            { email },
            {
                otp: hashedOTP,
                expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
                attempts: 0,
                lastSentAt: new Date()
            },
            { upsert: true, returnDocument: "after" }
        );

        // ── Always log OTP to console (visible in terminal) ──────────────────
        const isDev = process.env.NODE_ENV !== "production";
        console.log(`\n🔑 ============================================`);
        console.log(`   OTP for ${email}: ${rawOTP}`);
        console.log(`   (valid 10 min)`);
        console.log(`🔑 ============================================\n`);

        // ── Attempt email delivery (non-blocking — OTP still works if email fails) ──
        let emailDelivered = false;
        let etherealPreview = null;
        try {
            const transport = await getTransporter();
            const info = await transport.sendMail({
                from: `"PICT Hostel Management" <${process.env.EMAIL_USER || "hostel@pict.edu"}>`,
                to: email,
                subject: "Your OTP for PICT Hostel Login",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
                        <h2 style="color: #4f46e5; margin-bottom: 8px;">PICT Hostel Management</h2>
                        <p style="color: #374151; font-size: 16px;">Hello,</p>
                        <p style="color: #374151; font-size: 16px;">Your One-Time Password (OTP) for login is:</p>
                        <div style="background: #4f46e5; color: white; font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 24px 0;">
                            ${rawOTP}
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                        <p style="color: #9ca3af; font-size: 12px;">PICT Boys Hostel · Pune Institute of Computer Technology</p>
                    </div>
                `
            });
            emailDelivered = true;
            etherealPreview = nodemailer.getTestMessageUrl(info);
            if (etherealPreview) {
                console.log(`📬 Ethereal preview URL: ${etherealPreview}`);
            }
            console.log(`✅ OTP email dispatched to ${email}`);
        } catch (mailErr) {
            // Email failed — OTP is still valid in DB, continue
            console.warn(`⚠️  Email delivery failed (OTP still valid): ${mailErr.message}`);
        }

        // ── Build response ────────────────────────────────────────────────────
        // NOTE: The raw OTP is NEVER exposed in the response (any environment).
        // Students must check their email inbox — this enforces real email auth.
        const response = {
            message: "OTP sent successfully",
            email,
            resendAfter: RESEND_COOLDOWN_S,
            emailDelivered,
            isRegistered
        };

        // Ethereal preview URL only in dev (no security risk — no OTP value exposed)
        if (isDev && etherealPreview) {
            response.etherealPreview = etherealPreview;
        }

        res.json(response);

    } catch (err) {
        console.error("sendOTP error:", err);
        res.status(500).json({ message: "Failed to send OTP. Please try again.", error: err.message });
    }
};


// =============================================================================
// POST /api/auth/student/verify-otp
// Body already validated by Joi middleware (schemas.verifyOTP)
// =============================================================================
exports.verifyOTP = async (req, res) => {
    try {
        let { email, otp } = req.body;
        email = email.toLowerCase().trim();
        otp = String(otp).trim();

        const record = await OTP.findOne({ email });

        if (!record) {
            return res.status(400).json({
                message: "No OTP found for this email. Please request a new one."
            });
        }

        // ── Expiry check ──────────────────────────────────────────────────────
        if (Date.now() > record.expiresAt.getTime()) {
            await OTP.deleteOne({ email });
            return res.status(400).json({
                message: "OTP has expired. Please request a new one."
            });
        }

        // ── Brute-force lockout ───────────────────────────────────────────────
        if (record.attempts >= MAX_ATTEMPTS) {
            await OTP.deleteOne({ email });
            return res.status(429).json({
                message: "Too many incorrect attempts. Please request a new OTP."
            });
        }

        // ── Constant-time bcrypt comparison ───────────────────────────────────
        const isMatch = await bcrypt.compare(otp, record.otp);

        if (!isMatch) {
            await OTP.findOneAndUpdate(
                { email },
                { $inc: { attempts: 1 } }
            );
            const remaining = MAX_ATTEMPTS - (record.attempts + 1);
            return res.status(400).json({
                message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            });
        }

        // ── Valid OTP — delete immediately (one-time use) ─────────────────────
        await OTP.deleteOne({ email });

        const prn = extractPRN(email);

        // ── Find or create student user ───────────────────────────────────────
        let user = await User.findOne({ email });
        if (!user) {
            const { branch, joiningYear } = parsePRN(prn);
            // Must use Student discriminator so prn and other student fields are saved
            user = new Student({
                email,
                prn,
                branch,
                joiningYear,
                role: "STUDENT",
                isVerified: true,
                profileComplete: false,
                name: prn         // placeholder until profile is completed
            });
            await user.save();
        } else {
            user.isVerified = true;
            await user.save();
        }

        // ── Issue JWT ─────────────────────────────────────────────────────────
        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "OTP verified successfully",
            token,
            user: {
                id: user._id,
                email: user.email,
                prn: user.prn,
                branch: user.branch || null,
                joiningYear: user.joiningYear || null,
                role: user.role,
                name: user.fullName || user.name,
                fullName: user.fullName || null,
                rollNumber: user.rollNumber || null,
                classDiv: user.classDiv || null,
                year: user.year || null,
                doorNumber: user.doorNumber || null,
                profileComplete: user.profileComplete
            }
        });

    } catch (err) {
        console.error("verifyOTP error:", err);
        if (err.code === 11000) {
            return res.status(400).json({
                message: "A student with this PRN already exists."
            });
        }
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// POST /api/auth/student/complete-profile
// Protected — requires JWT.  Body already validated by Joi (schemas.completeProfile)
// =============================================================================
exports.completeProfile = async (req, res) => {
    try {
        const { fullName, rollNumber, classDiv, year, doorNumber, branch } = req.body;

        // Role guard
        if (req.user.role !== "STUDENT") {
            return res.status(403).json({ message: "Only students can complete this profile" });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                fullName,
                name: fullName,
                rollNumber,
                classDiv,
                year,
                doorNumber,
                branch,
                profileComplete: true
            },
            { returnDocument: "after", runValidators: true }
        );

        if (user.profileComplete) {
            return res.status(400).json({ message: "Profile already completed. Please login." });
        }
        res.json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                email: user.email,
                prn: user.prn,
                branch: user.branch || null,
                joiningYear: user.joiningYear || null,
                role: user.role,
                name: user.fullName,
                fullName: user.fullName,
                rollNumber: user.rollNumber,
                classDiv: user.classDiv,
                year: user.year,
                doorNumber: user.doorNumber,
                profileComplete: user.profileComplete
            }
        });

    } catch (err) {
        console.error("completeProfile error:", err);
        if (err.name === "ValidationError") {
            const messages = Object.values(err.errors).map((e) => e.message).join(", ");
            return res.status(400).json({ message: `Validation error: ${messages}` });
        }
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// PATCH /api/auth/student/update-info
// Lets a returning student update classDiv, rollNumber, doorNumber and year
// (e.g. when they move to a new year)
// =============================================================================
exports.updateInfo = async (req, res) => {
    try {
        if (req.user.role !== "STUDENT") {
            return res.status(403).json({ message: "Only students can update info" });
        }

        const { rollNumber, classDiv, year, doorNumber, branch } = req.body;
        const update = {};
        if (rollNumber !== undefined) update.rollNumber = rollNumber;
        if (classDiv !== undefined) update.classDiv = classDiv;
        if (year !== undefined) update.year = year;
        if (doorNumber !== undefined) update.doorNumber = doorNumber;
        if (branch !== undefined) update.branch = branch;

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            update,
            { returnDocument: "after", runValidators: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            message: "Info updated successfully",
            user: {
                id: user._id,
                email: user.email,
                prn: user.prn,
                branch: user.branch || null,
                joiningYear: user.joiningYear || null,
                role: user.role,
                name: user.fullName,
                fullName: user.fullName,
                rollNumber: user.rollNumber,
                classDiv: user.classDiv,
                year: user.year,
                doorNumber: user.doorNumber,
                profileComplete: user.profileComplete
            }
        });

    } catch (err) {
        console.error("updateInfo error:", err);
        if (err.name === "ValidationError") {
            const messages = Object.values(err.errors).map((e) => e.message).join(", ");
            return res.status(400).json({ message: `Validation error: ${messages}` });
        }
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
