import type { GithubRepo } from '../../repositories/github-repo/github-repo.types.js';
import type { RepositoryScanner } from './repository-scanner.service.interface.js';
import type { ReleaseCheckerService } from './release-checker.service.interface.js';
import type { RepoRepository } from '../../repositories/repo-repository.interface.js';

export class ReleaseCheckerServiceImplementation implements ReleaseCheckerService {
  constructor(
    private readonly githubRepoRepository: RepoRepository,
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
