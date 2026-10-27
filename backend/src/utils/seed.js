// Seeds categories + the 15 curated lessons. SAFE TO RE-RUN: it upserts by a stable key and never deletes users.
//   npm run seed                      -> categories + lessons (+ copies the bundled lesson videos into /uploads)
//   npm run seed -- --demo            -> also creates demo student/creator accounts with a random password (printed once)
//   --reset-views zeroes every lesson's view counter (use once if old builds inflated them).
//   Old placeholder reels from the very first sample seed (external coverr.co URLs, random durations) are removed
//   automatically. Pass --keep-legacy to skip that.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const hash8 = (file) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 8);
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Reel = require("../models/Reel");
const { lessons, categories } = require("../seed/lessons");
const { VIDEO_DIR, THUMB_DIR } = require("./helpers");

const ASSETS = path.join(__dirname, "..", "..", "seed-assets");
let MANIFEST = {}; // real durations written by scripts/render-lesson-media.py
try { MANIFEST = require(path.join(ASSETS, "manifest.json")); } catch { /* falls back to 60 */ }
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const args = new Set(process.argv.slice(2));

// Deterministic shuffle (seeded by lesson key) so the correct option isn't always in the same slot,
// while re-running the seed always produces the same quiz.
const shuffleOptions = (key, qi, options, correct) => {
  let h = 0; for (const c of `${key}:${qi}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { options: idx.map((i) => options[i]), correctIndex: idx.indexOf(correct) };
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set. Copy backend/.env.example to backend/.env first.");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // 1. categories (upsert by name)
  const catByName = {};
  for (const c of categories) {
    catByName[c.name] = await Category.findOneAndUpdate({ name: c.name }, { $setOnInsert: { ...c, slug: slugify(c.name) } }, { upsert: true, new: true });
  }

  // 2. owner for seeded lessons: first admin, else a login-less "Tech Explainer Team" creator account
  let owner = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
  if (!owner) {
    owner = await User.findOne({ email: "team@techreels.local" }) ||
      await User.create({ name: "Tech Explainer Team", email: "team@techreels.local", password: crypto.randomBytes(24).toString("hex"), role: "creator" });
  }

  // 3. copy bundled media into the served uploads folder
  fs.mkdirSync(VIDEO_DIR, { recursive: true }); fs.mkdirSync(THUMB_DIR, { recursive: true });
  let created = 0, updated = 0, missingMedia = 0;
  for (const l of lessons) {
    const video = path.join(ASSETS, "videos", `${l.key}.mp4`);
    const thumb = path.join(ASSETS, "thumbnails", `${l.key}.jpg`);
    const hasMedia = fs.existsSync(video);
    // File names include a content hash: re-rendered videos get a NEW url, so browsers never replay a cached old file.
    const vName = hasMedia ? `seed-${l.key}-${hash8(video)}.mp4` : "";
    const tName = fs.existsSync(thumb) ? `seed-${l.key}-${hash8(thumb)}.jpg` : "";
    for (const [dir, prefix, keep] of [[VIDEO_DIR, `seed-${l.key}`, vName], [THUMB_DIR, `seed-${l.key}`, tName]]) {
      const own = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(-[0-9a-f]{8})?\\.(mp4|jpg)$`); // only this lesson's own earlier copies
      for (const f of fs.readdirSync(dir)) if (own.test(f) && f !== keep) fs.unlinkSync(path.join(dir, f));
    }
    if (hasMedia) fs.copyFileSync(video, path.join(VIDEO_DIR, vName));
    if (tName) fs.copyFileSync(thumb, path.join(THUMB_DIR, tName));
    if (!hasMedia) missingMedia++;

    const quiz = l.quiz.map(([question, options, correct, explanation], qi) => ({ question, explanation, ...shuffleOptions(l.key, qi, options, correct) }));
    const doc = {
      title: l.title, description: l.description, category: catByName[l.category]._id, skillLevel: l.level, tags: l.tags,
      transcript: l.transcript, learningObjective: l.objective, keyTakeaways: l.takeaways,
      interviewQA: l.qa.map(([question, answer]) => ({ question, answer })), quiz, quizCount: quiz.length,
      videoUrl: hasMedia ? `/uploads/videos/${vName}` : "", videoFile: hasMedia ? `/uploads/videos/${vName}` : "",
      thumbnailUrl: tName ? `/uploads/thumbnails/${tName}` : "",
      videoSource: hasMedia ? "generated-slides" : "none", duration: MANIFEST[l.key]?.duration || 60,
      status: "published", isPublished: true,
    };
    const existing = await Reel.findOne({ seedKey: l.key });
    if (existing) { Object.assign(existing, doc); await existing.save(); updated++; }
    else { await Reel.create({ ...doc, seedKey: l.key, uploadedBy: owner._id, views: 0 }); created++; }
  }
  console.log(`Lessons: ${created} created, ${updated} updated (${lessons.length} total).`);
  if (missingMedia) console.warn(`WARNING: ${missingMedia} lesson(s) have no media in backend/seed-assets - run: python3 scripts/render-lesson-media.py`);

  if (args.has("--reset-views")) { const r = await Reel.updateMany({}, { $set: { views: 0 } }); console.log(`View counters reset on ${r.modifiedCount ?? r.nModified ?? "all"} lesson(s).`); }

  // 4. optional cleanup of the old placeholder reels
  if (!args.has("--keep-legacy")) {
    const legacy = await Reel.find({ seedKey: { $exists: false }, videoUrl: /coverr\.co/ }).select("_id");
    const ids = legacy.map((x) => x._id);
    const [Comment, Progress, Bookmark, QuizResult, QuizSession] = ["Comment", "Progress", "Bookmark", "QuizResult", "QuizSession"].map((m) => require(`../models/${m}`));
    await Promise.all([Comment, Progress, Bookmark, QuizResult, QuizSession].map((M) => M.deleteMany({ reel: { $in: ids } })));
    const r = await Reel.deleteMany({ _id: { $in: ids } });
    if (r.deletedCount) console.log(`Removed ${r.deletedCount} legacy placeholder reel(s) with broken external videos.`);
  }

  // 5. optional demo accounts (random password, shown once; never hardcoded)
  if (args.has("--demo")) {
    const pw = crypto.randomBytes(9).toString("base64url");
    for (const [name, email, role] of [["Demo Student", "student@techreels.local", "user"], ["Demo Creator", "creator@techreels.local", "creator"]]) {
      if (await User.findOne({ email })) { console.log(`Demo account exists (password unchanged): ${email}`); continue; }
      await User.create({ name, email, password: pw, role });
      console.log(`Demo ${role === "user" ? "student" : role}: ${email}  password: ${pw}`);
    }
  }
  await mongoose.disconnect();
};

run().then(() => process.exit(0)).catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
