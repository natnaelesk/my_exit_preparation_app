# 08 — Curriculum polish nits

**Branch:** `feat/08-curriculum-polish` from `main`  
**PR target:** `main`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md` before coding. Assume prompts **01–07** (including blueprint curriculum) are already on `main`.

## Goal

Fix leftover hardcoded “15 subjects” analytics UI and close curriculum gates that still allow questions/study without an active blueprint.

## Context

Encode these facts so the coding agent does not need chat history.

After prompt 07 / PR #14:

- Curriculum is **per-user** from MoE blueprint; **multi-history**; **one active**; empty canvas until apply.
- Exam **PDF** import publish is already blocked without curriculum (**409**).
- Review nits that remain:

### 1. Analytics still hardcodes 15

FE Analytics (and any sidebar / dashboard copy that says `n / 15 attempted` or computes “Not Started” as `15 - attempted`) still assumes the old CS list of 15 courses.

**Must** use the **active blueprint course count** (from `GET /api/subjects/` or active blueprint / subject-priorities length). If no active curriculum, show the empty CTA (do **not** invent 15).

### 2. JSON question create / bulk not server-gated

FE may validate subjects against curriculum, but `POST /api/questions/` and any bulk create path must also reject when the user has no active blueprint.

- Prefer **409** with `NO_CURRICULUM` / clear “upload blueprint first” message.
- Require subject ∈ active courses (reuse `match_course` / curriculum helpers).
- Mirror the exam-import publish gate.

### 3. Study docs / `/study` not behind RequireCurriculum

Study library upload and the `/study` route should nudge users without an active blueprint the same way Plan/Dashboard do (`RequireCurriculum` or equivalent empty CTA).

- Prefer consistent UX: no silent free-text subjects when canvas is empty.
- Study-doc AI subject tagging should match active courses; if no curriculum, **409** on create/describe that needs a subject (document the exact endpoints you gate).

### Optional (only if cheap in the same PR; otherwise list under Notes as follow-up)

- **Analytics subject rollup:** use fuzzy `match_course` so attempt subjects that almost match a course name roll up correctly (exact-match-only is a known weakness).
- **Blueprint apply:** require import status `ready` (or `failed` with a valid reviewed draft if you intentionally allow that — today apply allows some non-ready statuses if the body validates); tighten to match exam-import patterns and document the chosen rule.

## Constraints

- Commits/PR as **Natnael Eskinder** (`natnaelesk`) only — never Cursor Agent / `cursoragent` / bot identity.
- Do **not** remove blueprint multi-history / one-active behavior.
- Do **not** reintroduce `OFFICIAL_SUBJECTS` auto-seed.
- Keep Cursor SDK AI path.
- Branch from **`main`**, PR into **`main`**.
- Small focused PR — no marketplace, no stack change.

## Out of scope

- New blueprint extraction features
- Deploy/env rotation
- Large analytics redesign

## Acceptance criteria

- [ ] Analytics “Not Started” / “n / N attempted” (and any sibling UI) use active course count N, never hardcoded 15
- [ ] Empty curriculum: analytics/plan-style empty CTA, not fake 15 zeros
- [ ] Server rejects question create/bulk without active curriculum (409 + clear error)
- [ ] Server validates question subject against active courses
- [ ] `/study` (and study-doc create that needs a subject) gated consistently with RequireCurriculum / 409
- [ ] Tests cover: no-curriculum question create 409; analytics FE uses dynamic N (or backend returns courseCount if you add it)
- [ ] PR targets `main`
- [ ] Commits/PR authorship is Natnael Eskinder (`natnaelesk`) only

## Manual test path

1. User with no blueprint: Analytics does not show 15; Study redirects/CTA to Curriculum.
2. Apply a blueprint with e.g. 12 courses: Analytics Not Started / attempted denominator is 12.
3. Without curriculum, `POST /api/questions/` (and bulk if present) returns 409.
4. With curriculum, create question with a course name that fuzzy-matches; reject unknown subjects.

## Notes

- Grep for literal `15` in Analytics / Layout / Dashboard related to subject totals.
- Prefer reusing `active_course_names`, `NO_CURRICULUM`, `RequireCurriculum`.
- Optional follow-ups if not done here: fuzzy analytics rollup via `match_course`; tighten blueprint apply to `ready` (or documented exception for reviewed failed drafts).
