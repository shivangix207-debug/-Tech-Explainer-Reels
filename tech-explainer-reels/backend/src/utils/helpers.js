const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const isValidId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const VIDEO_DIR = path.join(UPLOAD_ROOT, "videos");
const THUMB_DIR = path.join(UPLOAD_ROOT, "thumbnails");
for (const dir of [UPLOAD_ROOT, VIDEO_DIR, THUMB_DIR]) fs.mkdirSync(dir, { recursive: true });

// Only locally-uploaded media paths (never arbitrary filesystem paths) are accepted from creators.
const LOCAL_VIDEO_RE = /^\/uploads\/videos\/[a-zA-Z0-9._-]+\.(mp4|webm|mov)$/;
const LOCAL_THUMB_RE = /^\/uploads\/thumbnails\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/;
const isLocalVideoUrl = (u) => typeof u === "string" && LOCAL_VIDEO_RE.test(u);
const isLocalThumbUrl = (u) => typeof u === "string" && LOCAL_THUMB_RE.test(u);
const isHttpUrl = (u) => {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; } catch { return false; }
};

// Delete files that live under /uploads (best effort). Never touches anything outside UPLOAD_ROOT.
const removeUploadedFile = (publicUrl) => {
  if (!isLocalVideoUrl(publicUrl) && !isLocalThumbUrl(publicUrl)) return;
  const abs = path.join(UPLOAD_ROOT, publicUrl.replace(/^\/uploads\//, ""));
  if (abs.startsWith(UPLOAD_ROOT + path.sep)) fs.promises.unlink(abs).catch(() => {});
};

// sha1 of a locally uploaded video (streamed, so large files don't load into memory). "" if not a local upload.
const hashUploadedFile = (publicUrl) => new Promise((resolve) => {
  if (!isLocalVideoUrl(publicUrl)) return resolve("");
  const abs = path.join(UPLOAD_ROOT, publicUrl.replace(/^\/uploads\//, ""));
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return resolve("");
  const h = require("crypto").createHash("sha1");
  fs.createReadStream(abs).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", () => resolve(""));
});

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

module.exports = {
  isValidId, escapeRegex, UPLOAD_ROOT, VIDEO_DIR, THUMB_DIR,
  isLocalVideoUrl, isLocalThumbUrl, isHttpUrl, removeUploadedFile, hashUploadedFile, httpError,
};
