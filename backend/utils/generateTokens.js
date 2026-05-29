const jwt = require("jsonwebtoken");

const generateTokens = (res, user) => {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET, // Using same secret for simplicity, ideally separate
        { expiresIn: "7d" }
    );

    res.cookie("jwt", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return accessToken;
};

module.exports = generateTokens;
