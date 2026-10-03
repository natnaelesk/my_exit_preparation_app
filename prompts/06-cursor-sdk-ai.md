# 06 — Cursor SDK AI (no-repo cloud agents)

**Branch:** `feat/06-cursor-sdk-ai` from `main`  
**PR target:** `main`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md` before coding. Assume prompts **01–05** are already on `main`.

## Goal

Replace `backend/api/ai_client.py` OpenAI-compatible chat-completions with the **Cursor Python SDK** (`cursor-sdk`) using **no-repo cloud agents**, so PDF exam import, study-doc describe, and Study chat use `CURSOR_API_KEY`.

## Why

Natnael’s AI provider is **Cursor Ultra / Cursor SDK** (`crsr_…` key). The Cursor Cloud Agents API is **not** OpenAI `/chat/completions`. The current Django `requests`-based client cannot use that key. This prompt rebuilds the server AI layer around the SDK.

## Context / design

### 1. Dependency

- Install `cursor-sdk` (requires **Python ≥ 3.10**) in `backend/requirements.txt`.
- Confirm `runtime.txt` / Render Python version is ≥ 3.10 before merge.

### 2. Env vars (server only — never `VITE_`)

| Variable | Required | Notes |
|---|---|---|
| `CURSOR_API_KEY` | yes for AI | Cursor SDK key (`crsr_…`). Prefer this name. |
| `AI_API_KEY` | legacy fallback | Accept only if it starts with `crsr_`; otherwise treat as unset for the Cursor path. Prefer documenting migration to `CURSOR_API_KEY`. |
| `AI_BASE_URL` | ignore | Not used when the Cursor SDK path is active. |
| `AI_MODEL` / `CURSOR_MODEL` | optional | Model id from `Cursor.models.list()`. See defaults below. |
| `AI_TIMEOUT_SECONDS` (or a Cursor-specific wait) | optional | **Raise** for cloud agents — they are slower than chat-completions. Use **5–10 minutes** for exam-import batches / describe jobs. |

**Model defaults** (resolve via catalog / Router when available):

- **Vision / PDF exam import + study-doc describe:** prefer `auto-smart` with `optimize_for=intelligence` if available; else a vision-capable fixed model from `Cursor.models.list()`.
- **Study chat tutor:** prefer `auto-smart` with `optimize_for=balanced` (or `intelligence` if Router / optimize options are unavailable).

### 3. Implementation shape

- Keep a **single module** surface the rest of the code already calls: rewrite `ai_client.py`, **or** add `cursor_ai.py` and thin the old client. Export the same high-level helpers (`chat_completion`-like, or clearer `complete_text` / `complete_with_images`) plus existing exceptions and `parse_json_reply` / `is_configured`.
- Call sites today (`exam_extraction.py`, `study_docs.py`, `study_chat.py`, views error copy) should keep working with minimal churn.
- Use **no-repo** cloud agents:

```python
Agent.create(
    cloud=CloudAgentOptions(repos=[]),
    api_key=...,
    model=...,
)
```

- **One-shot jobs** (exam import page batch, study-doc describe):
  1. Create agent
  2. Send prompt (+ images via `SDKImage` / base64)
  3. `wait()` for the run
  4. Parse assistant text
  5. **Delete/archive** the agent so the account does not fill with one-off agents

- **Study chat:**
  - Add nullable `cursor_agent_id` on `StudySession` (+ migration).
  - First message: create agent, store id, send prompt, wait, persist reply.
  - Later messages: `Agent.resume(id)` then `send` so the conversation continues on the same cloud agent.
  - On session delete: archive/delete the Cursor agent if possible (best-effort; do not fail the DB delete if Cursor is down).

- **Prompt hygiene:** instruct the agent to reply with **only** the needed text/JSON (no tool-use narrative, no “I’ll help you…” preamble). Note: `tools=[]` is **local-only**; cloud agents cannot restrict tools — compensate with strict system instructions and the existing JSON tolerance in `parse_json_reply`.

- **Images:** exam pages / study first pages as PNG/JPEG base64; **max 5 images per send** (Cursor limit); keep existing batching (`EXAM_IMPORT_PAGES_PER_BATCH`, etc.) so batches stay ≤ 5.

### 4. Errors

Map SDK failures to the existing exception types so FE-facing messages stay clear:

| SDK / situation | Raise |
|---|---|
| Auth / bad key (`AuthenticationError` or equivalent) | `AIConfigError` |
| Rate limits / network / timeouts | `AIUnavailableError` |
| Empty reply or non-JSON when JSON was required | `BadAIOutput` |

Update “not configured” copy to mention `CURSOR_API_KEY` (and optionally legacy `AI_API_KEY` if documented).

### 5. Background jobs

- Keep `AI_JOBS_RUN_INLINE` / `background.py` behavior working so existing tests that run jobs inline stay green.
- Cloud agents are slow — timeouts and status/`thinking` UX must tolerate multi-minute waits on import/describe.

### 6. Docs

Update `docs/DEPLOY.md` and root `README.md`:

- Cursor SDK env vars (`CURSOR_API_KEY`, model defaults, longer timeouts).
- Note that **no-repo cloud agents must be enabled** for the Cursor account.
- AI remains **server-only** (never `VITE_` keys).

### 7. Tests

- **Mock the SDK** — do not call live Cursor in CI.
- Keep ownership / study / exam-import tests green (patch the high-level helpers or the SDK classes).
- Add at least **one unit test** that the client builds a **no-repo** cloud agent (`repos=[]`) and parses text/JSON from a fake run result.

### 8. Hard product rules

- Do **not** add marketplace / sharing.
- Do **not** put keys in the frontend.
- Commits/PR only as **Natnael Eskinder** (`natnaelesk`).

## Constraints

- Branch from **`main`**, PR into **`main`** (provider switch after 01–05 landed).
- Prefer a reviewable rewrite of the AI client over drive-by refactors of Study/exam UI.
- Do not change product UX beyond clearer “AI not configured” / timeout messaging if needed.
- Do not leave orphaned cloud agents after one-shot jobs when delete/archive APIs are available.

## Out of scope

- Marketplace / public sharing
- Switching away from Django
- Vector RAG / embeddings
- FE redesign
- Calling live Cursor from CI

## Acceptance criteria

- [ ] `cursor-sdk` is in `backend/requirements.txt`; runtime is Python ≥ 3.10
- [ ] Server reads `CURSOR_API_KEY` (with documented `crsr_` `AI_API_KEY` fallback or clear migration note)
- [ ] `AI_BASE_URL` is unused/ignored on the Cursor path
- [ ] PDF exam import, study-doc describe, and Study chat go through no-repo Cursor cloud agents
- [ ] One-shot agents are deleted/archived after use
- [ ] `StudySession.cursor_agent_id` exists; resume path used for follow-up Study messages; delete cleans up the agent when possible
- [ ] Vision and chat model defaults follow the `auto-smart` / `optimize_for` guidance (or documented catalog fallback)
- [ ] Wait timeouts raised for cloud-agent latency (e.g. 5–10 min for import batches)
- [ ] SDK auth → `AIConfigError`; rate limit/network → `AIUnavailableError`; bad JSON → `BadAIOutput`
- [ ] `AI_JOBS_RUN_INLINE` / background behavior still works; existing ownership tests stay green
- [ ] Unit test(s) mock the SDK: assert no-repo create + parse text/JSON from a fake result
- [ ] `docs/DEPLOY.md` + README document Cursor SDK env vars, no-repo requirement, server-only AI
- [ ] No marketplace; no AI keys in the frontend
- [ ] PR targets `main`
- [ ] Commits/PR authorship is Natnael Eskinder (`natnaelesk`) only

## Manual test path

1. Set `CURSOR_API_KEY=crsr_…` locally (and optionally unset `AI_BASE_URL` / old non-Cursor keys).
2. Confirm no-repo cloud agents are enabled on the Cursor account.
3. Upload `data/sample-study-notes.pdf` → description + subject/topics appear.
4. Upload `data/sample-exam-photo.pdf` → extract → review → publish.
5. Open Study from the planner → first chunk lands → **Continue** resumes the same session (same Cursor agent under the hood).
6. Confirm Render/Vercel still need only server-side `CURSOR_API_KEY` (no `VITE_` AI vars).

## Notes

- `tools=[]` cannot lock down cloud agents — strict prompts + `parse_json_reply` are the safety net for JSON jobs.
- Prefer deleting one-shot agents over leaving them listed in the Cursor dashboard.
- If the SDK API names differ slightly from this prompt (`CloudAgentOptions`, `SDKImage`, `wait`, archive/delete), follow the installed `cursor-sdk` docs while preserving the behaviors above.
