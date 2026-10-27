const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { asyncHandler } = require("../middleware/errorHandler");
const { VIDEO_DIR, THUMB_DIR, httpError } = require("../utils/helpers");

const execFileAsync = promisify(execFile);
const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 100;
const ALLOWED = { ".mp4": ["video/mp4"], ".webm": ["video/webm"], ".mov": ["video/quicktime", "video/mp4"] };

// Multipart upload straight to disk (no buffering whole file in memory). The stored name is a random
// UUID plus a whitelisted extension; the client-supplied filename is never used for the path.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) {
      return cb(httpError(415, "Unsupported file type. Please upload an MP4, WebM or MOV video."));
    }
    cb(null, true);
  },
}).single("video");

// Content sniffing: confirm the bytes really look like the claimed container, not just the extension.
const looksLikeVideo = async (filePath, ext) => {
  const fh = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    if (ext === ".webm") return buf.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    return buf.slice(4, 8).toString("latin1") === "ftyp"; // mp4 / mov
  } finally { await fh.close(); }
};

// Runs multer and converts its errors into clean 4xx JSON responses.
const handleUpload = (req, res) =>
  new Promise((resolve, reject) =>
    upload(req, res, (err) => {
      if (!err) return resolve();
      if (err.code === "LIMIT_FILE_SIZE") return reject(httpError(413, `Video is too large. Maximum size is ${MAX_MB} MB.`));
      if (err instanceof multer.MulterError) return reject(httpError(400, `Upload error: ${err.message}`));
      reject(err);
    })
  );

// @route POST /api/upload/video  (creator|admin)  multipart/form-data, field "video"
const uploadVideo = asyncHandler(async (req, res) => {
  await handleUpload(req, res);
  if (!req.file) throw httpError(400, "No video file received (use form field \"video\")");

  const filePath = req.file.path;
  const ext = path.extname(req.file.filename).toLowerCase();
  const discard = () => fs.promises.unlink(filePath).catch(() => {});

  if (req.file.size < 1024 || !(await looksLikeVideo(filePath, ext))) {
    await discard();
    throw httpError(415, "That file doesn't look like a valid video.");
  }

  const base = path.basename(req.file.filename, ext);
  const thumbName = `${base}.jpg`;
  const thumbPath = path.join(THUMB_DIR, thumbName);

  // ffprobe/ffmpeg are optional: without them we still accept the upload, just without
  // auto-detected duration and thumbnail (the creator can enter the duration manually).
  let duration = null;
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], { timeout: 20000 });
    const d = parseFloat(stdout.trim());
    if (d > 0) duration = Math.max(1, Math.round(d));
  } catch { /* ffprobe not installed or failed */ }

  try {
    await execFileAsync("ffmpeg", ["-y", "-ss", duration && duration > 2 ? "1" : "0", "-i", filePath, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", thumbPath], { timeout: 30000 });
  } catch { /* thumbnail is best-effort */ }

  res.status(201).json({
    success: true,
    videoUrl: `/uploads/videos/${req.file.filename}`,
    thumbnailUrl: fs.existsSync(thumbPath) ? `/uploads/thumbnails/${thumbName}` : "",
    duration, // null when it could not be detected
    sizeBytes: req.file.size,
    originalName: req.file.originalname,
  });
});

module.exports = { uploadVideo, MAX_MB };
