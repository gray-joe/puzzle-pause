FROM alpine:3.19 AS builder

RUN apk add --no-cache gcc musl-dev make

WORKDIR /app
COPY src/ src/
COPY Makefile .

RUN make

FROM alpine:3.19

RUN apk add --no-cache sqlite curl

WORKDIR /app

COPY --from=builder /app/puzzle_server .

COPY data/seed_puzzles.sql data/

# The data directory will be mounted as a persistent volume
# fly.toml mounts puzzle_data volume to /app/data

EXPOSE 8080

CMD ["./puzzle_server"]
