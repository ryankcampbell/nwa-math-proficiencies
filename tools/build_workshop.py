"""Build the Workshop's HTML files for Apps Script.

    python3 tools/build_workshop.py && (cd apps-script && clasp push -f)

Apps Script cannot load sibling files, so the Workshop carries the public site's CSS and JS.
They go in separate plain files that the template pulls in with include_() at run time.
They must NOT be pasted into the template itself: Apps Script's template compiler turns
escape sequences such as \\n inside the code into real line breaks, which breaks the JS
(the blank-page bug of 2026-10-16). Run after any change to app.js, practice.js or style.css.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps-script'
css = (ROOT / 'style.css').read_text()
js = (ROOT / 'practice.js').read_text() + '\n' + (ROOT / 'app.js').read_text()
assert '</script' not in js.lower(), 'JS contains </script'
import re
bad = [l for l in js.splitlines() if re.search(r'(?<!\\)\\n', l) and not l.strip().startswith(('//', '*', '/*'))]
assert not bad, 'backslash-n escapes break the Workshop (use NL): ' + bad[0][:120]
assert '</style' not in css.lower(), 'CSS contains </style'

(OUT / 'WorkshopCss.html').write_text('<style>\n' + css + '\n</style>\n')
(OUT / 'WorkshopJs.html').write_text('<script>\n' + js + '\n</script>\n')
(OUT / 'Workshop.html').write_text("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/contrib/auto-render.min.js"></script>
<?!= include_('WorkshopCss') ?>
</head>
<body>
<script>
window.NWA_WORKSHOP = true;
window.NWA_DATA = <?!= dataJson ?>;
window.NWA_USER = <?!= userJson ?>;
window.NWA_CHAIR = <?!= chairJson ?>;
</script>
<?!= include_('WorkshopJs') ?>
</body>
</html>
""")
for f in ('Workshop.html', 'WorkshopCss.html', 'WorkshopJs.html'):
    print('apps-script/' + f, (OUT / f).stat().st_size // 1024, 'KB')
