FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libxml2-dev libxslt1-dev curl \
    && rm -rf /var/lib/apt/lists/*

# -- Node.js --
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm i -g pnpm@9.15.0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Baked into Next rewrites (see client/next.config.ts). Not Railway `PORT` / not `API_INTERNAL_*`.
ENV DOCKER_INTERNAL_API=http://127.0.0.1:8000

# -- Python deps --
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt

# Playwright
RUN playwright install-deps chromium \
    && playwright install chromium \
    && rm -rf /var/lib/apt/lists/*

# -- Node deps + build --
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY client/ ./client/

RUN pnpm install --frozen-lockfile \
    && pnpm --filter=@testing-agent/shared build \
    && pnpm --filter=@testing-agent/client build

# Copy standalone static assets (Next.js standalone doesn't include these)
RUN cp -r /app/client/.next/static /app/client/.next/standalone/client/.next/static || true
RUN cp -r /app/client/public /app/client/.next/standalone/client/public || true

# -- Server code --
COPY server/ ./server/

# -- Start script --
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
