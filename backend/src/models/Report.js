const mongoose = require("mongoose");

// One user can report a lesson once. When enough distinct users report it, it is hidden for review.
const reportSchema = new mongoose.Schema(
  {
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: ["spam", "inappropriate", "misleading", "copyright", "other"], required: true },
    details: { type: String, maxlength: 300, default: "" },
  },
  { timestamps: true }
);
reportSchema.index({ reel: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Report", reportSchema);
