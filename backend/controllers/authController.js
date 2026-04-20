const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Input validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "All fields (name, email, password, role) are required" });
        }

        const allowedRoles = ["WARDEN", "STAFF"];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: "Role must be WARDEN or STAFF. Students register via OTP." });
        }

        // Check existing user
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role
        });

        await newUser.save();
        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Check user
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(400).json({ message: "Invalid email or password" });

        // Block students from using the staff login endpoint
        if (user.role === "STUDENT") {
            return res.status(403).json({ message: "Students must login via the OTP portal. Use the Student Login option." });
        }

        // Guard: staff/warden must have a password set
        if (!user.password) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

        // Create token
        const payload = {
            id: user._id,
            role: user.role
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
