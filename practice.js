/* NWA Math — practice sets: self-check problems for one proficiency.

   One JSON per proficiency code, practice/<CODE>.json; practice/index.json lists them.
   Same idea as the Astronomy study sets: static, no accounts, new numbers every try,
   progress only in this browser (localStorage "nwa:q:<question id>" = {right, wrong}).

   Question formats
     mc       choices[] + answer (index into choices); shuffled unless fixed: true
     numeric  answer (expression) + tol; students may type 3/4, -2, 0.75
     point    student taps the grid to place n points; check (expression over X1,Y1,X2,Y2…)
     slider   student sets controls{} so their curve g matches the dashed target; answers{}
   Any question may carry a graph: {window:[x0,x1,y0,y1], fns:[{f, label?, at?, dash?}], points:[[x,y]]}.

   Text is trusted HTML with KaTeX math in $…$. Computed values use double brackets, so
   LaTeX braces stay free:
     [[expr]]    the value                      [[f:expr]]  the value as a reduced fraction (\frac)
     [[+expr]]   a signed term: "+ 3", "- 3", or nothing for 0
     [[c:expr]]  a coefficient: 1 → "", -1 → "-"
   Params: {name: {min, max, step?, not?:[…]}}; derive: {name: expr} in order;
   where: an expression that must be true (resampled until it is).
*/
(() => {
'use strict';

/* ───────────── expressions ───────────── */

const FN = new Map();
const MATH = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  ln: Math.log, log: Math.log10, log2: Math.log2, logb: (b, x) => Math.log(x) / Math.log(b),
  pi: Math.PI, round: Math.round, floor: Math.floor, min: Math.min, max: Math.max };
function ev(expr, scope) {
  const keys = Object.keys(scope);
  const sig = keys.join(',') + '|' + expr;
  let f = FN.get(sig);
  if (!f) {
    f = new Function(...Object.keys(MATH), ...keys, `return (${String(expr).replace(/\^/g, '**')});`);
    FN.set(sig, f);
  }
  return f(...Object.values(MATH), ...keys.map(k => scope[k]));
}

const num = n => {
  if (typeof n !== 'number') return String(n);
  if (!isFinite(n)) return '\\text{undefined}';
  return String(Math.round(n * 1e4) / 1e4);
};
const tick = n => (n < 0 ? '−' : '') + Math.abs(n);      // SVG labels: a real minus sign

/* Best fraction with denominator ≤ 100, as LaTeX. */
function frac(x) {
  if (Number.isInteger(Math.round(x * 1e9) / 1e9)) return String(Math.round(x));
  let best = [Math.round(x), 1], err = Infinity;
  for (let d = 2; d <= 100; d++) {
    const n = Math.round(x * d), e = Math.abs(x - n / d);
    if (e < err - 1e-12) { best = [n, d]; err = e; }
    if (e < 1e-9) break;
  }
  const [n, d] = best;
  return (n < 0 ? '-' : '') + `\\frac{${Math.abs(n)}}{${d}}`;
}

function fill(s, v) {
  return String(s ?? '').replace(/\[\[(\+|c:|f:)?(.+?)\]\]/g, (_, mod, ex) => {
    const n = ev(ex, v);
    if (mod === '+') return n === 0 ? '' : (n < 0 ? ' - ' : ' + ') + num(Math.abs(n));
    if (mod === 'c:') return n === 1 ? '' : n === -1 ? '-' : num(n);
    if (mod === 'f:') return frac(n);
    return num(n);
  }).replace(/(^|[^A-Za-z\\])\(x\)/g, '$1x');   // (x[[+-h]]) with h = 0 → x, but f(x) stays
}

function sample(q) {
  for (let tries = 0; tries < 400; tries++) {
    const v = {};
    for (const [k, p] of Object.entries(q.params || {})) {
      const step = p.step || 1, n = Math.round((p.max - p.min) / step);
      let x;
      do { x = +(p.min + step * Math.floor(Math.random() * (n + 1))).toFixed(6); } while ((p.not || []).includes(x));
      v[k] = x;
    }
    for (const [k, ex] of Object.entries(q.derive || {})) v[k] = ev(ex, v);
    if (!q.where || ev(q.where, v)) return v;
  }
  throw new Error('No parameters satisfy ' + q.where);
}

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('nwa:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nwa:' + k, JSON.stringify(v)); } catch (e) {} },
};

function typeset(el) {
  if (!window.renderMathInElement) return;
  try {
    window.renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
  } catch (e) {}
}

/* ───────────── graph ───────────── */

const W = 360, H = 360;
function plotSvg(g, v, extra = {}) {
  const [x0, x1, y0, y1] = g.window || [-6, 6, -6, 6];
  const X = x => (x - x0) / (x1 - x0) * W, Y = y => H - (y - y0) / (y1 - y0) * H;
  const out = [];
  const every = (lo, hi) => Math.max(1, Math.ceil((hi - lo) / 12));
  const sx = every(x0, x1), sy = every(y0, y1);
  for (let x = Math.ceil(x0); x <= x1; x++) out.push(`<line class="g-grid" x1="${X(x)}" x2="${X(x)}" y1="0" y2="${H}"/>`);
  for (let y = Math.ceil(y0); y <= y1; y++) out.push(`<line class="g-grid" y1="${Y(y)}" y2="${Y(y)}" x1="0" x2="${W}"/>`);
  const ax = y0 <= 0 && y1 >= 0, ay = x0 <= 0 && x1 >= 0;
  if (ax) out.push(`<line class="g-axis" x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}"/>`);
  if (ay) out.push(`<line class="g-axis" y1="0" y2="${H}" x1="${X(0)}" x2="${X(0)}"/>`);
  const ly = ax ? Y(0) : H - 4, lx = ay ? X(0) : 4;
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) if (x && x > x0 && x < x1)
    out.push(`<text class="g-tick" x="${X(x)}" y="${Math.min(H - 4, ly + 15)}" text-anchor="middle">${tick(x)}</text>`);
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) if (y && y > y0 && y < y1)
    out.push(`<text class="g-tick" x="${lx > 26 ? lx - 6 : lx + 6}" y="${Y(y) + 4}" text-anchor="${lx > 26 ? 'end' : 'start'}">${tick(y)}</text>`);
  const curve = (f, cls) => {
    let d = '', pen = false;
    for (let i = 0; i <= 600; i++) {
      const x = x0 + (x1 - x0) * i / 600;
      let y; try { y = ev(f, { ...v, x }); } catch (e) { y = NaN; }
      if (!isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1);
      pen = true;
    }
    return `<path class="${cls}" d="${d}"/>`;
  };
  (g.fns || []).forEach((fn, i) => {
    out.push(curve(fn.f, `g-fn c${i}${fn.dash ? ' dash' : ''}`));
    if (fn.label) {
      const lx2 = fn.at != null ? ev(fn.at, v) : x0 + (x1 - x0) * 0.85, ly2 = ev(fn.f, { ...v, x: lx2 });
      out.push(`<text class="g-label c${i}" x="${X(lx2) + 8}" y="${Y(ly2) + 4}">${fn.label}</text>`);
    }
  });
  if (extra.student) out.push(curve(extra.student, 'g-fn student'));
  for (const [px, py] of g.points || []) out.push(`<circle class="g-pt" cx="${X(ev(px, v))}" cy="${Y(ev(py, v))}" r="5.5"/>`);
  (extra.placed || []).forEach(([px, py]) => {
    const right = X(px) < W - 70;
    out.push(`<circle class="g-pt placed" cx="${X(px)}" cy="${Y(py)}" r="7"/>
      <text class="g-coord" x="${X(px) + (right ? 11 : -11)}" y="${Y(py) - 10}" text-anchor="${right ? 'start' : 'end'}">(${tick(px)}, ${tick(py)})</text>`);
  });
  if (extra.interactive) out.push(`<rect class="g-hit" x="0" y="0" width="${W}" height="${H}"/>`);
  return `<svg class="graph${extra.interactive ? ' interactive' : ''}" viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="Coordinate graph">${out.join('')}</svg>`;
}
function toCoords(svg, e, g) {
  const [x0, x1, y0, y1] = g.window || [-6, 6, -6, 6];
  const r = svg.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const snap = g.snap || 1;
  return [Math.round((x0 + fx * (x1 - x0)) / snap) * snap, Math.round((y1 - fy * (y1 - y0)) / snap) * snap];
}

/* ───────────── one question ───────────── */

/* The student's curve: slider values written into g, e.g. "A*sin(x)" → "(3)*sin(x)". */
const bind = (g, ctl) => g.replace(/\b([A-Za-z]\w*)\b/g, m => m in ctl ? `(${ctl[m]})` : m);

function fresh(q) {
  const it = { v: sample(q), placed: [], result: null, given: null };
  if (q.format === 'mc') it.order = q.fixed ? q.choices.map((_, i) => i) : shuffle(q.choices.map((_, i) => i));
  if (q.format === 'slider') it.ctl = Object.fromEntries(Object.entries(q.controls).map(([k, c]) => [k, c.start ?? c.min]));
  return it;
}

function parseNum(s) {
  s = String(s).trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (/^-?\d*\.?\d+\/-?\d*\.?\d+$/.test(s)) { const [a, b] = s.split('/'); return +a / +b; }
  return s === '' ? NaN : Number(s);
}

function grade(q, it, root) {
  const v = it.v;
  switch (q.format) {
    case 'mc': {
      const pick = root.querySelector('input[name="mc"]:checked');
      if (!pick) return null;
      it.given = +pick.value;
      return it.given === q.answer;
    }
    case 'numeric': {
      const n = parseNum(root.querySelector('.q-num').value);
      if (isNaN(n)) return null;
      it.given = root.querySelector('.q-num').value;
      return Math.abs(n - ev(q.answer, v)) <= (q.tol ?? 0.01);
    }
    case 'point': {
      if (it.placed.length < (q.n || 1)) return null;
      const s = { ...v };
      it.placed.forEach(([x, y], i) => { s['X' + (i + 1)] = x; s['Y' + (i + 1)] = y; });
      return !!ev(q.check, s);
    }
    case 'slider':
      return Object.entries(q.answers).every(([k, ex]) => Math.abs(it.ctl[k] - ev(ex, v)) <= (q.controls[k].tol ?? (q.controls[k].step || 1) / 2 + 1e-9));
  }
}

function answerText(q, v) {
  if (q.format === 'mc') return fill(q.choices[q.answer], v);
  if (q.format === 'numeric') { const a = ev(q.answer, v); return `$${Number.isInteger(Math.round(a * 1e9) / 1e9) ? num(a) : frac(a)}$` + (q.units ? ' ' + q.units : ''); }
  return '';
}

const LET = 'ABCDEF';
function qHtml(q, it) {
  const v = it.v, done = it.result != null;
  const g = q.graph || (q.format === 'point' || q.format === 'slider' ? {} : null);
  const graph = g ? `<div class="q-graph">${plotSvg(g, v, { placed: it.placed, interactive: q.format === 'point' && !done, student: q.format === 'slider' ? bind(q.g, it.ctl) : null })}
    ${q.format === 'slider' ? '<div class="q-legend"><span class="sw target"></span>target <span class="sw mine"></span>yours</div>' : ''}</div>` : '';
  let ans = '';
  if (q.format === 'mc') ans = `<div class="q-choices" role="radiogroup">${it.order.map((i, k) => {
    const cls = done ? (i === q.answer ? ' right' : i === it.given ? ' wrong' : '') : '';
    return `<label class="q-choice${cls}"><input type="radio" name="mc" value="${i}" ${done ? 'disabled' : ''} ${it.given === i ? 'checked' : ''}><span class="let">${LET[k]}</span><span class="txt">${fill(q.choices[i], v)}</span></label>`;
  }).join('')}</div>`;
  if (q.format === 'numeric') ans = `<div class="q-numrow"><input class="inp q-num" inputmode="text" autocomplete="off" spellcheck="false" placeholder="Your answer" aria-label="Your answer" ${done ? `disabled value="${String(it.given).replace(/"/g, '&quot;')}"` : ''}>${q.units ? `<span class="muted">${q.units}</span>` : ''}</div>
    <div class="q-hint">Fractions like 3/4 are fine.</div>`;
  if (q.format === 'point') ans = `<div class="q-hint"><span class="tapdot"></span>Tap the grid to place ${q.n > 1 ? q.n + ' points' : 'your point'}; tap again to move it.</div>`;
  if (q.format === 'slider') ans = `<div class="q-sliders">${Object.entries(q.controls).map(([k, c]) => `<label class="q-slider"><span class="k">$${c.label || k}$</span><input type="range" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${it.ctl[k]}" data-ctl="${k}" ${done ? 'disabled' : ''}><output>${num(it.ctl[k]).replace('-', '−')}</output></label>`).join('')}</div>
    <div class="q-mine">$${fill(q.show || q.g, it.ctl)}$</div>`;
  const res = !done ? '' : `<div class="q-result ${it.result ? 'ok' : 'no'}">
    <div class="q-verdict">${it.result ? '<span class="mark">✓</span> Correct' : '<span class="mark">✗</span> Not quite'}${!it.result && answerText(q, v) ? `<span class="q-correct">Answer: ${answerText(q, v)}</span>` : ''}</div>
    ${q.explain ? `<div class="q-explain">${fill(q.explain, v)}</div>` : ''}</div>`;
  return `<div class="q-stem">${fill(q.stem, v)}</div>
    <div class="q-body${graph ? ' has-graph' : ''}">${graph}<div class="q-ans">${ans}${res}</div></div>`;
}

/* ───────────── a set ───────────── */

function mount(el, set, opts = {}) {
  const qs = set.questions;
  const its = qs.map(fresh);
  let idx = 0;

  function draw() {
    const q = qs[idx], it = its[idx];
    const right = its.filter(i => i.result === true).length;
    el.innerHTML = `
      <div class="q-head">
        <div class="q-dots">${qs.map((x, i) => { const r = its[i].result; return `<button class="q-dot${i === idx ? ' on' : ''}${r === true ? ' ok' : r === false ? ' no' : ''}" data-q="go" data-i="${i}" aria-label="Question ${i + 1}${r === true ? ', correct' : r === false ? ', missed' : ''}">${i + 1}</button>`; }).join('')}</div>
        <div class="q-score">${right} / ${qs.length} correct</div>
      </div>
      <article class="q-card">
        <div class="q-meta"><span>Question ${idx + 1} of ${qs.length}</span>${q.kind ? `<span class="q-kind${/Interactive/.test(q.kind) ? ' live' : ''}">${q.kind}</span>` : ''}</div>
        ${qHtml(q, it)}
        <div class="q-actions">
          ${it.result == null ? '<button class="btn primary" data-q="check">Check</button>' : '<button class="btn" data-q="again">↻ Try one like it</button>'}
          ${idx < qs.length - 1 ? `<button class="btn ${it.result != null ? 'primary' : 'ghost'}" data-q="next">Next →</button>` : `<button class="btn ${it.result != null ? 'primary' : 'ghost'}" data-q="done">Finish</button>`}
          <span class="q-need" aria-live="polite"></span>
        </div>
      </article>`;
    typeset(el);
    wire(q, it);
  }

  function summary() {
    const right = its.filter(i => i.result === true).length;
    el.innerHTML = `<article class="q-card q-summary">
      <div class="ring" style="--p:${100 * right / qs.length}"><b>${right}/${qs.length}</b></div>
      <h2>${right === qs.length ? 'All correct.' : right ? 'Good progress.' : 'Keep going.'}</h2>
      <p class="muted">${right === qs.length ? 'Come back in a few days and try a fresh set of numbers.' : 'Try the missed ones again. Every try gives new numbers.'}</p>
      <div class="q-actions" style="justify-content:center"><button class="btn primary" data-q="restart">New numbers, start over</button>
      ${opts.back ? `<a class="btn" href="${opts.back}">← Back to the list</a>` : ''}</div></article>`;
    wire();
  }

  function wire(q, it) {
    el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const a = b.dataset.q;
      if (a === 'go') { idx = +b.dataset.i; draw(); }
      if (a === 'next') { idx++; draw(); }
      if (a === 'done') summary();
      if (a === 'restart') { qs.forEach((x, i) => { its[i] = fresh(x); }); idx = 0; draw(); }
      if (a === 'again') { its[idx] = fresh(q); draw(); }
      if (a === 'check') {
        const r = grade(q, it, el);
        if (r == null) { el.querySelector('.q-need').textContent = q.format === 'point' ? 'Place your point first.' : 'Answer first.'; return; }
        it.result = r;
        const h = store.get('q:' + q.id, { right: 0, wrong: 0 }); h[r ? 'right' : 'wrong']++; store.set('q:' + q.id, h);
        draw();
      }
    }));
    if (!q) return;
    // Listen on the holder, which survives redraws of the svg inside it.
    const holder = el.querySelector('.q-graph');
    if (holder && el.querySelector('svg.graph.interactive')) holder.addEventListener('click', e => {
      const svg = holder.querySelector('svg');
      const p = toCoords(svg, e, q.graph || {});
      it.placed = it.placed.length < (q.n || 1) ? [...it.placed, p] : [...it.placed.slice(1), p];
      holder.innerHTML = plotSvg(q.graph || {}, it.v, { placed: it.placed, interactive: true });
      el.querySelector('.q-need').textContent = '';
    });
    el.querySelectorAll('input[data-ctl]').forEach(r => r.addEventListener('input', () => {
      it.ctl[r.dataset.ctl] = +r.value;
      r.nextElementSibling.textContent = num(+r.value).replace('-', '−');
      el.querySelector('.q-graph svg').outerHTML = plotSvg(q.graph || {}, it.v, { student: bind(q.g, it.ctl) });
      const mine = el.querySelector('.q-mine');
      mine.textContent = '$' + fill(q.show || q.g, it.ctl) + '$';
      typeset(mine);
    }));
    el.querySelectorAll('.q-choice input').forEach(r => r.addEventListener('change', () => {
      el.querySelectorAll('.q-choice').forEach(c => c.classList.toggle('sel', c.contains(r) && r.checked));
    }));
    const n = el.querySelector('.q-num');
    if (n && !n.disabled) n.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('[data-q="check"]')?.click(); });
  }

  draw();
}

window.NWAPractice = { mount, fill, sample, ev, frac, plotSvg };
})();
