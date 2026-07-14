#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
#  Capture landing screenshots from the running dev server with headless Chrome
#  (zero-install — uses the Google Chrome already on macOS). Retina 2× PNGs land
#  in public/shots/. Re-run after UI changes to refresh the utoronto landing art.
#
#  Usage:  DEV=http://localhost:3100 bash scripts/capture-shots.sh
#  The dev server must be running first (preview_start "dev").
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEV="${DEV:-http://localhost:3100}"
OUT="public/shots"
mkdir -p "$OUT"

shot() { # name  url  width  height
  local name="$1" url="$2" w="${3:-1280}" h="${4:-880}"
  echo "· $name  ←  $url  (${w}×${h})"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size="${w},${h}" \
    --virtual-time-budget=6000 \
    --screenshot="$OUT/${name}.png" "$url" >/dev/null 2>&1 || true
  [ -s "$OUT/${name}.png" ] && echo "  ✓ $OUT/${name}.png" || echo "  ✗ FAILED $name"
}

# Back-office breadth — the polished /demo tour (fake data, no login needed).
shot orders     "$DEV/demo/orders"     1280 880
shot sales      "$DEV/demo/reports"    1280 880
shot inventory  "$DEV/demo/inventory"  1280 880
shot books      "$DEV/demo/reconcile"  1280 880

# Live pickup tracker (anonymous, token-gated). Only captures once a real
# demo-truck pickup order exists — pass its id+token via ORDER_URL.
if [ -n "${ORDER_URL:-}" ]; then
  shot tracker "$ORDER_URL" 440 900
fi

echo "done."
