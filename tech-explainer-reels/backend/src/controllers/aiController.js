const Reel = require("../models/Reel");
const QuizResult = require("../models/QuizResult");
const QuizSession = require("../models/QuizSession");
const { askChatbot, streamChatbot, generateNotes, generateQuiz, generateCaptions, lessonNotes } = require("../utils/aiService");
const { asyncHandler } = require("../middleware/errorHandler");
const { canViewReel } = require("../middleware/auth");
const { isValidId, httpError } = require("../utils/helpers");
const { registerDailyActivity, addXp, evaluateBadges, XP_QUIZ_ATTEMPT, XP_QUIZ_PASS_BONUS } = require("../utils/gamification");

// Loads a lesson the caller is allowed to see (published, or their own / admin).
const getReelOr404 = async (req, extra = "") => {
  if (!isValidId(req.params.reelId)) throw httpError(404, "Reel not found");
  const reel = await Reel.findById(req.params.reelId).select(extra).populate("category", "name");
  if (!reel || !canViewReel(reel, req.user)) throw httpError(404, "Reel not found");
  return reel;
};

// @route POST /api/ai/chat/:reelId  { question, history? }
const chat = asyncHandler(async (req, res) => {
  const reel = await getReelOr404(req);
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
  if (!question) throw httpError(400, "Please type a question first");
  if (question.length > 1000) throw httpError(400, "Questions are limited to 1000 characters");

  const history = (Array.isArray(req.body.history) ? req.body.history : [])
    .filter((h) => h && typeof h.text === "string" && h.text.trim())
    .slice(-10).map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", text: h.text.slice(0, 2000) }));

  const answer = await askChatbot(reel, question, history);
  res.json({ success: true, answer });
});

// @route POST /api/ai/chat/:reelId/stream  { question, history? }  -> Server-Sent Events
//   data: {"t":"text piece"}  ...  data: {"done":true}      (or  event: error / data: {"message": "..."} )
const chatStream = asyncHandler(async (req, res) => {
  const reel = await getReelOr404(req);
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
  if (!question) throw httpError(400, "Please type a question first");
  if (question.length > 1000) throw httpError(400, "Questions are limited to 1000 characters");
  const history = (Array.isArray(req.body.history) ? req.body.history : [])
    .filter((h) => h && typeof h.text === "string" && h.text.trim())
    .slice(-6).map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", text: h.text.slice(0, 1500) }));

  // Validation errors above are normal JSON responses. From here on we stream.
  const t0 = Date.now();
  const gen = streamChatbot(reel, question, history);
  // Pulling the first chunk BEFORE sending headers means "not configured"/provider errors become a proper HTTP status.
  const first = await gen.next();
  if (process.env.NODE_ENV !== "test") console.log(`[ai] tutor first token after ${Date.now() - t0} ms`); // tells you if slowness is the model or something else

  res.status(200).set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  let closed = false;
  res.on("close", () => { closed = true; });
  const send = (obj, event) => res.write(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(obj)}\n\n`);
  try {
    if (!first.done) send({ t: first.value });
    while (!closed) {
      const n = await gen.next();
      if (n.done) break;
      send({ t: n.value });
    }
    if (!closed) send({ done: true });
  } catch (err) {
    if (!closed) send({ message: err.message || "The AI service failed." }, "error");
  }
  res.end();
});

// @route POST /api/ai/notes/:reelId
// If Gemini fails but the lesson has its own takeaways, return those, explicitly labelled (source: "lesson").
const notes = asyncHandler(async (req, res) => {
  const reel = await getReelOr404(req);
  try {
    res.json({ success: true, source: "ai", notes: await generateNotes(reel) });
  } catch (err) {
    if (reel.keyTakeaways?.length) {
      return res.json({ success: true, source: "lesson", notice: `AI notes are unavailable (${err.message}) - showing the lesson's built-in notes instead.`, notes: lessonNotes(reel) });
    }
    throw err;
  }
});

const publicQuestions = (qs) => qs.map((q) => ({ question: q.question, options: q.options }));

// @route POST /api/ai/quiz/:reelId  { source: "lesson"|"ai", questionCount? }
// Creates a single-use quiz session; the answer key stays on the server.
const quiz = asyncHandler(async (req, res) => {
  const source = req.body.source === "ai" ? "ai" : "lesson";
  const reel = await getReelOr404(req, source === "lesson" ? "+quiz" : "");
  let questions;
  if (source === "lesson") {
    questions = (reel.quiz || []).map((q) => ({ question: q.question, options: [...q.options], correctIndex: q.correctIndex, explanation: q.explanation }));
    if (questions.length === 0) throw httpError(404, "This lesson has no built-in quiz yet. Try \"Generate with AI\".");
  } else {
    const n = Math.min(Math.max(parseInt(req.body.questionCount) || 5, 3), 10);
    questions = await generateQuiz(reel, n);
  }
  const session = await QuizSession.create({ user: req.user._id, reel: reel._id, source, questions });
  res.json({ success: true, sessionId: session._id, source, questions: publicQuestions(questions) });
});

// @route POST /api/ai/quiz/:reelId/submit  { sessionId, answers: [index|null] }
// Grading happens here, against the stored key - never against anything the client sends.
const submitQuiz = asyncHandler(async (req, res) => {
  const { sessionId, answers } = req.body;
  if (!isValidId(req.params.reelId) || !isValidId(sessionId) || !Array.isArray(answers)) throw httpError(400, "sessionId and answers are required");

  const session = await QuizSession.findOneAndUpdate(
    { _id: sessionId, user: req.user._id, reel: req.params.reelId, used: false }, { used: true }, { new: true }
  );
  if (!session) throw httpError(409, "This quiz has expired or was already submitted. Start a new one.");

  const review = session.questions.map((q, i) => {
    const sel = Number.isInteger(answers[i]) && answers[i] >= 0 && answers[i] < q.options.length ? answers[i] : null;
    return { question: q.question, options: q.options, selectedIndex: sel, correctIndex: q.correctIndex, isCorrect: sel === q.correctIndex, explanation: q.explanation };
  });
  const score = review.filter((r) => r.isCorrect).length;
  const total = review.length;
  const percentage = Math.round((score / total) * 100);

  const prior = await QuizResult.countDocuments({ user: req.user._id, reel: session.reel, source: session.source });
  const result = await QuizResult.create({
    user: req.user._id, reel: session.reel, source: session.source, score, totalQuestions: total, percentage,
    questions: review.map((r) => ({ question: r.question, type: "mcq", options: r.options, correctIndex: r.correctIndex, correctAnswer: r.options[r.correctIndex], selectedIndex: r.selectedIndex, userAnswer: r.selectedIndex === null ? "" : r.options[r.selectedIndex], isCorrect: r.isCorrect, explanation: r.explanation })),
  });

  // XP only for the first attempt per lesson+quiz type, so retaking can't farm points.
  let gamification = null;
  if (prior === 0) {
    const user = req.user;
    registerDailyActivity(user);
    const xpGained = XP_QUIZ_ATTEMPT + (percentage >= 80 ? XP_QUIZ_PASS_BONUS : 0);
    addXp(user, xpGained);
    const newBadges = await evaluateBadges(user);
    await user.save();
    gamification = { xpGained, xp: user.xp, level: user.level, streak: user.streak, newBadges };
  }
  res.status(201).json({ success: true, result: { _id: result._id, score, totalQuestions: total, percentage }, review, gamification });
});

// @route POST /api/ai/captions/:reelId (owner|admin only - it writes to the lesson)
const captions = asyncHandler(async (req, res) => {
  const reel = await getReelOr404(req);
  if (req.user.role !== "admin" && String(reel.uploadedBy) !== String(req.user._id)) throw httpError(403, "Only the lesson owner can generate captions");
  const captionText = await generateCaptions(reel);
  reel.captions = captionText;
  await reel.save();
  res.json({ success: true, captions: captionText });
});

module.exports = { chat, chatStream, notes, quiz, submitQuiz, captions };
