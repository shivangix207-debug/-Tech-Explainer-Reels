# PROJECT_STATUS

## Run
```bash
npm install && npm run setup:env        # then edit backend/.env
npm run seed
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-password' npm run create-admin --workspace=backend
npm run dev
MONGO_URI=mongodb://127.0.0.1:27017/ter_test npm test --workspace=backend
```

## Done and verified (automated: 26 backend tests; jsdom smoke test loading every page as anonymous/student/creator/admin; frontend `vite build`; dev-stack smoke test via the Vite proxy)
- [x] Roles student/creator/admin enforced on the API; signup can't create admins; creators can't touch others' lessons
- [x] Multipart upload (multer): size/extension/MIME/magic-byte checks, random filenames, ffprobe duration + thumbnail
- [x] Moderation at scale: auto-screening + risk score, trusted creators publish instantly (+10% spot-checks), community reports auto-hide at 3, risk-sorted admin queue with Approve-all-clean; hidden lessons 404 for everyone else
- [x] Playback with Range seeking; player shows an error + retry for missing/unsupported files
- [x] 15 narrated 60 s reels (synthetic voice + captions), real durations in manifest; seed removes legacy broken reels
- [x] 15 lessons seeded (transcript, objective, takeaways, 3 interview Q&A, 4-Q curated quiz w/ explanations); idempotent seed; options shuffled deterministically
- [x] Search (title/description/tags, regex-escaped), category/difficulty filters, sorts
- [x] Likes/bookmarks (atomic, no duplicates), comments (validated, owner/admin delete), server-decided progress (≥90%), XP only once
- [x] Quiz graded on server with single-use sessions; AI/notes fail honestly; notes fallback clearly labelled
- [x] Dashboard, Library (saved/history/quiz results), Creator Studio, admin moderation + analytics from DB data
- [x] Dark-first violet/cyan theme; password hashing (bcrypt), auth rate-limit, no stack traces in responses

## NOT verified
- **Gemini calls** (no network/key here): only the failure paths and the output validators are tested.
- **Real MongoDB**: tests ran on FerretDB (a MongoDB-compatible server) — a few queries were rewritten to be portable; run `npm test` on your own MongoDB to confirm.
- **Visuals in a real browser** (none available here): every route was loaded in a simulated browser (jsdom) with no runtime errors, but layout/responsiveness, drag-and-drop upload, video playback and scroll feel were not seen by a human.
- Docker compose; large-file (≥ 100 MB) upload limit path.

## Known limitations / next steps
1. Open the app, click through Landing → Signup (creator) → Studio upload → Admin approve → watch → quiz; fix any visual issues.
2. Seeded reels use a synthetic voice, not a human recording; replace via Studio uploads.
3. Leaderboard ranks all-time XP. Local-disk video storage only.
5. Admin Users now has a Student/Creator/Admin dropdown; Profile has change-password.
4. Rotate any real secrets that were ever in the shared `backend/.env`; it is now git-ignored.
