import type { NotificationTokenPayload } from './notification-tokens.types.js';
import type { NotificationTokenTypesEnum } from './token-types.enum.js';

export interface NotificationTokensService {
  generateConfirmToken(subscriptionId: string): string;
  generateUnsubscribeToken(subscriptionId: string): string;
  validateToken(
    token: string,
    action: NotificationTokenTypesEnum,
  ): NotificationTokenPayload | null;
}
