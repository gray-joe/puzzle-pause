CC = cc

# Compiler flags:
#   -Wall     : Enable all warnings (helps catch bugs)
#   -Wextra   : Even more warnings
#   -O2       : Optimization level 2 (fast code, reasonable compile time)
#   -g        : Include debug symbols (for debugging with lldb/gdb)
CFLAGS = -Wall -Wextra -O2 -g

# Linker flags - libraries to link against
#   On macOS, Mongoose needs no extra libraries
#   On Linux, use -lpthread for threading
LDFLAGS =

SRC = src/main.c src/db.c src/auth.c src/util.c src/puzzle.c src/league.c src/mongoose.c src/sqlite3.c
TARGET = puzzle_server

all: $(TARGET)

$(TARGET): $(SRC) src/mongoose.h
	$(CC) $(CFLAGS) -o $@ $(SRC) $(LDFLAGS)

clean:
	rm -f $(TARGET) test_db test_auth test_puzzle test_league test_admin test_puzzle.db test_auth.db test_league.db test_admin.db

seed:
	@./scripts/seed_dev.sh

run: $(TARGET)
	@mkdir -p data
	PUZZLE_ENV=dev ./$(TARGET)

run-prod: $(TARGET)
	@mkdir -p data
	PUZZLE_ENV=prod ./$(TARGET)

test_db: src/test_db.c src/db.c src/sqlite3.c src/test.h src/db.h
	$(CC) $(CFLAGS) -o test_db src/test_db.c src/db.c src/sqlite3.c $(LDFLAGS)

test_auth: src/test_auth.c src/auth.c src/util.c src/db.c src/sqlite3.c
	$(CC) $(CFLAGS) -o test_auth src/test_auth.c src/auth.c src/util.c src/db.c src/sqlite3.c $(LDFLAGS)

test_puzzle: src/test_puzzle.c src/puzzle.c src/util.c src/db.c src/sqlite3.c
	$(CC) $(CFLAGS) -o test_puzzle src/test_puzzle.c src/puzzle.c src/util.c src/db.c src/sqlite3.c $(LDFLAGS)

test_league: src/test_league.c src/league.c src/util.c src/db.c src/sqlite3.c
	$(CC) $(CFLAGS) -o test_league src/test_league.c src/league.c src/util.c src/db.c src/sqlite3.c $(LDFLAGS)

test_admin: src/test_admin.c src/auth.c src/puzzle.c src/util.c src/db.c src/sqlite3.c
	$(CC) $(CFLAGS) -o test_admin src/test_admin.c src/auth.c src/puzzle.c src/util.c src/db.c src/sqlite3.c $(LDFLAGS)

test: test_db test_auth test_puzzle test_league test_admin $(TARGET)
	@echo ""
	@echo "=== Database Tests ==="
	@./test_db
	@echo ""
	@echo "=== Authentication Tests ==="
	@./test_auth
	@echo ""
	@echo "=== Puzzle Tests ==="
	@./test_puzzle
	@echo ""
	@echo "=== League Tests ==="
	@./test_league
	@echo ""
	@echo "=== Admin Tests ==="
	@./test_admin

test-db: test_db
	@./test_db

test-auth: test_auth
	@./test_auth

test-puzzle: test_puzzle
	@./test_puzzle

test-league: test_league
	@./test_league

test-admin: test_admin
	@./test_admin

# Download third-party dependencies
MONGOOSE_VERSION = master
MONGOOSE_URL = https://raw.githubusercontent.com/cesanta/mongoose/$(MONGOOSE_VERSION)
SQLITE_URL = https://www.sqlite.org/2024/sqlite-amalgamation-3450000.zip

deps:
	@echo "Downloading Mongoose HTTP library..."
	curl -sL -o src/mongoose.h $(MONGOOSE_URL)/mongoose.h
	curl -sL -o src/mongoose.c $(MONGOOSE_URL)/mongoose.c
	@echo "Downloading SQLite..."
	curl -sL $(SQLITE_URL) -o sqlite.zip
	unzip -q -o sqlite.zip
	mv sqlite-amalgamation-3450000/sqlite3.c sqlite-amalgamation-3450000/sqlite3.h src/
	rm -rf sqlite-amalgamation-3450000 sqlite.zip
	@echo "Done. Dependencies downloaded to src/"

.PHONY: all clean run run-prod seed deps test test-db test-auth test-puzzle test-league test-admin
