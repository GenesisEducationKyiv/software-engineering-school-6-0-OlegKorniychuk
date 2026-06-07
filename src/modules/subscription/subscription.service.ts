import type { RepoRepository } from '../tracker/repository/repo-repository.interface.js';
import type {
  SubscriptionRepository,
  SubscriptionWithRepository,
} from '../../repositories/subscription/subscription.repository.interface.js';
import type { CacheService } from '../../shared/cache/cache.service.interface.js';
import type { NotificationFacade } from '../notification/notification.facade.js';
import type { NotificationTokensService } from '../../services/notification-tokens-service/notification-tokens.service.interface.js';
import { NotificationTokenTypesEnum } from '../../services/notification-tokens-service/token-types.enum.js';
import type { TrackerFacade } from '../tracker/tracker.facade.js';
import {
  AppError,
  AppErrorTypesEnum,
} from '../../shared/utils/error-handling/errors/app.error.js';
import type { SubscriptionService } from './subscription.service.interface.js';

export class SubscriptionServiceImplementation implements SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly githubRepoRepository: RepoRepository,
    private readonly tracker: TrackerFacade,
    private readonly tokensService: NotificationTokensService,
    private readonly notification: NotificationFacade,
    private readonly cacheService: CacheService,
  ) {}

  public getCacheKey(email: string): string {
    return `cache:subscriptions:${email}`;
  }

  public async subscribe(
    email: string,
    owner: string,
    repositoryName: string,
  ): Promise<void> {
    const repoFullName = `${owner}/${repositoryName}`;
    let repo = await this.githubRepoRepository.findByName(repoFullName);

    if (!repo) {
      await this.tracker.verifyRepository(owner, repositoryName);
      repo = await this.githubRepoRepository.createOne({ name: repoFullName });
    } else {
      const existingSubscription =
        await this.subscriptionRepository.findOneByRepoAndEmail(email, repo.id);

      if (existingSubscription)
        throw new AppError(
          AppErrorTypesEnum.entityExists,
          'This user is already subscribed to this repo',
          { entity: 'subscription' },
        );
    }

    const subscription = await this.subscriptionRepository.createOne({
      email,
      githubRepositoryId: repo.id,
    });

    const confirmToken = this.tokensService.generateConfirmToken(
      subscription.id,
    );

    await this.notification.queueConfirmationEmail(email, confirmToken);
  }

  public async confirmSubscription(token: string): Promise<void> {
    const tokenPayload = this.tokensService.validateToken(
      token,
      NotificationTokenTypesEnum.confirm,
    );

    if (!tokenPayload)
      throw new AppError(
        AppErrorTypesEnum.invalidNotificationToken,
        'Invalid confirmation token',
      );

    const confirmedSubscription = await this.subscriptionRepository.confirm(
      tokenPayload.subscriptionId,
    );

    if (!confirmedSubscription)
      throw new AppError(
        AppErrorTypesEnum.invalidNotificationToken,
        'Invalid confirmation token',
      );

    await this.cacheService.del(this.getCacheKey(confirmedSubscription.email));
  }

  public async unsubscribe(token: string): Promise<void> {
    const tokenPayload = this.tokensService.validateToken(
      token,
      NotificationTokenTypesEnum.unsibscribe,
    );

    if (!tokenPayload)
      throw new AppError(
        AppErrorTypesEnum.invalidNotificationToken,
        'Invalid unsubscription token',
      );

    const deletedSubscription = await this.subscriptionRepository.deleteOne(
      tokenPayload.subscriptionId,
    );

    if (!deletedSubscription)
      throw new AppError(
        AppErrorTypesEnum.entityNotFound,
        'Subscription not found',
      );

    await this.cacheService.del(this.getCacheKey(deletedSubscription.email));
  }

  public async getSubscriptions(
    email: string,
  ): Promise<SubscriptionWithRepository[]> {
    return await this.subscriptionRepository.findByEmailWithRepo(email);
  }
}
