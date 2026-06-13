import type { NotificationTokenTypesEnum } from './token-types.enum.js';

export type NotificationTokenPayload = {
  subscriptionId: string;
  type: NotificationTokenTypesEnum;
};
