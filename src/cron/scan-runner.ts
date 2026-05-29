import type { Logger } from 'pino';
import type { RepoRepository } from '../repositories/repo-repository.interface.js';
import type { ReleaseCheckerService } from '../services/scanner/release-checker.service.interface.js';
import type { NotificationDispatcher } from '../services/notifier/notification-dispatcher.interface.js';

export class ScanRunner {
  constructor(
    private readonly githubRepoRepository: RepoRepository,
    private readonly releaseChecker: ReleaseCheckerService,
    private readonly notificationDispatcher: NotificationDispatcher,
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

          const queuedCount =
            await this.notificationDispatcher.dispatchNotifications(
              repo.id,
              repo.name,
              newReleaseTag,
            );

          totalEmailsQueued += queuedCount;
        }
      } catch (error) {
        this.logger.error(
          { err: error },
          `[Scanner]: Failed to check ${repo.name}`,
        );
      }
    }

    this.logger.info(
      `[Scanner]: Scan complete. Queued ${totalEmailsQueued} individual notification emails.`,
    );
  }
}
