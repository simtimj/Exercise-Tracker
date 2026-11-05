const SHEET_ID = '1oBtPYDCDiiXms0cqbfiymrAQ-qqLeI5OI7Ojee8Z_IY';
const TAB_NAME = 'V5: PT, Compound, Iso';

// Body areas: the single config for recovery. Column A labels ("Variety",
// lowercased + trimmed) map to an area; an area is "ready" once the days since
// anything in it was last trained reach `days`. Heat colors use the same days,
// so colors and suggestions agree. Unmapped labels → OTHER (shown as "Other").
const AREAS = {
  'Glutes/Hips': { days: 2, labels: ['glute max', 'glute med', 'glute', 'glutes', 'hips', 'glutes/hips', 'hip rotation'] },
  Legs: { days: 3, labels: ['quads', 'hamstrings', 'calves', 'lower', 'low', 'legs'] },
  Core: { days: 1, labels: ['core', 'upper abs', 'middle abs', 'lower abs', 'obliques', 'core stab', 'abs'] },
  Back: { days: 2, labels: ['lats', 'upper back', 'lower back', 'rear delts', 'upp back', 'up back', 'upback', 'up bk', 'back', 'low back', 'delt'] },
  Push: { days: 2, labels: ['chest', 'shoulders', 'chest, sh', 'sh'] },
  Arms: { days: 2, labels: ['biceps', 'triceps', 'tricep'] },
};

// Muscle group (column A) cleanup, confirmed by Julius 2026-10-25. Keys are
// the start of the normalized exercise name (normName). applyGroupRenames()
// writes these to column A once; pendingGroupRenames() lists what's left.
const GROUP_RENAMES = [
  ['1 leg weighted glute bridge', 'Glute Max'],
  ['side lying hip abduction', 'Glute Med'],
  ['lateral band walks', 'Glute Med'],
  ['clam shells', 'Glute Med'],
  ['romanian deadlift', 'Hamstrings'],
  ['bulgarian split squat', 'Quads'],
  ['weighted step ups', 'Quads'],
  ['dead bugs', 'Core'],
  ['bird dog', 'Core'],
  ['pull ups', 'Lats'],
  ['barbell row', 'Upper Back'],
  ['one-arm dumbbell row', 'Upper Back'],
  ['rear delt flys', 'Rear Delts'],
  ['squat', 'Quads'],
  ['walking lunge', 'Quads'],
  ['bench press', 'Chest'],
  ['incline bench press', 'Chest'],
  ['dips', 'Chest'],
  ['overhead press', 'Shoulders'],
  ['lateral raise', 'Shoulders'],
  ['decline crunch', 'Upper Abs'],
  ['ab wheel', 'Middle Abs'],
  ['plank', 'Middle Abs'],
  ['hanging knee raise', 'Lower Abs'],
  ['side plank', 'Obliques'],
  ['bicep curl', 'Biceps'],
  ['triceps extension', 'Triceps'],
  ['weighted calf raise', 'Calves'],
];

function normName(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Longest matching key wins ("side plank" over "plank" can't clash since
// both start the name, but "incline bench press" vs "bench press" can).
function renameFor(name) {
  const n = normName(name);
  let best = null;
  GROUP_RENAMES.forEach(([key, label]) => {
    if ((n === key || n.startsWith(key + ' ') || n.startsWith(key + '.') || n.startsWith(key + '('))
      && (!best || key.length > best[0].length)) best = [key, label];
  });
  return best ? best[1] : null;
}

// Rows (1-based) whose column A differs from the confirmed label.
function pendingGroupRenames(rows) {
  const out = [];
  rows.forEach((row, i) => {
    if (i === 0) return;
    const label = renameFor(row[2]);
    if (label && String(row[0] || '').trim() !== label) out.push({ row: i + 1, name: String(row[2]).trim(), from: String(row[0] || '').trim(), to: label });
  });
  return out;
}

// Called once from the app's banner: writes the new labels to column A only.
function applyGroupRenames() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    pendingGroupRenames(sheet.getDataRange().getDisplayValues()).forEach(r => {
      if (String(sheet.getRange(r.row, 3).getDisplayValue()).trim() === r.name) sheet.getRange(r.row, 1).setValue(r.to);
    });
  } finally {
    lock.releaseLock();
  }
  return getTrackerData();
}
const OTHER_AREA = { name: 'Other', days: 2 };

// Julius's own recovery days (edited in the app) override the defaults above.
// Stored as JSON in user properties under AREA_DAYS_KEY — never in the sheet.
const AREA_DAYS_KEY = 'areaDays';
const AREA_DAYS_MIN = 1;
const AREA_DAYS_MAX = 14;

function areaDaysFor(name, overrides) {
  const o = overrides && overrides[name];
  if (Number.isInteger(o)) return o;
  return name === OTHER_AREA.name ? OTHER_AREA.days : AREAS[name].days;
}

function areaFor(group, overrides) {
  const key = String(group || '').trim().toLowerCase();
  for (const name in AREAS) {
    if (AREAS[name].labels.includes(key)) return { name: name, days: areaDaysFor(name, overrides) };
  }
  return { name: OTHER_AREA.name, days: areaDaysFor(OTHER_AREA.name, overrides) };
}

// Keeps only known areas with whole days in range.
function cleanAreaDays(input) {
  const out = {};
  const names = Object.keys(AREAS).concat(OTHER_AREA.name);
  Object.keys(input || {}).forEach(name => {
    const n = Number(input[name]);
    if (names.includes(name) && Number.isInteger(n) && n >= AREA_DAYS_MIN && n <= AREA_DAYS_MAX) out[name] = n;
  });
  return out;
}

// props = all user properties when the caller already read them.
function readProp(props, key) {
  return props ? props[key] : PropertiesService.getUserProperties().getProperty(key);
}

function loadAreaDays(props) {
  try {
    return cleanAreaDays(JSON.parse(readProp(props, AREA_DAYS_KEY) || '{}'));
  } catch (e) {
    return {};
  }
}

// Called by the UI. days = { areaName: n }; only values that differ from the
// defaults are kept, so changing a default later still takes effect.
function saveAreaDays(days) {
  const clean = cleanAreaDays(days);
  Object.keys(clean).forEach(name => { if (clean[name] === areaDaysFor(name, null)) delete clean[name]; });
  PropertiesService.getUserProperties().setProperty(AREA_DAYS_KEY, JSON.stringify(clean));
  return getTrackerData();
}

// Exercises Julius picked in the app: "today" (joins the Focus table, today
// only) and "next" (Up next list, kept until done). Stored in user properties
// under PICKS_KEY — never in the sheet. Item = { row, name, added: 'YYYY-MM-DD' }.
const PICKS_KEY = 'picks';
const PICKS_MAX = 30;

function cleanPickList(list) {
  return (Array.isArray(list) ? list : []).slice(0, PICKS_MAX).map(it => ({
    row: Number(it && it.row) || 0,
    name: String((it && it.name) || '').slice(0, 200),
    added: /^\d{4}-\d{2}-\d{2}$/.test(String(it && it.added)) ? String(it.added) : '',
  })).filter(it => it.name);
}

function cleanPicks(p) {
  p = p || {};
  const t = p.today || {};
  return {
    today: { date: /^\d{4}-\d{2}-\d{2}$/.test(String(t.date)) ? String(t.date) : '', items: cleanPickList(t.items) },
    next: cleanPickList(p.next),
  };
}

function loadPicks(props) {
  try {
    return cleanPicks(JSON.parse(readProp(props, PICKS_KEY) || '{}'));
  } catch (e) {
    return cleanPicks(null);
  }
}

// What the UI sees: today's picks only on their date; Up next as stored.
function picksFor(p, today) {
  return { today: p.today.date === today ? p.today.items : [], next: p.next };
}

// Called by the UI with the whole picks object { today: { date, items }, next }.
function savePicks(picks) {
  PropertiesService.getUserProperties().setProperty(PICKS_KEY, JSON.stringify(cleanPicks(picks)));
  return getTrackerData();
}

// Log history for the summary card. The sheet keeps only the latest date per
// row, so each Log also saves "YYYY-MM-DD|row" here (user properties, newest
// last, HISTORY_DAYS / HISTORY_MAX kept). Never written to the sheet.
const HISTORY_KEY = 'history';
const HISTORY_DAYS = 60;
const HISTORY_MAX = 500;

function appendHistory(list, todayIso, row) {
  const cutoff = new Date(todayIso + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);
  const min = isoDate(cutoff);
  const entry = todayIso + '|' + row;
  const out = (Array.isArray(list) ? list : []).filter(e => typeof e === 'string' && e.slice(0, 10) >= min && e !== entry);
  out.push(entry);
  return out.slice(-HISTORY_MAX);
}

function removeHistory(list, iso, row) {
  const entry = iso + '|' + row;
  return (Array.isArray(list) ? list : []).filter(e => e !== entry);
}

function dropHistory(iso, row) {
  try {
    PropertiesService.getUserProperties().setProperty(HISTORY_KEY, JSON.stringify(removeHistory(loadHistory(), iso, row)));
  } catch (e) {
    // Same as recordHistory: never block a save on the summary history.
  }
}

function loadHistory(props) {
  try {
    const list = JSON.parse(readProp(props, HISTORY_KEY) || '[]');
    return Array.isArray(list) ? list.filter(e => typeof e === 'string') : [];
  } catch (e) {
    return [];
  }
}

function recordHistory(row) {
  try {
    const list = appendHistory(loadHistory(), isoDate(new Date()), row);
    PropertiesService.getUserProperties().setProperty(HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    // History is a nice-to-have; never block a log on it.
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Exercise Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // Lets the GitHub Pages wrapper (no Apps Script banner) frame the app.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Web app URL, so the client's ↻ button can reload the whole page (new code + data).
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

function getSheetData() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
  return sheet.getDataRange().getDisplayValues();
}

// Called by the UI: parsed groups + exercises with days since last trained.
function getTrackerData() {
  // One open, one properties read: every extra Google call here is felt on each load.
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const props = PropertiesService.getUserProperties().getProperties();
  const rows = ss.getSheetByName(TAB_NAME).getDataRange().getDisplayValues();
  const result = parseRows(rows, new Date(), loadAreaDays(props));
  result.renames = pendingGroupRenames(rows);
  result.plan = planFor(typeof TODAY_PLAN === 'undefined' ? null : TODAY_PLAN, result.today);
  result.picks = picksFor(loadPicks(props), result.today);
  result.history = loadHistory(props);
  result.sessions = summarizeSessions(readSetRows(ss), result.today);
  result.goals = readGoals(ss);
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

function recoveryDaysFor(group, overrides) {
  return areaFor(group, overrides).days;
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

function parseRows(rows, today, overrides) {
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
        area: areaFor(groupName, overrides).name,
        recoveryDays: areaFor(groupName, overrides).days,
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

  const areas = Object.keys(AREAS).concat(OTHER_AREA.name).map(name => ({
    name: name,
    days: areaDaysFor(name, overrides),
    defaultDays: areaDaysFor(name, null),
  }));
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
    stampDate(sheet, row, new Date());
    if (entry) addEntry(sheet, row, entry);
    SpreadsheetApp.flush();
    recordHistory(row);
  } finally {
    lock.releaseLock();
  }
  return getTrackerData();
}

// Column B: swap in today's date, keep links / formulas / trailing text.
function stampDate(sheet, row, today) {
  const bCell = sheet.getRange(row, 2);
  const formula = bCell.getFormula();
  if (formula) {
    bCell.setFormula(DATE_RE.test(formula) ? formula.replace(DATE_RE, dateLabel(today)) : formula);
  } else {
    writeDateKeepingLinks(bCell, today);
  }
}

// Columns D onward: new entry first, older ones pushed right.
function setCellsRange(sheet, row) {
  return sheet.getRange(row, 4, 1, Math.max(sheet.getLastColumn() - 3, 1));
}

function oldSetCells(range) {
  const formulas = range.getFormulas()[0];
  return range.getValues()[0].map((v, i) => formulas[i] || v);
}

function addEntry(sheet, row, entry) {
  const cells = buildSetCells(oldSetCells(setCellsRange(sheet, row)), entry);
  const needCols = 3 + cells.length;
  if (needCols > sheet.getMaxColumns()) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), needCols - sheet.getMaxColumns());
  }
  sheet.getRange(row, 4, 1, cells.length).setValues([cells]);
}

// Rewrites column B's text but keeps any hyperlinks in it.
function writeDateKeepingLinks(cell, today) {
  const rich = cell.getRichTextValue();
  const oldText = rich ? rich.getText() : String(cell.getDisplayValue());
  writeTextKeepingLinks(cell, replaceDateText(oldText, today));
}

// Only the changed middle moves; links before and after it keep their text.
function writeTextKeepingLinks(cell, newText) {
  const rich = cell.getRichTextValue();
  const oldText = rich ? rich.getText() : String(cell.getDisplayValue());
  const links = rich ? rich.getRuns().filter(r => r.getLinkUrl()) : [];
  if (!links.length || !newText) {
    cell.setValue(newText);
    return;
  }
  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start++;
  let tail = 0;
  while (tail < oldText.length - start && tail < newText.length - start
    && oldText[oldText.length - 1 - tail] === newText[newText.length - 1 - tail]) tail++;
  const mEnd = oldText.length - tail;
  const delta = newText.length - oldText.length;
  const map = i => (i <= start ? i : i >= mEnd ? i + delta : Math.min(i, newText.length - tail));
  const builder = SpreadsheetApp.newRichTextValue().setText(newText);
  links.forEach(r => {
    const s = map(r.getStartIndex());
    const e = map(r.getEndIndex());
    if (e > s) builder.setLinkUrl(s, e, r.getLinkUrl());
  });
  cell.setRichTextValue(builder.build());
}

// ---------- Set-by-set logging (tabs "Sets" and "Goals" in the Ex sheet) ----------
// Each set is one row in Sets. The V5 row stays readable: the first set stamps
// column B and adds a D entry, later changes rewrite only that entry, and
// deleting a session's last set puts column B back and removes the entry.

const SETS_TAB = 'Sets';
const GOALS_TAB = 'Goals';
const SET_HEADERS = ['Set ID', 'Session ID', 'Date', 'Row', 'Exercise', 'Order', 'Weight', 'Reps', 'Created', 'Updated', 'Completed', 'Prior B', 'Last D', 'RPE'];
const SET_READ_ROWS = 1500;
const SET_COL = { updated: 10, completed: 11, priorB: 12, lastD: 13, weight: 7, reps: 8, rpe: 14 };
const REPS_MAX = 100000;

function cleanReps(value) {
  const text = String(value == null ? '' : value).trim();
  const n = Number(text);
  if (!/^\d+$/.test(text) || n <= 0 || n > REPS_MAX) throw new Error('Reps must be a whole number above 0.');
  return n;
}

// [{weight:'25lbs',reps:20},{weight:'25lbs',reps:15}] -> "25lbs: 20, 15".
// A weight change starts a new group: "25lbs: 20, 30lbs: 15".
function entryFromSets(sets) {
  const parts = [];
  let weight = null;
  sets.slice().sort((a, b) => a.order - b.order).forEach(s => {
    const w = String(s.weight || '').trim();
    parts.push(w !== weight && w ? w + ': ' + s.reps : String(s.reps));
    weight = w;
  });
  return parts.join(', ');
}

function rowToSet(r, sheetRow) {
  return {
    sheetRow: sheetRow, id: r[0], session: r[1], date: r[2], row: Number(r[3]), name: r[4],
    order: Number(r[5]), weight: r[6], reps: Number(r[7]), created: r[8], updated: r[9],
    completed: r[10], priorB: r[11], lastD: r[12], rpe: Number(r[13]) || 0,
  };
}

// Only the newest rows: enough for today and the last two sessions per sheet
// row, and it keeps saves from slowing down as the tab grows.
function readSetRows(ss) {
  const tab = ss.getSheetByName(SETS_TAB);
  if (!tab) return [];
  const last = tab.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - SET_READ_ROWS + 1);
  // Older tabs may be narrower than SET_HEADERS (RPE added 2026-11-05).
  const cols = Math.min(SET_HEADERS.length, tab.getMaxColumns());
  return tab.getRange(start, 1, last - start + 1, cols).getDisplayValues()
    .map((r, i) => rowToSet(r, start + i)).filter(s => s.id);
}

// What the UI needs: today's sessions, plus the last two earlier ones per row.
function summarizeSessions(setRows, today) {
  const byId = {};
  const sessions = [];
  setRows.forEach(s => {
    if (!byId[s.session]) {
      sessions.push(byId[s.session] = {
        id: s.session, date: s.date, row: s.row, name: s.name, created: s.created,
        completed: Boolean(s.completed), text: s.lastD, rpe: 0, sets: [],
      });
    }
    if (s.rpe && !byId[s.session].rpe) byId[s.session].rpe = s.rpe;
    if (s.created < byId[s.session].created) byId[s.session].created = s.created;
    byId[s.session].sets.push({ id: s.id, order: s.order, weight: s.weight, reps: s.reps });
  });
  sessions.forEach(x => x.sets.sort((a, b) => a.order - b.order));
  sessions.sort((a, b) => (a.date + a.created < b.date + b.created ? 1 : -1));
  const earlier = {};
  return sessions.filter(x => {
    if (x.date === today) return true;
    earlier[x.row] = (earlier[x.row] || 0) + 1;
    return earlier[x.row] <= 2;
  });
}

function setsTab(ss) {
  let tab = ss.getSheetByName(SETS_TAB);
  if (!tab) {
    tab = ss.insertSheet(SETS_TAB);
    tab.getRange(1, 1, tab.getMaxRows(), SET_HEADERS.length).setNumberFormat('@'); // keep dates etc. as typed
    tab.getRange(1, 1, 1, SET_HEADERS.length).setValues([SET_HEADERS]);
    tab.setFrozenRows(1);
  }
  return tab;
}

// Writes only. The app shows sets right away and refreshes once its save
// queue is empty, so a save doesn't reload the whole sheet.
function sheetWrite(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    fn(SpreadsheetApp.openById(SHEET_ID));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return true;
}

function withSheetLock(fn) {
  sheetWrite(fn);
  return getTrackerData();
}

function checkedRow(ss, row, name) {
  const sheet = ss.getSheetByName(TAB_NAME);
  const current = String(sheet.getRange(row, 3).getDisplayValue()).trim();
  if (current !== String(name).trim()) {
    throw new Error('Sheet changed (row ' + row + ' is now "' + current + '"). Reload and try again.');
  }
  return sheet;
}

// Column B as it was before a session. The prefix keeps formulas stored as text.
function snapshotB(cell) {
  const formula = cell.getFormula();
  if (formula) return 'f:' + formula;
  const rich = cell.getRichTextValue();
  return 't:' + (rich ? rich.getText() : String(cell.getDisplayValue()));
}

function restoreB(cell, snapshot) {
  const text = String(snapshot).slice(2);
  if (String(snapshot).startsWith('f:')) cell.setFormula(text);
  else writeTextKeepingLinks(cell, text);
}

// Moves the V5 row from oldText to newText ('' = no entry). opts.keepDate
// leaves column B alone when another session today still needs that date.
function applySession(sheet, row, oldText, newText, priorB, opts) {
  if (!oldText) {
    stampDate(sheet, row, new Date());
    addEntry(sheet, row, newText);
    return;
  }
  const range = setCellsRange(sheet, row);
  const cells = oldSetCells(range);
  const i = cells.findIndex(v => String(v).trim() === oldText);
  if (i < 0) throw new Error('Sheet changed: "' + oldText + '" is no longer on row ' + row + '. Fix it in the sheet or reload.');
  if (newText) {
    sheet.getRange(row, 4 + i).setValue(newText);
    return;
  }
  const kept = cells.slice(0, i).concat(cells.slice(i + 1));
  kept.push('');
  range.setValues([kept]);
  if (!(opts && opts.keepDate)) restoreB(sheet.getRange(row, 2), priorB);
}

function sessionRows(all, sessionId) {
  return all.filter(s => s.session === sessionId);
}

// One write call however many rows.
function writeColumn(tab, rows, col, value) {
  if (!rows.length) return;
  const letter = String.fromCharCode(64 + col);
  tab.getRangeList(rows.map(s => letter + s.sheetRow)).setValue(value);
}

function writeLastD(tab, rows, text) {
  writeColumn(tab, rows, SET_COL.lastD, text);
}

// Called by the UI. input = { id, sessionId, row, name, weight, reps }; undo
// also passes order and completed. A repeated id changes nothing, so double
// taps and retries save one set.
function saveSet(input) {
  const id = String((input && input.id) || '').trim();
  if (!id) throw new Error('Missing set ID. Reload and try again.');
  const reps = cleanReps(input.reps);
  const weight = String(input.weight || '').trim().slice(0, 100);
  return sheetWrite(ss => {
    const row = Number(input.row);
    const sheet = checkedRow(ss, row, input.name);
    const tab = setsTab(ss);
    const all = readSetRows(ss);
    if (all.some(s => s.id === id)) return;
    const now = new Date();
    const today = isoDate(now);
    let sessionId = String(input.sessionId || '').trim() || Utilities.getUuid();
    let session = sessionRows(all, sessionId);
    if (session.length && (session[0].date !== today || session[0].row !== row)) {
      sessionId = Utilities.getUuid();
      session = [];
    }
    const first = !session.length;
    const priorB = first ? snapshotB(sheet.getRange(row, 2)) : session[0].priorB;
    const oldText = first ? '' : session[0].lastD;
    const nextOrder = session.reduce((n, s) => Math.max(n, s.order), 0) + 1;
    const order = Number(input.order) > 0 ? Number(input.order) : nextOrder;
    const newText = entryFromSets(session.concat({ order: order, weight: weight, reps: reps }));
    const completed = first ? String(input.completed || '') : session[0].completed;
    applySession(sheet, row, oldText, newText, priorB);
    try {
      tab.appendRow([id, sessionId, today, row, String(input.name).trim(), order, weight, reps,
        now.toISOString(), now.toISOString(), completed, priorB, newText, first ? '' : (session[0].rpe || '')]);
      writeLastD(tab, session, newText);
    } catch (e) {
      applySession(sheet, row, newText, oldText, priorB);
      throw e;
    }
    if (first) recordHistory(row);
  });
}

// Today's sets only: older sessions can't be changed from the app.
function setForChange(all, id) {
  const set = all.find(s => s.id === String(id));
  if (set && set.date !== isoDate(new Date())) throw new Error('That set is from another day. Reload and try again.');
  return set;
}

function editSet(id, reps, weight) {
  const cleanRepsValue = cleanReps(reps);
  const cleanWeight = String(weight || '').trim().slice(0, 100);
  return sheetWrite(ss => {
    const all = readSetRows(ss);
    const set = setForChange(all, id);
    if (!set) throw new Error('That set is gone. Reload and try again.');
    const sheet = checkedRow(ss, set.row, set.name);
    const tab = setsTab(ss);
    const session = sessionRows(all, set.session);
    const newText = entryFromSets(session.map(s => (s.id === set.id ? Object.assign({}, s, { reps: cleanRepsValue, weight: cleanWeight }) : s)));
    applySession(sheet, set.row, set.lastD, newText, set.priorB);
    tab.getRange(set.sheetRow, SET_COL.weight).setValue(cleanWeight);
    tab.getRange(set.sheetRow, SET_COL.reps).setValue(cleanRepsValue);
    tab.getRange(set.sheetRow, SET_COL.updated).setValue(new Date().toISOString());
    writeLastD(tab, session, newText);
  });
}

// Deleting the last set of a session also takes back its date and recovery
// credit, unless another session today keeps them. A repeated delete does nothing.
function deleteSet(id) {
  return sheetWrite(ss => {
    const all = readSetRows(ss);
    const set = setForChange(all, id);
    if (!set) return;
    const sheet = checkedRow(ss, set.row, set.name);
    const tab = setsTab(ss);
    const rest = sessionRows(all, set.session).filter(s => s.id !== set.id);
    const others = all.filter(s => s.row === set.row && s.date === set.date && s.session !== set.session);
    const newText = rest.length ? entryFromSets(rest) : '';
    const alreadyToday = String(set.priorB).includes(dateLabel(new Date()));
    applySession(sheet, set.row, set.lastD, newText, set.priorB, { keepDate: others.length > 0 });
    tab.deleteRow(set.sheetRow);
    if (rest.length) {
      // Row numbers below the deleted one moved up by one.
      writeLastD(tab, rest.map(s => Object.assign({}, s, { sheetRow: s.sheetRow - (s.sheetRow > set.sheetRow ? 1 : 0) })), newText);
    } else if (others.length) {
      // This was the earlier session: the survivors inherit the older date.
      if (!alreadyToday) {
        others.forEach(s => tab.getRange(s.sheetRow - (s.sheetRow > set.sheetRow ? 1 : 0), SET_COL.priorB).setValue(set.priorB));
      }
    } else if (!alreadyToday) {
      dropHistory(set.date, set.row);
    }
  });
}

// Complete only changes the session's status, never the sets or the date.
function setComplete(sessionId, done) {
  return sheetWrite(ss => {
    const session = sessionRows(readSetRows(ss), String(sessionId));
    if (!session.length) throw new Error('That session is gone. Reload and try again.');
    const tab = setsTab(ss);
    const value = done ? new Date().toISOString() : '';
    writeColumn(tab, session, SET_COL.completed, value);
  });
}

// RPE (rate of perceived exertion) for a whole session: 1–10, blank clears.
// Stored on every set row of the session in the Sets tab's RPE column.
function cleanRpe(value) {
  const text = String(value == null ? '' : value).trim();
  if (text === '') return '';
  const n = Number(text);
  if (!/^\d+$/.test(text) || n < 1 || n > 10) throw new Error('RPE must be 1 to 10.');
  return n;
}

function setRPE(sessionId, rpe) {
  const value = cleanRpe(rpe);
  return sheetWrite(ss => {
    const session = sessionRows(readSetRows(ss), String(sessionId));
    if (!session.length) throw new Error('That session is gone. Reload and try again.');
    const tab = setsTab(ss);
    if (tab.getMaxColumns() < SET_COL.rpe) tab.insertColumnsAfter(tab.getMaxColumns(), SET_COL.rpe - tab.getMaxColumns());
    const head = tab.getRange(1, SET_COL.rpe);
    if (head.getDisplayValue() !== 'RPE') head.setValue('RPE');
    writeColumn(tab, session, SET_COL.rpe, value);
  });
}

function readGoals(ss) {
  const tab = ss.getSheetByName(GOALS_TAB);
  if (!tab) return {};
  const goals = {};
  tab.getDataRange().getDisplayValues().slice(1).forEach(r => {
    const reps = Number(r[2]);
    if (r[0] && reps > 0) goals[r[0]] = reps;
  });
  return goals;
}

// reps blank = clear the goal. key = the app's exercise key.
function saveGoal(key, name, reps) {
  key = String(key || '').trim();
  if (!key) throw new Error('Missing exercise. Reload and try again.');
  const blank = String(reps == null ? '' : reps).trim() === '';
  const value = blank ? 0 : cleanReps(reps);
  return withSheetLock(ss => {
    let tab = ss.getSheetByName(GOALS_TAB);
    if (!tab) {
      if (blank) return;
      tab = ss.insertSheet(GOALS_TAB);
      tab.getRange(1, 1, tab.getMaxRows(), 3).setNumberFormat('@');
      tab.getRange(1, 1, 1, 3).setValues([['Exercise key', 'Exercise', 'Goal reps']]);
      tab.setFrozenRows(1);
    }
    const at = tab.getDataRange().getDisplayValues().findIndex((r, i) => i > 0 && r[0] === key);
    if (at > 0 && blank) tab.deleteRow(at + 1);
    else if (at > 0) tab.getRange(at + 1, 3).setValue(value);
    else if (!blank) tab.appendRow([key, String(name || ''), value]);
  });
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
  module.exports = { readSetRows, writeColumn, pendingGroupRenames, renameFor, parseRows, parseSheetDate, recoveryDaysFor, areaFor, cleanAreaDays, replaceDateText, buildSetCells, planFor, notesFrom, cleanPicks, picksFor, appendHistory, removeHistory, entryFromSets, summarizeSessions, cleanReps, cleanRpe, setRPE, logExercise, saveSet, editSet, deleteSet, setComplete, saveGoal, getTrackerData };
}
