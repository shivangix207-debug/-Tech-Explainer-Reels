// Integration tests: run against a real MongoDB (set MONGO_URI to a THROWAWAY database - it is dropped!).
//   MONGO_URI=mongodb://127.0.0.1:27017/ter_test JWT_SECRET=anything npm test
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_value_for_local_verification_only";
process.env.GEMINI_API_KEY = ""; // AI must fail gracefully without a key
process.env.MODERATION_AUDIT_RATE = "0"; // deterministic: no random spot-check sampling in tests
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI || !/test/i.test(MONGO_URI)) throw new Error("Set MONGO_URI to a throwaway DB whose name contains 'test' (it is dropped).");

const app = require("../src/app");
const User = require("../src/models/User");
const Category = require("../src/models/Category");
const Reel = require("../src/models/Reel");
const { validateQuiz } = require("../src/utils/aiService");
const { lessons, categories } = require("../src/seed/lessons");

let server, base;
const tokens = {};
const sampleVideo = path.join(__dirname, "..", "seed-assets", "videos", "js-closures.mp4");

const call = async (method, url, { token, body, form, headers = {} } = {}) => {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(base + url, { method, headers: h, body: payload });
  let json = null; try { json = await res.clone().json(); } catch {}
  return { status: res.status, json, res };
};
const signup = (name, extra = {}) => call("POST", "/api/auth/signup", { body: { name, email: `${name.toLowerCase().replace(/\s/g, "")}@t.test`, password: "Password123", ...extra } });

before(async () => {
  await mongoose.connect(MONGO_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Reel.init()]);
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;
  await User.create({ name: "Root Admin", email: "admin@t.test", password: "AdminPass1234", role: "admin" });
});
after(async () => { server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test("signup ignores a submitted role and only allows student/creator", async () => {
  const evil = await signup("Mallory", { role: "admin", isAdmin: true });
  assert.equal(evil.status, 201);
  assert.equal(evil.json.user.role, "user");
  const creator = await signup("Casey Creator", { accountType: "creator" });
  assert.equal(creator.json.user.role, "creator");
  const asAdminType = await signup("Eve", { accountType: "admin" });
  assert.equal(asAdminType.json.user.role, "user");
  tokens.student = evil.json.token; tokens.creator = creator.json.token;
  tokens.creator2 = (await signup("Other Creator", { accountType: "creator" })).json.token;
  const admin = await call("POST", "/api/auth/login", { body: { email: "admin@t.test", password: "AdminPass1234" } });
  assert.equal(admin.status, 200); tokens.admin = admin.json.token;
});

test("password rules, duplicate email and bad login are rejected", async () => {
  assert.equal((await call("POST", "/api/auth/signup", { body: { name: "A", email: "a@t.test", password: "short" } })).status, 400);
  assert.equal((await signup("Mallory")).status, 400); // duplicate
  assert.equal((await call("POST", "/api/auth/login", { body: { email: "admin@t.test", password: "wrong" } })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { body: { email: { $ne: "" }, password: { $ne: "" } } })).status, 400); // NoSQL operator injection
});

test("seed data: 15 lessons with valid, well-formed quizzes", () => {
  assert.equal(lessons.length, 15);
  for (const l of lessons) for (const q of l.quiz) { assert.equal(q[1].length, 4); assert.ok(q[2] >= 0 && q[2] < 4); }
});

let cat, pendingReelId, uploaded;
test("students cannot upload, create lessons or reach admin routes; anonymous gets 401", async () => {
  cat = await Category.create({ name: "Test Cat", slug: "test-cat" });
  const form = () => { const f = new FormData(); f.append("video", new Blob([fs.readFileSync(sampleVideo)], { type: "video/mp4" }), "x.mp4"); return f; };
  assert.equal((await call("POST", "/api/upload/video", { token: tokens.student, form: form() })).status, 403);
  assert.equal((await call("POST", "/api/upload/video", { form: form() })).status, 401);
  assert.equal((await call("POST", "/api/reels", { token: tokens.student, body: {} })).status, 403);
  assert.equal((await call("GET", "/api/admin/users", { token: tokens.student })).status, 403);
  assert.equal((await call("GET", "/api/admin/users", { token: tokens.creator })).status, 403);
  assert.equal((await call("GET", "/api/admin/users")).status, 401);
  assert.equal((await call("GET", "/api/admin/users", { token: tokens.admin })).status, 200);
});

test("upload validation: wrong type, fake content and empty requests are rejected", async () => {
  const bad = new FormData(); bad.append("video", new Blob(["MZ not a video"], { type: "application/x-msdownload" }), "virus.exe");
  assert.equal((await call("POST", "/api/upload/video", { token: tokens.creator, form: bad })).status, 415);
  const fake = new FormData(); fake.append("video", new Blob([Buffer.alloc(4096, 65)], { type: "video/mp4" }), "fake.mp4");
  assert.equal((await call("POST", "/api/upload/video", { token: tokens.creator, form: fake })).status, 415);
  assert.equal((await call("POST", "/api/upload/video", { token: tokens.creator, form: new FormData() })).status, 400);
});

test("creator uploads a real video; lesson starts pending and is hidden from the public", async () => {
  const f = new FormData(); f.append("video", new Blob([fs.readFileSync(sampleVideo)], { type: "video/mp4" }), "../../etc/passwd.mp4");
  const up = await call("POST", "/api/upload/video", { token: tokens.creator, form: f });
  assert.equal(up.status, 201, JSON.stringify(up.json));
  uploaded = up.json;
  assert.match(uploaded.videoUrl, /^\/uploads\/videos\/[0-9a-f-]{36}\.mp4$/); // client filename never used
  assert.ok(uploaded.duration >= 58 && uploaded.duration <= 62, "ffprobe duration detected");

  const create = await call("POST", "/api/reels", { token: tokens.creator, body: {
    title: "My Closures Lesson", description: "Creator-made lesson about closures.", category: String(cat._id), skillLevel: "intermediate",
    tags: "js, Closures", transcript: "closures remember scope", videoUrl: uploaded.videoUrl, thumbnailUrl: uploaded.thumbnailUrl, duration: uploaded.duration,
    status: "published" /* must be ignored for creators */ } });
  assert.equal(create.status, 201, JSON.stringify(create.json));
  assert.equal(create.json.reel.status, "pending");
  pendingReelId = create.json.reel._id;

  const list = await call("GET", "/api/reels");
  assert.ok(!list.json.reels.some((r) => r._id === pendingReelId));
  assert.equal((await call("GET", `/api/reels/${pendingReelId}`)).status, 404);
  assert.equal((await call("GET", `/api/reels/${pendingReelId}`, { token: tokens.student })).status, 404);
  assert.equal((await call("GET", `/api/reels/${pendingReelId}`, { token: tokens.creator })).status, 200);
  assert.equal((await call("GET", `/api/reels/${pendingReelId}`, { token: tokens.admin })).status, 200);
  assert.equal((await call("PUT", `/api/reels/${pendingReelId}/like`, { token: tokens.student })).status, 404);
  assert.equal((await call("POST", `/api/ai/chat/${pendingReelId}`, { token: tokens.student, body: { question: "hi" } })).status, 404);
  assert.equal((await call("POST", `/api/reels/${pendingReelId}/comments`, { token: tokens.student, body: { text: "hi" } })).status, 404);
  assert.equal((await call("POST", `/api/bookmarks/${pendingReelId}`, { token: tokens.student })).status, 404);
});

test("creators cannot edit or delete another creator's lesson; creators cannot self-publish", async () => {
  assert.equal((await call("PUT", `/api/reels/${pendingReelId}`, { token: tokens.creator2, body: { title: "Hijacked title" } })).status, 403);
  assert.equal((await call("DELETE", `/api/reels/${pendingReelId}`, { token: tokens.creator2 })).status, 403);
  assert.equal((await call("PUT", `/api/reels/${pendingReelId}/status`, { token: tokens.creator, body: { status: "published" } })).status, 404);
  assert.equal((await call("PUT", `/api/admin/reels/${pendingReelId}/status`, { token: tokens.creator, body: { status: "published" } })).status, 403);
  const own = await call("PUT", `/api/reels/${pendingReelId}`, { token: tokens.creator, body: { title: "My Closures Lesson (v2)", status: "published" } });
  assert.equal(own.status, 200); assert.equal(own.json.reel.status, "pending");
  // creators may only reference locally uploaded video, never arbitrary URLs/paths
  assert.equal((await call("PUT", `/api/reels/${pendingReelId}`, { token: tokens.creator, body: { videoUrl: "http://evil.example/x.mp4" } })).status, 400);
  assert.equal((await call("PUT", `/api/reels/${pendingReelId}`, { token: tokens.creator, body: { videoUrl: "/uploads/videos/../../.env" } })).status, 400);
});

test("admin approves -> lesson becomes public and the uploaded video streams with Range support", async () => {
  const mod = await call("PUT", `/api/admin/reels/${pendingReelId}/status`, { token: tokens.admin, body: { status: "published" } });
  assert.equal(mod.status, 200);
  assert.ok((await call("GET", "/api/reels")).json.reels.some((r) => r._id === pendingReelId));
  const detail = await call("GET", `/api/reels/${pendingReelId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.reel.quiz, undefined);
  const full = await fetch(base + uploaded.videoUrl);
  assert.equal(full.status, 200); assert.match(full.headers.get("content-type"), /video\/mp4/);
  const part = await fetch(base + uploaded.videoUrl, { headers: { Range: "bytes=0-99" } });
  assert.equal(part.status, 206); assert.equal((await part.arrayBuffer()).byteLength, 100);
  assert.equal(part.headers.get("cross-origin-resource-policy"), "cross-origin");
  const thumb = await fetch(base + uploaded.thumbnailUrl); assert.equal(thumb.status, 200);
});

test("likes and bookmarks persist and can never be duplicated", async () => {
  const a = await call("PUT", `/api/reels/${pendingReelId}/like`, { token: tokens.student });
  assert.deepEqual([a.json.liked, a.json.likeCount], [true, 1]);
  const b = await call("PUT", `/api/reels/${pendingReelId}/like`, { token: tokens.student });
  assert.deepEqual([b.json.liked, b.json.likeCount], [false, 0]);
  await Promise.all([1, 2, 3, 4].map(() => call("PUT", `/api/reels/${pendingReelId}/like`, { token: tokens.creator2 }))); // racing toggles
  const likes = (await Reel.findById(pendingReelId)).likes;
  assert.equal(new Set(likes.map(String)).size, likes.length);
  await Promise.all([1, 2, 3].map(() => call("POST", `/api/bookmarks/${pendingReelId}`, { token: tokens.student })));
  const bm = await call("GET", "/api/bookmarks", { token: tokens.student });
  assert.equal(bm.json.bookmarks.length, 1);
  await call("DELETE", `/api/bookmarks/${pendingReelId}`, { token: tokens.student });
  assert.equal((await call("GET", "/api/bookmarks", { token: tokens.student })).json.bookmarks.length, 0);
});

test("comments: validation, ownership and admin moderation", async () => {
  assert.equal((await call("POST", `/api/reels/${pendingReelId}/comments`, { token: tokens.student, body: { text: "   " } })).status, 400);
  assert.equal((await call("POST", `/api/reels/${pendingReelId}/comments`, { token: tokens.student, body: { text: "x".repeat(501) } })).status, 400);
  const c = await call("POST", `/api/reels/${pendingReelId}/comments`, { token: tokens.student, body: { text: "<b>Great</b> lesson" } });
  assert.equal(c.status, 201);
  const id = c.json.comment._id;
  assert.equal((await call("PUT", `/api/comments/${id}`, { token: tokens.creator2, body: { text: "edit" } })).status, 403);
  assert.equal((await call("DELETE", `/api/comments/${id}`, { token: tokens.creator2 })).status, 403);
  assert.equal((await call("DELETE", `/api/comments/${id}`, { token: tokens.admin })).status, 200);
});

test("search, filters, sorting, empty results and bad input", async () => {
  await Reel.create({ title: "Binary Trees", description: "Trees in depth, the data structure.", videoUrl: "/uploads/videos/a.mp4", category: cat._id, uploadedBy: (await User.findOne({ role: "admin" }))._id, tags: ["dsa"], skillLevel: "advanced", status: "published" });
  const q = async (s) => (await call("GET", `/api/reels?${s}`));
  assert.equal((await q("search=closures")).json.reels.length, 1);
  assert.equal((await q("search=DSA")).json.reels[0].title, "Binary Trees"); // tag search, case-insensitive
  assert.equal((await q("search=zzzznothing")).json.reels.length, 0);
  assert.equal((await q("skillLevel=advanced")).json.reels.length, 1);
  assert.equal((await q(`category=${cat._id}`)).json.reels.length, 2);
  assert.equal((await q("search=.*")).json.reels.length, 0); // regex metacharacters are escaped
  assert.equal((await q("skillLevel=expert")).status, 400);
  assert.equal((await q("category=notanid")).status, 400);
  assert.equal((await call("GET", "/api/reels/not-an-id")).status, 404);
});

test("views: opening a lesson never counts; real playback counts once per viewer, even under parallel requests", async () => {
  const views = async () => (await Reel.findById(pendingReelId)).views;
  const before = await views();
  for (let i = 0; i < 3; i++) await call("GET", `/api/reels/${pendingReelId}`, { token: tokens.student });
  assert.equal(await views(), before, "GET must not change the counter");
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => call("POST", `/api/reels/${pendingReelId}/view`, { token: tokens.student })));
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(await views(), before + 1, "five parallel plays by one user = one view");
  await call("POST", `/api/reels/${pendingReelId}/view`, { token: tokens.student });
  assert.equal(await views(), before + 1);
  await call("POST", `/api/reels/${pendingReelId}/view`, { token: tokens.creator2 });
  assert.equal(await views(), before + 2, "a different viewer counts");
  assert.equal((await call("POST", "/api/reels/not-an-id/view")).status, 404);
});

test("progress: completion is decided by the server (>= 90% watched)", async () => {
  const early = await call("PUT", `/api/reels/${pendingReelId}/progress`, { token: tokens.student, body: { watchedSeconds: 5, completed: true } });
  assert.equal(early.json.progress.completed, false);
  assert.equal((await call("PUT", `/api/reels/${pendingReelId}/progress`, { token: tokens.student, body: { watchedSeconds: -4 } })).status, 400);
  const done = await call("PUT", `/api/reels/${pendingReelId}/progress`, { token: tokens.student, body: { watchedSeconds: 57 } });
  assert.equal(done.json.progress.completed, true);
  assert.equal(done.json.gamification.xpGained, 10);
  const again = await call("PUT", `/api/reels/${pendingReelId}/progress`, { token: tokens.student, body: { watchedSeconds: 1 } });
  assert.equal(again.json.progress.completed, true); assert.equal(again.json.gamification, null); // no XP farming
  const dash = await call("GET", "/api/dashboard", { token: tokens.student });
  assert.equal(dash.json.stats.reelsWatched, 1);
});

test("quiz: answer key never reaches the client, grading is server-side, sessions are single-use", async () => {
  const l = lessons[0];
  const { shuffle } = {};
  const seed = require("child_process");
  // create a curated lesson directly (same shape the seed script writes)
  const reel = await Reel.create({ title: l.title, description: l.description, videoUrl: "/uploads/videos/a.mp4", category: cat._id, uploadedBy: (await User.findOne({ role: "admin" }))._id, status: "published",
    quiz: l.quiz.map(([question, options, correctIndex, explanation]) => ({ question, options, correctIndex, explanation })), quizCount: 4 });
  const start = await call("POST", `/api/ai/quiz/${reel._id}`, { token: tokens.student, body: { source: "lesson" } });
  assert.equal(start.status, 200);
  assert.ok(!JSON.stringify(start.json).includes("correctIndex") && !JSON.stringify(start.json).includes("explanation"));
  assert.equal(start.json.questions.length, 4);
  const perfect = l.quiz.map((q) => q[2]);
  const sub = await call("POST", `/api/ai/quiz/${reel._id}/submit`, { token: tokens.student, body: { sessionId: start.json.sessionId, answers: perfect, correctAnswer: "client cheating" } });
  assert.equal(sub.status, 201);
  assert.equal(sub.json.result.score, 4); assert.equal(sub.json.result.percentage, 100);
  assert.ok(sub.json.review.every((r) => r.isCorrect && r.explanation));
  assert.equal((await call("POST", `/api/ai/quiz/${reel._id}/submit`, { token: tokens.student, body: { sessionId: start.json.sessionId, answers: perfect } })).status, 409); // replay
  // someone else's session cannot be submitted
  const s2 = await call("POST", `/api/ai/quiz/${reel._id}`, { token: tokens.student, body: { source: "lesson" } });
  assert.equal((await call("POST", `/api/ai/quiz/${reel._id}/submit`, { token: tokens.creator2, body: { sessionId: s2.json.sessionId, answers: perfect } })).status, 409);
  const wrong = await call("POST", `/api/ai/quiz/${reel._id}/submit`, { token: tokens.student, body: { sessionId: s2.json.sessionId, answers: [null, 0, 0, 0] } });
  assert.equal(wrong.json.result.score, perfect.filter((c, i) => i > 0 && c === 0).length);
  assert.equal(wrong.json.gamification, null); // XP only on the first attempt
});

test("AI endpoints fail honestly (no fake results) when Gemini is not configured", async () => {
  assert.equal((await call("POST", `/api/ai/chat/${pendingReelId}`, { token: tokens.student, body: { question: "   " } })).status, 400);
  const chat = await call("POST", `/api/ai/chat/${pendingReelId}`, { token: tokens.student, body: { question: "What is a closure?" } });
  assert.equal(chat.status, 503); assert.match(chat.json.message, /not configured/i); assert.equal(chat.json.answer, undefined);
  assert.equal((await call("POST", `/api/ai/quiz/${pendingReelId}`, { token: tokens.student, body: { source: "ai" } })).status, 503);
  assert.equal((await call("POST", `/api/ai/notes/${pendingReelId}`, { token: tokens.student })).status, 503); // no takeaways -> no fallback
  assert.equal((await call("POST", `/api/ai/chat/${pendingReelId}`)).status, 401);
});

test("notes fall back to clearly-labelled lesson content when AI is unavailable", async () => {
  const r = await Reel.create({ title: "Has Takeaways", description: "A lesson that has takeaways stored.", videoUrl: "/uploads/videos/a.mp4", category: cat._id, uploadedBy: (await User.findOne({ role: "admin" }))._id, status: "published", keyTakeaways: ["Point one", "Point two"] });
  const n = await call("POST", `/api/ai/notes/${r._id}`, { token: tokens.student });
  assert.equal(n.status, 200); assert.equal(n.json.source, "lesson"); assert.match(n.json.notice, /unavailable/i);
});

test("validateQuiz rejects malformed model output", () => {
  const good = { question: "Q?", options: ["a", "b", "c", "d"], correctIndex: 2, explanation: "because" };
  assert.equal(validateQuiz([good, good, good], 3).length, 3);
  assert.throws(() => validateQuiz("not json", 3));
  assert.throws(() => validateQuiz([{ ...good, correctIndex: 7 }, { ...good, options: ["a", "a", "b", "c"] }, { ...good, explanation: "" }], 3));
  assert.equal(validateQuiz([good, good, good, { ...good, correctIndex: 9 }], 5).length, 3);
});

test("admin guards: no self-demotion, role validation, analytics reflect real data", async () => {
  const me = await User.findOne({ email: "admin@t.test" });
  assert.equal((await call("PUT", `/api/admin/users/${me._id}`, { token: tokens.admin, body: { role: "user" } })).status, 400);
  assert.equal((await call("PUT", `/api/admin/users/${me._id}`, { token: tokens.admin, body: { isActive: false } })).status, 400);
  assert.equal((await call("DELETE", `/api/admin/users/${me._id}`, { token: tokens.admin })).status, 400);
  const stu = await User.findOne({ email: "mallory@t.test" });
  assert.equal((await call("PUT", `/api/admin/users/${stu._id}`, { token: tokens.admin, body: { role: "superuser" } })).status, 400);
  assert.equal((await call("PUT", `/api/admin/users/${stu._id}`, { token: tokens.admin, body: { role: "creator" } })).json.user.role, "creator");
  const a = await call("GET", "/api/admin/analytics", { token: tokens.admin });
  assert.equal(a.json.totals.totalUsers, await User.countDocuments());
  assert.equal(a.json.totals.totalReels, await Reel.countDocuments());
  assert.equal(a.json.usersByRole.admin, 1);
});


// ---------------------------------------------------------------- moderation at scale
const uploadVideo = async (token) => {
  const f = new FormData(); f.append("video", new Blob([fs.readFileSync(sampleVideo)], { type: "video/mp4" }), "v.mp4");
  const r = await call("POST", "/api/upload/video", { token, form: f }); assert.equal(r.status, 201); return r.json;
};
const lessonBody = (up, over = {}) => ({ title: "Intro to Recursion Basics", description: "A short lesson that explains recursion step by step.", category: String(cat._id),
  transcript: "Recursion is when a function calls itself with a smaller problem until it reaches a base case, then results combine on the way back up.",
  videoUrl: up.videoUrl, thumbnailUrl: up.thumbnailUrl, duration: up.duration, ...over });

test("moderation: blocked content is rejected automatically, with a reason the creator can act on", async () => {
  const up = await uploadVideo(tokens.creator2);
  const r = await call("POST", "/api/reels", { token: tokens.creator2, body: lessonBody(up, { description: "Win big at our online casino, free robux inside!" }) });
  assert.equal(r.status, 201);
  assert.equal(r.json.reel.status, "rejected"); assert.equal(r.json.reel.autoDecision, "auto-rejected");
  assert.match(r.json.reel.rejectionReason, /Automatically rejected/);
  // fixing it re-runs screening and moves it on to review instead of leaving it stuck
  const fix = await call("PUT", `/api/reels/${r.json.reel._id}`, { token: tokens.creator2, body: { description: "Fixed: a clean description about recursion." } });
  assert.equal(fix.json.reel.status, "pending");
});

test("moderation: spam signals and duplicate videos raise the risk score and go to a human", async () => {
  const up = await uploadVideo(tokens.creator2);
  const spam = await call("POST", "/api/reels", { token: tokens.creator2, body: lessonBody(up, { title: "CLICK HERE NOW FOR FREE STUFF", transcript: "", description: "http://a.example http://b.example http://c.example subscribe to my channel" }) });
  assert.equal(spam.json.reel.status, "pending"); assert.equal(spam.json.reel.autoDecision, "needs-review");
  assert.ok(spam.json.reel.risk >= 40 && spam.json.reel.moderationNotes.length >= 3);
  // same video file as an existing lesson (the first creator's published one) => flagged as duplicate
  const up2 = await uploadVideo(tokens.creator2);
  const dup = await call("POST", "/api/reels", { token: tokens.creator2, body: lessonBody(up2, { title: "Another recursion lesson" }) });
  assert.ok(dup.json.reel.moderationNotes.some((n) => /identical video/.test(n)), JSON.stringify(dup.json.reel.moderationNotes));
  assert.equal(dup.json.reel.status, "pending");
});

test("moderation: a clean upload from a new creator waits in the queue with a LOW risk; admin approves all clean in one click", async () => {
  const up = await (async () => { const f = new FormData(); f.append("video", new Blob([Buffer.concat([fs.readFileSync(sampleVideo), Buffer.from("x1")])], { type: "video/mp4" }), "u.mp4"); return (await call("POST", "/api/upload/video", { token: tokens.creator, form: f })).json; })();
  const r = await call("POST", "/api/reels", { token: tokens.creator, body: lessonBody(up, { title: "Binary search walkthrough" }) });
  assert.equal(r.json.reel.status, "pending"); assert.equal(r.json.reel.autoDecision, "clean-pending"); assert.ok(r.json.reel.risk < 40);
  assert.equal((await call("POST", "/api/admin/reels/approve-clean", { token: tokens.creator })).status, 403);
  const flaggedBefore = (await call("GET", "/api/admin/reels?flagged=1", { token: tokens.admin })).json.reels;
  assert.ok(flaggedBefore.every((x) => x.risk >= 40 || x.reportCount > 0) && !flaggedBefore.some((x) => x._id === r.json.reel._id));
  const queue = (await call("GET", "/api/admin/reels?status=pending", { token: tokens.admin })).json.reels;
  assert.ok(queue.every((x, i) => i === 0 || queue[i - 1].risk >= x.risk), "queue is sorted riskiest first");
  const ok = await call("POST", "/api/admin/reels/approve-clean", { token: tokens.admin });
  assert.ok(ok.json.approved >= 1);
  assert.equal((await Reel.findById(r.json.reel._id)).status, "published");
  assert.ok((await Reel.find({ status: "pending" })).every((x) => x.risk >= 40 || x.reportCount > 0), "only flagged lessons are left for a human");
});

test("moderation: trusted creators (admin-granted or earned) publish clean uploads instantly", async () => {
  // earned: 3 published lessons and no rejections
  const earned = await signup("Earned Trust", { accountType: "creator" });
  const owner = await User.findOne({ email: "earnedtrust@t.test" });
  for (let i = 0; i < 3; i++) await Reel.create({ title: `Track record ${i}`, description: "An approved earlier lesson for trust.", videoUrl: "/uploads/videos/a.mp4", category: cat._id, uploadedBy: owner._id, status: "published" });
  const up = await uploadVideo(earned.json.token).then(async () => { const f = new FormData(); f.append("video", new Blob([Buffer.concat([fs.readFileSync(sampleVideo), Buffer.from("x2")])], { type: "video/mp4" }), "e.mp4"); return (await call("POST", "/api/upload/video", { token: earned.json.token, form: f })).json; });
  const r = await call("POST", "/api/reels", { token: earned.json.token, body: lessonBody(up, { title: "Sorting algorithms compared" }) });
  assert.equal(r.json.reel.status, "published"); assert.equal(r.json.reel.autoDecision, "auto-approved");
  assert.equal((await call("GET", "/api/reels/mine", { token: earned.json.token })).json.trust.trusted, true);
  // ...but spam is still stopped even for trusted creators
  const up2 = await (async () => { const f = new FormData(); f.append("video", new Blob([Buffer.concat([fs.readFileSync(sampleVideo), Buffer.from("x3")])], { type: "video/mp4" }), "e.mp4"); return (await call("POST", "/api/upload/video", { token: earned.json.token, form: f })).json; })();
  const bad = await call("POST", "/api/reels", { token: earned.json.token, body: lessonBody(up2, { description: "free robux and crypto giveaway" }) });
  assert.equal(bad.json.reel.status, "rejected");
  // admin-granted trust
  const c2 = await User.findOne({ email: "othercreator@t.test" });
  assert.equal((await call("PUT", `/api/admin/users/${c2._id}`, { token: tokens.admin, body: { trusted: true } })).json.user.trusted, true);
  assert.equal((await call("PUT", `/api/admin/users/${c2._id}`, { token: tokens.creator, body: { trusted: false } })).status, 403);
});

test("reports: 3 different users hide a lesson automatically; admin can clear it", async () => {
  const owner = await User.findOne({ email: "casey creator".replace(" ", "") + "@t.test" });
  const reel = await Reel.create({ title: "Reportable lesson", description: "A published lesson people may report.", videoUrl: "/uploads/videos/a.mp4", category: cat._id, uploadedBy: owner._id, status: "published" });
  const reporters = [(await signup("Rep One")).json.token, (await signup("Rep Two")).json.token, (await signup("Rep Three")).json.token];
  assert.equal((await call("POST", `/api/reels/${reel._id}/report`, { token: reporters[0], body: { reason: "nonsense" } })).status, 400);
  assert.equal((await call("POST", `/api/reels/${reel._id}/report`, { token: tokens.creator, body: { reason: "spam" } })).status, 400); // own lesson
  assert.equal((await call("POST", `/api/reels/${reel._id}/report`, { body: { reason: "spam" } })).status, 401);
  const a = await call("POST", `/api/reels/${reel._id}/report`, { token: reporters[0], body: { reason: "spam" } });
  assert.equal(a.status, 201); assert.equal(a.json.hidden, false);
  const dupe = await call("POST", `/api/reels/${reel._id}/report`, { token: reporters[0], body: { reason: "spam" } });
  assert.equal(dupe.json.alreadyReported, true);
  assert.equal((await Reel.findById(reel._id)).reportCount, 1, "same user cannot report twice");
  await call("POST", `/api/reels/${reel._id}/report`, { token: reporters[1], body: { reason: "misleading" } });
  const third = await call("POST", `/api/reels/${reel._id}/report`, { token: reporters[2], body: { reason: "inappropriate" } });
  assert.equal(third.json.hidden, true);
  const hiddenReel = await Reel.findById(reel._id);
  assert.equal(hiddenReel.status, "pending"); assert.ok(hiddenReel.risk >= 70);
  assert.equal((await call("GET", `/api/reels/${reel._id}`, { token: tokens.student })).status, 404, "hidden from students");
  const flagged = (await call("GET", "/api/admin/reels?flagged=1", { token: tokens.admin })).json.reels;
  assert.ok(flagged.some((x) => x._id === String(reel._id) && x.reportCount === 3), "reported lesson is in the flagged queue");
  assert.ok(flagged.every((x, i) => i === 0 || flagged[i - 1].risk >= x.risk), "flagged queue is riskiest-first");
  assert.equal((await call("POST", "/api/admin/reels/approve-clean", { token: tokens.admin })).json.approved >= 0, true);
  assert.equal((await Reel.findById(reel._id)).status, "pending", "approve-clean never publishes reported lessons");
  await call("PUT", `/api/admin/reels/${reel._id}/status`, { token: tokens.admin, body: { status: "published" } });
  const cleared = await Reel.findById(reel._id);
  assert.equal(cleared.status, "published"); assert.equal(cleared.reportCount, 0);
});

test("moderation: spot-check queue and analytics are real", async () => {
  const owner = await User.findOne({ role: "creator" });
  const r = await Reel.create({ title: "Spot check me", description: "Auto approved and sampled for audit.", videoUrl: "/uploads/videos/a.mp4", category: cat._id, uploadedBy: owner._id, status: "published", autoDecision: "auto-approved", needsAudit: true });
  const list = await call("GET", "/api/admin/reels?spotcheck=1", { token: tokens.admin });
  assert.ok(list.json.reels.some((x) => x._id === String(r._id)));
  const a = (await call("GET", "/api/admin/analytics", { token: tokens.admin })).json.totals;
  assert.equal(a.autoApproved, await Reel.countDocuments({ autoDecision: "auto-approved" })); assert.ok(a.spotChecks >= 1);
  await call("PUT", `/api/admin/reels/${r._id}/status`, { token: tokens.admin, body: { status: "published" } });
  assert.equal((await Reel.findById(r._id)).needsAudit, false, "reviewing clears the spot-check flag");
});

test("deleting a lesson removes its file and related records", async () => {
  const f = path.join(__dirname, "..", uploaded.videoUrl);
  assert.ok(fs.existsSync(f));
  assert.equal((await call("DELETE", `/api/reels/${pendingReelId}`, { token: tokens.creator })).status, 200);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!fs.existsSync(f));
  assert.equal((await call("GET", `/api/reels/${pendingReelId}`, { token: tokens.admin })).status, 404);
});

test("error responses never include stack traces", async () => {
  const r = await call("POST", "/api/auth/login", { headers: { "Content-Type": "application/json" }, body: undefined });
  assert.ok(!JSON.stringify(r.json || {}).includes("at "));
  const bad = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad json" });
  assert.equal(bad.status, 400); assert.equal((await bad.json()).stack, undefined);
});
