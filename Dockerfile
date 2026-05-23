# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS builder
WORKDIR /build

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl jq ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY client/package.json client/
COPY server/package.json server/
RUN --mount=type=cache,target=/root/.npm \
    npm install --include=dev

COPY tsconfig.base.json ./
COPY client/ client/
COPY server/ server/

RUN npm run build

RUN npm prune --omit=dev


FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# openssh-client is needed by the coding-agent terminal — the dashboard
# server shells out to `ssh agent@${WS}-coding-agent` to open agent sessions.
# ca-certificates ships the system CA bundle and `update-ca-certificates`,
# which the entrypoint runs at startup so any custom CAs mounted into
# /usr/local/share/ca-certificates/custom are trusted by anything the
# dashboard's Node runtime fetches (e.g. AOC / gitops over HTTPS).
# (The pty binding ships prebuilds via @homebridge/node-pty-prebuilt-multiarch,
# so dev-mode `npm install` no longer needs a C toolchain at runtime.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN userdel -r node 2>/dev/null || true \
 && groupdel node 2>/dev/null || true \
 && groupadd -g 1000 coder \
 && useradd -u 1000 -g 1000 -m -s /bin/bash coder \
 && mkdir -p /workspace/workspace \
 && chown -R coder:coder /workspace

COPY --from=builder --chown=coder:coder /build/package.json ./
COPY --from=builder --chown=coder:coder /build/server/package.json ./server/
COPY --from=builder --chown=coder:coder /build/client/package.json ./client/
COPY --from=builder --chown=coder:coder /build/server/dist ./server/dist
COPY --from=builder --chown=coder:coder /build/client/dist ./client/dist
COPY --from=builder --chown=coder:coder /build/node_modules ./node_modules

COPY --chown=coder:coder entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Entrypoint starts as root so it can refresh the CA bundle when the daemon
# mounts custom CAs (via UPDATE_CA_CERTIFICATES=true), then drops to `coder`
# via `runuser` before launching the dashboard. Auth lives entirely in
# bailey-proxy upstream of this container — no auth sidecar here.
ENV NODE_ENV=production
ENV PORT=8080
ENV INTERNAL_PORT=8081
EXPOSE 8080

CMD ["/usr/local/bin/entrypoint.sh"]
