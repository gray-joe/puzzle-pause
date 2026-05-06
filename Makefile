backend-install:
	pip install -r backend/requirements.txt pytest pytest-cov

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

backend-test:
	cd backend && python -m pytest

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
	  --build-arg NEXT_PUBLIC_SENTRY_DSN="$$NEXT_PUBLIC_SENTRY_DSN" \
	  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT="$${NEXT_PUBLIC_SENTRY_ENVIRONMENT:-production}" \
	  --build-arg NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="$${NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:-0.1}" \
	  --build-arg NEXT_PUBLIC_SENTRY_RELEASE="$$(git rev-parse HEAD)" \
	  --build-arg SENTRY_AUTH_TOKEN="$$SENTRY_AUTH_TOKEN" \
	  --build-arg SENTRY_ORG="$$SENTRY_ORG" \
	  --build-arg SENTRY_PROJECT="$$SENTRY_PROJECT" \
	  --build-arg SENTRY_RELEASE="$$(git rev-parse HEAD)"

v2-install: backend-install web-install

v2-test: backend-test

.PHONY: all clean run run-prod seed deps test test-db test-auth test-puzzle test-league test-admin \
        backend-install backend-run backend-run-prod backend-test verify-db seed-dev \
        web-install web-run web-build web-test fly-deploy v2-install v2-test
