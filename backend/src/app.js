
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const reelRoutes = require("./routes/reelRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const commentRoutes = require("./routes/commentRoutes");
const bookmarkRoutes = require("./routes/bookmarkRoutes");
const aiRoutes = require("./routes/aiRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const socialRoutes = require("./routes/socialRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration: local development + deployed frontends
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://tech-explainer-reels-pu9o.vercel.app",
  "https://tech-explainer-reels-pu9o-64td9ppp0-shivangi-c3ac.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true,
  })
);

// Request body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded video and thumbnail files
const path = require("path");

app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    index: false,
    dotfiles: "deny",
    maxAge: 0,
    etag: true,
  })
);

// HTTP request logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
});

app.use("/api", generalLimiter);
app.use("/api/ai", aiLimiter);

// Health check
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    message: "API is healthy",
  })
);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/reels", reelRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/reels/:reelId/comments", commentRoutes);
app.use("/api/comments", commentRoutes.standalone);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/upload", uploadRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
