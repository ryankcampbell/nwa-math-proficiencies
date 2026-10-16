"""Inline style.css and app.js into apps-script/Workshop.html.

    python3 tools/build_workshop.py && (cd apps-script && clasp push -f)

Apps Script's HtmlService cannot load sibling files, so the workshop page carries
the public site's CSS and JS inline. Run after any change to app.js or style.css.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
css = (ROOT / 'style.css').read_text()
js = (ROOT / 'app.js').read_text()
for name, src in (('style.css', css), ('app.js', js)):
    assert '<?' not in src and '?>' not in src, f'{name} contains a scriptlet marker'
    assert '</script' not in src.lower(), f'{name} contains </script'

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
{css}
</style>
</head>
<body>
<script>
window.NWA_WORKSHOP = true;
window.NWA_DATA = <?!= dataJson ?>;
window.NWA_USER = <?!= userJson ?>;
window.NWA_CHAIR = <?!= chairJson ?>;
</script>
<script>
{js}
</script>
</body>
</html>
"""
(ROOT / 'apps-script/Workshop.html').write_text(page)
print('apps-script/Workshop.html', len(page) // 1024, 'KB')
