#!/bin/sh
set -e

echo "==> Running database migrations..."
cd /app/server
python -m alembic upgrade head

echo "==> Starting API server on port 8000..."
python -m uvicorn main:app --host 127.0.0.1 --port 8000 &

echo "==> Waiting for API to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo "==> API is ready."
    break
  fi
  sleep 1
done

echo "==> Starting Next.js on port ${PORT:-3000}..."
cd /app/client
HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" exec node .next/standalone/client/server.js
