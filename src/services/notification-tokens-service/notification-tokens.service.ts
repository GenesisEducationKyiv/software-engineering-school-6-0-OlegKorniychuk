import jwt from 'jsonwebtoken';
import type { NotificationTokenPayload } from './notification-tokens.types.js';
import { NotificationTokenTypesEnum } from './token-types.enum.js';

export class NotificationTokensService {
  constructor(private readonly tokenSecret: string) {}

  public generateConfirmToken(subscriptionId: string) {
    const payload: NotificationTokenPayload = {
      subscriptionId,
      type: NotificationTokenTypesEnum.confirm,
    };

    return jwt.sign(payload, this.tokenSecret, { expiresIn: '1d' });
  }

  public generateUnsubscribeToken(subscriptionId: string) {
    const payload: NotificationTokenPayload = {
      subscriptionId,
      type: NotificationTokenTypesEnum.unsibscribe,
    };

    return jwt.sign(payload, this.tokenSecret);
  }

  public validateToken(
    token: string,
    action: NotificationTokenTypesEnum,
  ): NotificationTokenPayload | null {
    try {
      const decoded = jwt.verify(
        token,
        this.tokenSecret,
      ) as NotificationTokenPayload;

      if (decoded.type !== action) {
        return null;
      }

      return decoded;
    } catch (err) {
      return null;
    }
  }
}
