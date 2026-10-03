# 03 — Study docs + Study chat

**Branch:** `feat/03-study-docs-and-chat` from `dev-v0.2`  
**PR target:** `dev-v0.2`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md` and skim `prompts/01-auth-and-ownership.md` + `prompts/02-pdf-exam-import.md` (already merged) before coding.

## Goal

Let each logged-in user **upload study PDFs** (owned, private), get a short **AI description** of each doc on upload, and open a **persisted Study chat** from the daily planner that is fed by **plan topics + relevant study docs**. Replace any browser Groq tutor path with the **same server AI** used for PDF exam import (`AI_*` env vars).

## Context

- Auth + ownership and PDF exam import already ship on `dev-v0.2`. Reuse `ai_client` / OpenAI-compatible chat-completions (server only). Never `VITE_` keys.
- Existing product already has a **daily plan** (`DailyPlan`) and planner UI — keep that loop; add a clear **Study** entry that opens (or resumes) a chat session for that plan day / topics.
- Natnael's deep-study tutor protocol (encode in the server system prompt for Study chat):
  - Teach the topic in **exactly 4 conceptual chunks**.
  - Each chunk ends with: **Memory Lock**, **Exam Traps**, **Likely Questions**.
  - After each chunk, **wait for the user to say `continue`** (or equivalent) before sending the next chunk.
  - Stay within the plan topics and retrieved doc context; do not invent unrelated subjects.
- Study docs at small scale may live on disk / existing media patterns from 02; prefer something that survives Render restarts if easy (e.g. Supabase Storage or S3-compatible). If you stay on local `MEDIA_ROOT`, document the limitation clearly (same as exam-import PDFs).
- On upload: store file → call AI once for a **short description** (1–3 sentences) + optional title/topics tags → save on the doc row for retrieval.
- Study chat retrieval (keep simple for v0.2): when starting or messaging a session, pull the user's docs whose description/title/topics overlap the plan topics (keyword / simple similarity is fine — no need for a vector DB yet). Pass those descriptions + optional short excerpts into the system/context for the model. Cap tokens / number of docs.
- Chat must be **persisted** (session + messages in DB, owner-scoped) so refresh / return later continues the same thread.

## Constraints

- All new models and endpoints are **auth + owner-scoped** (404 for other users' docs/sessions).
- AI only from Django env (`AI_API_KEY`, `AI_MODEL`, optional `AI_BASE_URL` — same as 02).
- FE: profile (or dedicated Study materials) upload UI; planner **Study** button → chat UI with history, `continue` affordance, and clear errors when AI is not configured.
- Do **not** build marketplace/sharing, PDF exam import changes (except shared AI helpers if needed), or unrelated trust bugs (`round-two` URL, page-size 100) unless they block Study.
- Keep take-exam / practice / PDF exam import working.
- Commits/PR only as Natnael Eskinder / `natnaelesk`.

## Out of scope

- Full vector RAG / embeddings infra (simple overlap retrieval is enough)
- Marketplace / shared libraries
- Fixing pause double-count, dashboard STRONG/WEAK zeros, page-size 100 (prompt 04)
- Gift-launch polish and deploy checklist (prompt 05)

## Acceptance criteria

- [ ] Logged-in user can upload a study PDF; it is stored and owned only by them
- [ ] Server generates and stores a short AI description (or a clear retry-friendly error if AI fails / not configured)
- [ ] Another user cannot list, download, or see that doc
- [ ] From the planner, user can open a Study chat tied to plan topics; messages persist and reload
- [ ] Chat uses server AI with the 4-chunk deep-study protocol (Memory Lock / Exam Traps / Likely Questions; wait for continue)
- [ ] Relevant owned study docs are included in chat context (at least by description/title overlap with plan topics)
- [ ] No AI secrets in the frontend
- [ ] At least one backend test for auth/owner scoping on docs and/or chat sessions
- [ ] PR targets `dev-v0.2`
- [ ] PR documents any new env vars / storage notes and a short manual test path

## Notes

- Prefer a reviewable PR: solid ownership + persistence + usable chat over perfect retrieval.
- If Groq (or other client-side tutor) still exists in the FE, remove or gate it so Study chat is the only tutor path going forward.
- Reuse cold-start friendly `apiClient` patterns from 01/02.
