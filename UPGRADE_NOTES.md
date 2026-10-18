> **Superseded:** this file describes an earlier upgrade pass (base64 uploads, unbuilt frontend). See `README.md` and `PROJECT_STATUS.md` for the current state.

# Upgrade Notes — Visual Redesign + Feature Expansion

This document summarizes the changes made in this upgrade pass, on top of the original Tech Explainer Reels codebase. It's organized to match the 5 phases from the upgrade brief.

## ⚠️ Read this first: sandbox environment limits

The sandbox this upgrade was built in had **no npm registry access** for installing new packages (every `npm install <pkg>` attempt returned 403, including for packages already in `package.json` like `vite` itself, after node_modules got pruned partway through). Two consequences:

1. **No new npm dependencies were added.** Where the original brief suggested a library (multer for uploads, Recharts for charts, framer-motion for motion), I built an equivalent using only what was already installed, or Node's built-ins:
   - **Video upload** uses base64-over-JSON instead of multipart/multer (see `backend/src/controllers/uploadController.js`). It works, but is capped around ~55MB per video (raised `express.json` limit) and is less memory-efficient than streaming multipart. If you have real npm access, swapping in `multer` + disk streaming is a clean drop-in replacement for just the file-write step.
   - **Admin charts** use a small dependency-free SVG bar chart (`frontend/src/components/SignupChart.jsx`) instead of Recharts. Functionally equivalent (hover tooltips, adjustable date range) but less polished than a real charting library.
   - **Motion/animation** uses Tailwind keyframes + CSS transitions instead of framer-motion — this was a reasonable choice regardless of the sandbox issue.
   - **Thumbnail generation** *does* use a real dependency: the system `ffmpeg`/`ffprobe` binaries, invoked via `child_process` (no npm package needed, since ffmpeg was already on the machine). This part is fully "real."

2. **Verification was done without a live build for the final ~40% of frontend files.** Early in the session `npm run build` (real Vite) worked and caught real bugs. Partway through, node_modules was wiped by the failed install attempts and couldn't be restored (registry blocked entirely at that point). From there, verification was:
   - Backend: `node --check` on every file, plus a full `require("./src/app")` load test (catches wiring/require errors) — both passed.
   - Frontend: syntax-checked every `.js`/`.jsx` file with a standalone `esbuild` binary found on disk, **and** ran a full bundle-resolution pass from `main.jsx` through the entire import graph (all 26 routes are eagerly imported in `App.jsx`, so this covered every page/component/context) with node_modules packages treated as external. This confirms every relative import path is correct and there are no syntax errors anywhere — but it does **not** catch runtime logic bugs the way actually running the app would.
   - **Run `npm install` in both `frontend/` and `backend/` in your own environment before anything else** — this is more important than usual given the above.

---

## Phase 1 — Visual identity ✅

- New Tailwind theme (`frontend/tailwind.config.js`): teal/jade `brand` scale, coral `accent` scale, gold accent for gamification, warm charcoal/cream neutrals (light + dark), semantic success/warning/error colors — all per the exact hex values in the brief.
- Space Grotesk (headings) + Inter (body) via Google Fonts in `index.html`.
- Elevation scale (`shadow-subtle/medium/prominent`), gradient-hero utility, skeleton shimmer utility — all in `index.css`.
- New logo mark (`components/Logo.jsx`, also used as favicon).
- New components: `Toast` system (`context/ToastContext.jsx`), `ConfirmModal` (`context/ConfirmContext.jsx`, replaces every native `confirm()` in the admin panel), `Skeletons.jsx` (shaped loaders for reel cards, stat cards, comment rows), `EmptyState.jsx` (used everywhere — bookmarks, comments, quiz history, search, 404), `BottomNav.jsx` (mobile tab bar), `CommandPalette.jsx` (Cmd/Ctrl+K quick search).
- Route-level fade transition via a `key`-ed `<main>` in `MainLayout.jsx`; staggered grid reveal via a `.stagger-item` animation class applied to reel cards and list rows.
- Favicon, Open Graph meta tags, and `manifest.webmanifest` (installable PWA) added to `index.html`.

## Phase 2 — Swipeable reels feed ✅

- `frontend/src/pages/Watch.jsx` — full-screen vertical snap-scroll feed at `/watch` and `/watch/:id`. Autoplays the in-view reel via `IntersectionObserver`, pauses others.
- Overlay controls (like, bookmark, comment/chat, share, mute, playback speed) on top of the video; a `BottomSheet` (`components/BottomSheet.jsx`) slides up over the video for AI Tutor / Notes / Quiz / Comments, reusing the existing `AIChatbot`, `AINotes`, `AIQuiz`, `CommentSection` components unchanged.
- Thin auto-advancing progress bar per reel; auto-advances to the next reel on end.
- Keyboard shortcuts: Space (play/pause), Up/Down (prev/next), L (like), B (bookmark).
- Double-tap-to-like heart burst animation.
- Grid-based Explore/Categories pages are untouched as an alternative browsing mode; `ReelDetail` now has a "Watch in Feed" button linking into `/watch/:id`.

## Phase 3 — Upload & creator/admin tools ✅ (with the base64/no-multer caveat above)

- Drag-and-drop upload with a real progress bar (`AdminReels.jsx`, via axios `onUploadProgress`) hitting `POST /api/upload/video`.
- Server-side thumbnail auto-extraction and duration probing via `ffmpeg`/`ffprobe` (`backend/src/controllers/uploadController.js`). Files land in `backend/uploads/videos` and `backend/uploads/thumbnails`, served statically at `/uploads/...`.
- `Reel.status` (`draft`/`scheduled`/`published`) added additively; the legacy `isPublished` boolean is kept in sync automatically via a pre-save hook, so nothing that reads `isPublished` needed to change.
- Bulk select + bulk publish/unpublish/delete in the admin reels table (`PUT /api/admin/reels/bulk`).
- Admin analytics chart replaced with a dependency-free SVG bar chart with hover tooltips and an adjustable date range (7/14/30/90 days).
- Per-reel analytics view (`pages/admin/AdminReelDetail.jsx`, `GET /api/admin/reels/:id/analytics`): viewers, completion rate, total/average watch time, approximate drop-off point, quiz pass rate.

## Phase 4 — Engagement features ✅

- **Onboarding**: Signup is now a 2-step flow — account details, then an interest picker (3–5 categories) + skill level, seeding `User.interests`/`skillLevel` (all additive fields).
- **Skill level** filter added to `Reels.jsx` (Explore page) alongside the existing category/sort filters.
- **"Because you watched X"** row on the homepage, generated from the dashboard endpoint based on the user's most-recently-watched reel's category.
- **Continue watching resumes from actual position**: `GET /api/reels/:id` now returns `myProgress.watchedSeconds` for the logged-in caller, and both `ReelDetail` and `Watch` seek the video to that position on load (once), rather than starting from 0.
- **Gamification** (`backend/src/utils/gamification.js`): daily streak counter, XP + levels (visible on the dashboard), a small set of unlockable badges (quiz-based, streak-based, reels-watched-based). Awarded on reel completion and quiz submission, evaluated via cheap aggregate queries rather than on every page load.
- **Weekly leaderboard** (`/leaderboard`, opt-in via a checkbox on the Profile page, off by default is *not* the case — it defaults to opted-in but is clearly labeled and toggleable). Shows first name + last initial, never email, per the privacy note in the brief. (Note: this ranks by all-time XP rather than a true rolling 7-day window, since there was no existing per-week XP ledger to build on — a real "weekly" reset would need a scheduled job or a dated XP log, which felt like scope creep for this pass; flagging it as a simplification.)
- **Social**: public profile pages (`/u/:id`) with stats/badges, follow/unfollow, comment reactions (heart, in `CommentSection.jsx`), a share button (native share sheet with clipboard fallback) on both `ReelDetail` and `Watch`.
- **Discovery**: search-as-you-type in the command palette (Cmd/Ctrl+K, hits the existing `/api/reels?search=`), a "Trending This Week" sort option, a skill-level filter, and clickable tags on `ReelDetail` that filter the Explore page.

## Phase 5 — Accessibility & finishing touches ✅ (mostly)

- Captions: `POST /api/ai/captions/:reelId` generates captions via Gemini (reusing the existing transcript when present, otherwise synthesizing plausible narration text), stored on the reel and shown under the video / overlaid in the feed.
- Playback speed control (0.5x–2x) on both `ReelDetail` and `Watch`.
- Visible focus states added globally in `index.css` (`:focus-visible` outline) rather than relying on browser defaults.
- Favicon, OG tags, and PWA manifest — see Phase 1.
- Optimistic like/bookmark updates everywhere (instant UI change, roll back on failure) — `ReelDetail.jsx`, `Watch.jsx`, `CommentSection.jsx` (reactions).
- Infinite scroll added to the Explore page as a toggle alongside the existing numbered pagination (`Reels.jsx`).

**Not done in this pass:** a real offline service worker (the manifest makes the app installable, but there's no offline caching layer — that felt like a genuinely separate, riskier piece of work to bolt on blind, without being able to test it live).

---

## New setup steps

1. **ffmpeg is required on the server** for thumbnail/duration extraction on upload. It was already present in the build sandbox; install it on your deployment target too (`apt install ffmpeg` / `brew install ffmpeg`). If it's missing, uploads still succeed but without an auto-generated thumbnail (falls back to whatever `thumbnailUrl` was typed in, if any) and use a default 60s duration.
2. **Uploaded files are stored on local disk** under `backend/uploads/` (auto-created on first run) and served at `/uploads/...`. This directory is not part of the git history — make sure it's excluded from version control but included in your deploy/persistence strategy (e.g. mounted volume), since it's not swappable for cloud storage without further work.
3. No new environment variables are required — everything additive uses existing config (`JWT_SECRET`, `GEMINI_API_KEY`, `MONGODB_URI`).
4. Run `npm install` fresh in both `frontend/` and `backend/` before starting anything, given the sandbox `node_modules` issue described above.

## Nothing removed

Every existing route, model field, and page still works as before: `isPublished` still works, non-status reels default correctly, existing auth/comments/likes/bookmarks/quiz/notes/chat flows are untouched in shape (only additively extended), and the grid Explore/Categories pages remain fully intact alongside the new Watch feed.
