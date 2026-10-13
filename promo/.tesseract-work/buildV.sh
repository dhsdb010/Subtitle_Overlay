#!/bin/bash
# Build a vertical cut: buildV.sh A|B
set -euo pipefail
cd "$(dirname "$0")/.."
T="$HOME/Library/Application Support/Tesseract/bin/tsrct"
export TESSERACT_SKILL=tesseract-motion
V=$1
case $V in A) DUR=30;; B) DUR=45;; esac
PROJ="${V}_9x16.tsrct"
rm -f "$PROJ"
"$T" project create --project "$PROJ" >/dev/null   # default canvas is 1080x1920
"$T" project checkout --project "$PROJ" --output .tesseract-work/editable.json >/dev/null
python3 -c "import json; p='.tesseract-work/editable.json'; d=json.load(open(p)); d['duration']=float($DUR); json.dump(d,open(p,'w'),indent=1)"
"$T" project commit --project "$PROJ" --file .tesseract-work/editable.json >/dev/null
for f in fonts/GothicA1-Bold.ttf fonts/DMSans-Regular.ttf; do "$T" project import-font --project "$PROJ" --file "$f" >/dev/null 2>&1; done
"$T" project import-video --project "$PROJ" --file "$PWD/out/${V}_16x9.mp4" --asset-id "vid$V" >/dev/null
"$T" project import-asset --project "$PROJ" --file "$PWD/assets/icon512.png" --asset-id icon --kind image >/dev/null
(cd .tesseract-work && python3 build_V.py "$V" create)
"$T" project apply --project "$PROJ" --actions ".tesseract-work/V${V}-create.json" >/dev/null
"$T" project checkout --project "$PROJ" --output .tesseract-work/editable.json >/dev/null
(cd .tesseract-work && python3 build_V.py "$V" media editable.json)
"$T" project commit --project "$PROJ" --file .tesseract-work/editable.json >/dev/null
(cd .tesseract-work && python3 build_V.py "$V" keys)
"$T" project apply --project "$PROJ" --actions ".tesseract-work/V${V}-keys.json" >/dev/null
echo "built $PROJ"
