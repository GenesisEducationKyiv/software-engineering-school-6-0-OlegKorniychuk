import type { GithubApi } from './github-api.interface.js';
import type {
  GithubApiResponse,
  GitHubRelease,
  GitHubRepository,
} from './github.types.js';
import {
  githubApiRequestsTotal,
  githubApiDurationSeconds,
} from '../../prometheus.js';

export class GithubApiImplementation implements GithubApi {
  private readonly baseUrl = 'https://api.github.com';
  private readonly headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Releases-API-Scanner',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  public async getRepository(
    owner: string,
    repo: string,
  ): Promise<GithubApiResponse<GitHubRepository>> {
    const start = Date.now();
    const endpoint = 'get_repository';
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
      method: 'GET',
      headers: this.headers,
    });
    const result = await this.handleResponse<GitHubRepository>(response);
    githubApiDurationSeconds.observe({ endpoint }, (Date.now() - start) / 1000);
    githubApiRequestsTotal.inc({
      endpoint,
      status: this.classifyStatus(result),
    });
    return result;
  }

  public async getLatestRepositoryRelease(
    owner: string,
    repo: string,
  ): Promise<GithubApiResponse<GitHubRelease>> {
    const start = Date.now();
    const endpoint = 'get_latest_release';
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/releases/latest`,
      {
        method: 'GET',
        headers: this.headers,
      },
    );
    const result = await this.handleResponse<GitHubRelease>(response);
    githubApiDurationSeconds.observe({ endpoint }, (Date.now() - start) / 1000);
    githubApiRequestsTotal.inc({
      endpoint,
      status: this.classifyStatus(result),
    });
    return result;
  }

  private async handleResponse<T>(
    response: Response,
  ): Promise<GithubApiResponse<T>> {
    if (response.ok) {
      const data = (await response.json()) as T;
      return { error: null, data };
    }

    return {
      error: {
        status: response.status,
        message: response.statusText,
        fullResponse: response,
      },
      data: null,
    };
  }

  private classifyStatus(result: GithubApiResponse<unknown>): string {
    if (!result.error) return 'success';
    const { status } = result.error;
    if (status === 404) return 'not_found';
    if (status === 403 || status === 429) return 'rate_limited';
    return 'error';
  }
}
