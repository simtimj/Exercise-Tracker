# Exercise Tracker

Standalone Google Apps Script web app on top of Julius's "Ex" Google Sheet. Goal: an easier-to-use UI than the sheet that shows how recently each exercise / muscle group was trained, color-coded as a heat map.

## Deploy

- Pushing to `main` runs `.github/workflows/deploy.yaml`: `clasp push --force`, then `clasp update-deployment $DEPLOYMENT_ID` (repo variable) so the live web app URL updates.
- Secret `CLASPRC_JSON` holds the clasp login. Never print or commit it.
- clasp only pushes `.js`, `.gs`, `.html` and `appsscript.json`; files like this one stay in GitHub only.
- Most changes are made from a phone via Claude, so keep commits small and working — every push to `main` goes live.

## Files

- `code.js` — server side: `doGet()` serves `Index`; `getSheetData()` returns the tab's display values; `getTrackerData()` → `parseRows()` returns groups (column A, carried down to blank-A rows) with exercises, last-trained date and days since. `RECOVERY_DAYS` is the per-group recovery config (placeholder values). Exports for Node so the parser can be tested locally with `node -e`.
- `Index.html` — client UI; calls server functions via `google.script.run`. One bordered table per section (from the sheet's section label rows: PT, Compound, Iso…); two tables side by side at ≥900px wide, one column on phones. Rows: name, muscle-group tag, date text/sets, and a heat-colored days pill (days / recoveryDays, red → green). Days cap at 30 ("30+"); missing dates count as 30+. Note: Apps Script returns `null` fields as `undefined`, so always null-check with `== null`. Default sort "Ready first" (most overdue at top of each section), or sheet order.
- `appsscript.json` — V8, America/Los_Angeles, web app executes as the deploying user, access MYSELF.

## Source sheet

- Spreadsheet "Ex", ID `1oBtPYDCDiiXms0cqbfiymrAQ-qqLeI5OI7Ojee8Z_IY`. The sheet is the source of truth.
- Active tab: `V5: PT, Compound, Iso` (~128 rows, columns A–F). Older tabs (V4, v3, v2, v1) are history — don't write to them.
- Row 1 is headers; row 2 is a section label ("PT (Try one …)"), not an exercise.
- Column A — "Variety": muscle group / category (e.g. Glute, Lower).
- Column B — "Link for xDate": last-trained date as free text, e.g. `9/22 Tues | …`. No year; often blank on rows grouped under the row above. `i` appears as a marker in some rows.
- Column C — "Exercises": exercise name.
- Columns D–F — set logs as free text, e.g. `25lbs, 30, 25` or `20lbx2,   18…`.
- The sheet already has conditional formatting; the app should do its own color coding rather than read sheet colors.

## Planned features

1. Parse V5 into exercises with muscle group + last-trained date; compute days since last trained per exercise and per group.
2. Heat-map UI: red = just trained ("hot"), cooling through orange/yellow to green = recovered and ready. Recovery times per muscle group are still to be decided — keep them in one config object.
3. "Today's plan": Claude proposes a day's plan as a table, Julius confirms, then the chosen exercises get marked in the sheet and show as today's plan in the app.

## Conventions

- Mobile-first layout (mostly used on a phone).
- Don't change sheet structure or write to the sheet without Julius confirming the format first.
