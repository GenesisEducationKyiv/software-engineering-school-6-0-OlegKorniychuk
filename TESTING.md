# Testing Instructions

This project includes a comprehensive test suite comprising Unit, Integration, and End-to-End (E2E) tests.

## Prerequisites

- **Node.js**: Version 20.x or higher.
- **Docker**: Required for Integration and E2E tests to run [Testcontainers](https://testcontainers.com/).
- **Dependencies**: Install project dependencies and Playwright browsers:

```bash
npm install
npx playwright install --with-deps chromium
```

## Running All Tests

To execute the entire test suite (Unit, Integration, and E2E), run:

```bash
npm test
```

## Test Types

### 1. Unit Tests

Unit tests are located in the `src/` directory and follow the `*.spec.ts` naming convention.

**Run unit tests:**

```bash
npm run test:unit
```

### 2. Integration Tests

Integration tests are written to test controller methods.

- **Infrastructure**: Uses Testcontainers to spin up isolated Postgres, Redis, and Mailpit instances.
- **API Mocking**: MSW (Mock Service Worker) is used to mock GitHub API responses.
- **Location**: `tests/integration/`

**Run integration tests:**

```bash
npm run test:integration
```

### 3. End-to-End (E2E) Tests

E2E tests validate app workflow through the static web interface.

- **Infrastructure**: Uses Testcontainers (Postgres, Redis, Mailpit) and Playwright's `webServer`.
- **Mocking**: Mirroring integration tests, MSW mocks the GitHub API.
- **Location**: `tests/e2e/`

**Run E2E tests:**

```bash
npm run test:e2e
```
