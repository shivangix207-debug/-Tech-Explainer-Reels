// Automated moderation so a human admin only has to look at what actually needs a human.
//
//  1. screenLesson()    -> rule-based pre-screening of every upload (blocked content, spam signals, duplicates) => risk 0-100
//  2. isTrustedCreator()-> admin-granted OR earned (TRUST_MIN_APPROVED published lessons, zero rejections)
//  3. decide()          -> reject | needs-review | auto-approve (trusted) | clean-pending (new creator, low risk)
//  4. reports           -> REPORT_THRESHOLD distinct reporters auto-hide a lesson (see reelController.reportReel)
//
// All thresholds are env-configurable. Rules are deliberately simple and transparent; plug an AI/ML classifier
// into screenLesson() later without touching the rest of the pipeline.
const Reel = require("../models/Reel");

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);
const cfg = () => ({
  reviewRisk: num(process.env.MODERATION_REVIEW_RISK, 40),          // risk >= this => a human must look
  trustMinApproved: num(process.env.TRUST_MIN_APPROVED, 3),          // lessons published with 0 rejections => trusted
  auditRate: num(process.env.MODERATION_AUDIT_RATE, 0.1),            // share of auto-approved lessons queued for a spot-check
  reportThreshold: num(process.env.MODERATION_REPORT_THRESHOLD, 3),  // distinct reporters that auto-hide a lesson
});

const BLOCKED = [
  [/\bporn\w*|\bxxx\b|\bnude\w*|\bonlyfans\b|\bescort\b/i, "adult content"],
  [/\bcasino\b|\bbetting\b|\bviagra\b|free\s+robux|crypto\s+giveaway|\bloan\s+offer\b/i, "spam / scam content"],
];
const PROMO = /subscribe to my|follow me|dm me|link in bio|whatsapp me|telegram\s*@|buy now|click here/i;

async function screenLesson({ title = "", description = "", transcript = "", tags = [], videoHash = "", reelId = null }) {
  const text = [title, description, transcript, ...tags].join(" ");
  const notes = [], blocked = [];
  let risk = 0;

  for (const [rx, label] of BLOCKED) if (rx.test(text)) blocked.push(label);

  const urls = (text.match(/https?:\/\/|www\./gi) || []).length;
  if (urls > 2) { risk += 25; notes.push(`${urls} links in the text`); }
  if (PROMO.test(text)) { risk += 25; notes.push("promotional wording"); }
  const letters = title.replace(/[^a-z]/gi, "");
  if (letters.length > 8 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6) { risk += 15; notes.push("title is mostly capitals"); }
  if (/(.)\1{6,}/.test(text)) { risk += 15; notes.push("repeated characters"); }
  if (transcript.trim().length < 40) { risk += 20; notes.push("no transcript (nothing for the AI tutor/quiz to use)"); }
  if (description.trim().toLowerCase() === title.trim().toLowerCase()) { risk += 10; notes.push("description just repeats the title"); }
  if (videoHash) {
    const dup = await Reel.exists({ videoHash, ...(reelId ? { _id: { $ne: reelId } } : {}) });
    if (dup) { risk += 45; notes.push("identical video file already exists on the platform"); }
  }
  return { blocked, risk: Math.min(100, risk), notes };
}

// Trusted = admin flag, or an earned track record of approved lessons with no rejections.
async function isTrustedCreator(user) {
  if (user.trusted) return true;
  const [published, rejected] = await Promise.all([
    Reel.countDocuments({ uploadedBy: user._id, status: "published" }),
    Reel.countDocuments({ uploadedBy: user._id, status: "rejected" }),
  ]);
  return published >= cfg().trustMinApproved && rejected === 0;
}

// Applies the decision to a Reel document (caller saves it).
async function moderateLesson(reel, owner) {
  const c = cfg();
  const s = await screenLesson({ title: reel.title, description: reel.description, transcript: reel.transcript, tags: reel.tags, videoHash: reel.videoHash, reelId: reel._id });
  reel.risk = s.risk; reel.moderationNotes = s.notes; reel.needsAudit = false; reel.rejectionReason = ""; reel.reviewedAt = new Date();

  if (s.blocked.length) {
    reel.status = "rejected"; reel.autoDecision = "auto-rejected";
    reel.rejectionReason = `Automatically rejected: contains ${s.blocked.join(" and ")}.`;
  } else if (s.risk >= c.reviewRisk) {
    reel.status = "pending"; reel.autoDecision = "needs-review";
  } else if (await isTrustedCreator(owner)) {
    reel.status = "published"; reel.autoDecision = "auto-approved";
    reel.needsAudit = Math.random() < c.auditRate; // random spot-checks keep trusted creators honest
  } else {
    reel.status = "pending"; reel.autoDecision = "clean-pending";
  }
  return reel;
}

module.exports = { screenLesson, isTrustedCreator, moderateLesson, cfg };
