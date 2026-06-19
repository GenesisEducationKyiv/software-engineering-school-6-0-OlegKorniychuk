import type {
  CreateSubscribeSaga,
  SubscribeSaga,
} from './subscribe-saga.types.js';

export interface SubscribeSagaRepository {
  create(data: CreateSubscribeSaga): Promise<SubscribeSaga>;
  findById(id: string): Promise<SubscribeSaga | null>;
  findAwaitingByRepoName(repoName: string): Promise<SubscribeSaga[]>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}
