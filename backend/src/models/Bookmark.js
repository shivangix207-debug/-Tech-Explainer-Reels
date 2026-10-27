const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: "Reel", required: true },
  },
  { timestamps: true }
);

bookmarkSchema.index({ user: 1, reel: 1 }, { unique: true });

module.exports = mongoose.model("Bookmark", bookmarkSchema);
