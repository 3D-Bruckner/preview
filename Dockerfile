# Build: full deps, next build (standalone output). Debian like the runtime image, so the build sees the same libc.
FROM node:26-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# No install scripts: better-sqlite3's prebuilt binaries are in the package and are what it loads; nothing else needs a script.
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# next.config's outputFileTracingExcludes covers the routes; the traces of instrumentation.ts and proxy.ts pull in all of backend/, so the
# tests, fixtures and test helpers are taken out of the standalone copy here as well.
RUN npm run build && mkdir /data \
 && find .next/standalone/backend \( -name '*.test.ts' -o -name fixtures -o -name testing \) -prune -exec rm -rf {} +

# Runtime: only the standalone server and its traced deps. Distroless: Node and the libraries it links against, and no shell, package
# manager or npm, so nothing of that kind can be vulnerable or be used by someone who got in (conventions: Next.js app).
FROM gcr.io/distroless/nodejs26-debian13
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# The app is root's and only readable by the runtime user; /data is the one place it writes (the entrypoint hands DATA_DIR to its owner).
COPY --from=build --chown=1000:1000 /data /data
COPY docker-entrypoint.mjs ./
VOLUME /data
EXPOSE 3000
# GET /health: `docker ps` and monitors that read Docker's health status show it. A 503 (the database doesn't answer) is unhealthy. Node,
# not wget: the image has no shell.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Starts as root only to switch to the owner of /data (docker-entrypoint.mjs). --use-system-ca: the SMTP server and the sign-in providers are
# trusted through the image's certificate store, not only the list compiled into Node; an extra CA (an internal one) is added with
# NODE_EXTRA_CA_CERTS pointing to a mounted file.
ENTRYPOINT ["/nodejs/bin/node", "--use-system-ca", "docker-entrypoint.mjs"]
