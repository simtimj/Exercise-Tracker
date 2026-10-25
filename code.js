const SHEET_ID = '1oBtPYDCDiiXms0cqbfiymrAQ-qqLeI5OI7Ojee8Z_IY';
const TAB_NAME = 'V5: PT, Compound, Iso';

// Body areas: the single config for recovery. Column A labels ("Variety",
// lowercased + trimmed) map to an area; an area is "ready" once the days since
// anything in it was last trained reach `days`. Heat colors use the same days,
// so colors and suggestions agree. Unmapped labels → OTHER (shown as "Other").
const AREAS = {
  'Glutes/Hips': { days: 2, labels: ['glute', 'glutes', 'hips', 'glutes/hips', 'hip rotation'] },
  Legs: { days: 3, labels: ['lower', 'low', 'legs', 'quads', 'hamstrings', 'calves'] },
  Core: { days: 1, labels: ['core stab', 'core', 'abs'] },
  Back: { days: 2, labels: ['upp back', 'up back', 'upback', 'up bk', 'back', 'low back', 'delt'] },
  Push: { days: 2, labels: ['chest', 'chest, sh', 'shoulders', 'sh'] },
  Arms: { days: 2, labels: ['biceps', 'tricep', 'triceps'] },
};
const OTHER_AREA = { name: 'Other', days: 2 };

function areaFor(group) {
  const key = String(group || '').trim().toLowerCase();
  for (const name in AREAS) {
    if (AREAS[name].labels.includes(key)) return { name: name, days: AREAS[name].days };
  }
  return { name: OTHER_AREA.name, days: OTHER_AREA.days };
}

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
  const result = parseRows(getSheetData(), new Date());
  result.plan = planFor(typeof TODAY_PLAN === 'undefined' ? null : TODAY_PLAN, result.today);
  return result;
}

// Plan items for today only (TODAY_PLAN lives in plan.js); stale plans → [].
function planFor(plan, today) {
  if (!plan || plan.date !== today || !Array.isArray(plan.items)) return [];
  return plan.items.map(it => ({
    row: Number(it.row) || 0,
    name: String(it.name || ''),
    weight: String(it.weight || ''),
    target: String(it.target || ''),
    note: String(it.note || ''),
  }));
}

function recoveryDaysFor(group) {
  return areaFor(group).days;
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
  let prevBlank = true; // row 2 counts as following a blank

  rows.slice(1).forEach((row, i) => {
    const cells = row.map(v => String(v || '').trim());
    const [a, b, c] = cells;
    const sets = cells.slice(3).filter(Boolean); // D onward, newest first
    const blank = !a && !b && !c && !sets.length;
    const afterBlank = prevBlank;
    prevBlank = blank;
    if (blank) return;

    // Section label rows (e.g. "PT (Try one …)"): only a title in C, right
    // after an empty row. Name-only rows inside a section (e.g. "Plank") are
    // exercises, not labels.
    if (!a && c && !b && !sets.length && afterBlank) {
      section = c;
      currentGroup = '';
      return;
    }
    if (!c) return;

    if (a) currentGroup = a;
    const groupName = currentGroup || section.split(' (')[0] || 'Other';

    if (!byName[groupName]) {
      byName[groupName] = {
        name: groupName,
        area: areaFor(groupName).name,
        recoveryDays: areaFor(groupName).days,
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
      sets: sets,
    };
    group.exercises.push(exercise);

    if (date && (group.daysSince === null || exercise.daysSince < group.daysSince)) {
      group.daysSince = exercise.daysSince;
      group.lastDate = exercise.lastDate;
    }
  });

  const areas = Object.keys(AREAS).map(name => ({ name: name, days: AREAS[name].days }));
  areas.push({ name: OTHER_AREA.name, days: OTHER_AREA.days });
  return { today: isoDate(today), groups: groups, areas: areas };
}

// ---------- Logging (writes to the sheet) ----------

const DAY_NAMES = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
const DATE_RE = /\d{1,2}\s*\/+\s*\d{1,2}(\s+(Sun|Mon|Tues?|Wed|Thu(rs?)?|Fri|Sat)[a-z]*\.?)?/i;

function dateLabel(d) {
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + DAY_NAMES[d.getDay()];
}

// "9/22 Tues | notes" -> "10/22 Thurs | notes". No date yet -> date goes in front.
function replaceDateText(text, d) {
  const label = dateLabel(d);
  const t = String(text || '');
  if (DATE_RE.test(t)) return t.replace(DATE_RE, label);
  return t.trim() ? label + ' | ' + t.trim() : label;
}

// New entry goes first (column D); older entries shift right, gaps removed.
// Returns the row's new D-onward cells, at least as wide as before.
function buildSetCells(oldCells, entry) {
  const kept = oldCells.filter(v => String(v == null ? '' : v).trim() !== '');
  const cells = entry ? [entry].concat(kept) : kept;
  while (cells.length < oldCells.length) cells.push('');
  return cells;
}

// Called by the UI. row = 1-based sheet row; name guards against the sheet
// having been reordered since the app loaded. entry = text like "15,15,15".
function logExercise(row, name, entry) {
  entry = String(entry || '').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    const current = String(sheet.getRange(row, 3).getDisplayValue()).trim();
    if (current !== String(name).trim()) {
      throw new Error('Sheet changed (row ' + row + ' is now "' + current + '"). Reload and try again.');
    }
    const today = new Date();

    // Column B: swap in today's date, keep links / formulas / trailing text.
    const bCell = sheet.getRange(row, 2);
    const formula = bCell.getFormula();
    if (formula) {
      bCell.setFormula(DATE_RE.test(formula) ? formula.replace(DATE_RE, dateLabel(today)) : formula);
    } else {
      writeDateKeepingLinks(bCell, today);
    }

    // Columns D onward: new entry first, older ones pushed right.
    if (entry) {
      const width = Math.max(sheet.getLastColumn() - 3, 1);
      const range = sheet.getRange(row, 4, 1, width);
      const formulas = range.getFormulas()[0];
      const old = range.getValues()[0].map((v, i) => formulas[i] || v);
      const cells = buildSetCells(old, entry);
      const needCols = 3 + cells.length;
      if (needCols > sheet.getMaxColumns()) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), needCols - sheet.getMaxColumns());
      }
      sheet.getRange(row, 4, 1, cells.length).setValues([cells]);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return getTrackerData();
}

// Rewrites column B's text but keeps any hyperlinks in it.
function writeDateKeepingLinks(cell, today) {
  const rich = cell.getRichTextValue();
  const oldText = rich ? rich.getText() : String(cell.getDisplayValue());
  const newText = replaceDateText(oldText, today);
  const links = rich ? rich.getRuns().filter(r => r.getLinkUrl()) : [];
  if (!links.length) {
    cell.setValue(newText);
    return;
  }
  // Map old positions to new ones around the replaced date.
  const m = oldText.match(DATE_RE);
  const mStart = m ? m.index : 0;
  const mEnd = m ? m.index + m[0].length : 0;
  const delta = newText.length - oldText.length;
  const map = i => (i <= mStart ? i : i >= mEnd ? i + delta : Math.min(i, mStart + dateLabel(today).length));
  const builder = SpreadsheetApp.newRichTextValue().setText(newText);
  links.forEach(r => {
    const s = map(r.getStartIndex());
    const e = map(r.getEndIndex());
    if (e > s) builder.setLinkUrl(s, e, r.getLinkUrl());
  });
  cell.setRichTextValue(builder.build());
}

// ---------- App notes (temporary "Notes" side panel) ----------
// Stored in a Google Doc ("Exercise Tracker – App notes") so Claude can read
// them through the Drive connector. One paragraph per note; the first
// paragraph is the doc's title line and is skipped.

const NOTES_DOC_ID = '1223RvTJ4CyVsHe-AIpii5X8tj42lwDH-aJ4rhCIMG8g';

function notesFrom(texts) {
  return texts
    .map((text, i) => ({ i: i, text: String(text || '').trim() }))
    .filter(n => n.i > 0 && n.text);
}

function getNotes() {
  const body = DocumentApp.openById(NOTES_DOC_ID).getBody();
  return notesFrom(body.getParagraphs().map(p => p.getText()));
}

function addNote(text) {
  text = String(text || '').trim();
  if (!text) return getNotes();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    DocumentApp.openById(NOTES_DOC_ID).getBody().appendParagraph(dateLabel(new Date()) + ' — ' + text);
  } finally {
    lock.releaseLock();
  }
  return getNotes();
}

// i = paragraph index from getNotes(); text guards against the doc changing.
function removeNote(i, text) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = DocumentApp.openById(NOTES_DOC_ID).getBody();
    const paras = body.getParagraphs();
    const p = paras[i];
    if (!p || i === 0 || p.getText().trim() !== String(text).trim()) {
      throw new Error('Notes changed. Reopen the panel and try again.');
    }
    if (i === paras.length - 1) p.setText(''); // a doc can't lose its last paragraph
    else p.removeFromParent();
  } finally {
    lock.releaseLock();
  }
  return getNotes();
}

// Lets the code run under Node for local tests; ignored by Apps Script.
if (typeof module !== 'undefined') {
  module.exports = { parseRows, parseSheetDate, recoveryDaysFor, areaFor, replaceDateText, buildSetCells, planFor, notesFrom };
}
