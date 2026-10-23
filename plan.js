// Today's plan. Claude edits this file and pushes to main; the app shows it
// under "Today's plan" on the matching date only. Nothing here is written to
// the sheet — logging a planned exercise uses logExercise() as usual.
//
// items: row = 1-based sheet row, name = column C text (used if rows moved),
// weight = prefill for the Weight box, target = shown as the plan, e.g. "3×15".
const TODAY_PLAN = {
  date: '',
  items: [],
};

if (typeof module !== 'undefined') module.exports = { TODAY_PLAN };
