const jwt = require("jsonwebtoken");

// VERIFY TOKEN
const protect = (req, res, next) => {
try {
let token = req.headers.authorization;


    if (!token) {
        return res.status(401).json({ msg: "No token, access denied" });
    }

    // Format: Bearer TOKEN
    token = token.split(" ")[1];

    const decoded = jwt.verify(token, "SECRET_KEY");

    req.user = decoded;

    next();

} catch (err) {
    res.status(401).json({ msg: "Invalid token" });
}


};

// ROLE-BASED ACCESS CONTROL
const authorize = (...roles) => {
return (req, res, next) => {
if (!req.user || !roles.includes(req.user.role)) {
return res.status(403).json({ msg: "Access denied" });
}
next();
};
};

module.exports = { protect, authorize };
