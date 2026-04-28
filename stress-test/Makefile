.PHONY: install stress quick full test clean help

# Install dependencies
install:
	pip install locust python-dotenv

# Run with web UI (http://localhost:8089)
# TARGET_HOST and HASH_SECRET are loaded from .env by locustfile.py
stress:
	locust -f locustfile.py

# Quick test: 10 users, 30s
quick:
	locust -f locustfile.py --headless --users 10 --spawn-rate 5 --run-time 30s

# Full 500 CCU test: ramp up over ~10s, run 5 minutes
full:
	locust -f locustfile.py --headless --users 500 --spawn-rate 50 --run-time 5m

# Custom: make test USERS=200 RATE=20 TIME=3m
test:
	locust -f locustfile.py --headless \
		--users $(or $(USERS),100) \
		--spawn-rate $(or $(RATE),10) \
		--run-time $(or $(TIME),60s)

# Clean generated files
clean:
	rm -rf __pycache__ .pytest_cache

help:
	@echo Stress test - full user flow (register - login - session - upload - view)
	@echo.
	@echo Config via .env (stress-test/.env or project root .env):
	@echo   TARGET_HOST=http://localhost:3085
	@echo   HASH_SECRET=your_secret
	@echo.
	@echo Commands:
	@echo   make install    Install Locust + python-dotenv
	@echo   make stress     Web UI on :8089
	@echo   make quick      10 users, 30s headless
	@echo   make full       500 CCU, 5 min headless
	@echo   make test       Custom: USERS=200 RATE=20 TIME=3m
