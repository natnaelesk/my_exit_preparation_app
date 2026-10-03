# 04 — Trust and UX fixes

**Branch:** `feat/04-trust-and-ux-fixes` from `dev-v0.2`  
**PR target:** `dev-v0.2`  
**Authorship:** Natnael Eskinder (`natnaelesk`) only

Read `prompts/VISION.md`. Assume prompts **01–03** are already merged on the branch you start from (auth, PDF exam import, study docs + Study chat). If 03 is not merged yet, base this work on the tip that includes 03 (same PR series / stacked branch is fine if your agent builds 03→05 sequentially).

## Goal

Fix the known **trust bugs and UX rough edges** that make the gift feel broken even when core features work: silent data truncation, bad API paths, double-counted attempts, dead dashboard counters, and leftover cold-start friction.

## Context — known old bugs (from VISION; fix these)

1. **Silent truncation at page size 100** — list endpoints / FE that only fetch the first page and pretend that is “all”. Raise page size and/or paginate until complete for owned lists the UI treats as full (questions, exams, attempts, imports, study docs, chats as relevant).
2. **`round-two` URL** — Subject priority “round two” (or similarly named) action uses a wrong path or method so it fails in production. Align FE call with Django route; add a quick regression test or documented manual check.
3. **Pause + finish double-counting attempts** — finishing a paused / resumed exam session must not create duplicate `Attempt` rows for the same answers. Deduplicate by session + question (or equivalent) on submit/finish.
4. **Dashboard STRONG/WEAK (or similar) counters always `0`** — wire them to real owned analytics (attempts / subject stats), not hardcoded zeros.
5. **Wake / cold-start polish leftovers** — keep using `apiClient` GET retries + banner; fix any new 03 surfaces that still show cryptic network errors on first hit after Render sleep.

## Constraints

- Owner-scoped everywhere; no `AllowAny` regressions.
- Prefer small, targeted fixes; do not redesign the product.
- Do **not** add marketplace, new AI features, or expand Study chat beyond what 03 already delivered.
- Commits/PR only as Natnael Eskinder / `natnaelesk`.

## Out of scope

- Gift-deploy checklist / env docs sweep (prompt 05)
- New study or exam AI flows
- Removing Django or changing hosting

## Acceptance criteria

- [ ] Owned list UIs that claim “all” data no longer silently stop at 100 (paginate or raise limit with a clear max)
- [ ] Round-two (subject priority reset) works end-to-end against the live API path
- [ ] Pause → resume → finish does not double-count attempts for the same question in a session
- [ ] Dashboard strength/weakness (or STRONG/WEAK) counters reflect real owned data
- [ ] Cold-start errors on touched screens stay user-readable (retry / waking banner)
- [ ] At least one backend or FE-level test / regression note for double-count or round-two
- [ ] PR targets `dev-v0.2`
- [ ] PR lists what was fixed and how to verify each item manually

## Notes

- Grep for `page_size`, `pageSize`, `100`, `round-two`, `round_two`, `STRONG`, `WEAK`, pause/finish handlers.
- If a “bug” was already fixed in 01–03, say so in the PR and skip.
