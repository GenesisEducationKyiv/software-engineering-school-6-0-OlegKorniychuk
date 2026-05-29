import client, { Counter, Histogram } from 'prom-client';
import type { Express } from 'express';

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const emailJobsTotal = new Counter({
  name: 'email_jobs_total',
  help: 'Total email jobs processed',
  labelNames: ['job_type', 'status'],
});

export const emailJobDurationSeconds = new Histogram({
  name: 'email_job_duration_seconds',
  help: 'Email job processing duration in seconds',
  labelNames: ['job_type'],
  buckets: [0.05, 0.1, 0.5, 1, 2, 5],
});

export const scanRunsTotal = new Counter({
  name: 'scan_runs_total',
  help: 'Total periodic scan runs',
  labelNames: ['status'],
});

export const scanDurationSeconds = new Histogram({
  name: 'scan_duration_seconds',
  help: 'Periodic scan duration in seconds',
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
});

export const githubApiRequestsTotal = new Counter({
  name: 'github_api_requests_total',
  help: 'Total GitHub API requests',
  labelNames: ['endpoint', 'status'],
});

export const githubApiDurationSeconds = new Histogram({
  name: 'github_api_duration_seconds',
  help: 'GitHub API request duration in seconds',
  labelNames: ['endpoint'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export function startPrometheus(app: Express) {
  client.collectDefaultMetrics();

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
}
