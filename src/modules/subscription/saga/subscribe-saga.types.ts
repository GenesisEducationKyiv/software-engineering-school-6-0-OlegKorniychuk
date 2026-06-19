import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { subscribeSagas } from '../../../shared/db/schema/subscribe-sagas.js';

export type SubscribeSaga = InferSelectModel<typeof subscribeSagas>;
export type CreateSubscribeSaga = Pick<InferInsertModel<typeof subscribeSagas>, 'email' | 'repoName'>;

export type SagaStatus = 'awaiting_repo' | 'completed' | 'failed';
