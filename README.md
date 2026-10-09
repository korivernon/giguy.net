# giguy.net

Website for Kurt Vernon, MD, PA ("The GI Guy"), served by GitHub Pages.

- All content lives in `data/site.json`. `assets/js/site.js` renders every page from it; the `.html` files are thin shells (`<body data-page="…">`).
- `/admin/` edits `site.json` and publishes through the GitHub contents API with a fine-grained token (Contents: read & write on this repo only), stored only in the browser. "Edit without GitHub" downloads the JSON instead.
- **Banners** (admin → Banners): a message shown across the top of every page between an optional start and end time, e.g. "Office closed Friday." They switch on and off by themselves; visitors can dismiss them.
- Patient Portal buttons all link to `practice.portalUrl` (https://giguy.mygportal.com/).
- `404.html` forwards old `giguy.net/*.php` links to the matching new page.

Preview locally: `python3 -m http.server 8479` in this folder.

## Suggested edits
- People signed into `/admin/` see a 💡 **Suggest an edit** button on every page. It screenshots the screen, lets them draw on it, and saves the note + screenshot to the **private** repo `korivernon/giguy-edits` (`edits/<id>.json` + `.jpg`). The admin token must include that repo (Contents: read & write).
- Admin → **Suggested edits** lists them with status and notes.
- In Claude Code, run `/process-edits` here; `scripts/edits.py export|update|count` is the bridge (uses `gh` auth).
