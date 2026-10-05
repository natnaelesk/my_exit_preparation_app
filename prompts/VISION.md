# Vision — exit preparation app v0.2

Concise product and architecture target for agents working from `main` (post gift-ready / Cursor SDK).

## Product

- Gift tool for **private multi-user** Ethiopian **exit-exam** study — **program-agnostic** (CS, Engineering, Nursing, etc.). Not a public launch. CS is only an example MoE blueprint, not a product-wide subject list.
- Each user starts with an **empty canvas**: **zero curriculum topics** until they upload and apply their MoE exit-exam **test blueprint**. Curriculum / subjects come from that per-user blueprint (themes/courses + focus notes), not a global subject list.
- Users may keep **multiple applied blueprints in history**; exactly **one** is **active** at a time (switchable). Applying always goes through extract → review → apply (no silent auto-save).
- Each user owns their own exams, questions, attempts, plans, study docs, study chats, and blueprint curriculum.
- Keep the practice loop: take exams, weak-area practice, daily plan.
- Add: in-app **PDF → questions**, **Study chat**, and **blueprint → curriculum**.

## Architecture

- Keep **React (Vite) frontend + Django/DRF backend** on Render (not FE-only).
- Sharper FE UX for Render **cold start / wake-from-sleep**.
- **Auth + per-user ownership** on every model (no more `AllowAny` global data).
- **AI: server-side only (Django)**, powered by the **Cursor Python SDK** (`cursor-sdk`) with **no-repo cloud agents** and `CURSOR_API_KEY` (`crsr_…`) — not OpenAI-compatible `/chat/completions` / xAI. Never `VITE_` keys in the client.
- **Exam add:** drop PDF (often photo pages) → multimodal AI → validated JSON → review UI → save questions.
- **Blueprint curriculum:** drop MoE test-blueprint PDF → multimodal AI → review themes/courses/focus notes → apply into per-user history (one active) — see `prompts/07-blueprint-curriculum.md`. Leftover hardcoded “15 subjects” analytics and ungated JSON question/study paths without an active blueprint are fixed by `prompts/08-curriculum-polish.md`.
- **Profile:** upload study PDFs → Storage → AI short description → used in Study chat retrieval.
- **Planner:** mostly the same daily plan, plus a Study button → persisted chat session fed by plan topics + relevant docs + active blueprint focus notes; deep-study prompt with 4 chunks + continue protocol.
- Replace browser Groq chat with the **server Cursor SDK** path (see `prompts/06-cursor-sdk-ai.md`).

## Out of scope for early prompts

- Public marketplace / sharing other users' exams
- Removing Django
- Shipping a default CS (or any) curriculum for everyone

## Known old bugs — do NOT port

- Pause + finish **double-counting** attempts
- Dashboard STRONG/WEAK counters always `0`
- Silent truncation at page size `100`
- AI API keys in the frontend
- Auto-seeding `SubjectPriority` / UI from hardcoded `OFFICIAL_SUBJECTS` (15 CS courses)
