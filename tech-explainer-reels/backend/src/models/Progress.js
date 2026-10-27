const mongoose = require("mongoose");

// Tracks a user's watch progress per reel
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true },
    watchedSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, reel: 1 }, { unique: true });

module.exports = mongoose.model("Progress", progressSchema);
