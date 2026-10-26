# Exercise Tracker

Standalone Google Apps Script web app on top of Julius's "Ex" Google Sheet. Goal: an easier-to-use UI than the sheet that shows how recently each exercise / muscle group was trained, color-coded as a heat map.

## Deploy

- Pushing to `main` runs `.github/workflows/deploy.yaml`: `clasp push --force`, then `clasp update-deployment $DEPLOYMENT_ID` (repo variable) so the live web app URL updates.
- Secret `CLASPRC_JSON` holds the clasp login. Never print or commit it.
- clasp only pushes `.js`, `.gs`, `.html` and `appsscript.json`; files like this one stay in GitHub only.
- Most changes are made from a phone via Claude, so keep commits small and working — every push to `main` goes live.

## Files

- `code.js` — server side: `doGet()` serves `Index`; `getSheetData()` returns the tab's display values; `getTrackerData()` → `parseRows()` returns groups (column A, carried down to blank-A rows) with exercises, last-trained date and days since. `AREAS` is the single recovery config: column A labels → six body areas with recovery days (unmapped → "Other", 2 days); each group carries `area` + `recoveryDays`, and `getTrackerData()` also returns `areas`. `logExercise(row, name, entry)` writes to the sheet (see Logging below). Exports for Node so the parser and the pure logging helpers can be tested locally with `node -e`.
- `Index.html` — client UI; calls server functions via `google.script.run`. Card layout (2026-10-25): one rounded section per category, each exercise a card with a soft heat tint, a 4px heat-colored left edge and a days pill (days / recoveryDays, red → green via `--hue`; saturation/tint are CSS vars `--heat-sat`, `--heat-light`, `--tint`, kept low on purpose — Julius asked for softer, less abrasive colors). Two sections side by side at ≥900px, one column on phones. Header + jump buttons are sticky. Days show the real count (no cap); no date counts as 30 days (`NO_DATE_DAYS`) for color and sort, pill says "no date". Note: Apps Script returns `null` fields as `undefined`, so always null-check with `== null`. View buttons: "Category" (default; PT, Compound, Isolation — the sheet's Abs section is shown under Isolation via `categoryOf()` — with muscle-group subheadings from column A in sheet order and done-this-week counts) and "Days" (one list, most days first, no-date last); "Done today" and "Plan" were removed 2026-10-25.
- Duplicate rows merged (2026-10-25): `mergeDupes()` collapses rows with the same category + group + `baseName()` into one card; each sheet row is a "slot". The card shows the newest slot's date/days, a `2–3×/wk` tag (the "2-3x a wk" text is stripped from the name by `splitName()`), `This wk ●●○` (slots done this Mon–Sun week), and Prev / Prev 2 = newest log of each slot, newest first. `recent` sorts dated slots before undated ones (fix 2026-10-25: an undated slot counts as 30 days and used to beat a real date older than that, showing "no date"). Logging writes to `ex.target`: the slot already logged today, else the first slot (sheet order) not done this week, else the oldest. Counts are per slot, so "X / N this week" still counts sheet rows.
- PT this week strip (2026-10-25): pinned in the sticky header under the view buttons. One line `PT this week [boxes] X / N done` — `segBar()` draws one box per PT exercise: full green = weekly goal met, partial amber fill = started; the count reads `0/9 done · 3 started` (amber text) so partial boxes are explained, then a single horizontally scrolling row of chips, one per merged PT exercise, sorted not-started → partial (amber) → met (green ✓); each shows `done/target`. Tapping a chip switches to Category and scrolls to/flashes that card. Weekly target `weekTarget` = low end of "2-3x a wk" (`freqMin`), capped at the number of sheet rows; `met` = weekDone ≥ weekTarget. Met PT cards get a ✓ before the name and dim slightly. Julius wants it obvious he's hit every PT exercise while using minimal space. The count is in **sessions** (`sum min(weekDone, weekTarget)` / `sum weekTarget`), so a 2×/wk exercise counts twice. Sticky top bar = header, jump buttons, PT strip only; the Just trained → Recovered legend sits under the All exercises divider.
- This week grids (2026-10-25, Julius): the sticky strip has tabs `PT · Compound · Isolation` (each with its session count; choice in localStorage `gridCat`), then for the chosen category: a total line `<Cat> this week [boxes] X/N done` and a two-column grid of muscle groups laid out by body part (`GRID_LAYOUT`: PT = Glute Med | Glute Max, Quads | Hamstrings, Core solo; Compound = Lats | Upper Back, Chest | Shoulders, Quads solo; Isolation = Upper/Middle Abs, Lower Abs/Obliques, Biceps/Triceps, Shoulders/Rear Delts, Upper Back/Calves). Each group's bar is one cluster per exercise (`.seg-cluster`, one box per session, width ∝ sessions) so repeats are visible: Core 1/4 = `[■□] [□□]`. All counts are in sessions (`sessOf()`). Tapping the total line opens every exercise of the category, grouped (`gridOpen = '*'`); tapping a group opens just that group (Left / Done, plus `PT_WHY` for PT). Panel rows: freshness dot, picture, done/target, left, days since, + Today / + Next. State `gridOpen`; tap again or ✕ to close. PT keeps its chip row underneath. The old Bonus line was replaced by the Compound / Isolation tabs.
- Freshness colors (2026-10-25, Julius: show what's falling behind): `freshOf(days, recoveryDays)` → red `f-red` = days < recovery (just done / resting — leave it), yellow `f-yellow` = recovered (< max(2×rec, rec+2) days), green `f-green` = falling behind — do this one. A group's color uses its most recently trained exercise. Dots on every grid group (green group names go bold), on panel subheads and rows; a tiny key (just done · ready · falling behind) sits under the grid. Filled session boxes in a group's bar use the same color as its dot (was always green).
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

- Each exercise row in the app has a Weight box (prefilled with the last weight used: leading text of the newest entry in that row, else any row of the same exercise) and a Sets box. Entry written = `<weight>: <reps>, <reps>` e.g. `25lbs: 20, 20` (changed from `<weight>, <sets>` 2026-10-25, Julius); reps typed with commas or spaces are tidied to `20, 20`; a plain number weight gets `lbs` appended. `weightOf()` reads the weight back from either format (text before the first `:` or `,`), so the Weight / band box prefills from the last log. Empty sets → confirm, then date only.
- Section headers show `X / N done this week` (rows whose last date is in the current Mon–Sun week).
- Column B: the date part is replaced with today in his style (`10/22 Thurs`); text after it (e.g. `| …`), hyperlinks and HYPERLINK formulas are kept. No date yet → `10/22 Thurs | <old text>`.
- Columns D onward: the new entry goes in D (right of the exercise); older entries in that row shift right with empty gaps squeezed out; columns are added at the end of the sheet if a row runs out of room. Newest is always leftmost.
- The server checks column C still matches the exercise name before writing (guards against a reordered sheet) and uses a script lock.

## Planned features

1. Parse V5 into exercises with muscle group + last-trained date; compute days since last trained per exercise and per group.
2. Heat-map UI: red = just trained ("hot"), cooling through orange/yellow to green = recovered and ready. Recovery times per muscle group are still to be decided — keep them in one config object.
3. "Today's plan" (built 2026-10-23): Claude proposes a day's plan as a table, Julius confirms, then Claude writes it into `plan.js` and pushes; it shows under the "Today's plan" button. See Plans below.
4. Suggested exercises — built and shipped 2026-10-25 (see below).
5. Editable recovery days — shipped 2026-10-25 (see below).
6. Suggested by area + Today / Up next picks — shipped 2026-10-25 (see below).

## Suggested exercises (built 2026-10-25)

Implementation notes: `suggestedExercises()` / `suggestSection()` in `Index.html`. Picks are computed "as of this morning" — logs dated today are ignored for area readiness and gaps (`realDaysBeforeToday`), so the list doesn't reshuffle while he logs; done-today picks sink and dim. Exercises already in today's plan are skipped. **Neglect ranking (2026-10-25):** both PT and bonus picks sort by `byNeglect` — most days since the body area was trained, then most days since the muscle group (column A, `groupStatus()`) was trained, then the exercise's own gap; within an area, bonus picks come from its most neglected group. A bold `Longest since: Push 13d · Legs 10d · Back 5d` line (top 3 ready areas) sits above Resting, and each pick shows `Area · Nd since` plus a `Group · Nd` tag. The section is collapsible (tap the header); collapsed by default when a plan exists. Area tag shows `Area · ready Nd` (or `no log`). Resting line lists unready areas with `until <weekday>`/`tomorrow`, plus any unmapped column A labels in amber. Original spec:

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

## Suggested — by area, longest since first (2026-10-25, replaces the category split)

- Julius uses Suggested most of the time; open by default with a solid accent border. The hint line and the "Everything is rested." line were removed (Julius, 2026-10-25); the Resting line shows only when an area is resting, and the "Rest days ✎" button now sits in the Suggested header (stopPropagation so it doesn't collapse the section).
- **PT first, always (Julius, 2026-10-25):** `suggestedExercises()` returns `pt` — every PT exercise still short of its weekly goal, as a "PT — do these first" block above everything. Rested ones (area ready + not done yesterday) lead, most days since the area first, then `byNeglect`; recently done ones (area resting / done yesterday) follow, still listed, tagged `Later · <reason>`. Even if all PT was done recently, anything still owed this week stays listed.
- **PT grouped by muscle focus (2026-10-25, Julius: "I'm not going to do a bunch of a single group at once"):** `suggestedExercises()` also returns `ptGroups` = the PT list split by body area (in practice Glutes/Hips, Legs, Core). Groups with a rested item lead, then most days since the area was trained. Each group gets a `PT · Legs · 31 days since` subhead (`ptGroupSub()`, adds `resting until …` when resting) with its weekly session count for that area (`2 / 8 this week`); a lead line `PT — do these first · 3 / 18 this week · pick a group:` sits above. Both use the same session math as the PT this week strip (`sessions()` over all PT, met included → `sug.ptWeek`, `g.week`), so the totals match the strip's 18. Same grouping in Pick view. Day counts are spelled out via `sinceText()` ("31 days since", not "31d" — Julius found the short form confusing). `sug.pt` (flat) is still used for counts and the This week summary.
- Secondary: `blocks` = the top `SUGGEST_AREAS` (3) ready areas, most days since trained first (`1. Arms · 80 days since`), each with the best Compound and best Isolation only (no PT), from the area's most neglected muscle group (`byNeglect`). Areas with nothing to pick are skipped.
- Open = full cards with a checkbox before the name; collapsed = compact one-line `pick-row`s (checkbox · name · `pickMeta()` = `PT · Hips · 33 days since`, always naming the muscle group (column A), or `PT · Hips · Later · <why>`; same meta in Pick view). Both are selectable.
- The old "Longest since" chip line and `jumpToArea()` were removed (the area subheads show it).
- **Nested tree (2026-10-25, Julius):** Suggested (full and Pick view) renders via `appendSuggestTree()` as category → area → exercises: `PT — do these first · 3 / 18 this week` (areas from `ptGroups`, each `Legs · 31 days since · 0 / 6 this week`), then `Compound` and `Isolation`, each with the `blocks` areas (longest since first) holding that category's pick. Category headings are small uppercase `.cat-head` lines; area groups are indented 12px with a 2px left rule (`.section.suggest .grp`). Area subheads come from `areaSub()`; the old numbered `1. Arms` blocks, the PT lead line and the "Then, by area" line are gone. Row meta (`pickMeta()`) no longer repeats the category: `Glute Med · 33 days since`.

## Layout + calmer colors (2026-10-25, Julius: "too much color, it blurs together")

- Category/Days order: **Today** (always shown; empty state "Nothing planned yet…") → **Suggested** → **Up next** (only if any) → an `All exercises` divider (`.zone`) → the category sections. Today and Suggested have dark headers (contrast, not color) so the pinned zones stand apart; gap between sections is 18px.
- Color reduced: cards and pick rows have no heat tint (`--tint: 0%`), only a 3px low-saturation left edge; days pill, area tags and PT/Bonus chips are neutral.
- Grouping (2026-10-25, "the groupings blur together — a touch of purple, mostly dark"): purple-tinted theme (`--bg`, `--card`, `--section`), each section a tinted frame with its own zone color (`--z-today`, `--z-suggest`, `--z-next` → `--zone`) on the border, header and a 4px stripe. `boxGroups()` wraps every `.sub` and its rows into a rounded `.grp` box (PT block, each area, each muscle group, To do / Done). Section headers are sticky under the top bar (`--top-h`, set by `setTopHeight()`), so you always see which section you're in. `.section` must not have `overflow: hidden` or sticky breaks. Checkboxes use the purple accent.
- Today keeps a record of the day: `To do` then `Done today ✓` subheads. Anything logged today joins Today even if it wasn't planned or picked (`plannedExercises()` adds it with `plan.logged`), so done-today items leave Suggested. Done items don't get Later/✕.
- Top buttons are **jump buttons**: Today · Suggested · Up next · All (scroll to `#today-sec`, `#suggest-sec`, `#next-sec`, `#all-sec` below the sticky header; `markZone()` highlights the one in view). "Done today" and "Plan" views were removed (Today covers both). The Category / Days sort is a small toggle on the "All exercises" divider (`setMode()`). Up next is always shown, with an empty state.
- One-tap add (2026-10-25): `quickAdd(ex, compact)` puts `+ Today` / `+ Next` buttons on every card not in Today (and compact ones on collapsed Suggested `pick-row`s, which keep their checkbox for bulk). Tapping an active `✓ Today` / `✓ Next` removes it; `✓ Today` is disabled when it came from the plan or a log, not a pick. Card layout: details (name, tags, facts) in the left column; a right `.side` column stacks the days count and small Today / Next buttons; log box spans full width.
- Streamlined look (2026-10-25, Julius: no "rounded squares inside rounded squares", follow best practices): one level of rounding — each section is a single rounded white panel (pinned zones get a 3px colored top border); inside everything is flat: groups split by a small label + hairline, rows by hairlines, tags as plain `·`-separated text, days pill as plain text, no facts box. These overrides sit at the end of the `<style>` block.

## Pick view (experiment, 2026-10-25)

- **View tabs (2026-10-25):** the header has two tabs, `Simple` · `Full` (the `Today` tab was removed 2026-10-25 — Julius found it nearly identical to Simple; a saved `today` choice falls back to Simple; its render branch was removed; its full Today cards now live in Simple) (Simple was "Pick"; renamed by Julius since it's basically Today + Suggestions — internal value is still `'pick'`) (`#view-tabs`, state `view` in localStorage `view`, falls back to the old `pickView` key; active tab filled with `--z-today`). The Notes button was removed from the header (panel code and server functions kept, guarded). **Today** view = only the Today section as full cards (facts + Weight/Sets log boxes, `sectionEl(... focus: true)`) with Up next below, then Suggested as compact rows with + Today / + Next (`compactSuggest()`, shared with Simple view); jump buttons hidden (`body.today-view`).
- Picks are optimistic: `savePicks()` sets `data.picks` and re-renders immediately, then the server copy replaces it (failure restores the old picks), so + Today / + Next show at once.
- Pick view (`view === 'pick'`, `pickView`, shown as **Simple**) hides the jump buttons. **Today** is full cards (2026-10-25, Julius: details + logging back in Simple) via `sectionEl({ focus: true })` — facts, Weight / band and Reps boxes (prefilled with last weight; `→ Next` (to Up next) / `✕` (off Today, back to Suggested) in the card's right column under the days; To do then Done today ✓). Below it, compact one-line `pv-row`s, no logging: **Up next** (`+ Today` / `✕`), **Suggested** (PT block + area blocks, each row with `+ Today` / `+ Next` via `quickAdd`; done-today items hidden). Code: `pickViewSections()`; `render()` returns early when `pickView` is on.

## Why PT (2026-10-25)

- Full view only: a collapsible "Why PT" panel at the very top, above This week (`whySection()`, folded state in localStorage `whyOpen`; folded = goal line only). Goal line `PT_WHY_GOAL` (take load off the lower back: tight low back, hip flexors and right-side QL from sitting; weak glutes/glute med make the QL compensate). Then one block per PT muscle group (column A, sheet order) listing its exercises and the reason from `PT_WHY` (Glute Max, Glute Med, Hamstrings, Quads, Core). Edit the text in those two constants. Julius's rehab context: QL and glute medius issues.

## This week summary (2026-10-25)

- "This week" card at the very top (`summarySection()` / `weekSummary()`, above Today; collapsible, folded state in localStorage `summaryOpen`, folded = top suggestion only). Two parts, rule-based, no AI:
  - **Going well** — no longer shown (Julius removed it 2026-10-25; `weekSummary()` still computes `good`). Was honest: counts real logs in the last `SUMMARY_DAYS` (7) per area; wording scales with the amount (≥6 "a lot of work on", ≥3 "a decent amount of", else "a little"), opener "Nice" only at ≥6 logs total. PT praise only for met/started; nothing logged → says so plainly.
  - **Suggestions** — PT owed first (names the first two rested ones), then up to 2 areas untouched ≥ `OVERDUE_DAYS` (7) in plain English with what they cover (`AREA_DETAIL`, e.g. "arms (biceps, triceps)") and the Suggested picks to try, then a lopsided-week note if one area is >50% of the work.
- Counts come from `data.history` plus each row's latest sheet date (deduped by date + row). **History:** `logExercise()` calls `recordHistory(row)` → user properties key `history`, `"YYYY-MM-DD|row"` strings, last 60 days / 500 entries (`appendHistory()`, exported for tests). Started 2026-10-25, so repeat sessions before then aren't counted. Never written to the sheet.
- Style (2026-10-25, "rounded squares inside rounded squares"): This week and Suggested are flat panels — `.grp` boxes there have no margin/border/radius, blocks split by a label + thin rule; Suggested cards have no inner facts box. Every summary point is `{ head, body }` rendered by `sumLine()`: `head` = the main idea, underlined but subdued — normal weight, muted color, thin underline (Julius) (`.key`); a 2px tinted rule separates Going well from Suggestions, `body` = muted details underneath. Suggested subheads underline the key part too (`PT`, `1. Arms`) — underline only, not bold (Julius) with the rest in `.sub-rest`.
- Julius might want AI coaching later (weekly scheduled Claude note into the repo, or the API with a key) — not built.

## Muscle group cleanup (2026-10-25, confirmed by Julius)

- Column A labels standardized: PT → Glute Max (bridge), Glute Med (side-lying abduction, band walks, clams), Hamstrings (RDL), Quads (BSS, step ups), Core (dead bugs, bird dog — was "Core Stab"). Compound → Lats (pull ups), Upper Back (barbell row), Quads (squat, walking lunge), Chest (bench, incline, dips), Shoulders (OHP). Abs (had no column A) → Upper Abs (decline crunch), Middle Abs (ab wheel, plank), Lower Abs (hanging knee raise), Obliques (side plank). Isolation → Shoulders, Biceps, Triceps, Calves, Rear Delts, Upper Back (one-arm row).
- `GROUP_RENAMES` in `code.js` (keyed by the start of the normalized name, longest key wins via `renameFor()`). `getTrackerData()` returns `renames` = `pendingGroupRenames(rows)`; while non-empty the app shows a one-time banner with an "Apply to sheet" button → `applyGroupRenames()` writes column A only (checks column C first, script lock). Banner disappears once the sheet matches. New exercises: add a row to `GROUP_RENAMES` or just type a known label in column A.
- `AREAS` keeps the old labels too, so nothing breaks before/after the rename. New labels: Glutes/Hips = glute max, glute med; Legs = quads, hamstrings, calves; Core = core, upper/middle/lower abs, obliques; Back = lats, upper back, lower back, rear delts; Push = chest, shoulders; Arms = biceps, triceps.
- Category view: abs subheads ordered Upper, Middle, Lower, Obliques (`GROUP_RANK`), everything else in sheet order.

## Picks: Today / Up next (2026-10-25)

- Ticking items fills `picked` (Set of exercise keys, tap order) and shows a fixed bottom `#pick-bar`: `N selected · Do today · Up next · ✕`.
- Saved via `savePicks(picks)` in **user properties** (key `picks`, JSON `{ today: { date, items }, next: [] }`, item `{ row, name, added }`, max 30 each, cleaned by `cleanPicks()`). `getTrackerData()` returns `picks` via `picksFor()` — today's picks only on their date.
- Today's picks join plan.js items in the Today section (was "Focus — today") (`plannedExercises()`, tag `Picked`, buttons `Later` → Up next and `✕` remove). Picked/planned exercises drop out of Suggested.
- Up next: a dashed section pinned under Focus (`upNextSection()`), rows with `Today` and `✕`; tapping the name jumps to its card. An item drops off once logged on a day after it was added (`upNextExercises()`); logged today it shows dimmed. Suggested cards/rows for Up next items get an `up next` tag.
- Today / Up next rows (full and Pick view) and Today cards show `areaGroup()` = body area + specific muscle group (`PT · Glutes/Hips · Glute Med · 33 days`; just `Core` when the same), via `pvMeta()` (Julius, 2026-10-25).
- Moving an exercise to one list removes it from the other (`movePicks()`). Claude can't read these from its workspace.

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
