# Tech Explainer Reels — AI-Powered Learning Platform

Students learn technical topics from short lessons, ask an AI tutor about the lesson they're watching, generate study notes, take quizzes graded on the server, and track progress. Creators upload lessons; admins review and publish them.

**Stack:** React + Vite + Tailwind (frontend) · Node.js + Express (backend) · MongoDB + Mongoose · JWT auth · Google Gemini (server-side only).

## Roles
| Role | Can do |
|---|---|
| **Student** (`user`) | Browse/search published lessons, watch, like, bookmark, comment, take quizzes, use AI tutor/notes, see progress & history |
| **Creator** | Everything a student can, plus upload lessons (video + metadata + transcript), edit/delete **their own** lessons, see review status. Lessons are screened automatically; trusted creators publish instantly, others wait for review (see *Moderation at scale*) |
| **Admin** | Review queue (approve/reject/unpublish), manage all lessons, users (roles, deactivate), comment moderation, analytics from real DB records |

Permissions are enforced by the **backend API** (`backend/src/middleware/auth.js` + controllers); the UI only hides things for convenience. Signup can choose Student or Creator; **admin can never be self-assigned** — see "Create the admin" below.

## Prerequisites
Node.js 18+ (tested on 22), a MongoDB instance (local or Atlas), optionally `ffmpeg`/`ffprobe` on PATH (auto-detects video duration + makes thumbnails for uploads; uploads still work without it), optionally a [Gemini API key](https://aistudio.google.com/app/apikey).

## Setup
```bash
npm install                      # installs frontend + backend (npm workspaces)
npm run setup:env                # copies backend/.env.example -> backend/.env (never overwrites)
# edit backend/.env: MONGO_URI, JWT_SECRET (long random), GEMINI_API_KEY (optional)

npm run seed                     # 15 lessons + categories (safe to re-run; never deletes users)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-long-password' npm run create-admin --workspace=backend
npm run dev                      # backend :5000 + frontend :5173
```
Open http://localhost:5173.

### Environment variables (`backend/.env`, placeholders only)
`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GEMINI_API_KEY`, `GEMINI_MODEL` (optional), `CLIENT_URL`, `MAX_UPLOAD_MB` (default 100), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (used only by `create-admin`, min 10 chars). The server refuses to start without `MONGO_URI` and `JWT_SECRET`. Keys never reach the frontend.

### Seeding & the admin account
* `npm run seed` upserts 9 categories and **15 lessons** (HTML/CSS, JS closures, React, REST, Node/Express, MongoDB, SQL, JWT, Git, Big-O, processes/threads, TCP/UDP, SQL injection/XSS, cloud models, LLMs). Content lives in `backend/src/seed/lessons*.js`.
  Flags: `-- --reset-views` zeroes all view counters; `-- --demo` creates a demo student + creator with a random password printed once; `-- --remove-legacy` deletes the old placeholder reels from the previous seed.
* `create-admin` creates (or promotes) the admin from env vars; nothing is hardcoded. Add `--reset-password` to change an existing admin's password.

### What the seeded reels are (important)
Each seeded lesson ships with a **real, playable 60-second MP4**: the lesson transcript read aloud by a **synthetic eSpeak NG voice**, shown as word-by-word captions over an animated background with a topic icon, glow and an equalizer. It is not studio narration, and the UI labels them "Narrated slides". They exist so playback, seeking and progress tracking work out of the box. Re-render with `python3 scripts/render-lesson-media.py` (needs Pillow, ffmpeg and `espeak-ng`; it also rewrites `backend/seed-assets/manifest.json` with real durations). Swap in real recordings any time through Creator Studio.

If you ran an older version: `npm run seed` automatically deletes the old placeholder reels (external coverr.co videos with random durations) together with their related records, and updates the 15 lessons in place.

## Uploading and watching videos
1. Sign up as a **Creator** (or promote a user in Admin → Users) → **Creator Studio** → *New lesson*.
2. Drop an MP4/WebM/MOV (≤ `MAX_UPLOAD_MB`). Upload is multipart with a progress bar; the server checks extension, MIME type **and file signature**, stores it under a random name in `backend/uploads/videos/`, and detects duration/thumbnail with ffmpeg if available.
3. Fill in title, description, category, difficulty, tags, transcript → *Submit for review*.
4. An admin approves it in **Admin → Lessons & moderation**; it then appears for everyone and plays with the browser's native controls (seek via HTTP Range, volume, fullscreen). Progress is saved about every 8 s; a lesson counts as completed at ≥ 90 % watched (decided by the server).

**Limitations:** local-disk storage (fine for a demo; use object storage for production), no transcoding — the browser must support the codec (H.264 MP4 / VP9 WebM are safest).

## AI features (Gemini)
Tutor, notes and AI quizzes call Gemini from the backend, grounded in the lesson transcript/takeaways. Without a key, or if Gemini fails, you get a clear error — never a fake answer. Two clearly-labelled fallbacks that need no AI: **notes** fall back to the lesson's built-in takeaways (marked as such), and every seeded lesson has a **curated 4-question quiz**. AI quiz output is validated (4 distinct options, valid answer index, explanation) before use. Quizzes are graded on the server against an answer key the client never receives; sessions are single-use.

## Tests
```bash
MONGO_URI=mongodb://127.0.0.1:27017/ter_test npm test --workspace=backend   # DB name must contain "test": it is DROPPED
```
19 integration tests cover auth/RBAC, upload validation, creator→moderation→playback (incl. Range), ownership checks, likes/bookmarks, search, progress rules, quiz grading, AI failure modes, admin guards.

## Project structure
```
backend/src/{controllers,routes,models,middleware,utils,seed}   backend/seed-assets (bundled lesson videos)   backend/tests
frontend/src/{pages,components,context,services,layouts}        scripts/ (setup-env, render-lesson-media)
```

## Docker
`docker-compose.yml` is carried over from the original project and was **not re-tested** in this upgrade.

## Troubleshooting
* *"Missing required environment variable"* → run `npm run setup:env` and fill `backend/.env`.
* *Uploaded video 404 in dev* → the Vite dev server proxies `/api` and `/uploads` to the backend (`frontend/vite.config.js`); if you deploy the frontend separately, route `/uploads` to the backend too.
* *AI says "not configured"* → set `GEMINI_API_KEY` and restart the backend.

## Views, feed & home page (how they work)
* **Views** are counted by `POST /api/reels/:id/view`, sent by the player after ~3 s of real playback. The server counts one view per signed-in user (or per hashed IP+browser for guests) per 30 minutes, so refreshes, React dev double-effects and parallel requests can't inflate it. Merely opening a lesson page does not count.
* **Reel feed** (`/watch`): one reel per swipe (`scroll-snap-stop: always`) and per mouse-wheel/trackpad gesture (inertia is ignored); uses `100dvh` so phone browser bars don't cut it off.
* **Home**: every lesson appears at most once on the page (Continue learning → Recommended → Topics → remaining lessons).

## Moderation at scale (why one admin is enough)
A human can't approve every upload on a big platform, so moderation is layered and only the risky or uncertain cases reach a person:

| Layer | What happens | Code |
|---|---|---|
| 1. **Automatic screening** | Every creator upload is scored 0-100: blocked content (adult/scam) → **rejected instantly** with a reason; spam signals (many links, promo wording, SHOUTING titles, repeated characters, no transcript) and **duplicate video files** (SHA-1 of the file) raise the risk score | `backend/src/utils/moderation.js` |
| 2. **Trusted creators** | Clean uploads from a trusted creator are **published immediately**. Trust is earned (3 approved lessons, 0 rejections) or granted by an admin (Admin → Users → *Trust*) | `isTrustedCreator()` |
| 3. **Spot-checks** | ~10 % of auto-approved lessons are randomly queued for an admin to audit, so trusted creators stay honest | `needsAudit`, Admin → *Spot-check* |
| 4. **Community reports** | Viewers can report a lesson. **3 different users** hide it automatically and move it to the top of the queue; an admin can clear or reject it | `POST /api/reels/:id/report` |
| 5. **A queue built for volume** | Admin queues are sorted **riskiest first**, show *why* a lesson was flagged, and have **Approve all clean** (publishes every low-risk, unreported lesson in one click) | Admin → *Lessons & moderation* |

Result: the admin reviews the *flagged* slice (high risk, reported, or sampled), not every upload. New creators still get a human look at first, but a clean batch is one click.
**Honest limits / next steps for a real product:** the rules are simple heuristics (swap in an ML/AI classifier inside `screenLesson()`), a *moderator* role would let a team share the queue, and video content itself (not just metadata) isn't analysed. All thresholds are env vars (see `backend/.env.example`).

## AI tutor speed
Answers **stream** word-by-word (`POST /api/ai/chat/:id/stream`, Server-Sent Events), so the first text appears as soon as the model starts writing. For speed the backend also **turns off Gemini "thinking"** (retrying once without the setting if a model rejects it), caps the answer length (`AI_MAX_OUTPUT_TOKENS`, default 500) and keeps the prompt short. The backend logs `[ai] tutor first token after N ms`; if N is large the delay is the model/network - set `GEMINI_MODEL` to a faster "lite" model. If a proxy blocks streaming, the chat falls back to a normal request automatically.
