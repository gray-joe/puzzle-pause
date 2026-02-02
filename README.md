# Daily Puzzle App

A lightweight daily puzzle web application with a C backend, htmx frontend, and SQLite database.

## Prerequisites

- C compiler (clang or gcc)
- make
- curl (for downloading dependencies)

## Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd daily_puzzle_app
   ```

2. Download dependencies:
   ```bash
   make deps
   ```
   This downloads the [Mongoose](https://github.com/cesanta/mongoose) HTTP library.

3. Build the server:
   ```bash
   make
   ```

4. Run the server:
   ```bash
   ./puzzle_server
   ```
   The server will start on http://localhost:8080

## Development

- `make` - Build the server
- `make run` - Build and run
- `make clean` - Remove build artifacts
- `make deps` - Download third-party dependencies

## Project Structure

```
daily_puzzle_app/
├── src/
│   ├── main.c         # Server entry point and routing
│   ├── mongoose.c     # HTTP library (downloaded)
│   └── mongoose.h     # HTTP library headers (downloaded)
├── static/            # Static files (CSS, JS)
├── Makefile
├── SPEC.md            # Full specification
└── CLAUDE.md          # AI assistant instructions
```

## Tech Stack

- **Backend**: C with Mongoose HTTP library
- **Frontend**: HTML + htmx
- **Database**: SQLite
- **Deployment**: fly.io
