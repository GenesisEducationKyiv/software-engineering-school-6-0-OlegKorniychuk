import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { SubscriptionServiceImplementation } from './subscription.service.js';
import { AppErrorTypesEnum } from '../../utils/error-handling/errors/app.error.js';
import { NotificationTokenTypesEnum } from '../../services/notification-tokens-service/token-types.enum.js';

import type { GithubRepoRepository } from '../../repositories/github-repo/github-repo.repository.interface.js';
import type {
  SubscriptionRepository,
  SubscriptionWithRepository,
} from '../../repositories/subscription/subscription.repository.interface.js';
import type { NotificationTokensService } from '../../services/notification-tokens-service/notification-tokens.service.interface.js';
import type { RepositoryScanner } from '../../services/scanner/repository-scanner.service.interface.js';
import type { EmailQueueClient } from '../../services/email-queue/email-queue.service.interface.js';
import type { CacheService } from '../../services/cache/cache.service.interface.js';
import type { GithubRepo } from '../../repositories/github-repo/github-repo.types.js';
import type { Subscription } from '../../repositories/subscription/subscription.types.js';
import type { NotificationTokenPayload } from '../../services/notification-tokens-service/notification-tokens.types.js';

describe('SubscriptionService', () => {
  let service: SubscriptionServiceImplementation;

  let mockSubscriptionRepo: jest.Mocked<SubscriptionRepository>;
  let mockGithubRepo: jest.Mocked<GithubRepoRepository>;
  let mockRepoScanner: jest.Mocked<RepositoryScanner>;
  let mockTokensService: jest.Mocked<NotificationTokensService>;
  let mockEmailQueue: jest.Mocked<EmailQueueClient>;
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
    } as unknown as jest.Mocked<GithubRepoRepository>;

    mockRepoScanner = {
      verifyRepository: jest.fn(),
    } as unknown as jest.Mocked<RepositoryScanner>;

    mockTokensService = {
      generateConfirmToken: jest.fn(),
      validateToken: jest.fn(),
    } as unknown as jest.Mocked<NotificationTokensService>;

    mockEmailQueue = {
      queueConfirmationEmail: jest.fn(),
      queueNotificationEmail: jest.fn(),
    } as unknown as jest.Mocked<EmailQueueClient>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    service = new SubscriptionServiceImplementation(
      mockSubscriptionRepo,
      mockGithubRepo,
      mockRepoScanner,
      mockTokensService,
      mockEmailQueue,
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
      expect(mockRepoScanner.verifyRepository).not.toHaveBeenCalled();
      expect(mockGithubRepo.createOne).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.createOne).toHaveBeenCalledWith({
        email: mockEmail,
        githubRepositoryId: mockRepoId,
      });
      expect(mockTokensService.generateConfirmToken).toHaveBeenCalledWith(
        mockSubId,
      );
      expect(mockEmailQueue.queueConfirmationEmail).toHaveBeenCalledWith({
        email: mockEmail,
        token: mockToken,
      });
    });

    it('should verify repository and create it if not found in DB', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce(null);
      mockRepoScanner.verifyRepository.mockResolvedValueOnce();
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

      expect(mockRepoScanner.verifyRepository).toHaveBeenCalledWith(
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
