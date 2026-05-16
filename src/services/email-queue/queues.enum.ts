import type { EnumFromRecord } from '../../utils/enum-from-record.js';

export const Queues = {
  email: 'email-queue',
  scanner: 'scanner-queue',
} as const;

export type Queues = EnumFromRecord<typeof Queues>;
