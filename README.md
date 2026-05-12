# Politikos

A real-time dashboard / viewport for U.S. elections — federal, state, and county. Built on top of the free [civicAPI](https://civicapi.org) data feed.

Data attribution: election data provided by [civicAPI](https://civicapi.org).

## What it is

A self-hosted single-pane election console that lets you:

- Watch every race in the country live (national + per-state map)
- Drill into a single race for candidates, vote share, % reporting, called/uncalled state
- Replay how a margin moved over the night with a time scrubber
- Filter by office type — federal, governor, state legislature, sheriff/DA/judge/school board, ballot measures
- See a live diff feed of "calls" and major margin swings as they happen
- Pin races to a personal watchlist

## Stack

- **Backend:** FastAPI + APScheduler + Postgres + Redis (pubsub)
- **Frontend:** React 18 + Vite + TypeScript + MapLibre GL + zustand
- **Deploy:** Docker Compose on Jetson behind Flotilla / Authelia (path-mounted at `/apps/politikos/`)

## Layout

```
backend/        FastAPI service + civicAPI poller
web/            Vite SPA
docs/
  spec.md           Full v1 spec
  data-model.md     Postgres schema
  civicapi-notes.md Endpoint inventory captured 2026-05-12
docker-compose.yml          Local dev
docker-compose.jetson.yml   Production overlay
```

## Status

🚧 v0 — scaffolding only. See [docs/spec.md](docs/spec.md) for the v1 plan.

## Quick start (local)

```powershell
cp .env.example .env
docker compose up --build
# api  → http://localhost:8090
# web  → http://localhost:5173
```
