const mongoose = require("mongoose");

// One row = "this viewer already counted as a view of this lesson recently". The unique index makes
// duplicate/parallel requests (React StrictMode, retries, two tabs) a no-op, so views can't be inflated.
const viewEventSchema = new mongoose.Schema(
  {
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true },
    viewer: { type: String, required: true }, // "u:<userId>" or "ip:<hash>"
    createdAt: { type: Date, default: Date.now, expires: 60 * 30 }, // the same viewer counts again after 30 min
  },
  { versionKey: false }
);
viewEventSchema.index({ reel: 1, viewer: 1 }, { unique: true });

module.exports = mongoose.model("ViewEvent", viewEventSchema);
