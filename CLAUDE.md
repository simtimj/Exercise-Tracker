# Exercise Tracker

Standalone Google Apps Script web app on top of Julius's "Ex" Google Sheet. Goal: an easier-to-use UI than the sheet that shows how recently each exercise / muscle group was trained, color-coded as a heat map.

## Deploy

- Pushing to `main` runs `.github/workflows/deploy.yaml`: `clasp push --force`, then `clasp update-deployment $DEPLOYMENT_ID` (repo variable) so the live web app URL updates.
- Secret `CLASPRC_JSON` holds the clasp login. Never print or commit it.
- clasp only pushes `.js`, `.gs`, `.html` and `appsscript.json`; files like this one stay in GitHub only.
- Most changes are made from a phone via Claude, so keep commits small and working — every push to `main` goes live.

## Files

- `code.js` — server side: `doGet()` serves `Index`; `getSheetData()` returns the tab's display values; `getTrackerData()` → `parseRows()` returns groups (column A, carried down to blank-A rows) with exercises, last-trained date and days since. `AREAS` is the single recovery config: column A labels → six body areas with recovery days (unmapped → "Other", 2 days); each group carries `area` + `recoveryDays`, and `getTrackerData()` also returns `areas`. `logExercise(row, name, entry)` writes to the sheet (see Logging below). Exports for Node so the parser and the pure logging helpers can be tested locally with `node -e`.
- `Index.html` — client UI; calls server functions via `google.script.run`. Card layout (2026-10-25): one rounded section per category, each exercise a card with a soft heat tint, a 4px heat-colored left edge and a days pill (days / recoveryDays, red → green via `--hue`; saturation/tint are CSS vars `--heat-sat`, `--heat-light`, `--tint`, kept low on purpose — Julius asked for softer, less abrasive colors). Two sections side by side at ≥900px, one column on phones. Header + view buttons are sticky. Days show the real count (no cap); no date counts as 30 days (`NO_DATE_DAYS`) for color and sort, pill says "no date". Note: Apps Script returns `null` fields as `undefined`, so always null-check with `== null`. View buttons: "Category" (default; PT, Compound, Isolation — the sheet's Abs section is shown under Isolation via `categoryOf()` — with muscle-group subheadings from column A in sheet order and done-this-week counts), "Days" (one list, most days first, no-date last), "Done today" (last date is today) and "Plan".
- Duplicate rows merged (2026-10-25): `mergeDupes()` collapses rows with the same category + group + `baseName()` into one card; each sheet row is a "slot". The card shows the newest slot's date/days, a `2–3×/wk` tag (the "2-3x a wk" text is stripped from the name by `splitName()`), `This wk ●●○` (slots done this Mon–Sun week), and Prev / Prev 2 = newest log of each slot, newest first. Logging writes to `ex.target`: the slot already logged today, else the first slot (sheet order) not done this week, else the oldest. Counts are per slot, so "X / N this week" still counts sheet rows.
- PT this week strip (2026-10-25): pinned in the sticky header under the view buttons. One line `PT this week [boxes] X / N done` — `segBar()` draws one box per PT exercise: full green = weekly goal met, partial amber fill = started; the count reads `0/9 done · 3 started` (amber text) so partial boxes are explained, then a single horizontally scrolling row of chips, one per merged PT exercise, sorted not-started → partial (amber) → met (green ✓); each shows `done/target`. Tapping a chip switches to Category and scrolls to/flashes that card. Weekly target `weekTarget` = low end of "2-3x a wk" (`freqMin`), capped at the number of sheet rows; `met` = weekDone ≥ weekTarget. Met PT cards get a ✓ before the name and dim slightly. Julius wants it obvious he's hit every PT exercise while using minimal space.
- Bonus line (2026-10-25): under the PT strip, a thinner muted blue segmented bar (one box per non-PT exercise) `Bonus [boxes] +X of N` = non-PT (Compound + Isolation) exercises done at least once this week. Motivation only, deliberately quieter than PT; no chips.
- Facts block under each exercise (2026-10-25, replaced the inline boxes): a two-column `<dl class="facts">`, one row each — `Last` (date · `Oct wk 4 of 5` from his `wkN/5` text), `This wk` (one dot per session in the weekly goal, more if he went over, + `1 of 2`, + the days done this week as `M Th` using Su M T W Th F Sa; shown for PT and multi-row exercises), `Prev`, `Prev 2`. Labels sit in a fixed left column so values line up. The lone `i` marker is hidden; undated rows with other text show it as `Note`.
- Notes panel (temporary, 2026-10-23): "Notes" button in the header opens a right-side panel to add/remove app to-dos. Stored in the Google Doc "Exercise Tracker – App notes" (`NOTES_DOC_ID` in `code.js`, one paragraph per note, first paragraph is the title). Claude reads it with the Drive connector (`read_file_content`) when asked to work on the notes. Server: `getNotes()`, `addNote(text)`, `removeNote(i, text)`.
- `appsscript.json` — V8, America/Los_Angeles, web app executes as the deploying user, access MYSELF.

## Source sheet

- Spreadsheet "Ex", ID `1oBtPYDCDiiXms0cqbfiymrAQ-qqLeI5OI7Ojee8Z_IY`. The sheet is the source of truth.
- Active tab: `V5: PT, Compound, Iso` (~128 rows, columns A–F). Older tabs (V4, v3, v2, v1) are history — don't write to them.
- Row 1 is headers; row 2 is a section label ("PT (Try one …)"), not an exercise. Sections: PT, High ROI Compound, Abs, Isolation — each label is a C-only row right after an empty row. Name-only rows inside a section (e.g. "Plank") are exercises. Abs rows have no column A; their group falls back to the section name.
- PT exercises appear on ~3 rows each (2–3x a week); each row is logged independently, so "X / 25 done this week" counts rows.
- Column A — "Variety": muscle group / category (e.g. Glute, Lower).
- Column B — "Link for xDate": last-trained date as free text, e.g. `9/22 Tues | …`. No year; often blank on rows grouped under the row above. `i` appears as a marker in some rows.
- Column C — "Exercises": exercise name.
- Columns D–F — set logs as free text, e.g. `25lbs, 30, 25` or `20lbx2,   18…`.
- The sheet already has conditional formatting; the app should do its own color coding rather than read sheet colors.

## Logging (confirmed format, 2026-10-22)

- Each exercise row in the app has a Weight box (prefilled with the last weight used: leading text of the newest entry in that row, else any row of the same exercise) and a Sets box. Entry written = `<weight>, <sets>` like his existing `25lbs, 15,15,15`; a plain number weight gets `lbs` appended. Empty sets → confirm, then date only.
- Section headers show `X / N done this week` (rows whose last date is in the current Mon–Sun week).
- Column B: the date part is replaced with today in his style (`10/22 Thurs`); text after it (e.g. `| …`), hyperlinks and HYPERLINK formulas are kept. No date yet → `10/22 Thurs | <old text>`.
- Columns D onward: the new entry goes in D (right of the exercise); older entries in that row shift right with empty gaps squeezed out; columns are added at the end of the sheet if a row runs out of room. Newest is always leftmost.
- The server checks column C still matches the exercise name before writing (guards against a reordered sheet) and uses a script lock.

## Planned features

1. Parse V5 into exercises with muscle group + last-trained date; compute days since last trained per exercise and per group.
2. Heat-map UI: red = just trained ("hot"), cooling through orange/yellow to green = recovered and ready. Recovery times per muscle group are still to be decided — keep them in one config object.
3. "Today's plan" (built 2026-10-23): Claude proposes a day's plan as a table, Julius confirms, then Claude writes it into `plan.js` and pushes; it shows under the "Today's plan" button. See Plans below.
4. Suggested exercises — built and shipped 2026-10-25 (see below).
5. Editable recovery days — shipped 2026-10-25 (see below). Next: let Julius tweak picks.

## Suggested exercises (built 2026-10-25)

Implementation notes: `suggestedExercises()` / `suggestSection()` in `Index.html`. Picks are computed "as of this morning" — logs dated today are ignored for area readiness and gaps (`realDaysBeforeToday`), so the list doesn't reshuffle while he logs; done-today picks sink and dim. Exercises already in today's plan are skipped. The section is collapsible (tap the header); collapsed by default when a plan exists. Area tag shows `Area · ready Nd` (or `no log`). Resting line lists unready areas with `until <weekday>`/`tomorrow`, plus any unmapped column A labels in amber. Original spec:

Goal: the app suggests what to do today based on which body areas are rested, so a recently trained area (e.g. glutes) isn't suggested again.

- **Body areas.** Map each column A label (lowercased, trimmed) to one of six areas in a single `AREAS` config object, replacing/absorbing `RECOVERY_DAYS` in `code.js` (or a client-side config in `Index.html` — keep it in one place):
  - Glutes/Hips — glute, glutes, hips, glutes/hips, hip rotation
  - Legs — lower, low, legs, quads, hamstrings, calves
  - Core — core stab, core, abs (Abs rows have no column A; their group is "Abs")
  - Back — upp back, up back, upback, up bk, back, low back, delt (rear delt flys are a pull)
  - Push — chest, "chest, sh", shoulders, sh
  - Arms — biceps, tricep, triceps
  - Unmapped label → "Other", 2 days; show it so it's easy to spot and map later.
- **Recovery days per area (starting values):** Glutes/Hips 2, Legs 3, Core 1, Back 2, Push 2, Arms 2. An area is **ready** when days since the most recent exercise logged in that area ≥ its recovery days. The card heat colors should use the area's recovery days too, so colors and suggestions agree.
- **Picking (client side, from the merged exercises):**
  1. PT first: PT exercises that haven't met their weekly goal (`!ex.met`), weren't done today or yesterday (PT needs a rest day between sessions), and whose area is ready. Longest gap first. Max 4.
  2. Then bonus: for each ready area not already covered by a PT pick, the non-PT exercise with the longest gap (no-date = 30 days, as elsewhere). Max 1 per area, ~3 total.
  3. Cap the list at ~6–7 items.
- **UI:** a "Suggested — today" section pinned at the top of the Category and Days views (same card style as the Focus table, logging works the same). Each card gets a small `Glutes/Hips · ready 3d` style tag. Under the section header, one muted line listing resting areas: `Resting: Legs (until Tue) · Core (until Mon)`. If a `TODAY_PLAN` exists for today, show the plan's Focus table first and Suggested below it (or collapsed) — the confirmed plan wins.
- Items logged today drop to the bottom of Suggested and dim, like the Focus table.
- Test with the real sheet CSV via jsdom (export via the Drive connector `download_file_content` with `text/csv`), then ship.

## Editable recovery days (2026-10-25)

- "Rest days ✎" button on the Suggested section's Resting line opens an inline editor: one −/+ stepper per area (1–14 days), "default N" shown when changed, Save / Defaults.
- Saved via `saveAreaDays(days)` into Apps Script **user properties** (key `areaDays`, JSON) — not the sheet. Only values that differ from `AREAS` defaults are stored, so changing a default in code still applies. `loadAreaDays()` → `parseRows(rows, today, overrides)` → `areaFor(group, overrides)`; `areas` now includes `defaultDays`. Heat colors and suggestions both use the saved values.
- Claude can't read user properties from its workspace; ask Julius for his current values if they matter.

## Plans

- Claude can't reach Google from its workspace (script.google.com and the Sheets API are blocked), so it can't write to the sheet directly. Plans go through GitHub instead: edit `TODAY_PLAN` in `plan.js` and push to `main` (deploys in ~1 min).
- Format: `{ date: 'YYYY-MM-DD', items: [{ row, name, weight, target, note }] }`. Item order = priority (PT first). `note` is an optional one-liner shown under the exercise (why it was picked, his sheet notes). `row` = 1-based sheet row and `name` = exact column C text (read them from the sheet via the Google Drive connector, which can read but not edit it). `weight` prefills the Weight box; `target` is shown as the plan, e.g. `3×15`.
- `planFor()` in `code.js` only returns the plan when `date` is today, so old plans disappear by themselves. Items are matched by row + name, falling back to name if rows moved.
- Focus table (2026-10-23): today's plan is pinned as a "Focus — today" table at the top of the Category and Days views (dark header), as well as under the "Today's plan" button. Not-yet-done items stay in plan order; items logged today sink to the bottom and dim.
- Picking a plan: PT over everything, prefer exercises not done in the last session, longest gap first.
- The plan itself is never written to the sheet. Tapping Log on a planned row uses `logExercise()` (confirmed format above), which is what lands in the sheet.

## Shortcuts

- "Ship it": make the change, test it (`node -e` / `node --check`), commit and push to `main`, wait for the deploy run to pass, then show Julius what changed.
- "Stage it": describe the change for review before pushing.

## Conventions

- Mobile-first layout (mostly used on a phone).
- Don't change sheet structure or write to the sheet without Julius confirming the format first.
