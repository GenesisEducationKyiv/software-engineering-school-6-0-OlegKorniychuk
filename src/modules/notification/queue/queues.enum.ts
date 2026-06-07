import type { EnumFromRecord } from '../../../shared/utils/enum-from-record.js';

export const Queues = {
  email: 'email-queue',
  scanner: 'scanner-queue',
  releaseDetected: 'release-detected-queue',
} as const;

export type Queues = EnumFromRecord<typeof Queues>;
