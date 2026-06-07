import type { Logger } from 'pino';
import type { RepoRepository } from '../repository/repo-repository.interface.js';
import type { ReleaseCheckerService } from '../scanner/release-checker.service.interface.js';
import type { NotificationFacade } from '../../notification/notification.facade.js';

export class ScanRunner {
  constructor(
    private readonly githubRepoRepository: RepoRepository,
    private readonly releaseChecker: ReleaseCheckerService,
    private readonly notification: NotificationFacade,
    private readonly logger: Logger,
  ) {}

  public async runPeriodicScan(): Promise<void> {
    this.logger.info('[Scanner]: Starting periodic release scan...');

    const repos = await this.githubRepoRepository.findAll();
    let totalEmailsQueued = 0;

    for (const repo of repos) {
      try {
        const newReleaseTag =
          await this.releaseChecker.checkAndUpdateRelease(repo);

        if (newReleaseTag) {
          this.logger.info(
            `[Scanner]: Found new release for ${repo.name}: ${newReleaseTag}`,
          );

          const queuedCount = await this.notification.dispatchToSubscribers(
            repo.id,
            repo.name,
            newReleaseTag,
          );

          totalEmailsQueued += queuedCount;
        }
      } catch (error) {
        this.logger.error(
          { err: error, repo: repo.name },
          `[Scanner]: Failed to check repo`,
        );
      }
    }

    this.logger.info(
      { queuedEmails: totalEmailsQueued },
      `[Scanner]: Scan complete.`,
    );
  }
}
