/* NWA Math Proficiencies — Workshop backend (bound to the "NWA Math Proficiencies" Sheet).

   The Sheet IS the database while the department works:
     Courses · Strands · Threads · Proficiencies · Overlaps · Flags · Resources · Plans · Changelog · Config
   plus the pre-meeting homework tabs (Votes · Proposals · Reviewed · Results), which stay in the
   Sheet: getData() never reads them, so they are never published.
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
// Who may open the Workshop. The live list is the "editors" row of the Config tab (comma-separated);
// this is only the starting list written there on first run. Students share the domain, so the
// domain alone is not enough.
const EDITORS_START = ['aruiz', 'ddunning', 'bmcnally', 'rcampbell', 'rhanes', 'comelchuck'].map(u => u + '@' + DOMAIN);

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
  // Pre-meeting homework. Column order is a contract: the hub reads these tabs (README ▸ Sheet tabs).
  Votes: ['id', 'item_kind', 'item_id', 'voter', 'choice', 'reason', 'voted_at'],       // id = kind:item|voter
  Proposals: ['id', 'type', 'courses', 'text', 'proposed_by', 'proposed_at', 'status'],
  Reviewed: ['id', 'course', 'teacher', 'reviewed_at'],                                 // id = course|teacher
  Results: ['item_kind', 'item_id', 'summary', 'courses', 'keep', 'move', 'merge', 'add', 'discuss', 'n_votes', 'leading', 'reasons', 'updated_at'],
};
const VOTE_CHOICES = ['keep', 'move', 'merge', 'add', 'discuss'];
const PROPOSAL_TYPES = ['hole', 'collision', 'other'];
const HOMEWORK_OPS = ['editProf', 'moveProf', 'addProf', 'retireProf'];   // Changelog ops that count as "updated"
const DEFAULTS = { vote_deadline: '2026-11-25', homework_since: '2026-10-21' };

/* ───────────────────────── entry points ───────────────────────── */

function doGet(e) {
  if (e && e.parameter && e.parameter.check) return check_();
  let who;
  try { who = user_(); }
  catch (e) {
    return HtmlService.createHtmlOutput('<div style="font:16px/1.5 -apple-system,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px">'
      + '<h2 style="color:#156875">NWA Math Workshop</h2><p>' + e.message + '</p>'
      + '<p>Looking for the curriculum or a practice code? Go to <a href="https://ryankcampbell.github.io/nwa-math-proficiencies/">the public site</a>.</p></div>')
      .setTitle('NWA Math · Workshop');
  }
  const prof = book_().getSheetByName('Proficiencies');
  if (!prof || prof.getLastRow() < 2) { seed.quiet = true; seed(); }
  else if (isChair_(who)) {
    const cfg = config_();
    if (!('editors' in cfg)) setConfig_('editors', EDITORS_START.join(', '));
    Object.keys(DEFAULTS).forEach(k => { if (!(k in cfg)) setConfig_(k, DEFAULTS[k]); });
  }
  const t = HtmlService.createTemplateFromFile('Workshop');
  t.dataJson = JSON.stringify(getData()).replace(/</g, '\\u003c');
  t.userJson = JSON.stringify(who);
  t.chairJson = JSON.stringify(isChair_(who));
  let review;
  try { review = review_(who); } catch (err) { review = { error: err.message }; }   // never let homework break editing
  t.reviewJson = JSON.stringify(review).replace(/</g, '\\u003c');
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

/** Raw contents of another HTML file in this project (the Workshop's CSS and JS). Inserted by
    <?!= ?> at run time, so the template compiler never sees, and never mangles, the code. */
function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** ?check=1 on the Workshop URL: a plain-text health report (chair only). */
function check_() {
  const out = [];
  try {
    const who = user_();
    out.push('user: ' + who + (CHAIRS.indexOf(who) >= 0 ? ' (chair)' : ''));
    book_().getSheets().forEach(sh => out.push('tab ' + sh.getName() + ': ' + Math.max(0, sh.getLastRow() - 1) + ' rows'));
    const d = getData();
    ['courses', 'strands', 'threads', 'profs', 'overlaps', 'flags', 'resources'].forEach(k => out.push('data ' + k + ': ' + d[k].length));
    out.push('json bytes: ' + JSON.stringify(d).length);
    out.push('token set: ' + !!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'));
  } catch (err) {
    out.push('ERROR: ' + err.message + '\n' + (err.stack || ''));
  }
  return ContentService.createTextOutput(out.join('\n'));
}

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
      need_(isChair_(who), 'Only the chair records meeting decisions. Vote instead.');
      return set_('Overlaps', 'id', op.id, { status: op.status, note: op.note || '', decided_by: who, decided_at: now });
    case 'setFlag':
      need_(isChair_(who), 'Only the chair resolves open questions. Vote instead.');
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
    case 'vote': {
      need_(votingOpen_(), 'Voting closed on ' + deadline_() + '.');
      need_(!op.choice || VOTE_CHOICES.indexOf(op.choice) >= 0, 'Unknown choice: ' + op.choice);
      need_(ballot_().some(i => i.kind === op.kind && String(i.id) === String(op.id)), 'That item is not open for votes.');
      tab_('Votes');
      const id = op.kind + ':' + op.id + '|' + who;
      if (!op.choice) { try { remove_('Votes', 'id', id); } catch (e) { /* no vote to take back */ } }
      else {
        const r = { item_kind: op.kind, item_id: op.id, voter: who, choice: op.choice, reason: String(op.reason || '').trim().slice(0, 300), voted_at: now };
        try { set_('Votes', 'id', id, r); } catch (e) { append_('Votes', Object.assign({ id }, r)); }
      }
      writeResults_();
      return review_(who);
    }
    case 'propose': {
      need_(votingOpen_(), 'Proposals closed on ' + deadline_() + '.');
      need_(PROPOSAL_TYPES.indexOf(op.type) >= 0, 'Pick a type: hole, collision or other.');
      const ids = rows_('Courses').map(c => c.id);
      const courses = String(op.courses || '').split(',').map(c => c.trim()).filter(c => ids.indexOf(c) >= 0);
      const text = String(op.text || '').trim().slice(0, 600);
      need_(text, 'Describe it in a line or two.');
      tab_('Proposals');
      const n = rows_('Proposals').map(p => +String(p.id).replace(/^PR/, '') || 0);
      append_('Proposals', { id: 'PR' + (Math.max(0, ...n) + 1), type: op.type, courses: courses.join(','), text, proposed_by: who, proposed_at: now, status: 'open' });
      writeResults_();
      return review_(who);
    }
    case 'withdraw': {
      const p = get_('Proposals', 'id', op.id);
      need_(p.proposed_by === who || isChair_(who), 'Only the person who proposed it can withdraw it.');
      set_('Proposals', 'id', op.id, { status: 'withdrawn' });
      writeResults_();
      return review_(who);
    }
    case 'markReviewed': {
      need_(courseExists_(op.course), 'No such course');
      tab_('Reviewed');
      const id = op.course + '|' + who;
      if (op.on) { try { get_('Reviewed', 'id', id); } catch (e) { append_('Reviewed', { id, course: op.course, teacher: who, reviewed_at: now }); } }
      else { try { remove_('Reviewed', 'id', id); } catch (e) { /* not marked */ } }
      return review_(who);
    }
  }
  throw new Error('Unknown edit: ' + op.op);
}

/* ───────────────────────── pre-meeting homework ─────────────────────────
   Before the Dec 2 meeting each teacher votes on every open overlap, open question and
   proposal, and can propose new items. Votes are private to the voter and the chair until
   the meeting; other teachers see a card's tally only after voting on it themselves. */

function getReview() { return review_(user_()); }

/** Everything the Review tab's homework needs, as seen by `who`. */
function review_(who) {
  const chair = isChair_(who);
  const items = ballot_(), open = {};
  items.forEach(i => { open[i.kind + ':' + i.id] = true; });
  const votes = rowsIf_('Votes'), props = rowsIf_('Proposals'), rev = rowsIf_('Reviewed');
  const tally = {}, mine = {};
  votes.forEach(v => {
    const k = v.item_kind + ':' + v.item_id, t = tally[k] || (tally[k] = { n: 0, reasons: [] });
    t[v.choice] = (t[v.choice] || 0) + 1; t.n++;
    if (v.reason) t.reasons.push(v.reason);
    if (v.voter === who) mine[k] = { choice: v.choice, reason: v.reason || '' };
  });
  if (!chair) Object.keys(tally).forEach(k => { if (!mine[k]) delete tally[k]; });
  const since = since_(), log = rowsIf_('Changelog').filter(r => HOMEWORK_OPS.indexOf(r.op) >= 0 && ptDay_(r.time) >= since);
  const homework = e => {
    const voted = Object.keys(open).filter(k => votes.some(v => v.voter === e && v.item_kind + ':' + v.item_id === k)).length;
    const edited = {};
    log.filter(r => r.who === e).forEach(r => { edited[r.target] = true; });
    return {
      who: e, voted, total: items.length, edited: Object.keys(edited).length,
      reviewed: rev.filter(r => r.teacher === e).map(r => r.course),
      proposed: props.filter(p => p.proposed_by === e && p.status !== 'withdrawn').length,
      done: items.length > 0 && voted === items.length,
    };
  };
  const out = {
    deadline: deadline_(), open: votingOpen_(), since,
    proposals: props.filter(p => p.status !== 'withdrawn').map(p => ({
      id: p.id, type: p.type, courses: String(p.courses || '').split(',').filter(Boolean), text: p.text,
      by: String(p.proposed_by).split('@')[0], mine: p.proposed_by === who })),
    mine, tally, me: homework(who),
  };
  if (chair) {
    out.roster = roster_().map(homework);
    out.votes = votes.map(v => ({ k: v.item_kind + ':' + v.item_id, who: String(v.voter).split('@')[0], choice: v.choice, reason: v.reason || '' }));
  }
  return out;
}

/** What is open for votes: undecided overlaps, unresolved questions, live proposals. */
function ballot_() {
  const P = {}, short = {};
  rows_('Courses').forEach(c => { short[c.id] = c.short || c.id; });
  rows_('Proficiencies').forEach(p => { P[p.code] = p; });
  const side = code => code + ' (' + (P[code] ? short[P[code].course] || P[code].course : '?') + '): ' + (P[code] ? P[code].text : '');
  const items = [];
  rowsIf_('Overlaps').filter(o => (o.status || 'open') === 'open').forEach(o => items.push({
    kind: 'overlap', id: o.id, summary: side(o.a) + '  ⟷  ' + side(o.b),
    courses: [o.a, o.b].map(c => P[c] && P[c].course).filter(Boolean).join(',') }));
  rowsIf_('Flags').filter(f => f.status !== 'resolved').forEach(f => items.push({
    kind: 'flag', id: f.id, summary: '[' + f.kind + '] ' + f.text, courses: f.course || '' }));
  rowsIf_('Proposals').filter(p => p.status !== 'withdrawn').forEach(p => items.push({
    kind: 'proposal', id: p.id, summary: '[' + p.type + '] ' + p.text + ' (proposed by ' + String(p.proposed_by).split('@')[0] + ')', courses: p.courses || '' }));
  return items;
}

/** Rebuild the Results tab: one row per open item, tallied. Written after every vote so the
    hub can read final numbers straight from the Sheet. */
function writeResults_() {
  const sh = tab_('Results'), head = COLS.Results, now = new Date();
  const votes = rowsIf_('Votes');
  const rows = ballot_().map(i => {
    const vs = votes.filter(v => v.item_kind === i.kind && String(v.item_id) === String(i.id));
    const n = {};
    VOTE_CHOICES.forEach(c => { n[c] = vs.filter(v => v.choice === c).length; });
    const top = Math.max(0, ...VOTE_CHOICES.map(c => n[c]));
    const leading = top ? VOTE_CHOICES.filter(c => n[c] === top).join('/') : '';
    const reasons = vs.filter(v => v.reason).map(v => String(v.voter).split('@')[0] + ': ' + v.reason).join(' | ');
    return [i.kind, i.id, i.summary, i.courses].concat(VOTE_CHOICES.map(c => n[c]), [vs.length, leading, reasons, now]);
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
}

/** Who owes homework: the editors list, chair included, each once. */
function roster_() {
  return editors_().filter((e, i, a) => a.indexOf(e) === i);
}

/** A date (Date, ISO string or yyyy-MM-dd typed into the Sheet) as yyyy-MM-dd in Portland. */
function ptDay_(v) {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);
  return Utilities.formatDate(v instanceof Date ? v : new Date(v), 'America/Los_Angeles', 'yyyy-MM-dd');
}
const deadline_ = () => ptDay_(config_().vote_deadline || DEFAULTS.vote_deadline);
const since_ = () => ptDay_(config_().homework_since || DEFAULTS.homework_since);
const votingOpen_ = () => ptDay_(new Date()) <= deadline_();   // open through 11:59 pm Pacific on the deadline

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

/** Fill an empty Sheet from the draft on GitHub. Refuses to touch a Sheet that has data.
    Locked: the first page load can arrive twice (e.g. right after the permission screen). */
function seed() {
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const p = book_().getSheetByName('Proficiencies');
    if (p && p.getLastRow() > 1) {
      if (seed.quiet) return 'Already seeded.';
      throw new Error('The Sheet already has proficiencies; not overwriting.');
    }
    return seed_();
  } finally {
    lock.releaseLock();
  }
}

function seed_() {
  const ss = book_();
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
    Config: [{ key: 'year', value: d.year }, { key: 'status', value: 'draft' }, { key: 'published_at', value: '' },
             { key: 'editors', value: EDITORS_START.join(', ') }]
             .concat(Object.keys(DEFAULTS).map(key => ({ key, value: DEFAULTS[key] }))),
    Votes: [], Proposals: [], Reviewed: [], Results: [],
  };
  Object.keys(COLS).forEach(name => {
    const head = name === 'Threads' ? COLS.Threads.concat(ids) : COLS[name];
    let sh = ss.getSheetByName(name);
    if (!sh) { try { sh = ss.insertSheet(name); } catch (e) { SpreadsheetApp.flush(); sh = ss.getSheetByName(name); } }
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
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || email.split('@')[1] !== DOMAIN) throw new Error('Sign in with your @' + DOMAIN + ' account.');
  if (editors_().indexOf(email) < 0) throw new Error('This workshop is for the math department. Ask Ryan Campbell to add ' + email + ' to the editors list.');
  return email;
}

/** Department editors: Config ▸ editors (comma-separated, bare usernames allowed), plus the chairs.
    Before the Sheet is seeded, or if the row is missing, the starting list applies. */
function editors_() {
  let v = '';
  try { v = config_().editors || ''; } catch (e) { /* no Config tab yet */ }
  const list = (v ? String(v).split(/[\s,;]+/) : EDITORS_START)
    .map(x => x.trim().toLowerCase()).filter(Boolean)
    .map(x => x.indexOf('@') < 0 ? x + '@' + DOMAIN : x);
  return list.concat(CHAIRS);
}

const isChair_ = who => CHAIRS.indexOf(who) >= 0;

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

/** rows_ for a tab that may not exist yet (the homework tabs appear on first use). */
function rowsIf_(name) {
  return book_().getSheetByName(name) ? rows_(name) : [];
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
