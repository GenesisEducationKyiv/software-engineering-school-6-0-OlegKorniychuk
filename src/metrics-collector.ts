import { Counter, Histogram } from 'prom-client';
import type { GithubApiResponse } from './services/scanner/github.types.js';

export class MetricsCollector {
  private readonly httpRequestsTotal = new Counter<string>({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private readonly httpRequestDurationSeconds = new Histogram<string>({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  });

  private readonly emailJobsTotal = new Counter<string>({
    name: 'email_jobs_total',
    help: 'Total email jobs processed',
    labelNames: ['job_type', 'status'],
  });

  private readonly emailJobDurationSeconds = new Histogram<string>({
    name: 'email_job_duration_seconds',
    help: 'Email job processing duration in seconds',
    labelNames: ['job_type'],
    buckets: [0.05, 0.1, 0.5, 1, 2, 5],
  });

  private readonly scanRunsTotal = new Counter<string>({
    name: 'scan_runs_total',
    help: 'Total periodic scan runs',
    labelNames: ['status'],
  });

  private readonly scanDurationSeconds = new Histogram<string>({
    name: 'scan_duration_seconds',
    help: 'Periodic scan duration in seconds',
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
  });

  private readonly githubApiRequestsTotal = new Counter<string>({
    name: 'github_api_requests_total',
    help: 'Total GitHub API requests',
    labelNames: ['endpoint', 'status'],
  });

  private readonly githubApiDurationSeconds = new Histogram<string>({
    name: 'github_api_duration_seconds',
    help: 'GitHub API request duration in seconds',
    labelNames: ['endpoint'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  });

  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: string,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: statusCode };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  public async trackEmailJob<T>(
    jobType: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.trackOperation(
      this.emailJobsTotal,
      this.emailJobDurationSeconds,
      { job_type: jobType },
      fn,
      () => 'success',
    );
  }

  public async trackScanRun<T>(fn: () => Promise<T>): Promise<T> {
    return this.trackOperation(
      this.scanRunsTotal,
      this.scanDurationSeconds,
      {},
      fn,
      () => 'success',
    );
  }

  public async trackGithubApiCall<T>(
    endpoint: string,
    fn: () => Promise<GithubApiResponse<T>>,
  ): Promise<GithubApiResponse<T>> {
    return this.trackOperation<GithubApiResponse<T>>(
      this.githubApiRequestsTotal,
      this.githubApiDurationSeconds,
      { endpoint },
      fn,
      (result) => this.classifyGithubStatus(result),
    );
  }

  private async trackOperation<T>(
    counter: Counter<string>,
    histogram: Histogram<string>,
    baseLabels: Record<string, string>,
    fn: () => Promise<T>,
    getStatus: (result: T) => string,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      counter.inc({ ...baseLabels, status: getStatus(result) });
      return result;
    } catch (err) {
      counter.inc({ ...baseLabels, status: 'failed' });
      throw err;
    } finally {
      histogram.observe(baseLabels, (Date.now() - start) / 1000);
    }
  }

  private classifyGithubStatus<T>(result: GithubApiResponse<T>): string {
    if (!result.error) return 'success';
    const { status } = result.error;
    if (status === 404) return 'not_found';
    if (status === 403 || status === 429) return 'rate_limited';
    return 'error';
  }
}
