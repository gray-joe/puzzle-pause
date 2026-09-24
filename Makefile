backend-install:
	pip install -r backend/requirements-dev.txt

backend-run:
	@mkdir -p data
	cd backend && \
	  DATABASE_URL=sqlite:///$(CURDIR)/data/puzzle.db \
	  JWT_SECRET=dev-secret \
	  RATELIMIT_ENABLED=0 \
	  PUZZLE_ENV=dev \
	  ADMIN_EMAILS=admin@example.com \
	  BENCHMARK_BYPASS_SECRET="$$(sed -n 's/^BENCHMARK_BYPASS_SECRET=//p' ../web/.env.local 2>/dev/null | tail -1 | sed -e 's/^"//' -e 's/"$$//' | grep . || echo dev-benchmark-secret)" \
	  uvicorn app.main:app --reload --port 8000

backend-run-prod:
	cd backend && uvicorn app.main:app --port 8000

backend-unit-test:
	cd backend && python -m pytest -m unit

backend-api-test:
	cd backend && python -m pytest -m api

backend-test: backend-unit-test backend-api-test

verify-db:
	cd backend && DATABASE_URL=sqlite:///$(CURDIR)/data/puzzle.db python verify_db.py

seed-dev:
	@mkdir -p data
	cd backend && DATABASE_URL=sqlite:///$(CURDIR)/data/puzzle.db python seed_dev.py

web-install:
	cd web && npm install

web-run:
	cd web && API_URL=http://localhost:8000 ADMIN_EMAILS=admin@example.com npm run dev

web-build:
	cd web && npm run build

web-test:
	cd web && npm run test:e2e -- $(ARGS)

# The benchmark bypass secret is never passed on a command line — it lives in web/.env.local and
# is read straight from that file by Playwright (via dotenv) and by backend-run below. Secrets
# routinely contain shell metacharacters like & or $, which a VAR=value prefix would split on.
# BASE_URL=https://puzzlepause.app targets production; default is the local stack.
BENCHMARK_BASE_URL = $(if $(BASE_URL),$(BASE_URL),http://localhost:3000)

benchmark-run:
	cd web && npm run benchmark

# Run one specific puzzle against every model. URL=<full puzzle URL>
benchmark-puzzle:
	@test -n "$(URL)" || (echo "URL is required, e.g. make benchmark-puzzle URL=https://puzzlepause.app/archive/19" && exit 1)
	cd web && BENCHMARK_URL=$(URL) npx playwright test --project=benchmark-single

# Have the bots play today's daily puzzle (what the today/weekly league boards score).
benchmark-daily:
	cd web && BENCHMARK_BASE_URL=$(BENCHMARK_BASE_URL) \
	  npx playwright test --project=benchmark-daily

# Add the bot accounts to a league so real players can compare against them.
# CODE=<invite code>
benchmark-join-league:
	@test -n "$(CODE)" || (echo "CODE is required, e.g. make benchmark-join-league CODE=ABC123" && exit 1)
	cd web && node benchmark/join-league.mjs $(CODE) $(BENCHMARK_BASE_URL)

# Preview / delete the bot accounts and their data. Scoped to the reserved benchmark email
# domain, so real users are never matched. ARGS="--dry-run" to preview.
benchmark-clean:
	cd backend && DATABASE_URL=sqlite:///$(CURDIR)/data/puzzle.db python delete_benchmark_users.py $(ARGS)

FLY ?= flyctl

fly-deploy:
	@test -n "$$NEXT_PUBLIC_SENTRY_DSN" || (echo "NEXT_PUBLIC_SENTRY_DSN is required" && exit 1)
	@test -n "$$SENTRY_AUTH_TOKEN" || (echo "SENTRY_AUTH_TOKEN is required" && exit 1)
	@test -n "$$SENTRY_ORG" || (echo "SENTRY_ORG is required" && exit 1)
	@test -n "$$SENTRY_PROJECT" || (echo "SENTRY_PROJECT is required" && exit 1)
	$(FLY) deploy \
	  $(FLY_DEPLOY_FLAGS) \
	  --build-arg NEXT_PUBLIC_SENTRY_DSN="$$NEXT_PUBLIC_SENTRY_DSN" \
	  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT="$${NEXT_PUBLIC_SENTRY_ENVIRONMENT:-production}" \
	  --build-arg NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="$${NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:-0.1}" \
	  --build-arg NEXT_PUBLIC_SENTRY_RELEASE="$$(git rev-parse HEAD)" \
	  --build-arg SENTRY_AUTH_TOKEN="$$SENTRY_AUTH_TOKEN" \
	  --build-arg SENTRY_ORG="$$SENTRY_ORG" \
	  --build-arg SENTRY_PROJECT="$$SENTRY_PROJECT" \
	  --build-arg SENTRY_RELEASE="$$(git rev-parse HEAD)"

fly-pull-db:
	@mkdir -p data
	@timestamp=$$(date -u +%Y%m%dT%H%M%SZ); \
	  remote_db="/tmp/puzzle-$$timestamp.db"; \
	  local_db="data/puzzle-$$timestamp.db"; \
	  $(FLY) ssh console --command "sqlite3 /app/data/puzzle.db '.backup $$remote_db'" && \
	  $(FLY) ssh sftp get "$$remote_db" "$$local_db" && \
	  $(FLY) ssh console --command "rm -f $$remote_db" && \
	  echo "Production database copied to $$local_db"

v2-install: backend-install web-install

v2-test: backend-test

.PHONY: all clean run run-prod seed deps test test-db test-auth test-puzzle test-league test-admin \
	backend-install backend-run backend-run-prod backend-test backend-unit-test backend-api-test verify-db seed-dev \
	web-install web-run web-build web-test benchmark-run benchmark-puzzle benchmark-daily benchmark-join-league \
	benchmark-clean fly-deploy fly-pull-db v2-install v2-test
