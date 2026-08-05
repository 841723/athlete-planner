FROM node:24-slim

WORKDIR /app

# Python + uv (needed by scripts/garmin-fetch.py)
RUN apt-get update && apt-get install -y --no-install-recommends python3 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh -o /tmp/uv-install.sh \
    && sh /tmp/uv-install.sh \
    && rm /tmp/uv-install.sh \
    && /root/.local/bin/uv --version
ENV PATH="/root/.local/bin:${PATH}"
ENV UV_CACHE_DIR="/root/.cache/uv"

# Backend dependencies (plain Node, no build)
COPY backend/ backend/

# Frontend: install and build
COPY frontend/package.json frontend/package-lock.json* frontend/
RUN --mount=type=cache,target=/root/.npm npm install --prefix frontend

COPY frontend/ frontend/

# Scripts (needed by sync commands)
COPY scripts/ scripts/

# Static data files (system prompt + example profile). The DB lives in a volume.
COPY data/trainer-system-prompt.txt data/athlete-profile.example.json data/

# Sessions data (legacy, used by the one-time migration to the DB)
COPY sessions/ sessions/

EXPOSE 3000

# Run backend (--watch auto-restarts on file changes) + frontend dev server (HMR)
CMD ["sh", "-c", "node --watch backend/server.js --port 4000 & npm --prefix frontend run dev -- --host 0.0.0.0"]
