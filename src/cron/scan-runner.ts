import type { GithubRepoRepository } from '../repositories/github-repo/github-repo.repository.interface.js';
import type { ReleaseCheckerService } from '../services/scanner/release-checker.service.interface.js';
import type { NotificationDispatcher } from '../services/notifier/notification-dispatcher.interface.js';

export class ScanRunner {
  constructor(
    private readonly githubRepoRepository: GithubRepoRepository,
    private readonly releaseChecker: ReleaseCheckerService,
    private readonly notificationDispatcher: NotificationDispatcher,
  ) {}

  public async runPeriodicScan(): Promise<void> {
    console.log('[Scanner]: Starting periodic release scan...');

    const repos = await this.githubRepoRepository.findAll();
    let totalEmailsQueued = 0;

    for (const repo of repos) {
      try {
        const newReleaseTag =
          await this.releaseChecker.checkAndUpdateRelease(repo);

        if (newReleaseTag) {
          console.log(
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
        console.error(`[Scanner]: Failed to check ${repo.name}`, error);
      }
    }

    console.log(
      `[Scanner]: Scan complete. Queued ${totalEmailsQueued} individual notification emails.`,
    );
  }
}
