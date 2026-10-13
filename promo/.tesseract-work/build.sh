#!/bin/bash
# Rebuild one promo project from scratch: build.sh <script.py> <project.tsrct> <width> <height> <duration_s> <images...>
set -euo pipefail
cd "$(dirname "$0")/.."
T="$HOME/Library/Application Support/Tesseract/bin/tsrct"
export TESSERACT_SKILL=tesseract-motion
SCRIPT=$1; PROJ=$2; W=$3; H=$4; DUR=$5; shift 5
TAG=$(basename "$SCRIPT" .py)
rm -f "$PROJ"
"$T" project create --project "$PROJ" >/dev/null
"$T" project checkout --project "$PROJ" --output .tesseract-work/editable.json >/dev/null
python3 -c "import json,sys; p='.tesseract-work/editable.json'; d=json.load(open(p)); d['dimensions']={'width':$W,'height':$H}; d['duration']=float($DUR); json.dump(d,open(p,'w'),indent=1)"
"$T" project commit --project "$PROJ" --file .tesseract-work/editable.json >/dev/null
for f in fonts/GothicA1-Bold.ttf fonts/DMSans-Regular.ttf; do "$T" project import-font --project "$PROJ" --file "$f" >/dev/null 2>&1; done
for a in "$@"; do "$T" project import-asset --project "$PROJ" --file "$PWD/assets/${a#*:}" --asset-id "${a%%:*}" --kind image >/dev/null; done
for s in pop click impact whoosh ping tap; do "$T" project import-asset --project "$PROJ" --file "$PWD/audio/$s.wav" --asset-id "sfx-$s" --kind audio >/dev/null; done
(cd .tesseract-work && python3 "$SCRIPT" create)
"$T" project apply --project "$PROJ" --actions ".tesseract-work/${TAG#build_}-create.json" >/dev/null
"$T" project checkout --project "$PROJ" --output .tesseract-work/editable.json >/dev/null
(cd .tesseract-work && python3 "$SCRIPT" media editable.json)
"$T" project commit --project "$PROJ" --file .tesseract-work/editable.json >/dev/null
(cd .tesseract-work && python3 "$SCRIPT" keys)
"$T" project apply --project "$PROJ" --actions ".tesseract-work/${TAG#build_}-keys.json" >/dev/null
echo "built $PROJ"
