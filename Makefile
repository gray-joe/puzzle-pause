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

fly-deploy:
	@test -n "$$NEXT_PUBLIC_SENTRY_DSN" || (echo "NEXT_PUBLIC_SENTRY_DSN is required" && exit 1)
	@test -n "$$SENTRY_AUTH_TOKEN" || (echo "SENTRY_AUTH_TOKEN is required" && exit 1)
	@test -n "$$SENTRY_ORG" || (echo "SENTRY_ORG is required" && exit 1)
	@test -n "$$SENTRY_PROJECT" || (echo "SENTRY_PROJECT is required" && exit 1)
	fly deploy \
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
	  fly ssh console --command "sqlite3 /app/data/puzzle.db '.backup $$remote_db'" && \
	  fly ssh sftp get "$$remote_db" "$$local_db" && \
	  fly ssh console --command "rm -f $$remote_db" && \
	  echo "Production database copied to $$local_db"

v2-install: backend-install web-install

v2-test: backend-test

.PHONY: all clean run run-prod seed deps test test-db test-auth test-puzzle test-league test-admin \
	backend-install backend-run backend-run-prod backend-test backend-unit-test backend-api-test verify-db seed-dev \
	web-install web-run web-build web-test fly-deploy fly-pull-db v2-install v2-test
