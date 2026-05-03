import type { EnumFromRecord } from '../../utils/enum-from-record.js';

export const NotificationTokenTypesEnum = {
  confirm: 'confirm',
  unsibscribe: 'unsubscribe',
} as const;

export type NotificationTokenTypesEnum = EnumFromRecord<
  typeof NotificationTokenTypesEnum
>;
