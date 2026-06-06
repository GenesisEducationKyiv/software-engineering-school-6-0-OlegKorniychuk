import type { GithubApi } from './github-api.interface.js';
import type {
  GithubApiResponse,
  GitHubRelease,
  GitHubRepository,
} from './github.types.js';
import type { MetricsCollector } from '../../metrics-collector.js';

export class GithubApiImplementation implements GithubApi {
  private readonly baseUrl = 'https://api.github.com';
  private readonly headers: Record<string, string>;

  constructor(
    token: string,
    private readonly metrics: MetricsCollector,
  ) {
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
    return this.metrics.trackGithubApiCall('get_repository', async () => {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
        method: 'GET',
        headers: this.headers,
      });
      return this.handleResponse<GitHubRepository>(response);
    });
  }

  public async getLatestRepositoryRelease(
    owner: string,
    repo: string,
  ): Promise<GithubApiResponse<GitHubRelease>> {
    return this.metrics.trackGithubApiCall('get_latest_release', async () => {
      const response = await fetch(
        `${this.baseUrl}/repos/${owner}/${repo}/releases/latest`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );
      return this.handleResponse<GitHubRelease>(response);
    });
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
}
