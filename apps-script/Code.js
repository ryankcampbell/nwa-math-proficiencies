/* NWA Math Proficiencies — Workshop backend (bound to the "NWA Math Proficiencies" Sheet).

   The Sheet IS the database while the department works:
     Courses · Strands · Threads · Proficiencies · Overlaps · Flags · Resources · Plans · Changelog · Config
   Teachers can edit it directly (the Threads tab is the admin template: one row per
   thread, one column per course) or through the Workshop web app, which is the same
   app as the public site with editing turned on.

   Publishing copies the Sheet to GitHub as data/data.json (plus any uploaded files),
   which is what the public site, the Excel download and every practice link read.
   Nothing public ever depends on this script being up.

   Source of truth for this file: apps-script/ in the GitHub repo, pushed with clasp.
*/

const SHEET_ID = '1WXt-s1Q6eaprAPuKeKo_vGyVZnLPswDovH-tOnA1eqk';
const REPO = 'ryankcampbell/nwa-math-proficiencies';
const SEED_URL = 'https://raw.githubusercontent.com/' + REPO + '/main/data/data.json';
const DOMAIN = 'nwacademy.org';
const CHAIRS = ['rcampbell@nwacademy.org'];

const COLS = {
  Courses: ['id', 'name', 'short', 'grade', 'band', 'tagline', 'order'],
  Strands: ['id', 'name', 'summary', 'order'],
  Threads: ['id', 'strand', 'order', 'name', 'note'],            // + one column per course id
  Proficiencies: ['code', 'course', 'unit', 'text', 'thread', 'status', 'level', 'new', 'was', 'note', 'updated_by', 'updated_at'],
  Overlaps: ['id', 'a', 'b', 'score', 'status', 'note', 'decided_by', 'decided_at'],
  Flags: ['id', 'kind', 'thread', 'course', 'text', 'status', 'updated_by'],
  Resources: ['id', 'code', 'title', 'url', 'kind', 'file_id', 'added_by', 'added_at'],
  Plans: ['code', 'title', 'note', 'due', 'codes', 'teacher', 'created_at'],   // class codes → data/plans.json
  Changelog: ['time', 'who', 'op', 'target', 'detail'],
  Config: ['key', 'value'],
};

/* ───────────────────────── entry points ───────────────────────── */

function doGet() {
  const who = user_();
  if (!book_().getSheetByName('Proficiencies')) seed();
  const t = HtmlService.createTemplateFromFile('Workshop');
  t.dataJson = JSON.stringify(getData()).replace(/</g, '\\u003c');
  t.userJson = JSON.stringify(who);
  t.chairJson = JSON.stringify(CHAIRS.indexOf(who) >= 0);
  return t.evaluate()
    .setTitle('NWA Math · Workshop')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('NWA Math')
    .addItem('Open the workshop', 'menuOpenWorkshop_')
    .addItem('Publish to the public site', 'menuPublish_')
    .addSeparator()
    .addItem('Set GitHub token…', 'menuSetToken_')
    .addItem('Seed an empty Sheet from GitHub', 'seed')
    .addToUi();
}

/* ───────────────────────── read ───────────────────────── */

function getData() {
  user_();
  const cfg = config_();
  const courses = rows_('Courses').map(r => Object.assign(r, { order: +r.order }));
  const ids = courses.map(c => c.id);
  const threads = rows_('Threads').map(r => {
    const cells = {};
    ids.forEach(id => { if (r[id]) cells[id] = String(r[id]); });
    return { id: r.id, strand: r.strand, order: +r.order, name: r.name, note: r.note || '', cells };
  });
  const profs = rows_('Proficiencies').map(r => {
    const p = { code: r.code, course: r.course, unit: r.unit || '', text: r.text, thread: r.thread };
    if (r.status) p.status = r.status;
    if (r.level) p.level = r.level;
    if (r.new === true || r.new === 'TRUE') p.new = true;
    if (r.was) p.was = r.was;
    if (r.note) p.note = r.note;
    return p;
  });
  return {
    title: 'NWA Math Proficiencies',
    year: cfg.year || '2026–27',
    status: cfg.status || 'draft',
    published: cfg.published_at || null,
    courses,
    strands: rows_('Strands').map(r => Object.assign(r, { order: +r.order })),
    threads,
    profs,
    overlaps: rows_('Overlaps').map(r => ({ id: r.id, a: r.a, b: r.b, score: +r.score, status: r.status || 'open', note: r.note || '' })),
    flags: rows_('Flags').map(r => ({ id: r.id, kind: r.kind, thread: r.thread, course: r.course, text: r.text, status: r.status || 'open' })),
    resources: rows_('Resources').map(r => ({ id: r.id, code: r.code, title: r.title, url: r.url, kind: r.kind, file_id: r.file_id || '' })),
  };
}

/* ───────────────────────── write ───────────────────────── */

function apply(op) {
  const who = user_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const out = apply_(op, who);
    log_(who, op.op, op.code || op.thread || op.id || op.course || '', JSON.stringify(op).slice(0, 400));
    return out;
  } finally {
    lock.releaseLock();
  }
}

function apply_(op, who) {
  const now = new Date();
  switch (op.op) {
    case 'moveProf':
      need_(threadExists_(op.thread), 'No such thread');
      return set_('Proficiencies', 'code', op.code, { thread: op.thread, updated_by: who, updated_at: now });
    case 'editProf': {
      const p = get_('Proficiencies', 'code', op.code);
      return set_('Proficiencies', 'code', op.code, { text: op.text, was: p.was || p.text, updated_by: who, updated_at: now });
    }
    case 'retireProf':
      return set_('Proficiencies', 'code', op.code, { status: 'retired', updated_by: who, updated_at: now });
    case 'addProf': {
      need_(op.text && op.course, 'Missing text or course');
      const code = nextCode_(op.course);
      const r = { code, course: op.course, unit: op.unit || '', text: op.text, thread: op.thread, status: '', level: '', new: true, was: '', note: '', updated_by: who, updated_at: now };
      append_('Proficiencies', r);
      return { code, course: r.course, unit: r.unit, text: r.text, thread: r.thread, new: true };
    }
    case 'setCell':
      need_(courseExists_(op.course), 'No such course');
      set_('Threads', 'id', op.thread, { [op.course]: op.text });
      return true;
    case 'renameThread':
      return set_('Threads', 'id', op.thread, { name: op.name });
    case 'setThreadNote':
      return set_('Threads', 'id', op.thread, { note: op.note });
    case 'addThread': {
      const ts = rows_('Threads');
      const n = ts.filter(t => t.strand === op.strand).map(t => +String(t.id).slice(op.strand.length) || 0);
      const id = op.strand + (Math.max(0, ...n) + 1);
      const order = Math.max(0, ...ts.filter(t => t.strand === op.strand).map(t => +t.order)) + 0.5;
      append_('Threads', { id, strand: op.strand, order, name: op.name, note: '' });
      return { id, strand: op.strand, order, name: op.name, note: '', cells: {} };
    }
    case 'decideOverlap':
      return set_('Overlaps', 'id', op.id, { status: op.status, note: op.note || '', decided_by: who, decided_at: now });
    case 'setFlag':
      return set_('Flags', 'id', op.id, { status: op.status, updated_by: who });
    case 'addFlag': {
      const id = 'FL' + (rows_('Flags').length + 1);
      const r = { id, kind: op.kind, thread: op.thread, course: op.course, text: op.text, status: 'open', updated_by: who };
      append_('Flags', r);
      return r;
    }
    case 'addResource': {
      const r = { id: 'R' + now.getTime(), code: op.code, title: op.title, url: op.url, kind: op.kind || 'link', file_id: '', added_by: who, added_at: now };
      append_('Resources', r);
      return { id: r.id, code: r.code, title: r.title, url: r.url, kind: r.kind };
    }
    case 'uploadResource': {
      const blob = Utilities.newBlob(Utilities.base64Decode(op.b64), op.mime || 'application/octet-stream', op.name);
      const file = uploadFolder_().createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
      catch (e) { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); }
      const r = { id: 'R' + now.getTime(), code: op.code, title: op.title, url: file.getUrl(), kind: op.kind || 'file', file_id: file.getId(), added_by: who, added_at: now };
      append_('Resources', r);
      return { id: r.id, code: r.code, title: r.title, url: r.url, kind: r.kind, file_id: r.file_id };
    }
    case 'deleteResource':
      return remove_('Resources', 'id', op.id);
    case 'savePlan': {
      need_(op.s, 'Pick at least one proficiency');
      tab_('Plans');
      const taken = rows_('Plans').map(r => String(r.code));
      let code;
      do { code = newCode_(); } while (taken.indexOf(code) >= 0);
      append_('Plans', { code, title: op.t || '', note: op.n || '', due: op.d || '', codes: op.s, teacher: who, created_at: now });
      let live = false;
      try { live = writePlans_(); } catch (e) { /* no token yet: the code goes live at the next publish */ }
      return { code, live };
    }
  }
  throw new Error('Unknown edit: ' + op.op);
}

/* ───────────────────────── class codes ───────────────────────── */

// 5 characters, no 0/O, 1/I/L, so a student can copy it off a whiteboard.
function newCode_() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = A.charAt(Math.floor(Math.random() * 23));   // starts with a letter, so Sheets keeps it as text
  for (let i = 1; i < 5; i++) c += A.charAt(Math.floor(Math.random() * A.length));
  return c;
}

/** Write every plan to data/plans.json. Any teacher's save triggers it (the script runs as the
    chair, who holds the token), so a new code works within a minute, without a full publish.
    Only the plan itself is public: proficiency codes, title, note, due date. No student data. */
function writePlans_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return false;
  const plans = {};
  rows_('Plans').forEach(r => {
    const due = r.due ? String(r.due).slice(0, 10) : '';
    plans[r.code] = { s: r.codes, t: r.title || '', n: r.note || '', d: due };
  });
  const json = JSON.stringify({ plans: plans }, null, 1);
  ghPut_(token, 'data/plans.json', Utilities.base64Encode(json, Utilities.Charset.UTF_8), 'Update class codes');
  return true;
}

/* ───────────────────────── publish ───────────────────────── */

function publish() {
  const who = user_();
  need_(CHAIRS.indexOf(who) >= 0, 'Only the department chair can publish.');
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  need_(token, 'No GitHub token yet. In the Sheet: NWA Math ▸ Set GitHub token…');
  const data = getData();
  const stamp = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
  data.published = stamp;
  // Uploaded files move into the repo: public, permanent, and immune to Drive sharing rules.
  let copied = 0;
  data.resources.forEach(r => {
    if (!r.file_id) return;
    const f = DriveApp.getFileById(r.file_id);
    const path = 'files/' + r.id + '-' + f.getName().replace(/[^\w.\-]+/g, '_');
    if (!ghSha_(token, path)) { ghPut_(token, path, Utilities.base64Encode(f.getBlob().getBytes()), 'Add resource ' + r.id); copied++; }
    r.url = path;
  });
  data.resources.forEach(r => delete r.file_id);
  data.profs.forEach(p => delete p.was);
  const json = JSON.stringify(data, null, 1);
  ghPut_(token, 'data/data.json', Utilities.base64Encode(json, Utilities.Charset.UTF_8), 'Publish curriculum ' + stamp + ' (' + who + ')');
  if (book_().getSheetByName('Plans')) writePlans_();
  setConfig_('published_at', stamp);
  log_(who, 'publish', 'data/data.json', copied + ' files');
  return 'Published. The public site updates in about a minute.' + (copied ? ' ' + copied + ' uploaded file(s) copied.' : '');
}

function ghSha_(token, path) {
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
    headers: gh_(token), muteHttpExceptions: true });
  return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).sha : null;
}

function ghPut_(token, path, b64, message) {
  const body = { message, content: b64, branch: 'main' };
  const sha = ghSha_(token, path);
  if (sha) body.sha = sha;
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
    method: 'put', headers: gh_(token), contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) throw new Error('GitHub said ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
}

const gh_ = token => ({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });

/* ───────────────────────── seed ───────────────────────── */

/** Fill an empty Sheet from the draft on GitHub. Refuses to touch a Sheet that has data. */
function seed() {
  const ss = book_();
  const existing = ss.getSheetByName('Proficiencies');
  if (existing && existing.getLastRow() > 1) throw new Error('The Sheet already has proficiencies; not overwriting.');
  const d = JSON.parse(UrlFetchApp.fetch(SEED_URL).getContentText());
  const ids = d.courses.map(c => c.id);
  const tables = {
    Courses: d.courses,
    Strands: d.strands,
    Threads: d.threads.map(t => Object.assign({ id: t.id, strand: t.strand, order: t.order, name: t.name, note: t.note }, t.cells)),
    Proficiencies: d.profs.map(p => Object.assign({ status: '', level: '', new: !!p.new, was: '', note: '' }, p)),
    Overlaps: d.overlaps,
    Flags: d.flags,
    Resources: d.resources,
    Plans: plansSeed_(),
    Changelog: [],
    Config: [{ key: 'year', value: d.year }, { key: 'status', value: 'draft' }, { key: 'published_at', value: '' }],
  };
  Object.keys(COLS).forEach(name => {
    const head = name === 'Threads' ? COLS.Threads.concat(ids) : COLS[name];
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clear();
    const values = [head].concat(tables[name].map(r => head.map(h => r[h] === undefined || r[h] === null ? '' : r[h])));
    sh.getRange(1, 1, values.length, head.length).setValues(values);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#156875').setFontColor('#ffffff');
    if (name === 'Threads') { sh.setFrozenColumns(4); sh.setColumnWidths(6, ids.length, 220); sh.getRange(2, 6, Math.max(1, values.length - 1), ids.length).setWrap(true).setVerticalAlignment('top'); }
    if (name === 'Proficiencies') { sh.setColumnWidth(4, 520); sh.setFrozenColumns(1); }
  });
  // dropdowns so direct Sheet edits stay valid
  const prof = ss.getSheetByName('Proficiencies');
  const thr = ss.getSheetByName('Threads');
  prof.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(thr.getRange('A2:A'), true).build());
  prof.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['', 'retired'], true).build());
  ss.getSheetByName('Overlaps').getRange('E2:E').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['open', 'spiral', 'redundant', 'distinct'], true).build());
  const first = ss.getSheets()[0];
  if (first.getName() !== 'Courses' && first.getLastRow() === 0) ss.deleteSheet(first);
  ss.setActiveSheet(thr);
  return 'Seeded ' + d.profs.length + ' proficiencies.';
}

// Class codes already on GitHub (e.g. the NWA26 demo) carry over into a freshly seeded Sheet.
function plansSeed_() {
  try {
    const p = JSON.parse(UrlFetchApp.fetch(SEED_URL.replace('data.json', 'plans.json')).getContentText()).plans || {};
    return Object.keys(p).map(code => ({ code, title: p[code].t, note: p[code].n, due: p[code].d, codes: p[code].s, teacher: 'seed', created_at: '' }));
  } catch (e) { return []; }
}

/* ───────────────────────── menu actions ───────────────────────── */

function menuOpenWorkshop_() {
  const url = ScriptApp.getService().getUrl();
  const html = HtmlService.createHtmlOutput('<p style="font:14px sans-serif">' + (url
    ? '<a href="' + url + '" target="_blank">Open the workshop</a> (bookmark it, and share it with the department).'
    : 'The workshop is not deployed yet.') + '</p>').setWidth(360).setHeight(90);
  SpreadsheetApp.getUi().showModalDialog(html, 'NWA Math workshop');
}

function menuPublish_() {
  SpreadsheetApp.getUi().alert(publish());
}

function menuSetToken_() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('GitHub token',
    'Paste a fine-grained GitHub token with Contents: read and write on ' + REPO + ' only. It is stored in this script\'s private properties.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() === ui.Button.OK && r.getResponseText().trim()) {
    PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', r.getResponseText().trim());
    ui.alert('Saved.');
  }
}

/* ───────────────────────── sheet helpers ───────────────────────── */

function book_() { return SpreadsheetApp.openById(SHEET_ID); }

/** Make sure a tab exists with its header row (for tabs added after the Sheet was seeded). */
function tab_(name) {
  const ss = book_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, COLS[name].length).setValues([COLS[name]]).setFontWeight('bold').setBackground('#156875').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function user_() {
  const email = Session.getActiveUser().getEmail();
  if (!email || email.split('@')[1] !== DOMAIN) throw new Error('Sign in with your @' + DOMAIN + ' account.');
  return email;
}

function need_(ok, msg) { if (!ok) throw new Error(msg); }

function table_(name) {
  const sh = book_().getSheetByName(name);
  const values = sh.getDataRange().getValues();
  return { sh, head: values[0].map(String), rows: values.slice(1) };
}

function rows_(name) {
  const t = table_(name);
  return t.rows.filter(r => r[0] !== '').map(r => {
    const o = {};
    t.head.forEach((h, i) => { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  });
}

function find_(t, key, val) {
  const k = t.head.indexOf(key);
  for (let i = 0; i < t.rows.length; i++) if (String(t.rows[i][k]) === String(val)) return i;
  throw new Error('Not found: ' + val);
}

function get_(name, key, val) {
  const t = table_(name), i = find_(t, key, val), o = {};
  t.head.forEach((h, j) => { o[h] = t.rows[i][j]; });
  return o;
}

function set_(name, key, val, fields) {
  const t = table_(name), i = find_(t, key, val);
  Object.keys(fields).forEach(f => {
    const j = t.head.indexOf(f);
    need_(j >= 0, 'No column ' + f + ' in ' + name);
    t.sh.getRange(i + 2, j + 1).setValue(fields[f]);
  });
  return true;
}

function append_(name, obj) {
  const t = table_(name);
  t.sh.appendRow(t.head.map(h => obj[h] === undefined ? '' : obj[h]));
}

function remove_(name, key, val) {
  const t = table_(name), i = find_(t, key, val);
  t.sh.deleteRow(i + 2);
  return true;
}

function log_(who, op, target, detail) {
  book_().getSheetByName('Changelog').appendRow([new Date(), who, op, target, detail]);
}

function config_() {
  const o = {};
  rows_('Config').forEach(r => { o[r.key] = r.value; });
  return o;
}

function setConfig_(key, value) {
  try { set_('Config', 'key', key, { value }); } catch (e) { append_('Config', { key, value }); }
}

const threadExists_ = id => rows_('Threads').some(t => t.id === id);
const courseExists_ = id => rows_('Courses').some(c => c.id === id);

function nextCode_(course) {
  const codes = rows_('Proficiencies').filter(p => p.course === course).map(p => String(p.code));
  if (course === 'CALC') {
    const n = codes.map(c => +(c.match(/-P(\d+)$/) || [0, 0])[1]);
    return 'CALC-P' + (Math.max(0, ...n) + 1);
  }
  const n = codes.map(c => +(c.match(/-(\d+)$/) || [0, 0])[1]);
  return course + '-' + String(Math.max(0, ...n) + 1).padStart(2, '0');
}

function uploadFolder_() {
  const id = config_().upload_folder_id;
  if (id) return DriveApp.getFolderById(id);
  const parent = DriveApp.getFileById(SHEET_ID).getParents();
  const folder = (parent.hasNext() ? parent.next() : DriveApp.getRootFolder()).createFolder('NWA Math Proficiencies — uploads');
  setConfig_('upload_folder_id', folder.getId());
  return folder;
}
