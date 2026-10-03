# Vision — exit preparation app v0.2

Concise product and architecture target for agents working on `dev-v0.2`.

## Product

- Gift tool for **private multi-user** exit-exam study (Ethiopian CS subjects). Not a public launch.
- Each user starts with an **empty canvas** and owns their own exams, questions, attempts, plans, study docs, and study chats.
- Keep the practice loop: take exams, weak-area practice, daily plan.
- Add: in-app **PDF → questions** and **Study chat**.

## Architecture

- Keep **React (Vite) frontend + Django/DRF backend** on Render (not FE-only).
- Sharper FE UX for Render **cold start / wake-from-sleep**.
- **Auth + per-user ownership** on every model (no more `AllowAny` global data).
- **AI: server-side only (Django)**, powered by Cursor Ultra API key / Grok — never `VITE_` keys in the client.
- **Exam add:** drop PDF (often photo pages) → multimodal AI → validated JSON → review UI → save questions.
- **Profile:** upload study PDFs → Storage → AI short description → used in Study chat retrieval.
- **Planner:** mostly the same daily plan, plus a Study button → persisted chat session fed by plan topics + relevant docs; deep-study prompt with 4 chunks + continue protocol.
- Replace browser Groq chat with the **server Cursor/Grok** path.

## Out of scope for early prompts

- Public marketplace / sharing other users' exams
- Removing Django

## Known old bugs — do NOT port

- Pause + finish **double-counting** attempts
- Dashboard STRONG/WEAK counters always `0`
- Silent truncation at page size `100`
- AI API keys in the frontend
