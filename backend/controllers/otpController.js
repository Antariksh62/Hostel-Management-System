const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User, Student } = require("../models/User");
const { isValidRoom, MAX_STUDENTS_PER_ROOM } = require("../utils/hostelRooms");
const { checkRoomCapacity, assignStudentRoomAtomic, atomicConvertRosterToRegistered } = require("../services/roomOccupancyService");
const OTP = require("../models/OTP");
const StudentRoster = require("../models/StudentRoster");
const logger = require("../utils/logger");
const generateTokens = require("../utils/generateTokens");

const JWT_SECRET = process.env.JWT_SECRET;
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
        try {
            const gmailTransport = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false,   // STARTTLS on port 587
                auth: { user, pass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 4000,
                greetingTimeout: 4000
            });
            await gmailTransport.verify();
            logger.info("✅ Gmail SMTP verified — real emails will be delivered to students");
            _transporter = gmailTransport;
            _usingEthereal = false;
            return _transporter;
        } catch (err) {
            logger.warn("⚠️  Gmail SMTP verification failed (will fallback to dev test account): " + err.message);
        }
    }

    try {
        const testAccount = await nodemailer.createTestAccount();
        _transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
            connectionTimeout: 4000
        });
        _usingEthereal = true;
        logger.info("📧 Ethereal test SMTP active: " + testAccount.user);
        return _transporter;
    } catch (testErr) {
        logger.warn("⚠️  Ethereal SMTP fallback failed: " + testErr.message + " (OTP will still be generated and printed to console)");
        return null;
    }
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

        // Verify existing user account integrity
        if (existingUser) {
            if (existingUser.role !== "STUDENT") {
                return res.status(403).json({
                    message: `Account is registered with role ${existingUser.role}. Student OTP authentication is not permitted for administrative accounts.`
                });
            }
            // Prevent silently linking an existing email account to a different roster PRN
            const roster = await StudentRoster.findOne({ email });
            if (roster && existingUser.prn && roster.prn && existingUser.prn.toUpperCase() !== roster.prn.toUpperCase()) {
                return res.status(400).json({
                    message: `Email is already registered to PRN ${existingUser.prn}, cannot link to roster PRN ${roster.prn}.`
                });
            }
        }

        // Student Admission & Eligibility Gate:
        // EVERY student (new or previously registered) MUST have an active APPROVED roster record.
        // If a student is removed from the roster list, or their admission is REVOKED/REJECTED/PENDING,
        // they are strictly blocked from receiving an OTP or logging into the hostel system.
        const roster = await StudentRoster.findOne({ email });
        if (!roster) {
            return res.status(403).json({
                message: "Access restricted: Your email is not present on the active hostel admission roster. Please contact the Head Warden or Hostel In-Charge."
            });
        }

        if (roster.admissionStatus === "PENDING_APPROVAL") {
            return res.status(403).json({
                message: "Your hostel admission is pending approval by the Head Warden or Hostel In-Charge."
            });
        }

        if (roster.admissionStatus === "REJECTED") {
            return res.status(403).json({
                message: `Your hostel admission was not approved. Reason: ${roster.rejectionReason || "Not specified"}.`
            });
        }

        if (roster.admissionStatus === "REVOKED") {
            return res.status(403).json({
                message: `Your hostel registration eligibility has been revoked. Reason: ${roster.rejectionReason || "Not specified"}.`
            });
        }

        if (roster.admissionStatus !== "APPROVED") {
            return res.status(403).json({
                message: "You do not have an approved hostel admission record."
            });
        }

        // Mark registration progress for first-time registrants
        if (!isRegistered && roster.registrationStatus === "NOT_REGISTERED") {
            roster.registrationStatus = "REGISTRATION_STARTED";
            await roster.save();
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
        if (isDev) {
            logger.info(`[DEV] OTP generated for ${email}: ${rawOTP}`);
        } else {
            logger.info(`OTP successfully generated and dispatched for ${email}`);
        }

        let emailDelivered = false;
        let etherealPreview = null;
        try {
            const transport = await getTransporter();
            if (transport) {
                const info = await transport.sendMail({
                    from: `"PICT Hostel Management" <${process.env.EMAIL_USER || "hostel@pict.edu"}>`,
                    to: email,
                    subject: "Your OTP for PICT Hostel Login",
                    html: `<h2>Your OTP is: ${rawOTP}</h2>`
                });
                emailDelivered = true;
                etherealPreview = nodemailer.getTestMessageUrl(info);
            }
        } catch (mailErr) {
            logger.warn(`⚠️  Email delivery failed (OTP still valid): ${mailErr.message}`);
        }

        const response = {
            message: "OTP sent successfully",
            email,
            resendAfter: RESEND_COOLDOWN_S,
            emailDelivered,
            isRegistered
        };

        if (isDev) {
            response.devOtp = rawOTP;
            if (etherealPreview) response.etherealPreview = etherealPreview;
        }

        res.json(response);
    } catch (err) {
        logger.error("sendOTP error:", err);
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

        // Check if matching roster record exists and is active/approved
        const roster = await StudentRoster.findOne({ email });
        if (!roster || roster.admissionStatus !== "APPROVED") {
            return res.status(403).json({
                message: "Login denied: Student admission eligibility is not approved, has been revoked, or record was removed from the active roster."
            });
        }

        if (!user) {

            // Concurrency protection: verify no user account was concurrently created
            const concurrentUser = await User.findOne({
                $or: [{ email }, { prn: (roster?.prn || prn).toUpperCase() }]
            });
            if (concurrentUser) {
                if (concurrentUser.role !== "STUDENT") {
                    return res.status(403).json({ message: "An administrative account exists with this credential." });
                }
                user = concurrentUser;
            }
        }

        if (!user) {
            const { branch: parsedBranch, joiningYear } = parsePRN(prn);
            const branch = roster?.branch || parsedBranch;
            const doorNumber = roster?.doorNumber || null;
            const fullName = roster?.name || prn;
            const rollNumber = roster?.rollNumber || null;
            const mobileNumber = roster?.studentMobile || null;
            const guardianPhone = roster?.parentMobile || "";
            const year = roster?.year || "FY";
            const classDiv = roster?.division || "";

            user = new Student({
                email,
                prn: roster?.prn || prn,
                branch,
                joiningYear,
                role: "STUDENT",
                isVerified: true,
                profileComplete: false,
                name: fullName,
                fullName,
                rollNumber,
                doorNumber,
                mobileNumber,
                guardianPhone,
                year,
                classDiv
            });
            await user.save();

            if (doorNumber && isValidRoom(doorNumber)) {
                try {
                    // Atomically convert the pre-registration roster reservation to a registered student occupant
                    await atomicConvertRosterToRegistered({
                        roomNumber: doorNumber,
                        rosterId: roster?._id,
                        studentId: user._id
                    });
                } catch (roomErr) {
                    logger.warn("Initial room allocation atomic check warning: " + roomErr.message);
                }
            }
        } else {
            user.isVerified = true;
            await user.save();
            user = await Student.findById(user._id); // Refetch to ensure latest state
        }

        if (roster) {
            roster.userId = user._id;
            roster.registrationStatus = user.profileComplete ? "REGISTERED" : "REGISTRATION_STARTED";
            await roster.save();
        }

        const accessToken = generateTokens(res, user);

        res.json({
            message: "OTP verified successfully",
            token: accessToken,
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
                mobileNumber: user.mobileNumber || null,
                profileComplete: user.profileComplete,
                preferredLanguage: user.preferredLanguage || "en"
            }
        });
    } catch (err) {
        logger.error("verifyOTP error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// =============================================================================
// POST /api/auth/student/complete-profile
// =============================================================================
exports.completeProfile = async (req, res) => {
    try {
        const { fullName, rollNumber, classDiv, year, doorNumber, branch, mobileNumber } = req.body;

        if (req.user.role !== "STUDENT") {
            return res.status(403).json({ message: "Only students can complete this profile" });
        }

        const mobileRegex = /^[6-9]\d{9}$/;
        const trimmedMobile = mobileNumber ? String(mobileNumber).trim() : "";
        if (!trimmedMobile || !mobileRegex.test(trimmedMobile)) {
            return res.status(400).json({ message: "Please provide a valid 10-digit mobile number" });
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
                mobileNumber: trimmedMobile,
                profileComplete: true
            },
            { new: true, runValidators: true }
        );

        updatedUser = await Student.findById(updatedUser._id);

        // Update linked roster registration status if present
        try {
            await StudentRoster.findOneAndUpdate(
                { $or: [{ userId: updatedUser._id }, { email: updatedUser.email }, { prn: updatedUser.prn }] },
                { $set: { registrationStatus: "REGISTERED", userId: updatedUser._id } }
            );
        } catch (rosterErr) {
            logger.warn("Roster status update warning on profile completion: " + rosterErr.message);
        }

        logger.info("PROFILE COMPLETED SUCCESSFULLY FOR: " + updatedUser.email);

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
                mobileNumber: updatedUser.mobileNumber || null,
                profileComplete: updatedUser.profileComplete
            }
        });
    } catch (err) {
        logger.error("completeProfile error:", err);
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

        const existing = await Student.findById(req.user.id);
        if (!existing) {
            return res.status(404).json({ message: "Student not found" });
        }

        const { rollNumber, classDiv, year, doorNumber, branch, mobileNumber } = req.body;
        const update = {};
        if (rollNumber !== undefined) update.rollNumber = rollNumber;
        if (classDiv !== undefined) update.classDiv = classDiv;
        if (year !== undefined) update.year = year;
        if (doorNumber !== undefined) {
            const cleanDoor = String(doorNumber).trim();
            if (cleanDoor) {
                if (!isValidRoom(cleanDoor)) {
                    return res.status(400).json({ message: `Room ${cleanDoor} is not a valid room in the 77-room inventory (101–509)` });
                }
                if (existing.doorNumber !== cleanDoor) {
                    const capCheck = await checkRoomCapacity(cleanDoor, req.user.id);
                    if (!capCheck.allowed) {
                        return res.status(400).json({ message: capCheck.message });
                    }
                    await assignStudentRoomAtomic({
                        studentId: req.user.id,
                        newRoom: cleanDoor,
                        previousRoom: existing.doorNumber,
                        adminName: "Student Self-Update",
                        reason: "Student room update"
                    });
                }
            } else {
                update.doorNumber = null;
            }
        }
        if (branch !== undefined) update.branch = branch;
        if (mobileNumber !== undefined) {
            const mobileRegex = /^[6-9]\d{9}$/;
            if (!mobileRegex.test(mobileNumber)) {
                return res.status(400).json({ message: "Please provide a valid 10-digit mobile number" });
            }
            update.mobileNumber = mobileNumber;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const user = await Student.findByIdAndUpdate(
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
                mobileNumber: user.mobileNumber || null,
                profileComplete: user.profileComplete
            }
        });
    } catch (err) {
        logger.error("updateInfo error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};