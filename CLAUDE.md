# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # tsx watch — hot reload, no build step needed

# Build
npm run build            # tsc -p tsconfig.build.json → dist/

# Run (requires built dist/ and running Postgres + Redis)
npm start                # runs migrate then server

# Full stack via Docker
docker-compose up --build

# Database migrations (dev)
npm run migration:generate   # generate migration from schema changes
npm run migration:migrate    # apply migrations

# Lint / format
npm run lint
npm run format

# Tests
npm run test             # all three suites sequentially
npm run test:unit        # jest src/ (unit tests co-located with source)
npm run test:integration # jest tests/integration/ (Testcontainers — spins real Postgres + Redis + Mailpit)
npm run test:e2e         # Playwright tests/e2e/ (requires Chromium)

# Run a single Jest test file
cross-env NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest --testPathPattern="path/to/file.spec.ts"
```

## Architecture

**Stack:** Express 5 · TypeScript (ESM) · DrizzleORM · PostgreSQL · Redis · BullMQ · Nodemailer · Zod · Prometheus

### Request flow

```
HTTP → app.ts (morgan, json, static, error handler)
     → routes.ts (requireApiKey middleware on mutating routes)
     → subscription.controller.ts → subscription.service.ts
     → SubscriptionRepository (Drizzle/Postgres) + GithubRepoRepository
```

Public endpoints (`/confirm/:token`, `/unsubscribe/:token`) skip API key auth. All others require `x-api-key` header.

### Dependency injection

All instances are constructed once in `src/dependencies-container.ts` and exported. Nothing is instantiated at module level outside that file — this is intentional to prevent side-effects on import and to make mocking straightforward in tests.

### Background jobs (BullMQ + Redis)

Two BullMQ queues/workers:

- **Email worker** (`EmailWorker`) — sends confirmation and notification emails via Nodemailer. Handlers registered in `dependencies-container.ts`.

- **Scanner cron** (`ScannerCron`) — runs `ScanRunner.runPeriodicScan()` on a schedule. Scans all tracked repos, checks for new releases via GitHub API, dispatches email jobs for confirmed subscribers.

### Caching

Route-level Redis cache on `GET /api/subscriptions` via `routeCache` middleware. Cache is invalidated on subscribe/unsubscribe/confirm. Cache key is derived from the subscriber's email.

### Auth

`requireApiKey` middleware uses `crypto.timingSafeEqual` to compare the `x-api-key` header against `env.API_KEY`.

Subscription confirmation/unsubscribe use signed JWT tokens (`NotificationTokensService`), not the API key.

### Database schema

Two tables:

- `github_repositories` — tracked repos (`name` as `owner/repo`, `last_seen_tag`)
- `subscriptions` — `(email, github_repository_id)` unique pair, `confirmed` boolean

Migrations live in `drizzle/` and are applied automatically on `npm start` via `src/migrate.ts`.

### Error handling

Centralized in `src/utils/error-handling/`. `AppError` and `GithubApiError` are typed error classes; `handleError` middleware dispatches to the appropriate handler.

### Testing conventions

- **Unit tests** co-located in `src/` as `*.spec.ts`. Use Jest + manual mocks (no real DB/Redis).
- **Integration tests** in `tests/integration/`. Use Testcontainers to spin real Postgres, Redis, and Mailpit containers. GitHub API is mocked with MSW.
- **E2E tests** in `tests/e2e/`. Playwright drives Chromium against a local server started by `tests/e2e/server-runner.ts`.

### Environment variables

Required (not hardcoded in docker-compose):

- `GITHUB_TOKEN` — GitHub personal access token
- `EMAIL_SERVICE` / `EMAIL_SERVICE_USERNAME` / `EMAIL_SERVICE_PASSWORD` — Nodemailer config

Hardcoded in docker-compose for convenience:

- `API_KEY=secret-api-key`
- `DATABASE_URL`, `REDIS_URL`, `NOTIFICATION_TOKEN_SECRET`, `PORT`

All env vars are parsed and validated at startup via Zod in `src/config/envs.ts`.
