// Sanity-check every practice set: node tools/check_practice.mjs
// Samples each question many times and checks that it has a reachable, unambiguous answer.
import fs from 'node:fs';
import { createRequire } from 'node:module';
globalThis.window = {};
createRequire(import.meta.url)('../practice.js');
const { sample, ev, fill } = window.NWAPractice;
const dir = new URL('../practice/', import.meta.url);
const idx = JSON.parse(fs.readFileSync(new URL('index.json', dir)));
let bad = 0;
const fail = (q, m) => { bad++; console.log(`✗ ${q.id}: ${m}`); };
for (const code of Object.keys(idx.sets)) {
  const set = JSON.parse(fs.readFileSync(new URL(code + '.json', dir)));
  if (set.questions.length !== idx.sets[code].n) fail({ id: code }, 'index count is stale');
  for (const q of set.questions) {
    for (let t = 0; t < 300; t++) {
      let v; try { v = sample(q); } catch (e) { fail(q, e.message); break; }
      try { for (const k of ['stem', 'explain']) if (/\[\[|\]\]|NaN|\\text\{undefined\}/.test(fill(q[k], v))) throw new Error(k + ' renders badly: ' + fill(q[k], v)); }
      catch (e) { fail(q, e.message); break; }
      if (q.format === 'numeric' && !isFinite(ev(q.answer, v))) { fail(q, 'answer not finite ' + JSON.stringify(v)); break; }
      if (q.format === 'mc') {
        const cs = q.choices.map(c => fill(c, v));
        if (new Set(cs).size !== cs.length) { fail(q, 'duplicate choices ' + cs.join(' | ')); break; }
      }
      if (q.format === 'point') {
        // brute-force the grid: at least one lattice point must pass, inside the window
        const [x0, x1, y0, y1] = q.graph?.window || [-6, 6, -6, 6];
        let ok = 0;
        for (let x = Math.ceil(x0); x <= x1; x++) for (let y = Math.ceil(y0); y <= y1; y++) if (ev(q.check, { ...v, X1: x, Y1: y })) ok++;
        if (!ok) { fail(q, 'no grid point passes ' + JSON.stringify(v)); break; }
      }
      if (q.format === 'slider') {
        for (const [k, ex] of Object.entries(q.answers)) {
          const a = ev(ex, v), c = q.controls[k], st = c.step || 1;
          if (a < c.min || a > c.max || Math.abs((a - c.min) / st - Math.round((a - c.min) / st)) > 1e-9) { fail(q, `slider ${k} cannot reach ${a}`); break; }
        }
      }
    }
  }
  console.log(`${code}: ${set.questions.length} questions checked`);
}
process.exit(bad ? 1 : 0);
