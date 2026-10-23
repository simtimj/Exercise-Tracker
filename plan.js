// Today's plan. Claude edits this file and pushes to main; the app shows it
// pinned at the top ("Focus — today") and under "Today's plan", on the
// matching date only. Nothing here is written to the sheet — logging a
// planned exercise uses logExercise() as usual.
//
// items: row = 1-based sheet row, name = column C text (used if rows moved),
// weight = prefill for the Weight box, target = shown as the plan, e.g. "3×15",
// note = optional one-liner shown under the exercise.
// Order = priority: PT first, then anything else.
const TODAY_PLAN = {
  date: '2026-10-23',
  items: [
    { row: 13, name: 'Side Lying Hip Abduction       2-3x a wk', weight: 'light band', target: '2×20',
      note: 'PT · longest gap (31 days). Your note: use light band next.' },
    { row: 16, name: 'Lateral Band Walks.   2-3x a wk', weight: 'thk red', target: '2×40',
      note: 'PT · 29 days.' },
    { row: 11, name: 'Weighted Step Ups         2-3x a wk', weight: '35lb', target: '2×30',
      note: 'PT · 29 days.' },
    { row: 25, name: 'Bird Dog 2 - 3x a wk', weight: '', target: '2×50',
      note: 'PT · 24 days. Core stab swap for yesterday\'s Dead Bugs.' },
    { row: 6, name: 'Romanian deadlift (RDL)   2x a wk', weight: '15lbx2', target: '3×12',
      note: 'PT · no date logged. Your note: do 15lbx2 next.' },
    { row: 8, name: 'Bulgarian Split Squat   2x a wk', weight: '25lb', target: '3×10',
      note: 'PT · no date logged. Optional if time is short.' },
  ],
};

if (typeof module !== 'undefined') module.exports = { TODAY_PLAN };
