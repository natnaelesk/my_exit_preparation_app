# 01 — Auth and per-user ownership

**Branch:** `feat/01-auth-and-ownership` from `dev-v0.2`  
**PR target:** `dev-v0.2`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md` before coding.

## Goal

Make the app multi-user with private ownership. Add auth (signup / login / logout) and attach every existing data model to the owning user. New users get an empty canvas. Lock down the API so users only see and mutate their own rows.

## Context

- Current app uses `AllowAny`, has no User FKs, and treats DailyPlan / ThemePreferences / SubjectPriority / Attempts / etc. as global shared data.
- Start here:
  - `backend/api/models.py` — Question, Exam, Attempt, ExamSession, DailyPlan, ThemePreferences, SubjectPriority, FirebaseCollection
  - `backend/exam_app/settings.py` — `REST_FRAMEWORK` defaults (`AllowAny`)
  - Existing React SPA API clients and routes under `src/`

## Constraints

- Prefer Django auth or simple JWT/session that fits the existing React SPA; use whatever fits the stack cleanly.
- Migrations must be safe. If old global rows exist, document a one-time **assign-or-wipe** strategy (gift rebuild — wipe/reassign is OK if documented in the PR).
- Frontend: login/signup screens, protect routes, send auth on API calls, handle `401`.
- Do **not** build PDF upload or Study chat in this prompt.
- Do **not** remove practice/exam flows — only scope them to the logged-in user.
- Commits/PR only as Natnael Eskinder / `natnaelesk`.

## Out of scope

- PDF → questions pipeline
- Study chat / planner Study button
- Profile study-doc uploads
- Public sharing / marketplace
- Full cold-start UX polish (light wake/retry messaging is enough)

## Acceptance criteria

- [ ] User can sign up, log in, and log out
- [ ] New user sees empty exams / questions / attempts / plans
- [ ] API rejects unauthenticated reads/writes of private data
- [ ] User A cannot read or mutate User B's data
- [ ] Existing practice flows still work for the logged-in user
- [ ] FE shows wake/retry-friendly errors if the backend is cold (light touch OK; full polish later)
- [ ] PR targets `dev-v0.2`

## Test notes

- Sign up two users; create data as A; confirm B's canvas stays empty and B cannot fetch A's IDs.
- Hit protected endpoints without credentials → expect `401`/`403`.
- Smoke the practice loop (start exam / attempt / daily plan) while authenticated.
- Optionally restart / cold-wake the Render backend and confirm the FE surfaces a retry-friendly message instead of a silent failure.
