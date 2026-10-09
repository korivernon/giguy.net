---
description: Work through the giguy.net "Suggest an edit" inbox, make the changes, and close each one out
argument-hint: "[edit id ...]"
---

Suggestions come from the 💡 "Suggest an edit" button (admin users only) and live in the PRIVATE repo
`korivernon/giguy-edits` (`edits/<id>.json` + `<id>.jpg`).

1. Export the open items with screenshots into the scratchpad:
   `python3 scripts/edits.py export --out <scratchpad>/edits > <scratchpad>/edits.json`
   If I passed ids ($ARGUMENTS), only handle those. If nothing is open, say so and stop.
2. For each item, Read its screenshot (`screenshot_file`; drawn marks point at the spot) and open its `page`
   on the site to see exactly what they meant. Note `viewport` (phone vs desktop).
3. Group duplicates, then give me a short plan: per item, what you'd change (content in data/site.json vs.
   code in assets/), or why you'd decline or need more detail. Medical claims, prices, hours and anything
   legal (Fast-Track, insurance limits) need my go-ahead; small wording/layout fixes can go ahead.
4. Mark items you start: `python3 scripts/edits.py update ID --status in_progress`.
5. Implement. Content changes go in data/site.json; run ./bump.sh after CSS/JS changes; check phone and
   desktop in the preview (launch config `giguy-site`, :8479).
6. Commit (referencing the edit ids), pull --rebase, push to main, then close each item with a plain note:
   `python3 scripts/edits.py update ID --status done --note "What changed and where" --commit <sha>`
   Use `--status wont_do --note "why"` for declined items.
7. Reply with a table: id, request, outcome (done / declined / needs info), commit.
