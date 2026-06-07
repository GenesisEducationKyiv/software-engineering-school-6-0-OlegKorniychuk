import type { Logger } from 'pino';
import type { RepoRepository } from '../repository/repo-repository.interface.js';
import type { ReleaseCheckerService } from '../scanner/release-checker.service.interface.js';
import type { ReleasePublisher } from '../release-publisher.js';

export class ScanRunner {
  constructor(
    private readonly githubRepoRepository: RepoRepository,
    private readonly releaseChecker: ReleaseCheckerService,
    private readonly releasePublisher: ReleasePublisher,
    private readonly logger: Logger,
  ) {}

  public async runPeriodicScan(): Promise<void> {
    this.logger.info('[Scanner]: Starting periodic release scan...');

    const repos = await this.githubRepoRepository.findAll();
    let totalPublished = 0;

    for (const repo of repos) {
      try {
        const newReleaseTag =
          await this.releaseChecker.checkAndUpdateRelease(repo);

        if (newReleaseTag) {
          this.logger.info(
            `[Scanner]: Found new release for ${repo.name}: ${newReleaseTag}`,
          );

          await this.releasePublisher.publish(
            repo.id,
            repo.name,
            newReleaseTag,
          );
          totalPublished++;
        }
      } catch (error) {
        this.logger.error(
          { err: error, repo: repo.name },
          `[Scanner]: Failed to check repo`,
        );
      }
    }

    this.logger.info(
      { publishedEvents: totalPublished },
      `[Scanner]: Scan complete.`,
    );
  }
}
