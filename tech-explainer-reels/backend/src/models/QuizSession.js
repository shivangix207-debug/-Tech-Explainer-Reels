const mongoose = require("mongoose");

// A quiz handed to one user for one lesson. The answer key lives here, on the server,
// so the client can never see or tamper with correct answers. Single-use, auto-expires.
const quizSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true },
    source: { type: String, enum: ["lesson", "ai"], required: true },
    questions: [{ _id: false, question: String, options: [String], correctIndex: Number, explanation: String }],
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 2 }, // TTL: 2 hours
  },
  { versionKey: false }
);

module.exports = mongoose.model("QuizSession", quizSessionSchema);
