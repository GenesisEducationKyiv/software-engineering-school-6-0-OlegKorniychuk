import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { SubscriptionService } from './subscription.service.js';
import { AppErrorTypesEnum } from '../../utils/error-handling/errors/app.error.js';
import { NotificationTokenTypesEnum } from '../../services/notification-tokens-service/token-types.enum.js';

import type { GithubRepoRepository } from '../../repositories/github-repo/github-repo.repository.js';
import type { SubscriptionRepository } from '../../repositories/subscription/subscription.repository.js';
import type { NotificationTokensService } from '../../services/notification-tokens-service/notification-tokens.service.js';
import type { RepositoryScanner } from '../../services/scanner/repository-scanner.service.js';
import type { EmailQueueClient } from '../../services/email-queue/email-queue.service.js';
import type { CacheService } from '../../services/cache/cache.service.js';
import type { GithubRepo } from '../../repositories/github-repo/github-repo.types.js';
import type {
  Subscription,
  SubscriptionWithRepository,
} from '../../repositories/subscription/subscription.types.js';
import type { NotificationTokenPayload } from '../../services/notification-tokens-service/notification-tokens.types.js';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

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

    service = new SubscriptionService(
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

    it('should throw AppError if repository exists and user is already subscribed', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce({
        id: mockRepoId,
        name: mockRepoFullName,
        lastSeenTag: null,
      } as GithubRepo);
      mockSubscriptionRepo.findOneByRepoAndEmail.mockResolvedValueOnce({
        id: mockSubId,
        email: mockEmail,
        githubRepositoryId: mockRepoId,
        confirmed: true,
      } as Subscription);

      await expect(
        service.subscribe(mockEmail, mockOwner, mockRepoName),
      ).rejects.toMatchObject({
        type: AppErrorTypesEnum.entityExists,
        message: 'This user is already subscribed to this repo',
      });

      expect(mockSubscriptionRepo.findOneByRepoAndEmail).toHaveBeenCalledWith(
        mockEmail,
        mockRepoId,
      );
      expect(mockSubscriptionRepo.createOne).not.toHaveBeenCalled();
      expect(mockTokensService.generateConfirmToken).not.toHaveBeenCalled();
      expect(mockEmailQueue.queueConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should verify with GitHub and save repo when repository does NOT exist in DB', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce(null);
      mockRepoScanner.verifyRepository.mockResolvedValueOnce(undefined);
      mockGithubRepo.createOne.mockResolvedValueOnce({
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

      expect(mockRepoScanner.verifyRepository).toHaveBeenCalledWith(
        mockOwner,
        mockRepoName,
      );
      expect(mockGithubRepo.createOne).toHaveBeenCalledWith({
        name: mockRepoFullName,
      });
    });

    it('should propagate errors if GitHub verification fails', async () => {
      mockGithubRepo.findByName.mockResolvedValueOnce(null);
      mockRepoScanner.verifyRepository.mockRejectedValueOnce(
        new Error('GitHub API Error: 404'),
      );

      await expect(
        service.subscribe(mockEmail, mockOwner, mockRepoName),
      ).rejects.toThrow('GitHub API Error: 404');

      expect(mockGithubRepo.createOne).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.createOne).not.toHaveBeenCalled();
    });
  });

  describe('confirmSubscription', () => {
    const mockToken = 'valid.jwt.token';
    const mockSubId = 'sub-uuid-123';

    it('should successfully confirm subscription if token is valid', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.confirm,
      } as NotificationTokenPayload);
      mockSubscriptionRepo.confirm.mockResolvedValueOnce({
        id: mockSubId,
        email: 'test@example.com',
        githubRepositoryId: 'repo-123',
        confirmed: true,
      } as Subscription);

      await service.confirmSubscription(mockToken);

      expect(mockTokensService.validateToken).toHaveBeenCalledWith(
        mockToken,
        NotificationTokenTypesEnum.confirm,
      );
      expect(mockSubscriptionRepo.confirm).toHaveBeenCalledWith(mockSubId);
    });

    it('should throw AppError if the token is completely invalid or expired', async () => {
      mockTokensService.validateToken.mockReturnValueOnce(null);

      await expect(
        service.confirmSubscription(mockToken),
      ).rejects.toMatchObject({
        type: AppErrorTypesEnum.invalidNotificationToken,
        message: 'Invalid confirmation token',
      });

      expect(mockSubscriptionRepo.confirm).not.toHaveBeenCalled();
    });

    it('should throw AppError if token is valid but subscription record does not exist in DB', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.confirm,
      } as NotificationTokenPayload);
      mockSubscriptionRepo.confirm.mockResolvedValueOnce(null);

      await expect(
        service.confirmSubscription(mockToken),
      ).rejects.toMatchObject({
        type: AppErrorTypesEnum.invalidNotificationToken,
        message: 'Invalid confirmation token',
      });
    });
  });

  describe('unsubscribe', () => {
    const mockToken = 'valid.unsubscribe.jwt.token';
    const mockSubId = 'sub-uuid-789';

    it('should successfully delete the subscription if token is valid', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.unsibscribe,
      } as NotificationTokenPayload);
      mockSubscriptionRepo.deleteOne.mockResolvedValueOnce({
        id: mockSubId,
        email: 'test@example.com',
        githubRepositoryId: 'repo-123',
        confirmed: true,
      } as Subscription);

      await service.unsubscribe(mockToken);

      expect(mockTokensService.validateToken).toHaveBeenCalledWith(
        mockToken,
        NotificationTokenTypesEnum.unsibscribe,
      );
      expect(mockSubscriptionRepo.deleteOne).toHaveBeenCalledWith(mockSubId);
    });

    it('should throw AppError if the token is completely invalid', async () => {
      mockTokensService.validateToken.mockReturnValueOnce(null);

      await expect(service.unsubscribe(mockToken)).rejects.toMatchObject({
        type: AppErrorTypesEnum.invalidNotificationToken,
        message: 'Invalid unsubscription token',
      });

      expect(mockSubscriptionRepo.deleteOne).not.toHaveBeenCalled();
    });

    it('should throw AppError if token is valid but subscription was already deleted', async () => {
      mockTokensService.validateToken.mockReturnValueOnce({
        subscriptionId: mockSubId,
        type: NotificationTokenTypesEnum.unsibscribe,
      } as NotificationTokenPayload);
      mockSubscriptionRepo.deleteOne.mockResolvedValueOnce(null);

      await expect(service.unsubscribe(mockToken)).rejects.toMatchObject({
        type: AppErrorTypesEnum.entityNotFound,
        message: 'Subscription not found',
      });
    });
  });

  describe('getSubscriptions', () => {
    const mockEmail = 'test@example.com';

    it('should return an array of subscriptions with repository data', async () => {
      const mockSubscriptions: SubscriptionWithRepository[] = [
        {
          id: 'sub-1',
          email: mockEmail,
          githubRepositoryId: 'repo-1',
          confirmed: true,
          githubRepository: {
            id: 'repo-1',
            name: 'golang/go',
            lastSeenTag: null,
          },
        },
        {
          id: 'sub-2',
          email: mockEmail,
          githubRepositoryId: 'repo-2',
          confirmed: true,
          githubRepository: {
            id: 'repo-2',
            name: 'facebook/react',
            lastSeenTag: null,
          },
        },
      ];
      mockSubscriptionRepo.findByEmailWithRepo.mockResolvedValueOnce(
        mockSubscriptions,
      );

      const result = await service.getSubscriptions(mockEmail);

      expect(mockSubscriptionRepo.findByEmailWithRepo).toHaveBeenCalledWith(
        mockEmail,
      );
      expect(result).toEqual(mockSubscriptions);
      expect(result.length).toBe(2);
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
