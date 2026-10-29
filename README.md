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
node tools/test_workshop.mjs              # backend tests: Code.js against a fake in-memory Sheet
(cd apps-script && clasp push -f)         # ship the workshop
```

`tools/parse_tex.py` and `tools/draft_scope.py` produced the first draft from
`proficiencies25-26.tex`. They were seeding tools; the Sheet is now the source.

## Workshop deployment

- Script (bound to the Sheet): https://script.google.com/d/1AhSKgJMUsJXVWtaBwaj_BpeZ1YBD648cw3IUcu4nDPu9WGBeJC4uA0mN/edit
- Workshop URL: https://script.google.com/a/macros/nwacademy.org/s/AKfycbzJEKrTwjxh110-Bu-ixQHpJGkTp86txvT4JNH9YzL0R-NUxUEWd8y9nwudJxMgcOx6/exec
- Update the code behind the same URL:
  `python3 tools/build_workshop.py && cd apps-script && clasp push -f && clasp create-deployment -i AKfycbzJEKrTwjxh110-Bu-ixQHpJGkTp86txvT4JNH9YzL0R-NUxUEWd8y9nwudJxMgcOx6 -d "update"`

## Pre-meeting homework (votes and proposals)

Before a department meeting, teachers vote on every open overlap, every unresolved open question
(Flags) and every proposal, in the Workshop's **Review** tab. One vote per teacher per item, changeable
until the deadline. Teachers can also propose new items, and mark a course "read through" from its page.
The **My homework** box shows each teacher's progress; the chair also sees a who's-done table.
Teacher instructions: `docs/homework-guide.pdf`.

These tabs live **only in the Sheet**. `getData()` never reads them, so publishing never ships them.
Each tab is created on first use. **Column order is a contract** (the hub reads these tabs), so add
columns at the end and never rename them.

**Votes**: one row per teacher per item; a changed vote overwrites the row, a withdrawn vote deletes it.

| column | meaning |
|---|---|
| `id` | `<item_kind>:<item_id>\|<voter>` |
| `item_kind` | `overlap` · `flag` · `proposal` |
| `item_id` | Overlaps `id` (`PA1-02~PA2-04`), Flags `id` (`FL1`), or Proposals `id` (`PR1`) |
| `voter` | school email |
| `choice` | `keep` (keep both: different depth) · `move` (move to one course) · `merge` (merge wording) · `add` (add a proficiency) · `discuss` (needs discussion) |
| `reason` | optional, one line (≤ 300 chars) |
| `voted_at` | timestamp of the latest change |

**Proposals**: `id` (`PR1`, `PR2`, …) · `type` (`hole` · `collision` · `other`) · `courses` (comma-separated
course ids, e.g. `IM2,IM3`) · `text` · `proposed_by` · `proposed_at` · `status` (`open` · `withdrawn`).

**Reviewed**: `id` (`<course>|<teacher>`) · `course` · `teacher` · `reviewed_at`. One row per "read through" mark.

**Results**: derived, rebuilt after every vote, proposal and withdrawal. **Read this one for the agenda.**
One row per item currently on the ballot:
`item_kind` · `item_id` · `summary` (both proficiencies with codes and courses, or the question or proposal
text) · `courses` · `keep` · `move` · `merge` · `add` · `discuss` (counts) · `n_votes` · `leading` (the
top choice; ties joined with `/`; blank with no votes) · `reasons` (`user: reason | …`) · `updated_at`.

**Config** rows: `vote_deadline` (default `2026-11-25`; votes and proposals are refused after 11:59 pm
Pacific that day) and `homework_since` (default `2026-10-21`; proficiency edits in the Changelog from that
day count as "updated"). The roster is the `editors` row.

The ballot is the overlaps whose `status` is `open`, the Flags not `resolved`, and the Proposals not
`withdrawn`. Recording a meeting decision (an overlap's spiral, redundant or distinct; a flag's resolved)
is chair-only and takes the item off the ballot.
