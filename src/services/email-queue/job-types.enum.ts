import type { EnumFromRecord } from '../../utils/enum-from-record.js';

export const JobTypesEnum = {
  sendConfirmation: 'send-confirmation',
  sendNotification: 'send-notification',
} as const;

export type JobTypesEnum = EnumFromRecord<typeof JobTypesEnum>;
