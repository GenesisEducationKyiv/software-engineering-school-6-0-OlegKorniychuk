import type { GithubRepo } from '../../repositories/github-repo/github-repo.types.js';

export interface ReleaseCheckerService {
  checkAndUpdateRelease(repo: GithubRepo): Promise<string | null>;
}
