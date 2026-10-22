#!/bin/sh
# Rebuilds the printable PDFs in files/ from the live pages, so the PDFs always match the website.
# Needs the local preview running (http://localhost:8479) and Google Chrome. Run: ./scripts/make_docs.sh
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE=${BASE:-http://localhost:8479}
pdf() { "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=6000 --print-to-pdf="files/$1.pdf" "$BASE/$2" 2>/dev/null && echo "files/$1.pdf"; }
for p in sulfate-liquid sulfate-tablet peg-powder peg-gallon magnesium-citrate; do pdf "colonoscopy-prep-$p" "colonoscopy-prep.html?prep=$p"; done
pdf patient-rights-and-responsibilities "policy.html?id=patient-rights"
pdf privacy-policy "policy.html?id=privacy"
pdf financial-policy "policy.html?id=financial-policy"
