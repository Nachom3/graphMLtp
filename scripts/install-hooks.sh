#!/usr/bin/env bash
# Instala scripts/pre-push en .git/hooks/pre-push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"
if [ -e "$HOOK" ] && ! cmp -s "$ROOT/scripts/pre-push" "$HOOK"; then
  cp "$HOOK" "$HOOK.bak"
  echo "backup: existing hook saved to $HOOK.bak"
fi
cp "$ROOT/scripts/pre-push" "$HOOK"
chmod +x "$HOOK"
echo "installed: $HOOK"
