// Run the Workshop backend (apps-script/Code.js) against a fake in-memory Sheet seeded from
// data/data.json, and check the pre-meeting homework: votes, proposals, Reviewed, Results.
//
//   node tools/test_workshop.mjs
//
// No Google calls, no network, no secrets. The fake covers only the Sheet/Session calls Code.js makes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const data = JSON.parse(fs.readFileSync(ROOT + 'data/data.json', 'utf8'));

/* ── fake SpreadsheetApp ── */
class Range {
  constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
  setValue(v) { this.sh.put(this.r, this.c, v); return this; }
  setValues(vs) { vs.forEach((row, i) => row.forEach((v, j) => this.sh.put(this.r + i, this.c + j, v))); return this; }
  getValues() { return this.sh.grid.slice(this.r - 1, this.r - 1 + this.nr).map(row => Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] ?? '')); }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, ''); return this; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
  setWrap() { return this; } setVerticalAlignment() { return this; } setDataValidation() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.grid = []; }
  getName() { return this.name; }
  put(r, c, v) { while (this.grid.length < r) this.grid.push([]); this.grid[r - 1][c - 1] = v; }
  width() { return Math.max(0, ...this.grid.map(r => r.length)); }
  getLastRow() { let n = this.grid.length; while (n && this.grid[n - 1].every(v => v === '' || v == null)) n--; return n; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.width())); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  appendRow(row) { this.grid.splice(this.getLastRow(), 0, [...row]); }
  deleteRow(r) { this.grid.splice(r - 1, 1); }
  clear() { this.grid = []; }
  setFrozenRows() {} setFrozenColumns() {} setColumnWidth() {} setColumnWidths() {}
}
const book = { sheets: new Map(),
  getSheetByName(n) { return this.sheets.get(n) || null; },
  insertSheet(n) { const s = new Sheet(n); this.sheets.set(n, s); return s; },
  getSheets() { return [...this.sheets.values()]; },
  deleteSheet(s) { this.sheets.delete(s.getName()); },
  setActiveSheet() {},
};
let ME = 'ddunning@nwacademy.org', NOW = new Date('2026-11-10T20:00:00Z');
class FakeDate extends Date { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return +NOW; } }

const ctx = vm.createContext({
  Date: FakeDate, JSON, Math, String, Object, Array, Number, console,
  SpreadsheetApp: { openById: () => book, flush() {}, newDataValidation: () => ({ requireValueInRange() { return this; }, requireValueInList() { return this; }, build() { return {}; } }) },
  Session: { getActiveUser: () => ({ getEmail: () => ME }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  UrlFetchApp: { fetch: url => ({ getContentText: () => url.endsWith('plans.json') ? '{"plans":{}}' : JSON.stringify(data) }) },
  Utilities: { formatDate: (d, tz, f) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) },
  HtmlService: {}, ContentService: {}, DriveApp: {},
});
// Top-level const/function declarations become globals the harness can read.
vm.runInContext(fs.readFileSync(ROOT + 'apps-script/Code.js', 'utf8') + '\n;globalThis.__ = { seed, apply, getReview, getData, rows_ };', ctx);
const G = ctx.__;
const J = x => JSON.parse(JSON.stringify(x));   // arrays from the vm realm fail strict deepEqual

/* ── tests ── */
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const as = (who, fn) => { const was = ME; ME = who; try { return fn(); } finally { ME = was; } };
const DAN = 'ddunning@nwacademy.org', BEE = 'bmcnally@nwacademy.org', RYAN = 'rcampbell@nwacademy.org';

G.seed();
const ov = data.overlaps.find(o => o.status === 'open'), ov2 = data.overlaps.filter(o => o.status === 'open')[1];

t('seed creates the homework tabs and deadline config', () => {
  for (const tab of ['Votes', 'Proposals', 'Reviewed', 'Results']) assert.ok(book.getSheetByName(tab), tab);
  const cfg = Object.fromEntries(G.rows_('Config').map(r => [r.key, r.value]));
  assert.equal(cfg.vote_deadline, '2026-11-25');
  assert.equal(cfg.homework_since, '2026-10-21');
});

t('ballot = open overlaps + unresolved flags', () => {
  const r = G.getReview();
  const want = data.overlaps.filter(o => o.status === 'open').length + data.flags.filter(f => f.status !== 'resolved').length;
  assert.equal(r.me.total, want);
  assert.equal(r.me.voted, 0);
  assert.equal(r.roster, undefined, 'teachers get no roster');
});

t('a vote is one row; changing it overwrites the row', () => {
  G.apply({ op: 'vote', kind: 'overlap', id: ov.id, choice: 'keep' });
  let r = G.apply({ op: 'vote', kind: 'overlap', id: ov.id, choice: 'merge', reason: 'same skill, same depth' });
  const vs = G.rows_('Votes');
  assert.equal(vs.length, 1);
  assert.equal(vs[0].choice, 'merge');
  assert.equal(vs[0].id, 'overlap:' + ov.id + '|' + DAN);
  assert.equal(r.mine['overlap:' + ov.id].choice, 'merge');
  assert.equal(r.me.voted, 1);
});

t('Results tab tallies and names the leader', () => {
  as(BEE, () => G.apply({ op: 'vote', kind: 'overlap', id: ov.id, choice: 'merge' }));
  as(RYAN, () => G.apply({ op: 'vote', kind: 'overlap', id: ov.id, choice: 'keep' }));
  const res = G.rows_('Results').find(r => r.item_id === ov.id);
  assert.equal(res.item_kind, 'overlap');
  assert.equal(res.merge, 2); assert.equal(res.keep, 1); assert.equal(res.n_votes, 3);
  assert.equal(res.leading, 'merge');
  assert.match(res.reasons, /ddunning: same skill/);
  assert.match(res.summary, /⟷/);
});

t('tallies are hidden from teachers until they vote; chair sees all with names', () => {
  const bee = as(BEE, () => G.getReview());
  assert.ok(bee.tally['overlap:' + ov.id]);
  assert.equal(as('rhanes@nwacademy.org', () => G.getReview()).tally['overlap:' + ov.id], undefined);
  const chair = as(RYAN, () => G.getReview());
  assert.ok(chair.roster.length >= 6);
  assert.ok(chair.votes.some(v => v.who === 'ddunning' && v.choice === 'merge'));
  assert.equal(chair.roster.filter(h => h.who === RYAN).length, 1, 'chair listed once');
});

t('a vote can be taken back', () => {
  as(BEE, () => G.apply({ op: 'vote', kind: 'overlap', id: ov.id, choice: '' }));
  assert.equal(G.rows_('Votes').filter(v => v.voter === BEE).length, 0);
});

t('bad votes are refused', () => {
  assert.throws(() => G.apply({ op: 'vote', kind: 'overlap', id: ov.id, choice: 'abstain' }), /Unknown choice/);
  assert.throws(() => G.apply({ op: 'vote', kind: 'flag', id: 'FL999', choice: 'keep' }), /not open/);
});

t('proposals: added, votable, withdrawn only by the proposer or chair', () => {
  let r = G.apply({ op: 'propose', type: 'hole', courses: 'IM3,PC,NOPE', text: 'Conic sections have no home' });
  const p = r.proposals[0];
  assert.equal(p.id, 'PR1'); assert.deepEqual(J(p.courses), ['IM3', 'PC']); assert.ok(p.mine);
  assert.equal(r.me.proposed, 1);
  as(BEE, () => G.apply({ op: 'vote', kind: 'proposal', id: 'PR1', choice: 'add' }));
  assert.ok(G.rows_('Results').some(x => x.item_kind === 'proposal' && x.add === 1));
  assert.throws(() => as(BEE, () => G.apply({ op: 'withdraw', id: 'PR1' })), /Only the person/);
  r = G.apply({ op: 'withdraw', id: 'PR1' });
  assert.equal(r.proposals.length, 0);
  assert.ok(!G.rows_('Results').some(x => x.item_id === 'PR1'));
  assert.throws(() => G.apply({ op: 'propose', type: 'rant', text: 'x' }), /Pick a type/);
});

t('homework counts edits since the start date and courses marked reviewed', () => {
  G.apply({ op: 'editProf', code: ov.a, text: 'Reworded for the test' });
  G.apply({ op: 'editProf', code: ov.a, text: 'Reworded again' });
  let r = G.apply({ op: 'markReviewed', course: 'IM2', on: true });
  G.apply({ op: 'markReviewed', course: 'IM2', on: true });
  assert.equal(r.me.edited, 1, 'distinct proficiencies');
  assert.deepEqual(J(r.me.reviewed), ['IM2']);
  assert.equal(G.rows_('Reviewed').length, 1, 'marking twice adds one row');
  r = G.apply({ op: 'markReviewed', course: 'IM2', on: false });
  assert.deepEqual(J(r.me.reviewed), []);
});

t('meeting decisions and resolving questions are chair-only', () => {
  assert.throws(() => G.apply({ op: 'decideOverlap', id: ov2.id, status: 'spiral' }), /chair/);
  assert.throws(() => G.apply({ op: 'setFlag', id: 'FL1', status: 'resolved' }), /chair/);
  as(RYAN, () => G.apply({ op: 'decideOverlap', id: ov2.id, status: 'spiral' }));
  assert.throws(() => G.apply({ op: 'vote', kind: 'overlap', id: ov2.id, choice: 'keep' }), /not open/, 'decided items leave the ballot');
});

t('votes are refused after 11:59 pm Pacific on the deadline', () => {
  NOW = new Date('2026-11-26T07:30:00Z');   // 11:30 pm Nov 25 in Portland
  G.apply({ op: 'vote', kind: 'flag', id: 'FL1', choice: 'discuss' });
  NOW = new Date('2026-11-26T08:30:00Z');   // 12:30 am Nov 26
  assert.throws(() => G.apply({ op: 'vote', kind: 'flag', id: 'FL1', choice: 'keep' }), /closed on 2026-11-25/);
  assert.throws(() => G.apply({ op: 'propose', type: 'other', text: 'late' }), /closed/);
  assert.equal(G.getReview().open, false);
});

t('getData (what publish ships) carries no votes or proposals', () => {
  const d = G.getData();
  assert.deepEqual(J(Object.keys(d).filter(k => /vote|propos|review|result/i.test(k))), []);
});

console.log(`\n${n} tests passed`);
