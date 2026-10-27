const mongoose = require("mongoose");

const reelSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    duration: { type: Number, default: 60 }, // seconds
    transcript: { type: String, default: "" }, // used as AI grounding context
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPublished: { type: Boolean, default: true },

    // --- Additive fields ---
    // status is additive and richer than isPublished; isPublished is kept in sync
    // (true only when status === "published") so existing frontend/backend code
    // that reads isPublished keeps working unchanged.
    // draft: creator-only | pending: awaiting admin review | published | rejected | scheduled
    status: { type: String, enum: ["draft", "pending", "scheduled", "published", "rejected"], default: "published" },
    rejectionReason: { type: String, default: "" },
    // Moderation signals (see utils/moderation.js)
    risk: { type: Number, default: 0 },                    // 0-100 from automatic screening
    moderationNotes: [{ type: String }],                   // why it was flagged / auto-decided
    autoDecision: { type: String, default: "" },           // auto-approved | auto-rejected | needs-review | clean-pending | admin
    needsAudit: { type: Boolean, default: false },         // auto-approved lesson picked for an admin spot-check
    reportCount: { type: Number, default: 0 },             // distinct users who reported it
    videoHash: { type: String, default: "", index: true }, // sha1 of the uploaded file (duplicate detection)
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    skillLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    captions: { type: String, default: "" }, // auto-generated subtitle text
    videoFile: { type: String, default: "" }, // set when uploaded via the file-upload flow (vs. pasted URL)
    // Honest labelling of what the media actually is:
    // "uploaded" = real video a creator/admin uploaded, "generated-slides" = silent slide video
    // rendered from the lesson text (seed lessons), "external" = pasted URL (admin only), "none".
    videoSource: { type: String, enum: ["uploaded", "generated-slides", "external", "none"], default: "uploaded" },

    // Lesson content (all optional; used by the lesson page, AI grounding and the curated quiz)
    seedKey: { type: String, unique: true, sparse: true }, // stable id so re-seeding upserts instead of duplicating
    learningObjective: { type: String, default: "" },
    keyTakeaways: [{ type: String }],
    interviewQA: [{ _id: false, question: String, answer: String }],
    // Curated quiz. select:false so correct answers are never sent to clients; graded on the server.
    quiz: {
      type: [{ _id: false, question: String, options: [String], correctIndex: Number, explanation: String }],
      select: false,
    },
    quizCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reelSchema.index({ status: 1, createdAt: -1 });
reelSchema.index({ uploadedBy: 1, createdAt: -1 });
reelSchema.index({ category: 1, status: 1 });
reelSchema.index({ tags: 1 });

// Keep the legacy `isPublished` boolean in sync with the richer `status` field
// so any existing code that only knows about `isPublished` keeps working.
reelSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    this.isPublished = this.status === "published";
  } else if (this.isModified("isPublished") && !this.isModified("status")) {
    this.status = this.isPublished ? "published" : "draft";
  }
  next();
});

reelSchema.virtual("likeCount").get(function () {
  return this.likes?.length || 0;
});
reelSchema.set("toJSON", { virtuals: true });
reelSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Reel", reelSchema);
