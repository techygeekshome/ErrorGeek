#!/usr/bin/env bash
# Builds the release packages into dist/.
#   ErrorGeek.zip          Chrome, Edge, Brave, Opera, Vivaldi (unzip, then Load unpacked)
#   ErrorGeek-chrome.zip   same files, named for Chrome users
#   ErrorGeek-edge.zip     same files, named for Edge users
#   ErrorGeek-firefox.zip  Firefox package (Firefox manifest, files at the root)
set -euo pipefail
cd "$(dirname "$0")"
FILES="background.js decode.js popup.html popup.css popup.js errors.json LICENSE-data.txt icons"
OUT=dist; TMP=$(mktemp -d)
mkdir -p "$OUT"
rm -f "$OUT"/ErrorGeek*.zip

mkdir "$TMP/errorgeek"
cp -r $FILES manifest.json "$TMP/errorgeek/"
(cd "$TMP" && zip -qr -X pkg.zip errorgeek)
for n in ErrorGeek ErrorGeek-chrome ErrorGeek-edge; do cp "$TMP/pkg.zip" "$OUT/$n.zip"; done

mkdir "$TMP/ff"
cp -r $FILES "$TMP/ff/"
cp manifest.firefox.json "$TMP/ff/manifest.json"
(cd "$TMP/ff" && zip -qr -X ../ff.zip .)
cp "$TMP/ff.zip" "$OUT/ErrorGeek-firefox.zip"

rm -r "$TMP"
ls -l "$OUT"
