"""Parse the department proficiency document into coded proficiencies.

    python3 tools/parse_tex.py tools/proficiencies25-26.tex > data/proficiencies.seed.json

Run ONCE to seed codes.  After seeding, codes are permanent identifiers that
live in the Google Sheet: they never move, and a retired code is never reused.
Re-running this against a revised .tex would renumber everything, so it is a
seeding tool, not a sync tool.

Codes are COURSE-NN in document order (IM3-14).  Combined Calculus keeps its
canonical P-codes (CALC-P25) and its continuous skills become CALC-CS1..CS6.
Struck (\\cut) proficiencies are skipped: they were removed this cycle and
never had a code.
"""
import json
import re
import sys

COURSES = {
    'Pre Algebra 1': 'PA1', 'Pre Algebra 2': 'PA2', 'Pre Algebra 3': 'PA3',
    'Integrated Math 1': 'IM1', 'Integrated Math 2': 'IM2', 'Integrated Math 3': 'IM3',
    'Pre-Calculus': 'PC', 'Statistics 1': 'ST1', 'Statistics 2': 'ST2',
    'Advanced Pre-Calculus': 'APC', 'Combined Calculus 1+2': 'CALC',
}


def arg(s, i):
    """Return (content, end) of the brace group starting at s[i] == '{'."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{':
            depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
    raise ValueError('unbalanced braces')


def strip_macro(s, name):
    """Remove every \\name{...} (brace-matched) and return (text, [contents])."""
    out, found, k = [], [], 0
    tag = '\\' + name + '{'
    while True:
        i = s.find(tag, k)
        if i < 0:
            out.append(s[k:])
            return ''.join(out), found
        out.append(s[k:i])
        body, k = arg(s, i + len(tag) - 1)
        found.append(body)


def clean(s):
    s = re.sub(r'\\textit\{([^{}]*)\}', r'\1', s)
    s = re.sub(r'\\textbf\{([^{}]*)\}', r'\1', s)
    s = re.sub(r'\\texttt\{([^{}]*)\}', r'\1', s)
    s = s.replace("\\^{o}", 'ô').replace('``', '“').replace("''", '”')
    s = s.replace('---', '—').replace('--', '–').replace('vs.\\ ', 'vs. ')
    s = s.replace('\\ ', ' ').replace('\\newline', ' ')
    s = re.sub(r'\$([^$]*)\$', r'\1', s)
    s = s.replace('\\textbullet', '•').replace('~', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def parse(tex):
    body = tex.split('\\begin{document}', 1)[1]
    sections = re.split(r'\\section\{', body)[1:]
    profs = []
    for sec in sections:
        title, end = arg('{' + sec, 0)
        rest = ('{' + sec)[end:]
        name = re.sub(r'\s*\(.*\)$', '', title).strip()
        cid = COURSES[name]
        rest, _ = strip_macro(rest, 'revnote')
        rest, _ = strip_macro(rest, 'priorunits')
        rest = re.sub(r'\\noindent\\textit\{.*?\}\s*', '', rest, flags=re.S)
        # tokens in document order
        tok = re.compile(r'\\cut\{|\\prof\{|\\unithead\{|\\item(\[\])?|\\begin\{[a-z]+\}(\[[^\]]*\])?|\\end\{[a-z]+\}')
        pos, unit, n, cs = 0, '', 0, 0
        pending = None   # (kind, payload) of the item being accumulated

        def flush(text_end):
            nonlocal pending, n, cs, unit
            if not pending:
                return
            kind, start, extra = pending
            pending = None
            raw = rest[start:text_end]
            raw, was = strip_macro(raw, 'was')
            is_new = '\\newprof' in raw
            raw = raw.replace('\\newprof', '')
            text = clean(raw)
            if not text:
                return
            if kind == 'item':
                m = re.match(r'^Unit (\d+): (.*)$', text)
                if cid == 'IM3' and m:          # IM3 unit banner, not a proficiency
                    unit = f'Unit {m[1]}: {m[2]}'
                    return
                if text.startswith('No new proficiencies'):
                    return
                if extra == 'bare':              # calculus continuous skills
                    cs += 1
                    code = f'CALC-CS{cs}'
                else:
                    n += 1
                    code = f'{cid}-{n:02d}'
            else:                                # \prof{CODE}{text}
                code = f'CALC-{extra}'
            p = {'code': code, 'course': cid, 'unit': unit, 'text': text}
            if cid == 'IM2':
                p['unit'], p['text'] = (x.strip() for x in text.split(':', 1))
                p['level'] = 'unit'              # IM2 lists units, not skills yet
            if was:
                p['was'] = clean(was[0])
            if is_new:
                p['new'] = True
            profs.append(p)

        for m in tok.finditer(rest):
            t = m.group(0)
            if t.startswith('\\cut{'):
                flush(m.start())
                _, end = arg(rest, m.end() - 1)
                pos = end
                continue
            if t.startswith('\\prof{'):
                flush(m.start())
                c, k = arg(rest, m.end() - 1)
                _, k2 = arg(rest, k)
                pending = ('prof', k + 1, c)
                flush(k2 - 1)
                continue
            if t.startswith('\\unithead{'):
                flush(m.start())
                ttl, k = arg(rest, m.end() - 1)
                unit = clean(ttl)
                continue
            if t.startswith('\\item'):
                flush(m.start())
                pending = ('item', m.end(), 'bare' if m.group(1) else None)
                continue
            flush(m.start())   # begin/end
        flush(len(rest))
    # CALC-P33 is listed twice: introduced in Unit 3, assessed in full in Unit 6.
    # One code, one row -- keep the full Unit 6 statement.
    seen = {}
    for p in profs:
        seen[p['code']] = p
    keep = []
    for p in profs:
        if seen[p['code']] is p:
            keep.append(p)
        elif p['code'] == 'CALC-P33':
            seen['CALC-P33']['note'] = 'Substitution is introduced in ' + p['unit'] + '.'
    return keep


if __name__ == '__main__':
    tex = open(sys.argv[1], encoding='utf-8').read()
    out = parse(tex)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
