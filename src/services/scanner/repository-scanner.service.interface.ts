import type { GitHubRelease } from './github.types.js';

export interface RepositoryScanner {
  verifyRepository(owner: string, repo: string): Promise<void>;
  getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null>;
}
