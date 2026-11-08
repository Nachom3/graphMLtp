#!/usr/bin/env bash
# Levanta backend (FastAPI v1) + frontend (Next.js) con un solo comando.
# Uso: npm run dev  (desde la raíz del repo)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pick_python() {
  if [ -x "$ROOT/.venv/bin/python" ] && "$ROOT/.venv/bin/python" -c "import fastapi" 2>/dev/null; then
    echo "$ROOT/.venv/bin/python"
  else
    echo "python3"
  fi
}
PYTHON="$(pick_python)"

if [ ! -f "$ROOT/backend/artifacts/arbol.joblib" ]; then
  echo ">> Generando artefacto offline backend/artifacts/arbol.joblib ..."
  "$PYTHON" scripts/generate_arbol_artifact.py
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo ">> Instalando dependencias del frontend ..."
  npm ci --prefix frontend
fi

echo ">> Backend:  http://localhost:8000  (docs: http://localhost:8000/docs)"
echo ">> Frontend: http://localhost:3000"
echo ">> Ctrl+C para detener ambos."

"$PYTHON" -m uvicorn collection.api:app --reload --app-dir backend/src &
BACK_PID=$!
npm run dev --prefix frontend &
FRONT_PID=$!

cleanup() {
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait
