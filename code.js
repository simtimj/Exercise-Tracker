const SHEET_ID = '1oBtPYDCDiiXms0cqbfiymrAQ-qqLeI5OI7Ojee8Z_IY';
const TAB_NAME = 'V5: PT, Compound, Iso';

// Days until a muscle group counts as fully recovered (green).
// Placeholder values — tune these. Keys are matched case-insensitively
// against column A ("Variety"); anything not listed uses DEFAULT.
const RECOVERY_DAYS = {
  DEFAULT: 3,
  glute: 3,
  lower: 3,
  legs: 3,
  quads: 3,
  hamstrings: 3,
  'low back': 3,
  'upp back': 2,
  'up back': 2,
  back: 2,
  chest: 2,
  shoulders: 2,
  arms: 2,
  biceps: 2,
  triceps: 2,
  core: 1,
  abs: 1,
  calves: 1,
  pt: 1,
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Exercise Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheetData() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
  return sheet.getDataRange().getDisplayValues();
}

// Called by the UI: parsed groups + exercises with days since last trained.
function getTrackerData() {
  return parseRows(getSheetData(), new Date());
}

function recoveryDaysFor(group) {
  const key = String(group || '').trim().toLowerCase();
  return RECOVERY_DAYS[key] || RECOVERY_DAYS.DEFAULT;
}

// Pulls "M/D" out of free text like "9/22 Tues | …". No year in the sheet,
// so assume this year unless that lands more than a day in the future.
function parseSheetDate(text, today) {
  const m = String(text || '').match(/(\d{1,2})\s*\/+\s*(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  let d = new Date(today.getFullYear(), month, day);
  if (d - today > 24 * 3600 * 1000) d = new Date(today.getFullYear() - 1, month, day);
  return d;
}

function daysBetween(earlier, later) {
  const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b - a) / (24 * 3600 * 1000));
}

function isoDate(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function parseRows(rows, today) {
  const groups = [];
  const byName = {};
  let section = '';
  let currentGroup = '';

  rows.slice(1).forEach((row, i) => {
    const [a, b, c, d, e, f] = row.map(v => String(v || '').trim());
    if (!a && !b && !c && !d && !e && !f) return;

    // Section label rows (e.g. "PT (Try one …)"): no group, only a title in C.
    if (!a && c && !b && !d && !e && !f) {
      section = c;
      return;
    }
    if (!c) return;

    if (a) currentGroup = a;
    const groupName = currentGroup || 'Other';

    if (!byName[groupName]) {
      byName[groupName] = {
        name: groupName,
        recoveryDays: recoveryDaysFor(groupName),
        exercises: [],
        lastDate: null,
        daysSince: null,
      };
      groups.push(byName[groupName]);
    }
    const group = byName[groupName];

    const date = parseSheetDate(b, today);
    const exercise = {
      row: i + 2, // 1-based sheet row
      name: c,
      section: section,
      dateText: b,
      lastDate: date ? isoDate(date) : null,
      daysSince: date ? daysBetween(date, today) : null,
      sets: [d, e, f].filter(Boolean),
    };
    group.exercises.push(exercise);

    if (date && (group.daysSince === null || exercise.daysSince < group.daysSince)) {
      group.daysSince = exercise.daysSince;
      group.lastDate = exercise.lastDate;
    }
  });

  return { today: isoDate(today), groups: groups };
}

// Lets the code run under Node for local tests; ignored by Apps Script.
if (typeof module !== 'undefined') {
  module.exports = { parseRows, parseSheetDate, recoveryDaysFor };
}
