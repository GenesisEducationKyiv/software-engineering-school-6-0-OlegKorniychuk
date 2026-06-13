import type { GithubRepo } from '../repository/github-repo.types.js';

export interface ReleaseCheckerService {
  checkAndUpdateRelease(repo: GithubRepo): Promise<string | null>;
}
