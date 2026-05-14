FROM python:3.13-slim AS backend-deps
COPY backend/requirements.txt /tmp/requirements.txt
RUN python -m venv /venv && \
    /venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

FROM node:22.22.2-alpine AS frontend-builder
WORKDIR /build
COPY web/package*.json ./
RUN npm ci
COPY web/ .
COPY docs/privacy.md /docs/privacy.md
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_RELEASE
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
ARG SENTRY_NEXT_DSN
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

FROM node:22.22.2-slim AS node-provider

FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends supervisor sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node-provider /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

COPY --from=backend-deps /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY backend/ backend/

COPY --from=frontend-builder /build/.next/standalone/ web/
COPY --from=frontend-builder /build/.next/static/ web/.next/static/
COPY --from=frontend-builder /build/public/ web/public/

COPY supervisord.conf /etc/supervisor/conf.d/app.conf

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]
