import type { GithubRepoRepository } from '../../repositories/github-repo/github-repo.repository.interface.js';
import type { GithubRepo } from '../../repositories/github-repo/github-repo.types.js';
import type { RepositoryScanner } from './repository-scanner.service.interface.js';
import type { ReleaseCheckerService } from './release-checker.service.interface.js';

export class ReleaseCheckerServiceImplementation implements ReleaseCheckerService {
  constructor(
    private readonly githubRepoRepository: GithubRepoRepository,
    private readonly repoScanner: RepositoryScanner,
  ) {}

  public async checkAndUpdateRelease(repo: GithubRepo): Promise<string | null> {
    const [owner, repoName] = repo.name.split('/');

    const latestRelease = await this.repoScanner.getLatestRelease(
      owner!,
      repoName!,
    );

    if (latestRelease && latestRelease.tag_name !== repo.lastSeenTag) {
      await this.githubRepoRepository.updateTag(
        repo.id,
        latestRelease.tag_name,
      );
      return latestRelease.tag_name;
    }

    return null;
  }
}
