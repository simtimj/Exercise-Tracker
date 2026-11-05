# Exercise Tracker

Google Apps Script web app on top of the "Ex" Google Sheet (tab `V5: PT, Compound, Iso`). An easier UI than the sheet: what's been trained, what's falling behind, what to do today, and quick logging. The sheet stays the source of truth. Every push to `main` deploys automatically. Deeper technical notes live in `CLAUDE.md`.

Last updated: 2026-11-05

## Status key

- ✅ **Working** — in use and confirmed
- 🧪 **To be confirmed** — shipped, waiting for Julius to try it
- 🔧 **To be improved** — works, but has known tweaks wanted
- 📋 **To do** — wanted, not built yet
- 💤 **Shelved** — built or tried, parked

---

## ✅ Working

**Views and layout**
- Two tabs: **Simple** (Today cards + Up next + compact Suggested) and **Full** (everything).
- Full view order: Why PT → This week → Today → Suggested → Up next → All exercises (Category or Days sort).
- Jump buttons (Today · Suggested · Up next · All), sticky section headers, calm purple theme, one level of rounding.
- **↻** refreshes the whole app (new deploys and data). **⋯** options panel top right.

**Reading the sheet**
- Exercises grouped by category (PT, Compound, Isolation — Abs shown under Isolation) and muscle group (column A).
- Duplicate rows merged into one card (each sheet row is a "slot", e.g. PT done 2–3×/wk).
- Days since last trained on every exercise; facts block: Last, This wk (dots + days done), Prev, Prev 2.
- Muscle group names cleaned up (one-time "Apply to sheet" banner when column A doesn't match).

**This week grids** (sticky, the center of the app)
- Tabs PT · Compound · Isolation with session counts; grid of muscle groups by body part, one box per session.
- Freshness dots: red = just done / resting, yellow = ready, green = falling behind (do this one).
- Tap the total line for all exercises, or a group for just that group (with + Today / + Next).

**Suggested — today**
- PT first, always: every PT still owed this week, grouped by area, rested ones leading, recently done ones tagged "Later · why".
- Then Compound and Isolation picks from the 3 most neglected ready body areas.
- Resting line (which areas rest until when) and **Rest days ✎** editor (recovery days per area, saved per account).
- Computed "as of this morning", so it doesn't reshuffle while logging.

- **⋯ options** (top right): "PT picks shown" (how many rows) and "PT order" — Least recent (default) or Spread. Tap anywhere outside to close; dragging/scrolling leaves it open (confirmed on tablet 2026-10-27).

**Today / Up next / picks**
- + Today / + Next on any exercise (one tap, tap again to undo); bulk select with checkboxes and the bottom bar.
- Today keeps To do and Done today ✓; anything logged today joins Today automatically.
- Up next items drop off once done on a later day.
- Claude-made plans (`plan.js`) show in Today on their date.

**Logging**
- Logs write to the sheet as `25lbs: 20, 20`: today's date in column B, newest entry in column D, older ones shift right.
- Logs also kept in a 60-day history for the This week summary.

**Extras**
- Why PT panel (the reason behind each PT group: take load off the lower back / QL, strengthen glutes and glute med).
- This week summary: plain-English suggestions (PT owed, areas untouched 7+ days, lopsided week).

## 🧪 To be confirmed (shipped 2026-10-26)

**Boxed Today cards (2026-11-05)**
- Every card in Today has a full rounded border in its freshness color, with a light tint inside: green = falling behind (do this one), yellow = ready, red = just done / resting. Same colors as the grid dots, in Simple and Full.

**Fold arrows on the grids (2026-11-05)**
- Each "PT this week", "Compound this week" and "Isolation this week" line has an arrow on its left. **▾** folds that category so only its line (progress bar + count) shows; **▸** expands it again. Tapping a folded line also expands it.
- Each category folds on its own (e.g. keep PT open, fold Compound and Isolation). Remembered on the device.

**All grids stacked (2026-11-04)**
- The PT · Compound · Isolation tabs are gone: all three "this week" grids now show at the top, one under the other (PT, then Compound, then Isolation). Tapping a total line or a muscle group still opens its panel, right under that category.
- The hide button moved to the top left, next to ↻: **▴** hides all the grids, **▸** brings them back. Remembered on the device.

**Set-by-set logging (2026-11-02)**
- **+ Add Set** saves one set at a time and replaces the Log box. Weight stays prefilled, and sets show on the card as 20, 15, 15.
- Tap a set to change or delete it. **Undo** appears for about 8 seconds after a save, change, delete or Complete.
- Optional rep goal per exercise, with progress like 35 / 50 reps. You can go over it, and only **Complete** finishes the exercise.
- The first set counts for recovery and the weekly boxes. Deleting every set in a session takes that back.
- Complete with no sets marks it done with the date only. Forgetting Complete costs nothing.
- Prev skips today and shows a total for sessions saved this way; older logs stay as written.
- Sets are saved in a new `Sets` tab and goals in a `Goals` tab of the Ex sheet.

**Suggested: least recent first (2026-11-02)**
- Suggested runs top to bottom from the exercise touched least lately. Never-logged exercises rank highest. This replaces the fixed PT rotation.
- Every Suggested row shows that exercise's own days since, using its newest entry across all its rows (2 bird dogs a week count as one exercise, latest date wins). It used to show the muscle group's number.
- PT that's resting or done yesterday still sits below rested PT, tagged "Later".

**Simple view Today, compact (2026-10-26)**
- Today cards sit two per row on a phone (more on a tablet), with smaller text and pictures; Prev 2 is hidden there to save space.

- **⇄ swap** on each PT row at the top of Suggested: switch that slot to a Compound or Isolation pick for today.
- Grid layout: groups fill the width in as many columns as fit (3 on a phone), short names with session boxes right after.
- Removed the "Suggested PT" chip row under the grid (the Suggested section covers it).
- Logging: weight and reps save together in one cell as `light red band: 20, 20`, shown as Prev next time; a weight with no reps now still saves the weight (was dropped).
- **Fits the screen** on phone, tablet and desktop: the main list was a grid column that grew to its widest content and pushed sections off the right edge of a phone; it now matches the screen width. On small phones the PT rotation rows give names two lines and tighter buttons. Checked at 360, 390, 820 and 1440px wide.
- **In Today marker on the grid cells**: an exercise loaded into Today (not done yet) shows its next session box in light purple with a purple ring, and its short name turns purple — Today's color, separate from the red/yellow/green freshness colors. Added to the color key as "in Today".

- **Up next marker on the grid cells (2026-10-27)**: an exercise in Up next shows its next session box in a lighter purple, with no ring, and its short name in light purple. Today keeps the darker purple box with the brighter ring, so the ring is the difference. Added to the color key as "up next".

## 🔧 To be improved

- Tweaking which exercises Suggested picks.
- Recovery times per muscle group/area are still being figured out (editable in Rest days ✎ meanwhile).

## 📋 To do

- Maybe: AI coaching note (weekly scheduled Claude note, or the API).

## 💤 Shelved

- Banner-free wrapper (GitHub Pages iframe to hide the Apps Script banner) — worked but felt too slow; code left in `wrapper/`.
- Notes panel (app to-dos in a Google Doc) — button removed from the header, code kept.

---

## Files

- `code.js` — server: reads the sheet, logging, picks, rest days, history, group renames.
- `Index.html` — the whole client UI.
- `plan.js` — today's plan written by Claude.
- `wrapper/` — shelved banner-free wrapper.
- `CLAUDE.md` — detailed notes for Claude.
