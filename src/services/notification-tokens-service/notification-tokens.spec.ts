import { describe, expect, it, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { NotificationTokensService } from './notification-tokens.service.js';
import { NotificationTokenTypesEnum } from './token-types.enum.js';
import type { NotificationTokenPayload } from './notification-tokens.types.js';

describe('NotificationTokensService', () => {
  const testSecret = 'super-secret-test-key';
  let service: NotificationTokensService;

  beforeEach(() => {
    service = new NotificationTokensService(testSecret);
  });

  describe('generateConfirmToken', () => {
    it('should generate a valid JWT with a 1-day expiration', () => {
      const token = service.generateConfirmToken('sub-123');

      const decoded = jwt.verify(
        token,
        testSecret,
      ) as NotificationTokenPayload & { exp: number };

      expect(decoded.subscriptionId).toBe('sub-123');
      expect(decoded.type).toBe(NotificationTokenTypesEnum.confirm);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('generateUnsubscribeToken', () => {
    it('should generate a valid JWT with an infinite lifetime', () => {
      const token = service.generateUnsubscribeToken('sub-456');

      const decoded = jwt.verify(token, testSecret) as NotificationTokenPayload;

      expect(decoded.subscriptionId).toBe('sub-456');
      expect(decoded.type).toBe(NotificationTokenTypesEnum.unsibscribe);
      expect((decoded as { exp?: number }).exp).toBeUndefined();
    });
  });

  describe('validateToken', () => {
    it('should return the decoded payload for a valid token and matching action', () => {
      const token = service.generateConfirmToken('sub-789');

      const result = service.validateToken(
        token,
        NotificationTokenTypesEnum.confirm,
      );

      expect(result).not.toBeNull();
      expect(result?.subscriptionId).toBe('sub-789');
      expect(result?.type).toBe(NotificationTokenTypesEnum.confirm);
    });

    it('should return null if the token type does not match the requested action', () => {
      const token = service.generateConfirmToken('sub-123');

      const result = service.validateToken(
        token,
        NotificationTokenTypesEnum.unsibscribe,
      );

      expect(result).toBeNull();
    });

    it('should return null for a malformed or completely invalid token', () => {
      const result = service.validateToken(
        'not.a.real.token',
        NotificationTokenTypesEnum.confirm,
      );

      expect(result).toBeNull();
    });

    it('should return null if the token was signed with a different secret', () => {
      const maliciousService = new NotificationTokensService(
        'different-secret',
      );
      const badToken = maliciousService.generateConfirmToken('sub-123');

      const result = service.validateToken(
        badToken,
        NotificationTokenTypesEnum.confirm,
      );

      expect(result).toBeNull();
    });

    it('should return null if the token has expired', () => {
      const expiredToken = jwt.sign(
        { subscriptionId: 'sub-123', type: NotificationTokenTypesEnum.confirm },
        testSecret,
        { expiresIn: '-1s' },
      );

      const result = service.validateToken(
        expiredToken,
        NotificationTokenTypesEnum.confirm,
      );

      expect(result).toBeNull();
    });
  });
});
