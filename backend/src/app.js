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

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // allow <video>/<img> from the frontend origin
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" })); // videos use multipart upload, not JSON
app.use(express.urlencoded({ extended: true }));

// Serve uploaded video/thumbnail files
const path = require("path");
// Static serving supports HTTP Range requests, which the browser needs for seeking in <video>.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads"), { index: false, dotfiles: "deny", maxAge: 0, etag: true }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Basic rate limiting, tighter on AI routes since they call an external API
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
app.use("/api", generalLimiter);
app.use("/api/ai", aiLimiter);

app.get("/api/health", (req, res) => res.json({ success: true, message: "API is healthy" }));

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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
