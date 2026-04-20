const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// ─── In-memory OTP store { email: { otp, expiresAt, attempts } } ─────────────
const otpStore = {};

// ─── Nodemailer transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ─── Helper: generate 6-digit OTP ────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── Helper: extract PRN from email ──────────────────────────────────────────
const extractPRN = (email) => email.toLowerCase().split("@")[0];

// =============================================================================
// POST /api/auth/student/send-otp
// Body: { email }
// =============================================================================
exports.sendOTP = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "A valid email is required" });
        }

        // Normalize to lowercase and strip whitespace
        email = email.toLowerCase().trim();

        // Basic email format check (@ present, not just the domain)
        if (!email.includes("@") || email.startsWith("@")) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // Validate PICT domain
        if (!email.endsWith("@ms.pict.edu")) {
            return res.status(400).json({
                message: "Only PICT student emails (@ms.pict.edu) are allowed"
            });
        }

        // Generate OTP (valid for 10 minutes)
        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

        // Store OTP with attempt counter (reset on each new send)
        otpStore[email] = { otp, expiresAt, attempts: 0 };

        // Send email
        await transporter.sendMail({
            from: `"PICT Hostel Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your OTP for PICT Hostel Login",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
                    <h2 style="color: #4f46e5; margin-bottom: 8px;">PICT Hostel Management</h2>
                    <p style="color: #374151; font-size: 16px;">Hello,</p>
                    <p style="color: #374151; font-size: 16px;">Your One-Time Password (OTP) for login is:</p>
                    <div style="background: #4f46e5; color: white; font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px; margin: 24px 0;">
                        ${otp}
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <p style="color: #9ca3af; font-size: 12px;">PICT Boys Hostel · Pune Institute of Computer Technology</p>
                </div>
            `
        });

        console.log(`✅ OTP sent to ${email}`); // Dev log — do NOT log the OTP in production
        res.json({ message: "OTP sent successfully", email });

    } catch (err) {
        console.error("sendOTP error:", err);
        res.status(500).json({ message: "Failed to send OTP. Please try again.", error: err.message });
    }
};

// =============================================================================
// POST /api/auth/student/verify-otp
// Body: { email, otp }
// =============================================================================
exports.verifyOTP = async (req, res) => {
    try {
        let { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        email = email.toLowerCase().trim();

        // Coerce OTP to string safely (some clients may send it as a number)
        otp = String(otp).trim();

        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ message: "OTP must be a 6-digit number" });
        }

        const record = otpStore[email];

        if (!record) {
            return res.status(400).json({ message: "No OTP found for this email. Please request a new one." });
        }

        if (Date.now() > record.expiresAt) {
            delete otpStore[email];
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        // Brute-force protection: max 5 wrong attempts per OTP
        if (record.attempts >= 5) {
            delete otpStore[email];
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
        }

        if (record.otp !== otp) {
            otpStore[email].attempts += 1;
            const remaining = 5 - otpStore[email].attempts;
            return res.status(400).json({
                message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            });
        }

        // OTP is valid — clear it immediately to prevent reuse
        delete otpStore[email];

        const prn = extractPRN(email);

        // Find or create student user
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                email,
                prn,
                role: "STUDENT",
                isVerified: true,
                profileComplete: false,
                name: prn // temporary placeholder until profile is complete
            });
            await user.save();
        } else {
            // If the user exists (returning student), mark verified and save
            user.isVerified = true;
            await user.save();
        }

        // Issue JWT
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
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// POST /api/auth/student/complete-profile
// Protected route — requires JWT
// Body: { fullName, rollNumber, classDiv, year, doorNumber }
// =============================================================================
exports.completeProfile = async (req, res) => {
    try {
        let { fullName, rollNumber, classDiv, year, doorNumber } = req.body;

        // Trim all string inputs
        fullName   = typeof fullName   === "string" ? fullName.trim()   : "";
        rollNumber = typeof rollNumber === "string" ? rollNumber.trim() : "";
        classDiv   = typeof classDiv   === "string" ? classDiv.trim()   : "";
        year       = typeof year       === "string" ? year.trim()       : "";
        doorNumber = typeof doorNumber === "string" ? doorNumber.trim() : "";

        // Validate required fields (trim-aware)
        if (!fullName || !rollNumber || !classDiv || !year || !doorNumber) {
            return res.status(400).json({ message: "All fields are required and cannot be blank" });
        }

        // Validate year against allowed values
        const allowedYears = ["FY", "SY", "TY", "Final Year"];
        if (!allowedYears.includes(year)) {
            return res.status(400).json({ message: "Year must be one of: FY, SY, TY, Final Year" });
        }

        // Ensure the caller is actually a STUDENT
        if (req.user.role !== "STUDENT") {
            return res.status(403).json({ message: "Only students can complete this profile" });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                fullName,
                name: fullName, // keep name in sync for display in existing populate() calls
                rollNumber,
                classDiv,
                year,
                doorNumber,
                profileComplete: true
            },
            { new: true, runValidators: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                email: user.email,
                prn: user.prn,
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
        // Handle Mongoose validation errors specifically
        if (err.name === "ValidationError") {
            const messages = Object.values(err.errors).map(e => e.message).join(", ");
            return res.status(400).json({ message: `Validation error: ${messages}` });
        }
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
