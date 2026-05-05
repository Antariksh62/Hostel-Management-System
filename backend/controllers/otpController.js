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
let _transporter = null;
let _usingEthereal = false;

const getTransporter = async () => {
    if (_transporter) return _transporter;

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass) {
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
            console.error("╚══════════════════════════════════════════════════════════╝\n");
        }
    } else {
        console.warn("⚠️  EMAIL_USER / EMAIL_PASS not set in .env — using Ethereal fallback");
    }

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

const parsePRN = (prn) => {
    prn = prn.toLowerCase();
    const yearMatch = prn.match(/^f(\d{2})/);
    const joiningYear = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : null;

    const branchMatch = prn.match(/^f\d{2}([a-z]+)/);
    const branchCode = branchMatch ? branchMatch[1] : '';

    const branchMap = { ce: 'CE', et: 'ENTC', it: 'IT', ad: 'AIDS', ec: 'ECE' };
    const branch = branchMap[branchCode] || null;

    return { branch, joiningYear };
};

// =============================================================================
// POST /api/auth/student/send-otp
// =============================================================================
exports.sendOTP = async (req, res) => {
    try {
        let { email } = req.body;
        email = email.toLowerCase().trim();
        const existingUser = await User.findOne({ email });
        const isRegistered = !!existingUser;

        if (!email.endsWith("@ms.pict.edu")) {
            return res.status(400).json({
                message: "Only PICT student emails (@ms.pict.edu) are allowed"
            });
        }

        const existing = await OTP.findOne({ email });
        if (existing) {
            const secondsSinceSent = Math.floor((Date.now() - existing.lastSentAt.getTime()) / 1000);
            if (secondsSinceSent < RESEND_COOLDOWN_S) {
                const resendAfter = RESEND_COOLDOWN_S - secondsSinceSent;
                return res.status(429).json({
                    message: `Please wait ${resendAfter} seconds before requesting a new OTP.`,
                    resendAfter
                });
            }
        }

        const rawOTP = generateOTP();
        const hashedOTP = await bcrypt.hash(rawOTP, OTP_BCRYPT_ROUNDS);

        await OTP.findOneAndUpdate(
            { email },
            {
                otp: hashedOTP,
                expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
                attempts: 0,
                lastSentAt: new Date()
            },
            { upsert: true, new: true }
        );

        const isDev = process.env.NODE_ENV !== "production";
        console.log(`\n🔑 ============================================`);
        console.log(`   OTP for ${email}: ${rawOTP}`);
        console.log(`🔑 ============================================\n`);

        let emailDelivered = false;
        let etherealPreview = null;
        try {
            const transport = await getTransporter();
            const info = await transport.sendMail({
                from: `"PICT Hostel Management" <${process.env.EMAIL_USER || "hostel@pict.edu"}>`,
                to: email,
                subject: "Your OTP for PICT Hostel Login",
                html: `<h2>Your OTP is: ${rawOTP}</h2>`
            });
            emailDelivered = true;
            etherealPreview = nodemailer.getTestMessageUrl(info);
        } catch (mailErr) {
            console.warn(`⚠️  Email delivery failed (OTP still valid): ${mailErr.message}`);
        }

        const response = {
            message: "OTP sent successfully",
            email,
            resendAfter: RESEND_COOLDOWN_S,
            emailDelivered,
            isRegistered
        };

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
// =============================================================================
exports.verifyOTP = async (req, res) => {
    try {
        let { email, otp } = req.body;
        email = email.toLowerCase().trim();
        otp = String(otp).trim();

        const record = await OTP.findOne({ email });

        if (!record) {
            return res.status(400).json({ message: "No OTP found for this email. Please request a new one." });
        }

        if (Date.now() > record.expiresAt.getTime()) {
            await OTP.deleteOne({ email });
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        if (record.attempts >= MAX_ATTEMPTS) {
            await OTP.deleteOne({ email });
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        const isMatch = await bcrypt.compare(otp, record.otp);

        if (!isMatch) {
            await OTP.findOneAndUpdate({ email }, { $inc: { attempts: 1 } });
            const remaining = MAX_ATTEMPTS - (record.attempts + 1);
            return res.status(400).json({ message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` });
        }

        await OTP.deleteOne({ email });

        const prn = extractPRN(email);
        let user = await Student.findOne({ email });

        if (!user) {
            const { branch, joiningYear } = parsePRN(prn);
            user = new Student({
                email,
                prn,
                branch,
                joiningYear,
                role: "STUDENT",
                isVerified: true,
                profileComplete: false,
                name: prn
            });
            await user.save();
        } else {
            user.isVerified = true;
            await user.save();
            user = await Student.findById(user._id); // Refetch to ensure latest state
        }

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
                profileComplete: user.profileComplete // Drives the frontend redirect
            }
        });
    } catch (err) {
        console.error("verifyOTP error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// POST /api/auth/student/complete-profile
// =============================================================================
exports.completeProfile = async (req, res) => {
    try {
        const { fullName, rollNumber, classDiv, year, doorNumber, branch } = req.body;

        if (req.user.role !== "STUDENT") {
            return res.status(403).json({ message: "Only students can complete this profile" });
        }

        const existingUser = await Student.findById(req.user.id);

        if (!existingUser) {
            return res.status(404).json({ message: "User not found" });
        }

        if (existingUser.profileComplete) {
            return res.status(400).json({ message: "Profile already completed. Please login." });
        }

        // ✅ FIXED BUG: Changed "const user =" to "let updatedUser =" to prevent server crash
        let updatedUser = await Student.findByIdAndUpdate(
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
            { new: true, runValidators: true }
        );

        updatedUser = await Student.findById(updatedUser._id);

        console.log("PROFILE COMPLETED SUCCESSFULLY FOR:", updatedUser.email);

        res.json({
            message: "Profile updated successfully",
            user: {
                id: updatedUser._id,
                email: updatedUser.email,
                prn: updatedUser.prn,
                branch: updatedUser.branch || null,
                joiningYear: updatedUser.joiningYear || null,
                role: updatedUser.role,
                name: updatedUser.fullName,
                fullName: updatedUser.fullName,
                rollNumber: updatedUser.rollNumber,
                classDiv: updatedUser.classDiv,
                year: updatedUser.year,
                doorNumber: updatedUser.doorNumber,
                profileComplete: updatedUser.profileComplete
            }
        });
    } catch (err) {
        console.error("completeProfile error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// PATCH /api/auth/student/update-info
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
            { new: true, runValidators: true }
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
        res.status(500).json({ message: "Server error", error: err.message });
    }
};