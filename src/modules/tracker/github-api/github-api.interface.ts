import type {
  GithubApiResponse,
  GitHubRelease,
  GitHubRepository,
} from './github.types.js';

export interface GithubApi {
  getRepository(
    owner: string,
    repo: string,
  ): Promise<GithubApiResponse<GitHubRepository>>;

  getLatestRepositoryRelease(
    owner: string,
    repo: string,
  ): Promise<GithubApiResponse<GitHubRelease>>;
}
