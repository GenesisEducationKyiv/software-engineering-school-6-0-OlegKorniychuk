import type { EnumFromRecord } from '../../enum-from-record.js';

export const AppErrorTypesEnum = {
  other: 'other',
  invalidNotificationToken: 'invalidNotificationToken',
  entityExists: 'entityExists',
  entityNotFound: 'entityNotFound',
} as const;

export type AppErrorTypesEnum = EnumFromRecord<typeof AppErrorTypesEnum>;

export type AppErrorDetails = {
  entity?: string;
};

export class AppError extends Error {
  public readonly type: AppErrorTypesEnum;
  public readonly details: AppErrorDetails;

  constructor(
    type: AppErrorTypesEnum,
    message: string,
    details?: AppErrorDetails,
  ) {
    super(message);
    this.type = type;
    this.details = details || {};
  }
}
