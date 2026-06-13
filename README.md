# GitHub Release Notification API

This repository contains a RESTful API built with Node.js and Express that allows users to subscribe to email notifications for new GitHub repository releases.

# Hosted Instance

Hosted application is available at <https://github-releases-api.duckdns.org/>

## Startup Instructions

### Prerequisites

- Docker and Docker Compose
- Node.js v20+ (for local development and testing)

### Configuration

1. Create a `.env` file in the root directory based on the provided `.env.example`.
2. You must provide your own credentials for the following variables in the `.env` file:
   GITHUB_TOKEN=your_personal_access_token
   EMAIL_SERVICE=Gmail
   EMAIL_SERVICE_USERNAME=<your_email@gmail.com>
   EMAIL_SERVICE_PASSWORD=your_app_password

_(Note: Some infrastructure variables are hardcoded in the docker-compose.yml environment block to simplify the evaluation process. The default API key for is secret-api-key)._

### Running the Application

To start the entire system (Database, Redis, and the API), run:

```console
docker-compose up --build
```

The database migrations will automatically execute on application startup. API will be available at <http://localhost:3000>. Protected endpoints require x-api-key header.

### Running Tests

To run the unit test suite locally:

```console
npm install
npm test
```

## Requirements Met

### Core Requirements

- **API Contracts:** Adheres to the provided swagger definitions.
- **Architecture:** Implemented as a monolith using Express.js.
- **Database:** PostgreSQL + DrizzleORM used for data storage. Migrations run on service startup.
- **Dockerized:** Fully runnable via docker-compose.yml and a multi-stage Dockerfile.
- **Scanning & Notifications:** Regularly checks for new releases using background workers. Updates last_seen_tag and sends email notifications on new releases.
- **Validation:** Validates repository format (owner/repo) and verifies existence via the GitHub API.
- **Rate Limiting:** Handles 429 errors correctly.
- **Testing:** Comprehensive unit tests for business logic.

### Extras Implemented

- **Publicly Hosted**: Added a simple HTML UI and hosted using Oracle OCI. UI available at <https://github-releases-api.duckdns.org/>
- **Redis Caching:** Route-level caching implemented for GET /api/subscriptions with invalidation upon subscription state changes.
- **API Key Authentication:** Protected endpoints require an x-api-key header.
- **Prometheus Metrics:** Basic service indicators exposed via a standard /metrics endpoint.
- **CI:** GitHub Action CI pipeline set up to run tests, linter and prettier checks on every PR.

## Important Features & Architectural Decisions

- **Background Processing with BullMQ:** Sending emails and scheduled GitHub scanning are offloaded to asynchronous background worker queues. This prevents event loop blocks, ensures short response time, adn allows for scaling.
- **Dependency Injection:** All modules are loosely coupled and have injected dependencies which are instantiated in a single file. This prevents side-effects on import and allows for robust mocking during tests.
- **Environment Validation:** Environment variables are parsed and validated on startup using Zod.
- **Timing-Safe Authentication:** The API key middleware uses Node's native crypto.timingSafeEqual to prevent timing attacks.
- **Robust Error Handling:** Application and unexpected errors are being handled in a centralized way.

## Necessary Improvements _(that I did not have time and/or energy to make)_

- **Improve Logging:** Currently used console.log calls should be replaced by a dedicated logger, capable of JSON loggin for aggregation, like Winston.
- **Tidy Up File Structure:** Current file structure will not hold up to scaling and should be revised.
- **Rewrite Cron Processor:** Current implementation does not allow to add other scheduled jobs & workers in future.
- **Batch Email Processing:** For production level scaling emails should be batched or sent via a bulk-email provider API (like SendGrid or AWS SES) instead of single SMTP handshakes via Nodemailer.
- **Integration Tests:** Implement automated end-to-end tests using Supertest and Testcontainers to verify the entire flow from HTTP request to database insertion and Redis queuing.
