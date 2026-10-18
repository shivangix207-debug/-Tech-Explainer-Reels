const { GoogleGenAI } = require("@google/genai");
const { httpError } = require("./helpers");

// Rolling alias that Google keeps pointed at the current Flash model; override with GEMINI_MODEL.
const MODEL_NAME = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

let client = null;
let clientKey = null;
const getClient = () => {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key || key === "your_gemini_api_key_here") return null;
  if (!client || clientKey !== key) { client = new GoogleGenAI({ apiKey: key }); clientKey = key; }
  return client;
};

const requireClient = () => {
  const ai = getClient();
  if (!ai) throw httpError(503, "The AI features are not configured on this server (missing GEMINI_API_KEY).");
  return ai;
};

// Never leak provider error details/keys to the browser; log them on the server instead.
const wrapAiError = (err) => {
  if (err?.statusCode) return err;
  console.error("[gemini]", err?.status || "", err?.message || err);
  const status = Number(err?.status);
  if (status === 429) return httpError(429, "The AI service is rate-limited right now. Please try again in a minute.");
  if (status === 400 || status === 401 || status === 403) return httpError(502, "The AI service rejected the request. Check the server's GEMINI_API_KEY.");
  return httpError(502, "The AI service is temporarily unavailable. Please try again.");
};

const buildReelContext = (reel) => `
Lesson title: ${reel.title}
Category: ${reel.category?.name || "General Tech"}
Difficulty: ${reel.skillLevel || "beginner"}
Description: ${reel.description}
${reel.learningObjective ? `Learning objective: ${reel.learningObjective}\n` : ""}Transcript: ${reel.transcript || "Not provided - rely only on the title and description and say so if unsure."}
${reel.keyTakeaways?.length ? `Key takeaways: ${reel.keyTakeaways.join(" | ")}` : ""}
`.trim();

// Tolerates ```json fences and stray prose around the JSON.
const parseJsonResponse = (text) => {
  let t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.search(/[\[{]/);
  const end = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (start === -1 || end === -1) throw new Error("No JSON found in model output");
  return JSON.parse(t.slice(start, end + 1));
};

const run = async (fn) => { try { return await fn(); } catch (e) { throw wrapAiError(e); } };

// ---------- 1) Tutor ----------
const askChatbot = async (reel, question, history = []) => {
  const ai = requireClient();
  const systemInstruction = `You are a friendly AI tutor inside "Tech Explainer Reels", a learning platform for BCA students and beginners.
The student is studying this lesson:
${buildReelContext(reel)}

Explain in simple, student-friendly language and use a short practical example when it helps. Stay grounded in the lesson; if the question is outside it, answer briefly and steer back. If you are unsure, say so rather than guessing. Keep answers under about 180 words.`;
  return run(async () => {
    const chat = ai.chats.create({
      model: MODEL_NAME(),
      config: { systemInstruction },
      history: history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text }] })),
    });
    const response = await chat.sendMessage({ message: question });
    const text = (response.text || "").trim();
    if (!text) throw new Error("Empty response from model");
    return text;
  });
};

// ---------- 2) Notes ----------
const validateNotes = (raw) => {
  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
  const notes = {
    summary: String(raw?.summary || "").trim(),
    keyPoints: arr(raw?.keyPoints),
    importantTerms: Array.isArray(raw?.importantTerms)
      ? raw.importantTerms.filter((t) => t && t.term && t.definition).map((t) => ({ term: String(t.term).trim(), definition: String(t.definition).trim() }))
      : [],
    examples: arr(raw?.examples),
    revisionNotes: arr(raw?.revisionNotes),
    interviewQuestions: arr(raw?.interviewQuestions),
  };
  if (!notes.summary || notes.keyPoints.length === 0) throw new Error("Notes missing required sections");
  return notes;
};

const generateNotes = async (reel) => {
  const ai = requireClient();
  const prompt = `Create structured revision notes for a student from this lesson. Use ONLY the lesson content below.
${buildReelContext(reel)}

Return ONLY JSON with exactly this shape:
{"summary":"2-3 sentences","keyPoints":["..."],"importantTerms":[{"term":"","definition":""}],"examples":["a concrete example"],"revisionNotes":["short bullet"],"interviewQuestions":["..."]}`;
  return run(async () => {
    const r = await ai.models.generateContent({ model: MODEL_NAME(), contents: prompt, config: { responseMimeType: "application/json" } });
    return validateNotes(parseJsonResponse(r.text));
  });
};

// Clearly-labelled fallback built only from content already stored with the lesson (no AI involved).
const lessonNotes = (reel) => ({
  summary: reel.learningObjective || reel.description,
  keyPoints: reel.keyTakeaways || [],
  importantTerms: [],
  examples: [],
  revisionNotes: (reel.keyTakeaways || []).slice(0, 5),
  interviewQuestions: (reel.interviewQA || []).map((q) => q.question),
});

// ---------- 3) Quiz ----------
// Validates model output before it is ever shown to a student or used as an answer key.
const validateQuiz = (raw, count) => {
  if (!Array.isArray(raw)) throw new Error("Quiz is not an array");
  const out = [];
  for (const q of raw) {
    const options = Array.isArray(q?.options) ? q.options.map((o) => String(o).trim()) : [];
    const ci = Number(q?.correctIndex);
    const okOptions = options.length === 4 && options.every(Boolean) && new Set(options.map((o) => o.toLowerCase())).size === 4;
    if (!q?.question || !String(q.question).trim() || !okOptions || !Number.isInteger(ci) || ci < 0 || ci > 3 || !String(q.explanation || "").trim()) continue;
    out.push({ question: String(q.question).trim(), options, correctIndex: ci, explanation: String(q.explanation).trim() });
  }
  if (out.length < Math.min(3, count)) throw new Error("Model returned too few valid questions");
  return out.slice(0, count);
};

const generateQuiz = async (reel, count = 5) => {
  const ai = requireClient();
  const prompt = `Write ${count} multiple-choice questions that test understanding of this lesson. Base every question strictly on the lesson content; do not introduce outside facts. Each question has exactly 4 distinct, plausible options, exactly one correct, and a one-sentence explanation of why it is correct.
${buildReelContext(reel)}

Return ONLY a JSON array: [{"question":"","options":["","","",""],"correctIndex":0,"explanation":""}]`;
  return run(async () => {
    const r = await ai.models.generateContent({ model: MODEL_NAME(), contents: prompt, config: { responseMimeType: "application/json" } });
    return validateQuiz(parseJsonResponse(r.text), count);
  });
};

// ---------- 4) Captions ----------
const generateCaptions = async (reel) => {
  if (reel.transcript && reel.transcript.trim().length > 40) return reel.transcript.trim();
  const ai = requireClient();
  const prompt = `Write short spoken-style captions for a ${reel.duration || 60}-second educational video. Plain text only.\n${buildReelContext(reel)}`;
  return run(async () => (await ai.models.generateContent({ model: MODEL_NAME(), contents: prompt })).text.trim());
};

module.exports = {
  askChatbot, generateNotes, generateQuiz, generateCaptions, lessonNotes,
  validateQuiz, validateNotes, parseJsonResponse, isConfigured: () => !!getClient(),
};
