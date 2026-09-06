#!/usr/bin/env bash
# Static-export build + publish to here.now with the proxy manifest in place.
# Usage: npm run deploy [slug]   (slug defaults to the one in .herenow/state.json)
set -euo pipefail
cd "$(dirname "$0")/.."

SLUG="${1:-}"

STATIC_EXPORT=1 npx next build

# Build wipes out/ — re-add the proxy manifest (processed by here.now, never served).
mkdir -p out/.herenow
cp .herenow/proxy.json out/.herenow/proxy.json

if [[ -z "$SLUG" ]]; then
  SLUG=$(jq -r '.publishes | keys[0]' .herenow/state.json)
fi

echo "Publishing out/ to slug: $SLUG"
bash "$HOME/.zcode/skills/here-now/scripts/publish.sh" out --slug "$SLUG" --client zcode
