import type {
  SubscriptionRepository,
  SubscriptionWithRepository,
} from './repository/subscription.repository.interface.js';
import type { Subscription } from './repository/subscription.types.js';
import type { SubscriptionRepoRepository } from './repository/subscription-repo.repository.interface.js';
import type { CacheService } from '../../shared/cache/cache.service.interface.js';
import type { NotificationFacade } from '../notification/notification.facade.js';
import type { NotificationTokensService } from './tokens/notification-tokens.service.interface.js';
import type { SubscribeSagaRepository } from './saga/subscribe-saga.repository.interface.js';
import type { RepoCommandPublisher } from './saga/repo-command.publisher.js';
import { NotificationTokenTypesEnum } from './tokens/token-types.enum.js';
import type { SubscribeResult, SubscriptionService } from './subscription.service.interface.js';
import {
  AppError,
  AppErrorTypesEnum,
} from '../../shared/utils/error-handling/errors/app.error.js';

export class SubscriptionServiceImplementation implements SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly subscriptionRepoRepository: SubscriptionRepoRepository,
    private readonly sagaRepository: SubscribeSagaRepository,
    private readonly repoCommandPublisher: RepoCommandPublisher,
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
  ): Promise<SubscribeResult> {
    const repoFullName = `${owner}/${repositoryName}`;
    const localRepo = await this.subscriptionRepoRepository.findByName(repoFullName);

    if (localRepo) {
      const existingSubscription =
        await this.subscriptionRepository.findOneByRepoAndEmail(email, localRepo.id);

      if (existingSubscription)
        throw new AppError(
          AppErrorTypesEnum.entityExists,
          'This user is already subscribed to this repo',
          { entity: 'subscription' },
        );

      const subscription = await this.subscriptionRepository.createOne({
        email,
        githubRepositoryId: localRepo.id,
      });

      const confirmToken = this.tokensService.generateConfirmToken(subscription.id);
      await this.notification.queueConfirmationEmail(email, confirmToken);

      return { status: 'created' };
    }

    const saga = await this.sagaRepository.create({ email, repoName: repoFullName });
    await this.repoCommandPublisher.publishCreateRequested({
      sagaId: saga.id,
      owner,
      repoName: repositoryName,
    });

    return { status: 'pending', sagaId: saga.id };
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

  public async getConfirmedSubscribersByRepo(
    repoId: string,
  ): Promise<Subscription[]> {
    return await this.subscriptionRepository.findConfirmedByRepoId(repoId);
  }
}
