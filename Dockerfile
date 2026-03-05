FROM python:3.13-slim AS backend-deps
COPY backend/requirements.txt /tmp/requirements.txt
RUN python -m venv /venv && \
    /venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY web/package*.json ./
RUN npm ci
COPY web/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

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
