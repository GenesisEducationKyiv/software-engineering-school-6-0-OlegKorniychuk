import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { RepositoryScanner } from './repository-scanner.service.js';
import {
  GithubApiError,
  GithubApiErrorTypesEnum,
} from '../../utils/error-handling/errors/github-api.error.js';
import type { GithubApi } from './github-api.interface.js';
import type {
  GithubApiResponse,
  GitHubRelease,
  GitHubRepository,
} from './github.types.js';

describe('RepositoryScanner', () => {
  let scanner: RepositoryScanner;
  let mockGithubApi: jest.Mocked<GithubApi>;

  const mockSuccess = <T>(data: T): GithubApiResponse<T> => ({
    error: null,
    data,
  });

  const mockError = (
    status: number,
    message: string,
    headers = new Map<string, string>(),
  ): GithubApiResponse<any> => ({
    error: {
      status,
      message,
      fullResponse: {
        headers: {
          get: (key: string) => headers.get(key) || null,
        },
      } as unknown as Response,
    },
    data: null,
  });

  beforeEach(() => {
    mockGithubApi = {
      getRepository: jest.fn(),
      getLatestRepositoryRelease: jest.fn(),
    } as unknown as jest.Mocked<GithubApi>;

    scanner = new RepositoryScanner(mockGithubApi);
  });

  describe('verifyRepository', () => {
    it('should return when the repository exists', async () => {
      mockGithubApi.getRepository.mockResolvedValueOnce(
        mockSuccess({ id: 1, full_name: 'golang/go' } as GitHubRepository),
      );

      expect(scanner.verifyRepository('golang', 'go')).resolves.not.toThrow();

      expect(mockGithubApi.getRepository).toHaveBeenCalledWith('golang', 'go');
    });

    it('should throw GithubApiError when the repository is not found', async () => {
      mockGithubApi.getRepository.mockResolvedValueOnce(
        mockError(404, 'Not Found'),
      );

      try {
        await scanner.verifyRepository('invalid', 'repo');
      } catch (err: any) {
        expect(err).toBeInstanceOf(GithubApiError);
        expect(err.type).toBe(GithubApiErrorTypesEnum.notFound);
        expect(err.details.entity).toBe('repository');
      }
    });

    it('should throw GithubApiError and parse rate limit headers on 429', async () => {
      const resetTimeEpoch = Math.floor(Date.now() / 1000) + 3600;
      const headers = new Map([
        ['x-ratelimit-reset', resetTimeEpoch.toString()],
      ]);

      mockGithubApi.getRepository.mockResolvedValueOnce(
        mockError(429, 'Rate Limit Exceeded', headers),
      );

      try {
        await scanner.verifyRepository('golang', 'go');
      } catch (error: any) {
        expect(error).toBeInstanceOf(GithubApiError);
        expect(error.type).toBe(GithubApiErrorTypesEnum.rateLimitExceeded);
        expect(error.details.retryAfterMs).toBe(resetTimeEpoch * 1000);
      }
    });

    it('should throw generic GithubApiError for unhandled HTTP errors', async () => {
      mockGithubApi.getRepository.mockResolvedValueOnce(
        mockError(500, 'Internal Server Error'),
      );

      try {
        await scanner.verifyRepository('golang', 'go');
      } catch (err: any) {
        expect(err).toBeInstanceOf(GithubApiError);
        expect(err.type).toBe(GithubApiErrorTypesEnum.other);
      }
    });
  });

  describe('getLatestRelease', () => {
    it('should return release data when a release exists', async () => {
      const mockRelease = { tag_name: 'v1.0.0' } as GitHubRelease;
      mockGithubApi.getLatestRepositoryRelease.mockResolvedValueOnce(
        mockSuccess(mockRelease),
      );

      const result = await scanner.getLatestRelease('golang', 'go');

      expect(mockGithubApi.getLatestRepositoryRelease).toHaveBeenCalledWith(
        'golang',
        'go',
      );
      expect(result).toEqual(mockRelease);
    });

    it('should return null when the repository exists but has no releases', async () => {
      mockGithubApi.getLatestRepositoryRelease.mockResolvedValueOnce(
        mockError(404, 'Not Found'),
      );

      const result = await scanner.getLatestRelease('golang', 'go');

      expect(result).toBeNull();
    });

    it('should re-throw GithubApiError for rate limit errors during release fetch', async () => {
      mockGithubApi.getLatestRepositoryRelease.mockResolvedValueOnce(
        mockError(403, 'Rate Limit'),
      );

      await expect(scanner.getLatestRelease('golang', 'go')).rejects.toThrow(
        GithubApiError,
      );
    });
  });
});
