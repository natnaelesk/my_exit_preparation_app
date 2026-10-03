# 05 — Gift-ready polish

**Branch:** `feat/05-gift-ready` from `dev-v0.2`  
**PR target:** `dev-v0.2`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md`. Assume prompts **01–04** are on the branch you start from.

## Goal

Make the app **safe and clear to gift**: no client AI secrets, one coherent tutor path (server Study chat), deploy/env checklist for Render + Vercel + Supabase, and a short smoke path a new user can follow without you babysitting.

## Context

- Product is a **private gift**, not a marketplace.
- AI must stay **Django-only** (`AI_API_KEY`, `AI_MODEL`, optional `AI_BASE_URL`). Strip any remaining `VITE_` / browser Groq / DeepSeek / OpenAI keys and dead tutor UIs.
- Document what the giftee (or you on their behalf) must set: auth DB, `DATABASE_URL`, media/storage if used, `AI_*`, CORS / `FRONTEND_URL`, Vercel `VITE_API_URL` (API base only — never the AI key).
- Empty-canvas first run: new account sees empty exams/docs and clear CTAs (create exam from PDF, upload study doc, open Study from planner) — improve copy only where confusing.
- Cold-start: ensure wake banner / retry copy is understandable on first visit after sleep.

## Constraints

- No new major features (no sharing, no payments, no public catalog).
- Prefer deleting dead code over leaving gated stubs.
- Do not force-push `main`; this PR still targets `dev-v0.2`. Promoting to `main` is a **human** step after smoke.
- Commits/PR only as Natnael Eskinder / `natnaelesk`.

## Out of scope

- Merging `dev-v0.2` → `main` (you/Study PM do that after smoke)
- Building prompt 06
- Vector DB / fancy RAG beyond 03

## Acceptance criteria

- [ ] Repo search shows no AI provider secrets or `VITE_*` AI keys in frontend source
- [ ] Old client-side tutor (e.g. Groq) removed or unreachable; Study chat / server AI is the path
- [ ] `README` or `prompts/` (or `docs/DEPLOY.md`) has a short **gift deploy checklist**: Render env, migrate, Vercel env, sample smoke steps
- [ ] New-user empty state is understandable (exams + study materials + Study from plan)
- [ ] Smoke path documented: register/login → upload study PDF → create exam from PDF (or JSON fallback) → take exam → open Study from planner → `continue` through a chunk
- [ ] PR targets `dev-v0.2`
- [ ] PR notes anything still manual (e.g. set `AI_*` on Render) before gifting

## Notes

- Keep changes reviewable; checklist + cleanup beats a redesign.
- If storage is ephemeral on Render free disk, the checklist must say so and point at Supabase/S3 if already wired in 02/03.
