/* NWA Math Proficiencies — one app, two homes.

   Public site (GitHub Pages): reads data/data.json, read-only, works offline.
   Workshop (Google Apps Script): the same file, served with window.NWA_WORKSHOP
   set and the live Sheet's data inlined as window.NWA_DATA; edits go to the
   Sheet through google.script.run.

   Views (hash routes):
     #/                 program map + scope at a glance
     #/course/IM3       one course's proficiencies, by unit or by strand
     #/scope/F          one strand: threads × courses (the admin template, live)
     #/thread/F3        one thread followed from 6th grade up
     #/review           overlaps and open questions for the department
     #/assign           teacher builds a practice link
     #/p?s=…            student practice page (what an assignment link opens)
     #/c/K7QM4          a class code: looked up in data/plans.json, then opens its #/p page
     #/q/IM3-14         practice problems for one proficiency (practice.js)
*/
(() => {
'use strict';

const WS = !!window.NWA_WORKSHOP;
const PUBLIC_URL = 'https://ryankcampbell.github.io/nwa-math-proficiencies/';
const BASE = WS ? PUBLIC_URL : '';          // where published files (practice sets, plans) live
const VENDOR = WS ? {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  qr: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
} : { xlsx: 'vendor/xlsx.full.min.js', qr: 'vendor/qrcode.min.js' };

/* Which earlier courses feed each course — drives "prepare for…" in Assign. */
const FEEDS = {
  PA2: ['PA1'], PA3: ['PA2'], IM1: ['PA3'], IM2: ['IM1'], IM3: ['IM2'],
  PC: ['IM3'], APC: ['IM3'], CALC: ['APC', 'PC'], ST1: ['IM3'], ST2: ['ST1'],
};
// Line breaks for confirm() and email text. Never write a backslash-n escape in this file: Apps Script
// turns it into a real line break when it serves the Workshop, which breaks the JS (blank page).
const NL = String.fromCharCode(10), NL2 = NL + NL;
const BAND_NAME = { ms: 'Middle School', hs: 'High School', el: 'Electives', st: 'Statistics' };
const KIND = { gap: 'Gap', overlap: 'Overlap', order: 'Sequence', todo: 'To do' };

let D, C, S, T, P;          // data; course, strand, thread, proficiency maps
let PX = {};                // practice/index.json: code → {title, n}
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem('nwa:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nwa:' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ───────────────────────── data ───────────────────────── */

function index() {
  C = new Map(D.courses.map(c => [c.id, c]));
  S = new Map(D.strands.map(s => [s.id, s]));
  T = new Map(D.threads.map(t => [t.id, t]));
  P = new Map(D.profs.map(p => [p.code, p]));
  D.courses.sort((a, b) => a.order - b.order);
  D.strands.sort((a, b) => a.order - b.order);
  D.threads.sort((a, b) => a.order - b.order);
  D.resources = D.resources || [];
  D.overlaps = D.overlaps || [];
  D.flags = D.flags || [];
}
const live = () => D.profs.filter(p => p.status !== 'retired');
const ofCourse = cid => live().filter(p => p.course === cid);
const inCell = (tid, cid) => live().filter(p => p.thread === tid && p.course === cid);
const threadsOf = sid => D.threads.filter(t => t.strand === sid);
const strandOf = p => { const t = T.get(p.thread); return t ? S.get(t.strand) : null; };
const resOf = code => D.resources.filter(r => r.code === code);
const flagsAt = (tid, cid) => D.flags.filter(f => f.thread === tid && f.course === cid && f.status !== 'resolved');
const openOverlapsOf = code => D.overlaps.filter(o => o.status === 'open' && (o.a === code || o.b === code));
const sc = sid => `var(--s-${sid})`;
const showOv = () => store.get('ovShow', false);   // overlap badges: off unless asked for (they crowd the grid)

async function load() {
  if (window.NWA_DATA) { D = window.NWA_DATA; index(); return; }
  const res = await fetch('data/data.json', { cache: 'no-cache' });
  D = await res.json();
  index();
}
async function loadPractice() {
  try { PX = (await (await fetch(BASE + 'practice/index.json', { cache: 'no-cache' })).json()).sets || {}; } catch (e) { PX = {}; }
}

/* ───────────────────────── workshop API ───────────────────────── */

function api(op) {
  return new Promise((resolve, reject) => {
    if (!WS) return reject(new Error('read-only'));
    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).apply(op);
  });
}

/* Mirror of the server's apply(): patch local data so the page updates at once. */
function patch(op, r) {
  const p = op.code && P.get(op.code);
  switch (op.op) {
    case 'moveProf': p.thread = op.thread; break;
    case 'editProf': if (!p.was) p.was = p.text; p.text = op.text; break;
    case 'addProf': D.profs.push(r); P.set(r.code, r); break;
    case 'retireProf': p.status = 'retired'; break;
    case 'setCell': T.get(op.thread).cells[op.course] = op.text; break;
    case 'renameThread': T.get(op.thread).name = op.name; break;
    case 'setThreadNote': T.get(op.thread).note = op.note; break;
    case 'addThread': D.threads.push(r); T.set(r.id, r); break;
    case 'decideOverlap': Object.assign(D.overlaps.find(o => o.id === op.id), { status: op.status, note: op.note ?? '' }); break;
    case 'setFlag': D.flags.find(f => f.id === op.id).status = op.status; break;
    case 'addFlag': D.flags.push(r); break;
    case 'addResource': case 'uploadResource': D.resources.push(r); break;
    case 'deleteResource': D.resources = D.resources.filter(x => x.id !== op.id); break;
  }
}

async function edit(op, msg) {
  try {
    const r = await api(op);
    patch(op, r);
    toast(msg || 'Saved');
    render();
    return r;
  } catch (e) {
    toast('Not saved: ' + (e.message || e));
    throw e;
  }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('on'), 2400);
}

/* ───────────────────────── shared bits ───────────────────────── */

const icon = {
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sun: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dl: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
};

function strandPill(t) {
  if (!t) return '<span class="pill muted">Unsorted</span>';
  return `<a class="pill" href="#/thread/${t.id}" style="--c:${sc(t.strand)}"><span class="dot"></span>${esc(t.name)}</a>`;
}

function threadSelect(p) {
  return `<select class="inp" data-act="move" data-code="${p.code}" aria-label="Move ${p.code} to a thread">
    ${D.strands.map(s => `<optgroup label="${esc(s.name)}">${threadsOf(s.id).map(t =>
      `<option value="${t.id}" ${t.id === p.thread ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}
  </select>`;
}

function profRow(p, { showCourse = false, showThread = true } = {}) {
  const c = C.get(p.course), t = T.get(p.thread), rs = resOf(p.code), ov = openOverlapsOf(p.code);
  return `<li data-code="${p.code}">
    <span class="code">${p.code}</span>
    <div class="ptext">
      ${esc(p.text)}${p.level === 'unit' ? ' <span class="tag">Unit</span>' : ''}${p.new ? ' <span class="tag">New</span>' : ''}
      <span class="sub">${showCourse ? `<a href="#/course/${c.id}">${esc(c.name)}</a> · ` : ''}${p.unit && showCourse ? esc(p.unit) + ' · ' : ''}${rs.length ? `${rs.length} resource${rs.length > 1 ? 's' : ''}` : ''}${p.note ? ' ' + esc(p.note) : ''}${PX[p.code] ? ` <a class="tag prac" href="#/q/${p.code}">Practice · ${PX[p.code].n}</a>` : ''}</span>
      ${WS && p.was ? `<span class="was">was: ${esc(p.was)}</span>` : ''}
      ${showOv() && ov.length ? `<span class="sub">${ov.map(o => { const other = o.a === p.code ? o.b : o.a; return `<span class="tag overlap">Overlaps ${other}</span>`; }).join(' ')}</span>` : ''}
      ${WS ? `<div class="ws-row">
        ${threadSelect(p)}
        <button class="btn small ghost" data-act="editProf" data-code="${p.code}">Edit wording</button>
        <button class="btn small ghost" data-act="addRes" data-code="${p.code}">Add resource</button>
        <button class="btn small ghost" data-act="retire" data-code="${p.code}">Retire</button>
      </div>` : ''}
    </div>
    ${showThread && !WS ? strandPill(t) : ''}
  </li>`;
}

/* ───────────────────────── views ───────────────────────── */

function vHome() {
  const bands = ['ms', 'hs', 'el', 'st'];
  const counts = new Map(D.courses.map(c => [c.id, ofCourse(c.id).length]));
  return `
  <section class="hero">
    ${D.status === 'draft' ? `<span class="draft">● Draft for department review · ${esc(D.year)}</span>` : ''}
    <h1>NWA Mathematics Program</h1>
    <p>What we teach, and when. Tap a course for its proficiencies, or follow a strand to see how an idea grows from 6th grade through Calculus.</p>
    <div class="ctas">
      <a class="btn primary" href="#/scope/${D.strands[0].id}">Scope &amp; Sequence</a>
      <a class="btn" href="#/assign">Assign practice</a>
      <button class="btn" data-act="xlsx">${icon.dl} Download Excel</button>
    </div>
    ${WS ? '' : codeBox()}
  </section>
  ${bands.map(b => {
    const cs = D.courses.filter(c => c.band === b);
    if (!cs.length) return '';
    return `<section class="band" data-band="${b}">
      <h2>${BAND_NAME[b]}</h2>
      <div class="cards">${cs.map(c => `
        <a class="course c-${c.band}" href="#/course/${c.id}">
          <b>${esc(c.name)}</b><span>${esc(c.grade)}</span>${c.tagline ? `<i>${esc(c.tagline)}</i>` : ''}
          <span class="count">${counts.get(c.id)} proficiencies</span>
          <div class="arrow" aria-hidden="true">⟶</div>
        </a>`).join('')}</div>
    </section>`;
  }).join('')}
  ${vGlance()}`;
}

function vGlance() {
  const rows = D.strands.map(s => {
    const per = D.courses.map(c => live().filter(p => p.course === c.id && T.get(p.thread)?.strand === s.id).length);
    return { s, per };
  });
  const max = Math.max(1, ...rows.flatMap(r => r.per));
  return `<section class="glance">
    <div class="glance-head">
      <div><h2>Scope at a glance</h2><p>Each row is a strand that runs through the whole program. Darker cells hold more proficiencies.</p></div>
      <a class="btn small" href="#/scope/${D.strands[0].id}">Open the full grid →</a>
    </div>
    <div class="scroller"><table class="heat" role="grid">
      <colgroup><col class="lab">${D.courses.map(() => '<col>').join('')}</colgroup>
      <thead><tr><th></th>${D.courses.map(c => `<th scope="col" title="${esc(c.name)}">${esc(c.short)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(({ s, per }) => `<tr>
        <th scope="row" class="row"><a href="#/scope/${s.id}" style="--c:${sc(s.id)}"><span class="dot"></span>${esc(s.name)}</a></th>
        ${per.map((n, i) => {
          const c = D.courses[i];
          if (!n) return `<td class="empty" title="${esc(s.name)} · ${esc(c.name)}: not covered"></td>`;
          const w = (0.18 + 0.72 * n / max).toFixed(2);
          return `<td style="background:color-mix(in srgb,${sc(s.id)} ${Math.round(w * 100)}%,transparent)">
            <button data-act="glance" data-strand="${s.id}" data-course="${c.id}" aria-label="${esc(s.name)}, ${esc(c.name)}: ${n} proficiencies" title="${esc(s.name)} · ${esc(c.name)}: ${n}">${n}</button></td>`;
        }).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="legend"><span>Fewer</span><span class="ramp">${[.2, .4, .6, .8, 1].map(o => `<i style="opacity:${o}"></i>`).join('')}</span><span>More proficiencies</span>
      <span style="margin-left:12px;display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:16px;height:10px;border-radius:2px;background:repeating-linear-gradient(135deg,transparent 0 3px,var(--line-2) 3px 4px)"></i> Not covered</span></div>
  </section>`;
}

function vCourse(cid) {
  const c = C.get(cid);
  if (!c) return vMissing();
  const ps = ofCourse(cid);
  const mode = store.get('courseMode', 'unit');
  const hasUnits = ps.some(p => p.unit);
  let body;
  if (mode === 'strand' || !hasUnits) {
    body = D.strands.map(s => {
      const g = ps.filter(p => T.get(p.thread)?.strand === s.id);
      if (!g.length) return '';
      return `<div class="group"><h3 style="--c:${sc(s.id)}"><span class="dot"></span>${esc(s.name)} · ${g.length}</h3>
        <ul class="plist">${g.map(p => profRow(p)).join('')}</ul></div>`;
    }).join('');
  } else {
    const units = [...new Set(ps.map(p => p.unit || ''))];
    body = units.map(u => {
      const g = ps.filter(p => (p.unit || '') === u);
      return `<div class="group"><h3>${esc(u || 'Proficiencies')} · ${g.length}</h3><ul class="plist">${g.map(p => profRow(p)).join('')}</ul></div>`;
    }).join('');
  }
  const fl = D.flags.filter(f => f.course === cid && f.status !== 'resolved');
  return `
  <div class="crumbs"><a href="#/">Program</a> / ${BAND_NAME[c.band]}</div>
  <section class="coursehero c-${c.band}">
    <h1>${esc(c.name)}</h1>
    <p>${esc(c.grade)}${c.tagline ? ' · ' + esc(c.tagline) : ''}</p>
    <div class="meta"><span class="chip">${ps.length} proficiencies</span>
      ${D.strands.filter(s => ps.some(p => T.get(p.thread)?.strand === s.id)).map(s => `<span class="chip">${esc(s.name)}</span>`).join('')}</div>
  </section>
  <div class="toolbar">
    ${hasUnits ? `<div class="seg" style="margin:0">
      <button class="${mode !== 'strand' ? 'on' : ''}" style="--c:var(--teal)" data-act="courseMode" data-mode="unit">In course order</button>
      <button class="${mode === 'strand' ? 'on' : ''}" style="--c:var(--teal)" data-act="courseMode" data-mode="strand">By strand</button></div>` : ''}
    <span style="flex:1"></span>
    <a class="btn small" href="#/assign?c=${cid}">Assign practice from this course</a>
    ${WS ? `<button class="btn small" data-act="addProf" data-course="${cid}">+ Add proficiency</button>` : ''}
  </div>
  ${fl.length && (WS || store.get('review', false)) ? `<div class="card" style="margin-top:16px"><h3>Open questions for this course</h3>${fl.map(f => `<div class="item"><span class="tag ${f.kind}">${KIND[f.kind] || f.kind}</span> ${esc(f.text)}</div>`).join('')}</div>` : ''}
  ${body}`;
}

function vScope(sid) {
  const s = S.get(sid) || D.strands[0];
  const ts = threadsOf(s.id);
  const review = WS || store.get('review', false);
  const max = Math.max(1, ...ts.flatMap(t => D.courses.map(c => inCell(t.id, c.id).length)));
  return `
  <div class="phead"><div>
    <h1>Scope &amp; Sequence</h1>
    <p>One tab per strand, as in the department template: rows are the threads we share, columns are courses, and each cell says how that thread shows up in that course. Tap a cell to see the proficiencies behind it.</p>
  </div>
  <div class="toolbar noprint">
    <label class="check" style="font-size:13px;font-weight:600;color:var(--ink-2)"><input type="checkbox" data-act="review" ${review ? 'checked' : ''} ${WS ? 'disabled' : ''}> Show review notes</label>
    <label class="check" style="font-size:13px;font-weight:600;color:var(--ink-2)"><input type="checkbox" data-act="ovShow" ${showOv() ? 'checked' : ''}> Show overlaps</label>
    <button class="btn small" data-act="xlsx">${icon.dl} Excel</button>
  </div></div>
  <div class="seg" role="tablist">${D.strands.map(x => `<button role="tab" aria-selected="${x.id === s.id}" class="${x.id === s.id ? 'on' : ''}" style="--c:${sc(x.id)}" data-act="strand" data-strand="${x.id}"><span class="dot"></span>${esc(x.name)}</button>`).join('')}</div>
  <div class="strandhead" style="--c:${sc(s.id)}"><h2>${esc(s.name)}</h2><p>${esc(s.summary)}</p></div>
  <div class="scroller"><table class="sgrid" style="--c:${sc(s.id)}">
    <colgroup><col style="width:200px">${D.courses.map(() => '<col>').join('')}</colgroup>
    <thead><tr><th class="tname">Thread</th>${D.courses.map(c => `<th>${esc(c.short)}<small>${esc(c.grade.replace(' grade', ''))}</small><span class="bandbar c-${c.band}"></span></th>`).join('')}</tr></thead>
    <tbody>${ts.map(t => `<tr>
      <th class="tname" scope="row"><a href="#/thread/${t.id}">${esc(t.name)}</a>${t.note && review ? `<small>${esc(t.note)}</small>` : ''}
        ${WS ? `<div class="ws-row"><button class="btn small ghost" data-act="renameThread" data-thread="${t.id}">Rename</button><button class="btn small ghost" data-act="threadNote" data-thread="${t.id}">Note</button></div>` : ''}</th>
      ${D.courses.map(c => {
        const ps = inCell(t.id, c.id), txt = t.cells?.[c.id] || '';
        const fl = review ? flagsAt(t.id, c.id) : [];
        const ov = showOv() ? new Set(ps.flatMap(p => openOverlapsOf(p.code).map(o => o.id))).size : 0;
        const tags = fl.map(f => `<span class="tag ${f.kind}">${KIND[f.kind] || f.kind}</span>`).join('') + (ov ? `<span class="tag overlap">${ov} overlap${ov > 1 ? 's' : ''}</span>` : '');
        if (!ps.length && !txt) return `<td><button class="cell na" data-act="cell" data-thread="${t.id}" data-course="${c.id}">n/a${tags ? `<span class="flags">${tags}</span>` : ''}</button></td>`;
        const w = ps.length ? (ps.length / max).toFixed(2) : 0;   // length of the count bar
        return `<td class="${ps.length ? 'has' : ''}" style="--w:${w}"><button class="cell ${ps.length ? 'has' : ''}" data-act="cell" data-thread="${t.id}" data-course="${c.id}">
          ${esc(txt || ps.map(p => p.text).slice(0, 2).join('; ')).replace(/\//g, '/<wbr>')}
          ${ps.length ? `<span class="n"><span class="bar" aria-hidden="true"></span>${ps.length} prof.</span>` : '<span class="n">see note</span>'}
          ${tags ? `<span class="flags">${tags}</span>` : ''}</button></td>`;
      }).join('')}
    </tr>`).join('')}</tbody>
  </table></div>
  ${WS ? `<div class="ws-row" style="margin-top:14px"><button class="btn small" data-act="addThread" data-strand="${s.id}">+ Add a thread to ${esc(s.name)}</button></div>` : ''}`;
}

function vThread(tid) {
  const t = T.get(tid);
  if (!t) return vMissing();
  const s = S.get(t.strand), sibs = threadsOf(s.id), i = sibs.indexOf(t);
  const stops = D.courses.map(c => ({ c, ps: inCell(t.id, c.id), txt: t.cells?.[c.id] || '' }));
  return `
  <div class="crumbs"><a href="#/scope/${s.id}">Scope &amp; Sequence</a> / <a href="#/scope/${s.id}">${esc(s.name)}</a></div>
  <div class="phead"><div style="--c:${sc(s.id)}">
    <span class="pill" style="--c:${sc(s.id)}"><span class="dot"></span>${esc(s.name)}</span>
    <h1 style="margin-top:10px">${esc(t.name)}</h1>
    ${t.note ? `<p>${esc(t.note)}</p>` : ''}
  </div>
  <div class="toolbar">${i > 0 ? `<a class="btn small" href="#/thread/${sibs[i - 1].id}">← ${esc(sibs[i - 1].name)}</a>` : ''}${i < sibs.length - 1 ? `<a class="btn small" href="#/thread/${sibs[i + 1].id}">${esc(sibs[i + 1].name)} →</a>` : ''}</div></div>
  <ol class="story" style="--c:${sc(s.id)}">${stops.map(({ c, ps, txt }) => {
    if (!ps.length && !txt) return `<li class="off"><div class="when">${esc(c.short)}<small>${esc(c.grade)}</small></div><span class="stop"></span><div class="what">Not part of this course</div></li>`;
    return `<li><div class="when">${esc(c.short)}<small>${esc(c.grade)}</small></div><span class="stop"></span>
      <div class="what"><h4><a href="#/course/${c.id}" style="color:inherit">${esc(c.name)}</a></h4>${txt ? `<div class="muted">${esc(txt)}</div>` : ''}
        ${ps.length ? `<ul>${ps.map(p => `<li><span class="code">${p.code}</span>${esc(p.text)}</li>`).join('')}</ul>` : ''}</div></li>`;
  }).join('')}</ol>`;
}

function vReview() {
  const filt = store.get('ovFilter', 'open');
  const ov = D.overlaps.filter(o => filt === 'all' || (filt === 'open' ? o.status === 'open' : o.status !== 'open'));
  const fl = D.flags;
  const opt = [['spiral', 'Spiral: taught again, deeper'], ['redundant', 'Redundant: one should go'], ['distinct', 'Not the same thing']];
  return `
  <div class="phead"><div><h1>Department review</h1>
    <p>Open questions and possible overlaps. A repeated proficiency is fine when it's a <b>spiral</b> (taught again at more depth); it's a problem when it's <b>redundant</b>. Each overlap needs one of those decisions.</p></div></div>
  <div class="cols">
    <section class="card"><h3>Open questions · ${fl.filter(f => f.status !== 'resolved').length}</h3>
      ${fl.map(f => {
        const t = T.get(f.thread), c = C.get(f.course);
        return `<div class="item"><div class="row"><span class="tag ${f.kind}">${KIND[f.kind] || f.kind}</span>
          <span class="status">${f.status === 'resolved' ? 'Resolved' : ''}</span></div>
          <div style="margin-top:6px">${esc(f.text)}</div>
          <div class="sub muted" style="font-size:12px;margin-top:4px">${c ? `<a href="#/course/${c.id}">${esc(c.name)}</a>` : ''}${t ? ` · <a href="#/thread/${t.id}">${esc(t.name)}</a>` : ''}</div>
          ${WS ? `<div class="decide"><button class="${f.status === 'resolved' ? 'on' : ''}" data-act="flag" data-id="${f.id}" data-status="${f.status === 'resolved' ? 'open' : 'resolved'}">${f.status === 'resolved' ? 'Reopen' : 'Mark resolved'}</button></div>` : ''}</div>`;
      }).join('')}
      ${WS ? `<div class="ws-row" style="margin-top:10px"><button class="btn small" data-act="addFlag">+ Raise a question</button></div>` : ''}
    </section>
    <section class="card"><h3>Possible overlaps · ${D.overlaps.filter(o => o.status === 'open').length} undecided</h3>
      <p class="muted" style="margin:0 0 6px;font-size:13px">Found automatically: proficiencies in the same thread, in courses a student takes in sequence, with nearly the same wording.</p>
      <div class="seg" style="margin:8px 0">${[['open', 'Undecided'], ['done', 'Decided'], ['all', 'All']].map(([k, l]) => `<button class="${filt === k ? 'on' : ''}" style="--c:var(--teal)" data-act="ovFilter" data-f="${k}">${l}</button>`).join('')}</div>
      ${ov.length ? ov.map(o => {
        const a = P.get(o.a), b = P.get(o.b);
        if (!a || !b) return '';
        return `<div class="item"><div class="row"><span class="status">${o.status === 'open' ? 'Undecided' : esc(o.status)}</span><span class="muted" style="font-size:12px">${esc(T.get(a.thread)?.name || '')}</span></div>
          <div class="pair"><div><span class="code">${a.code} · ${esc(C.get(a.course).short)}</span>${esc(a.text)}</div><div><span class="code">${b.code} · ${esc(C.get(b.course).short)}</span>${esc(b.text)}</div></div>
          ${o.note ? `<div class="muted" style="font-size:13px">${esc(o.note)}</div>` : ''}
          ${WS ? `<div class="decide">${opt.map(([k, l]) => `<button class="${o.status === k ? 'on' : ''}" data-act="decide" data-id="${esc(o.id)}" data-status="${k}">${l}</button>`).join('')}</div>` : ''}</div>`;
      }).join('') : '<div class="empty-note">Nothing here.</div>'}
    </section>
  </div>`;
}

/* ── Assign: teacher builds a practice link ── */

function assignState() {
  return store.get('assign', { course: 'IM3', picked: [], title: '', note: '', due: '', q: '' });
}

function vAssign(params) {
  const st = assignState();
  if (params.get('c') && C.has(params.get('c'))) { st.course = params.get('c'); store.set('assign', st); }
  const c = C.get(st.course) || D.courses[0];
  const q = (st.q || '').toLowerCase();
  const ps = (q ? live().filter(p => (p.code + ' ' + p.text).toLowerCase().includes(q)) : ofCourse(c.id));
  const groups = q ? [['Search results', ps]] : [...new Set(ps.map(p => p.unit || ''))].map(u => [u || c.name, ps.filter(p => (p.unit || '') === u)]);
  const picked = st.picked.filter(code => P.has(code));
  return `
  <div class="phead"><div><h1>Assign practice</h1>
    <p>Pick the proficiencies a student needs for summer or make-up work. You get a link (and a QR code) that opens a practice page with resources for each one. No student information is stored; the link just lists proficiency codes and your note.</p></div></div>
  <div class="split">
    <div>
      <div class="seg">${D.courses.map(x => `<button class="${x.id === c.id && !q ? 'on' : ''}" style="--c:${x.band === 'ms' ? 'var(--teal)' : x.band === 'hs' ? 'var(--gold)' : x.band === 'el' ? 'var(--coral)' : 'var(--graphite)'}" data-act="aCourse" data-course="${x.id}">${esc(x.short)}</button>`).join('')}</div>
      <div class="toolbar">
        <div class="search">${icon.search}<input id="aq" placeholder="Search all proficiencies…" value="${esc(st.q)}" autocomplete="off"></div>
        <select class="inp" data-act="prepare" aria-label="Prepare a student for a course">
          <option value="">Prepare for a course…</option>
          ${D.courses.filter(x => FEEDS[x.id]).map(x => `<option value="${x.id}">Summer before ${esc(x.name)}</option>`).join('')}
        </select>
      </div>
      ${groups.map(([g, list]) => `<div class="group"><h3>${esc(g)} · ${list.length}
        <button class="btn small ghost" style="margin-left:auto;text-transform:none;letter-spacing:0" data-act="pickAll" data-codes="${list.map(p => p.code).join(' ')}">Select all</button></h3>
        <ul class="plist">${list.map(p => `<li><label class="check"><input type="checkbox" data-act="pick" data-code="${p.code}" ${picked.includes(p.code) ? 'checked' : ''}>
          <span class="code">${p.code}</span><span class="ptext">${esc(p.text)}${q ? `<span class="sub">${esc(C.get(p.course).name)}</span>` : ''}</span></label></li>`).join('')}</ul></div>`).join('')}
    </div>
    <aside class="tray">
      <h3>${picked.length} selected</h3>
      <ul class="picked">${picked.map(code => `<li><span class="code">${code}</span><span>${esc(P.get(code).text)}</span><button data-act="unpick" data-code="${code}" aria-label="Remove ${code}">${icon.x}</button></li>`).join('') || '<li class="muted">Check proficiencies on the left.</li>'}</ul>
      ${picked.length ? '<button class="btn small ghost" data-act="clearPicked" style="margin-top:8px">Clear all</button>' : ''}
      <label for="at">Title</label><input id="at" class="inp" placeholder="e.g. Summer prep for Precalculus" value="${esc(st.title)}">
      <label for="an">Note to the student</label><textarea id="an" class="inp" placeholder="What to do, how to show me, when it's due…">${esc(st.note)}</textarea>
      <label for="ad">Due (optional)</label><input id="ad" class="inp" type="date" value="${esc(st.due)}">
      <div style="margin-top:16px"><button class="btn primary" data-act="makeLink" ${picked.length ? '' : 'disabled'} style="width:100%;justify-content:center">Create link</button></div>
      <div id="linkout"></div>
    </aside>
  </div>`;
}

/* Link format: #/p?s=IM3.05.07~PC.01&t=title&n=note&d=2027-08-20
   Codes are grouped by course prefix so a 20-item list stays short. */
function encodeCodes(codes) {
  const g = new Map();
  for (const code of codes) {
    const i = code.indexOf('-');
    const k = code.slice(0, i);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(code.slice(i + 1));
  }
  return [...g].map(([k, v]) => [k, ...v].join('.')).join('~');
}
function decodeCodes(s) {
  return (s || '').split('~').filter(Boolean).flatMap(part => {
    const [k, ...v] = part.split('.');
    return v.map(x => `${k}-${x}`);
  });
}
function practiceUrl(st) {
  const q = new URLSearchParams();
  q.set('s', encodeCodes(st.picked));
  if (st.title) q.set('t', st.title);
  if (st.note) q.set('n', st.note);
  if (st.due) q.set('d', st.due);
  const base = WS ? PUBLIC_URL : location.origin + location.pathname;
  return `${base}#/p?${q.toString()}`;
}

function khan(p) {
  return 'https://www.khanacademy.org/search?page_search_query=' + encodeURIComponent(p.text.replace(/\(.*?\)/g, ''));
}

function vPractice(params) {
  const codes = decodeCodes(params.get('s'));
  const ps = codes.map(c => P.get(c)).filter(Boolean);
  const missing = codes.filter(c => !P.has(c));
  const key = 'done:' + params.get('s');
  const done = new Set(store.get(key, []));
  const n = ps.filter(p => done.has(p.code)).length;
  const due = params.get('d'), code = params.get('c');
  if (code) remember(code, params.get('t') || 'Practice', location.hash);
  const back = encodeURIComponent(location.hash);
  return `
  <section class="practice-head">
    <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85">NWA Mathematics · Practice${code ? ` · code ${esc(code)}` : ''}</div>
    <h1 style="margin-top:6px">${esc(params.get('t') || 'Your practice list')}</h1>
    ${due ? `<div style="margin-top:6px;font-weight:600">Due ${esc(new Date(due + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</div>` : ''}
    ${params.get('n') ? `<div class="note">${esc(params.get('n'))}</div>` : ''}
    <div class="progress" aria-label="${n} of ${ps.length} done"><i style="width:${ps.length ? 100 * n / ps.length : 0}%"></i></div>
    <div style="font-size:13px;margin-top:6px;opacity:.9">${n} of ${ps.length} checked off · your checkmarks are saved on this device only</div>
  </section>
  <div class="toolbar noprint" style="margin-bottom:14px"><button class="btn small" onclick="window.print()">Print this list</button></div>
  ${ps.map(p => {
    const c = C.get(p.course), rs = resOf(p.code);
    return `<div class="pcard ${done.has(p.code) ? 'done' : ''}">
      <label class="check"><input type="checkbox" data-act="did" data-key="${esc(key)}" data-code="${p.code}" ${done.has(p.code) ? 'checked' : ''}>
        <span class="ptext"><b>${esc(p.text)}</b><span class="sub">${p.code} · ${esc(c.name)}${p.unit ? ' · ' + esc(p.unit) : ''}</span></span></label>
      <div class="res">${PX[p.code] ? `<a class="prac" href="#/q/${p.code}?back=${back}"><span class="kind">practice</span>${PX[p.code].n} self-check problems</a>` : ''}${rs.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener"><span class="kind">${esc(r.kind || 'link')}</span>${esc(r.title)}</a>`).join('')}
        <a class="fallback" href="${khan(p)}" target="_blank" rel="noopener">Search Khan Academy ↗</a></div>
    </div>`;
  }).join('')}
  ${missing.length ? `<p class="muted">Some items on this link (${missing.map(esc).join(', ')}) are no longer in the curriculum. Ask your teacher.</p>` : ''}
  ${!ps.length ? '<div class="empty-note">This link has no proficiencies on it. Ask your teacher for a new one.</div>' : ''}`;
}

/* Class codes: data/plans.json is written by the Workshop when a teacher saves a plan.
   The code resolves to an ordinary #/p link, so the page then works offline like any link.
   Codes a student has opened are remembered on this device (store 'mine'). */
const CODE_RE = /^[A-HJKMNP-Z2-9]{5}$/;   // no 0/O, 1/I/L: easy to read aloud and type
function remember(code, title, hash) {
  const mine = store.get('mine', []).filter(m => m.code !== code);
  mine.unshift({ code, title, hash, at: Date.now() });
  store.set('mine', mine.slice(0, 12));
}
function vCode(code) {
  code = (code || '').toUpperCase();
  const saved = store.get('mine', []).find(m => m.code === code);
  setTimeout(async () => {
    try {
      const plans = await (await fetch(BASE + 'data/plans.json', { cache: 'no-cache' })).json();
      const pl = plans.plans && plans.plans[code];
      if (!pl) throw new Error('none');
      const q = new URLSearchParams({ s: pl.s, c: code });
      if (pl.t) q.set('t', pl.t); if (pl.n) q.set('n', pl.n); if (pl.d) q.set('d', pl.d);
      location.replace('#/p?' + q.toString());
    } catch (e) {
      if (saved) return location.replace(saved.hash);
      $('#app').innerHTML = `<div class="empty-note">No practice plan has the code <b>${esc(code)}</b>. Check the letters with your teacher. (Codes never use 0, 1, O, I or L.)</div>${codeBox()}`;
    }
  });
  return `<div class="empty-note">Looking up ${esc(code)}…</div>`;
}
function codeBox() {
  const mine = store.get('mine', []);
  return `<form class="codebox" data-form="code">
    <label for="codein"><b>Have a practice code from your teacher?</b></label>
    <div class="row"><input id="codein" class="inp" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. K7QM4" aria-label="Practice code">
    <button class="btn primary">Open</button></div>
    ${mine.length ? `<div class="mine"><span class="muted">Your plans on this device:</span> ${mine.map(m => `<a class="pill" href="${esc(m.hash)}"><b>${esc(m.code)}</b> ${esc(m.title)}</a>`).join(' ')}</div>` : ''}
  </form>`;
}
function vQuiz(code, params) {
  const p = P.get(code);
  if (!p || !PX[code]) return vMissing();
  const back = params.get('back');
  setTimeout(async () => {
    const el = $('#quiz');
    try {
      const set = await (await fetch(BASE + 'practice/' + code + '.json', { cache: 'no-cache' })).json();
      if (!window.NWAPractice) await loadScript(BASE + 'practice.js');
      window.NWAPractice.mount(el, set, { back: back || `#/course/${p.course}` });
    } catch (e) { el.innerHTML = '<div class="empty-note">Could not load these problems. Check your connection and try again.</div>'; }
  });
  return `<div class="crumbs">${back ? `<a href="${esc(back)}">Practice list</a>` : `<a href="#/course/${p.course}">${esc(C.get(p.course).name)}</a>`} / ${p.code}</div>
  <div class="phead"><div><h1 style="font-size:clamp(22px,3.4vw,30px)">${esc(p.text)}</h1>
    <p>${p.code} · ${esc(C.get(p.course).name)} · each try gives new numbers; your score stays on this device.</p></div></div>
  <div id="quiz" class="quiz"><div class="empty-note">Loading problems…</div></div>`;
}

function vMissing() {
  return '<div class="empty-note">Page not found. <a href="#/">Back to the program</a></div>';
}

/* ───────────────────────── modal ───────────────────────── */

function modal(html) {
  $('#modalbody').innerHTML = html;
  $('#scrim').classList.add('on');
  const f = $('#modalbody [autofocus]') || $('#scrim .x');
  f && f.focus();
}
function closeModal() { $('#scrim').classList.remove('on'); }

function cellModal(tid, cid) {
  const t = T.get(tid), c = C.get(cid), ps = inCell(tid, cid), txt = t.cells?.[cid] || '';
  const fl = flagsAt(tid, cid);
  modal(`
    <span class="pill" style="--c:${sc(t.strand)}"><span class="dot"></span>${esc(S.get(t.strand).name)}</span>
    <h2 style="margin-top:10px">${esc(t.name)} · ${esc(c.name)}</h2>
    ${WS ? `<label class="muted" style="display:block;font-size:12px;font-weight:700;margin-top:14px;text-transform:uppercase;letter-spacing:.05em">Cell description (what the template cell says)</label>
      <textarea class="inp" id="celltext" autofocus placeholder="Short description, or leave blank for n/a">${esc(txt)}</textarea>
      <div class="ws-row"><button class="btn small primary" data-act="saveCell" data-thread="${tid}" data-course="${cid}">Save description</button></div>`
      : `<p class="lead">${esc(txt || (ps.length ? '' : 'Not covered in this course.'))}</p>`}
    ${fl.map(f => `<p><span class="tag ${f.kind}">${KIND[f.kind] || f.kind}</span> ${esc(f.text)}</p>`).join('')}
    ${ps.length ? `<ul class="plist">${ps.map(p => profRow(p, { showThread: false })).join('')}</ul>` : ''}
    <div class="ws-row" style="margin-top:14px">
      <a class="btn small" href="#/thread/${tid}" data-act="close">Follow this thread →</a>
      <a class="btn small" href="#/course/${cid}" data-act="close">Open ${esc(c.short)} →</a>
    </div>`);
}

function promptModal(title, fields, onSave) {
  modal(`<h2>${esc(title)}</h2>
    ${fields.map((f, i) => `<label class="muted" style="display:block;font-size:12px;font-weight:700;margin-top:14px;text-transform:uppercase;letter-spacing:.05em" for="pf${i}">${esc(f.label)}</label>
      ${f.type === 'textarea' ? `<textarea class="inp" id="pf${i}" ${i ? '' : 'autofocus'}>${esc(f.value || '')}</textarea>`
      : f.type === 'select' ? `<select class="inp" id="pf${i}" style="width:100%">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
      : f.type === 'file' ? `<input class="inp" id="pf${i}" type="file" style="width:100%">`
      : `<input class="inp" id="pf${i}" style="width:100%" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${i ? '' : 'autofocus'}>`}
      ${f.help ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(f.help)}</div>` : ''}`).join('')}
    <div class="ws-row" style="margin-top:16px"><button class="btn primary" id="pfsave">Save</button><button class="btn ghost" data-act="close">Cancel</button></div>`);
  $('#pfsave').onclick = async () => {
    const vals = fields.map((f, i) => f.type === 'file' ? $('#pf' + i).files[0] : $('#pf' + i).value.trim());
    $('#pfsave').disabled = true;
    try { await onSave(vals); closeModal(); } catch (e) { $('#pfsave').disabled = false; }
  };
}

const fileToB64 = f => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(f);
});

/* ───────────────────────── Excel ───────────────────────── */

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

async function exportXlsx() {
  toast('Building spreadsheet…');
  if (!window.XLSX) await loadScript(VENDOR.xlsx);
  const X = window.XLSX, wb = X.utils.book_new();
  const head = ['Thread', ...D.courses.map(c => `${c.name} (${c.grade})`), 'Notes'];
  const over = [
    [`${D.title} — Scope and Sequence ${D.year}`], [D.status === 'draft' ? 'DRAFT for department review' : `Published ${D.published || ''}`], [],
    ['One tab per strand. Columns are courses; rows are the threads shared across courses.'],
    ['Each cell is a short description of that thread in that course, or n/a if the course does not cover it.'],
    ['The full list of proficiencies is on the last tab.'], [],
    ['Strand', 'Threads', 'Summary'],
    ...D.strands.map(s => [s.name, threadsOf(s.id).length, s.summary]),
  ];
  const ws0 = X.utils.aoa_to_sheet(over);
  ws0['!cols'] = [{ wch: 34 }, { wch: 9 }, { wch: 110 }];
  X.utils.book_append_sheet(wb, ws0, 'Overview');
  for (const s of D.strands) {
    const rows = [head, ...threadsOf(s.id).map(t => [t.name, ...D.courses.map(c => {
      const ps = inCell(t.id, c.id), txt = t.cells?.[c.id];
      return txt || (ps.length ? ps.map(p => p.text).join('; ') : 'n/a');
    }), t.note || ''])];
    const ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, ...D.courses.map(() => ({ wch: 28 })), { wch: 40 }];
    X.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
  }
  const all = [['Code', 'Course', 'Unit', 'Proficiency', 'Strand', 'Thread'],
    ...live().map(p => [p.code, C.get(p.course).name, p.unit || '', p.text, strandOf(p)?.name || '', T.get(p.thread)?.name || ''])];
  const wsA = X.utils.aoa_to_sheet(all);
  wsA['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 80 }, { wch: 28 }, { wch: 34 }];
  X.utils.book_append_sheet(wb, wsA, 'All proficiencies');
  X.writeFile(wb, `NWA Math Scope and Sequence ${D.year.replace('–', '-')}.xlsx`);
}

/* ───────────────────────── router ───────────────────────── */

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: new URLSearchParams(qs || '') };
}

function render() {
  const { parts, params } = route();
  const [v, id] = parts;
  let html, tab = '';
  switch (v) {
    case 'course': html = vCourse(id); tab = 'home'; break;
    case 'scope': html = vScope(id); tab = 'scope'; break;
    case 'thread': html = vThread(id); tab = 'scope'; break;
    case 'review': html = vReview(); tab = 'review'; break;
    case 'assign': html = vAssign(params); tab = 'assign'; break;
    case 'p': html = vPractice(params); tab = ''; break;
    case 'c': html = vCode(id); tab = ''; break;
    case 'q': html = vQuiz(id, params); tab = ''; break;
    default: html = vHome(); tab = 'home';
  }
  $('#app').innerHTML = html;
  $$('nav.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  document.body.classList.toggle('student', v === 'p' || v === 'c' || (v === 'q' && params.has('back')));
  const t = { course: C.get(id)?.name, scope: 'Scope & Sequence', thread: T.get(id)?.name, review: 'Department review', assign: 'Assign practice', p: params.get('t') || 'Practice', q: id, c: 'Practice code' }[v];
  document.title = (t ? t + ' · ' : '') + 'NWA Math';
}

let lastPath = '';
function onRoute() {
  closeModal();
  const p = location.hash.split('?')[0];
  render();
  if (p !== lastPath) window.scrollTo(0, 0);
  lastPath = p;
}

/* ───────────────────────── events ───────────────────────── */

function assignSet(fn) { const st = assignState(); fn(st); store.set('assign', st); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.getAttribute('href') === '#') e.preventDefault();
  const a = el.dataset.act, d = el.dataset;
  switch (a) {
    case 'close': closeModal(); break;
    case 'theme': {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next; store.set('theme', next); break;
    }
    case 'xlsx': exportXlsx().catch(err => toast(err.message)); break;
    case 'glance': location.hash = `#/scope/${d.strand}`; break;
    case 'strand': location.hash = `#/scope/${d.strand}`; break;
    case 'cell': cellModal(d.thread, d.course); break;
    case 'courseMode': store.set('courseMode', d.mode); render(); break;
    case 'ovFilter': store.set('ovFilter', d.f); render(); break;
    case 'aCourse': assignSet(st => { st.course = d.course; st.q = ''; }); render(); break;
    case 'pickAll': assignSet(st => { for (const c of d.codes.split(' ')) if (!st.picked.includes(c)) st.picked.push(c); }); render(); break;
    case 'unpick': assignSet(st => { st.picked = st.picked.filter(c => c !== d.code); }); render(); break;
    case 'clearPicked': assignSet(st => { st.picked = []; }); render(); break;
    case 'makeLink': {
      const st = assignState(), url = practiceUrl(st);
      const out = $('#linkout');
      out.innerHTML = `<div class="linkbox"><input class="inp" readonly value="${esc(url)}" id="plink"><button class="btn small" data-act="copy">Copy</button></div>
        <div class="ws-row"><a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">Preview</a><button class="btn small" data-act="copyEmail">Copy email text</button></div>
        <div id="qr" aria-label="QR code for the practice link"></div>
        ${WS ? '<div class="ws-row"><button class="btn small primary" data-act="makeCode">Make a class code</button><span class="muted small">A short code students type into the site.</span></div><div id="codeout"></div>'
             : '<p class="muted small">Need a short code students can type in? Make the list in the Workshop.</p>'}`;
      try {
        if (!window.qrcode) await loadScript(VENDOR.qr);
        const q = window.qrcode(0, 'M'); q.addData(url); q.make();
        $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      } catch (err) { $('#qr').remove(); }
      break;
    }
    case 'copy': navigator.clipboard.writeText($('#plink').value).then(() => toast('Link copied')); break;
    case 'makeCode': {
      const st = assignState();
      el.disabled = true;
      try {
        const r = await api({ op: 'savePlan', s: encodeCodes(st.picked), t: st.title, n: st.note, d: st.due });
        $('#codeout').innerHTML = `<div class="bigcode">${esc(r.code)}</div>
          <p class="small">Students open <b>${esc(PUBLIC_URL.replace(/^https:\/\//, ''))}</b>, type <b>${esc(r.code)}</b>, and get this list with its practice problems.
          ${r.live ? 'It works now.' : 'It works after the next publish (no GitHub token yet).'}</p>`;
      } catch (err) { toast('No code: ' + (err.message || err)); el.disabled = false; }
      break;
    }
    case 'copyEmail': {
      const st = assignState();
      const txt = `${st.title || 'Math practice'}${NL2}${st.note ? st.note + NL2 : ''}Your practice list (${st.picked.length} proficiencies)${st.due ? ', due ' + st.due : ''}:${NL}${$('#plink').value}${NL2}Each item has links to practice resources. Check things off as you go.`;
      navigator.clipboard.writeText(txt).then(() => toast('Email text copied')); break;
    }
    /* ── workshop edits ── */
    case 'saveCell': await edit({ op: 'setCell', thread: d.thread, course: d.course, text: $('#celltext').value.trim() }); cellModal(d.thread, d.course); break;
    case 'editProf': {
      const p = P.get(d.code);
      promptModal(`Edit ${p.code}`, [{ label: 'Proficiency wording (imperative voice, sentence case)', type: 'textarea', value: p.text, help: 'The old wording is kept as history.' }],
        ([text]) => text && text !== p.text ? edit({ op: 'editProf', code: p.code, text }) : Promise.resolve());
      break;
    }
    case 'retire': {
      const p = P.get(d.code);
      if (confirm(`Retire ${p.code}: “${p.text}”?${NL2}It disappears from the site. The code is never reused, and old practice links will say it is no longer in the curriculum.`))
        await edit({ op: 'retireProf', code: p.code }, `${p.code} retired`);
      break;
    }
    case 'addProf': {
      const c = C.get(d.course), units = [...new Set(ofCourse(c.id).map(p => p.unit).filter(Boolean))];
      promptModal(`New proficiency in ${c.name}`, [
        { label: 'Proficiency', placeholder: 'e.g. Graph rational functions and identify asymptotes' },
        { label: 'Unit (optional)', value: units[units.length - 1] || '', placeholder: 'e.g. Unit 3: Polynomials' },
        { label: 'Thread', type: 'select', value: D.threads[0].id, options: D.threads.map(t => [t.id, `${S.get(t.strand).name} › ${t.name}`]) },
      ], ([text, unit, thread]) => text ? edit({ op: 'addProf', course: c.id, unit, text, thread }, 'Proficiency added') : Promise.resolve());
      break;
    }
    case 'addRes': {
      const p = P.get(d.code);
      promptModal(`Add a resource for ${p.code}`, [
        { label: 'Title', placeholder: 'e.g. Khan Academy: Graphing rational functions' },
        { label: 'Link', placeholder: 'https://…', help: 'Paste a link, or choose a file below instead.' },
        { label: 'Or upload a file (PDF, image, doc)', type: 'file' },
        { label: 'Kind', type: 'select', value: 'video', options: [['video', 'Video'], ['practice', 'Practice problems'], ['notes', 'Notes'], ['interactive', 'Interactive'], ['link', 'Other link']] },
      ], async ([title, url, file, kind]) => {
        if (file) {
          if (file.size > 20e6) { toast('Files must be under 20 MB'); throw new Error('too big'); }
          return edit({ op: 'uploadResource', code: p.code, title: title || file.name, kind, name: file.name, mime: file.type, b64: await fileToB64(file) }, 'Uploaded');
        }
        if (!/^https?:\/\//.test(url)) { toast('Paste a full link starting with https://'); throw new Error('bad url'); }
        return edit({ op: 'addResource', code: p.code, title: title || url, url, kind }, 'Resource added');
      });
      break;
    }
    case 'renameThread': {
      const t = T.get(d.thread);
      promptModal('Rename thread', [{ label: 'Thread name', value: t.name }], ([name]) => name ? edit({ op: 'renameThread', thread: t.id, name }) : Promise.resolve());
      break;
    }
    case 'threadNote': {
      const t = T.get(d.thread);
      promptModal(`Note on “${t.name}”`, [{ label: 'Note (shows in the template’s Notes column)', type: 'textarea', value: t.note }], ([note]) => edit({ op: 'setThreadNote', thread: t.id, note }));
      break;
    }
    case 'addThread': {
      const s = S.get(d.strand);
      promptModal(`New thread in ${s.name}`, [{ label: 'Thread name', placeholder: 'e.g. Rational functions' }], ([name]) => name ? edit({ op: 'addThread', strand: s.id, name }, 'Thread added') : Promise.resolve());
      break;
    }
    case 'decide': {
      const o = D.overlaps.find(x => x.id === d.id);
      const status = o.status === d.status ? 'open' : d.status;
      await edit({ op: 'decideOverlap', id: o.id, status, note: o.note || '' }, status === 'open' ? 'Reopened' : 'Decided');
      break;
    }
    case 'flag': await edit({ op: 'setFlag', id: d.id, status: d.status }); break;
    case 'addFlag': promptModal('Raise a question for the department', [
        { label: 'Question or issue', type: 'textarea' },
        { label: 'Kind', type: 'select', value: 'todo', options: Object.entries(KIND) },
        { label: 'Course', type: 'select', value: D.courses[0].id, options: D.courses.map(c => [c.id, c.name]) },
        { label: 'Thread', type: 'select', value: D.threads[0].id, options: D.threads.map(t => [t.id, `${S.get(t.strand).name} › ${t.name}`]) },
      ], ([text, kind, course, thread]) => text ? edit({ op: 'addFlag', text, kind, course, thread }, 'Question added') : Promise.resolve());
      break;
    case 'refresh': google.script.run.withSuccessHandler(data => { D = data; index(); render(); toast('Up to date'); }).getData(); break;
    case 'publish':
      if (confirm('Publish the current Sheet to the public site?' + NL2 + 'This replaces what parents and students see. Every published version is kept in GitHub history.'))
        google.script.run.withSuccessHandler(r => toast(r)).withFailureHandler(err => toast('Publish failed: ' + err.message)).publish();
      break;
  }
});

document.addEventListener('change', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, d = el.dataset;
  if (a === 'pick') { assignSet(st => { st.picked = el.checked ? [...new Set([...st.picked, d.code])] : st.picked.filter(c => c !== d.code); }); render(); }
  if (a === 'review') { store.set('review', el.checked); render(); }
  if (a === 'ovShow') { store.set('ovShow', el.checked); render(); }
  if (a === 'did') {
    const done = new Set(store.get(d.key, []));
    el.checked ? done.add(d.code) : done.delete(d.code);
    store.set(d.key, [...done]); render();
  }
  if (a === 'prepare' && el.value) {
    const target = el.value, ts = new Set(ofCourse(target).map(p => p.thread));
    const prior = live().filter(p => FEEDS[target].includes(p.course) && ts.has(p.thread)).map(p => p.code);
    assignSet(st => { st.picked = [...new Set([...st.picked, ...prior])]; if (!st.title) st.title = `Summer prep for ${C.get(target).name}`; st.course = FEEDS[target][0]; st.q = ''; });
    toast(`${prior.length} proficiencies from ${FEEDS[target].map(c => C.get(c).short).join(' / ')} that lead into ${C.get(target).short}`);
    render();
  }
  if (a === 'move') {
    const p = P.get(d.code);
    if (el.value !== p.thread) await edit({ op: 'moveProf', code: p.code, thread: el.value }, `${p.code} → ${T.get(el.value).name}`);
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'aq') {
    assignSet(st => { st.q = e.target.value; });
    const pos = e.target.selectionStart;
    render();
    const i = $('#aq'); i.focus(); i.setSelectionRange(pos, pos);
  }
  if (['at', 'an', 'ad'].includes(e.target.id)) assignSet(st => { st[{ at: 'title', an: 'note', ad: 'due' }[e.target.id]] = e.target.value; });
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('submit', e => {
  if (e.target.dataset.form !== 'code') return;
  e.preventDefault();
  const code = $('#codein').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE_RE.test(code)) { toast('Codes are 5 letters and numbers, like K7QM4'); return; }
  location.hash = '#/c/' + code;
});

/* ───────────────────────── boot ───────────────────────── */

function shell() {
  document.body.classList.toggle('ws', WS);
  document.documentElement.dataset.theme = store.get('theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.body.innerHTML = `
  ${WS ? `<div class="ws-banner"><b>Workshop</b> · editing the shared draft as ${esc(window.NWA_USER || 'you')} · changes save straight to the department Sheet
    · <a href="#" data-act="refresh" style="color:#fff;text-decoration:underline">refresh</a>${window.NWA_CHAIR ? ' · <a href="#" data-act="publish" style="color:#fff;text-decoration:underline">publish to public site</a>' : ''}</div>` : ''}
  <header id="bar"><div class="in">
    <a class="brand" href="#/"><img src="${WS ? PUBLIC_URL : ''}icons/icon-192.png" alt=""><span>NWA Math<small>Proficiencies · ${esc(D.year)}</small></span></a>
    <nav class="tabs" aria-label="Sections">
      <a href="#/" data-tab="home">Courses</a>
      <a href="#/scope/${D.strands[0].id}" data-tab="scope">Scope &amp; Sequence</a>
      <a href="#/assign" data-tab="assign">Assign practice</a>
      <a href="#/review" data-tab="review">Review</a>
    </nav>
    <button class="iconbtn" data-act="theme" title="Light / dark" aria-label="Toggle light or dark theme">${icon.sun}</button>
  </div></header>
  <main id="app"></main>
  <footer>Northwest Academy Mathematics Department · ${esc(D.year)}${D.published ? ' · published ' + esc(D.published) : ''} · Proficiency codes are permanent: a retired code is never reused.</footer>
  <div class="scrim" id="scrim" data-act-scrim><div class="modal" role="dialog" aria-modal="true"><button class="iconbtn x" data-act="close" aria-label="Close">${icon.x}</button><div id="modalbody"></div></div></div>
  <div id="toast" role="status"></div>`;
  $('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeModal(); });
}

/* In the Workshop a blank page helps nobody: show what broke, so it can be reported. */
function fatal(e) {
  const msg = WS ? `<b>The Workshop hit an error.</b> Send this to Ryan:<pre style="white-space:pre-wrap;font:12px ui-monospace,monospace;margin-top:10px">${esc(e && (e.stack || e.message) || e)}</pre>`
                 : 'Could not load the curriculum data. Check your connection and reload.';
  document.body.insertAdjacentHTML('afterbegin', `<div style="padding:24px 28px;margin:16px;border-radius:12px;background:#3a1f1a;color:#ffd9cf;font:15px/1.5 sans-serif">${msg}</div>`);
}
if (WS) window.addEventListener('error', e => fatal(e.error || e.message));

(async () => {
  try {
    await load();
  } catch (e) {
    fatal(e);
    return;
  }
  await loadPractice();
  try {
    shell();
    window.addEventListener('hashchange', onRoute);
    onRoute();
  } catch (e) { fatal(e); }
  if (!WS && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
})();
