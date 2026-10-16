"""Write the demo practice sets (practice/*.json) and practice/index.json.

Hand-written examples for the October 2026 demo, one per format. Real sets will come from
mining department exams (deptchair/curriculum_map/resources/); see docs/chair-guide.
Math is KaTeX ($…$); computed values are [[expr]], [[+expr]], [[c:expr]], [[f:expr]] (practice.js).
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'practice'
T = True
sets = {}

sets['PA3-19'] = {"title": "Find slope from a graph or two points", "questions": [
 {"id": "PA3-19-001", "kind": "Read the graph", "format": "numeric",
  "params": {"x1": {"min": -5, "max": 0}, "y1": {"min": -4, "max": 2}, "run": {"min": 1, "max": 4}, "rise": {"min": -4, "max": 4, "not": [0]}},
  "derive": {"x2": "x1+run", "y2": "y1+rise"}, "where": "y2>=-5 && y2<=5",
  "stem": r"What is the slope of the line?",
  "graph": {"window": [-6, 6, -6, 6], "fns": [{"f": "y1+rise/run*(x-x1)"}], "points": [["x1", "y1"], ["x2", "y2"]]},
  "answer": "rise/run", "tol": 0.01,
  "explain": r"From $([[x1]],\,[[y1]])$ to $([[x2]],\,[[y2]])$ the line rises $[[rise]]$ and runs $[[run]]$: $$m=\frac{\text{rise}}{\text{run}}=\frac{[[rise]]}{[[run]]}=[[f:rise/run]]$$"},
 {"id": "PA3-19-002", "kind": "Two points", "format": "numeric",
  "params": {"x1": {"min": -9, "max": 9}, "y1": {"min": -9, "max": 9}, "x2": {"min": -9, "max": 9}, "y2": {"min": -9, "max": 9}},
  "where": "x1!=x2 && y1!=y2 && abs((y2-y1)/(x2-x1))<=6",
  "stem": r"Find the slope of the line through $([[x1]],\,[[y1]])$ and $([[x2]],\,[[y2]])$.",
  "answer": "(y2-y1)/(x2-x1)", "tol": 0.01,
  "explain": r"$$m=\frac{y_2-y_1}{x_2-x_1}=\frac{[[y2]]-([[y1]])}{[[x2]]-([[x1]])}=\frac{[[y2-y1]]}{[[x2-x1]]}=[[f:(y2-y1)/(x2-x1)]]$$"},
 {"id": "PA3-19-003", "kind": "Interactive", "format": "point", "n": 1,
  "params": {"x0": {"min": -3, "max": 1}, "y0": {"min": -3, "max": 1}, "rise": {"min": -3, "max": 3, "not": [0]}, "run": {"min": 1, "max": 3}},
  "where": "rise%run!=0 || run==1",
  "stem": r"The line passes through the marked point and has slope $m=[[f:rise/run]]$. Place another point on the line.",
  "graph": {"window": [-6, 6, -6, 6], "points": [["x0", "y0"]]},
  "check": "X1!=x0 && abs((Y1-y0)/(X1-x0) - rise/run) < 1e-9",
  "explain": r"From $([[x0]],\,[[y0]])$ go $[[abs(rise)]]$ [[rise>0?1:0]] and right $[[run]]$ to reach $([[x0+run]],\,[[y0+rise]])$. Going the other way, $([[x0-run]],\,[[y0-rise]])$ works too."},
 {"id": "PA3-19-004", "kind": "Concept", "format": "mc",
  "stem": r"What is the slope of a horizontal line?",
  "choices": ["$0$", "Undefined", "$1$", "It depends on the line"], "answer": 0,
  "explain": r"A horizontal line never rises, so $m=\frac{0}{\text{run}}=0$. A <em>vertical</em> line is the one with undefined slope."},
]}
# "up"/"down" wording without a ternary in text:
sets['PA3-19']['questions'][2]['explain'] = r"From $([[x0]],\,[[y0]])$ move $[[rise]]$ vertically (negative means down) and $[[run]]$ to the right: $([[x0+run]],\,[[y0+rise]])$ is on the line. So is $([[x0-run]],\,[[y0-rise]])$."

sets['IM1-10'] = {"title": "Linear vs. exponential functions", "questions": [
 {"id": "IM1-10-001", "kind": "Tables", "format": "mc",
  "params": {"a": {"min": 2, "max": 5}, "b": {"min": 2, "max": 3}, "d": {"min": 2, "max": 6}},
  "stem": r"""Which table shows an <b>exponential</b> function?
<div class="q-tables"><table class="q-tab"><caption>Table A</caption><tr><th>$x$</th><th>$y$</th></tr><tr><td>0</td><td>[[a]]</td></tr><tr><td>1</td><td>[[a+d]]</td></tr><tr><td>2</td><td>[[a+2*d]]</td></tr><tr><td>3</td><td>[[a+3*d]]</td></tr></table>
<table class="q-tab"><caption>Table B</caption><tr><th>$x$</th><th>$y$</th></tr><tr><td>0</td><td>[[a]]</td></tr><tr><td>1</td><td>[[a*b]]</td></tr><tr><td>2</td><td>[[a*b^2]]</td></tr><tr><td>3</td><td>[[a*b^3]]</td></tr></table></div>""",
  "choices": ["Table A", "Table B", "Both", "Neither"], "answer": 1, "fixed": T,
  "explain": r"Table B <b>multiplies</b> by $[[b]]$ each step: $y=[[a]]\cdot[[b]]^x$. Table A <b>adds</b> $[[d]]$ each step: $y=[[a]]+[[d]]x$, linear."},
 {"id": "IM1-10-002", "kind": "Read the graph", "format": "mc",
  "params": {"a": {"min": 1, "max": 2}, "d": {"min": 1, "max": 2}},
  "stem": r"Both functions start at $y=[[a]]$. Which one is exponential?",
  "graph": {"window": [-1, 6, -1, 13], "fns": [{"f": "a+d*x", "label": "f", "at": "5"}, {"f": "a*2^x", "label": "g", "at": "3.2"}]},
  "choices": ["$f$", "$g$", "Both", "Neither"], "answer": 1, "fixed": T,
  "explain": r"$g$ curves upward because each step <b>doubles</b>: $g(x)=[[a]]\cdot 2^x$. $f$ is a straight line because each step <b>adds</b> $[[d]]$."},
 {"id": "IM1-10-003", "kind": "Compute", "format": "numeric",
  "params": {"a": {"min": 2, "max": 9}, "n": {"min": 3, "max": 6}},
  "stem": r"A population starts at $[[a]]$ and <b>doubles</b> every year. How large is it after $[[n]]$ years?",
  "answer": "a*2^n", "tol": 0.01,
  "explain": r"$$[[a]]\cdot 2^{[[n]]}=[[a*2^n]]$$ If it <em>added</em> $[[a]]$ each year instead, it would be linear: $[[a]]+[[a]]\cdot[[n]]=[[a+a*n]]$."},
 {"id": "IM1-10-004", "kind": "Concept", "format": "mc",
  "params": {"r": {"min": 3, "max": 8}},
  "stem": r"A savings account grows by <b>$[[r]]\%$ each year</b>. What kind of growth is that?",
  "choices": [r"Exponential: it multiplies by $[[1+r/100]]$ each year", r"Linear: it adds $\$[[r]]$ each year", "Linear: the rate stays the same", "Neither"], "answer": 0,
  "explain": r"A constant <em>percent</em> means multiplying by the same factor every year: $A=P\,(1+[[r/100]])^t$. That is exponential."},
]}

sets['IM2-02'] = {"title": "Structures of quadratic functions", "questions": [
 {"id": "IM2-02-001", "kind": "Interactive", "format": "point", "n": 1,
  "params": {"a": {"min": -2, "max": 2, "not": [0]}, "h": {"min": -4, "max": 4, "not": [0]}, "k": {"min": -4, "max": 4, "not": [0]}},
  "stem": r"Place the <b>vertex</b> of $$y=[[c:a]](x[[+-h]])^2[[+k]]$$",
  "graph": {"window": [-6, 6, -6, 6]},
  "check": "X1==h && Y1==k",
  "explain": r"Vertex form $y=a(x-h)^2+k$ has its vertex at $(h,k)$. Here $(x[[+-h]])$ means $h=[[h]]$, so the vertex is $([[h]],\,[[k]])$."},
 {"id": "IM2-02-002", "kind": "Interactive", "format": "slider",
  "params": {"h0": {"min": -4, "max": 4}, "k0": {"min": -4, "max": 3}},
  "where": "h0!=0 || k0!=0",
  "stem": r"Move the sliders until your parabola lands on the dashed one.",
  "graph": {"window": [-6, 6, -6, 6], "fns": [{"f": "(x-h0)^2+k0", "dash": T}]},
  "controls": {"h": {"min": -5, "max": 5, "start": 0}, "k": {"min": -5, "max": 5, "start": 0}},
  "g": "(x-h)^2+k", "show": r"y=(x[[+-h]])^2[[+k]]",
  "answers": {"h": "h0", "k": "k0"},
  "explain": r"The target is $y=(x[[+-h0]])^2[[+k0]]$, vertex $([[h0]],\,[[k0]])$. $h$ slides the parabola left and right; $k$ moves it up and down."},
 {"id": "IM2-02-003", "kind": "Standard form", "format": "numeric",
  "params": {"a": {"min": 1, "max": 3}, "h": {"min": -4, "max": 4, "not": [0]}, "c": {"min": -9, "max": 9}},
  "derive": {"b": "-2*a*h"},
  "stem": r"For $y=[[c:a]]x^2[[+b]]x[[+c]]$, what is the $x$-coordinate of the vertex?",
  "answer": "h", "tol": 0.01,
  "explain": r"$$x=-\frac{b}{2a}=-\frac{[[b]]}{2\cdot[[a]]}=[[h]]$$ That is also the axis of symmetry, $x=[[h]]$."},
 {"id": "IM2-02-004", "kind": "Read the graph", "format": "mc",
  "params": {"a": {"min": -1, "max": 1, "not": [0]}, "h": {"min": -3, "max": 3, "not": [0]}, "k": {"min": -3, "max": 3, "not": [0]}},
  "stem": r"Which equation matches the graph?",
  "graph": {"window": [-6, 6, -6, 6], "fns": [{"f": "a*(x-h)^2+k"}]},
  "choices": [r"$y=[[c:a]](x[[+-h]])^2[[+k]]$", r"$y=[[c:a]](x[[+h]])^2[[+k]]$", r"$y=[[c:a]](x[[+-h]])^2[[+-k]]$", r"$y=[[c:-a]](x[[+-h]])^2[[+k]]$"], "answer": 0,
  "explain": r"The vertex is $([[h]],\,[[k]])$, which gives $(x[[+-h]])^2$ and $[[+k]]$. The parabola opens [[a>0?'up':'down']]… "},
]}
sets['IM2-02']['questions'][3]['explain'] = r"The vertex is $([[h]],\,[[k]])$, which gives $(x[[+-h]])^2$ and $[[+k]]$. The sign of $a$ sets the direction: positive opens up, negative opens down. Here $a=[[a]]$."

sets['IM3-48'] = {"title": "Amplitude, period, and midline", "questions": [
 {"id": "IM3-48-001", "kind": "Interactive", "format": "slider",
  "params": {"a0": {"min": 1, "max": 4}, "p0": {"min": 2, "max": 8, "step": 2}, "d0": {"min": -3, "max": 3}},
  "stem": r"Set the amplitude $A$, period $P$, and midline $D$ so your curve $y=A\sin\!\left(\frac{2\pi x}{P}\right)+D$ lands on the dashed one.",
  "graph": {"window": [0, 12, -8, 8], "fns": [{"f": "a0*sin(2*pi*x/p0)+d0", "dash": T}]},
  "controls": {"A": {"min": 1, "max": 5, "start": 1}, "P": {"min": 1, "max": 10, "start": 6}, "D": {"min": -4, "max": 4, "start": 0}},
  "g": "A*sin(2*pi*x/P)+D", "show": r"y=[[A]]\sin\!\left(\tfrac{2\pi x}{[[P]]}\right)[[+D]]",
  "answers": {"A": "a0", "P": "p0", "D": "d0"},
  "explain": r"Midline: halfway between max and min, $y=[[d0]]$. Amplitude: max minus midline, $[[a0]]$. Period: one full cycle takes $[[p0]]$ units."},
 {"id": "IM3-48-002", "kind": "Read the graph", "format": "numeric",
  "params": {"a": {"min": 1, "max": 4}, "p": {"min": 2, "max": 8, "step": 2}, "d": {"min": -3, "max": 3}},
  "stem": r"What is the <b>amplitude</b> of this sinusoid?",
  "graph": {"window": [0, 12, -8, 8], "fns": [{"f": "a*sin(2*pi*x/p)+d"}]},
  "answer": "a", "tol": 0.01,
  "explain": r"Max $=[[d+a]]$, min $=[[d-a]]$. $$\text{amplitude}=\frac{\max-\min}{2}=\frac{[[d+a]]-([[d-a]])}{2}=[[a]]$$"},
 {"id": "IM3-48-003", "kind": "Read the graph", "format": "numeric",
  "params": {"a": {"min": 1, "max": 4}, "p": {"min": 2, "max": 8, "step": 2}, "d": {"min": -3, "max": 3}},
  "stem": r"What is the <b>period</b> of this sinusoid?",
  "graph": {"window": [0, 12, -8, 8], "fns": [{"f": "a*cos(2*pi*x/p)+d"}]},
  "answer": "p", "tol": 0.01,
  "explain": r"It peaks at $x=0$ and next at $x=[[p]]$, so one cycle takes $[[p]]$ units."},
 {"id": "IM3-48-004", "kind": "Equation", "format": "numeric",
  "params": {"a": {"min": 2, "max": 6}, "d": {"min": -5, "max": 5, "not": [0]}},
  "stem": r"What is the <b>maximum</b> value of $y=[[a]]\sin x[[+d]]$?",
  "answer": "a+d", "tol": 0.01,
  "explain": r"$\sin x$ is at most $1$, so the maximum is $[[a]]\cdot 1[[+d]]=[[a+d]]$. (Midline $y=[[d]]$, amplitude $[[a]]$.)"},
]}

sets['IM3-05'] = {"title": "Exact values of logarithms", "questions": [
 {"id": "IM3-05-001", "kind": "Compute", "format": "numeric",
  "params": {"b": {"min": 2, "max": 5}, "n": {"min": 0, "max": 4}},
  "stem": r"Find the exact value: $$\log_{[[b]]}[[b^n]]$$",
  "answer": "n", "tol": 0.001,
  "explain": r"Ask: $[[b]]$ to what power is $[[b^n]]$? Since $[[b]]^{[[n]]}=[[b^n]]$, $\;\log_{[[b]]}[[b^n]]=[[n]]$."},
 {"id": "IM3-05-002", "kind": "Compute", "format": "numeric",
  "params": {"b": {"min": 2, "max": 5}, "n": {"min": 1, "max": 3}},
  "stem": r"Find the exact value: $$\log_{[[b]]}\frac{1}{[[b^n]]}$$",
  "answer": "-n", "tol": 0.001,
  "explain": r"$\dfrac{1}{[[b^n]]}=[[b]]^{-[[n]]}$, so $\log_{[[b]]}\dfrac{1}{[[b^n]]}=-[[n]]$."},
 {"id": "IM3-05-003", "kind": "Interactive", "format": "point", "n": 1,
  "params": {"n": {"min": 0, "max": 3}},
  "stem": r"Place the point on the graph of $y=\log_2 x$ where $y=[[n]]$.",
  "graph": {"window": [-1, 10, -4, 5], "fns": [{"f": "log2(x)"}]},
  "check": "X1==2^n && Y1==n",
  "explain": r"$\log_2 x=[[n]]$ means $x=2^{[[n]]}=[[2^n]]$. The point is $([[2^n]],\,[[n]])$."},
 {"id": "IM3-05-004", "kind": "Concept", "format": "mc",
  "params": {"b": {"min": 2, "max": 9}},
  "stem": r"What is $\log_{[[b]]}1$?",
  "choices": ["$0$", "$1$", "$[[b]]$", "Undefined"], "answer": 0,
  "explain": r"Every base to the power $0$ is $1$: $[[b]]^0=1$, so $\log_{[[b]]}1=0$."},
]}

OUT.mkdir(exist_ok=True)
index = {"sets": {}}
for code, st in sets.items():
    st = {"code": code, "title": st["title"], "version": 1, "demo": True, "questions": st["questions"]}
    (OUT / f"{code}.json").write_text(json.dumps(st, indent=1, ensure_ascii=False))
    index["sets"][code] = {"title": st["title"], "n": len(st["questions"])}
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print('wrote', ', '.join(index["sets"]))
