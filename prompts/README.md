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
2. A **coding agent** (Natnael's local agent) implements that prompt on `feat/NN-...` branched from `dev-v0.2` and opens a PR **into** `dev-v0.2`.
3. **Study PM** reviews the PR (diff + acceptance criteria). If accepted → merge. If not → comment / follow-up on the same agent.
4. The **next numbered prompt** continues on the updated `dev-v0.2`.

## Prompt file conventions

- **Filename:** `NN-kebab-title.md`, zero-padded (`01`, `02`, …).
- Each prompt is **self-contained:** goal, context pointers, constraints, out-of-scope, acceptance criteria, test notes.
- Agents **must** read `prompts/VISION.md` before coding.
- **One prompt = one PR.** Keep scope small enough to review in one sitting.
- Copy `prompts/_TEMPLATE.md` when starting a new prompt.

## Locked roadmap (exactly 5 prompts)

| # | File | Status | What |
|---|------|--------|------|
| 01 | `01-auth-and-ownership.md` | ✅ merged | Auth + per-user ownership |
| 02 | `02-pdf-exam-import.md` | ✅ merged | PDF → multimodal AI → review → save Exam |
| 03 | `03-study-docs-and-chat.md` | next build | Study PDF library + planner Study chat (server AI, 4-chunk tutor) |
| 04 | `04-trust-and-ux-fixes.md` | planned | Trust/UX: page-size 100, `round-two` URL, pause double-count, dashboard STRONG/WEAK, wake polish leftovers |
| 05 | `05-gift-ready.md` | planned | Gift-ready polish: remove leftover FE AI keys/tutor, deploy/env checklist, cold-start copy, smoke path |

Do **not** add a 06 without an explicit product decision. Fold small leftovers into 04 or 05.

## Current prompts on disk

- `01-auth-and-ownership.md` — done
- `02-pdf-exam-import.md` — done
- `03-study-docs-and-chat.md` — ready for local build
- `04` / `05` — Study PM writes full specs after 03 merges (titles locked above)

## Authorship

Commits and PRs must be attributed only as **Natnael Eskinder** (`natnaelesk`). Never commit, co-author, or push as Cursor Agent, `cursoragent`, or any bot identity.
