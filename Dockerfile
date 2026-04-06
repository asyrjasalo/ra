# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:debian AS deps

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

# ============================================
# Stage 2: Production
# ============================================
FROM oven/bun:debian AS runner

WORKDIR /app

EXPOSE 3000

RUN useradd --system --uid 1001 --create-home app

COPY --from=deps --chown=app:app /app/node_modules /app/node_modules
COPY --chown=app:app src /app/src
COPY --chown=app:app .pi /app/.pi

USER app

ENTRYPOINT ["bun", "run"]
CMD ["serve"]
