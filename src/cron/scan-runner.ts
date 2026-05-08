import type { GithubRepoRepository } from '../repositories/github-repo/github-repo.repository.js';
import type { SubscriptionRepository } from '../repositories/subscription/subscription.repository.js';
import type { EmailQueueClient } from '../services/email-queue/email-queue.service.js';
import type { NotificationTokensService } from '../services/notification-tokens-service/notification-tokens.service.js';
import type { RepositoryScanner } from '../services/scanner/repository-scanner.service.js';

export class ScanRunner {
  constructor(
    private readonly githubRepoRepository: GithubRepoRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly repoScanner: RepositoryScanner,
    private readonly tokensService: NotificationTokensService,
    private readonly emailQueue: EmailQueueClient,
  ) {}

  public async runPeriodicScan(): Promise<void> {
    console.log('[Scanner]: Starting periodic release scan...');

    const repos = await this.githubRepoRepository.findAll();
    let emailsQueued = 0;

    for (const repo of repos) {
      try {
        const [owner, repoName] = repo.name.split('/');

        const latestRelease = await this.repoScanner.getLatestRelease(
          owner!,
          repoName!,
        );

        if (latestRelease && latestRelease.tag_name !== repo.lastSeenTag) {
          console.log(
            `[Scanner]: Found new release for ${repo.name}: ${latestRelease.tag_name}`,
          );

          await this.githubRepoRepository.updateTag(
            repo.id,
            latestRelease.tag_name,
          );

          const subscriptions =
            await this.subscriptionRepo.findConfirmedByRepoId(repo.id);

          for (const sub of subscriptions) {
            const token = this.tokensService.generateUnsubscribeToken(sub.id);

            await this.emailQueue.queueNotificationEmail({
              email: sub.email,
              token: token,
              repo: repo.name,
              release: latestRelease.tag_name,
            });
            emailsQueued++;
          }
        }
      } catch (error) {
        console.error(`[Scanner]: Failed to check ${repo.name}`, error);
      }
    }

    console.log(
      `[Scanner]: Scan complete. Queued ${emailsQueued} individual notification emails.`,
    );
  }
}
