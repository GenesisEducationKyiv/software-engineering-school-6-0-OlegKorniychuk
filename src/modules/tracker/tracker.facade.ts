import {
  GithubApiError,
  GithubApiErrorTypesEnum,
} from '../../shared/utils/error-handling/errors/github-api.error.js';

type TrackerErrorBody = {
  type: string;
  message: string;
  retryAfterMs?: number;
};

export class TrackerFacade {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  public async verifyRepository(owner: string, repo: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/verify`,
      { headers: { 'x-api-key': this.apiKey } },
    );

    if (response.ok) return;

    const body = (await response.json()) as TrackerErrorBody;

    if (response.status === 404) {
      throw new GithubApiError(GithubApiErrorTypesEnum.notFound, body.message, {
        entity: 'repository',
      });
    }

    if (response.status === 429) {
      throw new GithubApiError(
        GithubApiErrorTypesEnum.rateLimitExceeded,
        body.message,
        { retryAfterMs: body.retryAfterMs },
      );
    }

    throw new GithubApiError(
      GithubApiErrorTypesEnum.other,
      body.message ?? `Tracker error ${response.status}`,
      { status: response.status },
    );
  }
}
