import type { EnumFromRecord } from '../../shared/utils/enum-from-record.js';

export const Queues = {
  email: 'email-queue',
  scanner: 'scanner-queue',
} as const;

export type Queues = EnumFromRecord<typeof Queues>;
