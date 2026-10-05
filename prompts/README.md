# Agent build loop (v0.2)

Working agreement for Study PM prompts and coding-agent PRs on the multi-user rewrite.

## Branches

| Branch | Role |
|--------|------|
| `main` | Stable / live |
| `dev-v0.2` | Integration branch for the multi-user rewrite (prompts 01–05) |
| `feat/NN-short-slug` | One agent task; **01–05** branched from / PR into `dev-v0.2`; **06+** from / into `main` unless a prompt says otherwise |

Do **not** commit as Cursor Agent / bot identities.

## Cycle

1. **Study PM** writes `prompts/NN-title.md` with a self-contained build task.
2. A **coding agent** (Natnael's local agent) implements that prompt on `feat/NN-...` and opens a PR into the target named in the prompt (`dev-v0.2` for 01–05, `main` for 06+).
3. **Study PM** reviews against acceptance criteria, then merges.
4. Next work continues on the updated integration branch (`dev-v0.2` historically; `main` after gift-ready / provider switch).

## Locked roadmap

| # | File | Status | What |
|---|------|--------|------|
| 01 | `01-auth-and-ownership.md` | ✅ merged | Auth + per-user ownership |
| 02 | `02-pdf-exam-import.md` | ✅ merged | PDF → multimodal AI → review → save Exam |
| 03 | `03-study-docs-and-chat.md` | ✅ merged | Study PDF library + planner Study chat |
| 04 | `04-trust-and-ux-fixes.md` | ✅ merged | Trust/UX: page-size, round-two, pause double-count, dashboard counters, wake polish |
| 05 | `05-gift-ready.md` | ✅ merged | Gift-ready: strip FE AI keys, deploy checklist, smoke path |
| 06 | `06-cursor-sdk-ai.md` | ✅ merged | Rebuild server AI on Cursor SDK no-repo cloud agents |
| 07 | `07-blueprint-curriculum.md` | ✅ merged | MoE blueprint PDF → per-user curriculum history (one active) |
| 08 | `08-curriculum-polish.md` | ready | Curriculum polish: dynamic analytics N, server question gates, study route gate |

Prompt **06** is an explicit product decision: Natnael’s provider is Cursor Ultra / Cursor SDK (`crsr_…`), not an OpenAI-compatible xAI `/chat/completions` endpoint. Implement 06 from `main` → PR into `main`.

Prompt **07+** (including **08**) still branches from / PRs into **`main`**. Prompt **07** replaces the shared CS subject list with per-user MoE blueprint curriculum (multi-history, one active). Prompt **08** is a small nit-fix after 07 (hardcoded 15 analytics, ungated JSON question create, study route curriculum gate).

## Building 03–05 in one agent run

Allowed historically: one local agent implements **03, then 04, then 05** in order. Prefer **separate PRs per prompt** when practical. Prompt **06** is standalone (AI provider rebuild) and should not be bundled with UI gift polish. Prompt **07** is standalone (blueprint curriculum) and should not be bundled with other roadmap items. Prompt **08** is a small focused polish PR and should stay separate.

## Prompt file conventions

- **Filename:** `NN-kebab-title.md`, zero-padded.
- Each prompt is **self-contained.** Agents **must** read `prompts/VISION.md` before coding.
- Copy `prompts/_TEMPLATE.md` when starting a new prompt.

## Authorship

Commits and PRs must be attributed only as **Natnael Eskinder** (`natnaelesk`). Never commit, co-author, or push as Cursor Agent, `cursoragent`, or any bot identity.
