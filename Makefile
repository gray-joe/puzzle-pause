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

v2-install: backend-install web-install

v2-test: backend-test

.PHONY: all clean run run-prod seed deps test test-db test-auth test-puzzle test-league test-admin \
        backend-install backend-run backend-run-prod backend-test verify-db seed-dev \
        web-install web-run web-build v2-install v2-test
