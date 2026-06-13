import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { SubscriptionServiceImplementation } from './subscription.service.js';
import { AppErrorTypesEnum } from '../../shared/utils/error-handling/errors/app.error.js';
import { NotificationTokenTypesEnum } from './tokens/token-types.enum.js';

import type { RepoRepository } from '../tracker/repository/repo-repository.interface.js';
import type {
  SubscriptionRepository,
  SubscriptionWithRepository,
} from './repository/subscription.repository.interface.js';
import type { NotificationTokensService } from './tokens/notification-tokens.service.interface.js';
import type { TrackerFacade } from '../tracker/tracker.facade.js';
import type { NotificationFacade } from '../notification/notification.facade.js';
import type { CacheService } from '../../shared/cache/cache.service.interface.js';
import type { GithubRepo } from '../tracker/repository/github-repo.types.js';
import type { Subscription } from './repository/subscription.types.js';
import type { NotificationTokenPayload } from './tokens/notification-tokens.types.js';

describe('SubscriptionService', () => {
  let service: SubscriptionServiceImplementation;

  let mockSubscriptionRepo: jest.Mocked<SubscriptionRepository>;
  let mockGithubRepo: jest.Mocked<RepoRepository>;
  let mockTracker: jest.Mocked<TrackerFacade>;
  let mockTokensService: jest.Mocked<NotificationTokensService>;
  let mockNotification: jest.Mocked<NotificationFacade>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockSubscriptionRepo = {
      createOne: jest.fn(),
      confirm: jest.fn(),
      findOneByRepoAndEmail: jest.fn(),
      deleteOne: jest.fn(),
      findByEmailWithRepo: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;

    mockGithubRepo = {
      findByName: jest.fn(),
      createOne: jest.fn(),
    } as unknown as jest.Mocked<RepoRepository>;

    mockTracker = {
      verifyRepository: jest.fn(),
    } as unknown as jest.Mocked<TrackerFacade>;

    mockTokensService = {
      generateConfirmToken: jest.fn(),
      validateToken: jest.fn(),
    } as unknown as jest.Mocked<NotificationTokensService>;

    mockNotification = {
      queueConfirmationEmail: jest.fn(),
    } as unknown as jest.Mocked<NotificationFacade>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    service = new SubscriptionServiceImplementation(
      mockSubscriptionRepo,
      mockGithubRepo,
      mockTracker,
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

    it('should create subscription and send email when repository already exists in DB', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce({
        id: mockRepoId,
        name: mockRepoFullName,
        lastSeenTag: null,
      } as GithubRepo);
      mockSubscriptionRepo.createOne.mockResolvedValueOnce({
        id: mockSubId,
        email: mockEmail,
        githubRepositoryId: mockRepoId,
        confirmed: false,
      } as Subscription);
      mockTokensService.generateConfirmToken.mockReturnValueOnce(mockToken);

      await service.subscribe(mockEmail, mockOwner, mockRepoName);

      expect(mockGithubRepo.findByName).toHaveBeenCalledWith(mockRepoFullName);
      expect(mockTracker.verifyRepository).not.toHaveBeenCalled();
      expect(mockGithubRepo.createOne).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.createOne).toHaveBeenCalledWith({
        email: mockEmail,
        githubRepositoryId: mockRepoId,
      });
      expect(mockTokensService.generateConfirmToken).toHaveBeenCalledWith(
        mockSubId,
      );
      expect(mockNotification.queueConfirmationEmail).toHaveBeenCalledWith(
        mockEmail,
        mockToken,
      );
    });

    it('should verify repository and create it if not found in DB', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce(null);
      mockTracker.verifyRepository.mockResolvedValueOnce();
      mockGithubRepo.createOne.mockResolvedValueOnce({
        id: mockRepoId,
        name: mockRepoFullName,
      } as GithubRepo);
      mockSubscriptionRepo.createOne.mockResolvedValueOnce({
        id: mockSubId,
        email: mockEmail,
        githubRepositoryId: mockRepoId,
      } as Subscription);
      mockTokensService.generateConfirmToken.mockReturnValueOnce(mockToken);

      await service.subscribe(mockEmail, mockOwner, mockRepoName);

      expect(mockTracker.verifyRepository).toHaveBeenCalledWith(
        mockOwner,
        mockRepoName,
      );
      expect(mockGithubRepo.createOne).toHaveBeenCalledWith({
        name: mockRepoFullName,
      });
    });

    it('should throw AppError if user is already subscribed', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce({
        id: mockRepoId,
      } as GithubRepo);
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
