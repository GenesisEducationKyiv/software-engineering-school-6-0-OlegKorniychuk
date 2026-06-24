import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { SubscriptionServiceImplementation } from './subscription.service.js';
import { AppErrorTypesEnum } from '../../shared/utils/error-handling/errors/app.error.js';
import { NotificationTokenTypesEnum } from './tokens/token-types.enum.js';

import type { SubscriptionRepoRepository } from './repository/subscription-repo.repository.interface.js';
import type {
  SubscriptionRepository,
  SubscriptionWithRepository,
} from './repository/subscription.repository.interface.js';
import type { NotificationTokensService } from './tokens/notification-tokens.service.interface.js';
import type { INotificationFacade } from '../notification/notification.facade.interface.js';
import type { CacheService } from '../../shared/cache/cache.service.interface.js';
import type { SubscriptionRepo } from './repository/subscription-repo.types.js';
import type { Subscription } from './repository/subscription.types.js';
import type { NotificationTokenPayload } from './tokens/notification-tokens.types.js';
import type { SubscribeSagaRepository } from './saga/subscribe-saga.repository.interface.js';
import type { RepoCommandPublisher } from './saga/repo-command.publisher.js';
import type { SubscribeSaga } from './saga/subscribe-saga.types.js';

describe('SubscriptionService', () => {
  let service: SubscriptionServiceImplementation;

  let mockSubscriptionRepo: jest.Mocked<SubscriptionRepository>;
  let mockSubscriptionRepoRepo: jest.Mocked<SubscriptionRepoRepository>;
  let mockSagaRepository: jest.Mocked<SubscribeSagaRepository>;
  let mockRepoCommandPublisher: jest.Mocked<RepoCommandPublisher>;
  let mockTokensService: jest.Mocked<NotificationTokensService>;
  let mockNotification: jest.Mocked<INotificationFacade>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockSubscriptionRepo = {
      createOne: jest.fn(),
      confirm: jest.fn(),
      findOneByRepoAndEmail: jest.fn(),
      deleteOne: jest.fn(),
      findByEmailWithRepo: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;

    mockSubscriptionRepoRepo = {
      findByName: jest.fn(),
      findById: jest.fn(),
      createOne: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepoRepository>;

    mockSagaRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAwaitingByRepoName: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<SubscribeSagaRepository>;

    mockRepoCommandPublisher = {
      publishCreateRequested: jest.fn(),
    } as unknown as jest.Mocked<RepoCommandPublisher>;

    mockTokensService = {
      generateConfirmToken: jest.fn(),
      validateToken: jest.fn(),
    } as unknown as jest.Mocked<NotificationTokensService>;

    mockNotification = {
      queueConfirmationEmail: jest.fn(),
    } as unknown as jest.Mocked<INotificationFacade>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    service = new SubscriptionServiceImplementation(
      mockSubscriptionRepo,
      mockSubscriptionRepoRepo,
      mockSagaRepository,
      mockRepoCommandPublisher,
      mockTokensService,
      mockNotification,
      mockCacheService,
    );
  });

  describe('subscribe', () => {
    const mockEmail = 'test@example.com';
    const mockOwner = 'golang';
    const mockRepoName = 'go';
    const mockRepoFullName = 'golang/go';
    const mockRepoId = 'repo-uuid-123';
    const mockSubId = 'sub-uuid-456';
    const mockToken = 'mock-jwt-token';
    const mockSagaId = 'saga-uuid-789';

    it('should create subscription synchronously when repo exists locally', async () => {
      mockSubscriptionRepoRepo.findByName.mockResolvedValueOnce({
        id: mockRepoId,
        name: mockRepoFullName,
      } as SubscriptionRepo);
      mockSubscriptionRepo.findOneByRepoAndEmail.mockResolvedValueOnce(null);
      mockSubscriptionRepo.createOne.mockResolvedValueOnce({
        id: mockSubId,
        email: mockEmail,
        githubRepositoryId: mockRepoId,
        confirmed: false,
      } as Subscription);
      mockTokensService.generateConfirmToken.mockReturnValueOnce(mockToken);

      const result = await service.subscribe(
        mockEmail,
        mockOwner,
        mockRepoName,
      );

      expect(result).toEqual({ status: 'created' });
      expect(mockSubscriptionRepoRepo.findByName).toHaveBeenCalledWith(
        mockRepoFullName,
      );
      expect(mockSubscriptionRepo.createOne).toHaveBeenCalledWith({
        email: mockEmail,
        githubRepositoryId: mockRepoId,
      });
      expect(mockNotification.queueConfirmationEmail).toHaveBeenCalledWith(
        mockEmail,
        mockToken,
      );
      expect(mockSagaRepository.create).not.toHaveBeenCalled();
    });

    it('should start saga and return pending when repo not in local copy', async () => {
      mockSubscriptionRepoRepo.findByName.mockResolvedValueOnce(null);
      mockSagaRepository.create.mockResolvedValueOnce({
        id: mockSagaId,
        email: mockEmail,
        repoName: mockRepoFullName,
        status: 'awaiting_repo',
        failureReason: null,
        createdAt: new Date(),
      } as SubscribeSaga);

      const result = await service.subscribe(
        mockEmail,
        mockOwner,
        mockRepoName,
      );

      expect(result).toEqual({ status: 'pending', sagaId: mockSagaId });
      expect(mockSagaRepository.create).toHaveBeenCalledWith({
        email: mockEmail,
        repoName: mockRepoFullName,
      });
      expect(
        mockRepoCommandPublisher.publishCreateRequested,
      ).toHaveBeenCalledWith({
        sagaId: mockSagaId,
        owner: mockOwner,
        repoName: mockRepoName,
      });
      expect(mockSubscriptionRepo.createOne).not.toHaveBeenCalled();
    });

    it('should throw AppError if user is already subscribed (repo known locally)', async () => {
      mockSubscriptionRepoRepo.findByName.mockResolvedValueOnce({
        id: mockRepoId,
        name: mockRepoFullName,
      } as SubscriptionRepo);
      mockSubscriptionRepo.findOneByRepoAndEmail.mockResolvedValueOnce({
        id: 'existing-sub',
      } as Subscription);

      await expect(
        service.subscribe(mockEmail, mockOwner, mockRepoName),
      ).rejects.toThrow(
        expect.objectContaining({
          type: AppErrorTypesEnum.entityExists,
          message: 'This user is already subscribed to this repo',
        }),
      );
    });
  });

  describe('confirmSubscription', () => {
    const mockToken = 'valid-token';
    const mockSubId = 'sub-id';
    const mockEmail = 'user@example.com';

    it('should confirm subscription and clear cache', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.confirm,
      } as NotificationTokenPayload);

      mockSubscriptionRepo.confirm.mockResolvedValueOnce({
        email: mockEmail,
      } as Subscription);

      await service.confirmSubscription(mockToken);

      expect(mockSubscriptionRepo.confirm).toHaveBeenCalledWith(mockSubId);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        service.getCacheKey(mockEmail),
      );
    });

    it('should throw error if token is invalid', async () => {
      mockTokensService.validateToken.mockReturnValueOnce(null);

      await expect(service.confirmSubscription(mockToken)).rejects.toThrow(
        expect.objectContaining({
          type: AppErrorTypesEnum.invalidNotificationToken,
        }),
      );
    });

    it('should throw error if subscription not found during confirmation', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.confirm,
      } as NotificationTokenPayload);
      mockSubscriptionRepo.confirm.mockResolvedValueOnce(null);

      await expect(service.confirmSubscription(mockToken)).rejects.toThrow(
        expect.objectContaining({
          type: AppErrorTypesEnum.invalidNotificationToken,
        }),
      );
    });
  });

  describe('unsubscribe', () => {
    const mockToken = 'unsub-token';
    const mockSubId = 'sub-id';
    const mockEmail = 'user@example.com';

    it('should delete subscription and clear cache', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.unsibscribe,
      } as NotificationTokenPayload);

      mockSubscriptionRepo.deleteOne.mockResolvedValueOnce({
        email: mockEmail,
      } as Subscription);

      await service.unsubscribe(mockToken);

      expect(mockSubscriptionRepo.deleteOne).toHaveBeenCalledWith(mockSubId);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        service.getCacheKey(mockEmail),
      );
    });

    it('should throw error if unsubscribe token is invalid', async () => {
      mockTokensService.validateToken.mockReturnValueOnce(null);

      await expect(service.unsubscribe(mockToken)).rejects.toThrow(
        expect.objectContaining({
          type: AppErrorTypesEnum.invalidNotificationToken,
        }),
      );
    });
  });

  describe('getSubscriptions', () => {
    const mockEmail = 'user@example.com';

    it('should return user subscriptions from repository', async () => {
      const mockSubscriptions: SubscriptionWithRepository[] = [
        {
          id: 'sub1',
          email: mockEmail,
          githubRepositoryId: 'repo1',
          confirmed: true,
          githubRepository: { id: 'repo1', name: 'org/repo1' },
        } as unknown as SubscriptionWithRepository,
      ];

      mockSubscriptionRepo.findByEmailWithRepo.mockResolvedValueOnce(
        mockSubscriptions,
      );

      const result = await service.getSubscriptions(mockEmail);

      expect(mockSubscriptionRepo.findByEmailWithRepo).toHaveBeenCalledWith(
        mockEmail,
      );
      expect(result).toEqual(mockSubscriptions);
    });

    it('should return an empty array if the user has no subscriptions', async () => {
      mockSubscriptionRepo.findByEmailWithRepo.mockResolvedValueOnce([]);

      const result = await service.getSubscriptions(mockEmail);

      expect(mockSubscriptionRepo.findByEmailWithRepo).toHaveBeenCalledWith(
        mockEmail,
      );
      expect(result).toEqual([]);
    });
  });
});
