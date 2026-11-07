#!/usr/bin/env bash
# Instala scripts/pre-push en .git/hooks/pre-push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"
cp "$ROOT/scripts/pre-push" "$HOOK"
chmod +x "$HOOK"
echo "installed: $HOOK"
