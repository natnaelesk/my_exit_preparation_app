# Agent build loop (v0.2)

Working agreement for Study PM prompts and coding-agent PRs on the multi-user rewrite.

## Branches

| Branch | Role |
|--------|------|
| `main` | Stable / live |
| `dev-v0.2` | Integration branch for the multi-user rewrite |
| `feat/NN-short-slug` | One agent task, branched from `dev-v0.2`, PR targets `dev-v0.2` |

Do **not** open feature PRs into `main`. Do **not** commit as Cursor Agent / bot identities.

## Cycle

1. **Study PM** writes `prompts/NN-title.md` with a self-contained build task.
2. A **coding agent** (Natnael's local agent) implements that prompt on `feat/NN-...` and opens a PR **into** `dev-v0.2` (or one stacked series of PRs / commits for 03→05 if building the remaining set in one agent run).
3. **Study PM** reviews against acceptance criteria, then merges.
4. Next work continues on updated `dev-v0.2`.

## Locked roadmap (exactly 5 prompts)

| # | File | Status | What |
|---|------|--------|------|
| 01 | `01-auth-and-ownership.md` | ✅ merged | Auth + per-user ownership |
| 02 | `02-pdf-exam-import.md` | ✅ merged | PDF → multimodal AI → review → save Exam |
| 03 | `03-study-docs-and-chat.md` | ready | Study PDF library + planner Study chat |
| 04 | `04-trust-and-ux-fixes.md` | ready | Trust/UX: page-size, round-two, pause double-count, dashboard counters, wake polish |
| 05 | `05-gift-ready.md` | ready | Gift-ready: strip FE AI keys, deploy checklist, smoke path |

Do **not** add a 06 without an explicit product decision.

## Building 03–05 in one agent run

Allowed: one local agent implements **03, then 04, then 05** in order on one long-lived branch (e.g. `feat/03-05-remaining`) **or** three sequential `feat/03` → `feat/04` → `feat/05` branches, each PR into `dev-v0.2`. Prefer **separate PRs per prompt** when practical so Study PM can review; if one mega-PR is used, section the description by prompt number and acceptance checks.

## Prompt file conventions

- **Filename:** `NN-kebab-title.md`, zero-padded.
- Each prompt is **self-contained.** Agents **must** read `prompts/VISION.md` before coding.
- Copy `prompts/_TEMPLATE.md` when starting a new prompt.

## Authorship

Commits and PRs must be attributed only as **Natnael Eskinder** (`natnaelesk`). Never commit, co-author, or push as Cursor Agent, `cursoragent`, or any bot identity.
