"""Build the first-draft scope and sequence: data/data.json.

    python3 tools/draft_scope.py

Reads data/proficiencies.seed.json (from parse_tex.py) and adds the chair's
recommended strands, threads, cell descriptions and flags.  This is the SEED
for the Google Sheet -- once the Sheet is seeded, teachers edit there and this
file is no longer the source of anything.
"""
import json
import re
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

COURSES = [
    # id, name, short, grade label, band, theme line (from the program map)
    ('PA1', 'Pre-Algebra 1', 'PA 1', '6th grade', 'ms', 'Foundations'),
    ('PA2', 'Pre-Algebra 2', 'PA 2', '7th grade', 'ms', 'Computations'),
    ('PA3', 'Pre-Algebra 3', 'PA 3', '8th grade', 'ms', 'Functions'),
    ('IM1', 'Integrated Math 1', 'IM 1', '9th grade', 'hs', ''),
    ('IM2', 'Integrated Math 2', 'IM 2', '10th grade', 'hs', ''),
    ('IM3', 'Integrated Math 3', 'IM 3', '11th grade', 'hs', ''),
    ('PC', 'Pre-Calculus', 'Precalc', '12th grade', 'el', ''),
    ('APC', 'Advanced Pre-Calculus', 'Adv Precalc', '11th–12th grade', 'el', 'Honors-level'),
    ('CALC', 'Combined Calculus 1+2', 'Calculus', '12th–13th grade', 'el', 'Dual credit: PSU MTH 251/252'),
    ('ST1', 'Statistics 1', 'Stats 1', '12th grade', 'st', ''),
    ('ST2', 'Statistics 2', 'Stats 2', '13th grade', 'st', ''),
]

STRANDS = [
    ('N', 'Number & Quantity',
     'From fractions and decimals to the real and complex number systems: what numbers are, how they compare, and how exponents and radicals extend them.'),
    ('E', 'Expressions & Equations',
     'Writing, rearranging and solving: from one-step equations to systems, polynomial roots and series.'),
    ('G', 'Geometry & Trigonometry',
     'Shape, measurement and transformation, growing into right-triangle and circular trigonometry, identities and vectors.'),
    ('F', 'Functions & Modeling',
     'The idea of a function and its families — linear, exponential, quadratic, polynomial, rational, logarithmic — used to model the world.'),
    ('D', 'Data, Statistics & Probability',
     'Collecting, displaying and reasoning from data under uncertainty, from bar graphs to inference.'),
    ('C', 'Rate of Change & Accumulation',
     'How quantities change and add up: unit rate, then slope, then the derivative and the integral.'),
    ('P', 'Mathematical Practices',
     'Habits assessed all year rather than in one unit: reasoning, communication, perseverance, tools.'),
]

# Thread: id, strand, name, [codes], {course: cell description}, note
T = []
def thread(tid, strand, name, codes, cells, note=''):
    T.append(dict(id=tid, strand=strand, name=name, codes=codes.split(), cells=cells, note=note))

# ── Number & Quantity ───────────────────────────────────────────────────────
thread('N1', 'N', 'Fractions, decimals & percents',
    'PA1-05 PA1-06 PA1-07 PA1-08 PA1-09 PA1-10 PA1-11 PA1-12 PA1-13 '
    'PA2-01 PA2-09 PA2-10 PA2-11 PA2-12 ST1-09',
    {'PA1': 'Compare fractions; all four decimal operations; convert among fractions, decimals and percents',
     'PA2': 'Unlike denominators, GCF/LCM, multiply and divide fractions, mixed numbers',
     'ST1': 'Percent change vs. percentage-point change vs. percentile'})
thread('N2', 'N', 'Ratio & proportion',
    'PA1-04 PA2-02 PA2-03',
    {'PA1': 'Understand ratios', 'PA2': 'Proportional relationships; solve proportions'},
    'Unit rate continues in Rate of Change; scale and similar figures continue in Geometry.')
thread('N3', 'N', 'The number system',
    'PA1-34 PA2-07 PA2-08 PA2-15 PA2-16 PA2-17 PA3-01 PA3-02 PA3-03 PA3-04',
    {'PA1': 'Prime and composite numbers',
     'PA2': 'Negative numbers, integer operations, rational numbers, absolute value',
     'PA3': 'Operate with rational numbers; distinguish rational from irrational'})
thread('N4', 'N', 'Exponents, radicals & scientific notation',
    'PA2-13 PA2-14 PA3-05 PA3-06 PA3-07 PA3-08 IM1-11 IM1-12 IM2-05',
    {'PA2': 'Scientific notation; multiply and divide in it',
     'PA3': 'Laws of exponents; operate in scientific notation',
     'IM1': 'Fractional exponents as radicals; negative exponents',
     'IM2': 'Unit: rational exponents and radicals'},
    'Radicals are now in both IM1 and IM2 (see flags).')
thread('N5', 'N', 'Complex numbers',
    'PC-05 PC-06 APC-08',
    {'IM3': 'Imaginary roots appear with polynomials (see Polynomial algebra)',
     'PC': 'Operate with complex numbers', 'APC': 'Operate with complex numbers'})

# ── Expressions & Equations ─────────────────────────────────────────────────
thread('E1', 'E', 'Expressions & properties',
    'PA1-15 PA1-16 PA1-17 PA1-18 PA1-19 PA2-23 PA2-24',
    {'PA1': 'Variables, order of operations, distributive property, like terms',
     'PA2': 'Factor and expand linear expressions'},
    'Algebraic simplification is assessed continuously in Calculus (Practices).')
thread('E2', 'E', 'Equations & inequalities',
    'PA1-25 PA1-26 PA2-18 PA2-19 PA2-21 PA2-22 IM1-13 IM1-14 IM1-15 IM1-16 IM1-17 PC-11 APC-02',
    {'PA1': 'One-step equations; meaning of inequalities',
     'PA2': 'Multi-step equations and inequalities; graph on a number line',
     'IM1': 'Multi-step equations and inequalities; literal equations; graph inequalities in the plane',
     'PC': 'Polynomial and rational inequalities',
     'APC': 'Solve equations graphically and algebraically'})
thread('E3', 'E', 'Systems of equations',
    'PA3-23 PA3-24 IM1-23 IM1-24 IM1-25',
    {'PA3': 'Solve linear systems graphically and algebraically',
     'IM1': 'Solve linear systems by substitution, elimination and graphing'},
    'IM1 repeats the 8th-grade work with named methods — spiral or redundant?')
thread('E4', 'E', 'Quadratic & polynomial algebra',
    'IM2-03 IM3-21 IM3-22 IM3-23 IM3-24 IM3-25 IM3-26 IM3-27 IM3-28 IM3-29 IM3-30 IM3-31 IM3-36 '
    'PC-07 PC-08 APC-06 APC-07 APC-09',
    {'IM2': 'Solve quadratics: graphs, completing the square, quadratic formula',
     'IM3': 'Polynomial arithmetic, long division, remainder theorem, Fundamental Theorem of Algebra, roots',
     'PC': 'Complex zeros; Fundamental Theorem of Algebra',
     'APC': 'Zeros, long and synthetic division, complex zeros'})
thread('E5', 'E', 'Patterns, sequences & series',
    'PA1-14 IM1-05 IM1-06 PC-28 PC-29 CALC-P43',
    {'PA1': 'Identify and extend patterns',
     'IM1': 'Explicit and recursive rules',
     'PC': 'Sequences and series',
     'CALC': 'Taylor polynomials'})

# ── Geometry & Trigonometry ─────────────────────────────────────────────────
thread('G1', 'G', 'Measurement: area & volume',
    'PA1-01 PA1-02 PA1-03 PA2-04 IM3-37 IM3-38 IM3-39 IM3-40',
    {'PA1': 'Perimeter and area of basic shapes; volume of a prism',
     'PA2': 'Area and perimeter of complex shapes',
     'IM3': 'Cross-sections, solids of revolution, approximate volume by slicing, density',
     'CALC': 'Exact volumes by integration (see Applications of integrals)'},
    'IM3 slicing sets up Calculus volumes directly — a deliberate spiral worth naming.')
thread('G2', 'G', 'Angles, lines & figures',
    'PA1-22 PA1-23 PA1-24 PA3-09 PA3-14 IM1-21 IM1-22 IM2-07 IM2-10',
    {'PA1': 'Types of angles; protractor; triangle properties',
     'PA3': 'Angle relationships; Pythagorean theorem',
     'IM1': 'Construct parallel and perpendicular lines; symmetry of quadrilaterals',
     'IM2': 'Units: circles; constructions and proof'})
thread('G3', 'G', 'Transformations, similarity & congruence',
    'PA2-05 PA2-06 PA3-10 PA3-11 PA3-12 PA3-13 IM1-18 IM1-19',
    {'PA2': 'Scale drawings; similar figures',
     'PA3': 'Transformations on the plane; similarity and congruence',
     'IM1': 'Transformations by construction and on the coordinate plane'},
    'Function transformations continue in Functions & Modeling.')
thread('G4', 'G', 'Triangle trigonometry',
    'IM2-06 IM3-41 IM3-42 IM3-43 IM3-44 PC-21 APC-17 APC-18',
    {'IM2': 'Unit: similarity and right-triangle trigonometry',
     'IM3': 'Special right triangles; Law of Sines and Law of Cosines',
     'PC': 'Laws of Sines and Cosines',
     'APC': 'Right-triangle trig; laws of sines and cosines'},
    'Laws of Sines/Cosines now appear in IM3, PC and APC.')
thread('G5', 'G', 'The unit circle & radian measure',
    'IM3-45 IM3-46 IM3-49 IM3-50 IM3-51 IM3-52 IM3-59 PC-13 APC-12 APC-13 APC-14',
    {'IM3': 'Angles of rotation, arc length, radians, sine and cosine on the unit circle',
     'PC': 'Define and evaluate trig functions',
     'APC': 'Radians and degrees; unit-circle and reference-angle evaluation'})
thread('G6', 'G', 'Trigonometric functions & periodic models',
    'IM3-47 IM3-48 IM3-53 IM3-54 IM3-55 IM3-56 IM3-58 PC-14 PC-15 APC-15',
    {'IM3': 'Amplitude, period, midline; model circular and periodic motion',
     'PC': 'Graph and transform trig functions',
     'APC': 'Graph trig functions and their transformations'})
thread('G7', 'G', 'Trigonometric identities & equations',
    'IM3-57 IM3-60 IM3-61 IM3-62 IM3-63 IM3-64 PC-16 PC-17 PC-18 PC-19 PC-20 '
    'APC-16 APC-19 APC-20 APC-21 APC-22',
    {'IM3': 'Fundamental, sum/difference and double-angle identities; inverse trig; solve trig equations',
     'PC': 'Verify identities; sum, difference, double and half-angle formulas; solve equations',
     'APC': 'Verify identities; addition and double/half-angle formulas; solve equations'},
    'IM3 now covers most of the PC/APC identity work.')
thread('G8', 'G', 'Vectors, parametrics & conics',
    'PC-12 PC-22 PC-23 PC-24 PC-25 PC-26 PC-27',
    {'IM3': 'Polar coordinates on the circle (G5)',
     'PC': 'Conic sections; vectors in the plane; parametric equations'},
    'Course-specific to Precalc; kept so the topic has a home.')

# ── Functions & Modeling ────────────────────────────────────────────────────
thread('F1', 'F', 'What a function is',
    'PA1-20 PA1-21 PA3-15 PA3-16 PA3-17 IM1-01 IM1-02 IM1-03 IM1-04 IM1-07 CALC-P02',
    {'PA1': 'Coordinate plane; plot points',
     'PA3': 'Concept of a function; is a relation a function; evaluate',
     'IM1': 'Domain, range, interval and function notation; graph from a table or equation',
     'CALC': 'Describe function classes graphically, algebraically, verbally'})
thread('F2', 'F', 'Linear functions',
    'PA3-18 PA3-20 PA3-21 PA3-22 IM1-09 IM1-20',
    {'PA3': 'Graph lines, write equations, model with lines, parallel/perpendicular',
     'IM1': 'Write linear equations; graph parallel and perpendicular lines'})
thread('F3', 'F', 'Exponential & logarithmic functions',
    'IM1-08 IM1-10 IM3-05 IM3-06 IM3-07 IM3-08 IM3-09 IM3-10 IM3-11 IM3-12 IM3-13 IM3-14 IM3-15 IM3-16 '
    'PC-01 PC-02 PC-03 PC-04 APC-03 APC-04 CALC-P18 CALC-P39',
    {'IM1': 'Write exponential equations; linear vs. exponential',
     'IM3': 'Logarithms, compound and continuous interest, base e, solve exponential equations',
     'PC': 'Graph, solve and model with exponentials and logs',
     'APC': 'Graph exponentials and logs; solve problems with them',
     'CALC': 'Log laws; exponential growth and decay'},
    'Logs were removed from IM2, so IM3 is now the first exposure (see flags).')
thread('F4', 'F', 'Quadratic, polynomial & rational functions',
    'IM2-01 IM2-02 IM3-18 IM3-19 IM3-20 IM3-32 IM3-33 IM3-34 IM3-35 PC-09 PC-10 APC-05 APC-10 APC-11',
    {'IM2': 'Units: quadratic patterns and contexts; forms and graph features',
     'IM3': 'Cubics; end behavior; graph polynomials from roots and degree; even and odd',
     'PC': 'Graph polynomials; rational functions and asymptotes',
     'APC': 'Graph polynomials; graph rational functions; asymptotes'},
    'Rational functions left IM3 in the rewrite (see flags).')
thread('F5', 'F', 'Transformations & combinations of functions',
    'IM2-04 IM3-65 IM3-66 IM3-67 IM3-68 IM3-69 IM3-70 APC-01 CALC-P03',
    {'IM2': 'Unit: piecewise, absolute value and inverse equations',
     'IM3': 'Transform parent functions; combine and compose functions',
     'APC': 'Graph functions and their transformations',
     'CALC': 'Translate, scale and reflect'})
thread('F6', 'F', 'Inverse functions',
    'IM3-01 IM3-02 IM3-03 IM3-04 CALC-P17',
    {'IM2': 'Inverse equations (within Unit 4)',
     'IM3': 'Build, recognize and test inverses',
     'CALC': 'Inverse of a function when appropriate'})

# ── Data, Statistics & Probability ──────────────────────────────────────────
thread('D1', 'D', 'Displaying data',
    'PA1-27 PA1-28 PA1-29 PA3-25 IM1-26 IM1-27 IM1-28 ST1-05 ST2-05 ST2-06 ST2-07 ST2-08 ST2-09',
    {'PA1': 'Collect and organize data; bar and line graphs',
     'PA3': 'Scatter plots',
     'IM1': 'Box plots and histograms',
     'ST1': 'Stemplots, histograms, box plots, ntigrams',
     'ST2': 'Frequency tables, ogives, Pareto, time series, scatter plots'})
thread('D2', 'D', 'Center, spread & the normal model',
    'PA1-30 IM1-29 IM3-71 IM3-72 IM3-73 IM3-74 ST1-06 ST1-07 ST1-08 ST1-10 ST2-10 ST2-11 ST2-12 ST2-21',
    {'PA1': 'Mean, median, mode',
     'IM1': 'Standard deviation as spread',
     'IM3': 'Normal distribution, 68–95–99.7, z-scores',
     'ST1': 'Center and spread in full; z-scores; normal percentiles; index scores',
     'ST2': 'Center, spread, position; normal probabilities'})
thread('D3', 'D', 'Association & regression',
    'PA3-26 PA3-27 IM2-09 ST1-15 ST1-16 ST1-17 ST1-18 ST1-19 ST1-20 ST1-34 '
    'ST2-13 ST2-14 ST2-39 ST2-40 ST2-41 ST2-42',
    {'PA3': 'Associations in categorical data; correlation vs. causation',
     'IM2': 'Unit: modeling data',
     'ST1': 'Correlation, regression, transformations, multivariable models, odds ratios',
     'ST2': 'Regression analysis, inference for slope and correlation, prediction intervals'})
thread('D4', 'D', 'Probability',
    'PA1-31 PA1-32 PA1-33 PA2-25 PA2-26 PA2-27 IM2-08 IM3-79 '
    'ST1-21 ST1-22 ST1-23 ST1-24 ST1-25 ST2-15 ST2-16 ST2-17 ST2-18 ST2-19 ST2-20',
    {'PA1': 'Simple probability; tree diagrams',
     'PA2': 'Experimental vs. theoretical probability; predictions',
     'IM2': 'Unit: conditional probability',
     'IM3': 'Simulation',
     'ST1': 'Probability rules, Bayes, binomial and geometric distributions',
     'ST2': 'Rules, counting, binomial distribution',
     'CALC': 'Probability with integrals (see Applications of integrals)'})
thread('D5', 'D', 'Study design & sampling',
    'IM3-75 IM3-76 IM3-77 IM3-78 IM3-80 ST1-01 ST1-02 ST1-03 ST1-04 ST1-12 ST1-13 ST1-14 '
    'ST2-01 ST2-02 ST2-03 ST2-04',
    {'IM1': 'Continuous vs. discrete data (F1)',
     'IM3': 'Random samples, sample types, study types, plan a study',
     'ST1': 'Variables, research questions, data cleaning, sampling, study design, bias',
     'ST2': 'Samples vs. populations, sampling techniques, ethics'})
thread('D6', 'D', 'Inference & reporting',
    'ST1-11 ST1-26 ST1-27 ST1-28 ST1-29 ST1-30 ST1-31 ST1-32 ST1-33 ST1-35 '
    'ST2-22 ST2-23 ST2-24 ST2-25 ST2-26 ST2-27 ST2-28 ST2-29 ST2-30 ST2-31 ST2-32 ST2-33 ST2-34 '
    'ST2-35 ST2-36 ST2-37 ST2-38 ST2-43 ST2-44 ST2-45',
    {'ST1': 'Sampling distributions, CLT, confidence intervals, effect sizes, error rates',
     'ST2': 't, chi-squared, F and ANOVA; hypothesis tests; communicate findings'},
    'ST1 cut hypothesis tests in favor of intervals; ST2 now carries all testing.')

# ── Rate of Change & Accumulation ───────────────────────────────────────────
thread('C1', 'C', 'Rate of change',
    'PA2-20 PA3-19 IM3-17',
    {'PA2': 'Rates and unit rates',
     'PA3': 'Slope from a graph or two points',
     'IM1': 'Linear vs. exponential growth (F3)',
     'IM3': 'Recognize a cubic from its rate of change'},
    'The thread that makes 6th-grade rates the root of calculus.')
thread('C2', 'C', 'Limits & continuity',
    'APC-23 APC-25 CALC-P04 CALC-P06 CALC-P22 CALC-P25',
    {'APC': 'Limit laws; continuity',
     'CALC': 'Limit laws, continuity, limits at infinity, L’Hôpital'},
    'APC and Calculus Unit 1 share these proficiencies word for word.')
thread('C3', 'C', 'The derivative',
    'APC-24 APC-26 APC-27 APC-28 APC-29 APC-30 APC-31 APC-32 '
    'CALC-P05 CALC-P07 CALC-P08 CALC-P09 CALC-P10 CALC-P11 CALC-P12 CALC-P13 CALC-P19 CALC-P20',
    {'APC': 'Tangent slope, definition, rules through implicit differentiation',
     'CALC': 'Review of APC rules, then exponential, log and inverse-trig derivatives'})
thread('C4', 'C', 'Applications of the derivative',
    'APC-33 APC-34 APC-35 CALC-P14 CALC-P15 CALC-P16 CALC-P21 CALC-P23 CALC-P24 CALC-P26 CALC-P44',
    {'APC': 'Rates of change, related rates, linear approximation',
     'CALC': 'Extrema, MVT, curve sketching, optimization, Newton’s method'},
    'Optimization now first appears in Calculus (see flags).')
thread('C5', 'C', 'The integral',
    'CALC-P27 CALC-P28 CALC-P29 CALC-P30 CALC-P32 CALC-P33 CALC-P34 CALC-P35',
    {'CALC': 'Antiderivatives, Riemann sums, FTC, techniques, numerical and improper integrals'})
thread('C6', 'C', 'Applications of the integral',
    'CALC-P31 CALC-P36 CALC-P37 CALC-P38 CALC-P40 CALC-P41 CALC-P42 CALC-P45',
    {'IM3': 'Approximate volume by slicing (G1)',
     'CALC': 'Area, volume, average value, physics, probability, arc length'})

# ── Mathematical Practices ──────────────────────────────────────────────────
thread('P1', 'P', 'Reasoning, communication & tools',
    'CALC-CS1 CALC-CS2 CALC-CS3 CALC-CS4 CALC-CS5 CALC-CS6',
    {'CALC': 'Six continuous skills assessed all year'},
    'Only Calculus names these. Should every course?')

# Flags: known issues for the department (from the August 2026 revision notes)
FLAGS = [
    ('gap', 'F4', 'IM3', 'Rational functions have no home in the standard track. They were IM3 Unit 3; the new Unit 3 is polynomials. Adv Precalc and Precalc cover them. Deliberate handoff or accidental drop?'),
    ('gap', 'C4', 'IM3', 'Optimization was dropped from IM3 (old Unit 9) and nothing below Calculus picks it up.'),
    ('gap', 'E4', 'IM3', 'IM3 Unit 4, "Polynomial Identities and Proofs", has no proficiencies yet.'),
    ('overlap', 'N4', 'IM2', 'Fractional exponents and radicals moved down to IM1, but IM2 Unit 5 is still "Rational Exponents and Radicals".'),
    ('order', 'F3', 'IM3', 'Logarithms were removed from IM2, so IM3 Unit 2 is now students’ first exposure rather than their second. Confirm this is intentional.'),
    ('todo', 'F4', 'IM2', 'IM2 is still a list of unit titles. It needs skill statements like IM1 and IM3.'),
    ('todo', 'F5', 'IM3', 'IM3 Unit 8 statement is truncated: “…whether the transformation is described in geometric notation” — presumably “…or in function notation.”'),
    ('todo', 'D1', 'ST1', 'Ntigrams are specific to Fathom software; Desmos and Sheets cannot draw them.'),
]

STOP = set('''a an and the of to in on for with by from as at or its their into using use
understand apply work determine calculate find identify describe create interpret
perform demonstrate including given both either when how what basic appropriate
not be is are can each other more than two different a
graph solve problem write evaluate define
'''.split())

# Alternative tracks: a student takes one or the other, so shared content is expected.
PARALLEL = {frozenset(('PC', 'APC'))}


def stem(w):
    for suf in ('ations', 'ation', 'ions', 'ing', 'ies', 'es', 's', 'al'):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def words(t):
    return {stem(w) for w in re.findall(r"[a-z]+", t.lower()) if w not in STOP and len(w) > 2}


def overlaps(profs):
    """Pairs of proficiencies in different courses that say nearly the same thing."""
    out = []
    W = {p['code']: words(p['text']) for p in profs}
    for a, b in combinations(profs, 2):
        if a['course'] == b['course'] or a['thread'] != b['thread']:
            continue
        if frozenset((a['course'], b['course'])) in PARALLEL:
            continue
        wa, wb = W[a['code']], W[b['code']]
        if len(wa) < 2 or len(wb) < 2:
            continue
        j = len(wa & wb) / len(wa | wb)
        if j >= 0.5:
            out.append({'id': f"{a['code']}~{b['code']}", 'a': a['code'], 'b': b['code'],
                        'score': round(j, 2), 'status': 'open', 'note': ''})
    return out


def main():
    profs = json.loads((ROOT / 'data/proficiencies.seed.json').read_text())
    by = {p['code']: p for p in profs}
    placed = {}
    for t in T:
        for c in t['codes']:
            assert c in by, c
            assert c not in placed, f'{c} in {placed.get(c)} and {t["id"]}'
            placed[c] = t['id']
    missing = [c for c in by if c not in placed]
    assert not missing, missing
    for p in profs:
        p['thread'] = placed[p['code']]
    threads = []
    for i, t in enumerate(T):
        threads.append({'id': t['id'], 'strand': t['strand'], 'order': i + 1,
                        'name': t['name'], 'note': t['note'], 'cells': t['cells']})
    data = {
        'title': 'NWA Math Proficiencies',
        'year': '2026–27',
        'status': 'draft',
        'published': None,
        'courses': [dict(id=c[0], name=c[1], short=c[2], grade=c[3], band=c[4], tagline=c[5], order=i + 1)
                    for i, c in enumerate(COURSES)],
        'strands': [dict(id=s[0], name=s[1], summary=s[2], order=i + 1) for i, s in enumerate(STRANDS)],
        'threads': threads,
        'profs': profs,
        'overlaps': overlaps(profs),
        'flags': [dict(id=f'FL{i + 1}', kind=k, thread=t, course=c, text=x, status='open')
                  for i, (k, t, c, x) in enumerate(FLAGS)],
        'resources': [],
    }
    (ROOT / 'data/data.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"{len(profs)} proficiencies, {len(threads)} threads, {len(data['overlaps'])} overlaps")
    for o in data['overlaps']:
        print(' ', o['score'], o['a'], by[o['a']]['text'][:50], '||', o['b'], by[o['b']]['text'][:50])


if __name__ == '__main__':
    main()
