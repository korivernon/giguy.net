# GI Guy patient feedback API

Cloudflare Worker + D1 database behind the QR-poster survey (`feedback.html`) and the staff dashboard (`admin/feedback.html`).

## Deploy (one time)
```
cd feedback-api
npx wrangler d1 create giguy-feedback          # copy the database_id into wrangler.toml
npx wrangler d1 execute giguy-feedback --remote --file schema.sql
npx wrangler secret put STAFF_PASSCODE         # the code staff type to sign in
npx wrangler secret put SESSION_SECRET         # any long random string
npx wrangler deploy                             # prints the https://giguy-feedback.<subdomain>.workers.dev address
```
Then put that address in admin → Patient feedback survey → Feedback service address (`feedback.api` in data/site.json).

## Local testing
`npx wrangler d1 execute giguy-feedback --local --file schema.sql`, then `npx wrangler dev --port 8790 --local`.
On localhost the site talks to port 8790 automatically. `.dev.vars` holds local-only test secrets.

## Posters
`python3 scripts/make_feedback_posters.py` (needs `pip install segno`) writes the letter posters and 4x6 table cards to files/.
Re-run with `--base https://giguy.net` after the domain switch.
