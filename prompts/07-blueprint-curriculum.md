# 07 — MoE blueprint → per-user curriculum

**Branch:** `feat/07-blueprint-curriculum` from `main`  
**PR target:** `main`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md` before coding. Assume prompts **01–06** are already on `main`.

## Goal

Stop showing a shared CS subject list. Each user starts with **zero curriculum topics**. They upload their MoE **exit-exam test blueprint PDF** → server Cursor SDK AI extracts curriculum → user reviews → apply saves that curriculum into the user’s **blueprint history** and can set it **active**. Exactly **one** blueprint is active at a time; the user can switch which history entry is active. Study sessions for a subject seed with that course’s blueprint focus notes.

## Context

Encode these facts so the coding agent does not need chat history.

### Bug today (shared CS leak)

- `SubjectPriorityViewSet.list` auto-creates one row per hardcoded `OFFICIAL_SUBJECTS` (15 CS courses) when the user has none.
- The same list lives in `backend/api/subjects.py`, `src/utils/constants.js`, exam/study AI prompts, Dashboard preview, and the analytics subjects endpoint.
- Ownership already exists (`owner` on `SubjectPriority`). Signup does **not** seed. The leak is the list endpoint + FE hardcoded lists.

### Product direction

- Product is **program-agnostic** Ethiopian exit-exam study (CS is only an example blueprint; Engineering, Nursing, etc. must work the same way with different course names).
- Curriculum / subjects come from the user’s **active** MoE exit-exam blueprint (themes/courses + focus notes), not a global subject list.
- Empty canvas = **zero topics** until the user uploads and applies a blueprint.

### UX / API pattern to mirror

- Mirror **exam import** (`ExamImport`, `PdfImport`): upload PDF → extract (background) → poll → review draft → apply.
- Do **not** mirror study-doc describe.
- AI: Cursor SDK only (`CURSOR_API_KEY`), server-side. Reuse existing `ai_client` / PDF page helpers from exam import (prompt 06).

### What a blueprint PDF contains (extract fields)

Example reference (do not commit the PDF): MoE “Test Blueprint for National Exit Examination” BSc Computer Science 2015 E.C. Typical fields:

- Program name
- Themes grouping courses
- Courses with credit hours
- Theme item share and per-course test item counts / weights (often out of 100 items)
- Learning outcomes / general objectives / cognitive domain breakdown (Remember…Create) — these become **focus notes** saved per course

Tables are often scanned/messy — use multimodal page images like exam import.

### Product decision: multi-history + one active

- Users can upload **multiple** blueprints over time; store each applied curriculum in **history**.
- Exactly **one active** blueprint at a time; the user can **switch** which history entry is active.
- Still require extract → review → apply (**no silent auto-save**).
- Applying a new blueprint **adds** to history and can set it active (default: newly applied becomes active).
- Switching active rebuilds that user’s `SubjectPriority` from the newly active blueprint’s courses.
- Do **not** model this as a single OneToOne that wipes history on re-apply.

## Recommended schema (migration `0010` — implementer owns exact names)

### `BlueprintImport`

Like `ExamImport`:

- `owner`
- `pdf`
- `status`: `pending` | `extracting` | `ready` | `failed` | `applied`
- `error`
- `draft` JSON
- timestamps

Draft JSON shape (document and validate exactly):

```json
{
  "programName": "Bachelor of Science Degree in Computer Science",
  "themes": [
    {
      "name": "System Development",
      "creditHours": null,
      "itemShare": 27,
      "order": 0,
      "courses": [
        {
          "name": "Software Engineering",
          "creditHours": 3,
          "itemCount": 6,
          "weight": 0.23,
          "focusNotes": "Bullet learning outcomes and where to focus (cognitive emphasis). Plain text.",
          "order": 0
        }
      ]
    }
  ]
}
```

### Applied history (many per user + one active)

Prefer something like:

- **`UserBlueprint`** (or `AppliedBlueprint`) — **many** rows per owner (FK, not OneToOne):
  - `owner`
  - `program_name`
  - optional FK to source `BlueprintImport`
  - `is_active` (boolean; enforce **at most one** active per owner)
  - `applied_at`
  - timestamps / optional label (e.g. filename or program short name for history UI)

- **`BlueprintCourse`** (or Theme + Course rows) — owned rows belonging to one `UserBlueprint`:
  - `name`, `theme_name`
  - `credit_hours`, `item_count`, item share / `weight`
  - `focus_notes`
  - `sort_order`
  - unique per blueprint + course name (or blueprint + order)

### Apply / activate behavior

On **apply** (transactional):

1. Create a new `UserBlueprint` (+ courses) from the reviewed draft (append to history — **do not** delete prior applied blueprints).
2. Set the new row `is_active=True`; set all of that user’s other blueprints `is_active=False`.
3. **Rebuild** that user’s `SubjectPriority` from the new active course list (`priority_order` by blueprint sort / item weight descending).
4. Delete the import PDF after apply (like exam import); mark the import `applied`.
5. Link the new `UserBlueprint` to the source import when useful.

On **switch active** (existing history entry):

1. Mark chosen blueprint active; deactivate the previous one (same owner only).
2. Rebuild `SubjectPriority` from the newly active courses (replace that user’s priority rows to match the active course set).

### Stop auto-seed forever

- Prefer a data migration that **clears existing auto-seeded `SubjectPriority` rows for all users** (gift users should upload/apply a blueprint again). Document that in PR / Notes.
- `GET` list endpoints must never recreate rows from `OFFICIAL_SUBJECTS`.

## API (owner-scoped, auth required)

- `POST /api/blueprint-imports/` — multipart PDF
- `POST /api/blueprint-imports/<id>/extract/` + poll `GET`
- `POST /api/blueprint-imports/<id>/apply/` — reviewed draft body; creates history entry and activates it
- `GET /api/blueprint/` — **current active** curriculum, or **404** if none
- `GET /api/blueprints/` (or equivalent) — list this user’s applied blueprint **history** (id, program name, applied_at, is_active)
- `POST /api/blueprints/<id>/activate/` — switch active blueprint; rebuilds priorities
- `GET /api/subjects/` (or extend priorities) — only the **active** blueprint’s course names; empty list if none — **never** invent `OFFICIAL_SUBJECTS`

## Must change behavior (acceptance)

1. `GET /api/subject-priorities/` returns `[]` when empty — **do not** create rows from `OFFICIAL_SUBJECTS`.
2. Analytics subjects / Dashboard / QuestionBank / CreateExam / Plan focus selection use the user’s **active** curriculum courses, not the hardcoded 15. If no active blueprint: empty states that nudge “Upload your exit exam blueprint”.
3. Exam import + study-doc AI subject validation: match against the user’s **active** applied courses (fuzzy normalize aliases still OK within that set). If no curriculum yet, reject publish with a clear “upload blueprint first” (prefer require blueprint; if you allow free-text subject, document why).
4. Study chat: when opening a session for a subject/course, inject that course’s `focusNotes` from the **active** blueprint into the system/context (in addition to plan topics / study docs). Soften tutor prompt so it is not hard-coded “Software Engineering student” / CS-only.
5. FE:
   - Blueprint upload entry (profile and/or empty plan/dashboard CTA)
   - Extract progress
   - Review editor (program name, themes, courses, credits, item counts, focus notes)
   - Apply confirmation
   - History list + **switch active** control
6. Tests: no auto-seed; owner scoping; apply appends history + activates; activate switches + rebuilds; empty user sees zero subjects; auth on new endpoints; no cross-user leak.

## Constraints

- Commits/PR as **Natnael Eskinder** (`natnaelesk`) only — never Cursor Agent / `cursoragent` / bot identity.
- Do **not** remove take-exam / study docs / exam import flows — rewire them to per-user **active** curriculum.
- Do **not** build marketplace / sharing.
- Keep Cursor SDK AI path from prompt 06.
- Cold-start friendly errors (reuse apiClient patterns).
- Branch from **`main`**, PR into **`main`**.

## Out of scope

- Shipping a default CS curriculum in the DB for anyone
- Auto-save without review
- Deleting old history entries (optional later; not required now)
- Changing hosting stack
- Marketplace / public sharing

## Acceptance criteria

- [ ] New signup / empty user: zero subject priorities, zero curriculum topics in UI
- [ ] User can upload MoE blueprint PDF, extract via server Cursor AI, review, apply
- [ ] Apply adds curriculum to that user’s history and sets it active (does not wipe prior history)
- [ ] User can switch which history entry is active; only one is active at a time
- [ ] Active courses become that user’s only subject list for plan / bank / analytics / exam tagging
- [ ] Switching active (or applying a new one as active) rebuilds `SubjectPriority` from that blueprint’s courses
- [ ] Study session for a course includes active blueprint focus notes in context
- [ ] `OFFICIAL_SUBJECTS` no longer auto-seeds or drives empty-state UI (legacy constant may remain only as temporary alias helper if needed — prefer delete usages)
- [ ] Backend tests for empty list, apply ownership, activate ownership, history retention, no cross-user leak
- [ ] PR targets `main`
- [ ] PR documents manual test with a sample blueprint PDF
- [ ] Commits/PR authorship is Natnael Eskinder (`natnaelesk`) only

## Manual test path

1. Fresh user (or cleared priorities): confirm Dashboard / plan / subjects show **empty** + CTA to upload blueprint — no 15 CS courses.
2. Upload a sample MoE exit-exam blueprint PDF (e.g. BSc Computer Science) → extract → review themes/courses/focus notes → apply.
3. Confirm active curriculum drives subject pickers and analytics; study chat for a course includes focus notes.
4. Upload a **second** blueprint (or same PDF again with edits) → apply → confirm history has two entries and the newest is active; subjects match the new courses.
5. Switch active back to the first history entry → subjects / priorities rebuild to the first curriculum.
6. Confirm another user cannot see imports, history, or curriculum.
7. After deploy: Render migrate via existing start command.

## Notes

- Sample extract target themes (CS example only): System Development, Programming and Algorithms, Computer Networking and Security, etc.
- Multimodal page images matter — blueprint tables are often photo/scan quality.
- Data migration clearing auto-seeded priorities is intentional gift reset: users re-upload their own program blueprint.
- Implementer owns exact model/endpoint names; preserve the behaviors above (multi-history, one active, review-before-apply, no `OFFICIAL_SUBJECTS` auto-seed).
