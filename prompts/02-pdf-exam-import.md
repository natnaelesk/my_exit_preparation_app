# 02 — PDF exam import (AI → review → save)

**Branch:** `feat/02-pdf-exam-import` from `dev-v0.2`  
**PR target:** `dev-v0.2`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md` and skim `prompts/01-auth-and-ownership.md` (already merged) before coding.

## Goal

Replace outside DeepSeek PDF→JSON with an **in-app** flow: logged-in user drops an exam PDF (often photo pages) → **server-side** multimodal AI extracts questions → user **reviews/edits** → save as that user's Exam + Questions.

## Context

- Auth + per-user ownership already shipped on `dev-v0.2` (Token auth, `owner` on every model).
- Today `CreateExam.jsx` only accepts paste/upload of JSON. Keep JSON upload as a fallback if easy; primary path is PDF.
- Exam PDFs are often **images of questions**, not clean text — use vision/multimodal, not text-only extract.
- AI must run on **Django only**. Env var for the Cursor/Grok (or compatible OpenAI-style) API key — **never** `VITE_`.
- Allowed subjects (must match each question):
  Computer Programming; Object Oriented Programming; Data Structures and Algorithms; Design and Analysis of Algorithms; Database Systems; Software Engineering; Web Programming; Operating System; Computer Organization and Architecture; Data Communication and Computer Networking; Computer Security; Network and System Administration; Introduction to Artificial Intelligence; Automata and Complexity Theory; Compiler Design.
- JSON shape the app already understands (align with existing serializers / upload validator):

```json
{
  "title": "Exam Title",
  "questions": [
    {
      "question": "…",
      "choices": ["…", "…"],
      "correctAnswer": "exact choice text",
      "explanation": "1–2 sentences",
      "subject": "one of allowed list",
      "topic": "short topic"
    }
  ]
}
```

- Product extract rules (encode in the server prompt):
  - Output **only** valid JSON (no markdown fences).
  - `correctAnswer` must equal one choice exactly; if PDF uses A/B/C/D, map to choice text.
  - Clean question text (drop numbering).
  - If subject unclear, pick best from the list.

## Constraints

- New endpoints under auth (owner-scoped), e.g.:
  - upload PDF → store file (local media or Supabase/S3-compatible — pick what fits Render + existing stack; document env vars)
  - start extraction job / sync extract
  - return draft exam JSON for review
  - confirm/publish → create Exam + Questions for `request.user` (server-generated question IDs, as in 01)
- Large PDFs: split into page images if needed; batch AI calls; surface progress/errors to the FE.
- Strict validate before save; if AI returns bad JSON, retry once or return a clear error — never write half-broken rows.
- FE: drop-zone on create-exam (or replace it), loading/progress, **review UI** (edit title, questions, choices, subject, topic, correct answer) before publish.
- Do **not** build Study chat, profile study-docs library, or planner Study button.
- Do **not** remove the existing take-exam / practice flows.
- Keep cold-start friendly errors on these new calls (reuse apiClient patterns).
- Commits/PR only as Natnael Eskinder / `natnaelesk`.

## Out of scope

- Study materials / RAG / Study chat
- Marketplace / sharing
- Replacing Groq tutor chat (that can be a later prompt when Study lands)
- Fixing unrelated bugs (`round-two` URL, page-size 100) unless they block this flow

## Acceptance criteria

- [ ] Logged-in user can upload an exam PDF from the UI
- [ ] Server calls multimodal AI with the secret from env (not exposed to the browser)
- [ ] Draft questions returned for review; user can edit before save
- [ ] Publish creates Exam + Questions owned by that user only
- [ ] Another user cannot see the uploaded PDF or resulting exam
- [ ] Invalid / failed extraction shows a clear retry-friendly error
- [ ] At least one backend test for auth on the new endpoints + owner scoping of saved exams
- [ ] PR targets `dev-v0.2`
- [ ] PR documents required env vars (API key, any storage settings) and a short manual test with a sample PDF

## Notes

- Prefer a small, reviewable PR over perfect OCR. Review UI is mandatory because vision will misread some photo pages.
- If Cursor SDK specifics are unclear, use an OpenAI-compatible chat-completions style client configurable via env (`BASE_URL`, `API_KEY`, `MODEL`) so Natnael can point it at Cursor Ultra / Grok without code changes.
- Migration wipe from 01 already emptied legacy data — no need to re-wipe.
