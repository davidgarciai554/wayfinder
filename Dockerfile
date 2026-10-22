# Wayfinder: local web board (default) and, as a variant, the MCP server over stdio.
# Plan: Planes/2026-10-21-wayfinder-mvp.md (v3), section "Docker". Usage: README, section Docker.

# Base image pinned by digest (node:22-slim, 2026-10-21). Update both stages together.
FROM node:22-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS build
WORKDIR /src
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY scripts ./scripts
COPY src ./src
COPY web ./web
RUN npm run build

FROM node:22-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d
# git makes the automatic local commits; nothing else is installed.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/dist ./dist
COPY LICENSE ./
# No VOLUME on purpose: an anonymous volume would hold the data where nobody sees it.
# serve and mcp refuse to start unless an initialised folder is mounted at /data.
ENV WAYFINDER_HOME=/data \
    NODE_ENV=production
USER node
EXPOSE 4747
ENTRYPOINT ["node", "/app/dist/wayfinder.mjs"]
CMD ["serve", "--host", "0.0.0.0", "--poll"]
