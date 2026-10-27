const mongoose = require("mongoose");

const quizQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    type: { type: String, enum: ["mcq", "true_false", "fill_blank"], default: "mcq" },
    options: [{ type: String }], // for mcq / true_false
    correctAnswer: { type: String, default: "" },
    correctIndex: { type: Number },
    selectedIndex: { type: Number, default: null },
    explanation: { type: String, default: "" },
    userAnswer: { type: String, default: "" },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const quizResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true },
    questions: [quizQuestionSchema],
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    source: { type: String, enum: ["lesson", "ai"], default: "ai" },
    percentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizResult", quizResultSchema);
