# NWA Math Proficiencies

Northwest Academy mathematics proficiencies and scope and sequence, 6th grade through
Combined Calculus. Live at **https://ryankcampbell.github.io/nwa-math-proficiencies/**.

- **Courses**: every course's proficiencies, by unit or by strand.
- **Scope & Sequence**: one tab per strand; threads × courses (the department template, live).
  Downloads as Excel in the template's format.
- **Assign practice**: teachers build a summer / make-up link; students open it, check items off,
  and get resources for each proficiency.
- **Review**: overlaps and open questions for the department.

## How it fits together

| Piece | Where | Who edits |
|---|---|---|
| Public site (this repo, GitHub Pages) | `index.html`, `app.js`, `style.css`, `data/data.json` | nobody by hand — `data.json` is published from the Sheet |
| The live draft | Google Sheet "NWA Math Proficiencies" | teachers, directly or via the Workshop |
| Workshop (editing UI) | Apps Script web app bound to the Sheet, source in `apps-script/` | — |

Proficiency **codes are permanent** (`IM3-14`, `CALC-P25`). A retired code is never reused, so
old practice links keep working.

## Maintenance

```sh
python3 tools/build_workshop.py          # after editing app.js or style.css
(cd apps-script && clasp push -f)         # ship the workshop
```

`tools/parse_tex.py` and `tools/draft_scope.py` produced the first draft from
`proficiencies25-26.tex`. They were seeding tools; the Sheet is now the source.

## Workshop deployment

- Script (bound to the Sheet): https://script.google.com/d/1AhSKgJMUsJXVWtaBwaj_BpeZ1YBD648cw3IUcu4nDPu9WGBeJC4uA0mN/edit
- Workshop URL: https://script.google.com/a/macros/nwacademy.org/s/AKfycbzJEKrTwjxh110-Bu-ixQHpJGkTp86txvT4JNH9YzL0R-NUxUEWd8y9nwudJxMgcOx6/exec
- Update the code behind the same URL:
  `python3 tools/build_workshop.py && cd apps-script && clasp push -f && clasp create-deployment -i AKfycbzJEKrTwjxh110-Bu-ixQHpJGkTp86txvT4JNH9YzL0R-NUxUEWd8y9nwudJxMgcOx6 -d "update"`
