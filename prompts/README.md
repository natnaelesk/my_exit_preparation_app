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
2. A **coding agent** implements that prompt on `feat/NN-...` branched from `dev-v0.2` and opens a PR **into** `dev-v0.2`.
3. **Study PM** reviews the PR (diff + acceptance criteria). If accepted → merge. If not → comment / follow-up on the same agent.
4. The **next numbered prompt** continues on the updated `dev-v0.2`.

## Prompt file conventions

- **Filename:** `NN-kebab-title.md`, zero-padded (`01`, `02`, …).
- Each prompt is **self-contained:** goal, context pointers, constraints, out-of-scope, acceptance criteria, test notes.
- Agents **must** read `prompts/VISION.md` before coding.
- **One prompt = one PR.** Keep scope small enough to review in one sitting.
- Copy `prompts/_TEMPLATE.md` when starting a new prompt.

## Authorship

Commits and PRs must be attributed only as **Natnael Eskinder** (`natnaelesk`). Never commit, co-author, or push as Cursor Agent, `cursoragent`, or any bot identity.
