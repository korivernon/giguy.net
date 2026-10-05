# giguy.net

Website for Kurt Vernon, MD, PA ("The GI Guy"), served by GitHub Pages.

- All content lives in `data/site.json`. `assets/js/site.js` renders every page from it; the `.html` files are thin shells (`<body data-page="…">`).
- `/admin/` edits `site.json` and publishes through the GitHub contents API with a fine-grained token (Contents: read & write on this repo only), stored only in the browser. "Edit without GitHub" downloads the JSON instead.
- **Banners** (admin → Banners): a message shown across the top of every page between an optional start and end time, e.g. "Office closed Friday." They switch on and off by themselves; visitors can dismiss them.
- Patient Portal buttons all link to `practice.portalUrl` (https://giguy.mygportal.com/).
- `404.html` forwards old `giguy.net/*.php` links to the matching new page.

Preview locally: `python3 -m http.server 8479` in this folder.
