#!/bin/sh
# Stamp a new ?v= on every CSS/JS link so browsers fetch fresh files after a change.
cd "$(dirname "$0")" && V=$(date +%Y%m%d%H%M) &&
for f in *.html admin/index.html; do sed -i '' -E "s#(assets/(css|js)/[a-z]+\.(css|js))(\?v=[0-9]+)?\"#\1?v=$V\"#g" "$f"; done && echo "v=$V"
