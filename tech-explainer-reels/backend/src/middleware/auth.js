const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verifies JWT and attaches req.user. Required for protected routes.
const protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Not authorized, user not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized, token failed" });
  }
};

// Populates req.user if a valid token is present, but does not block the request.
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

// Restrict route to specific roles, e.g. authorize("admin")
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
  }
  next();
};

module.exports = { protect, optionalAuth, authorize };

// Is this reel visible to the public (published, or scheduled and due)?
const isPubliclyVisible = (reel) =>
  reel.status === "published" ||
  (reel.status === "scheduled" && reel.scheduledAt && reel.scheduledAt <= new Date()) ||
  (!reel.status && reel.isPublished);

// Public lessons are visible to everyone; anything else only to its owner or an admin.
const canViewReel = (reel, user) =>
  isPubliclyVisible(reel) ||
  (!!user && (user.role === "admin" || String(reel.uploadedBy?._id || reel.uploadedBy) === String(user._id)));

module.exports.isPubliclyVisible = isPubliclyVisible;
module.exports.canViewReel = canViewReel;
